/** Scale mirror typography from real pixel dimensions (works when vmin/vw lie on Android). */
export function applyMirrorTypography(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  if (!root) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;

  // Wider/taller panel so larger type still fits on tablets.
  const panelW = w * 0.72;
  const panelH = h * 0.58;
  const basis = Math.min(panelW, panelH);

  const timePx = Math.round(basis * 0.34);
  const datePx = Math.round(basis * 0.105);
  const weatherPx = Math.round(basis * 0.145);
  const taskPx = Math.round(basis * 0.078);
  const taskLabelPx = Math.round(basis * 0.038);

  root.style.setProperty("--mirror-panel-width", `${Math.round(panelW)}px`);
  root.style.setProperty("--mirror-panel-height", `${Math.round(panelH)}px`);
  root.style.setProperty("--mirror-time-size", `${timePx}px`);
  root.style.setProperty("--mirror-date-size", `${datePx}px`);
  root.style.setProperty("--mirror-weather-size", `${weatherPx}px`);
  root.style.setProperty("--mirror-task-size", `${taskPx}px`);
  root.style.setProperty("--mirror-task-label-size", `${taskLabelPx}px`);
}

/**
 * Keep a clear left gutter from the bezel.
 * (Matching left inset to top offset breaks on portrait tablets and was
 * accidentally stuck at 0px via an uncleared inline style.)
 */
export function applyMirrorContentInset(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  const content = document.querySelector(".mirror-app__content") as HTMLElement | null;
  if (!root || !content) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const gutter = Math.max(28, Math.round(w * 0.055));

  root.style.setProperty("--mirror-content-inset", `${gutter}px`);
  // Clear any leftover inline override so the CSS variable applies.
  content.style.marginLeft = "";
}

export function bindMirrorTypography(): () => void {
  const update = () => {
    applyMirrorTypography();
    requestAnimationFrame(() => {
      applyMirrorContentInset();
      requestAnimationFrame(applyMirrorContentInset);
    });
  };
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
