/** Sterling Heights, Michigan */
export const MIRROR_WEATHER_LAT = 42.5803;
export const MIRROR_WEATHER_LON = -83.0302;
export const MIRROR_WEATHER_LOCATION = "Sterling Heights, MI";
export const MIRROR_WEATHER_TIMEZONE = "America/Detroit";

export type MirrorWeather = {
  temperatureF: number;
  condition: string;
  highF: number;
  lowF: number;
  location: string;
};

/** WMO weather interpretation codes (Open-Meteo). */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unknown";
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export async function fetchMirrorWeather(): Promise<MirrorWeather | null> {
  const params = new URLSearchParams({
    latitude: String(MIRROR_WEATHER_LAT),
    longitude: String(MIRROR_WEATHER_LON),
    current: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min",
    temperature_unit: "fahrenheit",
    timezone: MIRROR_WEATHER_TIMEZONE,
    forecast_days: "1",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  const temp = data.current?.temperature_2m;
  const code = data.current?.weather_code;
  const high = data.daily?.temperature_2m_max?.[0];
  const low = data.daily?.temperature_2m_min?.[0];

  if (temp == null || code == null || high == null || low == null) return null;

  return {
    temperatureF: Math.round(temp),
    condition: weatherCodeLabel(code),
    highF: Math.round(high),
    lowF: Math.round(low),
    location: MIRROR_WEATHER_LOCATION,
  };
}
