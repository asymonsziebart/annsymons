"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  type TaskRow,
  type TaskStatus,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskOverdue,
} from "@/lib/data/tasks";

type Props = { initialTasks: TaskRow[] };

export default function TasksApp({ initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/tasks/list");
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }, []);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          due_date: dueDate || null,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not add task");
        return;
      }
      setTitle("");
      setDescription("");
      setDueDate("");
      setNewStatus("todo");
      if (data.task) setTasks((prev) => sortTasksClient([...prev, data.task]));
      else await refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function sortTasksClient(list: TaskRow[]): TaskRow[] {
    return [...list].sort((a, b) => {
      const ac = a.status === "done" || a.status === "cancelled" ? 1 : 0;
      const bc = b.status === "done" || b.status === "cancelled" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      if (!a.due_date && !b.due_date) return a.id - b.id;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      return a.id - b.id;
    });
  }

  function replaceTask(updated: TaskRow) {
    setTasks((prev) =>
      sortTasksClient(prev.map((x) => (x.id === updated.id ? updated : x)))
    );
  }

  async function patchTask(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.task) replaceTask(data.task as TaskRow);
  }

  async function remove(id: number) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((x) => x.id !== id));
  }

  async function logout() {
    await fetch("/api/tasks/logout", { method: "POST" });
    router.push("/tasks/login");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--color-ink-muted)]";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {tasks.length === 0 ? "No tasks yet." : `${openCount} open`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
        >
          Sign out
        </button>
      </div>

      <section className="mt-8 rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
        <h2 className="font-heading text-sm font-semibold text-[var(--color-ink)]">
          New task
        </h2>
        <form onSubmit={addTask} className="mt-4 space-y-4">
          <div>
            <label htmlFor="new-title" className={labelClass}>
              Title
            </label>
            <input
              id="new-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className={inputClass}
              disabled={loading}
              required
            />
          </div>
          <div>
            <label htmlFor="new-desc" className={labelClass}>
              Description (optional)
            </label>
            <textarea
              id="new-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, context…"
              rows={3}
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-due" className={labelClass}>
                Due date (optional)
              </label>
              <input
                id="new-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="new-status" className={labelClass}>
                Status
              </label>
              <select
                id="new-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                className={inputClass}
                disabled={loading}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add task"}
          </button>
        </form>
      </section>

      <ul className="mt-8 space-y-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            inputClass={inputClass}
            labelClass={labelClass}
            onPatch={(patch) => void patchTask(task.id, patch)}
            onDelete={() => void remove(task.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskCard({
  task,
  inputClass,
  labelClass,
  onPatch,
  onDelete,
}: {
  task: TaskRow;
  inputClass: string;
  labelClass: string;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(task.due_date ?? "");
  }, [task]);

  const overdue = isTaskOverdue(task);

  return (
    <li
      className={`rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)] sm:p-5 ${
        overdue ? "ring-2 ring-[var(--color-coral)]/40" : ""
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const next = title.trim();
                if (next && next !== task.title) onPatch({ title: next });
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                const next = description.trim();
                const prev = (task.description ?? "").trim();
                if (next !== prev) onPatch({ description: next || null });
              }}
              rows={2}
              placeholder="Add details…"
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() => {
                  const next = dueDate.trim();
                  const prev = task.due_date ?? "";
                  if (next !== prev) onPatch({ due_date: next || null });
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={task.status}
                onChange={(e) => onPatch({ status: e.target.value })}
                className={inputClass}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {overdue && (
            <p className="text-xs font-medium text-[var(--color-coral)]">
              Overdue or open longer than a week
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 self-start rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] hover:border-red-300 hover:text-red-600 sm:self-auto"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
