"use client";

import { useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import { formatMirrorDueLabel } from "./mirrorTasks";

type Props = {
  open: boolean;
  tasks: TaskRow[];
  now: Date;
  busyId: number | null;
  message: string | null;
  onClose: () => void;
  onComplete: (task: TaskRow) => void;
  onAdd: (title: string) => Promise<void> | void;
};

export default function MirrorTasksOverlay({
  open,
  tasks,
  now,
  busyId,
  message,
  onClose,
  onComplete,
  onAdd,
}: Props) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const submitAdd = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await onAdd(title);
      setDraft("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mirror-tasks" role="dialog" aria-modal="true" aria-label="Due tasks">
      <header className="mirror-tasks__header">
        <div>
          <p className="mirror-tasks__eyebrow">Due today</p>
          <h1 className="mirror-tasks__title">
            {tasks.length === 0 ? "No due tasks" : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          </h1>
        </div>
        <button type="button" className="mirror-tasks__close" onClick={onClose} aria-label="Close tasks">
          ×
        </button>
      </header>

      <form
        className="mirror-tasks__add"
        onSubmit={(e) => {
          e.preventDefault();
          void submitAdd();
        }}
      >
        <input
          className="mirror-tasks__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task due today…"
          enterKeyHint="done"
          autoComplete="off"
          disabled={adding}
        />
        <button
          type="submit"
          className="mirror-tasks__add-btn"
          disabled={adding || !draft.trim()}
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {message ? <p className="mirror-tasks__message">{message}</p> : null}

      {tasks.length === 0 ? (
        <p className="mirror-tasks__empty">You're clear for today. Add something above if you need it.</p>
      ) : (
        <ul className="mirror-tasks__list">
          {tasks.map((task) => {
            const busy = busyId === task.id;
            return (
              <li key={task.id} className="mirror-tasks__item">
                <div className="mirror-tasks__item-body">
                  <p className="mirror-tasks__item-title">{task.title}</p>
                  <p className="mirror-tasks__item-meta">
                    {formatMirrorDueLabel(task, now)}
                    {task.assignee ? ` · ${task.assignee}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="mirror-tasks__done"
                  onClick={() => onComplete(task)}
                  disabled={busy}
                >
                  {busy ? "…" : "Done"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mirror-tasks__footer">
        <a className="mirror-tasks__board-link" href="/tasks">
          Open full task board
        </a>
        <p className="mirror-tasks__hint">
          Say “close tasks”, “go home”, or “mark [task] done”
        </p>
      </div>
    </div>
  );
}
