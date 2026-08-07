import Link from "next/link";
import { getFamilyHistory } from "@/lib/familyHistory";

export const metadata = {
  title: "Family History | Admin",
  robots: "noindex, nofollow",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  needs_review: "Needs review",
  unverified: "Unverified",
};

export default async function FamilyHistoryAdminPage() {
  const history = await getFamilyHistory();
  const confirmed = history.sections.filter((s) => s.status === "confirmed");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Admin research
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          {history.title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          {history.note}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Updated {history.updatedAt} · {confirmed.length} confirmed sections ·{" "}
          <Link href="/admin/family-tree" className="neo-link">
            Open Family Tree
          </Link>
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {history.sections.map((section) => (
          <article
            key={section.id}
            id={section.id}
            className="border-t border-[var(--color-ink)]/10 pt-8 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                {section.title}
              </h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {STATUS_LABEL[section.status] ?? section.status}
              </span>
              <span className="text-xs text-[var(--color-muted)]">{section.line} line</span>
            </div>

            <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
              {section.summary}
            </p>

            {section.highlights.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--color-ink)]">
                {section.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {section.verbatimEntries && section.verbatimEntries.length > 0 ? (
              <div className="mt-6 space-y-8">
                {section.verbatimEntries.map((entry) => (
                  <blockquote
                    key={entry.title}
                    className="border-l-2 border-[var(--color-ink)]/20 pl-4 sm:pl-5"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Journal — word for word
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-[var(--color-ink)]">
                      {entry.title}
                    </h3>
                    <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-ink)] sm:text-base">
                      {entry.paragraphs.map((paragraph, index) => (
                        <p key={`${entry.title}-${index}`} className="text-pretty whitespace-pre-wrap">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </blockquote>
                ))}
              </div>
            ) : null}

            {section.sources.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Sources
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {section.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neo-link break-words"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
