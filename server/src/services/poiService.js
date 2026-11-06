import { pool } from "../db/pool.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** Raggio (m) dal tracciato: solo POI davvero vicino alla mappa. */
const CORRIDOR_M = 120;
/** Trail lunghi: pezzi da N km per non far scoppiare Overpass. */
const CHUNK_KM = 40;
const USER_AGENT = "PinewoodTrailApp/1.0 (poi-sync; contact@pinewood.local)";

/**
 * Tag OSM ? tipi Pinewood (acqua / rifugio / belvedere).
 * Solo dati reali da OpenStreetMap, mai inventati.
 */
const OSM_QUERIES = [
  { type: "water", ql: 'node["amenity"="drinking_water"]' },
  { type: "water", ql: 'node["amenity"="water_point"]' },
  { type: "water", ql: 'node["natural"="spring"]' },
  { type: "shelter", ql: 'node["tourism"="alpine_hut"]' },
  { type: "shelter", ql: 'node["tourism"="wilderness_hut"]' },
  { type: "shelter", ql: 'node["amenity"="shelter"]' },
  { type: "shelter", ql: 'node["tourism"="cabin"]' },
  { type: "viewpoint", ql: 'node["tourism"="viewpoint"]' },
];

const TYPE_LABEL = {
  water: "Acqua",
  shelter: "Rifugio",
  viewpoint: "Belvedere",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildOverpassQuery(south, west, north, east) {
  const bbox = `${south},${west},${north},${east}`;
  const body = OSM_QUERIES.map((q) => `${q.ql}(${bbox});`).join("\n  ");
  return `[out:json][timeout:90];\n(\n  ${body}\n);\nout body;`;
}

async function fetchOverpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Overpass HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function classifyElement(tags = {}) {
  if (tags.amenity === "drinking_water" || tags.amenity === "water_point" || tags.natural === "spring") {
    return "water";
  }
  if (
    tags.tourism === "alpine_hut" ||
    tags.tourism === "wilderness_hut" ||
    tags.tourism === "cabin" ||
    tags.amenity === "shelter"
  ) {
    return "shelter";
  }
  if (tags.tourism === "viewpoint") return "viewpoint";
  return null;
}

function labelFor(type, tags = {}) {
  const name = String(tags.name || tags["name:it"] || "").trim();
  return name || TYPE_LABEL[type] || type;
}

/**
 * Scarica POI OSM lungo il trail e li salva in `waypoints` (source=osm).
 * I waypoint dal GPX (source=gpx) non vengono toccati.
 */
export async function processTrailPois(trailId, options = {}) {
  const force = Boolean(options.force);
  const trailRes = await pool.query(
    `SELECT
        id,
        ST_Length(geom::geography) AS length_m,
        ST_AsGeoJSON(geom) AS geom_geojson
     FROM trails
     WHERE id = $1 AND geom IS NOT NULL
     LIMIT 1`,
    [trailId]
  );
  const trail = trailRes.rows[0];
  if (!trail) throw new Error("Trail non trovato");

  if (!force) {
    const existing = await pool.query(
      `SELECT 1 FROM waypoints WHERE trail_id = $1 AND source = 'osm' LIMIT 1`,
      [trailId]
    );
    if (existing.rowCount > 0) return { skipped: true, reason: "already_synced" };
  }

  const coords = JSON.parse(trail.geom_geojson)?.coordinates || [];
  if (coords.length < 2) throw new Error("Geometria trail non valida");

  const lengthM = Number(trail.length_m) || 0;
  const chunks = chunkLineByDistance(coords, lengthM, CHUNK_KM * 1000);
  const byOsmId = new Map();

  for (let i = 0; i < chunks.length; i += 1) {
    const bbox = bboxOf(chunks[i], 0.002); // ~200 m padding in gradi
    const data = await fetchOverpass(buildOverpassQuery(bbox.south, bbox.west, bbox.north, bbox.east));
    for (const el of data?.elements || []) {
      if (el.type !== "node" || !Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue;
      const type = classifyElement(el.tags);
      if (!type) continue;
      const osmId = `node/${el.id}`;
      if (byOsmId.has(osmId)) continue;
      byOsmId.set(osmId, {
        osmId,
        type,
        label: labelFor(type, el.tags),
        lat: el.lat,
        lon: el.lon,
      });
    }
    if (i < chunks.length - 1) await sleep(1200);
  }

  const candidates = [...byOsmId.values()];
  // Tieni solo quelli entro CORRIDOR_M dalla linea (PostGIS).
  const near = [];
  for (const c of candidates) {
    const nearRes = await pool.query(
      `SELECT
          ST_DWithin(
            t.geom::geography,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
            $4
          ) AS ok,
          ST_Length(t.geom::geography) * ST_LineLocatePoint(
            t.geom::geometry,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)
          ) AS dist_m
       FROM trails t
       WHERE t.id = $1`,
      [trailId, c.lon, c.lat, CORRIDOR_M]
    );
    const row = nearRes.rows[0];
    if (!row?.ok) continue;
    near.push({ ...c, distance_from_start_m: Number(row.dist_m) || null });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM waypoints WHERE trail_id = $1 AND source = 'osm'`, [trailId]);
    for (const p of near) {
      await client.query(
        `INSERT INTO waypoints (trail_id, geom, type, label, distance_from_start_m, source, external_id)
         VALUES (
           $1,
           ST_SetSRID(ST_MakePoint($2, $3), 4326),
           $4,
           $5,
           $6,
           'osm',
           $7
         )`,
        [trailId, p.lon, p.lat, p.type, p.label, p.distance_from_start_m, p.osmId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { inserted: near.length, scanned: candidates.length };
}

function bboxOf(coordsLonLat, padDeg) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coordsLonLat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return {
    west: minLon - padDeg,
    east: maxLon + padDeg,
    south: minLat - padDeg,
    north: maxLat + padDeg,
  };
}

/** Spezza la linea in sotto-segmenti ~maxMeters (per bbox Overpass gestibili). */
function chunkLineByDistance(coords, totalLengthM, maxMeters) {
  if (!Number.isFinite(totalLengthM) || totalLengthM <= maxMeters) return [coords];
  const n = Math.max(2, Math.ceil(totalLengthM / maxMeters));
  const chunkSize = Math.ceil(coords.length / n);
  const out = [];
  for (let i = 0; i < coords.length; i += chunkSize) {
    const slice = coords.slice(i, Math.min(coords.length, i + chunkSize + 1));
    if (slice.length >= 2) out.push(slice);
  }
  return out.length ? out : [coords];
}
