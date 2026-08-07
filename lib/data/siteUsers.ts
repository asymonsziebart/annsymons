import { getSql, getSqlOrThrow } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/passwordHash";
import { normalizeAllowedPages } from "@/lib/admin/pageAccess";
import { getOwnerEmail } from "@/lib/ownerAccount";

export const SITE_USER_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "disabled",
] as const;

export const SITE_USER_ROLES = ["owner", "member"] as const;

export type SiteUserStatus = (typeof SITE_USER_STATUSES)[number];
export type SiteUserRole = (typeof SITE_USER_ROLES)[number];

export type SiteUserRow = {
  id: number;
  name: string;
  email: string;
  role: SiteUserRole;
  status: SiteUserStatus;
  allowedPages: string[];
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  updatedAt: string;
};

export type SiteUserAuthRow = SiteUserRow & {
  passwordHash: string;
};

export const SITE_USERS_MIGRATION_HINT =
  "Run db/site-users.sql on the Neon database to enable account requests.";

const SELECT_USER_COLS = `
  id, name, email, role, password_hash, status, allowed_pages, admin_note,
  created_at::text AS created_at,
  decided_at::text AS decided_at,
  updated_at::text AS updated_at
`;

function normalizeStatus(value: unknown): SiteUserStatus {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (SITE_USER_STATUSES as readonly string[]).includes(s)
    ? (s as SiteUserStatus)
    : "pending";
}

function normalizeRole(value: unknown): SiteUserRole {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  return s === "owner" ? "owner" : "member";
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return name || null;
}

function parseAllowedPagesColumn(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeAllowedPages(value);
  if (typeof value === "string") {
    try {
      return normalizeAllowedPages(JSON.parse(value));
    } catch {
      return normalizeAllowedPages(value);
    }
  }
  return [];
}

function mapRow(row: Record<string, unknown>): SiteUserRow {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    allowedPages: parseAllowedPagesColumn(row.allowed_pages),
    adminNote: row.admin_note != null ? String(row.admin_note) : null,
    createdAt: String(row.created_at ?? ""),
    decidedAt: row.decided_at != null ? String(row.decided_at) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapAuthRow(row: Record<string, unknown>): SiteUserAuthRow {
  return {
    ...mapRow(row),
    passwordHash: String(row.password_hash ?? ""),
  };
}

export async function listSiteUsers(): Promise<SiteUserRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, name, email, role, status, allowed_pages, admin_note,
             created_at::text AS created_at,
             decided_at::text AS decided_at,
             updated_at::text AS updated_at
      FROM site_users
      ORDER BY
        CASE role WHEN 'owner' THEN 0 ELSE 1 END,
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'disabled' THEN 2
          ELSE 3
        END,
        created_at DESC,
        id DESC
    `;
    return (rows as Record<string, unknown>[]).map(mapRow);
  } catch {
    return [];
  }
}

export async function getSiteUserById(id: number): Promise<SiteUserAuthRow | null> {
  const sql = getSql();
  if (!sql || !Number.isFinite(id) || id < 1) return null;
  try {
    const rows = await sql`
      SELECT id, name, email, role, password_hash, status, allowed_pages, admin_note,
             created_at::text AS created_at,
             decided_at::text AS decided_at,
             updated_at::text AS updated_at
      FROM site_users
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapAuthRow(row) : null;
  } catch {
    return null;
  }
}

export async function getSiteUserByEmail(
  emailRaw: string
): Promise<SiteUserAuthRow | null> {
  const email = normalizeEmail(emailRaw);
  const sql = getSql();
  if (!sql || !email) return null;
  try {
    const rows = await sql`
      SELECT id, name, email, role, password_hash, status, allowed_pages, admin_note,
             created_at::text AS created_at,
             decided_at::text AS decided_at,
             updated_at::text AS updated_at
      FROM site_users
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapAuthRow(row) : null;
  } catch {
    return null;
  }
}

export type CreateSiteUserRequestInput = {
  name: string;
  email: string;
  password: string;
};

export async function createSiteUserRequest(
  input: CreateSiteUserRequestInput
): Promise<{ ok: true; user: SiteUserRow } | { ok: false; error: string }> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "A valid email is required." };
  if (email === getOwnerEmail()) {
    return {
      ok: false,
      error: "That email is reserved for the site owner. Sign in on the admin login page.",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password.length > 200) {
    return { ok: false, error: "Password is too long." };
  }

  const existing = await getSiteUserByEmail(email);
  if (existing) {
    return {
      ok: false,
      error: "An account with that email already exists (or is pending).",
    };
  }

  try {
    const sql = getSqlOrThrow();
    const passwordHash = hashPassword(password);
    const rows = await sql`
      INSERT INTO site_users (name, email, password_hash, role, status, allowed_pages)
      VALUES (${name}, ${email}, ${passwordHash}, 'member', 'pending', '[]')
      RETURNING id, name, email, role, status, allowed_pages, admin_note,
                created_at::text AS created_at,
                decided_at::text AS decided_at,
                updated_at::text AS updated_at
    `;
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) return { ok: false, error: "Could not create account request." };
    return { ok: true, user: mapRow(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("site_users") || message.includes("does not exist")) {
      return { ok: false, error: SITE_USERS_MIGRATION_HINT };
    }
    if (message.toLowerCase().includes("unique")) {
      return {
        ok: false,
        error: "An account with that email already exists (or is pending).",
      };
    }
    return { ok: false, error: "Could not create account request." };
  }
}

export async function authenticateSiteUser(
  emailRaw: string,
  password: string
): Promise<
  | { ok: true; user: SiteUserAuthRow }
  | { ok: false; error: string }
> {
  const user = await getSiteUserByEmail(emailRaw);
  if (!user) return { ok: false, error: "Invalid username or password." };
  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid username or password." };
  }
  if (user.status === "pending") {
    return {
      ok: false,
      error: "Your account is waiting for Ann to approve it.",
    };
  }
  if (user.status === "rejected") {
    return { ok: false, error: "This account request was not approved." };
  }
  if (user.status === "disabled") {
    return { ok: false, error: "This account has been disabled." };
  }
  if (user.role !== "owner" && user.allowedPages.length === 0) {
    return {
      ok: false,
      error: "Your account is approved but has no page access yet.",
    };
  }
  return { ok: true, user };
}

export type UpdateSiteUserInput = {
  status?: SiteUserStatus;
  allowedPages?: string[];
  adminNote?: string | null;
};

export async function updateSiteUser(
  id: number,
  input: UpdateSiteUserInput
): Promise<SiteUserRow | null> {
  const current = await getSiteUserById(id);
  if (!current) return null;
  if (current.role === "owner") {
    throw new Error("The owner account cannot be edited here.");
  }

  const status = input.status ? normalizeStatus(input.status) : current.status;
  const allowedPages =
    input.allowedPages !== undefined
      ? normalizeAllowedPages(input.allowedPages)
      : current.allowedPages;
  const adminNote =
    input.adminNote !== undefined
      ? typeof input.adminNote === "string"
        ? input.adminNote.trim().slice(0, 500) || null
        : null
      : current.adminNote;

  const statusChanged = status !== current.status;
  const allowedPagesJson = JSON.stringify(allowedPages);
  const sql = getSqlOrThrow();
  const rows = statusChanged
    ? await sql`
        UPDATE site_users
        SET
          status = ${status},
          allowed_pages = ${allowedPagesJson},
          admin_note = ${adminNote},
          decided_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id} AND role = 'member'
        RETURNING id, name, email, role, status, allowed_pages, admin_note,
                  created_at::text AS created_at,
                  decided_at::text AS decided_at,
                  updated_at::text AS updated_at
      `
    : await sql`
        UPDATE site_users
        SET
          status = ${status},
          allowed_pages = ${allowedPagesJson},
          admin_note = ${adminNote},
          updated_at = NOW()
        WHERE id = ${id} AND role = 'member'
        RETURNING id, name, email, role, status, allowed_pages, admin_note,
                  created_at::text AS created_at,
                  decided_at::text AS decided_at,
                  updated_at::text AS updated_at
      `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapRow(row) : null;
}

export async function deleteSiteUser(id: number): Promise<boolean> {
  const current = await getSiteUserById(id);
  if (!current) return false;
  if (current.role === "owner") {
    throw new Error("The owner account cannot be deleted.");
  }
  const sql = getSqlOrThrow();
  const rows = await sql`
    DELETE FROM site_users WHERE id = ${id} AND role = 'member' RETURNING id
  `;
  return (rows as unknown[]).length > 0;
}

export async function countPendingSiteUsers(): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM site_users
      WHERE status = 'pending' AND role = 'member'
    `;
    return Number((rows as Record<string, unknown>[])[0]?.count ?? 0);
  } catch {
    return 0;
  }
}
