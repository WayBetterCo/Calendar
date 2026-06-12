import { parseISO } from 'date-fns';
import type { CalendarEvent } from '../types/calendar';
import { toDateKey } from './dates';

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = toDateKey(event.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  for (const [key, group] of groups) {
    groups.set(
      key,
      group.sort((a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime()),
    );
  }

  return groups;
}

export function getEventSubtitle(event: CalendarEvent, calendarName?: string): string {
  if (event.attendees?.[0]?.name) {
    return event.attendees[0].name;
  }

  if (event.location && !event.location.startsWith('http')) {
    return event.location;
  }

  return calendarName ?? '';
}
