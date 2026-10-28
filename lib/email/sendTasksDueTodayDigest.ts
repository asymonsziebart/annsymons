/**
 * Sends an email to each person with tasks due today via Resend (https://resend.com).
 * Set RESEND_API_KEY, TASKS_EMAIL_ANN, and TASKS_EMAIL_TIM in the environment.
 */

export type TaskDueTodayLine = {
  title: string;
  dueDate: string;
};

export type TasksDueTodayResult = {
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
 * Get today's date in YYYY-MM-DD format in America/Detroit timezone.
 */
function getTodayInDetroit(): string {
  const now = new Date();
  // Convert to Detroit time (America/Detroit = Eastern Time)
  const detroitTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
  const year = detroitTime.getFullYear();
  const month = String(detroitTime.getMonth() + 1).padStart(2, '0');
  const day = String(detroitTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Send one email per person (Ann or Tim) who has tasks due today.
 * Returns a result for each person with { ok, skipped?, error? }.
 */
export async function sendTasksDueTodayDigest(
  tasks: { assignee: string | null; title: string; dueDate: string | null }[]
): Promise<{ ann: TasksDueTodayResult; tim: TasksDueTodayResult }> {
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

  const today = getTodayInDetroit();

  // Group tasks by assignee, filtering to only those due today
  const assigneeTasks: { ann: TaskDueTodayLine[]; tim: TaskDueTodayLine[] } = {
    ann: [],
    tim: [],
  };

  for (const task of tasks) {
    // Skip tasks without a due date or where due date is not today
    if (!task.dueDate) continue;
    
    // Extract date-only portion in case due_date has a timestamp
    const taskDateOnly = task.dueDate.slice(0, 10);
    if (taskDateOnly !== today) continue;

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
  tasks: TaskDueTodayLine[],
  apiKey: string,
  from: string
): Promise<TasksDueTodayResult> {
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

  const lines = tasks
    .map((t) => {
      return `<li><strong>${escapeHtml(t.title)}</strong></li>`;
    })
    .join("");

  const taskWord = tasks.length === 1 ? 'task is' : 'tasks are';
  
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p><strong>${tasks.length}</strong> ${taskWord} due today:</p>
    <ul>${lines}</ul>
    <p style="margin-top:24px">
      <a href="${escapeHtml(tasksUrl)}" style="display:inline-block;padding:12px 24px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600">View Tasks</a>
    </p>
    <p style="color:#666;font-size:14px;margin-top:24px">You receive this when you have tasks due today.</p>
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
      subject: `These tasks are due today — annsymons.com`,
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
