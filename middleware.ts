import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLinkPreviewBot } from "@/lib/linkPreviewBots";
import { getAllTasksPasswords } from "@/lib/tasksPassword";

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

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookie) return false;
  return cookie === (await sha256(password + ADMIN_SALT));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/tasks")) {
    if (path === "/tasks/login") {
      return NextResponse.next();
    }
    if (await hasAdminSession(request)) {
      return NextResponse.next();
    }
    const passwords = getAllTasksPasswords();
    if (passwords.length === 0) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    const cookie = request.cookies.get(TASKS_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    let allowed = false;
    for (const p of passwords) {
      if (cookie === (await sha256(p + TASKS_SALT))) {
        allowed = true;
        break;
      }
    }
    if (!allowed) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/statephotos") || path.startsWith("/archery")) {
    if (!(await hasAdminSession(request))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/blog")) {
    if (!(await hasAdminSession(request))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!path.startsWith("/admin") || path === "/admin/login") {
    return NextResponse.next();
  }
  if (
    path === "/admin/truck-fund" &&
    isLinkPreviewBot(request.headers.get("user-agent"))
  ) {
    return NextResponse.next();
  }
  if (!(await hasAdminSession(request))) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/tasks",
    "/tasks/:path*",
    "/statephotos",
    "/statephotos/:path*",
    "/archery",
    "/archery/:path*",
    "/blog",
    "/blog/:path*",
  ],
};
