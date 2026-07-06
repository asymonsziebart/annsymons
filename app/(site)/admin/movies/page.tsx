import Link from "next/link";
import { getDriveMovies, type DriveMovieFile } from "@/lib/googleDriveMovies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies | Admin",
  description: "Private movie library with Switch-friendly playback.",
  robots: "noindex, nofollow",
};

async function loadMovies(): Promise<{
  movies: DriveMovieFile[];
  error: string | null;
}> {
  try {
    return { movies: await getDriveMovies(), error: null };
  } catch (error) {
    return {
      movies: [],
      error:
        error instanceof Error ? error.message : "Could not load movies from Google Drive",
    };
  }
}

export default async function AdminMoviesPage() {
  const { movies, error } = await loadMovies();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <header className="mb-8 mt-4 sm:mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Private movie library
        </p>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Watch movies
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Pick a movie below to play it inside this app. The Google Drive player
          is not used because it is not available on the Switch.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-[0_24px_60px_-36px_rgba(28,25,23,0.65)] ring-1 ring-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-cream-dark)]/45 p-4 sm:p-5">
          <div>
            <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
              All movies
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {movies.length > 0
                ? `${movies.length} movies found in the shared Google Drive folder.`
                : "Movies are loaded from the shared Google Drive folder."}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              Could not load the movie list. Reload this page and try again.
              Error: {error}
            </div>
          ) : movies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 p-6 text-center text-sm text-[var(--color-muted)]">
              No MP4 movies were found in the Google Drive folder.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {movies.map((movie) => (
                <li key={movie.id}>
                  <Link
                    href={`/admin/movies/${movie.id}`}
                    className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-3 transition-colors hover:bg-[var(--color-cream-dark)]/70"
                  >
                    <span className="block text-sm font-semibold text-[var(--color-ink)]">
                      {movie.name}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--color-accent)]">
                      Play movie →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
