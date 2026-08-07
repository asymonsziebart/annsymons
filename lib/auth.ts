import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  getAdminPassword,
  getAllAdminPasswords,
} from "@/lib/tasksPassword";
import { getSiteUserSession } from "@/lib/siteUserAuth";
import { pathIsAllowed } from "@/lib/admin/pageAccess";
import type { SiteUserRow } from "@/lib/data/siteUsers";

const COOKIE_NAME = "admin_session";
const SALT = "annsymons-admin";

function sessionTokenForPassword(plain: string): string {
  if (!plain) return "";
  return createHash("sha256").update(plain + SALT).digest("hex");
}

function getValidAdminSessionTokenSet(): Set<string> {
  const s = new Set<string>();
  for (const p of getAllAdminPasswords()) {
    s.add(sessionTokenForPassword(p));
  }
  return s;
}

/** Set session after login with the exact password entered (so Tim vs primary hash differs). */
export async function setAdminSession(plainPassword: string): Promise<void> {
  const token = sessionTokenForPassword(plainPassword);
  if (!token) return;
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

/** Shared-password admin (Ann ADMIN_PASSWORD or Tim TASKS_PASSWORD_TIM). */
export async function isSharedAdmin(): Promise<boolean> {
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return getValidAdminSessionTokenSet().has(cookie);
}

/**
 * True for shared-password admins OR an approved site-user account.
 * Use for showing admin chrome; use canAccessPath for page gates.
 */
export async function isAdmin(): Promise<boolean> {
  if (await isSharedAdmin()) return true;
  const user = await getSiteUserSession();
  return user != null;
}

/** Only Ann’s ADMIN_PASSWORD session (not Tim, not site users). */
export async function isOwner(): Promise<boolean> {
  const adminPassword = getAdminPassword();
  if (!adminPassword) return false;
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return cookie === sessionTokenForPassword(adminPassword);
}

export type AccessContext =
  | { kind: "owner" }
  | { kind: "shared-admin" }
  | { kind: "site-user"; user: SiteUserRow }
  | { kind: "none" };

export async function getAccessContext(): Promise<AccessContext> {
  if (await isOwner()) return { kind: "owner" };
  if (await isSharedAdmin()) return { kind: "shared-admin" };
  const user = await getSiteUserSession();
  if (user) return { kind: "site-user", user };
  return { kind: "none" };
}

export async function canAccessPath(pathname: string): Promise<boolean> {
  const ctx = await getAccessContext();
  if (ctx.kind === "owner" || ctx.kind === "shared-admin") return true;
  if (ctx.kind === "site-user") {
    return pathIsAllowed(pathname, ctx.user.allowedPages);
  }
  return false;
}

/** Pages the current viewer may see in nav / dashboard. null = all grantable pages. */
export async function getVisibleAdminHrefs(): Promise<string[] | null> {
  const ctx = await getAccessContext();
  if (ctx.kind === "owner" || ctx.kind === "shared-admin") return null;
  if (ctx.kind === "site-user") return ctx.user.allowedPages;
  return [];
}

/**
 * API gate for a private page area.
 * Shared-password admins pass; approved site users need that page in their allowlist.
 */
export async function canUseAdminApi(pageHref: string): Promise<boolean> {
  if (await isSharedAdmin()) return true;
  const user = await getSiteUserSession();
  if (!user) return false;
  return user.allowedPages.includes(pageHref);
}

/** @deprecated prefer getAllAdminPasswords + per-password tokens; kept for edge tooling */
export function getAdminTokenForMiddleware(): string {
  return sessionTokenForPassword(getAdminPassword());
}
