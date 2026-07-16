import Link from "next/link";
import PurchaseRequestForm from "./PurchaseRequestForm";

export const metadata = {
  title: "Purchase Requests | Ann Symons",
  robots: "noindex, nofollow",
};

export default function PurchaseRequestsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href="/"
        className="neo-btn !min-h-10 text-sm"
      >
        ← Home
      </Link>
      <section className="neo mt-6 p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Request review
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-[var(--color-ink)]">
          Things we want to buy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Add something to the list so it can be accepted, rejected, or sent back with a reason.
        </p>
        <PurchaseRequestForm />
      </section>
    </main>
  );
}
