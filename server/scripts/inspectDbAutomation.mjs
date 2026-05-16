import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const triggers = await pool.query(`
    SELECT
      trigger_name,
      event_manipulation,
      action_timing,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'trails'
    ORDER BY trigger_name
  `);

  const routines = await pool.query(`
    SELECT
      routine_schema,
      routine_name,
      routine_type
    FROM information_schema.routines
    WHERE routine_definition ILIKE '%ai_enriched%'
       OR routine_definition ILIKE '%description%'
       OR routine_definition ILIKE '%gemini%'
       OR routine_definition ILIKE '%google%'
       OR routine_definition ILIKE '%trails%'
    ORDER BY routine_schema, routine_name
  `);

  console.log(
    JSON.stringify(
      {
        triggers_on_trails: triggers.rows,
        routines_matching_keywords: routines.rows,
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
