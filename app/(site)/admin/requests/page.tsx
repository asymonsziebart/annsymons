import Link from "next/link";
import { getSql } from "@/lib/db";
import {
  getPurchaseRequests,
  PURCHASE_REQUESTS_MIGRATION_HINT,
} from "@/lib/data/purchaseRequests";
import PurchaseRequestsAdmin from "./PurchaseRequestsAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Requests | Admin",
  robots: "noindex, nofollow",
};

export default async function AdminPurchaseRequestsPage() {
  const dbReady = getSql() !== null;
  const requests = await getPurchaseRequests();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin"
            className="neo-link text-sm"
          >
            ← Admin
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold text-[var(--color-ink)]">
            Purchase requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            Review things we want to buy, then accept or reject them with a reason.
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Form link:{" "}
            <Link href="/requests" className="neo-link text-xs">
              /requests
            </Link>
          </p>
        </div>
      </div>

      {dbReady && requests.length === 0 ? (
        <p className="neo-inset mb-4 px-4 py-3 text-sm text-[var(--color-ink)]">
          No rows loaded. If this is the first deploy, {PURCHASE_REQUESTS_MIGRATION_HINT}
        </p>
      ) : null}

      <PurchaseRequestsAdmin initialRequests={requests} dbReady={dbReady} />
    </main>
  );
}
