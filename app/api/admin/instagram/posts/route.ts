import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  createInstagramPost,
  listInstagramPosts,
} from "@/lib/data/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const posts = await listInstagramPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const post = await createInstagramPost({
      image_url: body.image_url,
      caption: body.caption,
      scheduled_at: body.scheduled_at ?? null,
      status: body.status === "scheduled" ? "scheduled" : "draft",
    });
    return NextResponse.json({ post });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create post" },
      { status: 400 }
    );
  }
}
