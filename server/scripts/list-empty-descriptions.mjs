import "dotenv/config";
import { pool } from "../src/db/pool.js";

const r = await pool.query(
  `SELECT id, name, distance_km, elevation_gain_m, elevation_loss_m,
          min_elevation_m, max_elevation_m, difficulty, route_type
   FROM trails
   WHERE geom IS NOT NULL
     AND (description IS NULL OR TRIM(description) = '')
   ORDER BY name`
);
console.log(JSON.stringify(r.rows, null, 2));
console.log("EMPTY", r.rowCount);
await pool.end();
