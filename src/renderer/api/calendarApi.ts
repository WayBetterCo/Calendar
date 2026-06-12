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

let browserSettings = mockSettings;
let browserCreatedEvents: CalendarEvent[] = [];

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
  const visible = new Set(input.calendarIds?.length ? input.calendarIds : browserSettings.selectedCalendarIds);
  const search = input.search?.trim().toLowerCase();

  return [...getMockEvents(), ...browserCreatedEvents]
    .filter((event) => visible.has(event.calendarId))
    .filter((event) => new Date(event.startsAt).getTime() >= startsAt)
    .filter((event) => new Date(event.startsAt).getTime() < endsAt)
    .filter((event) => {
      if (!search) {
        return true;
      }

      const calendar = mockCalendars.find((source) => source.id === event.calendarId);
      return [event.title, event.location, event.description, calendar?.name]
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
      const id = `browser_${Date.now()}`;
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
        video: input.addVideoCall ? browserVideoConference(input.videoProvider ?? 'google_meet') : null,
      };
      browserCreatedEvents = [...browserCreatedEvents, event];
      return Promise.resolve(event);
    }

    return preloadApi().calendar.createEvent(input);
  },
  updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
    if (!hasPreloadApi()) {
      return Promise.reject(new Error('Browser preview cannot update provider events.'));
    }

    return preloadApi().calendar.updateEvent(input);
  },
  deleteEvent(input: DeleteEventInput): Promise<void> {
    if (!hasPreloadApi()) {
      return Promise.reject(new Error('Browser preview cannot delete provider events.'));
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
      return Promise.resolve(browserSettings);
    }

    return preloadApi().settings.update(patch);
  },
};

function browserVideoConference(provider: 'google_meet' | 'zoom' | 'teams'): CalendarEvent['video'] {
  if (provider === 'zoom') {
    return { provider: 'zoom', label: 'Zoom', url: 'https://zoom.us/j/123456789' };
  }

  if (provider === 'teams') {
    return { provider: 'teams', label: 'Teams', url: 'https://teams.microsoft.com/l/meetup-join/example' };
  }

  return { provider: 'google_meet', label: 'Meet', url: 'https://meet.google.com/new-waybetter-calendar-event' };
}
