import Link from "next/link";
import { getVoiceItems } from "@/lib/data/voices";
import { addVoiceItem, deleteVoiceItem } from "./actions";

export const metadata = {
  title: "Voices | Admin",
  robots: "noindex, nofollow",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function VoicesAdminPage() {
  const items = await getVoiceItems();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to Admin
      </Link>

      <div className="mt-4 rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Voices
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Add reminders for things he is not allowed to do.
        </p>

        <form action={addVoiceItem} className="mt-6 space-y-3">
          <label htmlFor="voice-text" className="block text-sm font-medium text-[var(--color-ink-muted)]">
            Not allowed to do
          </label>
          <textarea
            id="voice-text"
            name="text"
            rows={3}
            required
            placeholder="Type a new reminder..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] sm:w-auto"
          >
            Add to list
          </button>
        </form>
      </div>

      <section className="mt-6 rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Things he is not allowed to do
        </h2>

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Nothing has been added yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="whitespace-pre-line text-[var(--color-ink)]">{item.text}</p>
                    {item.created_at ? (
                      <p className="mt-2 text-xs text-[var(--color-muted)]">
                        Added {formatDate(item.created_at)}
                      </p>
                    ) : null}
                  </div>
                  <form action={deleteVoiceItem} className="shrink-0">
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 sm:w-auto"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
