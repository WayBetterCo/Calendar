import { shell, ipcMain, nativeTheme } from 'electron';
import { z } from 'zod';
import { readSettings, writeSettings } from './settings/settingsStore';
import {
  connectProvider,
  deleteEvent,
  disconnectProviderAccount,
  getConnectedAccounts,
  listCalendars,
  listEvents,
  createEvent,
  updateEvent,
} from './calendar/calendarService';
import {
  connectVideoProvider,
  disconnectVideoAccount,
  getConnectedVideoAccounts,
} from './video/videoMeetingService';

const listEventsSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  calendarIds: z.array(z.string()).optional(),
  search: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  calendarId: z.string().min(1),
  addVideoCall: z.boolean(),
  videoProvider: z.enum(['google_meet', 'zoom', 'teams']).optional(),
  guests: z.array(z.string()).default([]),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateEventSchema = createEventSchema.partial().extend({
  id: z.string().min(1),
  calendarId: z.string().min(1),
});

const deleteEventSchema = z.object({
  id: z.string().min(1),
  calendarId: z.string().min(1),
});

const providerSchema = z.enum(['google', 'microsoft']);
const videoProviderSchema = z.enum(['google_meet', 'zoom', 'teams']);

const settingsPatchSchema = z
  .object({
    defaultCalendarId: z.string().optional(),
    defaultDurationMinutes: z.number().int().min(15).max(240).optional(),
    startWeekOn: z.enum(['sunday', 'monday']).optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    showWeather: z.boolean().optional(),
    weatherUnit: z.enum(['fahrenheit', 'celsius']).optional(),
    weatherLocation: z.string().optional(),
    launchAtLogin: z.boolean().optional(),
    keepWindowOnTop: z.boolean().optional(),
    selectedCalendarIds: z.array(z.string()).optional(),
  })
  .partial();

const weatherForecastSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  unit: z.enum(['fahrenheit', 'celsius']),
});

export function registerIpcHandlers(): void {
  ipcMain.handle('calendar:list-events', (_event, rawInput) => listEvents(listEventsSchema.parse(rawInput)));
  ipcMain.handle('calendar:create-event', (_event, rawInput) => createEvent(createEventSchema.parse(rawInput)));
  ipcMain.handle('calendar:update-event', (_event, rawInput) => updateEvent(updateEventSchema.parse(rawInput)));
  ipcMain.handle('calendar:delete-event', (_event, rawInput) => deleteEvent(deleteEventSchema.parse(rawInput)));
  ipcMain.handle('calendar:list-calendars', () => listCalendars());
  ipcMain.handle('auth:list-accounts', () => getConnectedAccounts());
  ipcMain.handle('auth:connect-provider', (_event, rawProvider) => connectProvider(providerSchema.parse(rawProvider)));
  ipcMain.handle('auth:disconnect-account', (_event, rawAccountId: string) => disconnectProviderAccount(z.string().parse(rawAccountId)));
  ipcMain.handle('video:list-accounts', () => getConnectedVideoAccounts());
  ipcMain.handle('video:connect-provider', (_event, rawProvider) => connectVideoProvider(videoProviderSchema.parse(rawProvider)));
  ipcMain.handle('video:disconnect-account', (_event, rawAccountId: string) => disconnectVideoAccount(z.string().parse(rawAccountId)));
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:update', (_event, rawPatch) => writeSettings(settingsPatchSchema.parse(rawPatch)));
  ipcMain.handle('weather:get-daily-forecast', async (_event, rawInput) => getDailyWeatherForecast(weatherForecastSchema.parse(rawInput)));
  ipcMain.handle('weather:resolve-location', async (_event, rawLocation) => resolveWeatherLocation(z.string().parse(rawLocation)));
  ipcMain.handle('theme:get', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
  ipcMain.handle('shell:open-external', async (_event, rawUrl: string) => {
    const url = z.string().url().parse(rawUrl);
    await shell.openExternal(url);
  });
}

async function getDailyWeatherForecast(input: z.infer<typeof weatherForecastSchema>) {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    timezone: 'auto',
    temperature_unit: input.unit,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Weather forecast is unavailable.');
  }

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };
  const high = data.daily?.temperature_2m_max?.[0];
  const low = data.daily?.temperature_2m_min?.[0];
  const currentTemperature = data.current?.temperature_2m;
  const weatherCode = data.current?.weather_code;

  if (typeof high !== 'number' || typeof low !== 'number' || typeof currentTemperature !== 'number' || typeof weatherCode !== 'number') {
    throw new Error('Weather forecast is incomplete.');
  }

  return { high, low, currentTemperature, weatherCode, unit: input.unit };
}

async function resolveWeatherLocation(rawLocation: string) {
  const location = rawLocation.trim();
  if (!location) {
    throw new Error('Weather location is empty.');
  }

  const zipMatch = location.match(/^\d{5}(?:-\d{4})?$/);
  if (zipMatch) {
    const zip = zipMatch[0].slice(0, 5);
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
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
    name: location,
    count: '1',
    language: 'en',
    format: 'json',
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);

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
