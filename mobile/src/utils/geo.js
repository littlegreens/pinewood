/** Coordinate GeoJSON [lon, lat, ele?] da LineString o MultiLineString. */
export function flattenGeoJsonCoordinates(geom) {
  if (!geom?.coordinates) return [];
  const { coordinates, type } = geom;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return [];
  if (type === "MultiLineString" || (Array.isArray(coordinates[0]?.[0]) && typeof coordinates[0][0][0] === "number")) {
    return coordinates.flat();
  }
  return coordinates;
}

export function geoJsonToTrailPoints(geom) {
  return flattenGeoJsonCoordinates(geom)
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map(([lon, lat, ele]) => ({
      latitude: Number(lat),
      longitude: Number(lon),
      elevation: Number.isFinite(Number(ele)) ? Number(ele) : 0,
    }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}

export function distanceMeters(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function minDistanceToTrail(point, trailLine) {
  if (!trailLine.length) return Infinity;
  if (trailLine.length === 1) return distanceMeters(point, trailLine[0]);
  let minD = Infinity;
  for (let i = 0; i < trailLine.length - 1; i++) {
    const d = pointToSegmentDistance(point, trailLine[i], trailLine[i + 1]);
    if (d < minD) minD = d;
  }
  return minD;
}

function toLocalXY(point, originLat) {
  const latF = 111320;
  const lonF = 111320 * Math.cos((originLat * Math.PI) / 180);
  return { x: point[1] * lonF, y: point[0] * latF };
}

function pointToSegmentDistance(point, segA, segB) {
  const originLat = (segA[0] + segB[0]) / 2;
  const p = toLocalXY(point, originLat);
  const a = toLocalXY(segA, originLat);
  const b = toLocalXY(segB, originLat);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export async function geocode(text) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "it", "User-Agent": "Pinewood/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
      name: data[0].display_name.split(",")[0],
    };
  } catch {
    return null;
  }
}

export function bearingDeg(a, b) {
  const phi1 = (a[0] * Math.PI) / 180;
  const phi2 = (b[0] * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function formatMinutesToHours(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function formatKm(value) {
  if (value == null) return "N/D";
  return `${Number(value).toFixed(1).replace(".", ",")} km`;
}

export function formatMeters(value) {
  if (value == null || !Number.isFinite(Number(value))) return "N/D";
  return `${Number(value).toLocaleString("it-IT")} m`;
}
