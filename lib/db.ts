import { neon } from "@neondatabase/serverless";

function getConnectionString(): string | null {
  return process.env.DATABASE_URL ?? null;
}

/** Use in server components / API: returns Neon client or null if no DB configured. */
export function getSql() {
  const url = getConnectionString();
  if (!url) return null;
  return neon(url);
}

/** Throws if DATABASE_URL is not set. Use in admin API routes that require DB. */
export function getSqlOrThrow() {
  const url = getConnectionString();
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
