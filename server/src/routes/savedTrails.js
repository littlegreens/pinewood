import { Router } from "express";
import { pool } from "../db/pool.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", authMiddleware, async (req, res) => {
  const { trailId } = req.body ?? {};
  if (!trailId) {
    return res.status(400).json({ error: "trailId obbligatorio" });
  }

  const trailCheck = await pool.query(`SELECT id FROM trails WHERE id = $1 LIMIT 1`, [trailId]);
  if (!trailCheck.rows[0]) {
    return res.status(404).json({ error: "Trail non trovato" });
  }

  await pool.query(
    `INSERT INTO saved_trails (user_id, trail_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, trail_id) DO NOTHING`,
    [req.user.id, trailId]
  );

  return res.status(201).json({ saved: true });
});

router.delete("/:trailId", authMiddleware, async (req, res) => {
  await pool.query(`DELETE FROM saved_trails WHERE user_id = $1 AND trail_id = $2`, [
    req.user.id,
    req.params.trailId,
  ]);
  res.status(204).send();
});

export default router;
