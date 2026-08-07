-- Account requests + approved logins with per-page access.
-- Run in Neon SQL Editor (or any Postgres client) once.

CREATE TABLE IF NOT EXISTS site_users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  allowed_pages TEXT NOT NULL DEFAULT '[]',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_users_email_lower_uidx
  ON site_users (lower(email));

CREATE INDEX IF NOT EXISTS site_users_status_created_idx
  ON site_users (status, created_at DESC);
