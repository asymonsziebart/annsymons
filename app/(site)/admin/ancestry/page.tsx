import Link from "next/link";
import { getAncestryDna } from "@/lib/ancestryDna";

export const metadata = {
  title: "AncestryDNA | Admin",
  robots: "noindex, nofollow",
};

function DonutChart({
  regions,
}: {
  regions: { percent: number; color: string; label: string }[];
}) {
  let cursor = 0;
  const segments = regions.map((region) => {
    const start = cursor;
    cursor += region.percent;
    return {
      ...region,
      start,
      end: cursor,
    };
  });

  const gradient = segments
    .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
      <div
        className="relative h-44 w-44 shrink-0 rounded-full sm:h-52 sm:w-52"
        style={{
          background: `conic-gradient(${gradient})`,
          boxShadow: "var(--neo-shadow-out)",
        }}
        role="img"
        aria-label={regions
          .map((region) => `${region.label} ${region.percent}%`)
          .join(", ")}
      >
        <div
          className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-[var(--neo-bg)]"
          style={{ boxShadow: "var(--neo-shadow-in-sm)" }}
        >
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Ancestry
          </span>
          <span className="mt-1 font-heading text-2xl font-semibold text-[var(--color-ink)]">
            DNA
          </span>
        </div>
      </div>
      <ul className="w-full max-w-xs space-y-2 text-sm">
        {regions.map((region) => (
          <li key={region.label} className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: region.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-[var(--color-ink)]">
              {region.label}
            </span>
            <span className="font-semibold tabular-nums text-[var(--color-ink)]">
              {region.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AncestryDnaAdminPage() {
  const data = await getAncestryDna();
  const regionTotal = data.regions.reduce((sum, region) => sum + region.percent, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {data.personName}
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          {data.title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          {data.note}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Updated {data.updatedAt} · {regionTotal}% accounted ·{" "}
          <Link href="/admin/family-history" className="neo-link">
            Family History
          </Link>
          {" · "}
          <Link href="/admin/family-tree" className="neo-link">
            Family Tree
          </Link>
        </p>
      </header>

      <section className="mt-10 border-t border-[var(--color-ink)]/10 pt-8">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Ancestral regions
        </h2>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Ethnicity estimate — where your DNA looks most like today&apos;s reference populations.
        </p>

        <div className="mt-6">
          <DonutChart regions={data.regions} />
        </div>

        <div className="mt-10 space-y-8">
          {data.regions.map((region) => (
            <article key={region.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-xl font-semibold tracking-tight text-[var(--color-ink)]">
                  {region.label}
                </h3>
                <span className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
                  {region.percent}%
                </span>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--neo-bg)]"
                style={{ boxShadow: "var(--neo-shadow-in-sm)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${region.percent}%`,
                    background: region.color,
                  }}
                />
              </div>
              {region.subregions.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-ink)]">
                  {region.subregions.map((sub) => (
                    <li
                      key={sub.label}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    >
                      <span className="text-[var(--color-ink-muted)]">{sub.label}</span>
                      <span className="tabular-nums font-medium">{sub.percent}%</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-[var(--color-ink)]/10 pt-8">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Ancestral journeys
        </h2>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Genetic communities — shared migration and settlement patterns with other AncestryDNA
          testers.
        </p>

        <ol className="mt-6 space-y-6">
          {data.journeys.map((journey, index) => (
            <li key={journey.id}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Journey {index + 1}
              </p>
              <h3 className="mt-1 font-heading text-xl font-semibold tracking-tight text-[var(--color-ink)]">
                {journey.label}
              </h3>
              {journey.subregions.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {journey.subregions.map((sub) => (
                    <li key={sub}>{sub}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
