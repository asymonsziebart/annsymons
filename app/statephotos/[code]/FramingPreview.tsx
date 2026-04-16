"use client";

import { useEffect, useRef, useState } from "react";

import type { StateShape } from "@/lib/statePhotos/stateGeometry";
import { patternImageTransform } from "@/lib/statePhotos/framing";

import { savePhotoFraming, uploadStatePhoto } from "./actions";

type Props = {
  stateCode: string;
  coverUrl: string | null;
  coverId: number | null;
  framingF: [number, number, number];
  shape: StateShape | null;
};

export default function FramingPreview({
  stateCode,
  coverUrl,
  coverId,
  framingF,
  shape,
}: Props) {
  const [fx, setFx] = useState(framingF[0]);
  const [fy, setFy] = useState(framingF[1]);
  const [z, setZ] = useState(framingF[2]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const lastUrl = useRef<string | null>(null);

  const effectiveCover = blobUrl ?? coverUrl;
  const transform = patternImageTransform(fx, fy, z);
  const usePattern = !!effectiveCover;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  if (!shape) return null;

  return (
    <>
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
        <form action={uploadStatePhoto} encType="multipart/form-data" className="upload-form">
          <input type="hidden" name="state_code" value={stateCode} />
          <input type="hidden" name="focus_x" value={fx} />
          <input type="hidden" name="focus_y" value={fy} />
          <input type="hidden" name="zoom" value={z} />
          <input
            type="file"
            name="photo"
            id="photo-input"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
          />
          <button type="submit">Upload</button>
        </form>
        <p className="hint">
          Pick a file to load it into the preview above, adjust framing, then upload. First photo for this state
          becomes the cover automatically.
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
