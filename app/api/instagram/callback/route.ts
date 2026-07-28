import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchIgProfile,
} from "@/lib/instagram/client";
import { upsertConnectedAccount } from "@/lib/data/instagram";
import { getSiteOrigin } from "@/lib/instagram/config";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "instagram_oauth_state";

/** OAuth redirect target from Instagram. */
export async function GET(request: Request) {
  const origin = getSiteOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  const fail = (msg: string) => {
    const dest = new URL("/admin/instagram", origin);
    dest.searchParams.set("error", msg);
    const res = NextResponse.redirect(dest);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (oauthError) {
    return fail(errorDescription || errorReason || oauthError);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return fail("Invalid OAuth state. Try connecting again.");
  }

  if (!code) {
    return fail("Missing authorization code from Instagram.");
  }

  try {
    const short = await exchangeCodeForShortLivedToken(code);
    const longLived = await exchangeForLongLivedToken(short.accessToken);
    const profile = await fetchIgProfile(longLived.accessToken);
    const igUserId = profile.id || short.userId;
    if (!igUserId) {
      return fail("Instagram did not return a user id.");
    }

    await upsertConnectedAccount({
      igUserId,
      username: profile.username,
      accessToken: longLived.accessToken,
      expiresInSeconds: longLived.expiresIn,
    });

    const dest = new URL("/admin/instagram", origin);
    dest.searchParams.set("connected", "1");
    const res = NextResponse.redirect(dest);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error ? e.message : "Instagram connect failed");
  }
}
