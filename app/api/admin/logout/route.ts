import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { clearSiteUserSession } from "@/lib/siteUserAuth";

export async function POST() {
  await clearAdminSession();
  await clearSiteUserSession();
  return NextResponse.json({ ok: true });
}
