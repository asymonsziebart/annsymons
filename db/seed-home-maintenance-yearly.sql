-- Yearly home maintenance checklist (due 1st of each month, repeats yearly).
-- Prerequisites:
--   1) db/migrate-task-recurrence-month.sql
--   2) db/migrate-task-depends-on-ids.sql (optional; uses NULL here)
--
-- Safe to run once: skips if any task already has project_label = 'Home maintenance'.

INSERT INTO task_sections (name, color_key, sort_order)
SELECT
  'Home maintenance',
  'green',
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM task_sections s)
WHERE NOT EXISTS (SELECT 1 FROM task_sections WHERE name = 'Home maintenance');

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
  'Yearly home maintenance checklist',
  (
    CASE
      WHEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, v.rec_m, 1) < CURRENT_DATE
      THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, v.rec_m, 1)
      ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, v.rec_m, 1)
    END
  )::date,
  'todo',
  (SELECT id FROM task_sections WHERE name = 'Home maintenance' LIMIT 1),
  v.sort_order,
  NULL,
  'low',
  NULL,
  NULL,
  NULL,
  NULL,
  v.rec_m,
  NULL,
  NULL,
  'Home maintenance'
FROM (
  VALUES
    (1, 1, 'Change Furnace Filters'),
    (2, 1, 'Test Carbon Monoxide and Smoke Detectors'),
    (3, 1, 'Check for Ice Dams and Icicles'),
    (4, 1, 'Clean Range Hood Fan'),
    (5, 1, 'Vacuum Refrigerator Coils'),
    (6, 1, 'Run Water and Flush Toilets in Unused Spaces'),
    (7, 1, 'Check Water Softener'),
    (8, 1, 'Clean Garbage Disposal'),
    (9, 2, 'Clean and Vacuum Curtains'),
    (10, 2, 'Check Caulking Around Showers and Bathtubs'),
    (11, 2, 'Check for Ice Dams and Icicles'),
    (12, 2, 'Clean Garbage Disposal'),
    (13, 2, 'Test Carbon Monoxide and Smoke Detectors'),
    (14, 3, 'Change Furnace Filters'),
    (15, 3, 'Test Carbon Monoxide and Smoke Detectors'),
    (16, 3, 'Change Batteries in Smoke Detectors'),
    (17, 3, 'Inspect Roofing for Damage'),
    (18, 3, 'Check Exterior Drainage'),
    (19, 3, 'Get A/C Serviced'),
    (20, 3, 'Flush Hot Water Heater and Remove Sediment'),
    (21, 3, 'Clean Garbage Disposal'),
    (22, 4, 'Test Carbon Monoxide and Smoke Detectors'),
    (23, 4, 'Run Water and Flush Toilets in Unused Spaces'),
    (24, 4, 'Check Water Softener'),
    (25, 4, 'Clean Garbage Disposal'),
    (26, 4, 'Clear Dead Plants/Shrubs'),
    (27, 4, 'Clean Out Window Wells of Debris'),
    (28, 5, 'Pump & Inspect Septic Tank'),
    (29, 5, 'Oil Garage Door Tracks'),
    (30, 5, 'Trim Trees, Bushes, & Shrubs'),
    (31, 5, 'Maintain Yard Growth'),
    (32, 5, 'Clean Garbage Disposal'),
    (33, 5, 'Test Carbon Monoxide and Smoke Detectors'),
    (34, 5, 'Fertilize Lawn'),
    (35, 5, 'Clean Window Screens'),
    (36, 6, 'Change Furnace Filters'),
    (37, 6, 'Test Carbon Monoxide and Smoke Detectors'),
    (38, 6, 'Remove Lint From Dryer Exhaust'),
    (39, 6, 'Maintain Yard Growth'),
    (40, 6, 'Power Wash Windows and Siding'),
    (41, 6, 'Clean Garage'),
    (42, 6, 'Inspect Plumbing for Leaks'),
    (43, 6, 'Clean Garbage Disposal'),
    (44, 7, 'Test Carbon Monoxide and Smoke Detectors'),
    (45, 7, 'Maintain Yard Growth'),
    (46, 7, 'Clean Range Hood Fan'),
    (47, 7, 'Vacuum Refrigerator Coils'),
    (48, 7, 'Run Water and Flush Toilets in Unused Spaces'),
    (49, 7, 'Check Water Softener'),
    (50, 7, 'Clean Garbage Disposal'),
    (51, 8, 'Maintain Yard Growth'),
    (52, 8, 'Check For Signs of Ants and Destructive Insects'),
    (53, 8, 'Clean Garbage Disposal'),
    (54, 8, 'Test Carbon Monoxide and Smoke Detectors'),
    (55, 9, 'Test Carbon Monoxide and Smoke Detectors'),
    (56, 9, 'Inspect Roofing for Damage'),
    (57, 9, 'Get Heater Serviced'),
    (58, 9, 'Flush Hot Water Heater and Remove Sediment'),
    (59, 9, 'Fertilize Lawn'),
    (60, 9, 'Check Weatherstripping'),
    (61, 10, 'Test Carbon Monoxide and Smoke Detectors'),
    (62, 10, 'Run Water and Flush Toilets in Unused Spaces'),
    (63, 10, 'Check Water Softener'),
    (64, 10, 'Clean Garbage Disposal'),
    (65, 10, 'Clear Gutters and Downspouts'),
    (66, 10, 'Clean and Inspect Chimney'),
    (67, 11, 'Clean Carpets'),
    (68, 11, 'Remove Lint from Dryer Exhaust'),
    (69, 11, 'Replace Batteries in Smoke Detectors'),
    (70, 11, 'Check Fire Extinguisher'),
    (71, 11, 'Clean Kitchen Exhaust Hood'),
    (72, 11, 'Clean Garbage Disposal'),
    (73, 11, 'Oil Garage Door Tracks'),
    (74, 12, 'Test Carbon Monoxide and Smoke Detectors'),
    (75, 12, 'Check for Ice Dams and Icicles'),
    (76, 12, 'Clean Garbage Disposal'),
    (77, 12, 'Inspect Appliance Hoses'),
    (78, 12, 'Check Sinks & Toilets for Leaks')
) AS v(sort_order, rec_m, title)
WHERE EXISTS (SELECT 1 FROM task_sections WHERE name = 'Home maintenance')
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE project_label = 'Home maintenance' LIMIT 1);
