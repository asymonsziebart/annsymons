import { getSql } from "@/lib/db";

/**
 * Create / upgrade site_users so owner login works without a manual Neon paste.
 * Safe to call on every login (IF NOT EXISTS).
 */
export async function ensureSiteUsersSchema(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS site_users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'pending',
        allowed_pages TEXT NOT NULL DEFAULT '[]',
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decided_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Older installs may predate the role column.
    await sql`
      ALTER TABLE site_users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS site_users_email_lower_uidx
      ON site_users (lower(email))
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS site_users_status_created_idx
      ON site_users (status, created_at DESC)
    `;

    return true;
  } catch {
    return false;
  }
}
