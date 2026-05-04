-- Full tasks schema (sections + tasks + subtasks). For empty Neon DBs only.

CREATE TABLE IF NOT EXISTS task_sections (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  color_key   TEXT NOT NULL DEFAULT 'default',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

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
  recurrence_interval     TEXT,
  recurrence_month        SMALLINT CHECK (
    recurrence_month IS NULL OR (recurrence_month >= 1 AND recurrence_month <= 12)
  ),
  CONSTRAINT tasks_recurrence_interval_check CHECK (
    recurrence_interval IS NULL
    OR recurrence_interval IN ('daily', 'weekly', 'monthly', 'yearly')
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
