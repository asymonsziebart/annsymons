import type { SubtaskRow } from "@/lib/data/taskClientTypes";
import type { TaskRow } from "@/lib/data/tasks";
import { isBotAssignee } from "@/lib/tasksAssignees";

export function getBotTaskNotifyEmail(): string {
  const bot = process.env.TASKS_BOT_NOTIFY_EMAIL?.trim();
  if (bot) return bot;
  return process.env.TASKS_NOTIFY_EMAIL?.trim() ?? "";
}

/**
 * Email when a task is newly assigned to Bot (create or assignee change).
 * Requires RESEND_API_KEY and TASKS_BOT_NOTIFY_EMAIL (or TASKS_NOTIFY_EMAIL).
 * Fire-and-forget from API routes; failures are logged only.
 */
export async function sendBotTaskAssignedEmail(
  task: TaskRow,
  subtasks: SubtaskRow[] = []
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = getBotTaskNotifyEmail();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Ann Symons Tasks <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }
  if (!to) {
    return { ok: false, error: "TASKS_BOT_NOTIFY_EMAIL (or TASKS_NOTIFY_EMAIL) is not set" };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://annsymons.com";
  const tasksUrl = `${site}/tasks`;

  const copyBlock = formatCopyBlock(task, subtasks);
  const html = `
    <p>A new task was assigned to <strong>Bot</strong> on your tasks board.</p>
    <table style="border-collapse:collapse;font-size:15px;line-height:1.5">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Task</td><td><strong>#${task.id}</strong> — ${escapeHtml(task.title)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Section</td><td>${escapeHtml(task.section_name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Priority</td><td>${escapeHtml(task.priority)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Due</td><td>${task.due_date ? escapeHtml(formatDate(task.due_date)) : "—"}</td></tr>
      ${
        task.description?.trim()
          ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Notes</td><td>${escapeHtml(task.description.trim())}</td></tr>`
          : ""
      }
      ${
        subtasks.length
          ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Subtasks</td><td><ul style="margin:0;padding-left:1.2em">${subtasks.map((s) => `<li>${escapeHtml(s.title)}</li>`).join("")}</ul></td></tr>`
          : ""
      }
    </table>
    <p style="margin-top:20px"><a href="${escapeHtml(tasksUrl)}">Open tasks board</a></p>
    <p style="margin-top:24px;font-size:14px;color:#444"><strong>Copy into Cursor:</strong></p>
    <pre style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word">${escapeHtml(copyBlock)}</pre>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Bot task: ${task.title} (#${task.id})`,
      html,
      text: `New Bot task #${task.id}: ${task.title}\n\n${copyBlock}\n\nTasks: ${tasksUrl}`,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { ok: false, error: data.message || `Resend error ${res.status}` };
  }
  return { ok: true };
}

/** True when assignee changed from non-Bot to Bot. */
export function isNewlyAssignedToBot(
  previousAssignee: string | null | undefined,
  nextAssignee: string | null | undefined
): boolean {
  return isBotAssignee(nextAssignee) && !isBotAssignee(previousAssignee);
}

function formatCopyBlock(task: TaskRow, subtasks: SubtaskRow[]): string {
  const lines = [
    `Task #${task.id}: ${task.title}`,
    `Section: ${task.section_name}`,
    `Priority: ${task.priority}`,
    task.due_date ? `Due: ${task.due_date}` : null,
    task.description?.trim() ? `\nDescription:\n${task.description.trim()}` : null,
    subtasks.length
      ? `\nSubtasks:\n${subtasks.map((s) => `- ${s.title}`).join("\n")}`
      : null,
    "\nImplement this in the annsymons.com repo. Mark the task done on /tasks when finished.",
  ];
  return lines.filter((l) => l != null).join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
