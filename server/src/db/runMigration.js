import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const migrationsDir = path.join(__dirname, "migrations");
  const allEntries = await fs.readdir(migrationsDir);
  const migrations = allEntries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename varchar(255) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT now()
    )
  `);

  const appliedRes = await pool.query(`SELECT filename FROM schema_migrations`);
  const applied = new Set(appliedRes.rows.map((row) => row.filename));

  for (const migrationName of migrations) {
    if (applied.has(migrationName)) {
      console.log(`Migration ${migrationName} gia applicata, skip.`);
      continue;
    }
    const migrationPath = path.join(migrationsDir, migrationName);
    const sql = await fs.readFile(migrationPath, "utf8");
    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [migrationName]);
      await pool.query("COMMIT");
      console.log(`Migration ${migrationName} applicata con successo.`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
}

run()
  .catch((error) => {
    console.error("Errore migration:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
