"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PurchaseRequestRow,
  PurchaseRequestStatus,
} from "@/lib/data/purchaseRequests";

type Props = {
  initialRequests: PurchaseRequestRow[];
  dbReady: boolean;
};

const statusLabels: Record<PurchaseRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

const statusTextClasses: Record<PurchaseRequestStatus, string> = {
  pending: "text-[var(--color-accent)]",
  accepted: "text-[var(--color-ink)]",
  rejected: "text-[var(--color-ink-muted)]",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PurchaseRequestsAdmin({ initialRequests, dbReady }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [reasonDrafts, setReasonDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialRequests.map((request) => [request.id, request.decisionReason ?? ""]))
  );
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        acc.total += 1;
        acc[request.status] += 1;
        return acc;
      },
      { total: 0, pending: 0, accepted: 0, rejected: 0 }
    );
  }, [requests]);

  async function decide(id: number, status: PurchaseRequestStatus) {
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/purchase-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          decisionReason: reasonDrafts[id] ?? "",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        request?: PurchaseRequestRow;
      };
      if (!res.ok || !data.request) {
        setError(data.error || "Could not update request.");
        return;
      }
      setRequests((current) =>
        current.map((request) => (request.id === id ? data.request! : request))
      );
      setReasonDrafts((current) => ({
        ...current,
        [id]: data.request!.decisionReason ?? "",
      }));
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {!dbReady ? (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-ink)]">
          DATABASE_URL is not set - requests will not load until the database is configured.
        </p>
      ) : null}

      {error ? (
        <p className="neo-inset px-4 py-3 text-sm text-[var(--color-accent)]">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="neo p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Total</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{counts.total}</p>
        </div>
        <div className="neo p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{counts.pending}</p>
        </div>
        <div className="neo p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Accepted
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{counts.accepted}</p>
        </div>
        <div className="neo p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{counts.rejected}</p>
        </div>
      </section>

      {requests.length === 0 ? (
        <section className="neo p-6 text-sm text-[var(--color-muted)]">
          No requests yet. Use the request form to add one.
        </section>
      ) : (
        <section className="space-y-3">
          {requests.map((request) => (
            <article
              key={request.id}
              className="neo p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
                      {request.itemName}
                    </h2>
                    <span
                      className={`neo-chip !min-h-7 !py-0.5 !text-xs ${statusTextClasses[request.status]}`}
                    >
                      {statusLabels[request.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Requested {formatDate(request.createdAt)}
                    {request.requestedBy ? ` by ${request.requestedBy}` : ""}
                  </p>
                  {request.details ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {request.details}
                    </p>
                  ) : null}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Decision reason
                </span>
                <textarea
                  value={reasonDrafts[request.id] ?? ""}
                  onChange={(event) =>
                    setReasonDrafts((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="neo-input"
                  placeholder="Why this was accepted or rejected..."
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "accepted")}
                  className="neo-btn-primary disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "rejected")}
                  className="neo-btn disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "pending")}
                  className="neo-btn disabled:opacity-60"
                >
                  Mark pending
                </button>
                {savingId === request.id ? (
                  <span className="self-center text-sm text-[var(--color-muted)]">Saving...</span>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
