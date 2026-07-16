import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriveMovies, isDriveFileId } from "@/lib/googleDriveMovies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movie Player | Admin",
  robots: "noindex, nofollow",
};

export default async function AdminMoviePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDriveFileId(id)) notFound();

  const movies = await getDriveMovies();
  const movie = movies.find((item) => item.id === id);
  if (!movie) notFound();

  const streamUrl = `/api/admin/movies/${id}/stream`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/admin/movies"
          className="neo-link inline-flex min-h-11 items-center text-sm"
        >
          ← Back to Movies
        </Link>
        <Link
          href="/admin"
          className="neo-link inline-flex min-h-11 items-center text-sm"
        >
          Admin
        </Link>
      </div>

      <header className="mb-6 mt-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Now playing
        </p>
        <h1 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          {movie.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
          This uses a standard video player instead of the Google Drive player,
          which should work better on devices with limited browser support.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-black">
        <video
          controls
          playsInline
          preload="metadata"
          src={streamUrl}
          className="aspect-video w-full bg-black"
        >
          <a href={streamUrl}>Open the movie stream</a>
        </video>
      </section>

      <div className="neo mt-4 p-4 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        If playback does not start right away on the Switch, wait a moment for
        the stream to prepare and press play again.
      </div>
    </div>
  );
}
