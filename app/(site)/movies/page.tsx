const driveFolderUrl =
  "https://drive.google.com/drive/folders/1RBAj7byBO2YswerQRK105ba74ZvG6Qm9";
const embeddedDriveFolderUrl =
  "https://drive.google.com/embeddedfolderview?id=1RBAj7byBO2YswerQRK105ba74ZvG6Qm9#grid";

export const metadata = {
  title: "Movies | Ann Symons",
  description: "Watch movies from the shared Google Drive folder.",
};

export default function MoviesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-20">
      <header className="mb-8 sm:mb-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Movie library
        </p>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Watch movies
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Browse the shared Google Drive folder below, then select a movie to
          preview and play it.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-[0_24px_60px_-36px_rgba(28,25,23,0.65)] ring-1 ring-[var(--color-border)]">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border)] bg-[var(--color-cream-dark)]/45 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
              All movies
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              If the embedded folder does not load, open it directly in Google
              Drive.
            </p>
          </div>
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Open in Google Drive
          </a>
        </div>

        <div className="h-[68vh] min-h-[32rem] bg-white">
          <iframe
            title="Google Drive movie folder"
            src={embeddedDriveFolderUrl}
            className="h-full w-full border-0"
            allow="fullscreen"
          />
        </div>
      </section>
    </main>
  );
}
