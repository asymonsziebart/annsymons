-- Run this in the Neon SQL Editor (Dashboard → SQL Editor).
-- Creates tables for your site. You can keep using lib/posts.ts, lib/recipes.ts, etc.
-- and add API routes or server actions later that read/write these tables.

-- Blog posts (optional – for dynamic blog)
CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  excerpt    TEXT,
  body       TEXT NOT NULL,
  image      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes (optional – for dynamic recipes)
CREATE TABLE IF NOT EXISTS recipes (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  prep_time   TEXT,
  cook_time   TEXT,
  servings    TEXT,
  ingredients TEXT[],
  steps       TEXT[],
  image       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery items (optional – for dynamic gallery)
CREATE TABLE IF NOT EXISTS gallery_items (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  src         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'file')),
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: index for lookups by slug
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_recipes_slug ON recipes(slug);
