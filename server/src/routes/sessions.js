import { Router } from "express";
import { pool } from "../db/pool.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

function toGeoJsonLineString(actualGeom) {
  if (!Array.isArray(actualGeom) || actualGeom.length < 2) return null;
  const coordinates = actualGeom
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lat, lon]) => [lon, lat]);
  if (coordinates.length < 2) return null;
  return { type: "LineString", coordinates };
}

router.post("/", authMiddleware, async (req, res) => {
  const { trailId } = req.body ?? {};
  if (!trailId) {
    return res.status(400).json({ error: "trailId obbligatorio" });
  }

  const trailCheck = await pool.query(`SELECT id FROM trails WHERE id = $1 LIMIT 1`, [trailId]);
  if (!trailCheck.rows[0]) {
    return res.status(404).json({ error: "Trail non trovato" });
  }

  const result = await pool.query(
    `INSERT INTO hike_sessions (trail_id, user_id, started_at)
     VALUES ($1, $2, now())
     RETURNING id`,
    [trailId, req.user.id]
  );
  return res.status(201).json({ sessionId: result.rows[0].id });
});

router.patch("/:id", authMiddleware, async (req, res) => {
  const { completion_pct, deviations_count, actual_geom } = req.body ?? {};
  const actualGeoJson = toGeoJsonLineString(actual_geom);

  if (actualGeoJson) {
    await pool.query(
      `UPDATE hike_sessions
       SET completion_pct = COALESCE($3, completion_pct),
           deviations_count = COALESCE($4, deviations_count),
           actual_geom = ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, completion_pct, deviations_count, JSON.stringify(actualGeoJson)]
    );
  } else {
    await pool.query(
      `UPDATE hike_sessions
       SET completion_pct = COALESCE($3, completion_pct),
           deviations_count = COALESCE($4, deviations_count)
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, completion_pct, deviations_count]
    );
  }
  return res.json({ ok: true });
});

router.post("/:id/finish", authMiddleware, async (req, res) => {
  const { completion_pct, deviations_count, actual_geom } = req.body ?? {};
  const actualGeoJson = toGeoJsonLineString(actual_geom);

  if (actualGeoJson) {
    await pool.query(
      `UPDATE hike_sessions
       SET finished_at = now(),
           completion_pct = COALESCE($3, completion_pct),
           deviations_count = COALESCE($4, deviations_count),
           actual_geom = ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, completion_pct, deviations_count, JSON.stringify(actualGeoJson)]
    );
  } else {
    await pool.query(
      `UPDATE hike_sessions
       SET finished_at = now(),
           completion_pct = COALESCE($3, completion_pct),
           deviations_count = COALESCE($4, deviations_count)
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, completion_pct, deviations_count]
    );
  }
  return res.json({ ok: true });
});

router.get("/:id", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT s.id, s.trail_id, s.started_at, s.finished_at,
            t.name, t.parse_status, t.elevation_profile,
            ST_AsGeoJSON(t.geom) AS geom_geojson
     FROM hike_sessions s
     INNER JOIN trails t ON t.id = s.trail_id
     WHERE s.id = $1 AND s.user_id = $2
     LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: "Sessione non trovata" });
  }
  const row = result.rows[0];
  const waypointsRes = await pool.query(
    `SELECT id, type, label, elevation_m, distance_from_start_m, ST_AsGeoJSON(geom) AS geom_geojson
     FROM waypoints
     WHERE trail_id = $1
     ORDER BY distance_from_start_m ASC`,
    [row.trail_id]
  );
  return res.json({
    ...row,
    geom_geojson: row.geom_geojson ? JSON.parse(row.geom_geojson) : null,
    waypoints: waypointsRes.rows.map((wp) => ({
      ...wp,
      geom_geojson: wp.geom_geojson ? JSON.parse(wp.geom_geojson) : null,
    })),
  });
});

router.get("/", authMiddleware, async (req, res) => {
  const trailId = req.query?.trailId;
  const params = [req.user.id];
  let where = "WHERE user_id = $1";
  if (trailId) {
    params.push(trailId);
    where += " AND trail_id = $2";
  }
  const result = await pool.query(
    `SELECT id, trail_id, started_at, finished_at, completion_pct, deviations_count
     FROM hike_sessions
     ${where}
     ORDER BY created_at DESC`,
    params
  );
  return res.json(result.rows);
});

export default router;
