import { pool } from "../db/pool.js";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** Raggio (m) dal tracciato: POI "di atmosfera" intorno alla mappa. */
const CORRIDOR_M = 300;
/** Padding bbox Overpass (~gradi) coerente col corridor. */
const BBOX_PAD_DEG = 0.004;
/** Stesso tipo entro questo raggio → ne teniamo uno. */
const SAME_TYPE_DEDUPE_M = 50;
/** Trail lunghi: pezzi da N km per non far scoppiare Overpass. */
const CHUNK_KM = 40;
const USER_AGENT = "PinewoodTrailApp/1.0 (poi-sync; https://pinewood.to)";
let overpassUrlIndex = 0;

/**
 * Tag OSM → tipi Pinewood.
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
  { type: "historic", ql: 'node["historic"="archaeological_site"]' },
  { type: "historic", ql: 'node["historic"="ruins"]' },
  { type: "historic", ql: 'node["historic"="castle"]' },
];

const TYPE_LABEL = {
  water: "Acqua",
  shelter: "Rifugio",
  viewpoint: "Belvedere",
  historic: "Storico",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function approxDistanceMeters(lat1, lon1, lat2, lon2) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lon2 - lon1) * 111_320 * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

function labelScore(label, type) {
  const s = String(label || "").trim();
  if (!s) return 0;
  const fallback = TYPE_LABEL[type] || type;
  if (s.toLowerCase() === String(fallback).toLowerCase()) return 1;
  return 2 + Math.min(24, s.length);
}

/** Un solo POI per tipo entro SAME_TYPE_DEDUPE_M (preferisce nome OSM). */
function dedupeSameTypeNearby(points) {
  const list = [...points].sort((a, b) => {
    const da = Number(a.distance_from_start_m);
    const db = Number(b.distance_from_start_m);
    if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
    return String(a.label || "").localeCompare(String(b.label || ""));
  });
  const kept = [];
  for (const p of list) {
    const clashIdx = kept.findIndex(
      (k) => k.type === p.type && approxDistanceMeters(k.lat, k.lon, p.lat, p.lon) < SAME_TYPE_DEDUPE_M
    );
    if (clashIdx < 0) {
      kept.push(p);
      continue;
    }
    const prev = kept[clashIdx];
    if (labelScore(p.label, p.type) > labelScore(prev.label, prev.type)) {
      kept[clashIdx] = p;
    }
  }
  return kept;
}

function buildOverpassQuery(south, west, north, east) {
  const bbox = `${south},${west},${north},${east}`;
  const body = OSM_QUERIES.map((q) => `${q.ql}(${bbox});`).join("\n  ");
  return `[out:json][timeout:90];\n(\n  ${body}\n);\nout body;`;
}

async function fetchOverpass(query) {
  let lastErr = null;
  for (let attempt = 0; attempt < OVERPASS_URLS.length * 2; attempt += 1) {
    const url = OVERPASS_URLS[overpassUrlIndex % OVERPASS_URLS.length];
    overpassUrlIndex += 1;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(95_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastErr = new Error(`Overpass HTTP ${res.status}: ${text.slice(0, 160)}`);
        if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
          await sleep(2500 + attempt * 1500);
          continue;
        }
        throw lastErr;
      }
      return res.json();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      await sleep(2000 + attempt * 1000);
    }
  }
  throw lastErr || new Error("Overpass non raggiungibile");
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
  if (
    tags.historic === "archaeological_site" ||
    tags.historic === "ruins" ||
    tags.historic === "castle"
  ) {
    return "historic";
  }
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
    const bbox = bboxOf(chunks[i], BBOX_PAD_DEG);
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
  const near = await filterCandidatesNearTrail(trailId, candidates);
  const deduped = dedupeSameTypeNearby(near);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM waypoints WHERE trail_id = $1 AND source = 'osm'`, [trailId]);
    for (const p of deduped) {
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

  return {
    inserted: deduped.length,
    scanned: candidates.length,
    near: near.length,
    corridor_m: CORRIDOR_M,
  };
}

/** Filtra candidati OSM entro CORRIDOR_M con query batch (evita N round-trip). */
async function filterCandidatesNearTrail(trailId, candidates) {
  if (!candidates.length) return [];
  const near = [];
  const BATCH = 200;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const idxs = batch.map((_, j) => j);
    const lons = batch.map((c) => c.lon);
    const lats = batch.map((c) => c.lat);
    const res = await pool.query(
      `WITH pts AS (
         SELECT * FROM unnest($2::int[], $3::float8[], $4::float8[]) AS t(idx, lon, lat)
       )
       SELECT
         pts.idx,
         ST_Length(tr.geom::geography) * ST_LineLocatePoint(
           tr.geom::geometry,
           ST_SetSRID(ST_MakePoint(pts.lon, pts.lat), 4326)
         ) AS dist_m
       FROM pts
       CROSS JOIN trails tr
       WHERE tr.id = $1
         AND ST_DWithin(
           tr.geom::geography,
           ST_SetSRID(ST_MakePoint(pts.lon, pts.lat), 4326)::geography,
           $5
         )`,
      [trailId, idxs, lons, lats, CORRIDOR_M]
    );
    for (const row of res.rows) {
      const c = batch[Number(row.idx)];
      if (!c) continue;
      near.push({ ...c, distance_from_start_m: Number(row.dist_m) || null });
    }
  }
  return near;
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
