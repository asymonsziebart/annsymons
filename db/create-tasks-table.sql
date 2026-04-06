-- New installs: tasks with description, due date, and status (no legacy `done` column).

CREATE TABLE IF NOT EXISTS tasks (
  id                      SERIAL PRIMARY KEY,
  title                   TEXT NOT NULL,
  description             TEXT,
  due_date                DATE,
  status                  TEXT NOT NULL DEFAULT 'todo',
  sort_order              INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  last_overdue_email_at   TIMESTAMPTZ,
  CONSTRAINT tasks_status_check CHECK (
    status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')
  )
);
