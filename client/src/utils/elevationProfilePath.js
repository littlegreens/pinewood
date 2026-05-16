/** Deve coincidere tra scheda percorso e navigazione (play). */
export const ELEV_PROFILE_MIN_VERTICAL_SPAN_M = 90;

/**
 * Path SVG del profilo altimetrico: stessa scala verticale “min span” ovunque.
 * minE/maxE nel risultato restano i valori reali del tracciato (etichette).
 */
export function buildElevationProfilePath(profile, width, height, pad) {
  const minD = profile[0].distance_m;
  const maxD = profile[profile.length - 1].distance_m || minD + 1;
  const elevs = profile.map((p) => p.elevation_m);
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
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
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
