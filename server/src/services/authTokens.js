import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN_DAYS = 30;

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role || "user" },
    env.jwtSecret,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export async function createRefreshToken(userId) {
  const rawToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_DAYS * 86400000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
     VALUES ($1, $2, $3, false)`,
    [userId, tokenHash, expiresAt]
  );

  return { rawToken, expiresAt };
}

export async function rotateRefreshToken(rawToken) {
  const tokenHash = sha256(rawToken);
  const result = await pool.query(
    `SELECT id, user_id, expires_at, revoked
     FROM refresh_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const token = result.rows[0];
  if (!token || token.revoked || new Date(token.expires_at) < new Date()) {
    return null;
  }

  await pool.query("UPDATE refresh_tokens SET revoked = true WHERE id = $1", [
    token.id,
  ]);

  const next = await createRefreshToken(token.user_id);
  return { userId: token.user_id, ...next };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await pool.query("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1", [
    sha256(rawToken),
  ]);
}

export async function purgeExpiredRefreshTokens() {
  await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < now() OR revoked = true`
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
