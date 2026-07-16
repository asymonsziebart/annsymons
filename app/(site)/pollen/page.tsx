import Link from "next/link";
import {
  getSterlingHeightsPollen,
  STERLING_HEIGHTS_MI,
} from "@/lib/pollen/sterlingHeightsPollen";

export const metadata = {
  title: "Pollen | Ann Symons",
  description: `Pollen forecast for ${STERLING_HEIGHTS_MI.name}.`,
  robots: { index: false, follow: false },
};

function categoryTone(category: string | null): string {
  if (!category) return "text-[var(--color-ink-muted)]";
  const t = category.toLowerCase();
  if (t.includes("very low") || t.includes("low")) {
    return "text-[var(--color-teal)]";
  }
  if (t.includes("moderate")) {
    return "text-[var(--color-mustard)]";
  }
  if (t.includes("high") || t.includes("very high")) {
    return "text-[var(--color-coral)]";
  }
  return "text-[var(--color-ink-muted)]";
}

export default async function PollenPage() {
  const result = await getSterlingHeightsPollen(5);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">
      <p className="text-center text-xs text-[var(--color-ink-muted)]">
        <Link href="/" className="neo-link text-xs">
          Home
        </Link>
      </p>
      <h1 className="mt-4 text-center font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
        Pollen
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-pretty text-center text-sm leading-relaxed text-[var(--color-ink-muted)]">
        Forecast for <span className="font-medium text-[var(--color-ink)]">{STERLING_HEIGHTS_MI.name}</span>
        {result.ok && result.regionCode ? (
          <span className="text-[var(--color-ink-muted)]"> ({result.regionCode})</span>
        ) : null}
        . Source:{" "}
        <a
          href="https://developers.google.com/maps/documentation/pollen"
          className="neo-link underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Pollen API
        </a>
        , updated about every 30 minutes on this site.
      </p>

      {!result.ok ? (
        <div
          className="neo-inset mx-auto mt-10 max-w-lg px-4 py-5 text-sm text-[var(--color-ink)]"
          role="status"
        >
          {result.reason === "missing_key" ? (
            <>
              <p className="font-medium text-[var(--color-ink)]">API key not configured</p>
              <p className="mt-2 leading-relaxed text-[var(--color-ink-muted)]">
                Add <code className="neo-chip !min-h-0 !px-1.5 !py-0.5 !text-xs">GOOGLE_POLLEN_API_KEY</code>{" "}
                (or reuse <code className="neo-chip !min-h-0 !px-1.5 !py-0.5 !text-xs">GOOGLE_MAPS_API_KEY</code> with
                the{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/pollen.googleapis.com"
                  className="neo-link font-medium underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pollen API
                </a>{" "}
                enabled) in your environment, then redeploy.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-[var(--color-ink)]">Could not load pollen data</p>
              <p className="mt-2 text-[var(--color-ink-muted)]">
                {result.reason === "http_error" && result.status != null
                  ? `HTTP ${result.status}${result.detail ? `: ${result.detail}` : ""}`
                  : result.detail ?? "Unexpected error"}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-8">
          {result.daily.map((day, i) => (
            <section
              key={day.iso || i}
              className="neo p-4 sm:p-5"
            >
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                {i === 0 ? "Today · " : ""}
                {day.dateLabel}
              </h2>
              {day.types.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No pollen type data for this day.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {day.types.map((t) => (
                    <li
                      key={`${day.iso}-${t.code}`}
                      className="neo-inset px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <span className="font-medium text-[var(--color-ink)]">{t.displayName}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {t.category ? (
                            <span
                              className={`neo-chip !min-h-8 !py-1 !text-xs ${categoryTone(t.category)}`}
                            >
                              {t.category}
                            </span>
                          ) : null}
                          {t.value != null ? (
                            <span className="text-xs text-[var(--color-ink-muted)]">UPI {t.value}</span>
                          ) : null}
                          <span className="text-xs text-[var(--color-ink-muted)]">
                            {t.inSeason ? "In season" : "Out of season"}
                          </span>
                        </div>
                      </div>
                      {t.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{t.description}</p>
                      ) : null}
                      {t.recommendations.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-ink)]">
                          {t.recommendations.map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mx-auto mt-12 max-w-md text-center text-[0.65rem] leading-relaxed text-[var(--color-ink-muted)]">
        This page is not linked in the site navigation. Pollen levels are forecasts, not medical advice.
      </p>
    </main>
  );
}
