import { getSql, getSqlOrThrow } from "@/lib/db";
import {
  publishPhotoPost,
  refreshLongLivedToken,
  toPublicImageUrl,
} from "@/lib/instagram/client";
import { getSiteOrigin } from "@/lib/instagram/config";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

export type InstagramAccountPublic = {
  connected: boolean;
  username: string | null;
  igUserId: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
};

export type InstagramAccountRow = {
  ig_user_id: string;
  username: string;
  access_token: string;
  token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
};

export type InstagramPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type InstagramPost = {
  id: number;
  image_url: string;
  caption: string;
  status: InstagramPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  ig_media_id: string | null;
  ig_container_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramPostInput = {
  image_url: string;
  caption?: string;
  scheduled_at?: string | null;
  /** When true and scheduled_at is in the future → scheduled; otherwise draft (or publish later). */
  status?: "draft" | "scheduled";
};

async function ensureInstagramTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      ig_user_id      TEXT NOT NULL,
      username        TEXT NOT NULL,
      access_token    TEXT NOT NULL,
      token_expires_at TIMESTAMPTZ,
      connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS instagram_posts (
      id              SERIAL PRIMARY KEY,
      image_url       TEXT NOT NULL,
      caption         TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
      scheduled_at    TIMESTAMPTZ,
      published_at    TIMESTAMPTZ,
      ig_media_id     TEXT,
      ig_container_id TEXT,
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS instagram_posts_status_scheduled_idx
      ON instagram_posts (status, scheduled_at)
  `;
}

function rowToPost(row: Record<string, unknown>): InstagramPost {
  return {
    id: Number(row.id),
    image_url: String(row.image_url ?? ""),
    caption: String(row.caption ?? ""),
    status: (row.status as InstagramPostStatus) || "draft",
    scheduled_at: row.scheduled_at ? String(row.scheduled_at) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    ig_media_id: row.ig_media_id ? String(row.ig_media_id) : null,
    ig_container_id: row.ig_container_id ? String(row.ig_container_id) : null,
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getConnectedAccountPublic(): Promise<InstagramAccountPublic> {
  const sql = getSql();
  if (!sql) {
    return {
      connected: false,
      username: null,
      igUserId: null,
      tokenExpiresAt: null,
      connectedAt: null,
    };
  }
  try {
    await ensureInstagramTables(sql);
    const rows = await sql`
      SELECT ig_user_id, username, token_expires_at, connected_at
      FROM instagram_accounts
      WHERE id = 1
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return {
        connected: false,
        username: null,
        igUserId: null,
        tokenExpiresAt: null,
        connectedAt: null,
      };
    }
    return {
      connected: true,
      username: String(row.username),
      igUserId: String(row.ig_user_id),
      tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
      connectedAt: row.connected_at ? String(row.connected_at) : null,
    };
  } catch {
    return {
      connected: false,
      username: null,
      igUserId: null,
      tokenExpiresAt: null,
      connectedAt: null,
    };
  }
}

async function getAccountRow(sql: SqlClient): Promise<InstagramAccountRow | null> {
  await ensureInstagramTables(sql);
  const rows = await sql`
    SELECT ig_user_id, username, access_token, token_expires_at, connected_at, updated_at
    FROM instagram_accounts
    WHERE id = 1
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    ig_user_id: String(row.ig_user_id),
    username: String(row.username),
    access_token: String(row.access_token),
    token_expires_at: row.token_expires_at ? String(row.token_expires_at) : null,
    connected_at: String(row.connected_at),
    updated_at: String(row.updated_at),
  };
}

export async function upsertConnectedAccount(opts: {
  igUserId: string;
  username: string;
  accessToken: string;
  expiresInSeconds: number;
}): Promise<void> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const expiresAt = new Date(Date.now() + opts.expiresInSeconds * 1000).toISOString();
  await sql`
    INSERT INTO instagram_accounts (
      id, ig_user_id, username, access_token, token_expires_at, connected_at, updated_at
    )
    VALUES (
      1,
      ${opts.igUserId},
      ${opts.username},
      ${opts.accessToken},
      ${expiresAt},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      ig_user_id = EXCLUDED.ig_user_id,
      username = EXCLUDED.username,
      access_token = EXCLUDED.access_token,
      token_expires_at = EXCLUDED.token_expires_at,
      connected_at = NOW(),
      updated_at = NOW()
  `;
}

export async function disconnectInstagramAccount(): Promise<void> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  await sql`DELETE FROM instagram_accounts WHERE id = 1`;
}

/** Refresh token if it expires within 14 days. */
async function ensureFreshAccessToken(
  sql: SqlClient,
  account: InstagramAccountRow
): Promise<InstagramAccountRow> {
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  if (expiresAt && expiresAt - Date.now() > fourteenDays) {
    return account;
  }
  // Long-lived tokens can only be refreshed after ~24h; ignore refresh failures if still valid.
  try {
    const refreshed = await refreshLongLivedToken(account.access_token);
    const newExpires = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
    await sql`
      UPDATE instagram_accounts
      SET access_token = ${refreshed.accessToken},
          token_expires_at = ${newExpires},
          updated_at = NOW()
      WHERE id = 1
    `;
    return {
      ...account,
      access_token: refreshed.accessToken,
      token_expires_at: newExpires,
    };
  } catch {
    if (expiresAt && expiresAt > Date.now()) return account;
    throw new Error("Instagram token expired. Reconnect your account in Admin → Instagram.");
  }
}

export async function listInstagramPosts(): Promise<InstagramPost[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    await ensureInstagramTables(sql);
    const rows = await sql`
      SELECT id, image_url, caption, status, scheduled_at, published_at,
             ig_media_id, ig_container_id, error_message, created_at, updated_at
      FROM instagram_posts
      ORDER BY
        CASE status
          WHEN 'scheduled' THEN 0
          WHEN 'draft' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'publishing' THEN 3
          ELSE 4
        END,
        scheduled_at NULLS LAST,
        created_at DESC
      LIMIT 100
    `;
    return (Array.isArray(rows) ? rows : []).map((r) =>
      rowToPost(r as Record<string, unknown>)
    );
  } catch {
    return [];
  }
}

export async function getInstagramPost(id: number): Promise<InstagramPost | null> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const rows = await sql`
    SELECT id, image_url, caption, status, scheduled_at, published_at,
           ig_media_id, ig_container_id, error_message, created_at, updated_at
    FROM instagram_posts
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? rowToPost(row as Record<string, unknown>) : null;
}

function resolvePostStatus(
  input: InstagramPostInput
): { status: "draft" | "scheduled"; scheduledAt: string | null } {
  const scheduledRaw = input.scheduled_at?.trim() || null;
  if (!scheduledRaw) {
    return { status: "draft", scheduledAt: null };
  }
  const when = new Date(scheduledRaw);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Invalid scheduled date/time");
  }
  if (input.status === "draft") {
    return { status: "draft", scheduledAt: when.toISOString() };
  }
  if (when.getTime() > Date.now() + 30_000) {
    return { status: "scheduled", scheduledAt: when.toISOString() };
  }
  // Past / near-now schedule → leave as draft so user can publish now
  return { status: "draft", scheduledAt: when.toISOString() };
}

export async function createInstagramPost(input: InstagramPostInput): Promise<InstagramPost> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const imageUrl = input.image_url?.trim();
  if (!imageUrl) throw new Error("Photo is required");
  const caption = typeof input.caption === "string" ? input.caption : "";
  const { status, scheduledAt } = resolvePostStatus(input);

  const rows = await sql`
    INSERT INTO instagram_posts (image_url, caption, status, scheduled_at, updated_at)
    VALUES (${imageUrl}, ${caption}, ${status}, ${scheduledAt}, NOW())
    RETURNING id, image_url, caption, status, scheduled_at, published_at,
              ig_media_id, ig_container_id, error_message, created_at, updated_at
  `;
  const row = Array.isArray(rows) ? rows[0] : rows;
  return rowToPost(row as Record<string, unknown>);
}

export async function updateInstagramPost(
  id: number,
  input: Partial<InstagramPostInput> & { clear_error?: boolean }
): Promise<InstagramPost> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const existing = await getInstagramPost(id);
  if (!existing) throw new Error("Post not found");
  if (existing.status === "published" || existing.status === "publishing") {
    throw new Error("Cannot edit a post that is publishing or already published");
  }

  const imageUrl =
    typeof input.image_url === "string" ? input.image_url.trim() : existing.image_url;
  const caption =
    typeof input.caption === "string" ? input.caption : existing.caption;
  const scheduledSource =
    input.scheduled_at !== undefined ? input.scheduled_at : existing.scheduled_at;
  const { status, scheduledAt } = resolvePostStatus({
    image_url: imageUrl,
    caption,
    scheduled_at: scheduledSource,
    status: input.status ?? (existing.status === "scheduled" ? "scheduled" : "draft"),
  });

  const rows = await sql`
    UPDATE instagram_posts
    SET image_url = ${imageUrl},
        caption = ${caption},
        status = ${status},
        scheduled_at = ${scheduledAt},
        error_message = ${input.clear_error ? null : existing.error_message},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, image_url, caption, status, scheduled_at, published_at,
              ig_media_id, ig_container_id, error_message, created_at, updated_at
  `;
  const row = Array.isArray(rows) ? rows[0] : rows;
  return rowToPost(row as Record<string, unknown>);
}

export async function deleteInstagramPost(id: number): Promise<void> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const existing = await getInstagramPost(id);
  if (!existing) throw new Error("Post not found");
  if (existing.status === "publishing") {
    throw new Error("Cannot delete a post that is currently publishing");
  }
  await sql`DELETE FROM instagram_posts WHERE id = ${id}`;
}

async function markPost(
  sql: SqlClient,
  id: number,
  fields: {
    status: InstagramPostStatus;
    error_message?: string | null;
    ig_media_id?: string | null;
    ig_container_id?: string | null;
    published_at?: string | null;
  }
): Promise<void> {
  await sql`
    UPDATE instagram_posts
    SET status = ${fields.status},
        error_message = ${fields.error_message ?? null},
        ig_media_id = COALESCE(${fields.ig_media_id ?? null}, ig_media_id),
        ig_container_id = COALESCE(${fields.ig_container_id ?? null}, ig_container_id),
        published_at = COALESCE(${fields.published_at ?? null}, published_at),
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

/** Publish one post now (draft/scheduled/failed). */
export async function publishInstagramPostNow(id: number): Promise<InstagramPost> {
  const sql = getSqlOrThrow();
  await ensureInstagramTables(sql);
  const post = await getInstagramPost(id);
  if (!post) throw new Error("Post not found");
  if (post.status === "published") throw new Error("Post is already published");
  if (post.status === "publishing") throw new Error("Post is already publishing");

  const account = await getAccountRow(sql);
  if (!account) {
    throw new Error("Connect your Instagram account first");
  }

  await markPost(sql, id, { status: "publishing", error_message: null });

  try {
    const fresh = await ensureFreshAccessToken(sql, account);
    const publicUrl = toPublicImageUrl(post.image_url, getSiteOrigin());
    const result = await publishPhotoPost({
      igUserId: fresh.ig_user_id,
      accessToken: fresh.access_token,
      imageUrl: publicUrl,
      caption: post.caption || "",
    });
    await markPost(sql, id, {
      status: "published",
      ig_media_id: result.mediaId,
      ig_container_id: result.containerId,
      published_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    await markPost(sql, id, { status: "failed", error_message: message });
    throw e instanceof Error ? e : new Error(message);
  }

  const updated = await getInstagramPost(id);
  if (!updated) throw new Error("Post missing after publish");
  return updated;
}

/** Cron: publish due scheduled posts. */
export async function publishDueInstagramPosts(): Promise<{
  attempted: number;
  published: number;
  failed: number;
  errors: string[];
}> {
  const sql = getSql();
  if (!sql) {
    return { attempted: 0, published: 0, failed: 0, errors: ["DATABASE_URL not set"] };
  }
  await ensureInstagramTables(sql);

  const rows = await sql`
    SELECT id
    FROM instagram_posts
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT 10
  `;
  const ids = (Array.isArray(rows) ? rows : []).map((r) => Number((r as { id: number }).id));
  let published = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      await publishInstagramPostNow(id);
      published += 1;
    } catch (e) {
      failed += 1;
      errors.push(`#${id}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { attempted: ids.length, published, failed, errors };
}
