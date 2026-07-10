/**
 * Main tasks app password: TASKS_PASSWORD, or falls back to ADMIN_PASSWORD so one env works on Vercel.
 * Tim’s password (TASKS_PASSWORD_TIM) unlocks /tasks and all admin apps (same as ADMIN_PASSWORD).
 */
export function getTasksPassword(): string {
  const fromTasks = process.env.TASKS_PASSWORD?.trim();
  if (fromTasks) return fromTasks;
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function getTimPassword(): string {
  return process.env.TASKS_PASSWORD_TIM?.trim() ?? "";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

/** Passwords that unlock /admin and other admin-gated apps (primary admin + Tim). */
export function getAllAdminPasswords(): string[] {
  const admin = getAdminPassword();
  const tim = getTimPassword();
  return [...new Set([admin, tim].filter((p) => p.length > 0))];
}

/** Every distinct, non-empty password that may sign in to /tasks (order: primary, then optional Tim). */
export function getAllTasksPasswords(): string[] {
  const main = getTasksPassword();
  const tim = getTimPassword();
  return [...new Set([main, tim].filter((p) => p.length > 0))];
}
