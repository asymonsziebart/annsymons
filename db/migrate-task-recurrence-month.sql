-- Run once in Neon (or psql). Yearly recurrence on the 1st of the given calendar month.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_month SMALLINT NULL;

COMMENT ON COLUMN tasks.recurrence_month IS
  'If set (1–12), completing the task rolls due_date to the 1st of that month next year and sets status to todo.';
