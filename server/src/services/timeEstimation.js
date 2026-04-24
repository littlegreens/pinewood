export function estimateTimeMinutes(distanceKm, elevationGainM) {
  const dist = Number.isFinite(distanceKm) ? distanceKm : 0;
  const up = Number.isFinite(elevationGainM) ? elevationGainM : 0;
  // Standard CAI-like: 4 km/h su piano e 300 m/h in salita.
  // Combina i due contributi dando più peso al vincolo dominante.
  const flatMinutes = (dist / 4) * 60;
  const climbMinutes = (up / 300) * 60;
  const totalMinutes = Math.max(flatMinutes, climbMinutes) + Math.min(flatMinutes, climbMinutes) / 2;
  return Math.max(1, Math.round(totalMinutes));
}
