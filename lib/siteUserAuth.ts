import { cookies } from "next/headers";
import {
  authenticateSiteUser,
  getSiteUserById,
  type SiteUserAuthRow,
  type SiteUserRow,
} from "@/lib/data/siteUsers";
import {
  encodeSiteUserCookie,
  sessionTokenForUser,
  SITE_USER_COOKIE,
} from "@/lib/siteUserSessionToken";
import { parseSiteUserCookie } from "@/lib/siteUserCookieParse";
import { getSql } from "@/lib/db";
import {
  ensureOwnerAccount,
  getOwnerEmail,
  getOwnerLoginPassword,
  syncOwnerPasswordFromAdminEnv,
} from "@/lib/ownerAccount";

export { SITE_USER_COOKIE };

export async function setSiteUserSession(user: SiteUserAuthRow): Promise<void> {
  const c = await cookies();
  c.set(SITE_USER_COOKIE, encodeSiteUserCookie(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  });
}

export async function clearSiteUserSession(): Promise<void> {
  const c = await cookies();
  c.delete(SITE_USER_COOKIE);
}

export async function getSiteUserSession(): Promise<SiteUserRow | null> {
  const c = await cookies();
  const parsed = parseSiteUserCookie(c.get(SITE_USER_COOKIE)?.value);
  if (!parsed) return null;
  const user = await getSiteUserById(parsed.id);
  if (!user) return null;
  if (user.status !== "approved") return null;
  if (sessionTokenForUser(user) !== parsed.token) return null;
  if (user.role !== "owner" && user.allowedPages.length === 0) return null;
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

/**
 * Email + password login for site accounts.
 * Owner email also accepts ADMIN_PASSWORD (or TASKS_PASSWORD) and refreshes the stored hash.
 */
export async function loginSiteUser(
  email: string,
  password: string
): Promise<
  | { ok: true; user: SiteUserRow }
  | { ok: false; error: string; fallbackOwnerEnv?: boolean }
> {
  const normalized = email.trim().toLowerCase();
  const isOwnerEmail = normalized === getOwnerEmail();
  const ownerPassword = getOwnerLoginPassword();
  const ownerPasswordMatches =
    isOwnerEmail && Boolean(ownerPassword) && password === ownerPassword;

  if (isOwnerEmail) {
    if (!getSql()) {
      return {
        ok: false,
        error: "Database is not configured (DATABASE_URL). Ask for help setting Neon.",
        fallbackOwnerEnv: ownerPasswordMatches,
      };
    }
    if (!ownerPassword) {
      return {
        ok: false,
        error: "ADMIN_PASSWORD is not set on the server.",
      };
    }

    const ensured = await ensureOwnerAccount();
    if (ownerPasswordMatches) {
      await syncOwnerPasswordFromAdminEnv();
    }

    let result = await authenticateSiteUser(email, password);
    if (!result.ok && ownerPasswordMatches) {
      await ensureOwnerAccount();
      await syncOwnerPasswordFromAdminEnv();
      result = await authenticateSiteUser(email, password);
    }

    if (result.ok) {
      await setSiteUserSession(result.user);
      const { passwordHash: _pw, ...safe } = result.user;
      return { ok: true, user: safe };
    }

    if (ownerPasswordMatches) {
      return {
        ok: false,
        error: ensured
          ? "Owner account could not be signed in from the database."
          : "Could not set up the owner account in the database. Check Neon.",
        fallbackOwnerEnv: true,
      };
    }

    return result;
  }

  const result = await authenticateSiteUser(email, password);
  if (!result.ok) return result;
  await setSiteUserSession(result.user);
  const { passwordHash: _pw, ...safe } = result.user;
  return { ok: true, user: safe };
}
