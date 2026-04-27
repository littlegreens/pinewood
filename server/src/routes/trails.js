import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db/pool.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { buildGeoJsonLineString, parseGpxFile } from "../services/gpxService.js";
import { elevationQueue } from "../services/jobQueue.js";
import { estimateTimeMinutes } from "../services/timeEstimation.js";
import {
  deleteUploadFileSafe,
  getUploadsRoot,
  resolveUploadAbsolutePath,
} from "../services/fileStorage.js";
import {
  enrichTrailDescriptionWithGemini,
  scheduleTrailDescriptionEnrichment,
} from "../services/trailAiEnrichment.js";

const router = Router();

async function ensureTrailVisibilityDefaults() {
  await pool.query(`ALTER TABLE trails ALTER COLUMN is_public SET DEFAULT true`);
}

async function ensureTrailSourceWebsiteColumn() {
  await pool.query(
    `ALTER TABLE trails
     ADD COLUMN IF NOT EXISTS source_website_url varchar(500)`
  );
}

router.get("/", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT
        t.id,
        t.name,
        t.distance_km,
        t.difficulty,
        t.svg_preview,
        t.parse_status,
        t.source,
        t.created_at,
        t.elevation_gain_m,
        t.elevation_loss_m,
        t.estimated_time_minutes,
        t.times_hiked,
        t.is_public,
        (SELECT COUNT(DISTINCT hs2.user_id)::int FROM hike_sessions hs2 WHERE hs2.trail_id = t.id AND hs2.finished_at IS NOT NULL) AS hikers_count,
        (SELECT COUNT(*)::int FROM saved_trails sv WHERE sv.trail_id = t.id) AS saves_count,
        hs.last_hiked_at,
        u.id AS owner_id,
        u.name AS owner_name,
        u.avatar_url AS owner_avatar_url,
        (t.user_id = $1) AS is_mine,
        (st.user_id IS NOT NULL) AS is_saved,
        CASE WHEN t.user_id = $1 THEN 'mine' ELSE 'saved' END AS relation_type
     FROM trails t
     INNER JOIN users u ON u.id = t.user_id
     LEFT JOIN saved_trails st ON st.trail_id = t.id AND st.user_id = $1
     LEFT JOIN LATERAL (
       SELECT MAX(finished_at) AS last_hiked_at
       FROM hike_sessions
       WHERE trail_id = t.id AND user_id = $1
     ) hs ON true
     WHERE t.user_id = $1 OR st.user_id = $1
     ORDER BY t.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.get("/discover", optionalAuthMiddleware, async (req, res) => {
  const sort = String(req.query.sort || "recent");
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const userId = req.user?.id ?? null;

  const params = [userId];
  let orderSql = "t.created_at DESC";
  if (sort === "near" && Number.isFinite(lat) && Number.isFinite(lon)) {
    params.push(lon, lat);
    orderSql = `ST_Distance(
      t.start_point::geography,
      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
    ) ASC NULLS LAST, t.created_at DESC`;
  } else if (sort === "length") {
    orderSql = "t.distance_km DESC NULLS LAST, t.created_at DESC";
  } else if (sort === "length_asc") {
    orderSql = "t.distance_km ASC NULLS LAST, t.created_at DESC";
  } else if (sort === "gain") {
    orderSql = "t.elevation_gain_m DESC NULLS LAST, t.created_at DESC";
  }

  const result = await pool.query(
    `SELECT
        t.id,
        t.name,
        t.distance_km,
        t.difficulty,
        t.svg_preview,
        t.parse_status,
        t.source,
        t.created_at,
        t.elevation_gain_m,
        t.elevation_loss_m,
        t.estimated_time_minutes,
        t.max_elevation_m,
        t.min_elevation_m,
        ST_Y(t.start_point::geometry) AS start_lat,
        ST_X(t.start_point::geometry) AS start_lon,
        (SELECT COUNT(DISTINCT hs2.user_id)::int FROM hike_sessions hs2 WHERE hs2.trail_id = t.id AND hs2.finished_at IS NOT NULL) AS hikers_count,
        (SELECT COUNT(*)::int FROM saved_trails sv WHERE sv.trail_id = t.id) AS saves_count,
        u.id AS owner_id,
        u.name AS owner_name,
        u.avatar_url AS owner_avatar_url,
        (t.user_id = $1) AS is_mine,
        (st.user_id IS NOT NULL) AS is_saved
     FROM trails t
     INNER JOIN users u ON u.id = t.user_id
     LEFT JOIN saved_trails st ON st.trail_id = t.id AND st.user_id = $1
     WHERE t.is_public = true OR t.user_id = $1
     ORDER BY ${orderSql}`,
    params
  );
  res.json(result.rows);
});

router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File GPX/KML obbligatorio" });
  }

  const name = req.body?.name || req.file.originalname.replace(/\.(gpx|kml)$/i, "");

  try {
    await ensureTrailVisibilityDefaults();
    const parsed = await parseGpxFile(req.file.path);
    const geoJson = buildGeoJsonLineString(parsed.points);
    const initialDescription = (req.body?.description || "").trim();
    const initialDifficulty = (req.body?.difficulty || "").trim();

    const result = await pool.query(
      `INSERT INTO trails (
        user_id, name, description, gpx_file_path, geom, start_point, end_point,
        distance_km, svg_preview, source, parse_status,
        elevation_gain_m, elevation_loss_m, max_elevation_m, min_elevation_m, elevation_profile, is_public,
        estimated_time_minutes, difficulty
      )
      VALUES (
        $1, $2, $3, $4,
        ST_SetSRID(ST_GeomFromGeoJSON($5), 4326),
        ST_SetSRID(ST_MakePoint($6, $7), 4326),
        ST_SetSRID(ST_MakePoint($8, $9), 4326),
        $10, $11, 'user', $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING id, parse_status`,
      [
        req.user.id,
        name,
        initialDescription || null,
        path.relative(getUploadsRoot(), req.file.path).replace(/\\/g, "/"),
        JSON.stringify(geoJson),
        parsed.start.lon,
        parsed.start.lat,
        parsed.end.lon,
        parsed.end.lat,
        parsed.distanceKm,
        parsed.svgPreview,
        "processing_elevation",
        parsed.elevation.gain,
        parsed.elevation.loss,
        parsed.elevation.max,
        parsed.elevation.min,
        parsed.elevation.profile ? JSON.stringify(parsed.elevation.profile) : null,
        true,
        parsed.elevation.gain != null || parsed.elevation.loss != null
          ? estimateTimeMinutes(parsed.distanceKm, parsed.elevation.gain)
          : null,
        initialDifficulty || null,
      ]
    );

    await elevationQueue.add(
      "fetch_elevation",
      { trailId: result.rows[0].id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    if (req.user.role === "super_admin" && !(initialDescription || "").trim()) {
      scheduleTrailDescriptionEnrichment(result.rows[0].id);
    }

    return res.status(201).json({ trailId: result.rows[0].id, status: result.rows[0].parse_status });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Errore parsing GPX" });
  }
});

router.get("/download-gpx/:id", optionalAuthMiddleware, async (req, res) => {
  const userId = req.user?.id ?? null;
  const result = await pool.query(
    `SELECT id, user_id, is_public, gpx_file_path, name
     FROM trails
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );
  const trail = result.rows[0];
  if (!trail) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  if (!trail.is_public && trail.user_id !== userId) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  if (!trail.gpx_file_path) {
    return res.status(404).json({ error: "File GPX non disponibile" });
  }
  const absolute = resolveUploadAbsolutePath(trail.gpx_file_path);
  if (!absolute || !fs.existsSync(absolute)) {
    return res.status(404).json({ error: "File GPX non disponibile" });
  }
  const safeName = String(trail.name || "trail")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");
  const ext = path.extname(absolute) || ".gpx";
  return res.download(absolute, `${safeName}${ext}`);
});

router.get("/:id", optionalAuthMiddleware, async (req, res) => {
  const userId = req.user?.id ?? null;
  const result = await pool.query(
    `SELECT
        t.id,
        t.name,
        t.description,
        t.source_website_url,
        t.distance_km,
        t.difficulty,
        t.svg_preview,
        t.parse_status,
        t.source,
        t.created_at,
        t.elevation_gain_m,
        t.elevation_loss_m,
        t.max_elevation_m,
        t.min_elevation_m,
        t.estimated_time_minutes,
        t.elevation_profile,
        t.start_location_text,
        t.start_location_lat,
        t.start_location_lon,
        t.is_public,
        ST_AsGeoJSON(t.geom) AS geom_geojson,
        ST_AsGeoJSON(t.start_point) AS start_point_geojson,
        ST_AsGeoJSON(t.end_point) AS end_point_geojson,
        t.user_id,
        u.name AS owner_name,
        u.avatar_url AS owner_avatar_url,
        (t.user_id = $2) AS is_mine,
        (st.user_id IS NOT NULL) AS is_saved,
        (SELECT COUNT(DISTINCT hs2.user_id)::int FROM hike_sessions hs2 WHERE hs2.trail_id = t.id AND hs2.finished_at IS NOT NULL) AS hikers_count,
        (SELECT COUNT(*)::int FROM saved_trails sv WHERE sv.trail_id = t.id) AS saves_count,
        CASE
          WHEN t.user_id = $2 THEN 'mine'
          WHEN st.user_id IS NOT NULL THEN 'saved'
          ELSE 'discovered'
        END AS relation_type
     FROM trails t
     INNER JOIN users u ON u.id = t.user_id
     LEFT JOIN saved_trails st ON st.trail_id = t.id AND st.user_id = $2
     WHERE t.id = $1
     LIMIT 1`,
    [req.params.id, userId]
  );
  const trail = result.rows[0];
  if (!trail) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  if (!trail.is_public && trail.user_id !== userId) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  const parkingsRes = await pool.query(
    `SELECT id, label, lat, lon, notes, created_at
     FROM trail_parkings
     WHERE trail_id = $1
     ORDER BY created_at ASC`,
    [trail.id]
  );
  return res.json({
    ...trail,
    geom_geojson: trail.geom_geojson ? JSON.parse(trail.geom_geojson) : null,
    start_point_geojson: trail.start_point_geojson ? JSON.parse(trail.start_point_geojson) : null,
    end_point_geojson: trail.end_point_geojson ? JSON.parse(trail.end_point_geojson) : null,
    parkings: parkingsRes.rows,
  });
});

router.patch("/:id", authMiddleware, async (req, res) => {
  const {
    name,
    description,
    difficulty,
    start_location_text,
    start_location_lat,
    start_location_lon,
    distance_km,
    elevation_gain_m,
    elevation_loss_m,
    max_elevation_m,
    min_elevation_m,
    is_public,
    source_website_url,
  } = req.body ?? {};
  await ensureTrailSourceWebsiteColumn();


  const trailCheck = await pool.query(
    `SELECT id, source, user_id
     FROM trails
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );
  const trail = trailCheck.rows[0];
  if (!trail) {
    return res.status(404).json({ error: "Trail non trovato" });
  }

  // source=osm: in MVP nome/statistiche non modificabili
  if (trail.user_id !== req.user.id) {
    return res.status(403).json({ error: "Non autorizzato" });
  }

  if (trail.source === "osm") {
    await pool.query(
      `UPDATE trails
       SET start_location_text = COALESCE($2, start_location_text),
           start_location_lat = COALESCE($3, start_location_lat),
           start_location_lon = COALESCE($4, start_location_lon),
           source_website_url = COALESCE($5, source_website_url),
           is_public = CASE WHEN $6::boolean IS NULL THEN is_public ELSE $6::boolean END
       WHERE id = $1`,
      [
        req.params.id,
        start_location_text,
        start_location_lat,
        start_location_lon,
        source_website_url,
        is_public,
      ]
    );
    return res.json({ ok: true });
  }

  await pool.query(
    `UPDATE trails
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         difficulty = COALESCE($4, difficulty),
         start_location_text = COALESCE($5, start_location_text),
         start_location_lat = COALESCE($6, start_location_lat),
         start_location_lon = COALESCE($7, start_location_lon),
         distance_km = COALESCE($8, distance_km),
         elevation_gain_m = COALESCE($9, elevation_gain_m),
         elevation_loss_m = COALESCE($10, elevation_loss_m),
         max_elevation_m = COALESCE($11, max_elevation_m),
         min_elevation_m = COALESCE($12, min_elevation_m),
         is_public = CASE WHEN $13::boolean IS NULL THEN is_public ELSE $13::boolean END,
         source_website_url = COALESCE($14, source_website_url)
     WHERE id = $1`,
    [
      req.params.id,
      name,
      description,
      difficulty,
      start_location_text,
      start_location_lat,
      start_location_lon,
      distance_km,
      elevation_gain_m,
      elevation_loss_m,
      max_elevation_m,
      min_elevation_m,
      is_public,
      source_website_url,
    ]
  );
  return res.json({ ok: true });
});

router.post("/:id/generate-description-ai", authMiddleware, async (req, res) => {
  const trailRes = await pool.query(
    `SELECT id, user_id
     FROM trails
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );
  const trail = trailRes.rows[0];
  if (!trail) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  if (trail.user_id !== req.user.id) {
    return res.status(403).json({ error: "Non autorizzato" });
  }
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Accesso riservato al super admin" });
  }

  const out = await enrichTrailDescriptionWithGemini(req.params.id, { force: true });
  if (out.error) {
    return res.status(502).json({ error: `Generazione AI fallita: ${out.error}` });
  }
  return res.json(out);
});

router.delete("/:id", authMiddleware, async (req, res) => {
  console.info("[trails.delete] request", {
    trailId: req.params.id,
    userId: req.user?.id,
    authHeaderPresent: Boolean(req.headers?.authorization),
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trailRes = await client.query(
      `SELECT id, user_id, source, gpx_file_path
       FROM trails
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );
    const trail = trailRes.rows[0];
    if (!trail) {
      await client.query("ROLLBACK");
      console.warn("[trails.delete] not found", { trailId: req.params.id, userId: req.user?.id });
      return res.status(404).json({ error: "Trail non trovato" });
    }
    if (trail.user_id !== req.user.id) {
      await client.query("ROLLBACK");
      console.warn("[trails.delete] forbidden owner mismatch", {
        trailId: trail.id,
        ownerId: trail.user_id,
        userId: req.user?.id,
      });
      return res.status(403).json({ error: "Trail non tuo: eliminazione non autorizzata" });
    }
    if (trail.source !== "user") {
      await client.query("ROLLBACK");
      console.warn("[trails.delete] non deletable source", { trailId: trail.id, source: trail.source });
      return res.status(409).json({ error: "Trail non eliminabile (source diverso da user)" });
    }

    // I trail storici possono avere riferimenti senza ON DELETE CASCADE.
    await client.query(`DELETE FROM saved_trails WHERE trail_id = $1`, [trail.id]);
    await client.query(`DELETE FROM hike_sessions WHERE trail_id = $1`, [trail.id]);
    await client.query(`DELETE FROM trail_parkings WHERE trail_id = $1`, [trail.id]);
    await client.query(`DELETE FROM waypoints WHERE trail_id = $1`, [trail.id]);
    await client.query(`DELETE FROM trails WHERE id = $1`, [trail.id]);

    await client.query("COMMIT");
    await deleteUploadFileSafe(trail.gpx_file_path);
    console.info("[trails.delete] deleted", { trailId: trail.id, userId: req.user?.id });
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[trails.delete] failed", {
      trailId: req.params.id,
      userId: req.user?.id,
      code: error?.code,
      message: error?.message || error,
    });
    return res.status(500).json({ error: "Errore eliminazione trail" });
  } finally {
    client.release();
  }
});

router.get("/:id/status", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT parse_status AS status FROM trails WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [req.params.id, req.user.id]
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ error: "Trail non trovato" });
  }
  return res.json(row);
});

router.get("/:id/parkings", authMiddleware, async (req, res) => {
  const trailCheck = await pool.query(`SELECT id FROM trails WHERE id = $1 LIMIT 1`, [req.params.id]);
  if (!trailCheck.rows[0]) {
    return res.status(404).json({ error: "Trail non trovato" });
  }

  const result = await pool.query(
    `SELECT id, label, lat, lon, notes, created_at
     FROM trail_parkings
     WHERE trail_id = $1
     ORDER BY created_at ASC`,
    [req.params.id]
  );
  return res.json(result.rows);
});

router.post("/:id/parkings", authMiddleware, async (req, res) => {
  const { label, lat, lon, notes } = req.body ?? {};
  if (!label) {
    return res.status(400).json({ error: "label obbligatorio" });
  }

  const trailCheck = await pool.query(
    `SELECT id FROM trails WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!trailCheck.rows[0]) {
    return res.status(404).json({ error: "Trail non trovato o non autorizzato" });
  }

  const result = await pool.query(
    `INSERT INTO trail_parkings (trail_id, label, lat, lon, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, lat, lon, notes, created_at`,
    [req.params.id, label, lat ?? null, lon ?? null, notes ?? null]
  );
  return res.status(201).json(result.rows[0]);
});

export default router;
