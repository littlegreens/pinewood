CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  google_id varchar(255) UNIQUE,
  name varchar(255) NOT NULL,
  password_hash varchar(255),
  preferred_language varchar(10) NOT NULL DEFAULT 'it',
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO users (id, email, name, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@pinewood.app',
  'Pinewood CAI Import',
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name varchar(255) NOT NULL,
  description text,
  gpx_file_path varchar(500),
  geom geometry(LineString, 4326) NOT NULL,
  start_point geometry(Point, 4326) NOT NULL,
  end_point geometry(Point, 4326) NOT NULL,
  distance_km float NOT NULL,
  elevation_gain_m int,
  elevation_loss_m int,
  max_elevation_m int,
  min_elevation_m int,
  elevation_profile jsonb,
  estimated_time_minutes int,
  difficulty varchar(10),
  svg_preview text NOT NULL,
  cover_image_url varchar(500),
  start_location_text text,
  start_location_lat float,
  start_location_lon float,
  is_public boolean NOT NULL DEFAULT true,
  source varchar(20) NOT NULL DEFAULT 'user',
  osm_id bigint,
  osm_ref varchar(100),
  osm_network varchar(100),
  times_hiked int NOT NULL DEFAULT 0,
  parse_status varchar(50) NOT NULL DEFAULT 'processing',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trail_parkings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  label varchar(255) NOT NULL,
  lat float,
  lon float,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  geom geometry(Point, 4326),
  elevation_m float,
  distance_from_start_m float,
  type varchar(50),
  label varchar(255)
);

CREATE TABLE IF NOT EXISTS hike_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES trails(id),
  user_id uuid NOT NULL REFERENCES users(id),
  started_at timestamp NOT NULL DEFAULT now(),
  finished_at timestamp,
  actual_geom geometry(LineString, 4326),
  completion_pct float NOT NULL DEFAULT 0,
  deviations_count int NOT NULL DEFAULT 0,
  weather_snapshot jsonb,
  synced boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_trails (
  user_id uuid NOT NULL REFERENCES users(id),
  trail_id uuid NOT NULL REFERENCES trails(id),
  saved_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trail_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(500) NOT NULL,
  expires_at timestamp NOT NULL,
  revoked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_trails_geom ON trails USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_trails_start_point ON trails USING GIST (start_point);
CREATE INDEX IF NOT EXISTS idx_trails_user_id ON trails (user_id);
CREATE INDEX IF NOT EXISTS idx_trails_is_public ON trails (is_public);
CREATE INDEX IF NOT EXISTS idx_trails_source ON trails (source);
CREATE INDEX IF NOT EXISTS idx_trails_parse_status ON trails (parse_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trails_osm_id_unique
  ON trails (osm_id)
  WHERE osm_id IS NOT NULL;

ALTER TABLE trails ALTER COLUMN is_public SET DEFAULT true;
