import Link from "next/link";
import MorseTrainer from "./MorseTrainer";

export const metadata = {
  title: "Morse Code | Admin",
  robots: "noindex, nofollow",
};

export default function AdminMorsePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <Link href="/admin" className="neo-link inline-flex min-h-10 items-center text-sm">
          ← Admin
        </Link>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
          Morse Code
        </h1>
        <span className="w-14" aria-hidden />
      </div>

      <MorseTrainer />
    </div>
  );
}
