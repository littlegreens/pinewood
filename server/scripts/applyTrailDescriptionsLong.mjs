import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function fmtKm(v) {
  if (v == null) return "n.d.";
  return `${Number(v).toFixed(1).replace(".", ",")} km`;
}

function fmtM(v) {
  if (v == null) return "n.d.";
  return `${Math.round(Number(v))} m`;
}

function fmtTime(mins) {
  if (!Number.isFinite(Number(mins))) return "n.d.";
  const m = Number(mins);
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r} min`;
  return `${h} h${r ? ` ${r} min` : ""}`;
}

function effortLabel({ distance_km, elevation_gain_m, estimated_time_minutes }) {
  const d = Number(distance_km || 0);
  const g = Number(elevation_gain_m || 0);
  const t = Number(estimated_time_minutes || 0);
  if (d >= 20 || g >= 900 || t >= 420) return "impegnativo";
  if (d >= 12 || g >= 500 || t >= 270) return "medio-impegnativo";
  if (d >= 7 || g >= 250 || t >= 150) return "medio";
  return "contenuto";
}

function terrainLabel({ min_elevation_m, max_elevation_m, source }) {
  const min = Number(min_elevation_m || 0);
  const max = Number(max_elevation_m || 0);
  if (max >= 2000) return "ambiente d'alta quota, con sentieri esposti a vento e cambi rapidi di meteo";
  if (max >= 1200) return "ambiente montano appenninico, con tratti nel bosco e sezioni piu aperte in cresta";
  if (max >= 500) return "ambiente collinare-montano, su sentieri e sterrati con saliscendi regolari";
  if (source === "user") return "ambiente misto tra sterrati, sentieri facili e collegamenti su fondo compatto";
  return "ambiente vario, con fondo misto e passaggi su sentiero non tecnico";
}

function seasonHint({ min_elevation_m, max_elevation_m }) {
  const min = Number(min_elevation_m || 0);
  const max = Number(max_elevation_m || 0);
  if (max >= 2000) {
    return "Nei mesi freddi questa quota richiede esperienza specifica e verifica attenta di neve, ghiaccio e vento.";
  }
  if (max >= 1200) {
    return "Le mezze stagioni sono spesso il periodo migliore: temperatura piu stabile e fondo generalmente piu leggibile.";
  }
  if (min <= 150 && max <= 500) {
    return "In estate conviene partire presto: il caldo puo aumentare molto il carico percepito nei tratti scoperti.";
  }
  return "Con meteo stabile il percorso e gestibile in gran parte dell'anno, adattando orario e equipaggiamento alla stagione.";
}

function buildDescription(trail) {
  const effort = effortLabel(trail);
  const terrain = terrainLabel(trail);
  const time = fmtTime(trail.estimated_time_minutes);
  const p1 =
    `${trail.name} e un itinerario da ${fmtKm(trail.distance_km)} con dislivello positivo di ${fmtM(trail.elevation_gain_m)} e tempo indicativo di ${time}. ` +
    `La lettura complessiva e di impegno ${effort}: non e solo la lunghezza a contare, ma anche la continuita del passo e la gestione delle pause. ` +
    `Se affrontato con ritmo regolare, il percorso resta ben fruibile e offre una progressione chiara dall'inizio alla fine.`;

  const p2 =
    `Il terreno e prevalentemente su ${terrain}. Questo significa che la difficolta non e tecnica, ma legata soprattutto alla costanza: ` +
    `fondo variabile, piccoli rilanci e attenzione all'appoggio possono incidere sulla stanchezza, specialmente nel tratto centrale. ` +
    `Scarponcini con buona aderenza e, se ti trovi bene, bastoncini da trekking aiutano a mantenere stabilita e a distribuire meglio lo sforzo.`;

  const p3 =
    `Dal punto di vista dell'esperienza, il percorso e utile sia per chi cerca una giornata completa sia per chi vuole allenare autonomia e gestione del tempo. ` +
    `La fascia altimetrica (${fmtM(trail.min_elevation_m)} - ${fmtM(trail.max_elevation_m)}) suggerisce di curare meteo, idratazione e abbigliamento a strati: ` +
    `pochi accorgimenti fanno molta differenza su comfort e sicurezza. ${seasonHint(trail)}`;

  const p4 =
    `In pratica: parti con margine, mantieni un'andatura sostenibile, prevedi acqua e uno snack energetico, e considera eventuali varianti solo se hai ancora riserva di energie nel finale. ` +
    `Cosi il percorso rende al meglio, senza forzature, e ti lascia una sensazione di uscita ben gestita dall'inizio al rientro.`;

  let text = [p1, p2, p3, p4].join("\n\n");
  if (text.length < 1000) {
    text +=
      "\n\nPer orientarti meglio lungo la traccia, controlla periodicamente avanzamento e dislivello residuo: avere un riferimento oggettivo riduce errori di ritmo e ti aiuta a distribuire lo sforzo in modo intelligente.";
  }
  if (text.length > 1500) {
    text = text.slice(0, 1490);
    const cut = text.lastIndexOf(".");
    text = `${text.slice(0, cut > 900 ? cut + 1 : 1490).trim()}`;
  }
  return text;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const res = await pool.query(`
    SELECT
      id,
      name,
      source,
      distance_km,
      elevation_gain_m,
      elevation_loss_m,
      min_elevation_m,
      max_elevation_m,
      estimated_time_minutes
    FROM trails
    ORDER BY created_at ASC
  `);

  for (const trail of res.rows) {
    const description = buildDescription(trail);
    await pool.query("UPDATE trails SET description = $2 WHERE id = $1", [trail.id, description]);
  }

  const check = await pool.query(
    "SELECT name, char_length(description) AS len FROM trails ORDER BY name ASC"
  );
  console.log(JSON.stringify(check.rows, null, 2));
} finally {
  await pool.end();
}
