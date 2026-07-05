"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import {
  getFullscreenElement,
  isFullscreenSupported,
  toggleFullscreen,
} from "./mirrorFullscreen";
import { formatMirrorDueLabel, getDueTasksForMirror } from "./mirrorTasks";

const TASK_CYCLE_MS = 8000;
const TASK_REFRESH_MS = 60_000;
const WEATHER_REFRESH_MS = 15 * 60_000;

type MirrorAppProps = {
  initialTasks: TaskRow[];
  initialWeather: MirrorWeather | null;
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

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

  const dueTasks = useMemo(() => getDueTasksForMirror(tasks, now), [tasks, now]);

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

      <div className="mirror-app__inner">
      <div className="mirror-app__time" aria-live="polite" aria-atomic="true">
        {formatTime(now)}
      </div>
      <div className="mirror-app__date">{formatDate(now)}</div>

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
    </>
  );
}
