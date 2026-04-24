import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { estimateTimeMinutes } from "./timeEstimation.js";

const OPENTOPO_ENDPOINT = `https://api.opentopodata.org/v1/${env.opentopoDataset}`;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1100;
const ELEVATION_NOISE_THRESHOLD_M = 1;
const ELEVATION_RESAMPLE_SPACING_M = 20;
const ELEVATION_SMOOTH_WINDOW = 3;

export async function processTrailElevation(trailId, options = {}) {
  const force = Boolean(options.force);
  const trailRes = await pool.query(
    `SELECT id, parse_status, ST_AsGeoJSON(geom) AS geom_geojson
     FROM trails
     WHERE id = $1
     LIMIT 1`,
    [trailId]
  );
  const trail = trailRes.rows[0];
  if (!trail) {
    throw new Error("Trail non trovato");
  }
  if (trail.parse_status === "ready" && !force) {
    return;
  }

  const coordinates = JSON.parse(trail.geom_geojson).coordinates || [];
  if (coordinates.length < 2) {
    throw new Error("Geometria trail non valida");
  }

  const points = coordinates.map(([lon, lat]) => ({ lat, lon }));
  const elevations = await fetchElevations(points);
  const filled = interpolateNullElevations(elevations);
  const stats = computeElevationStats(points, filled);

  await pool.query(
    `UPDATE trails
     SET elevation_gain_m = $2,
         elevation_loss_m = $3,
         max_elevation_m = $4,
         min_elevation_m = $5,
         elevation_profile = $6,
         estimated_time_minutes = $7,
         parse_status = 'ready'
     WHERE id = $1`,
    [
      trailId,
      stats.gain,
      stats.loss,
      stats.max,
      stats.min,
      JSON.stringify(stats.profile),
      estimateTimeMinutes(stats.distanceKm, stats.gain),
    ]
  );
}

export async function markTrailElevationFallback(trailId) {
  const check = await pool.query(
    `SELECT elevation_gain_m, elevation_loss_m, max_elevation_m, min_elevation_m
     FROM trails
     WHERE id = $1
     LIMIT 1`,
    [trailId]
  );
  const row = check.rows[0];
  if (!row) return;
  const hasFallback =
    row.elevation_gain_m != null ||
    row.elevation_loss_m != null ||
    row.max_elevation_m != null ||
    row.min_elevation_m != null;
  await pool.query(
    `UPDATE trails
     SET parse_status = $2
     WHERE id = $1`,
    [trailId, hasFallback ? "ready" : "ready_no_elevation"]
  );
}

async function fetchElevations(points) {
  const output = [];
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const locations = batch.map((p) => `${p.lat},${p.lon}`).join("|");
    const response = await fetch(OPENTOPO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    if (!response.ok) {
      throw new Error(`OpenTopoData failed: ${response.status}`);
    }
    const data = await response.json();
    const values = (data.results || []).map((r) =>
      Number.isFinite(r?.elevation) ? Number(r.elevation) : null
    );
    output.push(...values);
    if (i + BATCH_SIZE < points.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return output;
}

function interpolateNullElevations(values) {
  const out = [...values];
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i])) continue;
    let prev = i - 1;
    let next = i + 1;
    while (prev >= 0 && !Number.isFinite(out[prev])) prev -= 1;
    while (next < out.length && !Number.isFinite(out[next])) next += 1;
    if (prev >= 0 && next < out.length) {
      const ratio = (i - prev) / (next - prev);
      out[i] = out[prev] + (out[next] - out[prev]) * ratio;
    } else if (prev >= 0) {
      out[i] = out[prev];
    } else if (next < out.length) {
      out[i] = out[next];
    } else {
      out[i] = 0;
    }
  }
  return out;
}

function computeElevationStats(points, elevations) {
  const merged = points.map((p, i) => ({ lat: p.lat, lon: p.lon, ele: elevations[i] }));
  const sampled = resampleTrackByDistance(merged, ELEVATION_RESAMPLE_SPACING_M);
  const smoothed = smoothElevation(sampled, ELEVATION_SMOOTH_WINDOW);
  const smoothElevations = smoothed.map((p) => p.ele);
  const profile = [];
  let dist = 0;
  for (let i = 0; i < smoothed.length; i += 1) {
    if (i > 0) {
      dist += haversineMeters(smoothed[i - 1], smoothed[i]);
    }
    profile.push({
      distance_m: Math.round(dist),
      elevation_m: Math.round(smoothed[i].ele),
    });
  }
  const { gain, loss } = computeGainLossSmoothedThreshold(smoothElevations);

  return {
    distanceKm: Math.round((dist / 1000) * 100) / 100,
    gain: Math.round(gain),
    loss: Math.round(loss),
    min: Math.round(Math.min(...smoothElevations)),
    max: Math.round(Math.max(...smoothElevations)),
    profile: sampleProfile(profile, 20),
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

function sampleProfile(profile, spacing) {
  if (profile.length <= 1) return profile;
  const sampled = [profile[0]];
  let next = spacing;
  for (let i = 1; i < profile.length; i += 1) {
    if (profile[i].distance_m >= next) {
      sampled.push(profile[i]);
      next += spacing;
    }
  }
  const last = profile[profile.length - 1];
  if (sampled[sampled.length - 1].distance_m !== last.distance_m) {
    sampled.push(last);
  }
  return sampled;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
