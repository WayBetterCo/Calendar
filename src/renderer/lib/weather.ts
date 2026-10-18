import type { WeatherForecast, WeatherLocationResult, WeatherUnit } from '../types/calendar';

type LocalCoordinates = {
  latitude: number;
  longitude: number;
};

type OpenMeteoDailyResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

const COORDINATE_CACHE_KEY = 'waybetter-calendar-weather-coordinates';

export function formatWeatherForecast(forecast: WeatherForecast): string {
  const unitLabel = forecast.unit === 'fahrenheit' ? 'F' : 'C';
  return `${Math.round(forecast.high)}°/${Math.round(forecast.low)}°${unitLabel}`;
}

export async function getLocalWeatherForecast(unit: WeatherUnit, location: string): Promise<WeatherForecast> {
  const { latitude, longitude } = location.trim() ? await resolveWeatherLocation(location) : await getCoordinates();
  return fetchWeatherForecast(latitude, longitude, unit);
}

async function resolveWeatherLocation(location: string): Promise<WeatherLocationResult> {
  if (window.waybetterCalendar?.weather) {
    return window.waybetterCalendar.weather.resolveLocation(location);
  }

  const trimmed = location.trim();
  const zipMatch = trimmed.match(/^\d{5}(?:-\d{4})?$/);

  if (zipMatch) {
    const response = await fetch(`/weather-zipcode-api/us/${zipMatch[0].slice(0, 5)}`);
    if (!response.ok) {
      throw new Error('Weather location was not found.');
    }

    const data = (await response.json()) as {
      places?: Array<{
        'place name'?: string;
        state?: string;
        latitude?: string;
        longitude?: string;
      }>;
    };
    const place = data.places?.[0];
    const latitude = place?.latitude ? Number(place.latitude) : NaN;
    const longitude = place?.longitude ? Number(place.longitude) : NaN;

    if (!place || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error('Weather location was not found.');
    }

    return {
      name: [place['place name'], place.state].filter(Boolean).join(', '),
      latitude,
      longitude,
    };
  }

  const params = new URLSearchParams({
    name: trimmed,
    count: '1',
    language: 'en',
    format: 'json',
  });
  const response = await fetch(`/weather-geocode-api/v1/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Weather location was not found.');
  }

  const data = (await response.json()) as {
    results?: Array<{
      name?: string;
      admin1?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
    }>;
  };
  const result = data.results?.[0];

  if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
    throw new Error('Weather location was not found.');
  }

  return {
    name: [result.name, result.admin1, result.country_code].filter(Boolean).join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

async function fetchWeatherForecast(latitude: number, longitude: number, unit: WeatherUnit): Promise<WeatherForecast> {
  if (window.waybetterCalendar?.weather) {
    return window.waybetterCalendar.weather.getDailyForecast({ latitude, longitude, unit });
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    timezone: 'auto',
    temperature_unit: unit,
  });
  const response = await fetch(`/weather-api/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Weather forecast is unavailable.');
  }

  const data = (await response.json()) as OpenMeteoDailyResponse;
  const high = data.daily?.temperature_2m_max?.[0];
  const low = data.daily?.temperature_2m_min?.[0];
  const currentTemperature = data.current?.temperature_2m;
  const weatherCode = data.current?.weather_code;

  if (typeof high !== 'number' || typeof low !== 'number' || typeof currentTemperature !== 'number' || typeof weatherCode !== 'number') {
    throw new Error('Weather forecast is incomplete.');
  }

  return { high, low, currentTemperature, weatherCode, unit };
}

function getCoordinates(): Promise<LocalCoordinates> {
  const cached = readCachedCoordinates();
  if (cached) {
    return Promise.resolve(cached);
  }

  if (!navigator.geolocation) {
    return Promise.reject(new Error('Set a city or ZIP in Settings to show local weather.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cacheCoordinates(position.coords);
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        reject(new Error('Location permission is needed for local weather.'));
      },
      { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60 * 6, timeout: 12000 },
    );
  });
}

function readCachedCoordinates(): LocalCoordinates | null {
  try {
    const raw = localStorage.getItem(COORDINATE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown; savedAt?: unknown };
    if (typeof parsed.latitude !== 'number' || !Number.isFinite(parsed.latitude) || Math.abs(parsed.latitude) > 90 || typeof parsed.longitude !== 'number' || !Number.isFinite(parsed.longitude) || Math.abs(parsed.longitude) > 180 || typeof parsed.savedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24) {
      return null;
    }

    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
}

function cacheCoordinates(coords: GeolocationCoordinates): void {
  try {
    localStorage.setItem(
      COORDINATE_CACHE_KEY,
      JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude, savedAt: Date.now() }),
    );
  } catch {
    // Storage denial must not prevent a resolved device location from being used.
  }
}
