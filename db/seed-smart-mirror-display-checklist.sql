-- Smart mirror: keep Tabtrust tablet display always on (Developer options + Chrome).
-- Safe to run once: skips if subtasks already exist on the checklist task.

WITH existing AS (
  SELECT id
  FROM tasks
  WHERE project_label = 'Smart mirror'
    AND title = 'Keep smart mirror display always on'
  LIMIT 1
),
sec AS (
  SELECT id FROM task_sections ORDER BY sort_order ASC, id ASC LIMIT 1
),
mx AS (
  SELECT COALESCE(MAX(t.sort_order), 0) + 1 AS n
  FROM tasks t
  WHERE t.section_id = (SELECT id FROM sec)
),
ins AS (
  INSERT INTO tasks (
    title,
    description,
    due_date,
    status,
    section_id,
    sort_order,
    assignee,
    priority,
    project_label
  )
  SELECT
    'Keep smart mirror display always on',
    'Tabtrust tablet in the mirror frame — Chrome on /admin/mirror. Complete once while the tablet is out of the frame.',
    CURRENT_DATE,
    'todo',
    (SELECT id FROM sec),
    (SELECT n FROM mx),
    NULL,
    'medium',
    'Smart mirror'
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING id
),
task_id AS (
  SELECT id FROM ins
  UNION ALL
  SELECT id FROM existing
  LIMIT 1
)
INSERT INTO task_subtasks (task_id, title, done, sort_order)
SELECT
  task_id.id,
  v.title,
  false,
  v.ord
FROM task_id
CROSS JOIN (
  VALUES
    (0, 'Plug tablet into USB power 24/7 (leave charger connected behind frame)'),
    (1, 'Settings → About tablet → tap Build number 7 times (enable Developer options)'),
    (2, 'Settings → Developer options → turn on Stay awake'),
    (3, 'Settings → Display → Screen timeout → 30 minutes (backup if stay awake fails)'),
    (4, 'Settings → Battery → Battery optimization → Chrome → Don''t optimize / Unrestricted'),
    (5, 'Turn off Battery saver and any Tabtrust smart power or auto-sleep settings'),
    (6, 'Chrome → open /admin/mirror → menu → Add to Home screen'),
    (7, 'Open mirror from home screen → tap Full screen'),
    (8, 'Tap Voice wake → Allow microphone when Chrome prompts'),
    (9, 'Settings → Security → Screen lock → None or Swipe (no PIN behind the glass)')
) AS v(ord, title)
WHERE NOT EXISTS (
  SELECT 1 FROM task_subtasks s WHERE s.task_id = task_id.id LIMIT 1
);
