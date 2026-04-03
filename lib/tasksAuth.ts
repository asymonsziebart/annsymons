import { cookies } from "next/headers";
import { createHash } from "crypto";
import { getTasksPassword } from "@/lib/tasksPassword";

const COOKIE_NAME = "tasks_session";
const SALT = "annsymons-tasks";

function getToken(): string {
  const password = getTasksPassword();
  if (!password) return "";
  return createHash("sha256").update(password + SALT).digest("hex");
}

export async function setTasksSession(): Promise<void> {
  const token = getToken();
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
  const c = await cookies();
  const cookie = c.get(COOKIE_NAME);
  const token = getToken();
  return !!token && cookie?.value === token;
}

export function getTasksCookieName(): string {
  return COOKIE_NAME;
}

export function getTasksTokenForMiddleware(): string {
  return getToken();
}
