import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "admin_session";
const SALT = "annsymons-admin";

function getToken(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return "";
  return createHash("sha256").update(password + SALT).digest("hex");
}

export async function setAdminSession(): Promise<void> {
  const token = getToken();
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
  const cookie = c.get(COOKIE_NAME);
  const token = getToken();
  return !!token && cookie?.value === token;
}

export function getAdminTokenForMiddleware(): string {
  return getToken();
}
