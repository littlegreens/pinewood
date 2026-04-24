import { Router } from "express";
import { pool } from "../db/pool.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.patch("/:parkingId", authMiddleware, async (req, res) => {
  const { label, lat, lon, notes } = req.body ?? {};
  const check = await pool.query(
    `SELECT p.id
     FROM trail_parkings p
     INNER JOIN trails t ON t.id = p.trail_id
     WHERE p.id = $1 AND t.user_id = $2
     LIMIT 1`,
    [req.params.parkingId, req.user.id]
  );
  if (!check.rows[0]) {
    return res.status(404).json({ error: "Parcheggio non trovato" });
  }

  await pool.query(
    `UPDATE trail_parkings
     SET label = COALESCE($2, label),
         lat = COALESCE($3, lat),
         lon = COALESCE($4, lon),
         notes = COALESCE($5, notes)
     WHERE id = $1`,
    [req.params.parkingId, label, lat, lon, notes]
  );
  return res.json({ ok: true });
});

router.delete("/:parkingId", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `DELETE FROM trail_parkings p
     USING trails t
     WHERE p.id = $1
       AND p.trail_id = t.id
       AND t.user_id = $2
     RETURNING p.id`,
    [req.params.parkingId, req.user.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Parcheggio non trovato" });
  }
  return res.status(204).send();
});

export default router;
