import Link from "next/link";
import MorseTrainer from "./MorseTrainer";

export const metadata = {
  title: "Morse Code | Admin",
  robots: "noindex, nofollow",
};

export default function AdminMorsePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Practice tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          Morse Code
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          Tap Dot or Dash to walk the tree. The path lights up like the pocket
          trainer. Pause a couple seconds and it resets so you can try another letter.
        </p>
      </header>

      <MorseTrainer />
    </div>
  );
}
