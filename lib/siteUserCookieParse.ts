/** Pure parse helper — safe for Edge (no Node crypto). */
export const SITE_USER_COOKIE = "site_user_session";

export function parseSiteUserCookie(
  value: string | undefined
): { id: number; token: string } | null {
  if (!value) return null;
  const [idStr, token] = value.split(".");
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1 || !token) return null;
  return { id, token };
}
