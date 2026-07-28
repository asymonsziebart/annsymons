import {
  getInstagramAppId,
  getInstagramAppSecret,
  getInstagramRedirectUri,
  IG_GRAPH_BASE,
  IG_OAUTH_AUTHORIZE,
  IG_OAUTH_SCOPES,
  IG_OAUTH_TOKEN,
} from "@/lib/instagram/config";

export class InstagramApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "InstagramApiError";
    this.status = status;
    this.details = details;
  }
}

type TokenResponse = {
  access_token: string;
  user_id?: number | string;
  permissions?: string[];
};

type LongLivedTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type IgProfile = {
  id: string;
  username: string;
  account_type?: string;
  name?: string;
};

type ContainerStatus = {
  id?: string;
  status_code?: string;
  status?: string;
};

function requireAppCredentials(): { appId: string; appSecret: string } {
  const appId = getInstagramAppId();
  const appSecret = getInstagramAppSecret();
  if (!appId || !appSecret) {
    throw new InstagramApiError(
      "Instagram is not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
      503
    );
  }
  return { appId, appSecret };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const err = (body as { error?: { message?: string; error_user_msg?: string } }).error;
  if (err?.error_user_msg) return err.error_user_msg;
  if (err?.message) return err.message;
  return fallback;
}

export function buildAuthorizeUrl(state: string): string {
  const { appId } = requireAppCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: "code",
    scope: IG_OAUTH_SCOPES,
    state,
  });
  return `${IG_OAUTH_AUTHORIZE}?${params.toString()}`;
}

/** Exchange authorization code for short-lived token (+ user id). */
export async function exchangeCodeForShortLivedToken(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const { appId, appSecret } = requireAppCredentials();
  const cleaned = code.replace(/#_+$/, "");
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: getInstagramRedirectUri(),
    code: cleaned,
  });

  const res = await fetch(IG_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await readJson(res)) as TokenResponse & { error_message?: string; error_type?: string };
  if (!res.ok || !data?.access_token) {
    throw new InstagramApiError(
      data?.error_message || errorMessageFromBody(data, "Failed to exchange Instagram auth code"),
      res.status || 502,
      data
    );
  }
  return {
    accessToken: data.access_token,
    userId: String(data.user_id ?? ""),
  };
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { appSecret } = requireAppCredentials();
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
  const data = (await readJson(res)) as LongLivedTokenResponse;
  if (!res.ok || !data?.access_token) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to get long-lived Instagram token"),
      res.status || 502,
      data
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 60 * 60 * 24 * 60,
  };
}

export async function refreshLongLivedToken(accessToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
  const data = (await readJson(res)) as LongLivedTokenResponse;
  if (!res.ok || !data?.access_token) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to refresh Instagram token"),
      res.status || 502,
      data
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 60 * 60 * 24 * 60,
  };
}

export async function fetchIgProfile(accessToken: string): Promise<IgProfile> {
  const params = new URLSearchParams({
    fields: "user_id,username,account_type,name",
    access_token: accessToken,
  });
  const res = await fetch(`${IG_GRAPH_BASE}/me?${params.toString()}`);
  const data = (await readJson(res)) as {
    user_id?: string | number;
    id?: string | number;
    username?: string;
    account_type?: string;
    name?: string;
    error?: { message?: string };
  };
  if (!res.ok || (!data?.user_id && !data?.id)) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to load Instagram profile"),
      res.status || 502,
      data
    );
  }
  return {
    id: String(data.user_id ?? data.id),
    username: data.username || "instagram",
    account_type: data.account_type,
    name: data.name,
  };
}

export async function createImageContainer(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const params = new URLSearchParams({
    image_url: opts.imageUrl,
    caption: opts.caption,
    access_token: opts.accessToken,
  });
  const res = await fetch(`${IG_GRAPH_BASE}/${opts.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await readJson(res)) as { id?: string };
  if (!res.ok || !data?.id) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to create Instagram media container"),
      res.status || 502,
      data
    );
  }
  return data.id;
}

export async function getContainerStatus(
  containerId: string,
  accessToken: string
): Promise<ContainerStatus> {
  const params = new URLSearchParams({
    fields: "status_code,status",
    access_token: accessToken,
  });
  const res = await fetch(`${IG_GRAPH_BASE}/${containerId}?${params.toString()}`);
  const data = (await readJson(res)) as ContainerStatus;
  if (!res.ok) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to check media container status"),
      res.status || 502,
      data
    );
  }
  return data;
}

async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 12
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getContainerStatus(containerId, accessToken);
    const code = (status.status_code || "").toUpperCase();
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new InstagramApiError(
        status.status || "Instagram media container failed processing",
        502,
        status
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  // Photos are usually ready quickly; attempt publish anyway if still IN_PROGRESS.
}

export async function publishContainer(opts: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const params = new URLSearchParams({
    creation_id: opts.creationId,
    access_token: opts.accessToken,
  });
  const res = await fetch(`${IG_GRAPH_BASE}/${opts.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await readJson(res)) as { id?: string };
  if (!res.ok || !data?.id) {
    throw new InstagramApiError(
      errorMessageFromBody(data, "Failed to publish Instagram post"),
      res.status || 502,
      data
    );
  }
  return data.id;
}

/** Create container, wait briefly for processing, publish. Returns published media id. */
export async function publishPhotoPost(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<{ mediaId: string; containerId: string }> {
  const containerId = await createImageContainer(opts);
  await waitForContainerReady(containerId, opts.accessToken);
  const mediaId = await publishContainer({
    igUserId: opts.igUserId,
    accessToken: opts.accessToken,
    creationId: containerId,
  });
  return { mediaId, containerId };
}

/** Turn a site-relative path into a public absolute URL Instagram can fetch. */
export function toPublicImageUrl(imagePathOrUrl: string, siteOrigin: string): string {
  const trimmed = imagePathOrUrl.trim();
  if (!trimmed) {
    throw new InstagramApiError("Image URL is required", 400);
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith("/")) {
    throw new InstagramApiError("Image must be a public HTTPS URL or site path", 400);
  }
  return `${siteOrigin.replace(/\/$/, "")}${trimmed}`;
}
