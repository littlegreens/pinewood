import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const result = await pool.query(`
    SELECT
      t.id,
      t.name,
      t.user_id,
      u.email,
      t.gpx_file_path,
      t.created_at,
      t.source,
      t.parse_status
    FROM trails t
    JOIN users u ON u.id = t.user_id
    WHERE t.name ILIKE '%peppe%'
       OR t.gpx_file_path ILIKE '%Peppe%'
    ORDER BY t.created_at ASC
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await pool.end();
}
