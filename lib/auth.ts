import { cookies } from "next/headers";
import { createHash } from "crypto";
import { getAdminPassword, getAllAdminPasswords } from "@/lib/tasksPassword";

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

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return getValidAdminSessionTokenSet().has(cookie);
}

/** @deprecated prefer getAllAdminPasswords + per-password tokens; kept for edge tooling */
export function getAdminTokenForMiddleware(): string {
  return sessionTokenForPassword(getAdminPassword());
}
