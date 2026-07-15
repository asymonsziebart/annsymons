-- Manuals library for appliances, tools, and household gear.
-- Also created automatically by lib/data/manuals.ts on first use.

CREATE TABLE IF NOT EXISTS manuals (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT,
  location TEXT,
  support_url TEXT,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
