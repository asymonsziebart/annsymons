import { createHash } from "crypto";
import {
  parseSiteUserCookie,
  SITE_USER_COOKIE,
} from "@/lib/siteUserCookieParse";

export { parseSiteUserCookie, SITE_USER_COOKIE };

/** Keep in sync with lib/siteUserEdge.ts Web Crypto salt. */
export const SITE_USER_SESSION_SALT = "annsymons-site-user";

export function sessionTokenForUser(user: {
  id: number;
  passwordHash: string;
}): string {
  return createHash("sha256")
    .update(`${user.id}:${user.passwordHash}:${SITE_USER_SESSION_SALT}`)
    .digest("hex");
}

export function encodeSiteUserCookie(user: {
  id: number;
  passwordHash: string;
}): string {
  return `${user.id}.${sessionTokenForUser(user)}`;
}

export function siteUserCookieMatches(
  cookieValue: string | undefined,
  user: { id: number; passwordHash: string; status: string }
): boolean {
  const parsed = parseSiteUserCookie(cookieValue);
  if (!parsed || parsed.id !== user.id) return false;
  if (user.status !== "approved") return false;
  return parsed.token === sessionTokenForUser(user);
}
