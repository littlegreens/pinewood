import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = `
  SELECT
    id,
    name,
    description,
    difficulty,
    distance_km,
    elevation_gain_m,
    elevation_loss_m,
    min_elevation_m,
    max_elevation_m,
    estimated_time_minutes,
    start_location_text,
    start_location_lat,
    start_location_lon,
    source,
    created_at
  FROM trails
  ORDER BY created_at ASC
`;

try {
  const result = await pool.query(query);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await pool.end();
}
