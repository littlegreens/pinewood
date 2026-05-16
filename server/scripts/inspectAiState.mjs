import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const needle = process.argv[2] || "";

try {
  const trailRes = await pool.query(
    `
      SELECT
        t.id,
        t.name,
        t.description IS NOT NULL AS has_description,
        t.ai_enriched_at,
        t.ai_enrichment_version,
        t.user_id,
        u.email,
        u.role,
        t.created_at
      FROM trails t
      JOIN users u ON u.id = t.user_id
      WHERE t.name ILIKE $1 OR t.gpx_file_path ILIKE $1
      ORDER BY t.created_at DESC
    `,
    [`%${needle}%`]
  );

  const summaryRes = await pool.query(`
    SELECT
      u.email,
      u.role,
      COUNT(*) FILTER (WHERE t.description IS NOT NULL) AS with_description,
      COUNT(*) FILTER (WHERE t.ai_enriched_at IS NOT NULL) AS ai_marked,
      COUNT(*) AS total
    FROM trails t
    JOIN users u ON u.id = t.user_id
    GROUP BY u.email, u.role
    ORDER BY u.email
  `);

  console.log(
    JSON.stringify(
      {
        matching_trails: trailRes.rows,
        summary_by_user: summaryRes.rows,
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
