import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

/** Allineato ai record già presenti in produzione */
const AI_ENRICHMENT_VERSION = "v2";

const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

function debugAi(label, payload) {
  if (!env.trailAiDebug) return;
  console.info(`[trailAiEnrichment][debug] ${label}`, payload);
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text || "").join("").trim();
}

function looksTruncated(text) {
  const out = String(text || "").trim();
  if (!out) return true;
  if (out.length < 900) return true;
  return !/[.!?…]["')\]]?\s*$/.test(out);
}

async function callGemini(prompt, { temperature = 0.65, maxOutputTokens = 3072 } = {}) {
  const response = await fetch(GEMINI_URL(env.geminiModel, env.geminiApiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.error?.message || response.statusText || "Gemini request failed";
    return { error: msg };
  }
  const text = extractGeminiText(data);
  if (!text) return { error: "empty_gemini_response" };
  return {
    text,
    finishReason: data?.candidates?.[0]?.finishReason || null,
  };
}

function buildPrompt(row) {
  const bits = [
    `Nome percorso: ${row.name}`,
    row.distance_km != null ? `Lunghezza indicativa: circa ${row.distance_km} km` : null,
    row.elevation_gain_m != null ? `Dislivello positivo stimato: circa ${row.elevation_gain_m} m` : null,
    row.elevation_loss_m != null ? `Dislivello negativo stimato: circa ${row.elevation_loss_m} m` : null,
    row.difficulty ? `Difficoltà dichiarata: ${row.difficulty}` : null,
    row.start_lat != null && row.start_lon != null
      ? `Punto di partenza approssimativo: ${Number(row.start_lat).toFixed(5)}, ${Number(row.start_lon).toFixed(5)}`
      : null,
  ].filter(Boolean);

  return `Sei un redattore esperto di outdoor e trekking. Scrivi una descrizione dettagliata e coinvolgente
di un percorso escursionistico, nello stile di Wikiloc o AllTrails, con voce narrativa personale.

Vincoli obbligatori:
- Lingua: italiano
- Lunghezza: tra 1000 e 1500 caratteri (spazi inclusi)
- Corpo testuale in prosa fluida, senza elenchi puntati
- Nessun titolo/sezione markdown
- Non inventare dettagli non supportati dai dati forniti

Struttura implicita da integrare nel testo (senza titoli):
1) apertura evocativa di 1-2 frasi
2) sviluppo del tracciato e cambi di paesaggio
3) almeno 2 punti di interesse concreti (solo se ragionevolmente deducibili dai dati; altrimenti resta generico senza inventare nomi)
4) avvisi pratici concreti (tratti impegnativi, esposizione meteo, acqua/segnaletica quando pertinente)

Stile:
- evita incipit stereotipati
- alterna registro narrativo e pratico
- tono affidabile, utile e non promozionale

Dati disponibili del percorso:
${bits.join("\n")}

Rispondi SOLO con il testo finale della descrizione.`;
}

/**
 * Arricchimento descrizione tramite Gemini (solo testo). Idempotente se esiste già una descrizione.
 * @returns {Promise<{ ok?: true, skipped?: true, reason?: string, error?: string }>}
 */
export async function enrichTrailDescriptionWithGemini(trailId, options = {}) {
  const force = Boolean(options.force);
  if (!env.geminiApiKey) {
    return { skipped: true, reason: "missing_api_key" };
  }

  const trailRes = await pool.query(
    `SELECT t.id, t.name, t.description, t.distance_km, t.elevation_gain_m, t.elevation_loss_m,
            t.difficulty, u.role AS owner_role,
            ST_Y(t.start_point::geometry) AS start_lat,
            ST_X(t.start_point::geometry) AS start_lon
     FROM trails t
     INNER JOIN users u ON u.id = t.user_id
     WHERE t.id = $1
     LIMIT 1`,
    [trailId]
  );
  const row = trailRes.rows[0];
  if (!row) return { skipped: true, reason: "trail_not_found" };
  if (row.owner_role !== "super_admin") return { skipped: true, reason: "not_super_admin" };
  if (!force && row.description != null && String(row.description).trim() !== "") {
    return { skipped: true, reason: "has_description" };
  }

  const prompt = buildPrompt(row);
  const prompts = [
    prompt,
    `${prompt}\n\nAttenzione: nel tentativo precedente la descrizione è risultata troncata o troppo breve.
Riscrivi da zero un testo completo, concluso, tra 1000 e 1500 caratteri, con frase finale chiusa.`,
    `${prompt}\n\nProduci un testo completo di 1000-1500 caratteri, senza interrompere frasi.
Se non riesci a rispettare la lunghezza, rispondi con un errore esplicito invece di troncare.`,
  ];

  let text = "";
  let lastReason = "generation_failed";
  for (let i = 0; i < prompts.length; i += 1) {
    const out = await callGemini(prompts[i], {
      temperature: i === 0 ? 0.65 : 0.5,
      maxOutputTokens: i === 0 ? 3072 : 4096,
    });
    if (out.error) {
      lastReason = out.error;
      debugAi("attempt_error", { trailId, attempt: i + 1, error: out.error });
      continue;
    }
    const candidate = String(out.text || "").trim();
    debugAi("attempt_output", {
      trailId,
      attempt: i + 1,
      chars: candidate.length,
      finishReason: out.finishReason || null,
      fullText: candidate,
    });
    if (!looksTruncated(candidate)) {
      text = candidate;
      break;
    }
    lastReason = `truncated_${out.finishReason || "unknown"}`;
    console.warn("[trailAiEnrichment] truncated candidate", {
      trailId,
      attempt: i + 1,
      chars: candidate.length,
      finishReason: out.finishReason || null,
    });
  }

  // Fail-safe: non salvare mai descrizioni mozzate.
  if (!text) {
    return { error: `invalid_truncated_output:${lastReason}` };
  }

  const upd = await pool.query(
    `UPDATE trails
     SET description = $2,
         ai_enriched_at = CURRENT_TIMESTAMP,
         ai_enrichment_version = $3
     WHERE id = $1
       AND ($4::boolean = true OR description IS NULL OR TRIM(description) = '')`,
    [trailId, text, AI_ENRICHMENT_VERSION, force]
  );
  if (upd.rowCount === 0) {
    return { skipped: true, reason: "description_race_or_manual" };
  }
  debugAi("saved_description", {
    trailId,
    chars: text.length,
    fullText: text,
  });
  return { ok: true };
}

/** Non blocca la risposta HTTP dell'upload */
export function scheduleTrailDescriptionEnrichment(trailId) {
  setImmediate(() => {
    enrichTrailDescriptionWithGemini(trailId).catch((err) => {
      console.error("[trailAiEnrichment] unhandled", trailId, err);
    });
  });
}
