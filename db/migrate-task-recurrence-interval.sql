-- Run once in Neon. Adds repeat cadence: daily, weekly, monthly, yearly (yearly still uses recurrence_month for "1st of month").
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_interval TEXT NULL;

-- Drop only if present (avoids NOTICE from DROP CONSTRAINT IF EXISTS on first run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    INNER JOIN pg_catalog.pg_class rel ON rel.oid = c.conrelid
    INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.conname = 'tasks_recurrence_interval_check'
      AND nsp.nspname = 'public'
      AND rel.relname = 'tasks'
  ) THEN
    ALTER TABLE public.tasks DROP CONSTRAINT tasks_recurrence_interval_check;
  END IF;
END
$$;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_interval_check CHECK (
    recurrence_interval IS NULL
    OR recurrence_interval IN ('daily', 'weekly', 'monthly', 'yearly')
  );

COMMENT ON COLUMN tasks.recurrence_interval IS
  'Repeat cadence when set. yearly uses recurrence_month (1–12) for the 1st of that month. Completing rolls due_date forward.';

UPDATE tasks
SET recurrence_interval = 'yearly'
WHERE recurrence_month IS NOT NULL
  AND recurrence_interval IS NULL;
