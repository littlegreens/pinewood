/**
 * DISMESSO — non inventare più POI finti sulle trail.
 *
 * I waypoint devono arrivare solo da:
 * - GPX (tag <wpt> con tipo riconoscibile: acqua / rifugio / belvedere)
 * - inserimento manuale reale in futuro
 *
 * Per ripulire i demo già sparati: node scripts/purge-demo-pois.mjs
 */
console.error(
  "Rifiutato: seed-demo-pois inventava POI finti (es. bivacco in città). Non usarlo."
);
console.error("Per cancellare i demo: node scripts/purge-demo-pois.mjs");
process.exit(1);
