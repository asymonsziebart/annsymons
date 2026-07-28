-- Run in Neon SQL Editor (optional if the app auto-creates tables on first use).
-- Instagram account connection + scheduled posts for /admin/instagram.

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ig_user_id      TEXT NOT NULL,
  username        TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instagram_posts (
  id              SERIAL PRIMARY KEY,
  image_url       TEXT NOT NULL,
  caption         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  ig_media_id     TEXT,
  ig_container_id TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS instagram_posts_status_scheduled_idx
  ON instagram_posts (status, scheduled_at);
