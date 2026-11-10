/** Layout / dedupe POI: stesso tipo vicino ? 1; tipi diversi ? spider. */

export const SAME_TYPE_DEDUPE_M = 50;
export const SPIDER_GROUP_M = 35;
export const SPIDER_RADIUS_M = 18;

export function approxDistanceMeters(lat1, lon1, lat2, lon2) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lon2 - lon1) * 111_320 * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

export function offsetLatLng(lat, lon, metersNorth, metersEast) {
  const dLat = metersNorth / 111_320;
  const dLon = metersEast / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return [lat + dLat, lon + dLon];
}

function labelScore(label, typeFallback) {
  const s = String(label || "").trim();
  if (!s) return 0;
  if (s.toLowerCase() === String(typeFallback || "").toLowerCase()) return 1;
  return 2 + Math.min(24, s.length);
}

/**
 * Tiene un solo POI per tipo entro radiusM (preferisce label nominata).
 */
export function dedupeSameTypeNearby(points, radiusM = SAME_TYPE_DEDUPE_M) {
  const list = Array.isArray(points) ? [...points] : [];
  list.sort((a, b) => {
    const da = Number(a.distance_from_start_m);
    const db = Number(b.distance_from_start_m);
    if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
    return String(a.label || "").localeCompare(String(b.label || ""));
  });
  const kept = [];
  for (const p of list) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !p.type) continue;
    const clashIdx = kept.findIndex(
      (k) => k.type === p.type && approxDistanceMeters(k.lat, k.lon, p.lat, p.lon) < radiusM
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

/**
 * Raggruppa punti entro radiusM (dopo dedupe stesso tipo ? tipicamente tipi diversi).
 */
export function groupNearbyForSpider(points, radiusM = SPIDER_GROUP_M) {
  const list = Array.isArray(points) ? [...points] : [];
  const used = new Array(list.length).fill(false);
  const groups = [];
  for (let i = 0; i < list.length; i += 1) {
    if (used[i]) continue;
    const seed = list[i];
    const members = [seed];
    used[i] = true;
    for (let j = i + 1; j < list.length; j += 1) {
      if (used[j]) continue;
      const other = list[j];
      if (approxDistanceMeters(seed.lat, seed.lon, other.lat, other.lon) < radiusM) {
        members.push(other);
        used[j] = true;
      }
    }
    const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lon = members.reduce((s, m) => s + m.lon, 0) / members.length;
    groups.push({ lat, lon, members });
  }
  return groups;
}

export function spiderOffsets(count, radiusM = SPIDER_RADIUS_M) {
  if (count <= 1) return [{ n: 0, e: 0 }];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
    out.push({ n: Math.cos(ang) * radiusM, e: Math.sin(ang) * radiusM });
  }
  return out;
}
