"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
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
import { useMirrorVoice } from "./useMirrorVoice";
import MirrorWakeTrainer from "./MirrorWakeTrainer";
import { countTrainingSamples } from "./mirrorWakeTraining";

const TASK_CYCLE_MS = 8000;
const TASK_REFRESH_MS = 60_000;
const WEATHER_REFRESH_MS = 15 * 60_000;

type MirrorAppProps = {
  initialTasks: TaskRow[];
  initialWeather: MirrorWeather | null;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function MirrorApp({ initialTasks, initialWeather }: MirrorAppProps) {
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState(initialTasks);
  const [weather, setWeather] = useState<MirrorWeather | null>(initialWeather);
  const [taskIndex, setTaskIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);

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
    setCanFullscreen(isFullscreenSupported());
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    setTaskIndex(0);
  }, [dueTasks.length]);

  useEffect(() => {
    requestAnimationFrame(() => applyMirrorContentInset());
  }, [dueTasks.length, taskIndex, weather?.temperatureF]);

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
        : "Listening for “hey mirror”"
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
          title='Say "hey mirror" or "mirror mirror"'
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

      <div className="mirror-app__inner">
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
