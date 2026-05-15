/**
 * Sterling Heights, MI — coordinates near city center (for Google Pollen Forecast).
 * @see https://developers.google.com/maps/documentation/pollen
 */

export const STERLING_HEIGHTS_MI = {
  name: "Sterling Heights, Michigan",
  latitude: 42.5803,
  longitude: -83.0302,
} as const;

type PollenTypeInfo = {
  code?: string;
  displayName?: string;
  inSeason?: boolean;
  indexInfo?: {
    value?: number;
    category?: string;
    indexDescription?: string;
  };
  healthRecommendations?: string[];
};

type DailyInfo = {
  date?: { year?: number; month?: number; day?: number };
  pollenTypeInfo?: PollenTypeInfo[];
};

type ForecastResponse = {
  regionCode?: string;
  dailyInfo?: DailyInfo[];
};

export type PollenForecastOk = {
  ok: true;
  regionCode: string | undefined;
  daily: {
    dateLabel: string;
    iso: string;
    types: {
      code: string;
      displayName: string;
      inSeason: boolean;
      value: number | null;
      category: string | null;
      description: string | null;
      recommendations: string[];
    }[];
  }[];
};

export type PollenForecastErr = {
  ok: false;
  reason: "missing_key" | "bad_response" | "http_error";
  status?: number;
  detail?: string;
};

export type PollenForecastResult = PollenForecastOk | PollenForecastErr;

function apiKey(): string | undefined {
  const a = process.env.GOOGLE_POLLEN_API_KEY?.trim();
  if (a) return a;
  return process.env.GOOGLE_MAPS_API_KEY?.trim();
}

function formatDayLabel(d: NonNullable<DailyInfo["date"]>): string {
  const { year, month, day } = d;
  if (year == null || month == null || day == null) return "—";
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayIso(d: NonNullable<DailyInfo["date"]>): string {
  const { year, month, day } = d;
  if (year == null || month == null || day == null) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function getSterlingHeightsPollen(days = 5): Promise<PollenForecastResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: "missing_key" };
  }

  const url = new URL("https://pollen.googleapis.com/v1/forecast:lookup");
  url.searchParams.set("key", key);
  url.searchParams.set("location.latitude", String(STERLING_HEIGHTS_MI.latitude));
  url.searchParams.set("location.longitude", String(STERLING_HEIGHTS_MI.longitude));
  url.searchParams.set("days", String(Math.min(5, Math.max(1, days))));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      next: { revalidate: 1800 },
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    return {
      ok: false,
      reason: "http_error",
      detail: e instanceof Error ? e.message : "Network error",
    };
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) detail = errBody.error.message;
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    return { ok: false, reason: "http_error", status: res.status, detail };
  }

  let body: ForecastResponse;
  try {
    body = (await res.json()) as ForecastResponse;
  } catch {
    return { ok: false, reason: "bad_response", detail: "Invalid JSON" };
  }

  const rawDaily = body.dailyInfo ?? [];
  const daily = rawDaily.map((day) => {
    const date = day.date ?? {};
    const types = (day.pollenTypeInfo ?? []).map((p) => {
      const idx = p.indexInfo;
      return {
        code: p.code ?? "UNKNOWN",
        displayName: p.displayName ?? p.code ?? "Pollen",
        inSeason: Boolean(p.inSeason),
        value: idx?.value ?? null,
        category: idx?.category ?? null,
        description: idx?.indexDescription ?? null,
        recommendations: Array.isArray(p.healthRecommendations)
          ? [...p.healthRecommendations]
          : [],
      };
    });
    return {
      dateLabel: formatDayLabel(date),
      iso: dayIso(date),
      types,
    };
  });

  return {
    ok: true,
    regionCode: body.regionCode,
    daily,
  };
}
