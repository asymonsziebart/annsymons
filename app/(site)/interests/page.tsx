import { interests } from "@/lib/interests";

export const metadata = {
  title: "Interests | Ann Symons",
  description: "What I'm into—painting, crochet, knitting, coding, costume design, and more.",
};

export default function InterestsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-20">
      <div className="neo mx-auto max-w-xl px-6 py-8 text-center sm:px-8 sm:py-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          What I&apos;m into
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-[var(--color-ink-muted)]">
          {interests.intro}
        </p>
      </div>
      <ul className="mt-8 flex flex-wrap justify-center gap-3">
        {interests.items.map((item) => (
          <li key={item}>
            <span className="neo-chip">{item}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
