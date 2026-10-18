import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../types/calendar';
import { eventOccursOnDate, groupEventsByDate } from './events';

const overnight: CalendarEvent = {
  id: 'overnight', providerEventId: 'overnight', provider: 'google', calendarId: 'team', title: 'Night shift',
  startsAt: '2026-10-17T23:00:00', endsAt: '2026-10-18T02:00:00', isAllDay: false,
};

describe('agenda date grouping', () => {
  it('includes an event that started the previous day and is still in progress', () => {
    expect(eventOccursOnDate(overnight, new Date(2026, 9, 18))).toBe(true);
    const groups = groupEventsByDate([overnight], [new Date(2026, 9, 18), new Date(2026, 9, 19)]);
    expect(groups.get('2026-10-18')).toEqual([overnight]);
    expect(groups.has('2026-10-19')).toBe(false);
  });

  it('honors exclusive all-day end dates and lists all-day events first', () => {
    const allDay: CalendarEvent = { ...overnight, id: 'holiday', startsAt: '2026-10-17', endsAt: '2026-10-19', isAllDay: true };
    const early: CalendarEvent = { ...overnight, id: 'early', startsAt: '2026-10-17T00:01:00', endsAt: '2026-10-17T01:00:00' };
    const groups = groupEventsByDate([early, allDay], [new Date(2026, 9, 17), new Date(2026, 9, 18), new Date(2026, 9, 19)]);
    expect(groups.get('2026-10-17')?.map((event) => event.id)).toEqual(['holiday', 'early']);
    expect(groups.get('2026-10-18')).toEqual([allDay]);
    expect(groups.has('2026-10-19')).toBe(false);
  });
});
