import * as FileSystem from "expo-file-system/legacy";

const TILES_DIR = `${FileSystem.documentDirectory}tiles/`;
const TILE_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SUBS = ["a", "b", "c"];
const TRAIL_CACHE_DIR = `${FileSystem.documentDirectory}trails/`;

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

export async function downloadTilesForTrail(line, { onProgress } = {}) {
  if (!Array.isArray(line) || line.length === 0) return { ok: false, count: 0 };

  await ensureDir(TILES_DIR);

  const zooms = [13, 14, 15, 16];
  const maxTiles = 300;
  const tileSet = new Set();
  const tiles = [];

  const stride = Math.max(1, Math.floor(line.length / 80));
  for (let i = 0; i < line.length; i += stride) {
    const [lat, lon] = line[i];
    for (const z of zooms) {
      const cx = lon2tile(lon, z);
      const cy = lat2tile(lat, z);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${z}/${cx + dx}/${cy + dy}`;
          if (!tileSet.has(key)) {
            tileSet.add(key);
            tiles.push({ z, x: cx + dx, y: cy + dy });
          }
          if (tileSet.size >= maxTiles) break;
        }
        if (tileSet.size >= maxTiles) break;
      }
      if (tileSet.size >= maxTiles) break;
    }
    if (tileSet.size >= maxTiles) break;
  }

  let downloaded = 0;
  let skipped = 0;

  for (const { z, x, y } of tiles) {
    const path = tilePath(z, x, y);
    const dir = `${TILES_DIR}${z}/${x}/`;
    try {
      const exists = await FileSystem.getInfoAsync(path);
      if (exists.exists) {
        skipped++;
        continue;
      }
      await ensureDir(dir);
      const url = tileUrl(z, x, y);
      await FileSystem.downloadAsync(url, path);
      downloaded++;
      onProgress?.({ downloaded, skipped, total: tiles.length });
    } catch {
      // skip failed tiles
    }
  }

  return { ok: downloaded + skipped > 0, count: downloaded, skipped, total: tiles.length };
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
