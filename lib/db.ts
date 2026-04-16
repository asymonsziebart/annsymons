import { neon } from "@neondatabase/serverless";

function getConnectionString(): string | null {
  const raw = process.env.DATABASE_URL?.trim();
  return raw || null;
}

/** Neon serverless driver only accepts Postgres URLs. */
function isPostgresUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith("postgresql://") || u.startsWith("postgres://");
}

/**
 * Use in server components / API: returns Neon client or null if no DB configured.
 * Returns null when DATABASE_URL is missing, non-Postgres, or rejected by the driver
 * (so pages like /statephotos can still render setup instructions instead of 500).
 */
export function getSql() {
  const url = getConnectionString();
  if (!url || !isPostgresUrl(url)) return null;
  try {
    return neon(url);
  } catch {
    return null;
  }
}

/** Throws if DATABASE_URL is not set or not a Postgres URL. Use in admin API routes that require DB. */
export function getSqlOrThrow() {
  const url = getConnectionString();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!isPostgresUrl(url)) {
    throw new Error("DATABASE_URL must be a postgresql:// connection string for Neon");
  }
  return neon(url);
}
