import Link from "next/link";
import { resume } from "@/lib/resume";
import { galleryItems } from "@/lib/gallery";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8 sm:py-20">
      {/* Resume hero card */}
      <section className="overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-[0_4px_24px_-4px_rgba(28,25,23,0.08),0_8px_48px_-8px_rgba(28,25,23,0.06)] ring-1 ring-[var(--color-border)]">
        <div className="p-8 sm:p-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
                {resume.name}
              </h1>
              {resume.tagline && (
                <p className="mt-2 text-lg text-[var(--color-muted)]">
                  {resume.tagline}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-ink-muted)]">
                {resume.email && (
                  <a
                    href={`mailto:${resume.email}`}
                    className="hover:text-[var(--color-accent)] transition-colors"
                  >
                    {resume.email}
                  </a>
                )}
                {resume.website && (
                  <span>{resume.website}</span>
                )}
              </div>
            </div>
            <a
              href="/Profile.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Download resume (PDF)
            </a>
          </div>
          <p className="mt-8 max-w-2xl whitespace-pre-line text-[var(--color-ink-muted)] leading-relaxed">
            {resume.summary}
          </p>

          {resume.experience.length > 0 && (
            <div className="mt-10 border-t border-[var(--color-border)] pt-10">
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                Experience
              </h2>
              <ul className="mt-4 space-y-6">
                {resume.experience.map((job, i) => (
                  <li key={i}>
                    <div className="font-medium text-[var(--color-ink)]">
                      {job.role}
                    </div>
                    <div className="text-sm text-[var(--color-muted)]">
                      {job.company} · {job.period}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)] leading-relaxed">
                      {job.details}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.education.length > 0 && (
            <div className="mt-10 border-t border-[var(--color-border)] pt-10">
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                Education
              </h2>
              <ul className="mt-4 space-y-2">
                {resume.education.map((edu, i) => (
                  <li key={i} className="text-sm text-[var(--color-ink-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">
                      {edu.degree}
                    </span>
                    {" · "}
                    {edu.school} ({edu.period})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.skills.length > 0 && (
            <div className="mt-10 border-t border-[var(--color-border)] pt-10">
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                Skills
              </h2>
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                {resume.skills.join(" · ")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Gallery teaser */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
            Photos & more
          </h2>
          <Link
            href="/gallery"
            className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors link-accent"
          >
            View all →
          </Link>
        </div>
        {galleryItems.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {galleryItems.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={item.type === "image" ? item.src : "/gallery"}
                className="card-hover block overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
                target={item.type === "file" ? "_blank" : undefined}
                rel={item.type === "file" ? "noopener noreferrer" : undefined}
              >
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.title}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-[var(--color-cream-dark)] text-4xl">
                    📄
                  </div>
                )}
                <p className="p-3 text-sm font-medium text-[var(--color-ink)] line-clamp-1">
                  {item.title}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-10 text-center">
            <p className="text-[var(--color-muted)]">
              Add photos or files in the Gallery. Edit{" "}
              <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-sm text-[var(--color-ink-muted)]">
                lib/gallery.ts
              </code>{" "}
              and put images in{" "}
              <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-sm text-[var(--color-ink-muted)]">
                public/gallery/
              </code>
              .
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
