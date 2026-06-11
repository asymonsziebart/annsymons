import { getSubtasksForTask } from "@/lib/data/taskSubtasks";
import type { TaskRow } from "@/lib/data/tasks";
import {
  isNewlyAssignedToBot,
  sendBotTaskAssignedEmail,
} from "./sendBotTaskAssignedEmail";

/** Await in API routes — fire-and-forget is dropped when Vercel freezes the function. */
export async function notifyBotTaskAssignedIfNeeded(
  task: TaskRow,
  previousAssignee?: string | null
): Promise<{ sent: boolean; error?: string }> {
  const shouldNotify =
    previousAssignee === undefined
      ? task.assignee != null && isNewlyAssignedToBot(null, task.assignee)
      : isNewlyAssignedToBot(previousAssignee, task.assignee);

  if (!shouldNotify) return { sent: false };

  try {
    const subtasks = await getSubtasksForTask(task.id);
    const result = await sendBotTaskAssignedEmail(task, subtasks);
    if (!result.ok) {
      console.error("[bot-task-email]", result.error);
      return { sent: false, error: result.error };
    }
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send Bot task email";
    console.error("[bot-task-email]", e);
    return { sent: false, error: message };
  }
}
