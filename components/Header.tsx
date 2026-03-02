import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/recipes", label: "Recipes" },
  { href: "/gallery", label: "Gallery" },
] as const;

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
        >
          Ann Symons
        </Link>
        <nav className="flex gap-8" aria-label="Main">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="link-accent text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
