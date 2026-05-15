import { cookies } from "next/headers";
import { createHash } from "crypto";
import { isAdmin } from "@/lib/auth";
import { getAllTasksPasswords, getTasksPassword } from "@/lib/tasksPassword";

const COOKIE_NAME = "tasks_session";
const SALT = "annsymons-tasks";

function sessionTokenForPassword(plain: string): string {
  if (!plain) return "";
  return createHash("sha256").update(plain + SALT).digest("hex");
}

function getValidTaskSessionTokenSet(): Set<string> {
  const s = new Set<string>();
  for (const p of getAllTasksPasswords()) {
    s.add(sessionTokenForPassword(p));
  }
  return s;
}

/** Set session after login with the exact password the user entered (so Tim vs primary hash differs). */
export async function setTasksSession(plainPassword: string): Promise<void> {
  const token = sessionTokenForPassword(plainPassword);
  if (!token) return;
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  });
}

export async function clearTasksSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function isTasksAuth(): Promise<boolean> {
  if (await isAdmin()) return true;
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return getValidTaskSessionTokenSet().has(cookie);
}

export function getTasksCookieName(): string {
  return COOKIE_NAME;
}

/** @deprecated use getValidTaskSessionTokenSet; kept for a single “primary” token in edge tooling */
export function getTasksTokenForMiddleware(): string {
  return sessionTokenForPassword(getTasksPassword());
}
