export const ELEV_PROFILE_MIN_VERTICAL_SPAN_M = 90;

export function buildElevationProfilePath(profile, width, height, pad) {
  if (!Array.isArray(profile) || profile.length < 2) return null;

  const minD = profile[0].distance_m;
  const maxD = profile[profile.length - 1].distance_m || minD + 1;
  const elevs = profile.map((p) => Number(p.elevation_m)).filter(Number.isFinite);
  if (elevs.length < 2) return null;

  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const spanD = Math.max(1, maxD - minD);
  const rawSpanE = maxE - minE;
  const padE = Math.max(0, (ELEV_PROFILE_MIN_VERTICAL_SPAN_M - rawSpanE) / 2);
  const plotMinE = minE - padE;
  const plotMaxE = maxE + padE;
  const spanE = Math.max(1, plotMaxE - plotMinE);

  const points = profile.map((p) => {
    const x = pad + ((p.distance_m - minD) / spanD) * (width - pad * 2);
    const y = height - pad - ((p.elevation_m - plotMinE) / spanE) * (height - pad * 2);
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return {
    d,
    minE: Math.round(minE),
    maxE: Math.round(maxE),
    minD,
    maxD,
    spanD,
    pad,
    width,
  };
}

export function normalizeElevationProfile(raw, trailPoints = []) {
  if (Array.isArray(raw) && raw.length > 1) {
    const first = raw[0];
    if (first && typeof first === "object" && Number.isFinite(Number(first.elevation_m))) {
      return raw
        .map((p) => ({
          distance_m: Number(p.distance_m),
          elevation_m: Number(p.elevation_m),
        }))
        .filter((p) => Number.isFinite(p.distance_m) && Number.isFinite(p.elevation_m));
    }
    if (typeof first === "number" || (first != null && !Number.isNaN(Number(first)))) {
      return raw
        .map((e, i) => ({ distance_m: i * 20, elevation_m: Number(e) }))
        .filter((p) => Number.isFinite(p.elevation_m));
    }
  }

  if (trailPoints.length > 1) {
    let dist = 0;
    const out = [{ distance_m: 0, elevation_m: Number(trailPoints[0].elevation) || 0 }];
    for (let i = 1; i < trailPoints.length; i++) {
      const a = trailPoints[i - 1];
      const b = trailPoints[i];
      const seg =
        Math.sqrt(
          (b.latitude - a.latitude) ** 2 + (b.longitude - a.longitude) ** 2,
        ) * 111320;
      dist += Number.isFinite(seg) ? seg : 0;
      out.push({ distance_m: dist, elevation_m: Number(b.elevation) || 0 });
    }
    return out.length > 1 ? out : [];
  }

  return [];
}
