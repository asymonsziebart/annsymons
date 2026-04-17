import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";
import { clampFocus, clampZoom } from "@/lib/statePhotos/framing";
import { normalizeStateCode } from "@/lib/statePhotos/states";

function isTrustedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h.endsWith(".vercel-storage.com");
  } catch {
    return false;
  }
}

type RegisterBody = {
  stateCode?: string;
  publicUrl?: string;
  originalName?: string | null;
  focus_x?: number;
  focus_y?: number;
  zoom?: number;
};

/** Persist a client-uploaded blob URL into Neon (small JSON body — no 413). */
export async function POST(request: Request): Promise<NextResponse> {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let parsed: RegisterBody;
  try {
    parsed = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = normalizeStateCode(String(parsed.stateCode ?? ""));
  const publicUrl = String(parsed.publicUrl ?? "").trim();
  if (!code || !publicUrl || !isTrustedImageUrl(publicUrl)) {
    return NextResponse.json({ error: "Invalid state or URL" }, { status: 400 });
  }

  const fx = clampFocus(Number(parsed.focus_x));
  const fy = clampFocus(Number(parsed.focus_y));
  const z = clampZoom(Number(parsed.zoom));
  const originalName =
    parsed.originalName != null && String(parsed.originalName).length > 0
      ? String(parsed.originalName).slice(0, 255)
      : null;

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM state_photos WHERE state_code = ${code}
    `;
    const row0 = Array.isArray(rows) ? rows[0] : rows;
    const n = Number((row0 as { n: number })?.n ?? 0);
    const isCover = n === 0;

    await sql`
      INSERT INTO state_photos (state_code, public_url, original_name, is_cover, focus_x, focus_y, frame_zoom)
      VALUES (${code}, ${publicUrl}, ${originalName}, ${isCover}, ${fx}, ${fy}, ${z})
    `;
  } catch (e) {
    console.error("statephotos register:", e);
    return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
  }

  revalidatePath("/statephotos");
  revalidatePath(`/statephotos/${code}`);

  return NextResponse.json({ ok: true });
}
