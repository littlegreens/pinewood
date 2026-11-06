-- Provenienza waypoint: gpx (dal file) oppure osm (Overpass, una tantum).
ALTER TABLE waypoints
  ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'gpx';

ALTER TABLE waypoints
  ADD COLUMN IF NOT EXISTS external_id varchar(64);

CREATE INDEX IF NOT EXISTS idx_waypoints_trail_source ON waypoints (trail_id, source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waypoints_trail_external
  ON waypoints (trail_id, external_id)
  WHERE external_id IS NOT NULL;
