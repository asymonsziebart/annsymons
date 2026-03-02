import { galleryItems } from "@/lib/gallery";

export const metadata = {
  title: "Gallery | Ann Symons",
  description: "Photos and uploads.",
};

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8 sm:py-20">
      <header className="mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Gallery
        </h1>
        <p className="mt-3 text-lg text-[var(--color-muted)]">
          Photos and anything else you want to share. Add items in{" "}
          <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
            lib/gallery.ts
          </code>{" "}
          and put images in{" "}
          <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
            public/gallery/
          </code>
          .
        </p>
      </header>

      {galleryItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className="card-hover overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
            >
              {item.type === "image" ? (
                <a
                  href={item.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.title}
                    className="aspect-square w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                  />
                </a>
              ) : (
                <a
                  href={item.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex aspect-square items-center justify-center bg-[var(--color-cream-dark)] text-5xl transition-colors hover:bg-[var(--color-border)]"
                >
                  📄
                </a>
              )}
              <div className="p-4">
                <p className="font-medium text-[var(--color-ink)]">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center">
          <p className="text-[var(--color-muted)]">
            No items yet. Edit{" "}
            <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              lib/gallery.ts
            </code>{" "}
            to add photos or files.
          </p>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Put image files in{" "}
            <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              public/gallery/
            </code>{" "}
            and reference them as{" "}
            <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              /gallery/filename.jpg
            </code>
            .
          </p>
        </div>
      )}
    </main>
  );
}
