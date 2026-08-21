"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardScanResult, CollectionCategory } from "@/lib/collectionCardsShared";
import { uploadAndScanCardPhoto } from "@/lib/cardScanClient";

type Phase = "idle" | "starting" | "live" | "uploading" | "scanning" | "error";

type Props = {
  category: CollectionCategory;
  onScanned: (card: CardScanResult, imagePath: string) => void;
  onCancel: () => void;
  /** When true, open the photo library picker immediately (no card in hand). */
  startWithUpload?: boolean;
};

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

export default function CardScanner({
  category,
  onScanned,
  onCancel,
  startWithUpload = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoUploadRef = useRef(startWithUpload);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(
    "No card in front of you? Upload a saved photo. Otherwise start the camera."
  );

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
        setPhase("scanning");
        setHint("Reading card name, set, and number...");
        const result = await uploadAndScanCardPhoto(file, category);
        stopCamera();
        onScanned(result.card, result.imagePath);
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : "Scan failed");
        setHint("Try another photo with the card flat and filling most of the frame.");
      }
    },
    [category, onScanned, stopCamera]
  );

  useEffect(() => {
    if (!autoUploadRef.current) return;
    autoUploadRef.current = false;
    fileRef.current?.click();
  }, []);

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
          <button
            type="button"
            className="pc-btn pc-btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {phase === "uploading" || phase === "scanning" ? "Working..." : "Upload photo"}
          </button>
          {phase === "live" ? (
            <button
              type="button"
              className="pc-btn"
              onClick={() => void capture()}
              disabled={busy}
            >
              Capture
            </button>
          ) : (
            <button
              type="button"
              className="pc-btn"
              onClick={() => void startCamera()}
              disabled={busy}
            >
              {phase === "starting"
                ? "Starting..."
                : phase === "error"
                  ? "Retry camera"
                  : "Start camera"}
            </button>
          )}
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
