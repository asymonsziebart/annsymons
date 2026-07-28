import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { publishInstagramPostNow } from "@/lib/data/instagram";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Publish a draft/scheduled/failed post immediately. */
export async function POST(_request: Request, ctx: Ctx) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const post = await publishInstagramPostNow(id);
    return NextResponse.json({ post });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed" },
      { status: 502 }
    );
  }
}
