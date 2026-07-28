import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  disconnectInstagramAccount,
  getConnectedAccountPublic,
} from "@/lib/data/instagram";
import { isInstagramConfigured } from "@/lib/instagram/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getConnectedAccountPublic();
  return NextResponse.json({
    configured: isInstagramConfigured(),
    account,
  });
}

export async function DELETE() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await disconnectInstagramAccount();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
