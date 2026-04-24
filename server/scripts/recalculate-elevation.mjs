/**
 * Ricalcola dislivelli da OpenTopoData con la pipeline attuale (resample + smooth + threshold).
 * Uso (da container server, dove DATABASE_URL raggiunge il DB):
 *   node scripts/recalculate-elevation.mjs
 *   node scripts/recalculate-elevation.mjs Redentore
 */
import { pool } from "../src/db/pool.js";
import { processTrailElevation } from "../src/services/elevationService.js";

const nameArg = process.argv[2];

async function main() {
  const res = nameArg
    ? await pool.query(
        `SELECT id, name FROM trails WHERE name ILIKE $1 ORDER BY id`,
        [`%${nameArg}%`]
      )
    : await pool.query(`SELECT id, name FROM trails ORDER BY id`);

  if (!res.rows.length) {
    console.error("Nessun trail trovato.");
    process.exit(1);
  }

  for (const row of res.rows) {
    process.stdout.write(`#${row.id} ${row.name} … `);
    await processTrailElevation(row.id, { force: true });
    const check = await pool.query(
      `SELECT elevation_gain_m, elevation_loss_m FROM trails WHERE id = $1`,
      [row.id]
    );
    const e = check.rows[0];
    console.log(`+${e.elevation_gain_m} / -${e.elevation_loss_m} m`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
