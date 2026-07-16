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
        className="neo-link inline-flex min-h-11 items-center text-sm"
      >
        ← Back to Admin
      </Link>

      <div className="neo mt-4 p-4 sm:p-6">
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
            className="neo-input"
          />
          <button
            type="submit"
            className="neo-btn-primary w-full sm:w-auto"
          >
            Add to list
          </button>
        </form>
      </div>

      <section className="neo mt-6 p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Things he is not allowed to do
        </h2>

        {items.length === 0 ? (
          <p className="neo-inset mt-4 px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Nothing has been added yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="neo-sm px-4 py-3"
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
                      className="neo-btn !min-h-10 w-full sm:w-auto"
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
