import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
const isSupabaseConnection = /supabase\.com/i.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  // Supabase presents a managed cert chain not trusted by default in this container.
  // Keep SSL enabled but skip strict CA verification for app connectivity.
  ...(isSupabaseConnection ? { ssl: { rejectUnauthorized: false } } : {}),
});

export async function checkDbHealth() {
  const result = await pool.query("SELECT 1 as ok");
  return result.rows[0]?.ok === 1;
}
