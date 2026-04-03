-- Run this in Neon SQL Editor if you get "relation tasks does not exist".
-- Creates the tasks table for /tasks and overdue emails in one step.

CREATE TABLE IF NOT EXISTS tasks (
  id                      SERIAL PRIMARY KEY,
  title                   TEXT NOT NULL,
  done                    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order              INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  last_overdue_email_at   TIMESTAMPTZ
);
