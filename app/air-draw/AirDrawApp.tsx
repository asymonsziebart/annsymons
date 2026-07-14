"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

type DrawMode = "idle" | "draw" | "erase";
type Phase = "boot" | "ready" | "starting" | "live" | "error";

const COLORS = ["#ff8b6a", "#7ee0c3", "#9bb4ff", "#f4e27c", "#f4f0ea", "#ff6ad5"] as const;
/** Must match the installed `@mediapipe/tasks-vision` major.minor.patch. */
const MEDIAPIPE_VERSION = "0.10.35";
const WASM_URLS = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
] as const;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Keep drawing through brief MediaPipe drops. */
const LOST_HAND_GRACE_MS = 180;
/** Require a few matching frames before changing draw/erase/idle. */
const MODE_CONFIRM_FRAMES = 3;
/** Ignore tiny landmark jitter (normalized coords). */
const JUMP_REJECT = 0.35;

type LandmarkPoint = Pick<NormalizedLandmark, "x" | "y" | "z">;

/** Low-lag smoother (One Euro Filter) for fingertip x/y. */
class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff: number
  ) {}

  reset() {
    this.x = null;
    this.dx = 0;
    this.lastT = null;
  }

  filter(v: number, t: number): number {
    if (this.x == null || this.lastT == null) {
      this.x = v;
      this.lastT = t;
      this.dx = 0;
      return v;
    }
    const dt = Math.max(0.001, (t - this.lastT) / 1000);
    this.lastT = t;
    const edx = this.smoothingFactor(dt, this.dCutoff);
    const dx = ((v - this.x) / dt) * edx + this.dx * (1 - edx);
    this.dx = dx;
    const cutoff = this.minCutoff + this.beta * Math.abs(dx);
    const ex = this.smoothingFactor(dt, cutoff);
    this.x = v * ex + this.x * (1 - ex);
    return this.x;
  }

  private smoothingFactor(dt: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }
}

function isFingerExtended(landmarks: LandmarkPoint[], tip: number, pip: number): boolean {
  const tipToWrist = Math.hypot(
    landmarks[tip].x - landmarks[0].x,
    landmarks[tip].y - landmarks[0].y
  );
  const pipToWrist = Math.hypot(
    landmarks[pip].x - landmarks[0].x,
    landmarks[pip].y - landmarks[0].y
  );
  const tipAhead = tipToWrist > pipToWrist * 1.12;
  // Works for most upright camera poses; also allow sideways-ish hands via distance ratio alone.
  const tipPastPip =
    landmarks[tip].y < landmarks[pip].y - 0.01 ||
    Math.abs(landmarks[tip].x - landmarks[pip].x) > 0.035;
  return tipAhead && tipPastPip;
}

function countExtendedFingers(landmarks: LandmarkPoint[]) {
  const index = isFingerExtended(landmarks, 8, 6);
  const middle = isFingerExtended(landmarks, 12, 10);
  const ring = isFingerExtended(landmarks, 16, 14);
  const pinky = isFingerExtended(landmarks, 20, 18);
  const thumb =
    Math.hypot(landmarks[4].x - landmarks[2].x, landmarks[4].y - landmarks[2].y) >
    Math.hypot(landmarks[3].x - landmarks[2].x, landmarks[3].y - landmarks[2].y) * 1.2;
  const others = [middle, ring, pinky].filter(Boolean).length;
  return { index, middle, ring, pinky, thumb, others, count: (index ? 1 : 0) + others + (thumb ? 1 : 0) };
}

function resolveMode(landmarks: LandmarkPoint[]): DrawMode {
  const f = countExtendedFingers(landmarks);
  // Palm erase: index+middle+ring (+ optional pinky/thumb).
  if (f.index && f.middle && f.ring) return "erase";
  // Draw: index clearly up, other long fingers down.
  if (f.index && f.others === 0) return "draw";
  return "idle";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

async function createHandLandmarker(): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  let lastError: unknown;

  const optionsBase = {
    runningMode: "VIDEO" as const,
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.45,
  };

  for (const wasmUrl of WASM_URLS) {
    try {
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      try {
        return await HandLandmarker.createFromOptions(vision, {
          ...optionsBase,
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
        });
      } catch {
        return await HandLandmarker.createFromOptions(vision, {
          ...optionsBase,
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
        });
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not load hand tracking.");
}

function statusLabel(phase: Phase, mode: DrawMode): string {
  if (phase === "boot") return "Loading";
  if (phase === "ready") return "Ready";
  if (phase === "starting") return "Starting";
  if (phase === "error") return "Camera error";
  if (mode === "draw") return "Drawing";
  if (mode === "erase") return "Erasing";
  return "Hovering";
}

export default function AirDrawApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const colorRef = useRef<string>(COLORS[0]);
  const brushRef = useRef(8);
  const runningRef = useRef(false);
  const modeRef = useRef<DrawMode>("idle");
  const pendingModeRef = useRef<DrawMode>("idle");
  const pendingModeCountRef = useRef(0);
  const lastHandSeenRef = useRef(0);
  const lastRawNormRef = useRef<{ x: number; y: number } | null>(null);
  const filterXRef = useRef(new OneEuroFilter(1.4, 0.02, 1.0));
  const filterYRef = useRef(new OneEuroFilter(1.4, 0.02, 1.0));

  const [phase, setPhase] = useState<Phase>("boot");
  const [mode, setMode] = useState<DrawMode>("idle");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [brush, setBrush] = useState(8);

  colorRef.current = color;
  brushRef.current = brush;

  const setStableMode = useCallback((next: DrawMode) => {
    if (modeRef.current === next) {
      pendingModeRef.current = next;
      pendingModeCountRef.current = 0;
      return;
    }
    if (pendingModeRef.current !== next) {
      pendingModeRef.current = next;
      pendingModeCountRef.current = 1;
      return;
    }
    pendingModeCountRef.current += 1;
    if (pendingModeCountRef.current < MODE_CONFIRM_FRAMES) return;
    modeRef.current = next;
    pendingModeCountRef.current = 0;
    setMode(next);
    // Starting a fresh stroke after a mode change avoids stray connectors.
    if (next === "idle") lastPointRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    lastPointRef.current = null;
    lastRawNormRef.current = null;
    filterXRef.current.reset();
    filterYRef.current.reset();
    modeRef.current = "idle";
    pendingModeRef.current = "idle";
    pendingModeCountRef.current = 0;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastPointRef.current = null;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    // Preserve existing drawing across resizes.
    const prev = document.createElement("canvas");
    prev.width = canvas.width;
    prev.height = canvas.height;
    const pctx = prev.getContext("2d");
    if (pctx && canvas.width > 0 && canvas.height > 0) {
      pctx.drawImage(canvas, 0, 0);
    }
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (prev.width > 0 && prev.height > 0) {
      ctx.drawImage(prev, 0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initModel() {
      try {
        const landmarker = await createHandLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setPhase("ready");
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(errorMessage(e, "Could not load hand tracking."));
      }
    }

    void initModel();
    return () => {
      cancelled = true;
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stopCamera]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "c" || e.key === "C") {
        e.preventDefault();
        clearCanvas();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearCanvas]);

  const paintAt = useCallback((x: number, y: number, nextMode: DrawMode) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const brush = brushRef.current;
    const prev = lastPointRef.current;

    if (nextMode === "draw") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = colorRef.current;
      ctx.fillStyle = colorRef.current;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brush;
      // Soft glow is pretty but expensive; keep it light.
      ctx.shadowColor = colorRef.current;
      ctx.shadowBlur = Math.min(10, brush * 0.7);
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      lastPointRef.current = { x, y };
      return;
    }

    if (nextMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.shadowBlur = 0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brush * 4;
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, brush * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      lastPointRef.current = { x, y };
      return;
    }

    lastPointRef.current = null;
  }, []);

  const updateCursor = useCallback((x: number, y: number, nextMode: DrawMode, visible: boolean) => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const scale = nextMode === "erase" ? 1.55 : nextMode === "draw" ? 1.12 : 1;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    cursor.classList.toggle("air-draw__cursor--visible", visible);
    cursor.classList.toggle("air-draw__cursor--draw", visible && nextMode === "draw");
    cursor.classList.toggle("air-draw__cursor--erase", visible && nextMode === "erase");
    cursor.classList.toggle("air-draw__cursor--idle", visible && nextMode === "idle");
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const canvas = drawCanvasRef.current;
    const now = performance.now();

    if (video && landmarker && canvas && video.readyState >= 2) {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarker.detectForVideo(video, now);
        const hand = result.landmarks[0];

        if (hand) {
          lastHandSeenRef.current = now;
          const rawX = 1 - hand[8].x;
          const rawY = hand[8].y;

          // Reject rare landmark teleports that cause stroke glitches.
          const prevNorm = lastRawNormRef.current;
          const jumped =
            !!prevNorm &&
            Math.hypot(rawX - prevNorm.x, rawY - prevNorm.y) > JUMP_REJECT &&
            modeRef.current !== "idle";

          if (!jumped) {
            lastRawNormRef.current = { x: rawX, y: rawY };
            const sx = filterXRef.current.filter(rawX, now);
            const sy = filterYRef.current.filter(rawY, now);
            const x = sx * canvas.clientWidth;
            const y = sy * canvas.clientHeight;

            setStableMode(resolveMode(hand));
            const activeMode = modeRef.current;
            updateCursor(x, y, activeMode, true);
            paintAt(x, y, activeMode);
          }
        } else if (now - lastHandSeenRef.current > LOST_HAND_GRACE_MS) {
          setStableMode("idle");
          lastPointRef.current = null;
          lastRawNormRef.current = null;
          filterXRef.current.reset();
          filterYRef.current.reset();
          updateCursor(0, 0, "idle", false);
        }
        // else: brief miss — keep last stroke tip; wait for hand to return
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [paintAt, setStableMode, updateCursor]);

  const startCamera = useCallback(async () => {
    if (!landmarkerRef.current) return;
    setPhase("starting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          // Lower resolution tracks much faster with little visual downside.
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing.");
      video.srcObject = stream;
      await video.play();
      resizeCanvas();
      filterXRef.current.reset();
      filterYRef.current.reset();
      lastRawNormRef.current = null;
      lastPointRef.current = null;
      modeRef.current = "idle";
      runningRef.current = true;
      setPhase("live");
      setMode("idle");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      stopCamera();
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Camera permission was denied. Allow the camera and try again."
      );
    }
  }, [loop, resizeCanvas, stopCamera]);

  const downloadPng = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `air-draw-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const phaseLive = phase === "live";

  return (
    <div className="air-draw">
      <header className="air-draw__top">
        <div className="air-draw__brand">
          <h1 className="air-draw__title">Air Draw</h1>
          <Link href="/" className="air-draw__home">
            annsymons.com
          </Link>
        </div>
        <div className="air-draw__status" aria-live="polite">
          <span
            className={`air-draw__status-dot${
              phaseLive
                ? mode === "draw"
                  ? " air-draw__status-dot--draw"
                  : mode === "erase"
                    ? " air-draw__status-dot--erase"
                    : " air-draw__status-dot--live"
                : ""
            }`}
            aria-hidden="true"
          />
          {statusLabel(phase, mode)}
        </div>
      </header>

      <div className="air-draw__stage">
        <video ref={videoRef} className="air-draw__video" playsInline muted />
        <canvas ref={drawCanvasRef} className="air-draw__canvas" aria-label="Air drawing canvas" />
        <div ref={cursorRef} className="air-draw__cursor" aria-hidden="true" />

        {phase !== "live" ? (
          <div className="air-draw__overlay">
            <div className="air-draw__card">
              <h2>Draw in the air</h2>
              <p>
                Point one finger to paint. Open your hand to erase. Your camera stays on this
                device — nothing is uploaded.
              </p>
              {error ? <p style={{ color: "#ff8b6a" }}>{error}</p> : null}
              <div className="air-draw__card-actions">
                <button
                  type="button"
                  className="air-draw__btn air-draw__btn--primary"
                  onClick={() => void startCamera()}
                  disabled={phase === "boot" || phase === "starting"}
                >
                  {phase === "boot"
                    ? "Loading tracker…"
                    : phase === "starting"
                      ? "Starting camera…"
                      : phase === "error"
                        ? "Try again"
                        : "Start camera"}
                </button>
                <Link href="/" className="air-draw__btn">
                  Back home
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="air-draw__toolbar">
        <p className="air-draw__hint">
          One finger = draw · open palm = erase · space/C = clear · curl fingers to hover
        </p>
        <div className="air-draw__swatches" role="group" aria-label="Brush colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`air-draw__swatch${color === c ? " air-draw__swatch--active" : ""}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="air-draw__tools">
          <label className="air-draw__status" style={{ textTransform: "none", letterSpacing: 0 }}>
            Size
            <input
              type="range"
              min={3}
              max={28}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              aria-label="Brush size"
              style={{ marginLeft: "0.45rem", width: "5.5rem", verticalAlign: "middle" }}
            />
          </label>
          <button type="button" className="air-draw__btn" onClick={clearCanvas}>
            Clear
          </button>
          <button type="button" className="air-draw__btn" onClick={downloadPng} disabled={!phaseLive}>
            Save PNG
          </button>
        </div>
      </footer>
    </div>
  );
}
