import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../services/authTokens.js";
import { sendMail } from "../services/mailer.js";

const router = Router();
const REFRESH_COOKIE = "pinewood_refresh";
const LEGAL_VERSION = "2026-04-21";
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
};

async function ensureAuthColumns() {
  await pool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS legal_version varchar(30),
     ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp,
     ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
     ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS email_verified_at timestamp,
     ADD COLUMN IF NOT EXISTS role varchar(30) NOT NULL DEFAULT 'user',
     ADD COLUMN IF NOT EXISTS blocked_at timestamp`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
       id bigserial PRIMARY KEY,
       user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       token_hash varchar(128) NOT NULL,
       code_hash varchar(128) NOT NULL,
       expires_at timestamp NOT NULL,
       used_at timestamp,
       created_at timestamp NOT NULL DEFAULT now()
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       id bigserial PRIMARY KEY,
       user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       token_hash varchar(128) NOT NULL,
       expires_at timestamp NOT NULL,
       used_at timestamp,
       created_at timestamp NOT NULL DEFAULT now()
     )`
  );
  // Backfill utenti pre-GDPR in ambiente già avviato: evita blocco login.
  await pool.query(
    `UPDATE users
     SET legal_version = COALESCE(legal_version, $1),
         privacy_accepted_at = COALESCE(privacy_accepted_at, now()),
         terms_accepted_at = COALESCE(terms_accepted_at, now())`,
    [LEGAL_VERSION]
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildClientUrl(pathWithQuery) {
  const base = String(env.clientUrl || "").replace(/\/$/, "");
  return `${base}${pathWithQuery}`;
}

async function issueEmailVerification(user) {
  const rawToken = randomToken();
  const rawCode = randomCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, sha256(rawToken), sha256(rawCode), expiresAt]
  );
  const verifyLink = buildClientUrl(`/?verify=${rawToken}`);
  await sendMail({
    to: user.email,
    subject: "Pinewood - Verifica la tua email",
    text:
      `Ciao ${user.name || ""},\n\n` +
      `il tuo codice di verifica è: ${rawCode}\n` +
      `oppure apri questo link: ${verifyLink}\n\n` +
      "Il codice scade tra 15 minuti.",
    html:
      `<p>Ciao ${user.name || ""},</p>` +
      `<p>Il tuo codice di verifica è <strong>${rawCode}</strong>.</p>` +
      `<p>In alternativa puoi confermare cliccando qui: <a href="${verifyLink}">${verifyLink}</a></p>` +
      "<p>Il codice scade tra 15 minuti.</p>",
  });
}

async function issuePasswordReset(user) {
  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, sha256(rawToken), expiresAt]
  );
  const resetLink = buildClientUrl(`/?reset=${rawToken}`);
  await sendMail({
    to: user.email,
    subject: "Pinewood - Recupero password",
    text:
      `Ciao ${user.name || ""},\n\n` +
      `per reimpostare la password apri questo link: ${resetLink}\n\n` +
      "Il link scade tra 30 minuti.",
    html:
      `<p>Ciao ${user.name || ""},</p>` +
      `<p>Per reimpostare la password clicca qui: <a href="${resetLink}">${resetLink}</a></p>` +
      "<p>Il link scade tra 30 minuti.</p>",
  });
}

router.post("/register", async (req, res) => {
  const { email, password, name, acceptPrivacy, acceptTerms, marketingOptIn } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password e name sono obbligatori" });
  }
  if (!acceptPrivacy || !acceptTerms) {
    return res.status(400).json({ error: "Devi accettare Privacy Policy e Termini di Servizio" });
  }

  try {
    await ensureAuthColumns();
    const hash = await bcrypt.hash(password, 10);
    const normalizedEmail = String(email).toLowerCase();
    const existingRes = await pool.query(
      `SELECT id, email, name, email_verified_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    );
    const existing = existingRes.rows[0];
    let user;
    if (existing?.email_verified_at) {
      return res.status(409).json({ error: "Email già registrata" });
    }
    if (existing) {
      await pool.query(
        `UPDATE users
         SET name = $2,
             password_hash = $3,
             legal_version = $4,
             privacy_accepted_at = now(),
             terms_accepted_at = now(),
             marketing_opt_in = $5
         WHERE id = $1`,
        [existing.id, name, hash, LEGAL_VERSION, Boolean(marketingOptIn)]
      );
      await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [existing.id]);
      user = { id: existing.id, email: existing.email, name };
    } else {
      const result = await pool.query(
        `INSERT INTO users (
           email,
           name,
           password_hash,
           legal_version,
           privacy_accepted_at,
           terms_accepted_at,
           marketing_opt_in
         )
         VALUES ($1, $2, $3, $4, now(), now(), $5)
         RETURNING id, email, name`,
        [normalizedEmail, name, hash, LEGAL_VERSION, Boolean(marketingOptIn)]
      );
      user = result.rows[0];
    }
    await issueEmailVerification(user);
    return res.status(201).json({ message: "Verifica email inviata" });
  } catch (error) {
    return res.status(500).json({ error: "Errore creazione account" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email e password obbligatori" });
  }
  await ensureAuthColumns();

  const result = await pool.query(
    `SELECT id, email, name, avatar_url, password_hash, email_verified_at, legal_version, privacy_accepted_at, terms_accepted_at, role, blocked_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [String(email).toLowerCase()]
  );
  const user = result.rows[0];
  if (!user?.password_hash) {
    return res.status(401).json({ error: "Credenziali non valide" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Credenziali non valide" });
  }
  if (!user.email_verified_at) {
    return res.status(403).json({ error: "Email non verificata" });
  }
  if (user.blocked_at) {
    return res.status(403).json({ error: "Account bloccato. Contatta l'assistenza Pinewood." });
  }
  if (!user.privacy_accepted_at || !user.terms_accepted_at) {
    return res.status(403).json({ error: "Consensi legali mancanti" });
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url ?? null,
    role: user.role || "user",
  };
  const accessToken = signAccessToken(safeUser);
  const refresh = await createRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refresh.rawToken, cookieOptions);
  return res.json({ accessToken, user: safeUser });
});

router.post("/google", (req, res) => {
  res.status(501).json({ error: "Google login non attivo in questo ambiente" });
});

router.post("/verify-email", async (req, res) => {
  await ensureAuthColumns();
  const { token, email, code } = req.body ?? {};
  let userId = null;
  if (token) {
    const result = await pool.query(
      `SELECT user_id
       FROM email_verification_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY id DESC
       LIMIT 1`,
      [sha256(String(token))]
    );
    userId = result.rows[0]?.user_id ?? null;
  } else if (email && code) {
    const userRes = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [String(email).toLowerCase()]);
    const candidateUserId = userRes.rows[0]?.id;
    if (candidateUserId) {
      const result = await pool.query(
        `SELECT user_id
         FROM email_verification_tokens
         WHERE user_id = $1
           AND code_hash = $2
           AND used_at IS NULL
           AND expires_at > now()
         ORDER BY id DESC
         LIMIT 1`,
        [candidateUserId, sha256(String(code))]
      );
      userId = result.rows[0]?.user_id ?? null;
    }
  }
  if (!userId) {
    return res.status(400).json({ error: "Codice o link non valido/scaduto" });
  }
  await pool.query(
    `UPDATE email_verification_tokens
     SET used_at = now()
     WHERE user_id = $1
       AND used_at IS NULL`,
    [userId]
  );
  await pool.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now())
     WHERE id = $1`,
    [userId]
  );
  return res.json({ ok: true });
});

router.post("/resend-verification", async (req, res) => {
  await ensureAuthColumns();
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "Email obbligatoria" });
  const userRes = await pool.query(
    `SELECT id, email, name, email_verified_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [String(email).toLowerCase()]
  );
  const user = userRes.rows[0];
  if (user && !user.email_verified_at) {
    await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [user.id]);
    await issueEmailVerification(user);
  }
  return res.json({ ok: true });
});

router.post("/forgot-password", async (req, res) => {
  await ensureAuthColumns();
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "Email obbligatoria" });
  const userRes = await pool.query(
    `SELECT id, email, name
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [String(email).toLowerCase()]
  );
  const user = userRes.rows[0];
  if (user) {
    await issuePasswordReset(user);
  }
  return res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  await ensureAuthColumns();
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token e nuova password obbligatori" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "Password troppo corta (min 8 caratteri)" });
  }
  const result = await pool.query(
    `SELECT user_id, id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY id DESC
     LIMIT 1`,
    [sha256(String(token))]
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(400).json({ error: "Link reset non valido o scaduto" });
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [row.user_id, hash]);
  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE user_id = $1
       AND used_at IS NULL`,
    [row.user_id]
  );
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [row.user_id]);
  return res.json({ ok: true });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Refresh token mancante" });
  }

  const rotated = await rotateRefreshToken(token);
  if (!rotated) {
    return res.status(401).json({ error: "Refresh token non valido" });
  }

  const userResult = await pool.query(
    `SELECT id, email, name, role, blocked_at FROM users WHERE id = $1 LIMIT 1`,
    [rotated.userId]
  );
  const user = userResult.rows[0];
  if (!user || user.blocked_at) {
    return res.status(403).json({ error: "Account bloccato o non disponibile" });
  }
  const accessToken = signAccessToken(user);
  res.cookie(REFRESH_COOKIE, rotated.rawToken, cookieOptions);
  return res.json({ accessToken });
});

router.delete("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  await revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).send();
});

export default router;
