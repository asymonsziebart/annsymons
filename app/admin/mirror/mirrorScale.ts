/** Scale mirror typography from real pixel dimensions (works when vmin/vw lie on Android). */
export function applyMirrorTypography(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  if (!root) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  const short = Math.min(w, h);

  root.style.setProperty("--mirror-time-size", `${Math.round(short * 0.42)}px`);
  root.style.setProperty("--mirror-date-size", `${Math.round(short * 0.14)}px`);
  root.style.setProperty("--mirror-weather-size", `${Math.round(short * 0.16)}px`);
  root.style.setProperty("--mirror-task-size", `${Math.round(short * 0.055)}px`);
  root.style.setProperty("--mirror-task-label-size", `${Math.round(short * 0.028)}px`);
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
