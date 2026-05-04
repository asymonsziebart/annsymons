-- One-time fix: set home-maintenance recurring tasks to the 1st of their month in the
-- **current calendar year** (Neon CURRENT_DATE / server date — usually UTC).
-- Run if dues jumped to next year (e.g. May–Dec 2026 tasks showed as 2027 after May 1 passed).
--
-- Optional: replace EXTRACT(YEAR FROM CURRENT_DATE) with 2026 if you want to lock the year.

UPDATE tasks
SET due_date = make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, recurrence_month, 1)::date
WHERE project_label = 'Home maintenance'
  AND recurrence_month IS NOT NULL;

-- Example: force everything to 2026 regardless of server year (uncomment to use):
-- UPDATE tasks
-- SET due_date = make_date(2026, recurrence_month, 1)::date
-- WHERE project_label = 'Home maintenance'
--   AND recurrence_month IS NOT NULL;
