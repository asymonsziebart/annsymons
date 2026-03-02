import Link from "next/link";
import Image from "next/image";
import { resume } from "@/lib/resume";
import { getGalleryItems } from "@/lib/data/gallery";
import ResumeCollapse from "@/components/ResumeCollapse";

export default async function Home() {
  const galleryItems = await getGalleryItems();
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8 sm:py-20">
      {/* Hero: name + tagline */}
      <header className="text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          {resume.name}
        </h1>
        {resume.tagline && (
          <p className="mt-2 text-lg text-[var(--color-muted)]">
            {resume.tagline}
          </p>
        )}
        {resume.website && (
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {resume.website}
          </p>
        )}
      </header>

      {/* Headshot – center of the page */}
      <div className="mx-auto mt-10 flex justify-center">
        <div className="relative aspect-square w-64 overflow-hidden rounded-full ring-4 ring-[var(--color-surface)] shadow-xl sm:w-80">
          <Image
            src="/headshot.png"
            alt={`${resume.name} – professional headshot`}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 640px) 256px, 320px"
          />
        </div>
      </div>

      {/* Gallery teaser */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
            Photos & more
          </h2>
          <Link
            href="/gallery"
            className="text-sm font-medium text-[var(--color-teal)] hover:text-[var(--color-teal-hover)] hover:underline transition-colors"
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

      {/* Collapsible resume at the bottom */}
      <section className="mt-16">
        <ResumeCollapse resume={resume} />
      </section>
    </main>
  );
}
