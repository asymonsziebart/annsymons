"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TaskRow, TaskSectionRow } from "@/lib/data/taskClientTypes";
import type { Recipe } from "@/lib/recipes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import {
  isRecipeCloseCommand,
  isRecipeOpenCommand,
  jarvisLineForRecipeCommand,
  matchRecipeFromTranscript,
  parseRecipePanelCommand,
  type RecipePanel,
} from "@/lib/mirrorRecipeMatch";
import {
  dueDateIsoForAdd,
  formatDurationClock,
  formatDurationSpoken,
  isHomeCommand,
  isRecipeReadCommand,
  matchTaskForComplete,
  parseAddTaskCommand,
  parseCompleteTaskCommand,
  parseFullscreenCommand,
  parseTimerCommand,
  recipeReadTarget,
} from "./mirrorCommandParse";
import {
  enterFullscreen,
  exitFullscreen,
  getFullscreenElement,
  isFullscreenSupported,
  toggleFullscreen,
} from "./mirrorFullscreen";
import {
  applyMirrorContentInset,
  formatMirrorTimeParts,
} from "./mirrorScale";
import {
  formatMirrorDueLabel,
  getDueTasksForMirror,
  pickMirrorDefaultSection,
} from "./mirrorTasks";
import type { MirrorActionVoiceHandler, MirrorRecipeVoiceHandler } from "./mirrorVoice";
import { bindJarvisVoices, speakJarvis } from "./mirrorJarvisSpeak";
import { bindMirrorWakeLockOnVisible, requestMirrorWakeLock } from "./mirrorWakeLock";
import { useMirrorVoice } from "./useMirrorVoice";
import MirrorWakeTrainer from "./MirrorWakeTrainer";
import MirrorRecipeOverlay from "./MirrorRecipeOverlay";
import { countTrainingSamples } from "./mirrorWakeTraining";

const TASK_CYCLE_MS = 8000;
const TASK_REFRESH_MS = 60_000;
const WEATHER_REFRESH_MS = 15 * 60_000;

type MirrorAppProps = {
  initialTasks: TaskRow[];
  initialSections: TaskSectionRow[];
  initialWeather: MirrorWeather | null;
  initialRecipes: Recipe[];
};

type MirrorTimer = {
  id: string;
  label: string;
  endsAt: number;
  durationMs: number;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function buildReadAloud(recipe: Recipe, panel: RecipePanel, stepIndex: number, raw: string): string {
  const target = recipeReadTarget(raw);
  const preferIngredients =
    target === "ingredients" || (target === "auto" && panel === "ingredients");

  if (preferIngredients) {
    if (recipe.ingredients.length === 0) return "There are no ingredients listed.";
    const list = recipe.ingredients.join(". ");
    return `Ingredients. ${list}.`;
  }

  if (recipe.steps.length === 0) return "There are no steps for this recipe.";
  const idx = Math.min(Math.max(stepIndex, 0), recipe.steps.length - 1);
  return `Step ${idx + 1}. ${recipe.steps[idx]}`;
}

export default function MirrorApp({
  initialTasks,
  initialSections,
  initialWeather,
  initialRecipes,
}: MirrorAppProps) {
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState(initialTasks);
  const [sections, setSections] = useState(initialSections);
  const [weather, setWeather] = useState<MirrorWeather | null>(initialWeather);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [recipePanel, setRecipePanel] = useState<RecipePanel>("ingredients");
  const [recipeStepIndex, setRecipeStepIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [timers, setTimers] = useState<MirrorTimer[]>([]);

  const recipesRef = useRef(initialRecipes);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const recipePanelRef = useRef<RecipePanel>("ingredients");
  const recipeStepIndexRef = useRef(0);
  const dueTasksRef = useRef<TaskRow[]>([]);
  const taskIndexRef = useRef(0);
  const timersRef = useRef<MirrorTimer[]>([]);
  const announcedTimersRef = useRef<Set<string>>(new Set());
  const sectionsRef = useRef(initialSections);
  const trainerOpenRef = useRef(false);

  recipesRef.current = recipes;
  activeRecipeRef.current = activeRecipe;
  recipePanelRef.current = recipePanel;
  recipeStepIndexRef.current = recipeStepIndex;
  timersRef.current = timers;
  sectionsRef.current = sections;
  trainerOpenRef.current = trainerOpen;

  const openRecipe = useCallback((recipe: Recipe) => {
    setActiveRecipe(recipe);
    setRecipePanel("ingredients");
    setRecipeStepIndex(0);
  }, []);

  const closeRecipe = useCallback(() => {
    setActiveRecipe(null);
    setRecipePanel("ingredients");
    setRecipeStepIndex(0);
  }, []);

  const goHome = useCallback((): string => {
    const hadOverlay = Boolean(activeRecipeRef.current) || trainerOpenRef.current;
    closeRecipe();
    setTrainerOpen(false);
    return hadOverlay ? "Returning home." : "You're already on the home screen.";
  }, [closeRecipe]);

  const completeTaskById = useCallback(async (task: TaskRow): Promise<string> => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        task?: TaskRow;
      };
      if (res.status === 409) {
        return data.error || `I couldn't mark ${task.title} done yet — something is blocking it.`;
      }
      if (!res.ok) {
        return data.error || `I couldn't mark ${task.title} done.`;
      }
      if (data.task) {
        setTasks((prev) => prev.map((t) => (t.id === data.task!.id ? data.task! : t)));
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "done" as const } : t))
        );
      }
      void fetch("/api/tasks/list")
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { tasks?: TaskRow[] } | null) => {
          if (payload && Array.isArray(payload.tasks)) setTasks(payload.tasks);
        })
        .catch(() => {});
      return `Done. Marked ${task.title} complete.`;
    } catch {
      return `I couldn't mark ${task.title} done.`;
    }
  }, []);

  const createTaskFromVoice = useCallback(
    async (title: string, due: "today" | "tomorrow" | "none"): Promise<string> => {
      const section = pickMirrorDefaultSection(sectionsRef.current);
      if (!section) {
        return "I couldn't add that — no task sections are set up yet.";
      }
      const due_date = dueDateIsoForAdd(due, new Date());
      try {
        const res = await fetch("/api/tasks/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            section_id: section.id,
            status: "todo",
            due_date,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          task?: TaskRow;
        };
        if (!res.ok || !data.task) {
          return data.error || "I couldn't add that task.";
        }
        setTasks((prev) => [...prev, data.task!]);
        const dueBit =
          due === "tomorrow" ? " due tomorrow" : due === "none" ? " with no due date" : " due today";
        return `Added ${data.task.title}${dueBit}.`;
      } catch {
        return "I couldn't add that task.";
      }
    },
    []
  );

  const getRecipeHandler = useCallback((): MirrorRecipeVoiceHandler => ({
    handle: (raw, command) => {
      const recipe = activeRecipeRef.current;

      if (isHomeCommand(raw) || isHomeCommand(command)) {
        return goHome();
      }

      if (recipe && isRecipeCloseCommand(raw)) {
        closeRecipe();
        return "Very good. Closing the recipe.";
      }

      if (recipe && (isRecipeReadCommand(raw) || isRecipeReadCommand(command))) {
        const target = recipeReadTarget(raw || command);
        const preferIngredients =
          target === "ingredients" ||
          (target === "auto" && recipePanelRef.current === "ingredients");
        if (preferIngredients) {
          setRecipePanel("ingredients");
        } else {
          setRecipePanel("steps");
        }
        return buildReadAloud(
          recipe,
          preferIngredients ? "ingredients" : "steps",
          recipeStepIndexRef.current,
          raw || command
        );
      }

      if (recipe) {
        const panelCommand = parseRecipePanelCommand(raw, recipePanelRef.current);
        if (panelCommand) {
          if (panelCommand.type === "panel") {
            setRecipePanel(panelCommand.panel);
            setRecipeStepIndex(0);
            return jarvisLineForRecipeCommand(panelCommand, recipe, 0);
          }

          const total = recipe.steps.length;
          if (total === 0) return "There are no steps for this recipe.";

          const current = recipeStepIndexRef.current;
          const nextIdx =
            panelCommand.direction === "next"
              ? Math.min(current + 1, total - 1)
              : Math.max(current - 1, 0);
          setRecipePanel("steps");
          setRecipeStepIndex(nextIdx);
          return jarvisLineForRecipeCommand(panelCommand, recipe, nextIdx);
        }
      }

      const recipeMatch = matchRecipeFromTranscript(raw, recipesRef.current);
      if (recipeMatch) {
        openRecipe(recipeMatch);
        return `Certainly. Pulling up ${recipeMatch.title}. Showing ingredients.`;
      }

      if (isRecipeOpenCommand(raw) || isRecipeOpenCommand(command)) {
        return "I couldn't find that recipe in your collection. Try saying the recipe name more clearly.";
      }

      return null;
    },
  }), [closeRecipe, goHome, openRecipe]);

  const getActionHandler = useCallback((): MirrorActionVoiceHandler => ({
    handle: async (raw, command) => {
      const text = command || raw;

      if (isHomeCommand(text) || isHomeCommand(raw)) {
        return goHome();
      }

      const fullscreen = parseFullscreenCommand(text) ?? parseFullscreenCommand(raw);
      if (fullscreen) {
        if (fullscreen === "enter") {
          const ok = await enterFullscreen();
          return ok ? "Entering full screen." : "I couldn't enter full screen.";
        }
        if (fullscreen === "exit") {
          await exitFullscreen();
          return "Exiting full screen.";
        }
        const entered = await toggleFullscreen();
        return entered ? "Entering full screen." : "Exiting full screen.";
      }

      const timerCmd = parseTimerCommand(text) ?? parseTimerCommand(raw);
      if (timerCmd) {
        if (timerCmd.type === "set") {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const label = timerCmd.label || "timer";
          const next: MirrorTimer = {
            id,
            label,
            endsAt: Date.now() + timerCmd.durationMs,
            durationMs: timerCmd.durationMs,
          };
          setTimers((prev) => [...prev, next]);
          const spokenLabel = label === "timer" ? "timer" : `${label} timer`;
          return `Starting a ${spokenLabel} for ${formatDurationSpoken(timerCmd.durationMs)}.`;
        }

        if (timerCmd.type === "cancel") {
          const current = timersRef.current;
          if (current.length === 0) return "There are no timers running.";
          if (timerCmd.label) {
            const needle = timerCmd.label;
            const match = current.find(
              (t) =>
                t.label === needle ||
                t.label.includes(needle) ||
                needle.includes(t.label)
            );
            if (!match) return `I couldn't find a ${needle} timer.`;
            setTimers((prev) => prev.filter((t) => t.id !== match.id));
            announcedTimersRef.current.delete(match.id);
            return `Cancelled the ${match.label} timer.`;
          }
          setTimers([]);
          announcedTimersRef.current.clear();
          return current.length === 1 ? "Timer cancelled." : "All timers cancelled.";
        }

        const current = timersRef.current;
        if (current.length === 0) return "There are no timers running.";
        const lines = current.map((t) => {
          const left = Math.max(0, t.endsAt - Date.now());
          const name = t.label === "timer" ? "Timer" : `${t.label} timer`;
          return `${name}: ${formatDurationSpoken(left)} remaining`;
        });
        return lines.join(". ") + ".";
      }

      const addCmd = parseAddTaskCommand(text) ?? parseAddTaskCommand(raw);
      if (addCmd) {
        return createTaskFromVoice(addCmd.title, addCmd.due);
      }

      const completeCmd =
        parseCompleteTaskCommand(text) ?? parseCompleteTaskCommand(raw);
      if (completeCmd) {
        const due = dueTasksRef.current;
        if (due.length === 0) return "You have no tasks due today.";
        const task = matchTaskForComplete(completeCmd, due, taskIndexRef.current);
        if (!task) {
          return "I couldn't tell which task you meant. Try saying the task name, or mark this task done.";
        }
        return completeTaskById(task);
      }

      return null;
    },
  }), [completeTaskById, createTaskFromVoice, goHome]);

  const dueTasks = useMemo(() => getDueTasksForMirror(tasks, now), [tasks, now]);
  dueTasksRef.current = dueTasks;
  taskIndexRef.current = taskIndex;

  const {
    status: voiceStatus,
    lastHeard,
    training,
    enableVoice,
    pauseVoice,
    resumeVoice,
    updateTraining,
  } = useMirrorVoice({
    now,
    weather,
    dueTasks,
    getRecipeHandler,
    getActionHandler,
  });

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/list");
      if (!res.ok) return;
      const data = (await res.json()) as {
        tasks?: TaskRow[];
        sections?: TaskSectionRow[];
      };
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
      if (Array.isArray(data.sections)) setSections(data.sections);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/mirror/weather");
      if (!res.ok) return;
      const data = (await res.json()) as MirrorWeather;
      if (typeof data.temperatureF === "number") setWeather(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(refreshTasks, TASK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshTasks]);

  useEffect(() => {
    refreshWeather();
    const id = window.setInterval(refreshWeather, WEATHER_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshWeather]);

  useEffect(() => {
    const refreshRecipes = async () => {
      try {
        const res = await fetch("/api/mirror/recipes");
        if (!res.ok) return;
        const data = (await res.json()) as { recipes?: Recipe[] };
        if (Array.isArray(data.recipes)) setRecipes(data.recipes);
      } catch {
        /* ignore */
      }
    };
    void refreshRecipes();
  }, []);

  useEffect(() => {
    setCanFullscreen(isFullscreenSupported());
    void requestMirrorWakeLock();
    const unbindWakeLock = bindMirrorWakeLockOnVisible();
    const unbindJarvisVoices = bindJarvisVoices();

    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);

    return () => {
      unbindWakeLock();
      unbindJarvisVoices();
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    setTaskIndex(0);
  }, [dueTasks.length]);

  useEffect(() => {
    requestAnimationFrame(() => applyMirrorContentInset());
  }, [dueTasks.length, taskIndex, weather?.temperatureF, activeRecipe, timers.length]);

  useEffect(() => {
    if (dueTasks.length <= 1) return;

    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setTaskIndex((i) => (i + 1) % dueTasks.length);
        setFading(false);
      }, 600);
    }, TASK_CYCLE_MS);

    return () => window.clearInterval(id);
  }, [dueTasks.length]);

  // Expire timers and announce completion.
  useEffect(() => {
    const expired = timers.filter((t) => t.endsAt <= now.getTime());
    if (expired.length === 0) return;

    for (const t of expired) {
      if (announcedTimersRef.current.has(t.id)) continue;
      announcedTimersRef.current.add(t.id);
      const name = t.label === "timer" ? "Timer" : `${t.label} timer`;
      speakJarvis(`${name} finished.`);
    }

    setTimers((prev) => prev.filter((t) => t.endsAt > Date.now()));
  }, [now, timers]);

  const currentTask = dueTasks[taskIndex] ?? null;
  const timeParts = formatMirrorTimeParts(now);
  const liveTimers = timers.filter((t) => t.endsAt > now.getTime());

  const voiceStatusLabel =
    voiceStatus === "listening"
      ? countTrainingSamples(training) > 0
        ? "Listening (trained wake phrase)"
        : 'Listening for "hey mirror" or "mirror mirror"'
      : voiceStatus === "awake"
        ? "Listening…"
        : voiceStatus === "speaking"
          ? "Speaking"
          : voiceStatus === "unsupported"
            ? "Voice not supported in this browser"
            : voiceStatus === "error"
              ? "Voice error — tap mic to retry"
              : null;

  const showVoiceBar =
    Boolean(voiceStatusLabel) &&
    (!isFullscreen || voiceStatus === "awake" || voiceStatus === "speaking");

  return (
    <>
      {canFullscreen && !isFullscreen ? (
        <button
          type="button"
          className="mirror-app__fullscreen"
          onClick={() => void toggleFullscreen()}
          aria-label="Enter full screen"
          title="Full screen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mirror-app__fullscreen-icon">
            <path
              fill="currentColor"
              d="M7 7h4V5H5v6h2V7zm10 0v4h2V5h-6v2h4zM7 17v-4H5v6h6v-2H7zm10 0h-4v2h6v-6h-2v4z"
            />
          </svg>
          <span className="mirror-app__fullscreen-label">Full screen</span>
        </button>
      ) : null}

      {!isFullscreen && (voiceStatus === "needs-permission" || voiceStatus === "error") ? (
        <button
          type="button"
          className="mirror-app__voice-enable mirror-app__voice-enable--labeled"
          onClick={enableVoice}
          aria-label="Enable voice commands"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mirror-app__voice-icon">
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
            />
          </svg>
          <span className="mirror-app__voice-enable-text">
            {voiceStatus === "error" ? "Tap to retry voice" : "Tap to enable voice"}
          </span>
        </button>
      ) : showVoiceBar ? (
        <div
          className={`mirror-app__voice-bar${voiceStatus === "awake" ? " mirror-app__voice-bar--awake" : ""}`}
        >
          <div className="mirror-app__voice-status" aria-live="polite">
            <span
              className={`mirror-app__voice-dot mirror-app__voice-dot--${voiceStatus}`}
              aria-hidden="true"
            />
            <span className="mirror-app__voice-label">{voiceStatusLabel}</span>
          </div>
          {!isFullscreen ? (
            <button
              type="button"
              className="mirror-app__voice-train"
              onClick={() => setTrainerOpen(true)}
            >
              Train
            </button>
          ) : null}
          {lastHeard && !isFullscreen ? (
            <div className="mirror-app__voice-heard" aria-live="polite">
              Heard: “{lastHeard}”
            </div>
          ) : null}
        </div>
      ) : null}

      {liveTimers.length > 0 ? (
        <div className="mirror-app__timers" aria-live="polite" aria-label="Active timers">
          {liveTimers.map((t) => {
            const left = Math.max(0, t.endsAt - now.getTime());
            const urgent = left <= 60_000;
            return (
              <div
                key={t.id}
                className={`mirror-app__timer${urgent ? " mirror-app__timer--urgent" : ""}`}
              >
                <span className="mirror-app__timer-label">
                  {t.label === "timer" ? "Timer" : t.label}
                </span>
                <span className="mirror-app__timer-clock">{formatDurationClock(left)}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <MirrorWakeTrainer
        open={trainerOpen && !isFullscreen}
        onClose={() => setTrainerOpen(false)}
        onTrainingChange={updateTraining}
        pauseVoice={pauseVoice}
        resumeVoice={resumeVoice}
      />

      {activeRecipe ? (
        <MirrorRecipeOverlay
          recipe={activeRecipe}
          panel={recipePanel}
          stepIndex={recipeStepIndex}
        />
      ) : null}

      <div className={`mirror-app__inner${activeRecipe ? " mirror-app__inner--hidden" : ""}`}>
        <div className="mirror-app__content">
        <div className="mirror-app__clock">
          <div className="mirror-app__time" aria-live="polite" aria-atomic="true">
            <span className="mirror-app__time-main">{timeParts.main}</span>
            <span className="mirror-app__time-sec">:{timeParts.seconds}</span>
            <span className="mirror-app__time-ampm">{timeParts.ampm}</span>
          </div>
          <div className="mirror-app__date">{formatDate(now)}</div>
        </div>

        {weather ? (
          <div className="mirror-app__weather" aria-label={`Weather in ${weather.location}`}>
            <p className="mirror-app__weather-temp">{weather.temperatureF}°</p>
            <p className="mirror-app__weather-condition">{weather.condition}</p>
            <p className="mirror-app__weather-meta">
              H {weather.highF}° · L {weather.lowF}° · {weather.location}
            </p>
          </div>
        ) : null}

        <div className="mirror-app__tasks" aria-live="polite">
        {dueTasks.length === 0 ? (
          <p className="mirror-app__empty">No tasks due today</p>
        ) : (
          <>
            <p className="mirror-app__task-label">
              {dueTasks.length === 1 ? "Due task" : `Due tasks · ${taskIndex + 1} of ${dueTasks.length}`}
            </p>
            {currentTask ? (
              <>
                <p
                  className={`mirror-app__task-title${fading ? " mirror-app__task-title--fade" : ""}`}
                >
                  {currentTask.title}
                </p>
                <p
                  className={`mirror-app__task-meta${fading ? " mirror-app__task-meta--fade" : ""}`}
                >
                  {formatMirrorDueLabel(currentTask, now)}
                  {currentTask.assignee ? ` · ${currentTask.assignee}` : ""}
                </p>
              </>
            ) : null}
            {dueTasks.length > 1 ? (
              <div className="mirror-app__dots" aria-hidden="true">
                {dueTasks.map((t, i) => (
                  <span
                    key={t.id}
                    className={`mirror-app__dot${i === taskIndex ? " mirror-app__dot--active" : ""}`}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
        </div>
        </div>
      </div>
    </>
  );
}
