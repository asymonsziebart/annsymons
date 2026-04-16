import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSql } from "@/lib/db";
import { listPhotosForState, type StatePhotoRow } from "@/lib/data/statePhotos";
import { photoFramingValues } from "@/lib/statePhotos/framing";
import { normalizeStateCode, STATE_NAMES } from "@/lib/statePhotos/states";
import { getShapesForSvg } from "@/lib/statePhotos/stateGeometry";

import { setPhotoCover } from "./actions";
import DeletePhotoForm from "./DeletePhotoForm";
import FramingPreview from "./FramingPreview";

type Search = { ok?: string; err?: string };

export default async function StatePhotoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Search>;
}) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = normalizeStateCode(raw);
  if (!code) notFound();

  const sql = getSql();
  const svgPath = path.join(process.cwd(), "public", "statephotos", "us_states.svg");
  const svgXml = await fs.readFile(svgPath, "utf8");
  const shapes = getShapesForSvg(svgXml);
  const shape = shapes[code] ?? null;
  if (!shape) notFound();

  let photos: StatePhotoRow[] = [];
  if (sql) {
    photos = await listPhotosForState(code);
  }

  const cover = photos.find((p) => p.is_cover) ?? null;
  const framingF = cover ? photoFramingValues(cover) : ([50, 50, 1] as [number, number, number]);

  const errMsg =
    sp.err === "no-database"
      ? "Database is not configured."
      : sp.err === "no-file"
        ? "Choose a photo to upload."
        : sp.err === "upload"
          ? "Upload failed. On production, set BLOB_READ_WRITE_TOKEN in Vercel."
          : sp.err === "save"
            ? "Could not save. Run db/state-photos.sql in Neon if the table is missing."
            : sp.err
              ? "Something went wrong."
              : null;

  const okMsg =
    sp.ok === "upload"
      ? "Photo uploaded."
      : sp.ok === "cover"
        ? "Cover updated."
        : sp.ok === "frame"
          ? "Framing saved."
          : sp.ok === "delete"
            ? "Photo removed."
            : sp.ok
              ? "Saved."
              : null;

  return (
    <>
      {errMsg ? (
        <ul className="flash-list">
          <li className="flash flash-error">{errMsg}</li>
        </ul>
      ) : null}
      {okMsg ? (
        <ul className="flash-list">
          <li className="flash flash-ok">{okMsg}</li>
        </ul>
      ) : null}

      {!sql ? (
        <p className="intro">
          Set <strong>DATABASE_URL</strong> and run <code className="text-[var(--accent)]">db/state-photos.sql</code> in
          Neon.
        </p>
      ) : null}

      <nav className="crumb">
        <Link href="/statephotos">Map</Link> / {code}
      </nav>
      <h1 className="page-title">
        {STATE_NAMES[code]} <span className="code">({code})</span>
      </h1>

      {sql ? (
        <FramingPreview
          stateCode={code}
          coverUrl={cover?.public_url ?? null}
          coverId={cover?.id ?? null}
          framingF={framingF}
          shape={shape}
        />
      ) : null}

      {sql && photos.length > 0 ? (
        <section className="panel gallery-panel">
          <h2>
            Photos <span className="count">({photos.length})</span>
          </h2>
          <ul className="photo-grid">
            {photos.map((p) => (
              <li key={p.id} className={`photo-card ${p.is_cover ? "is-cover" : ""}`}>
                <a href={p.public_url} target="_blank" rel="noopener noreferrer">
                  <img src={p.public_url} alt="" loading="lazy" />
                </a>
                <div className="photo-meta">
                  {p.is_cover ? (
                    <span className="badge">Cover</span>
                  ) : (
                    <form action={setPhotoCover} className="inline-form">
                      <input type="hidden" name="photo_id" value={p.id} />
                      <button type="submit" className="btn-secondary">
                        Set as cover
                      </button>
                    </form>
                  )}
                  <DeletePhotoForm photoId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : sql ? (
        <p className="empty">No photos yet for this state. Choose a file above to see it in the outline, then upload.</p>
      ) : null}
    </>
  );
}
