import { ADMIN_NAV_PAGES, type AdminNavPage } from "@/lib/admin/navPages";

/** Pages an approved account can be granted (excludes owner-only Manage Users). */
export const GRANTABLE_ADMIN_PAGES: AdminNavPage[] = ADMIN_NAV_PAGES.filter(
  (page) =>
    page.href !== "/admin/users" &&
    page.href !== "/admin/posts/new" &&
    page.href !== "/admin/recipes/new"
);

/** Always allow these for any approved user who has at least one grant (login plumbing). */
export const ALWAYS_ALLOWED_PATHS = ["/admin/login"] as const;

export function normalizeAllowedPages(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const allowed = new Set(GRANTABLE_ADMIN_PAGES.map((p) => p.href));
  const out: string[] = [];
  for (const item of raw) {
    const href = String(item ?? "").trim();
    if (!href || !allowed.has(href)) continue;
    if (!out.includes(href)) out.push(href);
  }
  return out;
}

export function pathIsAllowed(pathname: string, allowedPages: string[]): boolean {
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p)) return true;
  // Admin home is allowed if they have any page (so they can land after login).
  if (pathname === "/admin" || pathname === "/admin/") {
    return allowedPages.length > 0;
  }
  for (const href of allowedPages) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  }
  // Blog post routes when Blog is granted
  if (allowedPages.includes("/blog") && pathname.startsWith("/blog")) return true;
  // Recipe public pages when Recipes admin granted
  if (
    allowedPages.includes("/admin/recipes") &&
    (pathname.startsWith("/recipes") || pathname.startsWith("/admin/recipes"))
  ) {
    return true;
  }
  return false;
}

export function firstAllowedPath(allowedPages: string[]): string {
  if (allowedPages.includes("/admin")) return "/admin";
  return allowedPages[0] ?? "/admin";
}
