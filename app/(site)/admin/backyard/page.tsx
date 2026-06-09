import Link from "next/link";
import { getBackyardData } from "@/lib/data/backyard";
import BackyardApp from "./BackyardApp";

export const metadata = {
  title: "Backyard Plants | Admin",
  robots: "noindex, nofollow",
};

export default async function BackyardPlantsPage() {
  const { photos, pins } = await getBackyardData();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <header className="mt-4 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-[0_20px_60px_-38px_rgba(21,128,61,0.45)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Admin tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Backyard Plants
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-stone-700 sm:text-base">
          Upload a photo of your backyard, drop pins where you planted things, and search the
          catalog whenever you forget what went where.
        </p>
      </header>

      <BackyardApp initialPhotos={photos} initialPins={pins} />
    </div>
  );
}
