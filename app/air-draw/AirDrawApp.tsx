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

type LandmarkPoint = Pick<NormalizedLandmark, "x" | "y" | "z">;

function isFingerExtended(
  landmarks: LandmarkPoint[],
  tip: number,
  pip: number,
  _mcp: number
): boolean {
  const tipToWrist = Math.hypot(landmarks[tip].x - landmarks[0].x, landmarks[tip].y - landmarks[0].y);
  const pipToWrist = Math.hypot(landmarks[pip].x - landmarks[0].x, landmarks[pip].y - landmarks[0].y);
  const tipAbovePip = landmarks[tip].y < landmarks[pip].y - 0.015;
  return tipToWrist > pipToWrist * 1.08 && tipAbovePip;
}

function countExtendedFingers(landmarks: LandmarkPoint[]): {
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  thumb: boolean;
  count: number;
} {
  const index = isFingerExtended(landmarks, 8, 6, 5);
  const middle = isFingerExtended(landmarks, 12, 10, 9);
  const ring = isFingerExtended(landmarks, 16, 14, 13);
  const pinky = isFingerExtended(landmarks, 20, 18, 17);
  const thumb =
    Math.hypot(landmarks[4].x - landmarks[2].x, landmarks[4].y - landmarks[2].y) >
    Math.hypot(landmarks[3].x - landmarks[2].x, landmarks[3].y - landmarks[2].y) * 1.15;
  const count = [index, middle, ring, pinky].filter(Boolean).length + (thumb ? 1 : 0);
  return { index, middle, ring, pinky, thumb, count };
}

function resolveMode(landmarks: LandmarkPoint[]): DrawMode {
  const f = countExtendedFingers(landmarks);
  if (f.count >= 4) return "erase";
  if (f.index && !f.middle && !f.ring && !f.pinky) return "draw";
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

  for (const wasmUrl of WASM_URLS) {
    try {
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      try {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load hand tracking.");
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
  const runningRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("boot");
  const [mode, setMode] = useState<DrawMode>("idle");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [brush, setBrush] = useState(8);

  colorRef.current = color;

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
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastPointRef.current = null;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  const paintAt = useCallback(
    (x: number, y: number, nextMode: DrawMode) => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const prev = lastPointRef.current;
      if (nextMode === "draw") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = colorRef.current;
        ctx.fillStyle = colorRef.current;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = brush;
        ctx.shadowColor = colorRef.current;
        ctx.shadowBlur = brush * 1.4;
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
    },
    [brush]
  );

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const cursor = cursorRef.current;
    const canvas = drawCanvasRef.current;

    if (video && landmarker && canvas && video.readyState >= 2) {
      const now = performance.now();
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarker.detectForVideo(video, now);
        const hand = result.landmarks[0];

        if (hand) {
          const nextMode = resolveMode(hand);
          setMode(nextMode);

          // Mirror X so drawing matches mirrored video.
          const x = (1 - hand[8].x) * canvas.clientWidth;
          const y = hand[8].y * canvas.clientHeight;

          if (cursor) {
            cursor.style.left = `${x}px`;
            cursor.style.top = `${y}px`;
            cursor.classList.add("air-draw__cursor--visible");
            cursor.classList.toggle("air-draw__cursor--draw", nextMode === "draw");
            cursor.classList.toggle("air-draw__cursor--erase", nextMode === "erase");
            cursor.classList.toggle("air-draw__cursor--idle", nextMode === "idle");
          }

          paintAt(x, y, nextMode);
        } else {
          setMode("idle");
          lastPointRef.current = null;
          cursor?.classList.remove(
            "air-draw__cursor--visible",
            "air-draw__cursor--draw",
            "air-draw__cursor--erase",
            "air-draw__cursor--idle"
          );
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [paintAt]);

  const startCamera = useCallback(async () => {
    if (!landmarkerRef.current) return;
    setPhase("starting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing.");
      video.srcObject = stream;
      await video.play();
      resizeCanvas();
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
          One finger = draw · open palm = erase · space/C = clear · pinch/curl fingers to hover
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
