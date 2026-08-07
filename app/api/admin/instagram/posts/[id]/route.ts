import { NextResponse } from "next/server";
import { isSharedAdmin } from "@/lib/auth";
import {
  deleteInstagramPost,
  updateInstagramPost,
} from "@/lib/data/instagram";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  const ok = await isSharedAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const post = await updateInstagramPost(id, {
      image_url: body.image_url,
      caption: body.caption,
      scheduled_at: body.scheduled_at,
      status: body.status === "scheduled" ? "scheduled" : body.status === "draft" ? "draft" : undefined,
      clear_error: Boolean(body.clear_error),
    });
    return NextResponse.json({ post });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const ok = await isSharedAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await deleteInstagramPost(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 400 }
    );
  }
}
