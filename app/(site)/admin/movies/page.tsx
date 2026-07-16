import Link from "next/link";
import {
  DRIVE_MOVIES_FOLDER_URL,
  getDriveMovies,
  type DriveMovieFile,
} from "@/lib/googleDriveMovies";

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
        className="neo-link inline-flex min-h-11 items-center text-sm"
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
          Pick a movie below to play it with a standard video player. This avoids
          the Google Drive embedded player that is not available on the Switch.
        </p>
      </header>

      <section className="neo overflow-hidden">
        <div className="neo-inset m-4 flex flex-col gap-4 p-4 sm:m-5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
          <a
            href={DRIVE_MOVIES_FOLDER_URL}
            target="_blank"
            rel="noreferrer"
            className="neo-btn-primary"
          >
            Open in Google Drive
          </a>
        </div>

        <div className="p-4 sm:p-5">
          {error ? (
            <div className="neo-inset p-4 text-sm leading-relaxed text-[var(--color-ink)]">
              Could not load the movie list from Google Drive. Try opening Drive
              directly, or reload this page. Error: {error}
            </div>
          ) : movies.length === 0 ? (
            <div className="neo-inset p-6 text-center text-sm text-[var(--color-muted)]">
              No MP4 movies were found in the Google Drive folder.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {movies.map((movie) => (
                <li key={movie.id}>
                  <Link
                    href={`/admin/movies/${movie.id}`}
                    className="neo-sm card-hover block px-4 py-3"
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
