/**
 * Scarica POI OSM per tutte le trail ancora senza source=osm.
 * Uso (da server/, con Redis acceso e worker in esecuzione OPPURE inline):
 *   node scripts/backfill-pois.mjs
 *   node scripts/backfill-pois.mjs --inline   # chiama Overpass qui, senza coda
 *   node scripts/backfill-pois.mjs --limit=20
 */
import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { poiQueue } from "../src/services/jobQueue.js";
import { processTrailPois } from "../src/services/poiService.js";

const args = process.argv.slice(2);
const inline = args.includes("--inline");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 50) : 200;

const trails = await pool.query(
  `SELECT t.id, t.name
   FROM trails t
   WHERE t.geom IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM waypoints w WHERE w.trail_id = t.id AND w.source = 'osm'
     )
   ORDER BY t.created_at DESC
   LIMIT $1`,
  [limit]
);

console.log(`Trail da sincronizzare: ${trails.rowCount} (inline=${inline})`);

for (const row of trails.rows) {
  try {
    if (inline) {
      const r = await processTrailPois(row.id, { force: true });
      console.log(`OK ${row.name}:`, r);
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      await poiQueue.add(
        "fetch_pois",
        { trailId: row.id, force: true },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 8000 },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      console.log(`Queued ${row.name}`);
    }
  } catch (err) {
    console.error(`FAIL ${row.name}:`, err.message || err);
  }
}

await pool.end();
if (!inline) {
  // lascia uscire il processo anche con Redis connesso
  process.exit(0);
}
