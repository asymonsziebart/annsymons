-- Backyard plant map: run in Neon SQL Editor (optional; tables also created on first use)

CREATE TABLE IF NOT EXISTS backyard_photos (
  id            SERIAL PRIMARY KEY,
  title         TEXT,
  photo_path    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plant_pins (
  id            SERIAL PRIMARY KEY,
  photo_id      INT NOT NULL REFERENCES backyard_photos(id) ON DELETE CASCADE,
  x_pct         DOUBLE PRECISION NOT NULL CHECK (x_pct >= 0 AND x_pct <= 100),
  y_pct         DOUBLE PRECISION NOT NULL CHECK (y_pct >= 0 AND y_pct <= 100),
  plant_name    TEXT NOT NULL,
  common_name   TEXT,
  species       TEXT,
  planted_year  SMALLINT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_pins_photo_id ON plant_pins(photo_id);
