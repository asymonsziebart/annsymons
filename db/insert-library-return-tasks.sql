-- Insert three "return by" tasks (due May 26, 2026).
-- Uses the first task section by sort_order (usually "Recently assigned"). Adjust the CTE if you prefer another section.

WITH sec AS (
  SELECT id FROM task_sections ORDER BY sort_order ASC, id ASC LIMIT 1
),
mx AS (
  SELECT COALESCE(MAX(t.sort_order), 0) AS n FROM tasks t WHERE t.section_id = (SELECT id FROM sec)
)
INSERT INTO tasks (
  title,
  description,
  due_date,
  status,
  section_id,
  sort_order,
  assignee,
  priority,
  estimated_minutes,
  actual_minutes,
  dependencies,
  depends_on_task_ids,
  recurrence_month,
  requester,
  quarter,
  project_label
)
SELECT
  v.title,
  v.description,
  v.due_date::date,
  'todo',
  (SELECT id FROM sec),
  (SELECT n FROM mx) + v.ord,
  'ANN EMILY SYMONS',
  'medium',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'Library return'
FROM (
  VALUES
    (
      1,
      'Onyx Storm (audio book on CD)',
      'Checked out May 2, 2026. 3 renewals remaining.',
      '2026-05-26'
    ),
    (
      2,
      'Star wars : Shatterpoint',
      'Book. Checked out May 2, 2026. 3 renewals remaining.',
      '2026-05-26'
    ),
    (
      3,
      'The complete book of pickleball : the ultimate training guide for passionate players of all levels',
      'Book. Checked out May 2, 2026. 3 renewals remaining.',
      '2026-05-26'
    )
) AS v(ord, title, description, due_date);
