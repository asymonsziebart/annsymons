/**
 * Main tasks app password: TASKS_PASSWORD, or falls back to ADMIN_PASSWORD so one env works on Vercel.
 * Additional logins: TASKS_PASSWORD_TIM (e.g. second person), each gets the same /tasks data.
 */
export function getTasksPassword(): string {
  const fromTasks = process.env.TASKS_PASSWORD?.trim();
  if (fromTasks) return fromTasks;
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

function getTimTasksPassword(): string {
  return process.env.TASKS_PASSWORD_TIM?.trim() ?? "";
}

/** Every distinct, non-empty password that may sign in to /tasks (order: primary, then optional Tim). */
export function getAllTasksPasswords(): string[] {
  const main = getTasksPassword();
  const tim = getTimTasksPassword();
  return [...new Set([main, tim].filter((p) => p.length > 0))];
}
