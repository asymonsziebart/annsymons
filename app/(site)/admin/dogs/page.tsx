import Link from "next/link";
import DogBreedingGame from "./DogBreedingGame";

export const metadata = {
  title: "Puppy Ranch | Admin",
  robots: "noindex, nofollow",
};

export default function AdminDogsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Admin game
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          Puppy Ranch
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          Buy starter dogs, match two adults, hatch a puppy with inherited traits,
          then sell the cutest puppies for bigger coins.
        </p>
      </header>

      <DogBreedingGame />
    </div>
  );
}
