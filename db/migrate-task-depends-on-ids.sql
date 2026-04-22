-- Run in Neon (or psql) once. Stores JSON array of task ids, e.g. [12,34].
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on_task_ids TEXT;
