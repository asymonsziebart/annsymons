import Link from "next/link";
import DogBreedingGame from "./DogBreedingGame";

export const metadata = {
  title: "Puppy Ranch | Admin",
  robots: "noindex, nofollow",
};

export default function AdminDogsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <header className="mt-4 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 p-5 shadow-[0_20px_60px_-38px_rgba(120,53,15,0.65)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
          Admin game
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Puppy Ranch
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-stone-700 sm:text-base">
          Buy starter dogs, match two adults, hatch a puppy with inherited traits,
          then sell the cutest puppies for bigger coins.
        </p>
      </header>

      <DogBreedingGame />
    </div>
  );
}
