import "dotenv/config";
import { pool } from "../src/db/pool.js";

const r = await pool.query(
  `SELECT
      t.id,
      t.name,
      LEFT(COALESCE(t.description, ''), 100) AS dpreview,
      (t.description IS NULL OR TRIM(t.description) = '') AS empty_desc,
      LENGTH(COALESCE(t.description, '')) AS desc_len,
      t.distance_km,
      t.difficulty,
      t.start_location_text,
      t.source_website_url,
      (
        SELECT COUNT(*)::int FROM waypoints w
        WHERE w.trail_id = t.id AND w.source = 'osm'
      ) AS osm_pois
   FROM trails t
   WHERE t.geom IS NOT NULL
   ORDER BY t.created_at ASC`
);

console.log(JSON.stringify(r.rows, null, 2));
console.log(
  "TOTAL",
  r.rowCount,
  "EMPTY_DESC",
  r.rows.filter((x) => x.empty_desc).length,
  "WITH_OSM",
  r.rows.filter((x) => x.osm_pois > 0).length
);
await pool.end();
