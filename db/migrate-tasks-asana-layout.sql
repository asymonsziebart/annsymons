-- Asana-style: sections, extra task fields, subtasks. Run once in Neon after tasks v2 exists.

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

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section_id INT REFERENCES task_sections(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_label TEXT;

UPDATE tasks
SET section_id = (SELECT id FROM task_sections ORDER BY sort_order LIMIT 1)
WHERE section_id IS NULL;

ALTER TABLE tasks ALTER COLUMN section_id SET NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (
  priority IN ('none', 'high', 'medium', 'low')
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
