"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

import type { StateShape } from "@/lib/statePhotos/stateGeometry";
import { patternImageTransform } from "@/lib/statePhotos/framing";

import { savePhotoFraming, uploadStatePhoto } from "./actions";

type Props = {
  stateCode: string;
  coverUrl: string | null;
  coverId: number | null;
  framingF: [number, number, number];
  shape: StateShape | null;
  /** When true, file goes browser → Blob (avoids Vercel ~4.5 MB Server Action limit). */
  useClientBlobUpload: boolean;
};

function extFromFileName(name: string): string {
  const i = name.lastIndexOf(".");
  if (i === -1) return "jpg";
  const ext = name
    .slice(i + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

export default function FramingPreview({
  stateCode,
  coverUrl,
  coverId,
  framingF,
  shape,
  useClientBlobUpload,
}: Props) {
  const [fx, setFx] = useState(framingF[0]);
  const [fy, setFy] = useState(framingF[1]);
  const [z, setZ] = useState(framingF[2]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveCover = blobUrl ?? coverUrl;
  const transform = patternImageTransform(fx, fy, z);
  const usePattern = !!effectiveCover;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientError(null);
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = null;
    const f = e.target.files?.[0];
    if (!f) {
      setHasFile(false);
      setBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(f);
    lastUrl.current = u;
    setBlobUrl(u);
    setHasFile(true);
  };

  useEffect(() => {
    return () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, []);

  async function handleClientUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file || file.size === 0) {
      setClientError("Choose a photo to upload.");
      return;
    }

    setUploading(true);
    try {
      const ext = extFromFileName(file.name);
      const pathname = `statephotos/${crypto.randomUUID()}.${ext}`;
      const result = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/statephotos/blob-upload",
        multipart: file.size > 4 * 1024 * 1024,
      });

      const reg = await fetch("/api/statephotos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode,
          publicUrl: result.url,
          originalName: file.name,
          focus_x: fx,
          focus_y: fy,
          zoom: z,
        }),
      });

      if (!reg.ok) {
        window.location.href = `/statephotos/${stateCode}?err=register`;
        return;
      }

      window.location.href = `/statephotos/${stateCode}?ok=upload`;
      return;
    } catch (err) {
      console.error(err);
      setClientError(
        err instanceof Error ? err.message : "Upload failed. Try a smaller image or check your connection."
      );
    } finally {
      setUploading(false);
    }
  }

  if (!shape) return null;

  return (
    <>
      {clientError ? (
        <ul className="flash-list">
          <li className="flash flash-error" role="alert">
            {clientError}
          </li>
        </ul>
      ) : null}

      <section className="panel preview-panel" id="framing-root">
        <h2>How it looks on {stateCode}</h2>
        <p className="hint">
          Use the sliders to pan and zoom inside the outline. This matches the map (same crop rules).
        </p>
        <div className="preview-layout">
          <div className="preview-svg-wrap">
            <svg
              className="state-preview-svg"
              viewBox="0 0 959 593"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              {usePattern ? (
                <defs>
                  <pattern
                    id="preview-pat"
                    patternContentUnits="objectBoundingBox"
                    width={1}
                    height={1}
                  >
                    <image
                      id="preview-img"
                      width={1}
                      height={1}
                      preserveAspectRatio="xMidYMid slice"
                      href={effectiveCover}
                      transform={transform}
                    />
                  </pattern>
                </defs>
              ) : null}
              {shape.kind === "path" ? (
                <path
                  id="preview-shape"
                  fill={usePattern ? "url(#preview-pat)" : "#2a3544"}
                  stroke="#e7ecf3"
                  strokeWidth={1.2}
                  strokeOpacity={0.35}
                  d={shape.d}
                />
              ) : (
                <circle
                  id="preview-shape"
                  fill={usePattern ? "url(#preview-pat)" : "#2a3544"}
                  stroke="#e7ecf3"
                  strokeWidth={1.2}
                  strokeOpacity={0.35}
                  cx={shape.cx}
                  cy={shape.cy}
                  r={shape.r}
                />
              )}
            </svg>
          </div>
          <div className="preview-controls">
            <div className="slider-row">
              <label htmlFor="slider-focus-x">
                Horizontal <span className="slider-val">{Math.round(fx)}</span>
              </label>
              <input
                id="slider-focus-x"
                type="range"
                min={0}
                max={100}
                step={1}
                value={fx}
                onChange={(e) => setFx(Number(e.target.value))}
              />
            </div>
            <div className="slider-row">
              <label htmlFor="slider-focus-y">
                Vertical <span className="slider-val">{Math.round(fy)}</span>
              </label>
              <input
                id="slider-focus-y"
                type="range"
                min={0}
                max={100}
                step={1}
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
              />
            </div>
            <div className="slider-row">
              <label htmlFor="slider-zoom">
                Zoom <span className="slider-val">{z.toFixed(2)}</span>
              </label>
              <input
                id="slider-zoom"
                type="range"
                min={1}
                max={2.5}
                step={0.02}
                value={z}
                onChange={(e) => setZ(Number(e.target.value))}
              />
            </div>
            <p className="hint tiny">
              Horizontal / vertical shift which part of the photo sits in the center (like object-position).
              Zoom crops tighter.
            </p>
          </div>
        </div>
      </section>

      <section className="panel upload-panel">
        <h2>Add a photo</h2>
        {useClientBlobUpload ? (
          <form onSubmit={handleClientUpload} className="upload-form">
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              id="photo-input"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileChange}
            />
            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </form>
        ) : (
          <form action={uploadStatePhoto} encType="multipart/form-data" className="upload-form">
            <input type="hidden" name="state_code" value={stateCode} />
            <input type="hidden" name="focus_x" value={fx} />
            <input type="hidden" name="focus_y" value={fy} />
            <input type="hidden" name="zoom" value={z} />
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              id="photo-input"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileChange}
            />
            <button type="submit">Upload</button>
          </form>
        )}
        <p className="hint">
          Pick a file to load it into the preview above, adjust framing, then upload. First photo for this state
          becomes the cover automatically.
          {useClientBlobUpload
            ? " On Vercel, large files upload directly to Blob (not through the server), so you are not limited to ~4.5 MB."
            : " Without Vercel Blob configured, keep files under about 4 MB on deployed sites to avoid errors."}
        </p>
      </section>

      {coverId != null ? (
        <section className="panel frame-save-panel">
          <h2>Save cover framing</h2>
          <p className="hint">If this photo is your map cover, save slider settings without re-uploading.</p>
          <form action={savePhotoFraming}>
            <input type="hidden" name="photo_id" value={coverId} />
            <input type="hidden" name="focus_x" value={fx} />
            <input type="hidden" name="focus_y" value={fy} />
            <input type="hidden" name="zoom" value={z} />
            <button type="submit" className="btn-secondary" id="frame-save-btn" disabled={hasFile}>
              Save framing for cover
            </button>
          </form>
          <p className="hint tiny" id="frame-blocked-hint" hidden={!hasFile}>
            Clear the new file picker to save framing for your current cover.
          </p>
        </section>
      ) : null}
    </>
  );
}
