/**
 * Sends a single email listing overdue tasks via Resend (https://resend.com).
 * Set RESEND_API_KEY and TASKS_NOTIFY_EMAIL in the environment.
 */

export type OverdueTaskLine = {
  title: string;
  createdAt: string;
  dueDate: string | null;
  statusLabel: string;
};

export async function sendOverdueTasksDigest(
  tasks: OverdueTaskLine[]
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.TASKS_NOTIFY_EMAIL?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Ann Symons Tasks <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }
  if (!to) {
    return { ok: false, error: "TASKS_NOTIFY_EMAIL is not set" };
  }
  if (tasks.length === 0) {
    return { ok: true };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://annsymons.com";
  const tasksUrl = `${site}/tasks`;

  const lines = tasks
    .map((t) => {
      const due =
        t.dueDate != null && t.dueDate !== ""
          ? `Due ${escapeHtml(formatDate(t.dueDate))}`
          : `No due date — open since ${escapeHtml(formatDate(t.createdAt))}`;
      return `<li><strong>${escapeHtml(t.title)}</strong><br/><span style="color:#555;font-size:14px">${escapeHtml(t.statusLabel)} · ${due}</span></li>`;
    })
    .join("");

  const html = `
    <p>The following tasks need attention (past due date, or open more than a week with no due date):</p>
    <ul>${lines}</ul>
    <p style="color:#666;font-size:14px;margin-top:24px">You get this at most once per week per task while it stays open. Mark tasks done in your <a href="${escapeHtml(tasksUrl)}">tasks</a> list.</p>
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
      subject: `Overdue tasks (${tasks.length}) — annsymons.com`,
      html,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { ok: false, error: data.message || `Resend error ${res.status}` };
  }
  return { ok: true };
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
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
