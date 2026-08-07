import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLinkPreviewBot } from "@/lib/linkPreviewBots";
import { getAllAdminPasswords, getAllTasksPasswords } from "@/lib/tasksPassword";
import {
  resolveSiteUserAccess,
  SITE_USER_COOKIE,
} from "@/lib/siteUserEdge";

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

async function cookieMatchesAnyPassword(
  cookie: string | undefined,
  passwords: string[],
  salt: string
): Promise<boolean> {
  if (!cookie || passwords.length === 0) return false;
  for (const p of passwords) {
    if (cookie === (await sha256(p + salt))) return true;
  }
  return false;
}

async function hasSharedAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  return cookieMatchesAnyPassword(cookie, getAllAdminPasswords(), ADMIN_SALT);
}

async function allowProtectedPath(
  request: NextRequest,
  pathname: string
): Promise<"allow" | "login" | "forbidden"> {
  if (await hasSharedAdminSession(request)) return "allow";

  const siteCookie = request.cookies.get(SITE_USER_COOKIE)?.value;
  const site = await resolveSiteUserAccess(siteCookie, pathname);
  if (site === "allow") return "allow";
  if (site === "deny") return "forbidden";
  return "login";
}

function loginRedirect(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function forbiddenRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL("/admin?denied=1", request.url));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/tasks")) {
    if (path === "/tasks/login") {
      return NextResponse.next();
    }
    if (await hasSharedAdminSession(request)) {
      return NextResponse.next();
    }
    const site = await resolveSiteUserAccess(
      request.cookies.get(SITE_USER_COOKIE)?.value,
      path
    );
    if (site === "allow") return NextResponse.next();
    if (site === "deny") return forbiddenRedirect(request);

    const passwords = getAllTasksPasswords();
    if (passwords.length === 0) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    const cookie = request.cookies.get(TASKS_COOKIE)?.value;
    if (!(await cookieMatchesAnyPassword(cookie, passwords, TASKS_SALT))) {
      return NextResponse.redirect(new URL("/tasks/login", request.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/statephotos") || path.startsWith("/archery")) {
    const decision = await allowProtectedPath(request, path);
    if (decision === "allow") return NextResponse.next();
    if (decision === "forbidden") return forbiddenRedirect(request);
    return loginRedirect(request, path);
  }

  if (path.startsWith("/blog")) {
    const decision = await allowProtectedPath(request, path);
    if (decision === "allow") return NextResponse.next();
    if (decision === "forbidden") return forbiddenRedirect(request);
    return loginRedirect(request, path);
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

  // Manage Users: owner (ADMIN_PASSWORD) only — never Tim or site users.
  if (path === "/admin/users" || path.startsWith("/admin/users/")) {
    const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? "";
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (
      adminPassword &&
      cookie &&
      cookie === (await sha256(adminPassword + ADMIN_SALT))
    ) {
      return NextResponse.next();
    }
    if (await hasSharedAdminSession(request)) {
      return forbiddenRedirect(request);
    }
    const siteCookie = request.cookies.get(SITE_USER_COOKIE)?.value;
    if (siteCookie) return forbiddenRedirect(request);
    return loginRedirect(request, path);
  }

  const decision = await allowProtectedPath(request, path);
  if (decision === "allow") return NextResponse.next();
  if (decision === "forbidden") return forbiddenRedirect(request);
  return loginRedirect(request, path);
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
