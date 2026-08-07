import { cookies } from "next/headers";
import { createHash } from "crypto";
import {
  getAdminPassword,
  getAllAdminPasswords,
} from "@/lib/tasksPassword";
import { getSiteUserSession } from "@/lib/siteUserAuth";
import { pathIsAllowed } from "@/lib/admin/pageAccess";
import type { SiteUserRow } from "@/lib/data/siteUsers";
import { getOwnerLoginPassword } from "@/lib/ownerAccount";

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

/** Legacy shared-password session (Tim / transitional). Prefer email logins. */
export async function setAdminSession(plainPassword: string): Promise<void> {
  const token = sessionTokenForPassword(plainPassword);
  if (!token) return;
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

/** Shared-password admin cookie (Tim TASKS_PASSWORD_TIM, or legacy ADMIN_PASSWORD cookie). */
export async function isSharedAdmin(): Promise<boolean> {
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return getValidAdminSessionTokenSet().has(cookie);
}

export async function isAdmin(): Promise<boolean> {
  if (await isOwner()) return true;
  if (await isSharedAdmin()) return true;
  const user = await getSiteUserSession();
  return user != null;
}

/**
 * Super admin: approved site user with role=owner (Ann’s email account),
 * or the ADMIN_PASSWORD / owner-env cookie as a fallback when the DB row isn’t ready.
 */
export async function isOwner(): Promise<boolean> {
  const user = await getSiteUserSession();
  if (user?.role === "owner") return true;

  const ownerPassword = getOwnerLoginPassword();
  if (!ownerPassword) return false;
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  return Boolean(cookie && cookie === sessionTokenForPassword(ownerPassword));
}

export type AccessContext =
  | { kind: "owner"; user: SiteUserRow }
  | { kind: "shared-admin" }
  | { kind: "site-user"; user: SiteUserRow }
  | { kind: "none" };

export async function getAccessContext(): Promise<AccessContext> {
  const user = await getSiteUserSession();
  if (user?.role === "owner") return { kind: "owner", user };
  // Owner env-password cookie (no DB row yet) still counts as owner for nav/APIs.
  if (await isOwner()) {
    return {
      kind: "owner",
      user: user ?? {
        id: 0,
        name: "Ann",
        email: "",
        role: "owner",
        status: "approved",
        allowedPages: [],
        adminNote: null,
        createdAt: "",
        decidedAt: null,
        updatedAt: "",
      },
    };
  }
  if (await isSharedAdmin()) return { kind: "shared-admin" };
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

export async function getVisibleAdminHrefs(): Promise<string[] | null> {
  const ctx = await getAccessContext();
  if (ctx.kind === "owner" || ctx.kind === "shared-admin") return null;
  if (ctx.kind === "site-user") return ctx.user.allowedPages;
  return [];
}

export async function canUseAdminApi(pageHref: string): Promise<boolean> {
  if (await isOwner()) return true;
  if (await isSharedAdmin()) return true;
  const user = await getSiteUserSession();
  if (!user) return false;
  return user.allowedPages.includes(pageHref);
}

/** @deprecated */
export function getAdminTokenForMiddleware(): string {
  return sessionTokenForPassword(getAdminPassword());
}
