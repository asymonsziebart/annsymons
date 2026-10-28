/**
 * Sends an email to each person with open tasks via Resend (https://resend.com).
 * Set RESEND_API_KEY, TASKS_EMAIL_ANN, and TASKS_EMAIL_TIM in the environment.
 */

export type AssigneeTaskLine = {
  title: string;
  dueDate: string | null;
};

export type AssigneeDigestResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

/**
 * Case-insensitive matching for assignees.
 * Ann matches 'Ann' or 'Anne'; Tim matches 'Tim' or 'Timothy'.
 */
function normalizeAssignee(assignee: string | null): 'ann' | 'tim' | null {
  if (!assignee) return null;
  const lower = assignee.toLowerCase().trim();
  if (lower === 'ann' || lower === 'anne') return 'ann';
  if (lower === 'tim' || lower === 'timothy') return 'tim';
  return null;
}

/**
 * Send one email per person (Ann or Tim) who has open tasks.
 * Returns a result for each person with { ok, skipped?, error? }.
 */
export async function sendAssigneeOpenTasksDigest(
  tasks: { assignee: string | null; title: string; dueDate: string | null }[]
): Promise<{ ann: AssigneeDigestResult; tim: AssigneeDigestResult }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Ann Symons Tasks <onboarding@resend.dev>";

  if (!apiKey) {
    const error = "RESEND_API_KEY is not set";
    return {
      ann: { ok: false, error },
      tim: { ok: false, error },
    };
  }

  // Group tasks by assignee
  const assigneeTasks: { ann: AssigneeTaskLine[]; tim: AssigneeTaskLine[] } = {
    ann: [],
    tim: [],
  };

  for (const task of tasks) {
    const normalized = normalizeAssignee(task.assignee);
    if (normalized === 'ann') {
      assigneeTasks.ann.push({ title: task.title, dueDate: task.dueDate });
    } else if (normalized === 'tim') {
      assigneeTasks.tim.push({ title: task.title, dueDate: task.dueDate });
    }
  }

  const annEmail = process.env.TASKS_EMAIL_ANN?.trim();
  const timEmail = process.env.TASKS_EMAIL_TIM?.trim();

  const results = {
    ann: await sendToAssignee('Ann', annEmail, assigneeTasks.ann, apiKey, from),
    tim: await sendToAssignee('Tim', timEmail, assigneeTasks.tim, apiKey, from),
  };

  return results;
}

async function sendToAssignee(
  name: string,
  email: string | undefined,
  tasks: AssigneeTaskLine[],
  apiKey: string,
  from: string
): Promise<AssigneeDigestResult> {
  if (!email) {
    return {
      ok: false,
      error: `TASKS_EMAIL_${name.toUpperCase()} is not set`,
    };
  }

  if (tasks.length === 0) {
    return { ok: true, skipped: true };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.annsymons.com";
  const tasksUrl = `${site}/tasks`;
  const today = new Date().toISOString().slice(0, 10);

  const lines = tasks
    .map((t) => {
      const dueInfo = t.dueDate
        ? t.dueDate < today
          ? `<span style="color:#d9534f;font-weight:600">Overdue: ${escapeHtml(formatDate(t.dueDate))}</span>`
          : `Due ${escapeHtml(formatDate(t.dueDate))}`
        : `No due date`;
      return `<li><strong>${escapeHtml(t.title)}</strong><br/><span style="color:#555;font-size:14px">${dueInfo}</span></li>`;
    })
    .join("");

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You have <strong>${tasks.length}</strong> open ${tasks.length === 1 ? 'task' : 'tasks'}:</p>
    <ul>${lines}</ul>
    <p style="margin-top:24px">
      <a href="${escapeHtml(tasksUrl)}" style="display:inline-block;padding:12px 24px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600">View Tasks</a>
    </p>
    <p style="color:#666;font-size:14px;margin-top:24px">You receive this daily digest when you have open tasks. Mark tasks done to stop reminders.</p>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `You have ${tasks.length} open ${tasks.length === 1 ? 'task' : 'tasks'} — annsymons.com`,
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
