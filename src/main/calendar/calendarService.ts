import type {
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  CalendarSource,
  ConnectProviderResult,
  CreateEventInput,
  DeleteEventInput,
  ListEventsInput,
  UpdateEventInput,
} from '../../shared/calendar';
import { getMockEvents, mockCalendars } from './mockData';
import { googleCalendarService } from './googleCalendarClient';
import { microsoftCalendarService } from './microsoftCalendarClient';
import { listAccounts, removeAccount } from '../storage/credentialStore';
import { readSettings, writeSettings } from '../settings/settingsStore';
import type { CalendarService } from './providerTypes';
import { createVideoMeeting } from '../video/videoMeetingService';
import type { VideoConference } from '../../shared/calendar';

const services: Record<'google' | 'microsoft', CalendarService> = {
  google: googleCalendarService,
  microsoft: microsoftCalendarService,
};

export async function connectProvider(provider: Extract<CalendarProvider, 'google' | 'microsoft'>): Promise<ConnectProviderResult> {
  const result = await services[provider].connect();
  const settings = readSettings();
  const selected = new Set(settings.selectedCalendarIds);
  for (const calendar of result.calendars) {
    selected.add(calendar.id);
  }
  writeSettings({
    selectedCalendarIds: Array.from(selected),
    defaultCalendarId: result.calendars.find((calendar) => calendar.canWrite)?.id ?? settings.defaultCalendarId,
  });
  return result;
}

export function getConnectedAccounts(): CalendarAccount[] {
  return listAccounts();
}

export async function disconnectProviderAccount(accountId: string): Promise<void> {
  removeAccount(accountId);
  const settings = readSettings();
  const calendars = await listCalendars();
  const calendarIds = new Set(calendars.map((calendar) => calendar.id));
  writeSettings({
    selectedCalendarIds: settings.selectedCalendarIds.filter((id) => calendarIds.has(id)),
    defaultCalendarId: calendarIds.has(settings.defaultCalendarId) ? settings.defaultCalendarId : calendars.find((calendar) => calendar.canWrite)?.id ?? '',
  });
}

export async function listCalendars(): Promise<CalendarSource[]> {
  const realCalendars = (await Promise.all(Object.values(services).map((service) => service.listCalendars()))).flat();
  return realCalendars.length ? realCalendars : mockCalendars;
}

export async function listEvents(input: ListEventsInput): Promise<CalendarEvent[]> {
  const calendars = await listCalendars();
  const visible = new Set(input.calendarIds?.length ? input.calendarIds : readSettings().selectedCalendarIds);
  const selectedCalendars = calendars.filter((calendar) => visible.has(calendar.id));
  const realCalendars = selectedCalendars.filter((calendar) => calendar.id.includes('::'));

  if (!realCalendars.length) {
    return getMockEvents()
      .filter((event) => visible.has(event.calendarId))
      .filter((event) => inRange(event, input))
      .filter((event) => matchesSearch(event, input.search, calendars))
      .sort(sortEvents);
  }

  const providerGroups = groupByProvider(realCalendars);
  const events = (
    await Promise.all(
      Object.entries(providerGroups).map(([provider, providerCalendars]) =>
        services[provider as 'google' | 'microsoft'].listEvents(input, providerCalendars),
      ),
    )
  )
    .flat()
    .filter((event) => matchesSearch(event, input.search, calendars))
    .sort(sortEvents);

  return events;
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
  const calendars = await listCalendars();
  const calendar = calendars.find((item) => item.id === input.calendarId);
  const video = await createVideoMeeting({ ...input, subject: input.title });
  const providerInput = attachVideoMeeting(input, video);

  if (!calendar || !calendar.id.includes('::')) {
    return createMockEvent(providerInput, video);
  }

  return services[calendar.provider as 'google' | 'microsoft'].createEvent(providerInput, calendar);
}

export async function updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
  const calendar = (await listCalendars()).find((item) => item.id === input.calendarId);
  if (!calendar || !calendar.id.includes('::')) {
    throw new Error('Mock events cannot be updated yet.');
  }

  return services[calendar.provider as 'google' | 'microsoft'].updateEvent(input, calendar);
}

export async function deleteEvent(input: DeleteEventInput): Promise<void> {
  const calendar = (await listCalendars()).find((item) => item.id === input.calendarId);
  if (!calendar || !calendar.id.includes('::')) {
    throw new Error('Mock events cannot be deleted yet.');
  }

  await services[calendar.provider as 'google' | 'microsoft'].deleteEvent(input, calendar);
}

function groupByProvider(calendars: CalendarSource[]): Partial<Record<'google' | 'microsoft', CalendarSource[]>> {
  return calendars.reduce<Partial<Record<'google' | 'microsoft', CalendarSource[]>>>((groups, calendar) => {
    if (calendar.provider === 'google' || calendar.provider === 'microsoft') {
      groups[calendar.provider] = [...(groups[calendar.provider] ?? []), calendar];
    }
    return groups;
  }, {});
}

function inRange(event: CalendarEvent, input: ListEventsInput): boolean {
  const time = new Date(event.startsAt).getTime();
  return time >= new Date(input.startsAt).getTime() && time < new Date(input.endsAt).getTime();
}

function matchesSearch(event: CalendarEvent, search: string | undefined, calendars: CalendarSource[]): boolean {
  if (!search?.trim()) {
    return true;
  }

  const calendar = calendars.find((item) => item.id === event.calendarId);
  const haystack = [
    event.title,
    event.location,
    event.description,
    calendar?.name,
    ...(event.attendees ?? []).flatMap((attendee) => [attendee.email, attendee.name]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function createMockEvent(input: CreateEventInput, video?: VideoConference | null): CalendarEvent {
  const id = `local_${Date.now()}`;
  return {
    id,
    providerEventId: id,
    provider: 'google',
    calendarId: input.calendarId,
    title: input.title,
    description: input.notes,
    location: input.location,
    startsAt: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
    endsAt: new Date(`${input.date}T${input.endTime}:00`).toISOString(),
    isAllDay: false,
    attendees: input.guests.map((email) => ({ email })),
    video:
      video ??
      (input.addVideoCall && (!input.videoProvider || input.videoProvider === 'google_meet')
        ? { provider: 'google_meet', label: 'Meet', url: 'https://meet.google.com/new-waybetter-calendar-event' }
        : null),
    updatedAt: new Date().toISOString(),
  };
}

function attachVideoMeeting(input: CreateEventInput, video: VideoConference | null): CreateEventInput {
  if (!video) {
    return input;
  }

  const notes = [input.notes, `${video.label}: ${video.url}`].filter(Boolean).join('\n\n');
  return {
    ...input,
    location: input.location || video.url,
    notes,
  };
}
