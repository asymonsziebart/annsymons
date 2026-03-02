import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/80 mt-20">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--color-muted)]">
            © {new Date().getFullYear()} Ann Symons
          </p>
          <nav className="flex gap-6" aria-label="Footer">
            <Link
              href="/"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Home
            </Link>
            <Link
              href="/blog"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/recipes"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Recipes
            </Link>
            <Link
              href="/gallery"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Gallery
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
