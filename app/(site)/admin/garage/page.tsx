import Link from "next/link";
import { getGarageBins } from "@/lib/data/garage";
import GarageInventoryApp from "./GarageInventoryApp";

export const metadata = {
  title: "Garage Inventory | Admin",
  robots: "noindex, nofollow",
};

export default async function GarageInventoryPage() {
  const bins = await getGarageBins();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <header className="mt-4 overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-5 shadow-[0_20px_60px_-38px_rgba(12,74,110,0.55)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
          Admin tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Garage Inventory
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-stone-700 sm:text-base">
          Upload bin photos, scan or type each QR/bin code, let AI draft an inventory from the photo,
          then search everything when you need to find it.
        </p>
      </header>

      <GarageInventoryApp initialBins={bins} />
    </div>
  );
}
