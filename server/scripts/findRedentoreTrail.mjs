import { pool } from "../src/db/pool.js";

const res = await pool.query(
  `SELECT id, name, distance_km, elevation_gain_m, elevation_loss_m, difficulty
   FROM trails
   WHERE lower(name) LIKE lower($1)
   ORDER BY created_at DESC
   LIMIT 20`,
  ["%redentore%"]
);

console.log(JSON.stringify(res.rows, null, 2));
await pool.end();
