import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const trailId = "fa092298-5ab5-42a1-9874-9988de2eafe4"; // Anello monte Catillo

await pool.query("DELETE FROM waypoints WHERE trail_id = $1", [trailId]);

const types = [
  { t: "water", label: "Fonte", f: 0.18 },
  { t: "shelter", label: "Bivacco", f: 0.45 },
  { t: "viewpoint", label: "Belvedere", f: 0.72 },
  { t: "water", label: "Acqua", f: 0.88 },
];

for (const x of types) {
  await pool.query(
    `INSERT INTO waypoints (trail_id, geom, type, label, distance_from_start_m)
     SELECT
       id,
       ST_LineInterpolatePoint(geom::geometry, $2),
       $3,
       $4,
       ST_Length(geom::geography) * $2
     FROM trails WHERE id = $1`,
    [trailId, x.f, x.t, x.label],
  );
}

const c = await pool.query("SELECT type, label FROM waypoints WHERE trail_id = $1", [trailId]);
console.log(c.rows);
await pool.end();
