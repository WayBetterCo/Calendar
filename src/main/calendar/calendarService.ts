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
import { mockCalendars } from './mockData';
import { randomUUID } from 'node:crypto';
import { readLocalEvents, writeLocalEvents } from '../storage/localEventsStore';
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
  const selected = new Set(settings.selectedCalendarIds.filter((id) => id.includes('::')));
  for (const calendar of result.calendars) {
    selected.add(calendar.id);
  }
  writeSettings({
    selectedCalendarIds: Array.from(selected),
    defaultCalendarId: settings.defaultCalendarId.includes('::') ? settings.defaultCalendarId : result.calendars.find((calendar) => calendar.canWrite)?.id ?? '',
  });
  return result;
}

export function getConnectedAccounts(): CalendarAccount[] {
  return listAccounts();
}

export async function disconnectProviderAccount(accountId: string): Promise<void> {
  removeAccount(accountId);
  const settings = readSettings();
  const belongsToAccount = (id: string) => id.split('::')[1] === accountId;
  const selectedCalendarIds = settings.selectedCalendarIds.filter((id) => !belongsToAccount(id));
  const noAccounts = !listAccounts().length;
  writeSettings({
    selectedCalendarIds: noAccounts ? mockCalendars.map((calendar) => calendar.id) : selectedCalendarIds,
    defaultCalendarId: noAccounts ? mockCalendars[0].id : belongsToAccount(settings.defaultCalendarId) ? selectedCalendarIds[0] ?? '' : settings.defaultCalendarId,
  });
}

export async function listCalendars(): Promise<CalendarSource[]> {
  const realCalendars = (await Promise.all(Object.values(services).map((service) => service.listCalendars()))).flat();
  return listAccounts().length ? realCalendars : mockCalendars.map((calendar) => ({ ...calendar, canWrite: true }));
}

export async function listEvents(input: ListEventsInput): Promise<CalendarEvent[]> {
  const calendars = await listCalendars();
  const visible = new Set(input.calendarIds ?? readSettings().selectedCalendarIds);
  const selectedCalendars = calendars.filter((calendar) => visible.has(calendar.id));
  const realCalendars = selectedCalendars.filter((calendar) => calendar.id.includes('::'));

  if (!realCalendars.length) {
    if (listAccounts().length || !visible.size) return [];
    return readLocalEvents()
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
    .filter((event) => matchesSearch(event, input.search, calendars));

  return deduplicateSharedGoogleEvents(events, selectedCalendars).sort(sortEvents);
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
  assertEventTimes(input);
  const calendar = requireWritableCalendar(await listCalendars(), input.calendarId);
  const isLocal = !calendar.id.includes('::');
  if (isLocal && input.addVideoCall) {
    throw new Error('Connect a calendar account to create video meetings.');
  }
  if (calendar.provider !== 'google' && input.addVideoCall && (!input.videoProvider || input.videoProvider === 'google_meet')) {
    throw new Error('Google Meet links require a Google calendar. Select Zoom or Teams for this calendar.');
  }
  const video = await createVideoMeeting({ ...input, subject: input.title });
  const providerInput = attachVideoMeeting(input, video);
  if (isLocal) {
    const event = createMockEvent(providerInput);
    writeLocalEvents([...readLocalEvents(), event]);
    return event;
  }
  return services[calendar.provider as 'google' | 'microsoft'].createEvent(providerInput, calendar);
}

export async function updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
  const calendar = requireWritableCalendar(await listCalendars(), input.calendarId);
  if (!calendar.id.includes('::')) {
    const events = readLocalEvents();
    const existing = events.find((event) => event.id === input.id && event.calendarId === input.calendarId);
    if (!existing) throw new Error('This event no longer exists. Refresh the calendar.');
    if (input.addVideoCall) throw new Error('Connect a calendar account to create video meetings.');
    const next = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.notes ?? existing.description,
      location: input.location ?? existing.location,
      startsAt: input.date && input.startTime ? new Date(`${input.date}T${input.startTime}:00`).toISOString() : existing.startsAt,
      endsAt: input.date && input.endTime ? new Date(`${input.date}T${input.endTime}:00`).toISOString() : existing.endsAt,
      attendees: input.guests ? input.guests.map((email) => ({ email })) : existing.attendees,
      video: input.addVideoCall === false ? null : existing.video,
      updatedAt: new Date().toISOString(),
    };
    if (new Date(next.endsAt) <= new Date(next.startsAt)) throw new Error('Event end must be after its start.');
    writeLocalEvents(events.map((event) => event === existing ? next : event));
    return next;
  }
  if (input.date && input.startTime && input.endTime) assertEventTimes(input as CreateEventInput);
  return services[calendar.provider as 'google' | 'microsoft'].updateEvent(input, calendar);
}

export async function deleteEvent(input: DeleteEventInput): Promise<void> {
  const calendar = requireWritableCalendar(await listCalendars(), input.calendarId);
  if (!calendar.id.includes('::')) {
    const events = readLocalEvents();
    writeLocalEvents(events.filter((event) => event.id !== input.id || event.calendarId !== input.calendarId));
    return;
  }
  await services[calendar.provider as 'google' | 'microsoft'].deleteEvent(input, calendar);
}

function requireWritableCalendar(calendars: CalendarSource[], calendarId: string): CalendarSource {
  const calendar = calendars.find((item) => item.id === calendarId);
  if (!calendar) throw new Error('This calendar is no longer connected. Choose an available calendar.');
  if (!calendar.canWrite) throw new Error('This calendar is read-only. Choose a calendar you can edit.');
  return calendar;
}

function assertEventTimes(input: Pick<CreateEventInput, 'date' | 'startTime' | 'endTime'>): void {
  const start = new Date(`${input.date}T${input.startTime}:00`).getTime();
  const end = new Date(`${input.date}T${input.endTime}:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Event end must be after its start on the selected date.');
  }
}

function groupByProvider(calendars: CalendarSource[]): Partial<Record<'google' | 'microsoft', CalendarSource[]>> {
  return calendars.reduce<Partial<Record<'google' | 'microsoft', CalendarSource[]>>>((groups, calendar) => {
    if (calendar.provider === 'google' || calendar.provider === 'microsoft') {
      groups[calendar.provider] = [...(groups[calendar.provider] ?? []), calendar];
    }
    return groups;
  }, {});
}

/** One shared Google calendar can be visible through several selected accounts. */
function deduplicateSharedGoogleEvents(events: CalendarEvent[], calendars: CalendarSource[]): CalendarEvent[] {
  const sources = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const result: CalendarEvent[] = [];
  const positions = new Map<string, number>();
  for (const event of events) {
    const source = sources.get(event.calendarId);
    const encodedCalendarId = source?.id.split('::')[2];
    if (event.provider !== 'google' || source?.provider !== 'google' || !encodedCalendarId || !event.providerEventId) {
      result.push(event);
      continue;
    }
    let providerCalendarId: string;
    try {
      providerCalendarId = decodeURIComponent(encodedCalendarId);
    } catch {
      // Unknown IDs must not cause unrelated events to disappear.
      result.push(event);
      continue;
    }
    const key = JSON.stringify([providerCalendarId, event.providerEventId]);
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, result.length);
      result.push(event);
    } else if (preferGoogleEvent(event, result[position], sources)) {
      // Preserve the chosen account's original calendar ID for permission checks and CRUD.
      result[position] = event;
    }
  }
  return result;
}

function preferGoogleEvent(candidate: CalendarEvent, existing: CalendarEvent, sources: Map<string, CalendarSource>): boolean {
  const candidateWritable = sources.get(candidate.calendarId)?.canWrite === true;
  const existingWritable = sources.get(existing.calendarId)?.canWrite === true;
  if (candidateWritable !== existingWritable) return candidateWritable;
  const candidateDetails = eventDetailRank(candidate);
  const existingDetails = eventDetailRank(existing);
  for (let index = 0; index < candidateDetails.length; index++) {
    if (candidateDetails[index] !== existingDetails[index]) return candidateDetails[index] > existingDetails[index];
  }
  // Account enumeration order can change between refreshes; equal views choose consistently.
  return candidate.calendarId < existing.calendarId;
}

function eventDetailRank(event: CalendarEvent): number[] {
  const hasTitle = Boolean(event.title.trim() && event.title !== 'Untitled event');
  const details = [
    event.description, event.location, event.video?.url, event.sourceUrl,
    ...(event.attendees ?? []).flatMap((attendee) => [attendee.email, attendee.name, attendee.responseStatus]),
  ].filter((value): value is string => Boolean(value?.trim()));
  return [Number(hasTitle), details.length, details.reduce((length, value) => length + value.length, 0)];
}

function inRange(event: CalendarEvent, input: ListEventsInput): boolean {
  return new Date(event.endsAt).getTime() > new Date(input.startsAt).getTime() && new Date(event.startsAt).getTime() < new Date(input.endsAt).getTime();
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

  return haystack.includes(search.trim().toLowerCase());
}

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function createMockEvent(input: CreateEventInput): CalendarEvent {
  const id = `local_${randomUUID()}`;
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
    video: null,
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
