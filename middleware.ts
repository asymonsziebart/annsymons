import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "admin_session";
const ADMIN_SALT = "annsymons-admin";
const TASKS_COOKIE = "tasks_session";
const TASKS_SALT = "annsymons-tasks";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/tasks")) {
    if (path === "/tasks/login") {
      return NextResponse.next();
    }
    const cookie = request.cookies.get(TASKS_COOKIE)?.value;
    const password = process.env.TASKS_PASSWORD;
    if (!password) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    const expected = await sha256(password + TASKS_SALT);
    if (cookie !== expected) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    return NextResponse.next();
  }

  if (!path.startsWith("/admin") || path === "/admin/login") {
    return NextResponse.next();
  }
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  const expected = await sha256(password + ADMIN_SALT);
  if (cookie !== expected) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/tasks",
    "/tasks/:path*",
  ],
};
