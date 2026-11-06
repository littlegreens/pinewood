/**
 * Rimuove i POI demo inventati (Fonte / Bivacco / Belvedere / Acqua
 * con distance_from_start_m tipiche del seed).
 * NON tocca waypoint provenienti da GPX con label/type diversi.
 *
 * Uso (da server/): node scripts/purge-demo-pois.mjs
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Label esatte usate dallo script seed-demo-pois.mjs
const DEMO_LABELS = ["Fonte", "Bivacco", "Belvedere", "Acqua"];

const before = await pool.query("SELECT COUNT(*)::int AS n FROM waypoints");
console.log("Waypoints prima:", before.rows[0].n);

const del = await pool.query(
  `DELETE FROM waypoints
   WHERE label = ANY($1::text[])
     AND type = ANY($2::text[])
   RETURNING id, trail_id, type, label`,
  [DEMO_LABELS, ["water", "shelter", "viewpoint"]]
);

console.log("Eliminati demo:", del.rowCount);

const after = await pool.query("SELECT COUNT(*)::int AS n FROM waypoints");
console.log("Waypoints rimasti (presumibilmente da GPX):", after.rows[0].n);

const sample = await pool.query(
  `SELECT t.name, w.type, w.label
   FROM waypoints w
   JOIN trails t ON t.id = w.trail_id
   ORDER BY t.name, w.label
   LIMIT 30`
);
console.log("Esempi rimasti:", sample.rows);

await pool.end();
