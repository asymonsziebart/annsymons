/** Scale mirror typography from real pixel dimensions (works when vmin/vw lie on Android). */
export function applyMirrorTypography(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  if (!root) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;

  // Balance height-driven size with width cap so the clock fits on one line.
  const timePx = Math.round(Math.min(h * 0.2, w * 0.22));
  const datePx = Math.round(Math.min(h * 0.05, w * 0.065));
  const weatherPx = Math.round(Math.min(h * 0.07, w * 0.11));
  const taskPx = Math.round(Math.min(h * 0.032, w * 0.042));
  const taskLabelPx = Math.round(Math.min(h * 0.016, w * 0.022));

  root.style.setProperty("--mirror-time-size", `${timePx}px`);
  root.style.setProperty("--mirror-date-size", `${datePx}px`);
  root.style.setProperty("--mirror-weather-size", `${weatherPx}px`);
  root.style.setProperty("--mirror-task-size", `${taskPx}px`);
  root.style.setProperty("--mirror-task-label-size", `${taskLabelPx}px`);
}

export function bindMirrorTypography(): () => void {
  const update = () => applyMirrorTypography();
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  window.visualViewport?.addEventListener("resize", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
    window.visualViewport?.removeEventListener("resize", update);
  };
}

export type MirrorTimeParts = {
  main: string;
  seconds: string;
  ampm: string;
};

export function formatMirrorTimeParts(d: Date): MirrorTimeParts {
  const h24 = d.getHours();
  const h12 = h24 % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = h24 >= 12 ? "PM" : "AM";
  return {
    main: `${h12}:${minutes}`,
    seconds,
    ampm,
  };
}
