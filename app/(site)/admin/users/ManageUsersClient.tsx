"use client";

import { useMemo, useState, useTransition } from "react";
import { GRANTABLE_ADMIN_PAGES } from "@/lib/admin/pageAccess";
import type { SiteUserRow, SiteUserStatus } from "@/lib/data/siteUsers";

type Props = {
  initialUsers: SiteUserRow[];
  dbReady: boolean;
  migrationHint: string;
};

const STATUS_OPTIONS: SiteUserStatus[] = [
  "pending",
  "approved",
  "rejected",
  "disabled",
];

export default function ManageUsersClient({
  initialUsers,
  dbReady,
  migrationHint,
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<
    Record<number, { status: SiteUserStatus; allowedPages: string[]; adminNote: string }>
  >(() => Object.fromEntries(
    initialUsers.map((u) => [
      u.id,
      {
        status: u.status,
        allowedPages: u.allowedPages,
        adminNote: u.adminNote ?? "",
      },
    ])
  ));

  const pendingCount = useMemo(
    () => users.filter((u) => u.status === "pending").length,
    [users]
  );

  function syncDraft(user: SiteUserRow) {
    setDrafts((prev) => ({
      ...prev,
      [user.id]: {
        status: user.status,
        allowedPages: user.allowedPages,
        adminNote: user.adminNote ?? "",
      },
    }));
  }

  function togglePage(userId: number, href: string) {
    setDrafts((prev) => {
      const draft = prev[userId];
      if (!draft) return prev;
      const has = draft.allowedPages.includes(href);
      const allowedPages = has
        ? draft.allowedPages.filter((p) => p !== href)
        : [...draft.allowedPages, href];
      return { ...prev, [userId]: { ...draft, allowedPages } };
    });
  }

  function saveUser(userId: number) {
    const draft = drafts[userId];
    if (!draft) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userId,
            status: draft.status,
            allowedPages: draft.allowedPages,
            adminNote: draft.adminNote,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save user");
          return;
        }
        const user = data.user as SiteUserRow;
        setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
        syncDraft(user);
      } catch {
        setError("Could not save user");
      }
    });
  }

  function removeUser(userId: number) {
    if (!window.confirm("Delete this account permanently?")) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: userId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not delete user");
          return;
        }
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      } catch {
        setError("Could not delete user");
      }
    });
  }

  if (!dbReady) {
    return (
      <p className="neo-inset px-4 py-3 text-sm text-[var(--color-ink)]">
        Database is not configured. Set DATABASE_URL, then {migrationHint}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-[var(--color-muted)]">
        <span>
          {users.length} account{users.length === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span className="font-semibold text-[var(--color-accent)]">
          {pendingCount} pending
        </span>
        <span>·</span>
        <span>
          Public signup:{" "}
          <a href="/request-access" className="neo-link">
            /request-access
          </a>
        </span>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {users.length === 0 ? (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-ink)]">
          No account requests yet. If this is the first deploy, {migrationHint}
        </p>
      ) : null}

      <ul className="space-y-6">
        {users.map((user) => {
          const isOwnerRow = user.role === "owner";
          const draft = drafts[user.id] ?? {
            status: user.status,
            allowedPages: user.allowedPages,
            adminNote: user.adminNote ?? "",
          };
          return (
            <li key={user.id} className="neo p-5 sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
                    {user.name}
                    {isOwnerRow ? (
                      <span className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                        Super admin
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Requested {user.createdAt.slice(0, 10)}
                    {user.decidedAt ? ` · Updated ${user.decidedAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                {isOwnerRow ? (
                  <p className="mt-3 text-sm text-[var(--color-accent)] sm:mt-0">
                    Full access · cannot be edited here
                  </p>
                ) : (
                  <label className="mt-3 flex items-center gap-2 text-sm sm:mt-0">
                    <span className="text-[var(--color-muted)]">Status</span>
                    <select
                      className="neo-input !w-auto !py-1.5"
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [user.id]: {
                            ...draft,
                            status: e.target.value as SiteUserStatus,
                          },
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {isOwnerRow ? null : (
                <>
                  <fieldset className="mt-5">
                    <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Pages they can see
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {GRANTABLE_ADMIN_PAGES.map((page) => {
                        const checked = draft.allowedPages.includes(page.href);
                        return (
                          <label
                            key={page.href}
                            className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-sm hover:shadow-[var(--neo-shadow-out-sm)]"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => togglePage(user.id, page.href)}
                            />
                            <span>
                              <span className="font-medium text-[var(--color-ink)]">
                                {page.label}
                              </span>
                              <span className="block text-xs text-[var(--color-muted)]">
                                {page.href}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <label className="mt-4 block text-sm">
                    <span className="text-[var(--color-muted)]">Note (optional)</span>
                    <input
                      className="neo-input mt-1"
                      value={draft.adminNote}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [user.id]: { ...draft, adminNote: e.target.value },
                        }))
                      }
                      placeholder="Why approved / which access"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="neo-btn-primary !min-h-10 !px-4 !py-2 disabled:opacity-50"
                      disabled={pending}
                      onClick={() => saveUser(user.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="neo-btn !min-h-10 !px-4 !py-2 disabled:opacity-50"
                      disabled={pending}
                      onClick={() => removeUser(user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
