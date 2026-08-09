import Link from "next/link";
import { resume } from "@/lib/resume";
import ResumeCollapse from "@/components/ResumeCollapse";
import HeroWithHeadshot from "@/components/HeroWithHeadshot";

const exploreLinks = [
  { href: "/recipes", label: "Recipes", blurb: "Favorite dishes and kitchen notes" },
  {
    href: "/air-draw",
    label: "Air Draw",
    blurb: "Paint in the air with your fingertip and webcam",
  },
  {
    href: "/holo-ttt",
    label: "Hologram Tic-Tac-Toe",
    blurb: "Point, pinch, and play on a floating board",
  },
  { href: "/interests", label: "Interests", blurb: "What I’m into outside of work" },
] as const;

export default async function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-20">
      <HeroWithHeadshot
        name={resume.name}
        tagline={resume.tagline}
        website={resume.website}
      />

      <section className="mx-auto mt-12 max-w-2xl sm:mt-16" aria-label="Explore">
        <h2 className="text-center font-heading text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
          Explore
        </h2>
        <ul className="neo-inset mt-6 space-y-1 p-2 sm:p-3">
          {exploreLinks.map(({ href, label, blurb }) => (
            <li key={href}>
              <Link
                href={href}
                className="neo-explore-row group flex min-h-14 items-baseline justify-between gap-4 px-3 py-3.5 sm:px-4"
              >
                <span className="font-heading text-lg text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-accent)]">
                  {label}
                </span>
                <span className="max-w-[14rem] text-right text-sm leading-snug text-[var(--color-ink-muted)] sm:max-w-xs">
                  {blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Collapsible resume at the bottom */}
      <section className="mt-10 sm:mt-16">
        <ResumeCollapse resume={resume} />
      </section>
    </main>
  );
}
