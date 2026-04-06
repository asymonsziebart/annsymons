-- Run once in Neon: description, due_date, status; removes legacy `done` if present.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'done'
  ) THEN
    UPDATE tasks SET status = CASE WHEN done = true THEN 'done' ELSE 'todo' END WHERE status IS NULL;
  ELSE
    UPDATE tasks SET status = 'todo' WHERE status IS NULL;
  END IF;
END $$;

UPDATE tasks SET status = 'todo' WHERE status IS NULL OR TRIM(status) = '';

ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE tasks ALTER COLUMN status SET NOT NULL;

ALTER TABLE tasks DROP COLUMN IF EXISTS done;

UPDATE tasks SET status = 'todo'
WHERE status NOT IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled');

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (
  status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')
);
