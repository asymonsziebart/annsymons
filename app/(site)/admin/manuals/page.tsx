import Link from "next/link";
import { getSql } from "@/lib/db";
import { getManuals, getSeedManuals } from "@/lib/data/manuals";
import ManualsApp from "./ManualsApp";

export const metadata = {
  title: "Manuals | Admin",
  robots: "noindex, nofollow",
};

export default async function ManualsAdminPage() {
  const dbReady = Boolean(getSql());
  const manuals = dbReady ? await getManuals() : getSeedManuals();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <header className="mt-4 overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-stone-50 p-5 shadow-[0_20px_60px_-38px_rgba(15,118,110,0.45)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
          Admin tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Manuals
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-stone-700 sm:text-base">
          Keep appliance and gear manuals in one place. Search by brand, model, or notes — sewing,
          vehicles, lawn gear, 3D printers, and more.
        </p>
      </header>

      <ManualsApp initialManuals={manuals} dbReady={dbReady} />
    </div>
  );
}
