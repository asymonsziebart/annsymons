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

/**
 * Resolve an approved site-user session from the request cookie (Edge-safe).
 */
export async function resolveSiteUserAccess(
  cookieHeaderValue: string | undefined,
  pathname: string
): Promise<"allow" | "deny" | "none"> {
  const parsed = parseSiteUserCookie(cookieHeaderValue);
  if (!parsed) return "none";

  const url = process.env.DATABASE_URL?.trim();
  if (!url || !(url.startsWith("postgresql://") || url.startsWith("postgres://"))) {
    return "deny";
  }

  try {
    const sql = neon(url);
    const rows = await sql`
      SELECT id, password_hash, status, allowed_pages
      FROM site_users
      WHERE id = ${parsed.id}
      LIMIT 1
    `;
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) return "deny";
    if (String(row.status ?? "") !== "approved") return "deny";

    const expected = await sha256Hex(
      `${Number(row.id)}:${String(row.password_hash ?? "")}:${SALT}`
    );
    if (parsed.token !== expected) return "deny";

    const pages = parseAllowedPages(row.allowed_pages);
    if (pages.length === 0) return "deny";
    return pathIsAllowed(pathname, pages) ? "allow" : "deny";
  } catch {
    return "deny";
  }
}

export { SITE_USER_COOKIE };
