const MIN_SCALE = 0.45;
const MAX_SCALE = 1.35;
const STORAGE_KEY = "mirror-view-transform-v1";

type ViewTransform = {
  scale: number;
  x: number;
  y: number;
};

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function loadTransform(): ViewTransform {
  if (typeof window === "undefined") return { scale: 1, x: 0, y: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { scale: 1, x: 0, y: 0 };
    const parsed = JSON.parse(raw) as Partial<ViewTransform>;
    return {
      scale: clamp(Number(parsed.scale) || 1, MIN_SCALE, MAX_SCALE),
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
    };
  } catch {
    return { scale: 1, x: 0, y: 0 };
  }
}

function saveTransform(t: ViewTransform): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function applyTransform(el: HTMLElement, t: ViewTransform): void {
  el.style.setProperty("--mirror-user-scale", String(t.scale));
  el.style.setProperty("--mirror-pan-x", `${Math.round(t.x)}px`);
  el.style.setProperty("--mirror-pan-y", `${Math.round(t.y)}px`);
}

/**
 * Two-finger pinch to zoom and pan the mirror content.
 * Double-tap resets to the default view.
 */
export function bindMirrorGestures(): () => void {
  const inner = document.querySelector(".mirror-app__inner") as HTMLElement | null;
  if (!inner) return () => {};

  let transform = loadTransform();
  applyTransform(inner, transform);

  const pointers = new Map<number, Point>();
  let gesture:
    | {
        startDist: number;
        startScale: number;
        startMid: Point;
        startX: number;
        startY: number;
      }
    | null = null;
  let lastTapAt = 0;
  let lastTapPos: Point | null = null;

  const onPointerDown = (event: PointerEvent) => {
    // Ignore gestures while a modal/overlay is up.
    if (
      document.querySelector(".mirror-tasks") ||
      document.querySelector(".mirror-recipe") ||
      document.querySelector(".mirror-trainer-backdrop")
    ) {
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1 && event.isPrimary) {
      const now = Date.now();
      const pos = { x: event.clientX, y: event.clientY };
      if (
        lastTapPos &&
        now - lastTapAt < 320 &&
        Math.hypot(pos.x - lastTapPos.x, pos.y - lastTapPos.y) < 28
      ) {
        transform = { scale: 1, x: 0, y: 0 };
        applyTransform(inner, transform);
        saveTransform(transform);
        lastTapAt = 0;
        lastTapPos = null;
      } else {
        lastTapAt = now;
        lastTapPos = pos;
      }
    }

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = {
        startDist: Math.max(1, distance(a, b)),
        startScale: transform.scale,
        startMid: midpoint(a, b),
        startX: transform.x,
        startY: transform.y,
      };
      try {
        inner.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2 || !gesture) return;

    event.preventDefault();
    const [a, b] = [...pointers.values()];
    const dist = Math.max(1, distance(a, b));
    const mid = midpoint(a, b);
    const nextScale = clamp(
      gesture.startScale * (dist / gesture.startDist),
      MIN_SCALE,
      MAX_SCALE
    );
    transform = {
      scale: nextScale,
      x: gesture.startX + (mid.x - gesture.startMid.x),
      y: gesture.startY + (mid.y - gesture.startMid.y),
    };
    applyTransform(inner, transform);
  };

  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      if (gesture) saveTransform(transform);
      gesture = null;
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length >= 2) event.preventDefault();
  };

  inner.addEventListener("pointerdown", onPointerDown);
  inner.addEventListener("pointermove", onPointerMove);
  inner.addEventListener("pointerup", endPointer);
  inner.addEventListener("pointercancel", endPointer);
  inner.addEventListener("pointerleave", endPointer);
  // Non-passive so two-finger browser scroll/zoom can be blocked on the content.
  inner.addEventListener("touchmove", onTouchMove, { passive: false });

  return () => {
    inner.removeEventListener("pointerdown", onPointerDown);
    inner.removeEventListener("pointermove", onPointerMove);
    inner.removeEventListener("pointerup", endPointer);
    inner.removeEventListener("pointercancel", endPointer);
    inner.removeEventListener("pointerleave", endPointer);
    inner.removeEventListener("touchmove", onTouchMove);
  };
}
