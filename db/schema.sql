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

-- Task management (/tasks) — Asana-style sections + subtasks
CREATE TABLE IF NOT EXISTS task_sections (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  color_key   TEXT NOT NULL DEFAULT 'default',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id                      SERIAL PRIMARY KEY,
  title                   TEXT NOT NULL,
  description             TEXT,
  due_date                DATE,
  status                  TEXT NOT NULL DEFAULT 'todo',
  sort_order              INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  last_overdue_email_at   TIMESTAMPTZ,
  section_id              INT NOT NULL REFERENCES task_sections(id),
  assignee                TEXT,
  priority                TEXT NOT NULL DEFAULT 'none',
  estimated_minutes       INT,
  actual_minutes          INT,
  dependencies            TEXT,
  requester               TEXT,
  quarter                 TEXT,
  project_label           TEXT,
  recurrence_month        SMALLINT CHECK (
    recurrence_month IS NULL OR (recurrence_month >= 1 AND recurrence_month <= 12)
  ),
  CONSTRAINT tasks_status_check CHECK (
    status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')
  ),
  CONSTRAINT tasks_priority_check CHECK (
    priority IN ('none', 'high', 'medium', 'low')
  )
);

CREATE TABLE IF NOT EXISTS task_subtasks (
  id          SERIAL PRIMARY KEY,
  task_id     INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);

INSERT INTO task_sections (name, color_key, sort_order)
SELECT v.name, v.color_key, v.sort_order
FROM (
  VALUES
    ('Recently assigned', 'default', 0),
    ('High Priority', 'red', 1),
    ('Medium Priority', 'yellow', 2),
    ('Low Priority', 'green', 3)
) AS v(name, color_key, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM task_sections LIMIT 1);

-- Optional: index for lookups by slug
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_recipes_slug ON recipes(slug);
