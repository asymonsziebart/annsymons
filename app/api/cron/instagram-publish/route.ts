import { NextResponse } from "next/server";
import { publishDueInstagramPosts } from "@/lib/data/instagram";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron (or manual): GET with Authorization: Bearer CRON_SECRET
 * Publishes Instagram posts whose scheduled_at is due.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await publishDueInstagramPosts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Cron failed" },
      { status: 500 }
    );
  }
}
