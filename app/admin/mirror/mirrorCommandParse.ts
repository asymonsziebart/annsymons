import type { TaskRow } from "@/lib/data/taskClientTypes";
import { normalizeSpeech } from "./mirrorWakeTraining";

function normalize(text: string): string {
  return normalizeSpeech(text);
}

export function isQuietCommand(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return (
    /\bbe quiet\b/.test(t) ||
    /\bstop talking\b/.test(t) ||
    /\bshut up\b/.test(t) ||
    /\bnever mind\b/.test(t) ||
    /\bnevermind\b/.test(t) ||
    t === "cancel" ||
    t === "stop"
  );
}

export function isStopListeningCommand(text: string): boolean {
  const t = normalize(text);
  return (
    /\bstop listening\b/.test(t) ||
    /\bdisable (voice|microphone|mic)\b/.test(t) ||
    /\bturn off (voice|microphone|mic)\b/.test(t)
  );
}

export function isHomeCommand(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return (
    t === "home" ||
    /\bgo home\b/.test(t) ||
    /\bgo to (the )?home( screen)?\b/.test(t) ||
    /\bback to (the )?home( screen)?\b/.test(t) ||
    /\breturn (to )?(the )?(home|main)( screen)?\b/.test(t) ||
    /\bhome screen\b/.test(t) ||
    /\bmain screen\b/.test(t) ||
    /\bshow (the )?(home|main)( screen)?\b/.test(t)
  );
}

export function isShowTasksCommand(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return (
    t === "tasks" ||
    t === "my tasks" ||
    t === "due tasks" ||
    /\bshow (me )?(my )?(due )?tasks\b/.test(t) ||
    /\bopen (my )?(due )?tasks\b/.test(t) ||
    /\blist (my )?(due )?tasks\b/.test(t) ||
    /\btask list\b/.test(t) ||
    /\bshow (the )?task list\b/.test(t)
  );
}

export function isCloseTasksCommand(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return (
    /\bclose (the )?tasks?\b/.test(t) ||
    /\bhide (the )?tasks?\b/.test(t) ||
    /\bdismiss (the )?tasks?\b/.test(t)
  );
}

export type FullscreenVoiceCommand = "enter" | "exit" | "toggle";

export function parseFullscreenCommand(text: string): FullscreenVoiceCommand | null {
  const t = normalize(text);
  if (!t) return null;

  if (
    /\bexit full ?screen\b/.test(t) ||
    /\bleave full ?screen\b/.test(t) ||
    /\bclose full ?screen\b/.test(t) ||
    /\bend full ?screen\b/.test(t)
  ) {
    return "exit";
  }

  if (
    /\b(go|enter|start) full ?screen\b/.test(t) ||
    /\bfull ?screen (mode|on)\b/.test(t) ||
    t === "fullscreen" ||
    t === "full screen"
  ) {
    return "enter";
  }

  if (/\btoggle full ?screen\b/.test(t)) return "toggle";
  return null;
}

export type TimerVoiceCommand =
  | { type: "set"; durationMs: number; label: string }
  | { type: "cancel"; label?: string }
  | { type: "status" };

const DURATION_CHUNK =
  /(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi;

export function parseDurationMs(text: string): number | null {
  const t = normalize(text);
  let total = 0;
  let matched = false;
  for (const match of t.matchAll(DURATION_CHUNK)) {
    matched = true;
    const n = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("h")) total += n * 60 * 60 * 1000;
    else if (unit.startsWith("m")) total += n * 60 * 1000;
    else total += n * 1000;
  }
  if (!matched || total <= 0) return null;
  return total;
}

function extractTimerLabel(beforeFor: string): string {
  let label = normalize(beforeFor)
    .replace(/^(set|start|create)\b/, "")
    .replace(/\b(a|an|the|my)\b/g, " ")
    .replace(/\btimer\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return label;
}

export function parseTimerCommand(text: string): TimerVoiceCommand | null {
  const t = normalize(text);
  if (!t) return null;

  if (
    /\b(cancel|clear|stop|delete) (all )?timers?\b/.test(t) ||
    t === "cancel timer" ||
    t === "stop timer"
  ) {
    const labelMatch = t.match(
      /\b(?:cancel|clear|stop|delete) (?:the )?(.+?) timer\b/
    );
    if (labelMatch?.[1] && !/^(all|a|an|my)$/.test(normalize(labelMatch[1]))) {
      return { type: "cancel", label: normalize(labelMatch[1]) };
    }
    return { type: "cancel" };
  }

  if (
    /\b(how much time|time left|timer (status|left)|what's left|whats left|check (the )?timer)\b/.test(
      t
    ) ||
    t === "timer" ||
    t === "timers"
  ) {
    return { type: "status" };
  }

  const forMatch = t.match(
    /^(?:set |start |create )?(?:a |an |the |my )?(.+?)?\btimer for (.+)$/
  );
  if (forMatch) {
    const durationMs = parseDurationMs(forMatch[2]);
    if (durationMs) {
      const label = extractTimerLabel(forMatch[1] ?? "") || "timer";
      return { type: "set", durationMs, label };
    }
  }

  const loose = t.match(/^(?:set |start )?(?:a |an |the )?timer (.+)$/);
  if (loose) {
    const durationMs = parseDurationMs(loose[1]);
    if (durationMs) return { type: "set", durationMs, label: "timer" };
  }

  if (/\btimer\b/.test(t)) {
    const durationMs = parseDurationMs(t);
    if (durationMs) {
      const label = extractTimerLabel(t.replace(DURATION_CHUNK, " ")) || "timer";
      return { type: "set", durationMs, label };
    }
  }

  return null;
}

export function formatDurationSpoken(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  }
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

export function formatDurationClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type CompleteTaskVoiceCommand =
  | { type: "current" }
  | { type: "index"; index: number }
  | { type: "query"; query: string };

const COMPLETE_PREFIX =
  /^(mark |complete |finish |finished |done with |i finished |i completed )/;

export function parseCompleteTaskCommand(text: string): CompleteTaskVoiceCommand | null {
  const t = normalize(text);
  if (!t) return null;

  if (
    /\bmark (this|that|the current) (task )?done\b/.test(t) ||
    /\bcomplete (this|that|the current) task\b/.test(t) ||
    /\b(this|that) task is done\b/.test(t) ||
    t === "mark done" ||
    t === "complete task" ||
    t === "task done"
  ) {
    return { type: "current" };
  }

  const ordinal = t.match(
    /\bmark (?:the )?(first|second|third|1st|2nd|3rd|\d+)(?: task)? done\b/
  );
  if (ordinal) {
    const token = ordinal[1];
    const map: Record<string, number> = {
      first: 0,
      "1st": 0,
      second: 1,
      "2nd": 1,
      third: 2,
      "3rd": 2,
    };
    const index = map[token] ?? Math.max(0, Number(token) - 1);
    if (!Number.isNaN(index)) return { type: "index", index };
  }

  if (
    !COMPLETE_PREFIX.test(t) &&
    !/\bmark .+ done\b/.test(t) &&
    !/\bcomplete .+\b/.test(t)
  ) {
    return null;
  }

  let query = t
    .replace(/\bmark\b/, " ")
    .replace(/\bcomplete\b/, " ")
    .replace(/\bfinish(ed)?\b/, " ")
    .replace(/\bi (finished|completed)\b/, " ")
    .replace(/\bdone with\b/, " ")
    .replace(/\b(the |a |an |my |task |as |is )?done\b/g, " ")
    .replace(/\btask\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!query || query === "this" || query === "that") return { type: "current" };
  return { type: "query", query };
}

function titleScore(query: string, title: string): number {
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.95;
  if (q.includes(t)) return 0.9;
  const qWords = q.split(" ").filter((w) => w.length > 2);
  if (qWords.length === 0) return 0;
  let hits = 0;
  for (const word of qWords) {
    if (t.includes(word)) hits += 1;
  }
  return hits / qWords.length;
}

export function matchTaskForComplete(
  command: CompleteTaskVoiceCommand,
  dueTasks: TaskRow[],
  currentIndex: number
): TaskRow | null {
  if (dueTasks.length === 0) return null;

  if (command.type === "current") {
    return dueTasks[currentIndex] ?? dueTasks[0] ?? null;
  }

  if (command.type === "index") {
    return dueTasks[command.index] ?? null;
  }

  let best: { task: TaskRow; score: number } | null = null;
  for (const task of dueTasks) {
    const score = titleScore(command.query, task.title);
    if (score >= 0.45 && (!best || score > best.score)) {
      best = { task, score };
    }
  }
  return best?.task ?? null;
}

export function isRecipeReadCommand(text: string): boolean {
  const t = normalize(text);
  return (
    /\bread (the |me the |me )?(ingredients|ingredient list)\b/.test(t) ||
    /\bread (the |this |me the |me )?(step|steps|instructions|directions)\b/.test(t) ||
    /\bread (it|that|this)\b/.test(t) ||
    /\bwhat does (it|this|that) say\b/.test(t) ||
    t === "read ingredients" ||
    t === "read step" ||
    t === "read this step"
  );
}

export function recipeReadTarget(text: string): "ingredients" | "step" | "auto" {
  const t = normalize(text);
  if (/\bingredients?\b/.test(t)) return "ingredients";
  if (/\b(step|steps|instructions|directions)\b/.test(t)) return "step";
  return "auto";
}

export type AddTaskDue = "today" | "tomorrow" | "none";

export type AddTaskVoiceCommand = {
  title: string;
  due: AddTaskDue;
};

function cleanTaskTitle(title: string): string {
  return title
    .replace(/\b(please|just)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(to|a|an|the|my)\s+/i, "")
    .replace(/[?.!,]+$/g, "")
    .trim();
}

function stripDueFromTitle(title: string): { title: string; due: AddTaskDue } {
  let t = title.trim();
  let due: AddTaskDue = "today";

  if (/\bwithout (a )?due date\b/.test(t) || /\bno due date\b/.test(t)) {
    due = "none";
    t = t.replace(/\bwithout (a )?due date\b/g, " ").replace(/\bno due date\b/g, " ");
  } else if (/\bdue tomorrow\b/.test(t)) {
    due = "tomorrow";
    t = t.replace(/\bdue tomorrow\b/g, " ");
  } else if (/\bdue today\b/.test(t)) {
    due = "today";
    t = t.replace(/\bdue today\b/g, " ");
  } else if (/\btomorrow\s*$/.test(t)) {
    due = "tomorrow";
    t = t.replace(/\btomorrow\s*$/, "");
  } else if (/\btoday\s*$/.test(t)) {
    due = "today";
    t = t.replace(/\btoday\s*$/, "");
  }

  return { title: cleanTaskTitle(t), due };
}

export function parseAddTaskCommand(text: string): AddTaskVoiceCommand | null {
  const t = normalize(text);
  if (!t) return null;

  // Title is always capture group 1 (no named groups — tsconfig targets ES2017).
  const patterns: RegExp[] = [
    /^add (?:a |an |the )?(?:new )?task (?:to |for |called |named )?(.+)$/,
    /^create (?:a |an |the )?(?:new )?task (?:to |for |called |named )?(.+)$/,
    /^new task (.+)$/,
    /^add (.+) to (?:my )?(?:to ?do|todo|task) list$/,
    /^put (.+) on (?:my )?(?:to ?do|todo|task) list$/,
    /^remind me to (.+)$/,
    /^remind me (.+)$/,
    /^add (?:a |an |the )?(?:to ?do|todo|task) (.+)$/,
  ];

  for (const pattern of patterns) {
    const m = t.match(pattern);
    const rawTitle = (m?.[1] ?? "").trim();
    if (!rawTitle) continue;
    const parsed = stripDueFromTitle(rawTitle);
    if (!parsed.title || parsed.title.length < 2) continue;
    // Avoid eating complete-task phrasing.
    if (/\bdone\b/.test(parsed.title) && /^(this|that|the first|the second)/.test(parsed.title)) {
      continue;
    }
    return parsed;
  }

  return null;
}

export function dueDateIsoForAdd(due: AddTaskDue, ref = new Date()): string | null {
  if (due === "none") return null;
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (due === "tomorrow") d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
