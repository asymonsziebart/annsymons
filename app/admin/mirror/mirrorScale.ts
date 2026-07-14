/** Scale mirror typography from real pixel dimensions (works when vmin/vw lie on Android). */
export function applyMirrorTypography(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  if (!root) return;

  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;

  // Width for the bottom-left content block.
  const panelW = Math.min(w * 0.78, w - 24);
  // Type scales from the shorter side of a readable content box.
  const basis = Math.min(panelW, h * 0.55);

  const timePx = Math.round(basis * 0.3);
  const datePx = Math.round(basis * 0.095);
  const weatherPx = Math.round(basis * 0.125);
  const taskPx = Math.round(basis * 0.07);
  const taskLabelPx = Math.round(basis * 0.034);

  root.style.setProperty("--mirror-panel-width", `${Math.round(panelW)}px`);
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

/**
 * If the bottom-anchored block would run under the top chrome / off-screen,
 * gently shrink type so clock + weather + tasks all stay visible.
 */
export function fitMirrorContentToViewport(): void {
  const root = document.querySelector(".mirror-app") as HTMLElement | null;
  const inner = document.querySelector(".mirror-app__inner") as HTMLElement | null;
  const content = document.querySelector(".mirror-app__content") as HTMLElement | null;
  if (!root || !inner || !content) return;

  const vv = window.visualViewport;
  const viewH = vv?.height ?? window.innerHeight;
  const topSafe = 56; // leave room for voice pill / status
  const bottomSafe = 16;
  const maxBlock = Math.max(180, viewH - topSafe - bottomSafe);

  // Reset any previous shrink so we measure natural size.
  root.style.setProperty("--mirror-fit-scale", "1");

  const natural = content.getBoundingClientRect().height;
  if (natural <= maxBlock || natural <= 0) return;

  const scale = Math.max(0.72, Math.min(1, maxBlock / natural));
  root.style.setProperty("--mirror-fit-scale", String(scale));
}

export function bindMirrorTypography(): () => void {
  const update = () => {
    applyMirrorTypography();
    requestAnimationFrame(() => {
      applyMirrorContentInset();
      fitMirrorContentToViewport();
      requestAnimationFrame(() => {
        applyMirrorContentInset();
        fitMirrorContentToViewport();
      });
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
