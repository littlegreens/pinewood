import { pool } from "../src/db/pool.js";

const trailId = process.argv[2];
if (!trailId) {
  console.error("Usage: node scripts/debug-trail-elevation-sample.mjs <trail-uuid>");
  process.exit(1);
}

const r = await pool.query(
  `SELECT name, ST_AsGeoJSON(geom) AS g FROM trails WHERE id = $1`,
  [trailId]
);
const row = r.rows[0];
if (!row) {
  console.error("Trail not found");
  process.exit(1);
}
const coords = JSON.parse(row.g).coordinates;
const step = Math.max(1, Math.floor(coords.length / 25));
const idx = [];
for (let i = 0; i < coords.length; i += step) idx.push(i);
if (idx[idx.length - 1] !== coords.length - 1) idx.push(coords.length - 1);
const locs = idx.map((i) => `${coords[i][1]},${coords[i][0]}`).join("|");

const dataset = process.env.OPENTOPO_DATASET || "eudem25m,srtm30m";
const res = await fetch(`https://api.opentopodata.org/v1/${dataset}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ locations: locs }),
});
const j = await res.json();
const vals = (j.results || []).map((x) => x.elevation).filter(Number.isFinite);
console.log(row.name);
console.log("points", coords.length, "samples", vals.length, "api", j.status, j.error || "");
if (vals.length) {
  console.log("min", Math.min(...vals), "max", Math.max(...vals), "span_m", Math.max(...vals) - Math.min(...vals));
}
await pool.end();
