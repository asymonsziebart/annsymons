-- Account requests + approved logins with per-page access.
-- Run in Neon SQL Editor (or any Postgres client) once.

CREATE TABLE IF NOT EXISTS site_users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  allowed_pages TEXT NOT NULL DEFAULT '[]',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing installs that predate the role column.
ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_users_role_check'
  ) THEN
    ALTER TABLE site_users
      ADD CONSTRAINT site_users_role_check
      CHECK (role IN ('owner', 'member'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS site_users_email_lower_uidx
  ON site_users (lower(email));

CREATE INDEX IF NOT EXISTS site_users_status_created_idx
  ON site_users (status, created_at DESC);
