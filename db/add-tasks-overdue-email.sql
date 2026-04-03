-- Run in Neon SQL Editor for existing `tasks` tables.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_overdue_email_at TIMESTAMPTZ;
