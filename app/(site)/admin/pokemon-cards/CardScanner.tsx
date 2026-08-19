"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardScanResult } from "@/lib/cardScan";
import type { CollectionCategory } from "@/lib/collectionCardsShared";

type Phase = "idle" | "starting" | "live" | "uploading" | "scanning" | "error";

type Props = {
  category: CollectionCategory;
  onScanned: (card: CardScanResult, imagePath: string) => void;
  onCancel: () => void;
};

async function uploadCardPhoto(file: Blob): Promise<string> {
  const form = new FormData();
  form.set("file", file, `card-scan-${Date.now()}.jpg`);
  form.set("folder", "pokemon-cards");
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = (await res.json()) as { path?: string; error?: string };
  if (!res.ok || !data.path) throw new Error(data.error || "Upload failed");
  return data.path;
}

async function scanCardPhoto(
  imagePath: string,
  category: CollectionCategory
): Promise<{ card: CardScanResult; imagePath: string }> {
  const res = await fetch("/api/admin/pokemon-cards/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagePath, category }),
  });
  const data = (await res.json()) as {
    card?: CardScanResult;
    imagePath?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Scan failed");
  if (!data.card) throw new Error("Scan returned no card details.");
  return { card: data.card, imagePath: data.imagePath ?? imagePath };
}

function captureVideoFrame(video: HTMLVideoElement): Blob {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture photo.");
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const binary = atob(dataUrl.split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

export default function CardScanner({ category, onScanned, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("Center the card in frame with good lighting.");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const processFile = useCallback(
    async (file: Blob) => {
      setPhase("uploading");
      setError(null);
      setHint("Uploading photo...");
      try {
        const imagePath = await uploadCardPhoto(file);
        setPhase("scanning");
        setHint("Reading card name, set, and number...");
        const result = await scanCardPhoto(imagePath, category);
        if (!result.card.configured || !result.card.name) {
          onScanned(result.card, result.imagePath);
          return;
        }
        stopCamera();
        onScanned(result.card, result.imagePath);
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : "Scan failed");
        setHint("Try again with the card flat and filling most of the frame.");
      }
    },
    [category, onScanned, stopCamera]
  );

  const startCamera = useCallback(async () => {
    setPhase("starting");
    setError(null);
    setHint("Starting camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview missing.");
      video.srcObject = stream;
      await video.play();
      setPhase("live");
      setHint("Hold steady, then tap Capture.");
    } catch (e) {
      stopCamera();
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Camera access denied. Use Upload photo instead."
      );
    }
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    await processFile(captureVideoFrame(video));
  }, [processFile]);

  const onFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      await processFile(file);
    },
    [processFile]
  );

  const busy = phase === "uploading" || phase === "scanning" || phase === "starting";

  return (
    <section className="pc-panel pc-scanner">
      <div className="pc-panel-head">
        <h2>Scan card</h2>
        <button type="button" className="pc-btn pc-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      <div className="pc-panel-body">
        <p className="pc-scanner-hint">{hint}</p>

        <div className="pc-scanner-stage">
          <video
            ref={videoRef}
            className={`pc-scanner-video${phase === "live" ? " pc-scanner-video--live" : ""}`}
            playsInline
            muted
          />
          {phase !== "live" ? (
            <div className="pc-scanner-placeholder">
              <span>Camera preview</span>
            </div>
          ) : (
            <div className="pc-scanner-frame" aria-hidden />
          )}
        </div>

        {error ? (
          <p className="pc-status" data-tone="warn">
            {error}
          </p>
        ) : null}

        <div className="pc-actions pc-scanner-actions">
          {phase === "live" ? (
            <button
              type="button"
              className="pc-btn pc-btn-primary"
              onClick={() => void capture()}
              disabled={busy}
            >
              Capture
            </button>
          ) : (
            <button
              type="button"
              className="pc-btn pc-btn-primary"
              onClick={() => void startCamera()}
              disabled={busy}
            >
              {phase === "starting"
                ? "Starting..."
                : phase === "uploading" || phase === "scanning"
                  ? "Working..."
                  : phase === "error"
                    ? "Retry camera"
                    : "Start camera"}
            </button>
          )}
          <button
            type="button"
            className="pc-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Upload photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="pc-scanner-file"
            onChange={(e) => void onFileChange(e)}
          />
        </div>
      </div>
    </section>
  );
}
