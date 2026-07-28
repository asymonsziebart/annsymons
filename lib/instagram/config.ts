/** Instagram API with Instagram Login (Business Login). */
export const IG_API_VERSION = "v22.0";
export const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_API_VERSION}`;
export const IG_OAUTH_AUTHORIZE = "https://www.instagram.com/oauth/authorize";
export const IG_OAUTH_TOKEN = "https://api.instagram.com/oauth/access_token";
export const IG_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

export function getInstagramAppId(): string | null {
  return process.env.INSTAGRAM_APP_ID?.trim() || null;
}

export function getInstagramAppSecret(): string | null {
  return process.env.INSTAGRAM_APP_SECRET?.trim() || null;
}

/** Public site origin used for OAuth redirect + absolute image URLs. */
export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;
  return "https://www.annsymons.com";
}

export function getInstagramRedirectUri(): string {
  const explicit = process.env.INSTAGRAM_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getSiteOrigin()}/api/instagram/callback`;
}

export function isInstagramConfigured(): boolean {
  return Boolean(getInstagramAppId() && getInstagramAppSecret());
}
