/**
 * Webhook functionality to notify the home server of task changes.
 * This is optional and only triggers if TASKS_WEBHOOK_URL is configured.
 */

import { getTasksWebhookUrl } from "./externalTasksAuth";
import type { TaskRow } from "./data/tasks";

export type WebhookEvent =
  | { type: "task.created"; task: TaskRow }
  | { type: "task.updated"; task: TaskRow }
  | { type: "task.deleted"; taskId: number };

/**
 * Send a webhook notification to the home server about a task change.
 * This is fire-and-forget - failures are logged but don't block the API response.
 */
export async function notifyWebhook(event: WebhookEvent): Promise<void> {
  const webhookUrl = getTasksWebhookUrl();
  if (!webhookUrl) {
    // Webhook not configured, skip silently
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "annsymons-tasks-api/1.0",
      },
      body: JSON.stringify({
        event: event.type,
        timestamp: new Date().toISOString(),
        data: "task" in event ? event.task : { id: event.taskId },
      }),
      // Don't wait too long for the webhook
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Log but don't throw - webhook failures shouldn't break the API
    console.error("Webhook notification failed:", error);
  }
}
