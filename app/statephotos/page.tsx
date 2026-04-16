import fs from "fs/promises";
import path from "path";

import { getSql } from "@/lib/db";
import { getCoverSpecsForMap } from "@/lib/data/statePhotos";
import { buildMapSvg } from "@/lib/statePhotos/svgMap";

const PREFIX = "/statephotos";

type Search = { ok?: string; err?: string };

export default async function StatePhotosMapPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const sql = getSql();
  const svgPath = path.join(process.cwd(), "public", "statephotos", "us_states.svg");
  const svgXml = await fs.readFile(svgPath, "utf8");

  if (!sql) {
    return (
      <>
        <p className="intro">
          Connect a Neon <strong>postgresql://</strong> <strong>DATABASE_URL</strong>, then run{" "}
          <code className="text-[var(--accent)]">db/state-photos.sql</code> in the Neon SQL editor. For uploads on
          Vercel, add <strong>BLOB_READ_WRITE_TOKEN</strong>. (Non-Postgres URLs are ignored here so the map still
          loads.)
        </p>
        <div className="map-wrap opacity-40" dangerouslySetInnerHTML={{ __html: buildMapSvg(svgXml, {}, PREFIX) }} />
      </>
    );
  }

  const covers = await getCoverSpecsForMap();
  const mapSvg = buildMapSvg(svgXml, covers, PREFIX);

  return (
    <>
      {sp.err ? (
        <ul className="flash-list">
          <li className="flash flash-error">Something went wrong. Try again.</li>
        </ul>
      ) : null}
      {sp.ok ? (
        <ul className="flash-list">
          <li className="flash flash-ok">Saved.</li>
        </ul>
      ) : null}
      <section className="map-section">
        <p className="intro">
          Click any state to add photos or set a cover. States with a cover show your photo on the map.
        </p>
        <div className="map-wrap" dangerouslySetInnerHTML={{ __html: mapSvg }} />
      </section>
    </>
  );
}
