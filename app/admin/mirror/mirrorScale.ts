/** Scale mirror typography from real pixel dimensions (works when vmin/vw lie on Android). */
export function applyMirrorTypography(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  if (!root) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;

  // Content lives in the bottom-left quarter (50% × 50%); scale from that panel.
  const panelW = w * 0.5;
  const panelH = h * 0.5;
  const basis = Math.min(panelW, panelH);

  const timePx = Math.round(basis * 0.28);
  const datePx = Math.round(basis * 0.082);
  const weatherPx = Math.round(basis * 0.11);
  const taskPx = Math.round(basis * 0.055);
  const taskLabelPx = Math.round(basis * 0.028);

  root.style.setProperty("--mirror-panel-width", `${Math.round(panelW)}px`);
  root.style.setProperty("--mirror-panel-height", `${Math.round(panelH)}px`);
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
