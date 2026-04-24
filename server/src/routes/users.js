import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { pool } from "../db/pool.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { deleteUploadFileSafe, getUploadsRoot } from "../services/fileStorage.js";

const router = Router();
const uploadsDir = path.join(getUploadsRoot(), "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || ".jpg").toLowerCase();
      cb(null, `avatar-${Date.now()}-${req.user?.id || "user"}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    return cb(new Error("File avatar non valido"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function ensureAvatarColumn() {
  await pool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS avatar_url varchar(500)`
  );
}

async function getUserStats(userId) {
  const [mineRes, savedRes, doneRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM trails WHERE user_id = $1 AND source = 'user'`, [userId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM saved_trails WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM hike_sessions
       WHERE user_id = $1 AND finished_at IS NOT NULL`,
      [userId]
    ),
  ]);
  return {
    trails_uploaded: mineRes.rows[0]?.count ?? 0,
    trails_saved: savedRes.rows[0]?.count ?? 0,
    hikes_completed: doneRes.rows[0]?.count ?? 0,
  };
}

router.get("/me", authMiddleware, async (req, res) => {
  await ensureAvatarColumn();
  const result = await pool.query(
    `SELECT id, email, name, avatar_url, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Utente non trovato" });
  const stats = await getUserStats(req.user.id);
  return res.json({ ...result.rows[0], ...stats });
});

router.patch("/me", authMiddleware, avatarUpload.single("avatar"), async (req, res) => {
  await ensureAvatarColumn();
  const displayName = (req.body?.name || "").trim();
  const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : null;

  await pool.query(
    `UPDATE users
     SET name = COALESCE($2, name),
         avatar_url = COALESCE($3, avatar_url)
     WHERE id = $1`,
    [req.user.id, displayName || null, avatarUrl]
  );

  const updated = await pool.query(
    `SELECT id, email, name, avatar_url, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [req.user.id]
  );
  const stats = await getUserStats(req.user.id);
  return res.json({ ...updated.rows[0], ...stats });
});

router.patch("/me/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Password attuale e nuova password sono obbligatorie" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "Nuova password troppo corta (min 8 caratteri)" });
  }

  const userRes = await pool.query(
    `SELECT id, password_hash
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [req.user.id]
  );
  const user = userRes.rows[0];
  if (!user?.password_hash) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Password attuale non valida" });
  }

  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.user.id, hash]);
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [req.user.id]);
  return res.json({ ok: true });
});

router.delete("/me", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  const filesToDelete = [];
  try {
    await client.query("BEGIN");

    const profileRes = await client.query(
      `SELECT avatar_url
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );
    if (!profileRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Utente non trovato" });
    }

    const userTrailFilesRes = await client.query(
      `SELECT gpx_file_path
       FROM trails
       WHERE user_id = $1 AND gpx_file_path IS NOT NULL`,
      [req.user.id]
    );
    for (const row of userTrailFilesRes.rows) {
      if (row.gpx_file_path) filesToDelete.push(row.gpx_file_path);
    }
    if (profileRes.rows[0].avatar_url) filesToDelete.push(profileRes.rows[0].avatar_url);

    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM hike_sessions WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM saved_trails WHERE user_id = $1`, [req.user.id]);
    await client.query(
      `DELETE FROM saved_trails
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [req.user.id]
    );
    await client.query(
      `DELETE FROM hike_sessions
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [req.user.id]
    );
    await client.query(
      `DELETE FROM trail_parkings
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [req.user.id]
    );
    await client.query(
      `DELETE FROM waypoints
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [req.user.id]
    );
    await client.query(`DELETE FROM trails WHERE user_id = $1`, [req.user.id]);
    await client.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);
    await client.query("COMMIT");

    await Promise.all(filesToDelete.map((storedPath) => deleteUploadFileSafe(storedPath)));
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[users.delete.me] failed", error);
    return res.status(500).json({ error: "Errore eliminazione account" });
  } finally {
    client.release();
  }
});

export default router;
