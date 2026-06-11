import { getSubtasksForTask } from "@/lib/data/taskSubtasks";
import type { TaskRow } from "@/lib/data/tasks";
import {
  isNewlyAssignedToBot,
  sendBotTaskAssignedEmail,
} from "./sendBotTaskAssignedEmail";

/** Non-blocking: logs Resend errors to console. */
export function notifyBotTaskAssignedIfNeeded(
  task: TaskRow,
  previousAssignee?: string | null
): void {
  const shouldNotify =
    previousAssignee === undefined
      ? task.assignee != null && isNewlyAssignedToBot(null, task.assignee)
      : isNewlyAssignedToBot(previousAssignee, task.assignee);

  if (!shouldNotify) return;

  void (async () => {
    try {
      const subtasks = await getSubtasksForTask(task.id);
      const result = await sendBotTaskAssignedEmail(task, subtasks);
      if (!result.ok) {
        console.error("[bot-task-email]", result.error);
      }
    } catch (e) {
      console.error("[bot-task-email]", e);
    }
  })();
}
