import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const email = "test@pinewood.local";
const password = "PinewoodTest1!";
const hash = await bcrypt.hash(password, 10);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS legal_version varchar(30),
    ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp,
    ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
    ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verified_at timestamp,
    ADD COLUMN IF NOT EXISTS role varchar(30) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS blocked_at timestamp
`);

const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
if (existing.rows[0]) {
  await pool.query(
    `UPDATE users SET
      password_hash = $2,
      name = 'Test Pinewood',
      email_verified_at = COALESCE(email_verified_at, now()),
      privacy_accepted_at = COALESCE(privacy_accepted_at, now()),
      terms_accepted_at = COALESCE(terms_accepted_at, now()),
      legal_version = COALESCE(legal_version, '2026-04-21'),
      blocked_at = NULL
    WHERE email = $1`,
    [email, hash],
  );
  console.log("updated");
} else {
  await pool.query(
    `INSERT INTO users (
       email, name, password_hash, legal_version,
       privacy_accepted_at, terms_accepted_at, email_verified_at, role
     ) VALUES ($1, 'Test Pinewood', $2, '2026-04-21', now(), now(), now(), 'user')`,
    [email, hash],
  );
  console.log("created");
}

await pool.end();
console.log(JSON.stringify({ email, password }));
