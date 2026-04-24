import { Router } from "express";
import { pool } from "../db/pool.js";
import { authMiddleware, requireSuperAdmin } from "../middleware/authMiddleware.js";
import { deleteUploadFileSafe } from "../services/fileStorage.js";
import { sendMail } from "../services/mailer.js";

const router = Router();

router.use(authMiddleware, requireSuperAdmin);

function sanitizePagination(value, fallback, max) {
  const n = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

async function sendAccountBlockedEmail(user) {
  await sendMail({
    to: user.email,
    subject: "Pinewood - Account bloccato",
    text:
      `Ciao ${user.name || ""},\n\n` +
      "il tuo account Pinewood e stato bloccato dal team di moderazione.\n" +
      "Se pensi sia un errore, rispondi a questa email per assistenza.\n",
    html:
      `<p>Ciao ${user.name || ""},</p>` +
      "<p>Il tuo account Pinewood e stato bloccato dal team di moderazione.</p>" +
      "<p>Se pensi sia un errore, rispondi a questa email per assistenza.</p>",
  });
}

async function sendAccountDeletedEmail(user) {
  await sendMail({
    to: user.email,
    subject: "Pinewood - Account eliminato",
    text:
      `Ciao ${user.name || ""},\n\n` +
      "il tuo account Pinewood e stato eliminato in modo definitivo, insieme ai contenuti associati.\n" +
      "Per informazioni puoi contattare il supporto.\n",
    html:
      `<p>Ciao ${user.name || ""},</p>` +
      "<p>Il tuo account Pinewood e stato eliminato in modo definitivo, insieme ai contenuti associati.</p>" +
      "<p>Per informazioni puoi contattare il supporto.</p>",
  });
}

router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const page = sanitizePagination(req.query.page, 1, 1000000);
  const limit = sanitizePagination(req.query.limit, 20, 100);
  const offset = (page - 1) * limit;

  const hasSearch = q.length > 0;
  const whereSql = hasSearch ? "WHERE (u.email ILIKE $1 OR u.name ILIKE $1)" : "";
  const params = hasSearch ? [`%${q}%`, limit, offset] : [limit, offset];
  const countParams = hasSearch ? [`%${q}%`] : [];

  const [countRes, listRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, countParams),
    pool.query(
      `SELECT
        u.id,
        u.email,
        u.name,
        u.avatar_url,
        u.role,
        u.blocked_at,
        u.created_at,
        COALESCE(pub.trails_published, 0)::int AS trails_published,
        COALESCE(sv.trails_saved, 0)::int AS trails_saved
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS trails_published
        FROM trails
        WHERE source = 'user'
        GROUP BY user_id
      ) pub ON pub.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS trails_saved
        FROM saved_trails
        GROUP BY user_id
      ) sv ON sv.user_id = u.id
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${hasSearch ? 2 : 1}
      OFFSET $${hasSearch ? 3 : 2}`,
      params
    ),
  ]);

  return res.json({
    page,
    limit,
    total: countRes.rows[0]?.total ?? 0,
    users: listRes.rows,
  });
});

router.patch("/users/:id/block", async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Non puoi bloccare il tuo account super admin" });
  }

  const userRes = await pool.query(
    `SELECT id, email, name, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [targetId]
  );
  const target = userRes.rows[0];
  if (!target) return res.status(404).json({ error: "Utente non trovato" });
  if (target.role === "super_admin") {
    return res.status(409).json({ error: "Non puoi bloccare un altro super admin" });
  }

  await pool.query(`UPDATE users SET blocked_at = now() WHERE id = $1`, [targetId]);
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [targetId]);
  await pool.query(`UPDATE trails SET is_public = false WHERE user_id = $1`, [targetId]);
  await sendAccountBlockedEmail(target);

  return res.json({ ok: true });
});

router.patch("/users/:id/unblock", async (req, res) => {
  const targetId = req.params.id;
  const userRes = await pool.query(
    `SELECT id, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [targetId]
  );
  const target = userRes.rows[0];
  if (!target) return res.status(404).json({ error: "Utente non trovato" });
  if (target.role === "super_admin") {
    return res.status(409).json({ error: "Operazione non consentita su un super admin" });
  }

  await pool.query(`UPDATE users SET blocked_at = NULL WHERE id = $1`, [targetId]);
  return res.json({ ok: true });
});

router.delete("/users/:id", async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Non puoi eliminare il tuo account super admin" });
  }

  const client = await pool.connect();
  const filesToDelete = [];
  let targetUser = null;

  try {
    await client.query("BEGIN");
    const profileRes = await client.query(
      `SELECT id, email, name, role, avatar_url
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [targetId]
    );
    targetUser = profileRes.rows[0];
    if (!targetUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Utente non trovato" });
    }
    if (targetUser.role === "super_admin") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Non puoi eliminare un altro super admin" });
    }

    const userTrailFilesRes = await client.query(
      `SELECT gpx_file_path
       FROM trails
       WHERE user_id = $1 AND gpx_file_path IS NOT NULL`,
      [targetId]
    );
    for (const row of userTrailFilesRes.rows) {
      if (row.gpx_file_path) filesToDelete.push(row.gpx_file_path);
    }
    if (targetUser.avatar_url) filesToDelete.push(targetUser.avatar_url);

    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [targetId]);
    await client.query(`DELETE FROM hike_sessions WHERE user_id = $1`, [targetId]);
    await client.query(`DELETE FROM saved_trails WHERE user_id = $1`, [targetId]);
    await client.query(
      `DELETE FROM saved_trails
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [targetId]
    );
    await client.query(
      `DELETE FROM hike_sessions
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [targetId]
    );
    await client.query(
      `DELETE FROM trail_parkings
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [targetId]
    );
    await client.query(
      `DELETE FROM waypoints
       WHERE trail_id IN (SELECT id FROM trails WHERE user_id = $1)`,
      [targetId]
    );
    await client.query(`DELETE FROM trails WHERE user_id = $1`, [targetId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin.users.delete] failed", {
      targetId,
      adminId: req.user?.id,
      code: error?.code,
      message: error?.message || error,
    });
    return res.status(500).json({ error: "Errore eliminazione utente" });
  } finally {
    client.release();
  }

  await Promise.all(filesToDelete.map((storedPath) => deleteUploadFileSafe(storedPath)));
  if (targetUser) {
    await sendAccountDeletedEmail(targetUser);
  }
  return res.status(204).send();
});

export default router;
