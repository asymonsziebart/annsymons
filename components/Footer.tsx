import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="neo flex flex-col items-center justify-between gap-4 px-6 py-5 sm:flex-row">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            © {new Date().getFullYear()} Ann Symons
          </p>
          <nav className="flex gap-2" aria-label="Footer">
            <Link href="/" className="neo-btn !min-h-10 !px-3 !py-1.5 !text-xs">
              Home
            </Link>
            <Link href="/recipes" className="neo-btn !min-h-10 !px-3 !py-1.5 !text-xs">
              Recipes
            </Link>
            <Link href="/interests" className="neo-btn !min-h-10 !px-3 !py-1.5 !text-xs">
              Interests
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
