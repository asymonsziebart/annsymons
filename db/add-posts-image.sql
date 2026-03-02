-- Run in Neon SQL Editor if posts table already exists without image column.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image TEXT;
