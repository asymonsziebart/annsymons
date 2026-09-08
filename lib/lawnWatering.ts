import {
  MIRROR_WEATHER_LAT,
  MIRROR_WEATHER_LOCATION,
  MIRROR_WEATHER_LON,
  MIRROR_WEATHER_TIMEZONE,
} from "@/lib/mirrorWeather";

const DEFAULT_DRY_DAYS = 3;
const LOOKBACK_DAYS = 7;
const DEFAULT_RAIN_THRESHOLD_IN = 0.1;
const DEFAULT_MIN_HIGH_F = 50;

type OpenMeteoLawnResponse = {
  daily?: {
    time?: string[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    temperature_2m_max?: number[];
  };
};

export type LawnWateringAssessment = {
  shouldRemind: boolean;
  reason: string;
  location: string;
  dryDaysRequired: number;
  recentRainIn: number;
  forecastRainIn: number;
  todayHighF: number;
  rainThresholdIn: number;
  daysSinceMeaningfulRain: number | null;
};

export async function getLawnWateringAssessment(): Promise<LawnWateringAssessment> {
  const dryDaysRequired = readNumber("LAWN_DRY_DAYS", DEFAULT_DRY_DAYS, 2, LOOKBACK_DAYS);
  const rainThresholdIn = readNumber(
    "LAWN_RAIN_THRESHOLD_INCHES",
    DEFAULT_RAIN_THRESHOLD_IN,
    0.01,
    1
  );
  const minHighF = readNumber("LAWN_MIN_HIGH_F", DEFAULT_MIN_HIGH_F, 32, 90);

  const params = new URLSearchParams({
    latitude: String(MIRROR_WEATHER_LAT),
    longitude: String(MIRROR_WEATHER_LON),
    daily: "precipitation_sum,precipitation_probability_max,temperature_2m_max",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: MIRROR_WEATHER_TIMEZONE,
    past_days: String(LOOKBACK_DAYS),
    forecast_days: "2",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoLawnResponse;
  const dates = data.daily?.time;
  const precipitation = data.daily?.precipitation_sum;
  const temperatures = data.daily?.temperature_2m_max;
  if (
    !dates ||
    !precipitation ||
    !temperatures ||
    dates.length < LOOKBACK_DAYS + 2 ||
    precipitation.length !== dates.length
  ) {
    throw new Error("Weather service returned incomplete daily data");
  }

  const pastRain = precipitation.slice(0, LOOKBACK_DAYS).map(safeNumber);
  const recentRainIn = sum(pastRain.slice(-dryDaysRequired));
  // Today's and tomorrow's totals are forecasts. Including both avoids a
  // reminder when rain is expected shortly after the noon check.
  const forecastRainIn = sum(
    precipitation.slice(LOOKBACK_DAYS, LOOKBACK_DAYS + 2).map(safeNumber)
  );
  const todayHighF = safeNumber(temperatures[LOOKBACK_DAYS]);
  const today = dates[LOOKBACK_DAYS];
  const month = Number(today?.slice(5, 7));
  const inGrowingSeason = month >= 4 && month <= 10;

  let daysSinceMeaningfulRain: number | null = null;
  for (let index = pastRain.length - 1; index >= 0; index -= 1) {
    if (pastRain[index] >= rainThresholdIn) {
      daysSinceMeaningfulRain = pastRain.length - index;
      break;
    }
  }

  if (!inGrowingSeason) {
    return result(false, "The lawn is outside the April–October watering season.");
  }
  if (todayHighF < minHighF) {
    return result(false, `Today's high (${Math.round(todayHighF)}°F) is too cool for a reminder.`);
  }
  if (recentRainIn >= rainThresholdIn) {
    return result(
      false,
      `${recentRainIn.toFixed(2)} in of rain fell during the last ${dryDaysRequired} days.`
    );
  }
  if (forecastRainIn >= rainThresholdIn) {
    return result(
      false,
      `${forecastRainIn.toFixed(2)} in of rain is forecast today or tomorrow.`
    );
  }

  return result(
    true,
    `Less than ${rainThresholdIn.toFixed(2)} in of rain fell in the last ${dryDaysRequired} days, and no meaningful rain is forecast through tomorrow.`
  );

  function result(shouldRemind: boolean, reason: string): LawnWateringAssessment {
    return {
      shouldRemind,
      reason,
      location: MIRROR_WEATHER_LOCATION,
      dryDaysRequired,
      recentRainIn,
      forecastRainIn,
      todayHighF,
      rainThresholdIn,
      daysSinceMeaningfulRain,
    };
  }
}

function readNumber(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
