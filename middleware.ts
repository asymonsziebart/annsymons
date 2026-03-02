import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "admin_session";
const SALT = "annsymons-admin";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/admin") || path === "/admin/login") {
    return NextResponse.next();
  }
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  const expected = await sha256(password + SALT);
  if (cookie !== expected) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
