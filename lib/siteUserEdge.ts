import { neon } from "@neondatabase/serverless";
import { pathIsAllowed } from "@/lib/admin/pageAccess";
import {
  parseSiteUserCookie,
  SITE_USER_COOKIE,
} from "@/lib/siteUserCookieParse";

const SALT = "annsymons-site-user";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseAllowedPages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type SiteUserEdgeAccess =
  | { kind: "owner" }
  | { kind: "member"; pages: string[] }
  | { kind: "deny" }
  | { kind: "none" };

export async function resolveSiteUserSession(
  cookieHeaderValue: string | undefined
): Promise<SiteUserEdgeAccess> {
  const parsed = parseSiteUserCookie(cookieHeaderValue);
  if (!parsed) return { kind: "none" };

  const url = process.env.DATABASE_URL?.trim();
  if (!url || !(url.startsWith("postgresql://") || url.startsWith("postgres://"))) {
    return { kind: "deny" };
  }

  try {
    const sql = neon(url);
    const rows = await sql`
      SELECT id, password_hash, status, role, allowed_pages
      FROM site_users
      WHERE id = ${parsed.id}
      LIMIT 1
    `;
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) return { kind: "deny" };
    if (String(row.status ?? "") !== "approved") return { kind: "deny" };

    const expected = await sha256Hex(
      `${Number(row.id)}:${String(row.password_hash ?? "")}:${SALT}`
    );
    if (parsed.token !== expected) return { kind: "deny" };

    if (String(row.role ?? "") === "owner") {
      return { kind: "owner" };
    }

    const pages = parseAllowedPages(row.allowed_pages);
    if (pages.length === 0) return { kind: "deny" };
    return { kind: "member", pages };
  } catch {
    return { kind: "deny" };
  }
}

export async function resolveSiteUserAccess(
  cookieHeaderValue: string | undefined,
  pathname: string
): Promise<"allow" | "deny" | "none"> {
  const session = await resolveSiteUserSession(cookieHeaderValue);
  if (session.kind === "none") return "none";
  // Invalid, expired, or unapproved sessions should re-login — not /admin?denied=1,
  // which would loop forever for stale cookies.
  if (session.kind === "deny") return "none";
  if (session.kind === "owner") return "allow";
  return pathIsAllowed(pathname, session.pages) ? "allow" : "deny";
}

export { SITE_USER_COOKIE };
