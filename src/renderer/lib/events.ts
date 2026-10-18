import { addDays, parseISO, startOfDay } from 'date-fns';
import type { CalendarEvent } from '../types/calendar';
import { toDateKey } from './dates';

export function eventOccursOnDate(event: CalendarEvent, date: Date): boolean {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const eventStart = parseISO(event.startsAt).getTime();
  const eventEnd = parseISO(event.endsAt).getTime();
  return eventStart < dayEnd.getTime() && eventEnd > dayStart.getTime();
}

export function groupEventsByDate(events: CalendarEvent[], dates?: Date[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const eventDates = dates?.filter((date) => eventOccursOnDate(event, date)) ?? [parseISO(event.startsAt)];
    for (const date of eventDates) {
      const key = toDateKey(date);
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
  }

  for (const [key, group] of groups) {
    groups.set(
      key,
      group.sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime()),
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
