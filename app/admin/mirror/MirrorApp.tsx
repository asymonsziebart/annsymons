"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
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
  getFullscreenElement,
  isFullscreenSupported,
  toggleFullscreen,
} from "./mirrorFullscreen";
import {
  applyMirrorContentInset,
  formatMirrorTimeParts,
} from "./mirrorScale";
import { formatMirrorDueLabel, getDueTasksForMirror } from "./mirrorTasks";
import type { MirrorRecipeVoiceHandler } from "./mirrorVoice";
import { bindJarvisVoices } from "./mirrorJarvisSpeak";
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
  initialWeather: MirrorWeather | null;
  initialRecipes: Recipe[];
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function MirrorApp({
  initialTasks,
  initialWeather,
  initialRecipes,
}: MirrorAppProps) {
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState(initialTasks);
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

  const recipesRef = useRef(initialRecipes);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const recipePanelRef = useRef<RecipePanel>("ingredients");
  const recipeStepIndexRef = useRef(0);

  recipesRef.current = recipes;
  activeRecipeRef.current = activeRecipe;
  recipePanelRef.current = recipePanel;
  recipeStepIndexRef.current = recipeStepIndex;

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

  const getRecipeHandler = useCallback((): MirrorRecipeVoiceHandler => ({
    handle: (raw, command) => {
      const recipe = activeRecipeRef.current;

      if (recipe && isRecipeCloseCommand(raw)) {
        closeRecipe();
        return "Very good. Closing the recipe.";
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
  }), [closeRecipe, openRecipe]);

  const dueTasks = useMemo(() => getDueTasksForMirror(tasks, now), [tasks, now]);
  const {
    status: voiceStatus,
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
  });

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/list");
      if (!res.ok) return;
      const data = (await res.json()) as { tasks?: TaskRow[] };
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
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
  }, [dueTasks.length, taskIndex, weather?.temperatureF, activeRecipe]);

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

  const currentTask = dueTasks[taskIndex] ?? null;
  const timeParts = formatMirrorTimeParts(now);

  const voiceStatusLabel =
    voiceStatus === "listening"
      ? countTrainingSamples(training) > 0
        ? "Listening (trained wake phrase)"
        : 'Listening for "hey mirror" or "mirror"'
      : voiceStatus === "awake"
        ? "Listening…"
        : voiceStatus === "speaking"
          ? "Speaking"
          : voiceStatus === "unsupported"
            ? "Voice not supported in this browser"
            : voiceStatus === "error"
              ? "Voice error — tap mic to retry"
              : null;

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
          className="mirror-app__voice-enable"
          onClick={enableVoice}
          aria-label="Enable voice commands"
          title='Say "hey mirror" or "mirror"'
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mirror-app__voice-icon">
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
            />
          </svg>
        </button>
      ) : !isFullscreen && voiceStatusLabel ? (
        <div className="mirror-app__voice-bar">
          <div className="mirror-app__voice-status" aria-live="polite">
            <span
              className={`mirror-app__voice-dot mirror-app__voice-dot--${voiceStatus}`}
              aria-hidden="true"
            />
            <span className="mirror-app__voice-label">{voiceStatusLabel}</span>
          </div>
          <button
            type="button"
            className="mirror-app__voice-train"
            onClick={() => setTrainerOpen(true)}
          >
            Train
          </button>
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
