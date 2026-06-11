/** Known assignees on the /tasks board. Assignee is stored as plain text in the DB. */
export const TASK_ASSIGNEES = ["Ann", "Tim", "Bot"] as const;
export type TaskAssignee = (typeof TASK_ASSIGNEES)[number];

export const BOT_ASSIGNEE: TaskAssignee = "Bot";

export function isKnownTaskAssignee(value: string): value is TaskAssignee {
  return (TASK_ASSIGNEES as readonly string[]).includes(value);
}

export function isBotAssignee(assignee: string | null | undefined): boolean {
  return assignee?.trim().toLowerCase() === BOT_ASSIGNEE.toLowerCase();
}

/** Map legacy/custom spellings to a known assignee when possible. */
export function normalizeTaskAssignee(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const name of TASK_ASSIGNEES) {
    if (name.toLowerCase() === lower) return name;
  }
  return trimmed;
}
