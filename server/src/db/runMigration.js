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

  for (const migrationName of migrations) {
    const migrationPath = path.join(migrationsDir, migrationName);
    const sql = await fs.readFile(migrationPath, "utf8");
    await pool.query(sql);
    console.log(`Migration ${migrationName} applicata con successo.`);
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
