import { interests } from "@/lib/interests";

export const metadata = {
  title: "Interests | Ann Symons",
  description: "What I'm into—painting, crochet, knitting, coding, costume design, and more.",
};

export default function InterestsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-20">
      <h1 className="text-center font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
        What I'm into
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-pretty text-center leading-relaxed text-[var(--color-ink-muted)]">
        {interests.intro}
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
        {interests.items.map((item) => (
          <li key={item}>
            <span className="inline-flex min-h-10 items-center rounded-full bg-[var(--color-cream-dark)] px-4 py-2 text-sm text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
