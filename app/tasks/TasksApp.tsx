"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/data/tasks";

type Props = { initialTasks: TaskRow[] };

export default function TasksApp({ initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [title, setTitle] = useState("");
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
        body: JSON.stringify({ title: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not add task");
        return;
      }
      setTitle("");
      if (data.task) setTasks((prev) => [...prev, data.task]);
      else await refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(task: TaskRow) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x))
      );
    }
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

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {tasks.length === 0 ? "No tasks yet." : `${tasks.filter((t) => !t.done).length} open`}
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

      <form onSubmit={addTask} className="mt-8 flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          className={inputClass}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="shrink-0 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-8 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-4 py-3 ring-1 ring-[var(--color-border)]"
          >
            <button
              type="button"
              onClick={() => void toggleDone(task)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-white text-sm hover:border-[var(--color-accent)]"
              aria-label={task.done ? "Mark incomplete" : "Mark complete"}
            >
              {task.done ? "✓" : ""}
            </button>
            <span
              className={`min-w-0 flex-1 text-left ${
                task.done ? "text-[var(--color-muted)] line-through" : "text-[var(--color-ink)]"
              }`}
            >
              {task.title}
            </span>
            <button
              type="button"
              onClick={() => void remove(task.id)}
              className="shrink-0 text-sm text-[var(--color-muted)] hover:text-red-600"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
