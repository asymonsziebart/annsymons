"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploadField from "../ImageUploadField";
import type {
  InstagramAccountPublic,
  InstagramPost,
  InstagramPostStatus,
} from "@/lib/data/instagram";

type Props = {
  configured: boolean;
  account: InstagramAccountPublic;
  posts: InstagramPost[];
  flashError?: string | null;
  flashConnected?: boolean;
  dbReady: boolean;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: InstagramPostStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "publishing":
      return "Publishing…";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export default function InstagramAdminClient({
  configured,
  account,
  posts: initialPosts,
  flashError,
  flashConnected,
  dbReady,
}: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState(flashError || "");
  const [notice, setNotice] = useState(
    flashConnected ? "Instagram connected successfully." : ""
  );
  const [disconnecting, setDisconnecting] = useState(false);

  const inputClass = "neo-input";

  const sortedPosts = useMemo(() => posts, [posts]);

  async function refresh() {
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const wantsSchedule = Boolean(scheduledAt);
      const res = await fetch("/api/admin/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          status: wantsSchedule ? "scheduled" : "draft",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save post");
        return;
      }
      setPosts((prev) => [data.post as InstagramPost, ...prev]);
      setImageUrl("");
      setCaption("");
      setScheduledAt("");
      setNotice(
        wantsSchedule
          ? "Post saved and scheduled."
          : "Draft saved. Publish when you’re ready."
      );
      await refresh();
    } catch {
      setError("Could not save post");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: number) {
    setError("");
    setNotice("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/instagram/posts/${id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Publish failed");
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "failed",
                  error_message: data.error || "Publish failed",
                }
              : p
          )
        );
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === id ? data.post : p)));
      setNotice("Posted to Instagram.");
      await refresh();
    } catch {
      setError("Publish failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this Instagram post from the queue?")) return;
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/instagram/posts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setNotice("Post removed.");
      await refresh();
    } catch {
      setError("Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Instagram from this site?")) return;
    setDisconnecting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/instagram/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Disconnect failed");
        return;
      }
      setNotice("Instagram disconnected.");
      await refresh();
    } catch {
      setError("Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      {!dbReady && (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-ink-muted)]">
          DATABASE_URL is not set — connection and posts will not persist. Add your Neon
          connection string, then redeploy.
        </p>
      )}

      {notice && (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-ink)]">{notice}</p>
      )}
      {error && (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-accent)]">{error}</p>
      )}

      <section className="neo p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Connect a Business or Creator Instagram account. Meta requires a professional
          account (personal accounts cannot publish via API).
        </p>

        {!configured ? (
          <div className="neo-inset mt-4 space-y-2 px-4 py-4 text-sm text-[var(--color-ink-muted)]">
            <p>Instagram app credentials are not configured yet.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Create a Meta app and add the{" "}
                <span className="text-[var(--color-ink)]">Instagram</span> product with
                Instagram Login.
              </li>
              <li>
                Add redirect URI:{" "}
                <code className="text-[var(--color-ink)]">
                  /api/instagram/callback
                </code>
              </li>
              <li>
                Set{" "}
                <code className="text-[var(--color-ink)]">INSTAGRAM_APP_ID</code>,{" "}
                <code className="text-[var(--color-ink)]">INSTAGRAM_APP_SECRET</code>, and{" "}
                <code className="text-[var(--color-ink)]">NEXT_PUBLIC_SITE_URL</code> in
                Vercel / .env.
              </li>
            </ol>
          </div>
        ) : account.connected ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[var(--color-ink)]">
                Connected as{" "}
                <span className="font-medium">@{account.username}</span>
              </p>
              {account.tokenExpiresAt && (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Token refresh by {formatWhen(account.tokenExpiresAt)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/api/instagram/oauth" className="neo-btn">
                Reconnect
              </a>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="neo-btn disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <a href="/api/instagram/oauth" className="neo-btn-primary inline-flex">
              Connect Instagram
            </a>
          </div>
        )}
      </section>

      <section className="neo p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          New post
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Upload a photo and write the caption ahead of time. Save as a draft, schedule it,
          or publish after you connect.
        </p>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <ImageUploadField
            folder="instagram"
            value={imageUrl}
            onChange={setImageUrl}
            label="Photo"
            inputClass={inputClass}
            required
          />
          <p className="text-xs text-[var(--color-muted)]">
            Instagram prefers JPEG. The image must be publicly reachable at your site URL
            when publishing.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Write your caption…"
              maxLength={2200}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {caption.length}/2200
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Schedule (optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Leave empty to save a draft. Scheduled posts publish via the daily cron
              after that time (or use Publish now anytime).
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !imageUrl}
            className="neo-btn-primary disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : scheduledAt
                ? "Save & schedule"
                : "Save draft"}
          </button>
        </form>
      </section>

      <section className="neo p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Queue
        </h2>
        {sortedPosts.length === 0 ? (
          <p className="neo-inset mt-4 px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            No posts yet. Upload a photo and caption above.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {sortedPosts.map((post) => {
              const busy = busyId === post.id;
              const canPublish =
                account.connected &&
                (post.status === "draft" ||
                  post.status === "scheduled" ||
                  post.status === "failed");
              const canDelete = post.status !== "publishing";

              return (
                <li key={post.id} className="neo-sm p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt=""
                      className="h-28 w-28 shrink-0 rounded-[var(--neo-radius-sm)] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          {statusLabel(post.status)}
                        </span>
                        {post.scheduled_at && (
                          <span className="text-sm text-[var(--color-muted)]">
                            · {formatWhen(post.scheduled_at)}
                          </span>
                        )}
                        {post.published_at && post.status === "published" && (
                          <span className="text-sm text-[var(--color-muted)]">
                            · {formatWhen(post.published_at)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
                        {post.caption || (
                          <span className="text-[var(--color-muted)]">(no caption)</span>
                        )}
                      </p>
                      {post.error_message && (
                        <p className="mt-2 text-sm text-[var(--color-accent)]">
                          {post.error_message}
                        </p>
                      )}
                      {post.status === "draft" && post.scheduled_at && (
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          Planned time: {toDatetimeLocalValue(post.scheduled_at)} (saved as
                          draft — set a future time and save as scheduled, or publish now)
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canPublish && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handlePublish(post.id)}
                            className="neo-btn-primary !min-h-10 !px-3 !py-2 disabled:opacity-50"
                          >
                            {busy ? "Working…" : "Publish now"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(post.id)}
                            className="neo-btn !min-h-10 !px-3 !py-2 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
