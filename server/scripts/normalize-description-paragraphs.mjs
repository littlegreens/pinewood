/**
 * Spezza descrizioni "muro" (1 solo <p> o testo senza blank line) in piu paragrafi.
 * node scripts/normalize-description-paragraphs.mjs
 * node scripts/normalize-description-paragraphs.mjs --dry
 */
import "dotenv/config";
import { pool } from "../src/db/pool.js";

const dry = process.argv.includes("--dry");

function splitPlain(plain) {
  const normalized = String(plain || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [];
  const byBlank = normalized
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  if (byBlank.length >= 2) return byBlank;
  const one = byBlank[0] || normalized.replace(/\n/g, " ").trim();
  const sentences = one.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 2) return [one];
  const chunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function htmlToPlain(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>/gi, "\n\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\s*div[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function toHtmlParagraphs(chunks) {
  return chunks.map((c) => `<p>${c}</p>`).join("");
}

const r = await pool.query(
  `SELECT id, name, description
   FROM trails
   WHERE description IS NOT NULL AND trim(description) <> ''`
);

let changed = 0;
for (const row of r.rows) {
  const raw = String(row.description);
  const pCount = (raw.match(/<p[\s>]/gi) || []).length;
  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (isHtml && pCount >= 3) continue;

  const plain = isHtml ? htmlToPlain(raw) : raw;
  const chunks = splitPlain(plain);
  if (chunks.length < 2) continue;

  const next = toHtmlParagraphs(chunks);
  if (next === raw) continue;
  changed += 1;
  console.log(`${dry ? "DRY" : "OK"} ${row.name}: ${pCount || 0}p -> ${chunks.length}p`);
  if (!dry) {
    await pool.query(`UPDATE trails SET description = $2 WHERE id = $1`, [row.id, next]);
  }
}

console.log(`changed=${changed} dry=${dry}`);
await pool.end();
