/**
 * Scarica POI OSM per le trail.
 *
 *   node scripts/backfill-pois.mjs --inline              # solo senza source=osm
 *   node scripts/backfill-pois.mjs --inline --force-all  # ricalcola tutte (corridor/tipi nuovi)
 *   node scripts/backfill-pois.mjs --inline --limit=50
 *   node scripts/backfill-pois.mjs                       # coda Redis
 */
import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { processTrailPois } from "../src/services/poiService.js";

const args = process.argv.slice(2);
const inline = args.includes("--inline");
const forceAll = args.includes("--force-all");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 50) : 500;
const maxKmArg = args.find((a) => a.startsWith("--max-km="));
/** Evita cammini 100+ km che esplodono Overpass (si fanno a parte). */
const maxKm = maxKmArg ? Math.max(1, Number(maxKmArg.split("=")[1]) || 80) : 80;

const trails = forceAll
  ? await pool.query(
      `SELECT t.id, t.name, t.distance_km
       FROM trails t
       WHERE t.geom IS NOT NULL
         AND (t.distance_km IS NULL OR t.distance_km <= $2)
       ORDER BY t.distance_km ASC NULLS FIRST, t.created_at DESC
       LIMIT $1`,
      [limit, maxKm]
    )
  : await pool.query(
      `SELECT t.id, t.name, t.distance_km
       FROM trails t
       WHERE t.geom IS NOT NULL
         AND (t.distance_km IS NULL OR t.distance_km <= $2)
         AND NOT EXISTS (
           SELECT 1 FROM waypoints w WHERE w.trail_id = t.id AND w.source = 'osm'
         )
       ORDER BY t.distance_km ASC NULLS FIRST, t.created_at DESC
       LIMIT $1`,
      [limit, maxKm]
    );

console.log(
  `Trail da sincronizzare: ${trails.rowCount} (inline=${inline}, forceAll=${forceAll}, maxKm=${maxKm})`
);

let ok = 0;
let fail = 0;
let inserted = 0;

for (const row of trails.rows) {
  try {
    if (inline) {
      const r = await processTrailPois(row.id, { force: true });
      ok += 1;
      inserted += Number(r?.inserted || 0);
      console.log(`OK [${ok}/${trails.rowCount}] ${row.name}:`, r);
      await new Promise((r) => setTimeout(r, 2800));
    } else {
      const { poiQueue } = await import("../src/services/jobQueue.js");
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
      ok += 1;
      console.log(`Queued ${row.name}`);
    }
  } catch (err) {
    fail += 1;
    console.error(`FAIL ${row.name}:`, err.message || err);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

console.log(`Fine. ok=${ok} fail=${fail} pois_inseriti=${inserted}`);
await pool.end();
process.exit(fail > 0 && ok === 0 ? 1 : 0);
