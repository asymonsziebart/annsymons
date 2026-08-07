import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { isSharedAdmin } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/instagram/client";
import { getSiteOrigin, isInstagramConfigured } from "@/lib/instagram/config";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "instagram_oauth_state";

/** Start Instagram Business Login (admin only). */
export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const siteOrigin = getSiteOrigin();

  const ok = await isSharedAdmin();
  if (!ok) {
    return NextResponse.redirect(
      new URL("/admin/login?next=/admin/instagram", requestOrigin)
    );
  }

  if (!isInstagramConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/instagram?error=not_configured", requestOrigin)
    );
  }

  try {
    const state = randomBytes(24).toString("hex");
    const url = buildAuthorizeUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || siteOrigin.startsWith("https"),
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      new URL("/admin/instagram?error=oauth_start_failed", requestOrigin)
    );
  }
}
