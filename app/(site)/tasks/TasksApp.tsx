"use client";

import {
  Fragment,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  type SubtaskRow,
  type TaskSectionRow,
  type TaskRow,
  type TaskPriority,
  type TaskStatus,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  isTaskOverdue,
} from "@/lib/data/taskClientTypes";

type Props = { initialTasks: TaskRow[]; initialSections: TaskSectionRow[] };

async function parseJson<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function sectionDotClass(colorKey: string): string {
  switch (colorKey) {
    case "red":
      return "bg-red-500";
    case "yellow":
      return "bg-amber-400";
    case "green":
      return "bg-emerald-500";
    case "blue":
      return "bg-sky-500";
    default:
      return "bg-stone-400";
  }
}

function priorityDotClass(p: TaskPriority): string {
  switch (p) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-amber-400";
    case "low":
      return "bg-emerald-500";
    default:
      return "bg-stone-300";
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === mo - 1 &&
      dt.getDate() === d
    ) {
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return "—";
}

function formatCellDateTime(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return formatShortDate(trimmed);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

/** All `TaskRow` fields as table columns (order matches data model). */
const TASK_TABLE_KEYS: (keyof TaskRow)[] = [
  "id",
  "title",
  "description",
  "due_date",
  "status",
  "sort_order",
  "created_at",
  "last_overdue_email_at",
  "section_id",
  "section_name",
  "assignee",
  "priority",
  "estimated_minutes",
  "actual_minutes",
  "dependencies",
  "requester",
  "quarter",
  "project_label",
  "subtask_count",
];

const TASK_TABLE_LABELS: Record<keyof TaskRow, string> = {
  id: "ID",
  title: "Title",
  description: "Description",
  due_date: "Due",
  status: "Status",
  sort_order: "Order",
  created_at: "Created",
  last_overdue_email_at: "Overdue email",
  section_id: "Sec. ID",
  section_name: "Section",
  assignee: "Assignee",
  priority: "Priority",
  estimated_minutes: "Est. min",
  actual_minutes: "Act. min",
  dependencies: "Dependencies",
  requester: "Requester",
  quarter: "Quarter",
  project_label: "Project",
  subtask_count: "Sub #",
};

const TASK_TABLE_HIDDEN_STORAGE_KEY = "annsymons.tasks.tableHiddenColumns.v1";
const TASK_FILTERS_COLLAPSED_STORAGE_KEY = "annsymons.tasks.filtersCollapsed.v1";

/** Respects saved preference; if unset, default collapsed on small viewports so the list stays visible. */
function readFiltersCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(TASK_FILTERS_COLLAPSED_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  } catch {
    return false;
  }
}

/** Single column kept visible when using "Deselect all" (minimum one data column required). */
const TASK_TABLE_DESELECT_ALL_KEEP: keyof TaskRow = "title";

const MIN_TASK_COL_PX = 48;
const MAX_TASK_COL_PX = 640;

function loadHiddenTaskColumnsFromStorage(): (keyof TaskRow)[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASK_TABLE_HIDDEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<string>(TASK_TABLE_KEYS as readonly string[]);
    const out: (keyof TaskRow)[] = [];
    for (const x of parsed) {
      if (typeof x === "string" && allowed.has(x)) out.push(x as keyof TaskRow);
    }
    return out;
  } catch {
    return [];
  }
}

function compareTaskColumn(a: TaskRow, b: TaskRow, key: keyof TaskRow): number {
  const va = a[key];
  const vb = b[key];
  const emptyA = va == null || va === "";
  const emptyB = vb == null || vb === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  if (key === "priority") {
    return (
      TASK_PRIORITIES.indexOf(va as TaskPriority) -
      TASK_PRIORITIES.indexOf(vb as TaskPriority)
    );
  }
  return String(va).localeCompare(String(vb), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function taskTableDataCell(task: TaskRow, key: keyof TaskRow): ReactNode {
  const v = task[key];
  switch (key) {
    case "due_date":
      return formatShortDate(v as string | null);
    case "created_at":
    case "last_overdue_email_at":
      return formatCellDateTime(v as string | null | undefined);
    case "description":
    case "dependencies":
      return (
        <span className="block max-w-[12rem] truncate align-middle" title={(v as string) || undefined}>
          {(v as string | null) ?? "—"}
        </span>
      );
    case "priority":
      return (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${priorityDotClass(v as TaskPriority)}`}
          />
          {TASK_PRIORITY_LABELS[v as TaskPriority]}
        </span>
      );
    case "status":
      return TASK_STATUS_LABELS[v as TaskStatus] ?? String(v);
    case "subtask_count":
      return String(v ?? 0);
    default:
      return String(v);
  }
}

/** Plain text for a column, aligned with `taskTableDataCell` (used to auto-fit width). */
function taskFieldPlainTextForMeasure(task: TaskRow, key: keyof TaskRow): string {
  const v = task[key];
  switch (key) {
    case "due_date":
      return formatShortDate(v as string | null);
    case "created_at":
    case "last_overdue_email_at":
      return formatCellDateTime(v as string | null | undefined);
    case "description":
    case "dependencies":
      return (v as string | null) == null || v === "" ? "—" : String(v);
    case "priority":
      return TASK_PRIORITY_LABELS[v as TaskPriority];
    case "status":
      return TASK_STATUS_LABELS[v as TaskStatus] ?? String(v);
    case "subtask_count":
      return String(v ?? 0);
    default:
      if (v == null || v === "") return "—";
      return String(v);
  }
}

function measureTaskColumnAutoWidth(
  col: keyof TaskRow,
  tasks: TaskRow[],
  headerLabel: string
): number {
  if (typeof document === "undefined") return MIN_TASK_COL_PX;
  const samples: string[] = [headerLabel];
  for (const t of tasks) {
    samples.push(taskFieldPlainTextForMeasure(t, col));
  }
  const el = document.createElement("span");
  el.setAttribute("class", "whitespace-nowrap text-sm");
  el.style.cssText =
    "position:absolute;left:-9999px;top:0;white-space:nowrap;padding:0 0.5rem;font-size:0.875rem";
  document.body.appendChild(el);
  let max = 0;
  for (const s of samples) {
    el.textContent = s;
    const w = el.getBoundingClientRect().width;
    if (w > max) max = w;
  }
  document.body.removeChild(el);
  let n = Math.ceil(max) + 2;
  if (col === "priority") {
    n += 20;
  }
  return Math.max(MIN_TASK_COL_PX, Math.min(MAX_TASK_COL_PX, n));
}

/** Case-insensitive substring search across common task text fields. */
function taskMatchesSearchQuery(task: TaskRow, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    task.title,
    task.description,
    task.assignee,
    task.requester,
    task.project_label,
    task.quarter,
    task.dependencies,
    task.section_name,
    String(task.id),
    TASK_STATUS_LABELS[task.status],
    TASK_PRIORITY_LABELS[task.priority],
  ]
    .filter((x): x is string => x != null && String(x).length > 0)
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

function SortableTaskTh({
  colKey,
  label,
  sort,
  onSort,
  className,
  widthPx,
  onResizePointerDown,
  onColumnAutoFit,
}: {
  colKey: keyof TaskRow;
  label: string;
  sort: { key: keyof TaskRow; dir: "asc" | "desc" } | null;
  onSort: (k: keyof TaskRow) => void;
  className?: string;
  widthPx?: number;
  onResizePointerDown: (e: ReactPointerEvent<HTMLDivElement>, col: keyof TaskRow) => void;
  onColumnAutoFit: (col: keyof TaskRow) => void;
}) {
  const active = sort?.key === colKey;
  const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`relative isolate border-r-2 border-stone-500 bg-stone-50 ${className ?? ""}`.trim()}
      style={
        widthPx != null
          ? { width: widthPx, minWidth: widthPx, maxWidth: widthPx, boxSizing: "border-box" }
          : undefined
      }
    >
      <button
        type="button"
        className="relative z-0 flex min-h-9 w-[calc(100%-0.75rem)] min-w-0 max-w-[calc(100%-0.75rem)] items-center gap-0.5 pr-0.5 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-stone-600 hover:bg-stone-100 hover:text-stone-900 whitespace-nowrap"
        onClick={() => onSort(colKey)}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {active ? <span className="shrink-0 tabular-nums">{sort!.dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
      {/* Inset shadow + th border = visible “fat” rule; hit target is solid so it can’t be washed out */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize or auto-fit ${label} column`}
        title="Drag the bar to resize. Double-click to auto-fit to content."
        onPointerDown={(e) => onResizePointerDown(e, colKey)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onColumnAutoFit(colKey);
        }}
        className="pointer-events-auto absolute right-0 top-0 z-[100] w-2.5 min-h-9 touch-none select-none bg-stone-800 hover:bg-sky-600"
        style={{
          bottom: 0,
          touchAction: "none",
          cursor: "col-resize",
        }}
      />
    </th>
  );
}

export default function TasksApp({ initialTasks, initialSections }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [sections, setSections] = useState<TaskSectionRow[]>(initialSections);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const selectionAnchorRef = useRef<number | null>(null);
  const bulkBarRef = useRef<HTMLDivElement | null>(null);
  const [bulkPanel, setBulkPanel] = useState<null | "section" | "assignee" | "date" | "more">(null);
  const [bulkAssigneeDraft, setBulkAssigneeDraft] = useState("");
  const [bulkDueDraft, setBulkDueDraft] = useState("");
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [quickAdds, setQuickAdds] = useState<Record<number, string>>({});
  const [subtaskDraft, setSubtaskDraft] = useState("");
  /** When true, detail pane is hidden on large screens; task stays selected. */
  const [detailsMinimized, setDetailsMinimized] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<number | null>(null);
  const draggingTaskIdRef = useRef<number | null>(null);
  /** When false, tasks with status "done" are omitted from the list (still in data). */
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | TaskStatus>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | TaskPriority>("all");
  const [filterSectionId, setFilterSectionId] = useState<"all" | number>("all");
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  /** Per-section list sort: click column header to sort, again to reverse. */
  const [taskTableSort, setTaskTableSort] = useState<{
    key: keyof TaskRow;
    dir: "asc" | "desc";
  } | null>(null);
  const [inlineSubExpanded, setInlineSubExpanded] = useState<Record<number, boolean>>({});
  const [inlineSubtasksByTask, setInlineSubtasksByTask] = useState<Record<number, SubtaskRow[]>>({});
  const [inlineSubLoading, setInlineSubLoading] = useState<Record<number, boolean>>({});
  const inlineSubFetchedRef = useRef<Set<number>>(new Set());
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  /** Hidden data columns (drag / done / sub stay always visible). New fields default to visible. */
  const [hiddenTaskColumns, setHiddenTaskColumns] = useState<(keyof TaskRow)[]>([]);
  const [taskColumnsHydrated, setTaskColumnsHydrated] = useState(false);
  /** When true, search + filter row is collapsed so the task list uses more vertical space. */
  const [filtersBarCollapsed, setFiltersBarCollapsed] = useState(false);
  const [filtersBarHydrated, setFiltersBarHydrated] = useState(false);
  /** Per-column width in px (session only; not persisted). */
  const [taskColumnWidths, setTaskColumnWidths] = useState<Partial<Record<keyof TaskRow, number>>>(
    {}
  );
  const taskColumnWidthsRef = useRef<Partial<Record<keyof TaskRow, number>>>({});
  const resizingTaskColRef = useRef<keyof TaskRow | null>(null);
  const taskResizeStartXRef = useRef(0);
  const taskResizeStartWRef = useRef(0);
  taskColumnWidthsRef.current = taskColumnWidths;

  const visibleTaskTableKeys = useMemo(() => {
    const hidden = new Set(hiddenTaskColumns);
    const next = TASK_TABLE_KEYS.filter((k) => !hidden.has(k));
    return next.length > 0 ? next : [...TASK_TABLE_KEYS];
  }, [hiddenTaskColumns]);

  const taskTableColspan = 3 + visibleTaskTableKeys.length;

  const selectedId = useMemo(
    () => (selectedTaskIds.length === 1 ? selectedTaskIds[0]! : null),
    [selectedTaskIds]
  );

  const selected = useMemo(
    () => (selectedId == null ? null : tasks.find((t) => t.id === selectedId) ?? null),
    [tasks, selectedId]
  );

  const multiSelectCount = selectedTaskIds.length;
  const showBulkBar = multiSelectCount > 1;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/list");
      if (!res.ok) return;
      const data = await parseJson<{ tasks?: TaskRow[]; sections?: TaskSectionRow[] }>(res);
      if (!data) return;
      setTasks(data.tasks ?? []);
      setSections(data.sections ?? []);
      inlineSubFetchedRef.current = new Set();
      setInlineSubtasksByTask({});
      setInlineSubExpanded({});
      setInlineSubLoading({});
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setTasks(initialTasks);
    setSections(initialSections);
  }, [initialTasks, initialSections]);

  useEffect(() => {
    if (selectedId == null) {
      setSubtasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tasks/${selectedId}/subtasks`);
        if (!res.ok || cancelled) return;
        const data = await parseJson<{ subtasks?: SubtaskRow[] }>(res);
        if (!cancelled) setSubtasks(data?.subtasks ?? []);
      } catch {
        if (!cancelled) setSubtasks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  /** Desktop: show detail pane when a single task is selected. Mobile/tablet: keep the list visible until "Task details" is used. */
  useEffect(() => {
    if (selectedId == null) return;
    const wide =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    setDetailsMinimized(!wide);
  }, [selectedId]);

  useEffect(() => {
    if (!showCompleted && selectedId != null) {
      const t = tasks.find((x) => x.id === selectedId);
      if (t?.status === "done") setSelectedTaskIds([]);
    }
  }, [showCompleted, tasks, selectedId]);

  useEffect(() => {
    if (bulkPanel == null) return;
    const close = (ev: MouseEvent) => {
      if (bulkBarRef.current && !bulkBarRef.current.contains(ev.target as Node)) {
        setBulkPanel(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [bulkPanel]);

  useLayoutEffect(() => {
    setHiddenTaskColumns(loadHiddenTaskColumnsFromStorage());
    setTaskColumnsHydrated(true);
  }, []);

  useEffect(() => {
    setFiltersBarCollapsed(readFiltersCollapsedPreference());
    setFiltersBarHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersBarHydrated) return;
    try {
      localStorage.setItem(
        TASK_FILTERS_COLLAPSED_STORAGE_KEY,
        filtersBarCollapsed ? "1" : "0"
      );
    } catch {
      /* storage full or disabled */
    }
  }, [filtersBarCollapsed, filtersBarHydrated]);

  useEffect(() => {
    if (!taskColumnsHydrated) return;
    try {
      localStorage.setItem(TASK_TABLE_HIDDEN_STORAGE_KEY, JSON.stringify(hiddenTaskColumns));
    } catch {
      /* storage full or disabled */
    }
  }, [hiddenTaskColumns, taskColumnsHydrated]);

  useEffect(() => {
    if (!columnsPanelOpen) return;
    const close = (ev: MouseEvent) => {
      if (columnsPanelRef.current && !columnsPanelRef.current.contains(ev.target as Node)) {
        setColumnsPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [columnsPanelOpen]);

  useEffect(() => {
    setTaskTableSort((sort) =>
      sort != null && !visibleTaskTableKeys.includes(sort.key) ? null : sort
    );
  }, [visibleTaskTableKeys]);

  const toggleTaskColumnVisibility = useCallback((key: keyof TaskRow) => {
    setHiddenTaskColumns((prev) => {
      const s = new Set(prev);
      if (s.has(key)) {
        s.delete(key);
      } else {
        const nextHidden = new Set(s);
        nextHidden.add(key);
        if (TASK_TABLE_KEYS.length - nextHidden.size < 1) return prev;
        s.add(key);
      }
      return Array.from(s);
    });
  }, []);

  const showAllTaskTableColumns = useCallback(() => {
    setHiddenTaskColumns([]);
  }, []);

  const clearTaskFilters = useCallback(() => {
    setTaskSearchQuery("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterSectionId("all");
    setFilterOverdueOnly(false);
  }, []);

  const deselectAllTaskTableColumns = useCallback(() => {
    setHiddenTaskColumns(
      TASK_TABLE_KEYS.filter((k) => k !== TASK_TABLE_DESELECT_ALL_KEEP)
    );
  }, []);

  function replaceTask(updated: TaskRow) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  const adjustSubtaskCount = useCallback((taskId: number, delta: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtask_count: Math.max(0, (t.subtask_count ?? 0) + delta) }
          : t
      )
    );
  }, []);

  const ensureInlineSubtasksLoaded = useCallback(async (taskId: number) => {
    if (inlineSubFetchedRef.current.has(taskId)) return;
    setInlineSubLoading((l) => ({ ...l, [taskId]: true }));
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`);
      const data = await parseJson<{ subtasks?: SubtaskRow[] }>(res);
      if (res.ok && data) {
        inlineSubFetchedRef.current.add(taskId);
        setInlineSubtasksByTask((s) => ({ ...s, [taskId]: data.subtasks ?? [] }));
      }
    } finally {
      setInlineSubLoading((l) => ({ ...l, [taskId]: false }));
    }
  }, []);

  function toggleInlineSubtasksRow(taskId: number, e?: React.MouseEvent<HTMLElement>) {
    e?.stopPropagation();
    setInlineSubExpanded((prev) => {
      const nextOpen = !prev[taskId];
      if (nextOpen) void ensureInlineSubtasksLoaded(taskId);
      return { ...prev, [taskId]: nextOpen };
    });
  }

  async function patchTask(id: number, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await parseJson<{ task?: TaskRow }>(res);
      if (res.ok && data?.task) replaceTask(data.task);
    } catch {
      /* network / parse */
    }
  }

  async function logout() {
    try {
      await fetch("/api/tasks/logout", { method: "POST" });
    } catch {
      /* still navigate */
    }
    router.push("/tasks/login");
    router.refresh();
  }

  function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    void submitNewSection();
  }

  async function submitNewSection() {
    const n = newSectionName.trim();
    if (!n) return;
    try {
      const res = await fetch("/api/tasks/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await parseJson<{ section?: TaskSectionRow }>(res);
      if (res.ok && data?.section) {
        setSections((prev) =>
          [...prev, data.section!].sort((a, b) => a.sort_order - b.sort_order)
        );
        setNewSectionName("");
      }
    } catch {
      /* ignore */
    }
  }

  async function quickAddTask(sectionId: number) {
    const title = (quickAdds[sectionId] ?? "").trim();
    if (!title) return;
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, section_id: sectionId, status: "todo" }),
      });
      const data = await parseJson<{ task?: TaskRow }>(res);
      if (res.ok && data?.task) {
        setTasks((prev) => [...prev, data.task!]);
        setQuickAdds((q) => ({ ...q, [sectionId]: "" }));
      }
    } catch {
      /* ignore */
    }
  }

  async function addSubtask() {
    if (selectedId == null) return;
    const t = subtaskDraft.trim();
    if (!t) return;
    try {
      const res = await fetch(`/api/tasks/${selectedId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const data = await parseJson<{ subtask?: SubtaskRow }>(res);
      if (res.ok && data?.subtask && selectedId != null) {
        const sub = data.subtask;
        setSubtasks((prev) => [...prev, sub]);
        setSubtaskDraft("");
        adjustSubtaskCount(selectedId, 1);
        inlineSubFetchedRef.current.add(selectedId);
        setInlineSubtasksByTask((s) => ({
          ...s,
          [selectedId]: [...(s[selectedId] ?? []), sub],
        }));
      }
    } catch {
      /* ignore */
    }
  }

  async function toggleSubtask(sub: SubtaskRow) {
    try {
      const res = await fetch(`/api/tasks/subtasks/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !sub.done }),
      });
      const data = await parseJson<{ subtask?: SubtaskRow }>(res);
      if (res.ok && data?.subtask) {
        const updated = data.subtask;
        setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
        const tid = sub.task_id;
        setInlineSubtasksByTask((prev) => {
          const list = prev[tid];
          if (!list) return prev;
          return { ...prev, [tid]: list.map((s) => (s.id === sub.id ? updated : s)) };
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function removeSubtask(id: number, parentTaskId: number) {
    let res: Response;
    try {
      res = await fetch(`/api/tasks/subtasks/${id}`, { method: "DELETE" });
    } catch {
      return;
    }
    if (!res.ok) return;
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    setTasks((prev) => {
      const cur = prev.find((t) => t.id === parentTaskId)?.subtask_count ?? 0;
      const newCount = Math.max(0, cur - 1);
      if (newCount === 0) {
        queueMicrotask(() => {
          inlineSubFetchedRef.current.delete(parentTaskId);
          setInlineSubExpanded((e) => ({ ...e, [parentTaskId]: false }));
        });
      }
      return prev.map((t) =>
        t.id === parentTaskId ? { ...t, subtask_count: newCount } : t
      );
    });
    setInlineSubtasksByTask((prev) => {
      const list = prev[parentTaskId];
      if (!list) return prev;
      return { ...prev, [parentTaskId]: list.filter((s) => s.id !== id) };
    });
  }

  async function renameSubtask(sub: SubtaskRow, title: string) {
    try {
      const res = await fetch(`/api/tasks/subtasks/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await parseJson<{ subtask?: SubtaskRow }>(res);
      if (res.ok && data?.subtask) {
        const updated = data.subtask;
        setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
        const tid = sub.task_id;
        setInlineSubtasksByTask((prev) => {
          const list = prev[tid];
          if (!list) return prev;
          return { ...prev, [tid]: list.map((s) => (s.id === sub.id ? updated : s)) };
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function deleteTask(id: number) {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setSelectedTaskIds((prev) => prev.filter((x) => x !== id));
      }
    } catch {
      /* ignore */
    }
  }

  async function bulkPatchSelected(patch: Record<string, unknown>) {
    const ids = [...selectedTaskIds];
    try {
      await Promise.all(ids.map((id) => patchTask(id, patch)));
    } finally {
      setBulkPanel(null);
    }
  }

  async function bulkDeleteSelected() {
    const ids = [...selectedTaskIds];
    if (
      !window.confirm(
        `Delete ${ids.length} tasks? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      for (const id of ids) {
        try {
          const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
          if (res.ok) {
            setTasks((prev) => prev.filter((t) => t.id !== id));
          }
        } catch {
          /* next id */
        }
      }
    } finally {
      setSelectedTaskIds([]);
      setBulkPanel(null);
    }
  }

  function parseDragTaskId(e: React.DragEvent): number | null {
    const json = e.dataTransfer.getData("application/json");
    if (json) {
      try {
        const parsed = JSON.parse(json) as { taskId?: unknown };
        const id = Number(parsed?.taskId);
        if (Number.isFinite(id)) return id;
      } catch {
        /* fall through */
      }
    }
    const plain = e.dataTransfer.getData("text/plain");
    if (plain) {
      const id = Number(plain.trim());
      if (Number.isFinite(id)) return id;
    }
    return null;
  }

  function sectionDragLeave(e: React.DragEvent, sectionId: number) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverSectionId((prev) => (prev === sectionId ? null : prev));
  }

  async function dropTaskOnSection(e: React.DragEvent, targetSectionId: number) {
    e.preventDefault();
    e.stopPropagation();
    draggingTaskIdRef.current = null;
    setDragOverSectionId(null);
    setDraggingTaskId(null);
    const taskId = parseDragTaskId(e);
    if (taskId == null) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.section_id === targetSectionId) return;
    await patchTask(taskId, { section_id: targetSectionId });
  }

  const visibleTasks = useMemo(() => {
    if (showCompleted) return tasks;
    return tasks.filter((t) => t.status !== "done");
  }, [tasks, showCompleted]);

  const hasActiveTaskFilters = useMemo(
    () =>
      taskSearchQuery.trim() !== "" ||
      filterStatus !== "all" ||
      filterPriority !== "all" ||
      filterSectionId !== "all" ||
      filterOverdueOnly,
    [taskSearchQuery, filterStatus, filterPriority, filterSectionId, filterOverdueOnly]
  );

  const filteredTasks = useMemo(() => {
    let list = visibleTasks;
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus);
    if (filterPriority !== "all") list = list.filter((t) => t.priority === filterPriority);
    if (filterSectionId !== "all") list = list.filter((t) => t.section_id === filterSectionId);
    if (filterOverdueOnly) list = list.filter((t) => isTaskOverdue(t));
    list = list.filter((t) => taskMatchesSearchQuery(t, taskSearchQuery));
    return list;
  }, [
    visibleTasks,
    filterStatus,
    filterPriority,
    filterSectionId,
    filterOverdueOnly,
    taskSearchQuery,
  ]);

  const filtersCollapsedSummary = useMemo(() => {
    const parts: string[] = [];
    const q = taskSearchQuery.trim();
    if (q) {
      const short = q.length > 28 ? `${q.slice(0, 28)}…` : q;
      parts.push(`Search: “${short}”`);
    }
    if (filterStatus !== "all") parts.push(TASK_STATUS_LABELS[filterStatus]);
    if (filterPriority !== "all") parts.push(TASK_PRIORITY_LABELS[filterPriority]);
    if (filterSectionId !== "all") {
      const sec = sections.find((s) => s.id === filterSectionId);
      if (sec) parts.push(sec.name);
    }
    if (filterOverdueOnly) parts.push("Overdue only");
    if (parts.length === 0) return "No filters";
    return parts.join(" · ");
  }, [
    taskSearchQuery,
    filterStatus,
    filterPriority,
    filterSectionId,
    filterOverdueOnly,
    sections,
  ]);

  const tasksBySection = useMemo(() => {
    const m = new Map<number, TaskRow[]>();
    for (const s of sections) m.set(s.id, []);
    for (const t of filteredTasks) {
      const list = m.get(t.section_id);
      if (list) list.push(t);
      else m.set(t.section_id, [t]);
    }
    return m;
  }, [filteredTasks, sections]);

  const toggleTaskColumnSort = useCallback((key: keyof TaskRow) => {
    setTaskTableSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }, []);

  const onTaskColumnAutoFit = useCallback((col: keyof TaskRow) => {
    const w = measureTaskColumnAutoWidth(col, filteredTasks, TASK_TABLE_LABELS[col]);
    setTaskColumnWidths((prev) => ({ ...prev, [col]: w }));
  }, [filteredTasks]);

  const onTaskColumnResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, col: keyof TaskRow) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const th = e.currentTarget.closest("th");
      const measured = th?.getBoundingClientRect().width;
      const startW =
        taskColumnWidthsRef.current[col] ??
        (measured != null && !Number.isNaN(measured) && measured > 0 ? measured : 120);
      const startX = e.clientX;
      const DRAG_THRESHOLD = 3;
      let dragActive = false;

      const onMove = (ev: PointerEvent) => {
        if (!dragActive) {
          if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD) return;
          dragActive = true;
          resizingTaskColRef.current = col;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }
        const next = Math.round(
          Math.max(
            MIN_TASK_COL_PX,
            Math.min(MAX_TASK_COL_PX, startW + (ev.clientX - startX))
          )
        );
        setTaskColumnWidths((prev) => {
          if (prev[col] === next) return prev;
          return { ...prev, [col]: next };
        });
      };
      const onUp = () => {
        if (dragActive) {
          resizingTaskColRef.current = null;
          document.body.style.removeProperty("cursor");
          document.body.style.removeProperty("user-select");
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    []
  );

  const tasksBySectionSorted = useMemo(() => {
    if (!taskTableSort) return tasksBySection;
    const mul = taskTableSort.dir === "asc" ? 1 : -1;
    const m = new Map<number, TaskRow[]>();
    for (const [sectionId, list] of tasksBySection) {
      m.set(
        sectionId,
        [...list].sort((a, b) => mul * compareTaskColumn(a, b, taskTableSort.key))
      );
    }
    return m;
  }, [tasksBySection, taskTableSort]);

  const orderedVisibleTaskIds = useMemo(() => {
    const ids: number[] = [];
    for (const sec of sections) {
      const list = tasksBySectionSorted.get(sec.id) ?? [];
      for (const t of list) ids.push(t.id);
    }
    return ids;
  }, [sections, tasksBySectionSorted]);

  const handleTaskRowClick = useCallback(
    (taskId: number, e: React.MouseEvent<HTMLTableRowElement>) => {
      if (e.shiftKey) {
        const anchor = selectionAnchorRef.current;
        const order = orderedVisibleTaskIds;
        const iCur = order.indexOf(taskId);
        if (iCur < 0) return;
        const iAnchor = anchor != null ? order.indexOf(anchor) : iCur;
        const i0 = iAnchor < 0 ? iCur : Math.min(iAnchor, iCur);
        const i1 = iAnchor < 0 ? iCur : Math.max(iAnchor, iCur);
        setSelectedTaskIds(order.slice(i0, i1 + 1));
        if (anchor == null) selectionAnchorRef.current = taskId;
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        setSelectedTaskIds((prev) => {
          if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
          return [...prev, taskId];
        });
        selectionAnchorRef.current = taskId;
        return;
      }
      selectionAnchorRef.current = taskId;
      setSelectedTaskIds([taskId]);
    },
    [orderedVisibleTaskIds]
  );

  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;

  const shell =
    "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-stone-50 text-stone-900 antialiased";
  const input =
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:text-sm";
  const filterSelect = `${input} w-full min-w-0 sm:w-auto sm:min-w-[7.5rem] sm:max-w-[11rem]`;
  const label = "text-xs font-medium text-stone-500";

  if (sections.length === 0) {
    return (
      <div className={`${shell} items-center justify-center p-8`}>
        <div className="max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <p className="text-stone-600">
            Tasks need database setup. In Neon, run{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-800">
              db/migrate-tasks-asana-layout.sql
            </code>{" "}
            (or use a fresh{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-800">
              create-tasks-table.sql
            </code>
            ).
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showDetailPane =
    Boolean(selected) && selectedTaskIds.length === 1 && !detailsMinimized;

  return (
    <div className={shell}>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-t border-stone-200">
        {/* List pane — grows to full width when detail pane is minimized */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold text-stone-900">My tasks</h1>
              <p className="text-xs text-stone-500">
                {hasActiveTaskFilters ? (
                  <>
                    <span className="font-medium text-stone-700">
                      {filteredTasks.length} matching
                    </span>
                    {" · "}
                    {visibleTasks.length} in list ·{" "}
                  </>
                ) : null}
                {openCount} open ·{" "}
                <span className="hidden text-stone-400 md:inline">
                  Ctrl/⌘+click or Shift+click to select multiple · drag{" "}
                  <span className="whitespace-nowrap">⋮⋮</span> between sections
                </span>
                <span className="text-stone-400 md:hidden">Tap a task for details</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected && selectedTaskIds.length === 1 && detailsMinimized && (
                <button
                  type="button"
                  onClick={() => setDetailsMinimized(false)}
                  className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 shadow-sm hover:bg-sky-100"
                >
                  <span className="lg:hidden">Task details</span>
                  <span className="hidden lg:inline">Show details</span>
                </button>
              )}
              <span className="hidden rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600 sm:inline">
                List
              </span>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
              >
                {showCompleted ? "Hide completed" : "Show completed"}
              </button>
              <div className="relative" ref={columnsPanelRef}>
                <button
                  type="button"
                  onClick={() => setColumnsPanelOpen((o) => !o)}
                  title="Choose which columns appear in the list. Your selection is saved in this browser."
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm ${
                    columnsPanelOpen
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                  aria-expanded={columnsPanelOpen}
                  aria-haspopup="true"
                >
                  Columns
                </button>
                {columnsPanelOpen ? (
                  <div
                    className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,18rem)] rounded-lg border border-stone-200 bg-white py-2 shadow-lg"
                    role="dialog"
                    aria-label="Choose visible columns"
                  >
                    <div className="border-b border-stone-100 px-3 pb-2">
                      <p className="text-xs font-medium text-stone-500">Visible fields</p>
                      <p className="mt-0.5 text-[0.65rem] text-stone-400">
                        At least one column stays on. “Deselect all” keeps Title only.
                      </p>
                      <p className="mt-1.5 text-[0.65rem] text-sky-700/90">
                        Your choices are saved in this browser and load automatically next time.
                      </p>
                    </div>
                    <ul className="max-h-[min(70vh,22rem)] overflow-y-auto px-2 pt-2">
                      {TASK_TABLE_KEYS.map((k) => {
                        const checked = visibleTaskTableKeys.includes(k);
                        const onlyOne = visibleTaskTableKeys.length === 1 && checked;
                        return (
                          <li key={k}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-stone-800 hover:bg-stone-50">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={onlyOne}
                                onChange={() => toggleTaskColumnVisibility(k)}
                                className="rounded border-stone-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className="min-w-0 flex-1">{TASK_TABLE_LABELS[k]}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex flex-col gap-1 border-t border-stone-100 px-2 pt-2">
                      <button
                        type="button"
                        onClick={() => deselectAllTaskTableColumns()}
                        title={`Hide all columns except ${TASK_TABLE_LABELS[TASK_TABLE_DESELECT_ALL_KEEP]}`}
                        className="w-full rounded-md py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
                      >
                        Deselect all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          showAllTaskTableColumns();
                          setColumnsPanelOpen(false);
                        }}
                        className="w-full rounded-md py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                      >
                        Show all columns
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm hover:bg-stone-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm hover:bg-stone-50"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="shrink-0 border-b border-stone-200 bg-white">
            <div className="px-4 py-2 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setFiltersBarCollapsed((c) => !c)}
                className="flex min-h-10 w-full touch-manipulation items-center gap-2 rounded-md py-1.5 text-left text-sm text-stone-800 hover:bg-stone-50"
                aria-expanded={!filtersBarCollapsed}
                aria-controls="task-filters-panel"
                aria-label={
                  filtersBarCollapsed
                    ? "Expand search and filters"
                    : "Minimize search and filters"
                }
              >
                <span className="shrink-0 text-stone-400" aria-hidden>
                  {filtersBarCollapsed ? "▸" : "▾"}
                </span>
                <span className="shrink-0 font-medium">Search & filters</span>
                {filtersBarCollapsed ? (
                  <span className="min-w-0 truncate text-xs font-normal text-stone-500">
                    · {filtersCollapsedSummary}
                    {hasActiveTaskFilters ? (
                      <span className="whitespace-nowrap text-stone-600">
                        {" "}
                        · {filteredTasks.length} matching
                      </span>
                    ) : (
                      <span className="whitespace-nowrap text-stone-500">
                        {" "}
                        · {filteredTasks.length} in list
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="ml-auto shrink-0 text-xs font-medium text-stone-500">
                    Minimize
                  </span>
                )}
              </button>
            </div>
            {!filtersBarCollapsed ? (
              <div
                id="task-filters-panel"
                className="border-t border-stone-100 px-4 py-2.5 sm:px-6 lg:px-8"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-md">
                    <label htmlFor="task-search" className={`${label} mb-0.5 block`}>
                      Search
                    </label>
                    <input
                      id="task-search"
                      type="search"
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      placeholder="Title, assignee, notes, ID…"
                      className={input}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="task-filter-status" className={`${label} mb-0.5 block`}>
                      Status
                    </label>
                    <select
                      id="task-filter-status"
                      value={filterStatus}
                      onChange={(e) =>
                        setFilterStatus(e.target.value === "all" ? "all" : (e.target.value as TaskStatus))
                      }
                      className={filterSelect}
                    >
                      <option value="all">All</option>
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-filter-priority" className={`${label} mb-0.5 block`}>
                      Priority
                    </label>
                    <select
                      id="task-filter-priority"
                      value={filterPriority}
                      onChange={(e) =>
                        setFilterPriority(
                          e.target.value === "all" ? "all" : (e.target.value as TaskPriority)
                        )
                      }
                      className={filterSelect}
                    >
                      <option value="all">All</option>
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-filter-section" className={`${label} mb-0.5 block`}>
                      Section
                    </label>
                    <select
                      id="task-filter-section"
                      value={filterSectionId === "all" ? "all" : String(filterSectionId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterSectionId(v === "all" ? "all" : Number(v));
                      }}
                      className={filterSelect}
                    >
                      <option value="all">All sections</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 pb-0.5 text-sm text-stone-700 sm:pb-2">
                    <input
                      type="checkbox"
                      checked={filterOverdueOnly}
                      onChange={(e) => setFilterOverdueOnly(e.target.checked)}
                      className="rounded border-stone-300 text-sky-600 focus:ring-sky-500"
                    />
                    Overdue only
                  </label>
                  <button
                    type="button"
                    disabled={!hasActiveTaskFilters}
                    onClick={() => clearTaskFilters()}
                    className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain py-4 [-webkit-overflow-scrolling:touch] ${showBulkBar ? "pb-28" : ""}`}
          >
            {sections.map((sec) => {
              const list = tasksBySectionSorted.get(sec.id) ?? [];
              const isCollapsed = collapsed[sec.id];
              return (
                <section
                  key={sec.id}
                  className={`mb-6 rounded-lg transition-colors ${
                    dragOverSectionId === sec.id ? "bg-sky-50 ring-2 ring-sky-300 ring-inset" : ""
                  }`}
                  onDragOver={(e) => {
                    if (draggingTaskIdRef.current == null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverSectionId(sec.id);
                  }}
                  onDragLeave={(e) => sectionDragLeave(e, sec.id)}
                  onDrop={(e) => void dropTaskOnSection(e, sec.id)}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))
                    }
                    className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-stone-100/80 sm:px-6 lg:px-8"
                  >
                    <span className="text-stone-400">{isCollapsed ? "▸" : "▾"}</span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sectionDotClass(sec.color_key)}`} />
                    <span className="font-medium text-stone-800">{sec.name}</span>
                    <span className="text-xs text-stone-500">({list.length})</span>
                  </button>

                  {!isCollapsed && (
                    <>
                      <div
                        className="mt-1 w-full overflow-x-auto border-y border-stone-200 bg-white"
                        onDragOver={(e) => {
                          if (draggingTaskIdRef.current == null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverSectionId(sec.id);
                        }}
                        onDragLeave={(e) => sectionDragLeave(e, sec.id)}
                        onDrop={(e) => void dropTaskOnSection(e, sec.id)}
                      >
                        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                          <thead>
                            <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                              <th
                                className="w-9 border-r border-stone-200 px-2 py-2.5 pl-4 sm:pl-6 lg:pl-8"
                                aria-label="Drag"
                              />
                              <th
                                className="w-12 border-r border-stone-200 whitespace-nowrap px-0 py-2.5"
                                aria-label="Mark done"
                              />
                              <th
                                className="w-8 border-r-2 border-stone-500 px-0 py-2.5"
                                aria-label="Expand subtasks"
                              />
                              {visibleTaskTableKeys.map((k) => (
                                <SortableTaskTh
                                  key={k}
                                  colKey={k}
                                  label={TASK_TABLE_LABELS[k]}
                                  sort={taskTableSort}
                                  onSort={toggleTaskColumnSort}
                                  widthPx={taskColumnWidths[k]}
                                  onResizePointerDown={onTaskColumnResizePointerDown}
                                  onColumnAutoFit={onTaskColumnAutoFit}
                                  className="min-w-[4.5rem] overflow-visible px-2 py-1 pl-1.5 pr-0 align-bottom"
                                />
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((task) => {
                              const done = task.status === "done";
                              const overdue = isTaskOverdue(task);
                              const subCount = task.subtask_count ?? 0;
                              const subsOpen = Boolean(inlineSubExpanded[task.id]);
                              const inlineSubs = inlineSubtasksByTask[task.id] ?? [];
                              const subsLoading = Boolean(inlineSubLoading[task.id]);
                              return (
                                <Fragment key={task.id}>
                                <tr
                                  onClick={(e) => handleTaskRowClick(task.id, e)}
                                  className={`cursor-pointer border-b border-stone-100 hover:bg-stone-50 ${
                                    selectedTaskIds.includes(task.id) ? "bg-sky-50" : ""
                                  } ${overdue && !done ? "bg-red-50" : ""} ${
                                    draggingTaskId === task.id ? "opacity-40" : ""
                                  }`}
                                >
                                  <td
                                    className="px-2 py-2.5 pl-4 align-middle sm:pl-6 lg:pl-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span
                                      draggable
                                      role="button"
                                      tabIndex={0}
                                      title="Drag to another section"
                                      aria-label={`Drag task ${task.title} to another section`}
                                      className="inline-flex cursor-grab select-none text-stone-400 active:cursor-grabbing hover:text-stone-600"
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        const payload = JSON.stringify({ taskId: task.id });
                                        e.dataTransfer.setData("application/json", payload);
                                        e.dataTransfer.setData("text/plain", String(task.id));
                                        e.dataTransfer.effectAllowed = "move";
                                        draggingTaskIdRef.current = task.id;
                                        setDraggingTaskId(task.id);
                                      }}
                                      onDragEnd={() => {
                                        draggingTaskIdRef.current = null;
                                        setDraggingTaskId(null);
                                        setDragOverSectionId(null);
                                      }}
                                    >
                                      ⋮⋮
                                    </span>
                                  </td>
                                  <td
                                    className="bg-inherit px-0 py-2.5 align-middle"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void patchTask(task.id, {
                                          status: done ? "todo" : "done",
                                        })
                                      }
                                      className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                                        done
                                          ? "border-sky-600 bg-sky-600 text-white"
                                          : "border-stone-300 bg-white"
                                      }`}
                                      aria-label={done ? "Mark incomplete" : "Complete"}
                                    >
                                      {done ? "✓" : ""}
                                    </button>
                                  </td>
                                  <td
                                    className="bg-inherit px-0 py-2.5 align-middle"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {subCount > 0 ? (
                                      <button
                                        type="button"
                                        className="flex h-7 w-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                        aria-expanded={subsOpen}
                                        aria-label={
                                          subsOpen ? "Hide subtasks" : "Show subtasks"
                                        }
                                        title="Subtasks"
                                        onClick={(e) => toggleInlineSubtasksRow(task.id, e)}
                                      >
                                        <span className="text-sm" aria-hidden>
                                          {subsOpen ? "▾" : "▸"}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="inline-block w-7" aria-hidden />
                                    )}
                                  </td>
                                  {visibleTaskTableKeys.map((colKey) => {
                                    const customW = taskColumnWidths[colKey];
                                    const isLongText =
                                      colKey === "description" ||
                                      colKey === "dependencies" ||
                                      colKey === "requester" ||
                                      colKey === "project_label";
                                    const tdClass = [
                                      "border-l border-stone-100 px-2 py-2.5 align-middle text-stone-700",
                                      customW == null &&
                                        (isLongText
                                          ? "max-w-[14rem] whitespace-normal break-words"
                                          : "whitespace-nowrap"),
                                      customW == null && colKey === "title"
                                        ? "min-w-[8rem] max-w-[12rem]"
                                        : "",
                                      customW != null && isLongText ? "whitespace-normal break-words" : "",
                                      customW != null && !isLongText ? "whitespace-nowrap" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ");
                                    return (
                                    <td
                                      key={colKey}
                                      className={tdClass}
                                      style={
                                        customW != null
                                          ? {
                                              width: customW,
                                              minWidth: customW,
                                              maxWidth: customW,
                                              boxSizing: "border-box",
                                            }
                                          : undefined
                                      }
                                    >
                                      {colKey === "title" ? (
                                        <span
                                          className={`block truncate ${
                                            done ? "text-stone-400 line-through" : "text-stone-900"
                                          }`}
                                          title={task.title}
                                        >
                                          {task.title}
                                        </span>
                                      ) : (
                                        taskTableDataCell(task, colKey)
                                      )}
                                    </td>
                                    );
                                  })}
                                </tr>
                                {subCount > 0 && subsOpen && (
                                  <tr className="border-b border-stone-100 bg-stone-50/90">
                                    <td colSpan={taskTableColspan} className="px-0 py-0">
                                      <div className="border-t border-stone-100 py-2 pl-[3.25rem] sm:pl-[4.25rem] lg:pl-[5.25rem] pr-4 sm:pr-6 lg:pr-8">
                                        {subsLoading ? (
                                          <p className="text-xs text-stone-500">Loading subtasks…</p>
                                        ) : inlineSubs.length === 0 ? (
                                          <p className="text-xs text-stone-500">No subtasks</p>
                                        ) : (
                                          <ul className="space-y-1.5">
                                            {inlineSubs.map((sub) => (
                                              <li
                                                key={sub.id}
                                                className="flex items-center gap-2 text-sm"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    void toggleSubtask(sub);
                                                  }}
                                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                                                    sub.done
                                                      ? "border-sky-600 bg-sky-600 text-white"
                                                      : "border-stone-300 bg-white"
                                                  }`}
                                                  aria-label={
                                                    sub.done
                                                      ? "Mark subtask incomplete"
                                                      : "Complete subtask"
                                                  }
                                                >
                                                  {sub.done ? "✓" : ""}
                                                </button>
                                                <span
                                                  className={
                                                    sub.done
                                                      ? "text-stone-400 line-through"
                                                      : "text-stone-700"
                                                  }
                                                >
                                                  {sub.title}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                </Fragment>
                              );
                            })}
                            {list.length === 0 && (
                              <tr>
                                <td
                                  colSpan={taskTableColspan}
                                  className="py-8 text-center text-sm text-stone-400"
                                >
                                  No tasks — drop one here from another section
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2 flex gap-2 px-4 sm:px-6 lg:px-8">
                        <input
                          type="text"
                          placeholder="Add task…"
                          value={quickAdds[sec.id] ?? ""}
                          onChange={(e) =>
                            setQuickAdds((q) => ({ ...q, [sec.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void quickAddTask(sec.id);
                          }}
                          className={input}
                        />
                        <button
                          type="button"
                          onClick={() => void quickAddTask(sec.id)}
                          className="shrink-0 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                        >
                          Add
                        </button>
                      </div>
                    </>
                  )}
                </section>
              );
            })}

            <form
              onSubmit={handleAddSection}
              className="mt-4 flex gap-2 border-t border-stone-200 px-4 pt-4 sm:px-6 lg:px-8"
            >
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="New section name"
                className={input}
              />
              <button
                type="submit"
                className="shrink-0 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm hover:bg-stone-50"
              >
                Add section
              </button>
            </form>
          </div>
        </div>

        {/* Detail pane — fixed width; list uses remaining horizontal space */}
        {showDetailPane && (
          <aside className="hidden min-h-0 w-[min(100%,26rem)] shrink-0 overflow-hidden border-l border-stone-200 bg-white shadow-[inset_1px_0_0_0_rgb(231_229_228)] lg:flex lg:w-[26rem] lg:flex-col xl:w-[28rem]">
            <TaskDetail
              task={selected!}
              sections={sections}
              subtasks={subtasks}
              subtaskDraft={subtaskDraft}
              setSubtaskDraft={setSubtaskDraft}
              onPatch={(p) => void patchTask(selected!.id, p)}
              onDelete={() => void deleteTask(selected!.id)}
              onAddSubtask={() => void addSubtask()}
              onToggleSubtask={(s) => void toggleSubtask(s)}
              onRenameSubtask={(s, title) => void renameSubtask(s, title)}
              onRemoveSubtask={(id) => void removeSubtask(id, selected!.id)}
              onMinimize={() => setDetailsMinimized(true)}
              inputClass={input}
              labelClass={label}
            />
          </aside>
        )}
      </div>

      {/* Edge control when details minimized but task selected (desktop) */}
      {selected && selectedTaskIds.length === 1 && detailsMinimized && (
        <button
          type="button"
          onClick={() => setDetailsMinimized(false)}
          className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 rounded-l-lg border border-r-0 border-stone-200 bg-white px-2 py-6 text-xs font-medium text-stone-600 shadow-md hover:bg-stone-50 lg:block"
          aria-label="Show task details"
        >
          Details
          <span className="mt-1 block text-lg leading-none text-stone-400" aria-hidden>
            ‹
          </span>
        </button>
      )}

      {/* Mobile detail sheet — only when user opens details; list stays usable otherwise */}
      {selected && selectedTaskIds.length === 1 && !detailsMinimized && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-stone-50 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 pb-3 pt-3 shadow-sm">
            <button
              type="button"
              onClick={() => setDetailsMinimized(true)}
              className="min-h-11 min-w-11 touch-manipulation py-2 text-left text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              ← Back
            </button>
            <span className="text-xs text-stone-500">Task</span>
            <span className="w-14" aria-hidden />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TaskDetail
              task={selected}
              sections={sections}
              subtasks={subtasks}
              subtaskDraft={subtaskDraft}
              setSubtaskDraft={setSubtaskDraft}
              onPatch={(p) => void patchTask(selected.id, p)}
              onDelete={() => {
                void deleteTask(selected.id);
                setSelectedTaskIds([]);
              }}
              onAddSubtask={() => void addSubtask()}
              onToggleSubtask={(s) => void toggleSubtask(s)}
              onRenameSubtask={(s, title) => void renameSubtask(s, title)}
              onRemoveSubtask={(id) => void removeSubtask(id, selected.id)}
              onMinimize={() => setDetailsMinimized(true)}
              minimizeButtonLabel="Back to list"
              inputClass={input}
              labelClass={label}
            />
          </div>
        </div>
      )}

      {showBulkBar && (
        <div
          ref={bulkBarRef}
          className="pointer-events-auto fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right))] -translate-x-1/2 flex-col items-center gap-2"
        >
          {bulkPanel === "section" && (
            <div className="max-h-64 min-w-[14rem] overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              <p className="px-2 pb-1 text-xs font-medium text-stone-500">Move to section</p>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100"
                  onClick={() => void bulkPatchSelected({ section_id: s.id })}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {bulkPanel === "assignee" && (
            <div className="w-80 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
              <p className="mb-2 text-xs font-medium text-stone-500">Assignee (all selected)</p>
              <input
                type="text"
                value={bulkAssigneeDraft}
                onChange={(e) => setBulkAssigneeDraft(e.target.value)}
                placeholder="Name"
                className={input}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500"
                  onClick={() =>
                    void bulkPatchSelected({
                      assignee: bulkAssigneeDraft.trim() || null,
                    })
                  }
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  onClick={() => void bulkPatchSelected({ assignee: null })}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {bulkPanel === "date" && (
            <div className="w-80 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
              <p className="mb-2 text-xs font-medium text-stone-500">Due date (all selected)</p>
              <input
                type="date"
                value={bulkDueDraft}
                onChange={(e) => setBulkDueDraft(e.target.value)}
                className={input}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500"
                  onClick={() =>
                    void bulkPatchSelected({ due_date: bulkDueDraft || null })
                  }
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  onClick={() => void bulkPatchSelected({ due_date: null })}
                >
                  Clear due date
                </button>
              </div>
            </div>
          )}
          {bulkPanel === "more" && (
            <div className="min-w-[15rem] rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm text-stone-800 hover:bg-stone-50"
                onClick={() => void bulkPatchSelected({ status: "done" })}
              >
                Mark complete
              </button>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm text-stone-800 hover:bg-stone-50"
                onClick={() => void bulkPatchSelected({ status: "todo" })}
              >
                Mark incomplete
              </button>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  setBulkPanel(null);
                  setSelectedTaskIds([]);
                }}
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-0.5 rounded-2xl border border-stone-200 bg-white px-2 py-2 shadow-xl sm:gap-1 sm:px-3">
            <span className="shrink-0 px-2 text-sm font-medium text-stone-800">
              {multiSelectCount} selected
            </span>
            <span className="hidden h-6 w-px bg-stone-200 sm:block" aria-hidden />
            <button
              type="button"
              title="Change section"
              aria-label="Change section"
              className={`rounded-lg p-2 text-stone-600 hover:bg-stone-100 ${
                bulkPanel === "section" ? "bg-stone-100" : ""
              }`}
              onClick={() => setBulkPanel((p) => (p === "section" ? null : "section"))}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M8 9l4-4 4 4m-8 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              title="Change assignee"
              aria-label="Change assignee"
              className={`rounded-lg p-2 text-stone-600 hover:bg-stone-100 ${
                bulkPanel === "assignee" ? "bg-stone-100" : ""
              }`}
              onClick={() => {
                setBulkAssigneeDraft("");
                setBulkPanel((p) => (p === "assignee" ? null : "assignee"));
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              type="button"
              title="Change due date"
              aria-label="Change due date"
              className={`rounded-lg p-2 text-stone-600 hover:bg-stone-100 ${
                bulkPanel === "date" ? "bg-stone-100" : ""
              }`}
              onClick={() => {
                setBulkDueDraft("");
                setBulkPanel((p) => (p === "date" ? null : "date"));
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
            <button
              type="button"
              title="Delete selected"
              aria-label="Delete selected tasks"
              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
              onClick={() => void bulkDeleteSelected()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h8z" />
              </svg>
            </button>
            <button
              type="button"
              title="More actions"
              aria-label="More actions"
              className={`rounded-lg p-2 text-stone-600 hover:bg-stone-100 ${
                bulkPanel === "more" ? "bg-stone-100" : ""
              }`}
              onClick={() => setBulkPanel((p) => (p === "more" ? null : "more"))}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            <span className="hidden h-6 w-px bg-stone-200 sm:block" aria-hidden />
            <button
              type="button"
              title="Clear selection"
              aria-label="Clear selection"
              className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              onClick={() => {
                setBulkPanel(null);
                setSelectedTaskIds([]);
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetail({
  task,
  sections,
  subtasks,
  subtaskDraft,
  setSubtaskDraft,
  onPatch,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onRemoveSubtask,
  onMinimize,
  minimizeButtonLabel,
  inputClass,
  labelClass,
}: {
  task: TaskRow;
  sections: TaskSectionRow[];
  subtasks: SubtaskRow[];
  subtaskDraft: string;
  setSubtaskDraft: (s: string) => void;
  onPatch: (p: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddSubtask: () => void;
  onToggleSubtask: (s: SubtaskRow) => void;
  onRenameSubtask: (s: SubtaskRow, title: string) => void;
  onRemoveSubtask: (id: number) => void;
  onMinimize?: () => void;
  /** Defaults to "Minimize" (desktop). Use e.g. "Back to list" on mobile. */
  minimizeButtonLabel?: string;
  inputClass: string;
  labelClass: string;
}) {
  const done = task.status === "done";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/80 px-4 py-3">
        <button
          type="button"
          onClick={() => onPatch({ status: done ? "todo" : "done" })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            done
              ? "border border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50"
              : "bg-sky-600 text-white hover:bg-sky-500"
          }`}
        >
          {done ? "Mark incomplete" : "Mark complete"}
        </button>
        {onMinimize ? (
          <button
            type="button"
            onClick={onMinimize}
            className="min-h-11 touch-manipulation rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50"
            aria-label={minimizeButtonLabel ?? "Minimize task details"}
          >
            {minimizeButtonLabel ?? "Minimize"}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
        <p className="text-xs text-stone-500">My tasks › {task.section_name}</p>
        <input
          type="text"
          defaultValue={task.title}
          key={task.id + task.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== task.title) onPatch({ title: v });
          }}
          className={`mt-2 ${inputClass} text-lg font-semibold`}
        />

        <div className="mt-6 space-y-0 divide-y divide-stone-200">
          <Field label="Assignee" className={labelClass}>
            <input
              type="text"
              defaultValue={task.assignee ?? ""}
              key={task.id + "-a"}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const p = task.assignee ?? "";
                if (v !== p) onPatch({ assignee: v || null });
              }}
              placeholder="Name"
              className={inputClass}
            />
          </Field>
          <Field label="Priority" className={labelClass}>
            <select
              value={task.priority}
              onChange={(e) => onPatch({ priority: e.target.value })}
              className={inputClass}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" className={labelClass}>
            <input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => onPatch({ due_date: e.target.value || null })}
              className={inputClass}
            />
          </Field>
          <Field label="Dependencies" className={labelClass}>
            <textarea
              defaultValue={task.dependencies ?? ""}
              key={task.id + "-dep"}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const p = task.dependencies ?? "";
                if (v !== p) onPatch({ dependencies: v || null });
              }}
              placeholder="Task names or links"
              className={inputClass}
            />
          </Field>
          <Field label="Section" className={labelClass}>
            <select
              value={task.section_id}
              onChange={(e) => onPatch({ section_id: Number(e.target.value) })}
              className={inputClass}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project" className={labelClass}>
            <input
              type="text"
              defaultValue={task.project_label ?? ""}
              key={task.id + "-proj"}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const p = task.project_label ?? "";
                if (v !== p) onPatch({ project_label: v || null });
              }}
              placeholder="e.g. My tasks"
              className={inputClass}
            />
          </Field>
          <Field label="Est. time (min)" className={labelClass}>
            <input
              type="number"
              min={0}
              defaultValue={task.estimated_minutes ?? ""}
              key={task.id + "-est"}
              onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (v !== task.estimated_minutes) onPatch({ estimated_minutes: v });
              }}
              placeholder="—"
              className={inputClass}
            />
          </Field>
          <Field label="Actual time (min)" className={labelClass}>
            <input
              type="number"
              min={0}
              defaultValue={task.actual_minutes ?? ""}
              key={task.id + "-act"}
              onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (v !== task.actual_minutes) onPatch({ actual_minutes: v });
              }}
              placeholder="—"
              className={inputClass}
            />
          </Field>
          <Field label="Status" className={labelClass}>
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
          </Field>
          <Field label="Requester" className={labelClass}>
            <input
              type="text"
              defaultValue={task.requester ?? ""}
              key={task.id + "-req"}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const p = task.requester ?? "";
                if (v !== p) onPatch({ requester: v || null });
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Quarter" className={labelClass}>
            <input
              type="text"
              defaultValue={task.quarter ?? ""}
              key={task.id + "-q"}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const p = task.quarter ?? "";
                if (v !== p) onPatch({ quarter: v || null });
              }}
              placeholder="e.g. Q2 2026"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-6">
          <span className={labelClass}>Description</span>
          <textarea
            defaultValue={task.description ?? ""}
            key={task.id + "-desc"}
            rows={5}
            onBlur={(e) => {
              const v = e.target.value.trim();
              const p = (task.description ?? "").trim();
              if (v !== p) onPatch({ description: v || null });
            }}
            className={`mt-1 ${inputClass}`}
            placeholder="Details…"
          />
        </div>

        <div className="mt-8">
          <h3 className={`${labelClass} mb-2 uppercase tracking-wide`}>Subtasks</h3>
          <ul className="space-y-2">
            {subtasks.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50/50 px-2 py-2"
              >
                <button
                  type="button"
                  onClick={() => onToggleSubtask(s)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                    s.done
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-stone-300 bg-white"
                  }`}
                >
                  {s.done ? "✓" : ""}
                </button>
                <input
                  type="text"
                  defaultValue={s.title}
                  key={`${s.id}-${s.title}`}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-stone-900 outline-none"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.title) onRenameSubtask(s, v);
                  }}
                />
                <button
                  type="button"
                  onClick={() => onRemoveSubtask(s.id)}
                  className="text-xs text-stone-500 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                onAddSubtask();
              }}
              placeholder="Add subtask…"
              className={inputClass}
            />
            <button
              type="button"
              onClick={onAddSubtask}
              className="shrink-0 rounded-md border border-stone-200 bg-stone-800 px-3 py-2 text-sm text-white shadow-sm hover:bg-stone-700"
            >
              Add
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="mt-10 w-full rounded-md border border-red-200 bg-white py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-3">
      <span className={className}>{label}</span>
      <div>{children}</div>
    </div>
  );
}
