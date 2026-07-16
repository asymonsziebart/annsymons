import Link from "next/link";
import { getGarageBins } from "@/lib/data/garage";
import GarageInventoryApp from "./GarageInventoryApp";

export const metadata = {
  title: "Garage Inventory | Admin",
  robots: "noindex, nofollow",
};

export default async function GarageInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ bin?: string }>;
}) {
  const sp = await searchParams;
  const bins = await getGarageBins();
  const initialBinCode = typeof sp.bin === "string" ? sp.bin : "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Admin tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          Garage Inventory
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          Upload bin photos, scan or type each QR/bin code, let AI draft an inventory from the photo,
          then search everything when you need to find it.
        </p>
      </header>

      <GarageInventoryApp initialBins={bins} initialBinCode={initialBinCode} />
    </div>
  );
}
