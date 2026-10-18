import type {
  AppSettings,
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  CalendarSource,
  ConnectVideoProviderResult,
  ConnectProviderResult,
  CreatableVideoProvider,
  CreateEventInput,
  DeleteEventInput,
  ListEventsInput,
  UpdateEventInput,
  VideoAccount,
} from '../types/calendar';
import { getMockEvents, mockCalendars, mockSettings } from '../../shared/mockData';
import { parseISO } from 'date-fns';

const BROWSER_SETTINGS_KEY = 'waybetter-calendar-preview-settings';
const BROWSER_EVENTS_KEY = 'waybetter-calendar-preview-events';
let browserSettings: AppSettings = { ...mockSettings, ...readBrowserState<Partial<AppSettings>>(BROWSER_SETTINGS_KEY) };
let browserEvents = readBrowserState<CalendarEvent[]>(BROWSER_EVENTS_KEY) ?? getMockEvents();

function readBrowserState<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function saveBrowserState(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preview stays usable when the browser denies storage.
  }
}

function hasPreloadApi(): boolean {
  return typeof window.waybetterCalendar !== 'undefined';
}

function preloadApi() {
  if (!window.waybetterCalendar) {
    throw new Error('WayBetter Calendar preload API is unavailable.');
  }

  return window.waybetterCalendar;
}

function listBrowserEvents(input: ListEventsInput): CalendarEvent[] {
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  const visible = new Set(input.calendarIds ?? browserSettings.selectedCalendarIds);
  const search = input.search?.trim().toLowerCase();

  return browserEvents
    .filter((event) => visible.has(event.calendarId))
    .filter((event) => parseISO(event.endsAt).getTime() > startsAt && parseISO(event.startsAt).getTime() < endsAt)
    .filter((event) => {
      if (!search) {
        return true;
      }

      const calendar = mockCalendars.find((source) => source.id === event.calendarId);
      return [event.title, event.location, event.description, calendar?.name, ...(event.attendees ?? []).flatMap((guest) => [guest.name, guest.email])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export const calendarApi = {
  listEvents(input: ListEventsInput): Promise<CalendarEvent[]> {
    if (!hasPreloadApi()) {
      return Promise.resolve(listBrowserEvents(input));
    }

    return preloadApi().calendar.listEvents(input);
  },
  createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    if (!hasPreloadApi()) {
      if (input.addVideoCall) return Promise.reject(new Error('Connect a calendar account in the desktop app to create a video meeting.'));
      const id = `browser_${crypto.randomUUID()}`;
      const event: CalendarEvent = {
        id,
        providerEventId: id,
        provider: 'google',
        calendarId: input.calendarId,
        title: input.title,
        startsAt: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
        endsAt: new Date(`${input.date}T${input.endTime}:00`).toISOString(),
        isAllDay: false,
        location: input.location,
        description: input.notes,
        attendees: input.guests.map((email) => ({ email })),
        video: null,
      };
      browserEvents = [...browserEvents, event];
      saveBrowserState(BROWSER_EVENTS_KEY, browserEvents);
      return Promise.resolve(event);
    }

    return preloadApi().calendar.createEvent(input);
  },
  updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
    if (!hasPreloadApi()) {
      const existing = browserEvents.find((event) => event.id === input.id && event.calendarId === input.calendarId);
      if (!existing) return Promise.reject(new Error('Event was not found.'));
      const date = input.date ?? formatLocalDate(existing.startsAt);
      const event: CalendarEvent = {
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.startTime !== undefined ? { startsAt: new Date(`${date}T${input.startTime}:00`).toISOString() } : {}),
        ...(input.endTime !== undefined ? { endsAt: new Date(`${date}T${input.endTime}:00`).toISOString() } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.notes !== undefined ? { description: input.notes } : {}),
        ...(input.guests !== undefined ? { attendees: input.guests.map((email) => ({ email })) } : {}),
        updatedAt: new Date().toISOString(),
      };
      browserEvents = browserEvents.map((item) => item === existing ? event : item);
      saveBrowserState(BROWSER_EVENTS_KEY, browserEvents);
      return Promise.resolve(event);
    }

    return preloadApi().calendar.updateEvent(input);
  },
  deleteEvent(input: DeleteEventInput): Promise<void> {
    if (!hasPreloadApi()) {
      browserEvents = browserEvents.filter((event) => event.id !== input.id || event.calendarId !== input.calendarId);
      saveBrowserState(BROWSER_EVENTS_KEY, browserEvents);
      return Promise.resolve();
    }

    return preloadApi().calendar.deleteEvent(input);
  },
  listCalendars(): Promise<CalendarSource[]> {
    if (!hasPreloadApi()) {
      return Promise.resolve(mockCalendars);
    }

    return preloadApi().calendar.listCalendars();
  },
  listAccounts(): Promise<CalendarAccount[]> {
    if (!hasPreloadApi()) {
      return Promise.resolve([]);
    }

    return preloadApi().auth.listAccounts();
  },
  connectProvider(provider: Extract<CalendarProvider, 'google' | 'microsoft'>): Promise<ConnectProviderResult> {
    if (!hasPreloadApi()) {
      return Promise.reject(new Error('Use the Electron app window to connect calendars.'));
    }

    return preloadApi().auth.connectProvider(provider);
  },
  disconnectAccount(accountId: string): Promise<void> {
    if (!hasPreloadApi()) {
      return Promise.resolve();
    }

    return preloadApi().auth.disconnectAccount(accountId);
  },
  listVideoAccounts(): Promise<VideoAccount[]> {
    if (!hasPreloadApi()) {
      return Promise.resolve([]);
    }

    return preloadApi().video.listAccounts();
  },
  connectVideoProvider(provider: CreatableVideoProvider): Promise<ConnectVideoProviderResult> {
    if (!hasPreloadApi()) {
      return Promise.reject(new Error('Use the Electron app window to connect video accounts.'));
    }

    return preloadApi().video.connectProvider(provider);
  },
  disconnectVideoAccount(accountId: string): Promise<void> {
    if (!hasPreloadApi()) {
      return Promise.resolve();
    }

    return preloadApi().video.disconnectAccount(accountId);
  },
  openExternal(url: string): Promise<void> {
    if (!hasPreloadApi()) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve();
    }

    return preloadApi().shell.openExternal(url);
  },
  getSettings(): Promise<AppSettings> {
    if (!hasPreloadApi()) {
      return Promise.resolve(browserSettings);
    }

    return preloadApi().settings.get();
  },
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (!hasPreloadApi()) {
      browserSettings = { ...browserSettings, ...patch };
      saveBrowserState(BROWSER_SETTINGS_KEY, browserSettings);
      return Promise.resolve(browserSettings);
    }

    return preloadApi().settings.update(patch);
  },
};

function formatLocalDate(value: string): string {
  const date = parseISO(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
