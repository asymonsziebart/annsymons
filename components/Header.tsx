import Link from "next/link";

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/recipes", label: "Recipes" },
  { href: "/interests", label: "Interests" },
] as const;

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors shrink-0"
        >
          Ann Symons
        </Link>
        <nav className="flex items-center gap-6 sm:gap-8" aria-label="Main">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="link-accent text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
              aria-label={label}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
