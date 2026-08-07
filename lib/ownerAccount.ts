import { getAdminPassword } from "@/lib/tasksPassword";
import { GRANTABLE_ADMIN_PAGES } from "@/lib/admin/pageAccess";
import { hashPassword } from "@/lib/passwordHash";
import { getSql } from "@/lib/db";
import { ensureSiteUsersSchema } from "@/lib/data/ensureSiteUsersSchema";

/** Ann’s super-admin login email (override with OWNER_EMAIL if needed). */
export const DEFAULT_OWNER_EMAIL = "a.krause10597@gmail.com";

export function getOwnerEmail(): string {
  const fromEnv = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return fromEnv || DEFAULT_OWNER_EMAIL;
}

/**
 * Password that unlocks Ann’s owner account.
 * Prefers ADMIN_PASSWORD; falls back to TASKS_PASSWORD if only that is set.
 */
export function getOwnerLoginPassword(): string {
  const admin = getAdminPassword();
  if (admin) return admin;
  return process.env.TASKS_PASSWORD?.trim() ?? "";
}

export function allGrantablePageHrefs(): string[] {
  return GRANTABLE_ADMIN_PAGES.map((p) => p.href);
}

/**
 * Ensure the owner row exists for Ann’s email.
 * New installs seed password from ADMIN_PASSWORD (or TASKS_PASSWORD).
 * Existing owner rows keep their password_hash (login can refresh it when that password is used).
 */
export async function ensureOwnerAccount(): Promise<boolean> {
  const sql = getSql();
  const email = getOwnerEmail();
  const ownerPassword = getOwnerLoginPassword();
  if (!sql || !email || !ownerPassword) return false;

  const schemaOk = await ensureSiteUsersSchema();
  if (!schemaOk) return false;

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
      return true;
    }

    const passwordHash = hashPassword(ownerPassword);
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
        'Super admin (linked to ADMIN_PASSWORD / TASKS_PASSWORD on first create)',
        NOW()
      )
    `;
    return true;
  } catch {
    return false;
  }
}

export async function syncOwnerPasswordFromAdminEnv(): Promise<boolean> {
  const sql = getSql();
  const email = getOwnerEmail();
  const ownerPassword = getOwnerLoginPassword();
  if (!sql || !email || !ownerPassword) return false;
  try {
    await ensureSiteUsersSchema();
    const passwordHash = hashPassword(ownerPassword);
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
    return true;
  } catch {
    return false;
  }
}
