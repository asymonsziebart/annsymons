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

const statusClasses: Record<PurchaseRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
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
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          DATABASE_URL is not set - requests will not load until the database is configured.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-stone-950">{counts.total}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{counts.pending}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Accepted
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">{counts.accepted}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-red-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-red-900">{counts.rejected}</p>
        </div>
      </section>

      {requests.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-sm text-stone-600 ring-1 ring-stone-200">
          No requests yet. Use the request form to add one.
        </section>
      ) : (
        <section className="space-y-3">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl bg-white p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.45)] ring-1 ring-stone-200 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-xl font-semibold text-stone-950">
                      {request.itemName}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        statusClasses[request.status]
                      }`}
                    >
                      {statusLabels[request.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    Requested {formatDate(request.createdAt)}
                    {request.requestedBy ? ` by ${request.requestedBy}` : ""}
                  </p>
                  {request.details ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                      {request.details}
                    </p>
                  ) : null}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
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
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Why this was accepted or rejected..."
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "accepted")}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "rejected")}
                  className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={savingId === request.id}
                  onClick={() => decide(request.id, "pending")}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  Mark pending
                </button>
                {savingId === request.id ? (
                  <span className="self-center text-sm text-stone-500">Saving...</span>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
