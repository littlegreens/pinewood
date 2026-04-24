import fs from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});
/** Dopo resample + smooth: non sommare micro-salite/discese ≤ soglia (rumore DEM/GPS). */
const ELEVATION_NOISE_THRESHOLD_M = 1;
/** Passo lungo il tracciato (metri tra campioni sul percorso). */
const ELEVATION_RESAMPLE_SPACING_M = 20;
/** Finestra mediana (dispari) sul profilo campionato. */
const ELEVATION_SMOOTH_WINDOW = 3;

export async function parseGpxFile(filePath) {
  const xml = await fs.readFile(filePath, "utf8");
  const data = parser.parse(xml);
  const trk = data?.gpx?.trk;
  const trksegs = toArray(trk?.trkseg);

  const points = [];
  for (const seg of trksegs) {
    for (const p of toArray(seg?.trkpt)) {
      const lat = Number(p.lat);
      const lon = Number(p.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const eleRaw = Number(p.ele);
        const ele = Number.isFinite(eleRaw) ? eleRaw : null;
        points.push({ lat, lon, ele });
      }
    }
  }

  if (points.length < 2) {
    throw new Error("Il GPX non contiene abbastanza punti validi");
  }

  const distanceKm = computeDistanceKm(points);
  const svgPreview = generateSvg(points);
  const start = points[0];
  const end = points[points.length - 1];

  return {
    points,
    distanceKm,
    svgPreview,
    start,
    end,
    elevation: buildElevationStats(points),
  };
}

export function buildGeoJsonLineString(points) {
  return {
    type: "LineString",
    coordinates: points.map((p) => [p.lon, p.lat]),
  };
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function computeDistanceKm(points) {
  let totalM = 0;
  for (let i = 1; i < points.length; i += 1) {
    totalM += haversineMeters(points[i - 1], points[i]);
  }
  return Number((totalM / 1000).toFixed(2));
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lon - a.lon);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function deg2rad(v) {
  return (v * Math.PI) / 180;
}

function generateSvg(points) {
  const sampled = samplePointsByDistance(points, 80);
  const avgLat = sampled.reduce((acc, p) => acc + p.lat, 0) / Math.max(1, sampled.length);
  const latFactor = 111320;
  const lonFactor = 111320 * Math.cos(deg2rad(avgLat));
  const projected = sampled.map((p) => ({ x: p.lon * lonFactor, y: p.lat * latFactor }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = 200;
  const height = 120;
  const pad = 8;
  const spanX = Math.max(0.000001, maxX - minX);
  const spanY = Math.max(0.000001, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const drawWidth = spanX * scale;
  const drawHeight = spanY * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  const pts = projected.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: height - offsetY - (p.y - minY) * scale,
  }));

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const start = pts[0];
  const end = pts[pts.length - 1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#c8ddc8"/><path d="${d}" fill="none" stroke="#2d5a3d" stroke-width="2.5" stroke-linecap="round"/><circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="4" fill="#4a8c5c"/><circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4" fill="#c9a84c"/></svg>`;
}

function samplePoints(points, targetCount) {
  const step = Math.max(1, Math.floor(points.length / targetCount));
  return points.filter((_, i) => i % step === 0).concat(points[points.length - 1]);
}

function samplePointsByDistance(points, targetCount) {
  if (points.length <= targetCount) return points;
  let total = 0;
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
    cumulative.push(total);
  }
  const sampled = [];
  for (let i = 0; i < targetCount; i += 1) {
    const wanted = (i / (targetCount - 1)) * total;
    let idx = cumulative.findIndex((v) => v >= wanted);
    if (idx === -1) idx = points.length - 1;
    sampled.push(points[idx]);
  }
  return sampled;
}

function buildElevationStats(points) {
  const valid = points.filter((p) => Number.isFinite(p.ele) && p.ele !== 0 && p.ele !== -32768);
  const validRatio = points.length ? valid.length / points.length : 0;
  if (validRatio < 0.8) {
    return {
      hasEnoughElevation: false,
      gain: null,
      loss: null,
      min: null,
      max: null,
      profile: null,
    };
  }

  const normalized = interpolateMissingElevation(points);
  const sampled = resampleTrackByDistance(normalized, ELEVATION_RESAMPLE_SPACING_M);
  const smoothed = smoothElevation(sampled, ELEVATION_SMOOTH_WINDOW);
  const elevations = smoothed.map((p) => p.ele);
  const { gain, loss } = computeGainLossSmoothedThreshold(elevations);

  return {
    hasEnoughElevation: true,
    gain: Math.round(gain),
    loss: Math.round(loss),
    min: Math.round(Math.min(...elevations)),
    max: Math.round(Math.max(...elevations)),
    profile: buildElevationProfile(smoothed),
  };
}

function computeGainLossSmoothedThreshold(elevations) {
  if (elevations.length < 2) return { gain: 0, loss: 0 };
  let gain = 0;
  let loss = 0;
  const t = ELEVATION_NOISE_THRESHOLD_M;
  for (let i = 1; i < elevations.length; i += 1) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > t) gain += diff;
    else if (diff < -t) loss -= diff;
  }
  return { gain: Math.max(0, gain), loss: Math.max(0, loss) };
}

function interpolateMissingElevation(points) {
  const output = points.map((p) => ({ ...p }));
  for (let i = 0; i < output.length; i += 1) {
    if (Number.isFinite(output[i].ele)) continue;
    let prev = i - 1;
    let next = i + 1;
    while (prev >= 0 && !Number.isFinite(output[prev].ele)) prev -= 1;
    while (next < output.length && !Number.isFinite(output[next].ele)) next += 1;
    if (prev >= 0 && next < output.length) {
      const ratio = (i - prev) / (next - prev);
      output[i].ele = output[prev].ele + (output[next].ele - output[prev].ele) * ratio;
    } else if (prev >= 0) {
      output[i].ele = output[prev].ele;
    } else if (next < output.length) {
      output[i].ele = output[next].ele;
    } else {
      output[i].ele = 0;
    }
  }
  return output;
}

function buildElevationProfile(points) {
  const profile = [];
  let distance = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) {
      distance += haversineMeters(points[i - 1], points[i]);
    }
    profile.push({
      distance_m: Math.round(distance),
      elevation_m: Math.round(points[i].ele),
    });
  }
  return sampleProfile(profile, 20);
}

function resampleTrackByDistance(points, spacingM) {
  if (points.length <= 2) return points;
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + haversineMeters(points[i - 1], points[i]);
  }
  const total = cumulative[cumulative.length - 1];
  if (!Number.isFinite(total) || total <= spacingM) return points;

  const sampled = [];
  const steps = Math.max(2, Math.floor(total / spacingM) + 1);
  for (let s = 0; s < steps; s += 1) {
    const target = Math.min(total, s * spacingM);
    let idx = 1;
    while (idx < cumulative.length && cumulative[idx] < target) idx += 1;
    if (idx >= cumulative.length) {
      sampled.push({ ...points[points.length - 1] });
      continue;
    }
    const prevIdx = Math.max(0, idx - 1);
    const span = cumulative[idx] - cumulative[prevIdx];
    const ratio = span > 0 ? (target - cumulative[prevIdx]) / span : 0;
    sampled.push({
      lat: points[prevIdx].lat + (points[idx].lat - points[prevIdx].lat) * ratio,
      lon: points[prevIdx].lon + (points[idx].lon - points[prevIdx].lon) * ratio,
      ele: points[prevIdx].ele + (points[idx].ele - points[prevIdx].ele) * ratio,
    });
  }
  const last = points[points.length - 1];
  const tail = sampled[sampled.length - 1];
  if (!tail || tail.lat !== last.lat || tail.lon !== last.lon) sampled.push({ ...last });
  return sampled;
}

function smoothElevation(points, windowSize) {
  if (points.length <= 2 || windowSize <= 1) return points;
  const half = Math.floor(windowSize / 2);
  return points.map((p, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);
    const values = [];
    for (let j = start; j <= end; j += 1) values.push(points[j].ele);
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    return { ...p, ele: median };
  });
}

function sampleProfile(profile, targetSpacingMeters) {
  if (profile.length <= 1) return profile;
  const sampled = [profile[0]];
  let nextDistance = targetSpacingMeters;
  for (let i = 1; i < profile.length; i += 1) {
    if (profile[i].distance_m >= nextDistance) {
      sampled.push(profile[i]);
      nextDistance += targetSpacingMeters;
    }
  }
  const last = profile[profile.length - 1];
  if (sampled[sampled.length - 1].distance_m !== last.distance_m) {
    sampled.push(last);
  }
  return sampled;
}
