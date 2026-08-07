import { getAdminPassword } from "@/lib/tasksPassword";
import { GRANTABLE_ADMIN_PAGES } from "@/lib/admin/pageAccess";
import { hashPassword } from "@/lib/passwordHash";
import { getSql } from "@/lib/db";

/** Ann’s super-admin login email (override with OWNER_EMAIL if needed). */
export const DEFAULT_OWNER_EMAIL = "a.krause10597@gmail.com";

export function getOwnerEmail(): string {
  const fromEnv = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return fromEnv || DEFAULT_OWNER_EMAIL;
}

export function allGrantablePageHrefs(): string[] {
  return GRANTABLE_ADMIN_PAGES.map((p) => p.href);
}

/**
 * Ensure the owner row exists for Ann’s email.
 * New installs seed password from ADMIN_PASSWORD.
 * Existing owner rows keep their password_hash (login can refresh it when ADMIN_PASSWORD is used).
 */
export async function ensureOwnerAccount(): Promise<void> {
  const sql = getSql();
  const email = getOwnerEmail();
  const adminPassword = getAdminPassword();
  if (!sql || !email || !adminPassword) return;

  const pagesJson = JSON.stringify(allGrantablePageHrefs());
  try {
    const existing = await sql`
      SELECT id FROM site_users WHERE lower(email) = ${email} LIMIT 1
    `;
    if ((existing as unknown[]).length > 0) {
      await sql`
        UPDATE site_users
        SET
          role = 'owner',
          status = 'approved',
          name = COALESCE(NULLIF(name, ''), 'Ann'),
          allowed_pages = ${pagesJson},
          updated_at = NOW()
        WHERE lower(email) = ${email}
      `;
      return;
    }

    const passwordHash = hashPassword(adminPassword);
    await sql`
      INSERT INTO site_users (
        name, email, password_hash, role, status, allowed_pages, admin_note, decided_at
      )
      VALUES (
        'Ann',
        ${email},
        ${passwordHash},
        'owner',
        'approved',
        ${pagesJson},
        'Super admin (linked to ADMIN_PASSWORD on first create)',
        NOW()
      )
    `;
  } catch {
    /* table may not exist yet */
  }
}

export async function syncOwnerPasswordFromAdminEnv(): Promise<void> {
  const sql = getSql();
  const email = getOwnerEmail();
  const adminPassword = getAdminPassword();
  if (!sql || !email || !adminPassword) return;
  try {
    const passwordHash = hashPassword(adminPassword);
    const pagesJson = JSON.stringify(allGrantablePageHrefs());
    await sql`
      UPDATE site_users
      SET
        password_hash = ${passwordHash},
        role = 'owner',
        status = 'approved',
        allowed_pages = ${pagesJson},
        updated_at = NOW()
      WHERE lower(email) = ${email}
    `;
  } catch {
    /* ignore */
  }
}
