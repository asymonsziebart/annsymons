-- Run in Neon SQL Editor (same project as the rest of the site).
CREATE TABLE IF NOT EXISTS state_photos (
  id SERIAL PRIMARY KEY,
  state_code CHAR(2) NOT NULL,
  public_url TEXT NOT NULL,
  original_name TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  focus_x DOUBLE PRECISION,
  focus_y DOUBLE PRECISION,
  frame_zoom DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_state_photos_state_code ON state_photos (state_code);
