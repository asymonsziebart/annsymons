-- Family tree imported from Quick Family Tree (.ftz) exports.
-- Also created automatically by lib/data/familyTree.ts on first use.

CREATE TABLE IF NOT EXISTS family_trees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Family Tree',
  source_filename TEXT,
  default_focus_id TEXT,
  people JSONB NOT NULL DEFAULT '[]'::jsonb,
  families JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
