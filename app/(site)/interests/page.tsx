import { interests } from "@/lib/interests";

export const metadata = {
  title: "Interests | Ann Symons",
  description: "What I'm into—painting, crochet, knitting, coding, costume design, and more.",
};

export default function InterestsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl text-center">
        What I'm into
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-center text-[var(--color-ink-muted)] leading-relaxed">
        {interests.intro}
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-2">
        {interests.items.map((item) => (
          <li key={item}>
            <span className="inline-block rounded-full bg-[var(--color-cream-dark)] px-4 py-2 text-sm text-[var(--color-ink-muted)] ring-1 ring-[var(--color-border)]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
