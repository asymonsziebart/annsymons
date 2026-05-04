-- One-time repair: recurring tasks whose due year is more than one calendar year ahead of
-- CURRENT_DATE (e.g. 2030 while still in 2026) are reset to the 1st of that month in (this year + 1).
-- Safe to re-run; only updates rows that match the WHERE clause.

UPDATE tasks
SET due_date = make_date(
  EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
  recurrence_month,
  1
)::date
WHERE recurrence_month IS NOT NULL
  AND due_date IS NOT NULL
  AND EXTRACT(YEAR FROM due_date::date) > EXTRACT(YEAR FROM CURRENT_DATE)::int + 1;
