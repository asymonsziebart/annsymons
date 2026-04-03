/**
 * Tasks app password: TASKS_PASSWORD, or falls back to ADMIN_PASSWORD so one env works on Vercel.
 */
export function getTasksPassword(): string {
  const fromTasks = process.env.TASKS_PASSWORD?.trim();
  if (fromTasks) return fromTasks;
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}
