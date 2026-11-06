import * as FileSystem from "expo-file-system/legacy";

const TILES_DIR = `${FileSystem.documentDirectory}tiles/`;
const TILE_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SUBS = ["a", "b", "c"];
const TRAIL_CACHE_DIR = `${FileSystem.documentDirectory}trails/`;
/** User-Agent richiesto dalla tile usage policy OSM (cache offline personale). */
const OSM_UA = "Pinewood/1.0 (https://pinewood.to; outdoor navigation; offline personal cache)";

/** Buffer laterale intorno alla traccia (m). ~1.5 km → usabile in campo senza rete. */
const CORRIDOR_BUFFER_M = 1500;
const ZOOMS = [13, 14, 15, 16];
const MAX_TILES = 800;

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function lat2tile(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      2 ** zoom
  );
}

function metersPerTile(lat, zoom) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function tileUrl(z, x, y) {
  const sub = SUBS[Math.abs(x + y) % SUBS.length];
  return TILE_TEMPLATE.replace("{s}", sub)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

function tilePath(z, x, y) {
  return `${TILES_DIR}${z}/${x}/${y}.png`;
}

async function ensureDir(dir) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** URI base per Leaflet in WebView (sempre con slash finale). */
export function getTilesBaseUri() {
  return TILES_DIR;
}

/**
 * Raccoglie i tasselli OSM lungo la traccia con corridor in metri.
 * line: array di [lat, lon]
 */
export function collectTilesForLine(line, { bufferM = CORRIDOR_BUFFER_M, maxTiles = MAX_TILES } = {}) {
  if (!Array.isArray(line) || line.length === 0) return [];

  const tileSet = new Set();
  const tiles = [];
  const stride = Math.max(1, Math.floor(line.length / 120));

  const pushTile = (z, x, y) => {
    if (x < 0 || y < 0) return;
    const key = `${z}/${x}/${y}`;
    if (tileSet.has(key)) return;
    tileSet.add(key);
    tiles.push({ z, x, y });
  };

  for (let i = 0; i < line.length; i += stride) {
    const [lat, lon] = line[i];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    for (const z of ZOOMS) {
      const cx = lon2tile(lon, z);
      const cy = lat2tile(lat, z);
      const mpt = metersPerTile(lat, z);
      const radius = Math.max(1, Math.min(4, Math.ceil(bufferM / mpt)));
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          pushTile(z, cx + dx, cy + dy);
          if (tileSet.size >= maxTiles) return tiles;
        }
      }
    }
  }
  return tiles;
}

export async function downloadTilesForTrail(line, { onProgress } = {}) {
  if (!Array.isArray(line) || line.length === 0) return { ok: false, count: 0 };

  await ensureDir(TILES_DIR);
  const tiles = collectTilesForLine(line);

  let downloaded = 0;
  let skipped = 0;

  for (const { z, x, y } of tiles) {
    const path = tilePath(z, x, y);
    const dir = `${TILES_DIR}${z}/${x}/`;
    try {
      const exists = await FileSystem.getInfoAsync(path);
      if (exists.exists && (exists.size == null || exists.size > 0)) {
        skipped++;
        onProgress?.({ downloaded, skipped, total: tiles.length });
        continue;
      }
      await ensureDir(dir);
      const url = tileUrl(z, x, y);
      const result = await FileSystem.downloadAsync(url, path, {
        headers: { "User-Agent": OSM_UA },
      });
      if (result.status >= 200 && result.status < 300) {
        downloaded++;
      }
      onProgress?.({ downloaded, skipped, total: tiles.length });
    } catch {
      // skip failed tiles
    }
  }

  return {
    ok: downloaded + skipped > 0,
    count: downloaded,
    skipped,
    total: tiles.length,
  };
}

export async function saveTrailOffline(trailId, trailData) {
  await ensureDir(TRAIL_CACHE_DIR);
  const path = `${TRAIL_CACHE_DIR}${trailId}.json`;
  const payload = {
    trailId: String(trailId),
    savedAt: Date.now(),
    name: trailData.name || "",
    geom_geojson: trailData.geom_geojson || null,
    elevation_profile: trailData.elevation_profile || [],
    waypoints: trailData.waypoints || [],
  };
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload));
}

export async function loadTrailOffline(trailId) {
  const path = `${TRAIL_CACHE_DIR}${trailId}.json`;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getOfflineStorageSize() {
  try {
    const tilesInfo = await FileSystem.getInfoAsync(TILES_DIR, { size: true });
    const trailsInfo = await FileSystem.getInfoAsync(TRAIL_CACHE_DIR, { size: true });
    return {
      tilesMb: ((tilesInfo.size || 0) / (1024 * 1024)).toFixed(1),
      trailsMb: ((trailsInfo.size || 0) / (1024 * 1024)).toFixed(1),
    };
  } catch {
    return { tilesMb: "0", trailsMb: "0" };
  }
}

export async function clearOfflineData() {
  try {
    await FileSystem.deleteAsync(TILES_DIR, { idempotent: true });
    await FileSystem.deleteAsync(TRAIL_CACHE_DIR, { idempotent: true });
  } catch {
    // best effort
  }
}
