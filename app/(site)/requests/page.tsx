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
        className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Home
      </Link>
      <section className="mt-6 rounded-3xl bg-white p-5 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] ring-1 ring-stone-200 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
          Request review
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-stone-950">
          Things we want to buy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Add something to the list so it can be accepted, rejected, or sent back with a reason.
        </p>
        <PurchaseRequestForm />
      </section>
    </main>
  );
}
