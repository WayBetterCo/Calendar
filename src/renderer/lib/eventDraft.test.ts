import { describe, expect, it } from 'vitest';
import type { CalendarEvent, CreateEventInput } from '../types/calendar';
import { createEventFormSchema, updateEventPayload } from './eventDraft';

const event: CalendarEvent = {
  id: 'provider-id', providerEventId: 'provider-id', provider: 'google', calendarId: 'team', title: 'Review',
  startsAt: '2026-10-17T09:00:00', endsAt: '2026-10-17T10:00:00', isAllDay: false,
  video: { provider: 'zoom', label: 'Zoom', url: 'https://zoom.us/j/123' },
};
const draft: CreateEventInput = {
  title: 'Updated review', date: '2026-10-17', startTime: '09:00', endTime: '10:00', calendarId: 'team',
  addVideoCall: true, videoProvider: 'google_meet', guests: [], location: '', notes: '',
};

describe('event edits', () => {
  it('preserves the provider meeting and sends explicit cleared fields', () => {
    const payload = updateEventPayload(event, draft);
    expect(payload).not.toHaveProperty('addVideoCall');
    expect(payload).not.toHaveProperty('videoProvider');
    expect(payload).toMatchObject({ location: '', notes: '', guests: [], id: 'provider-id', startTime: '09:00' });
  });

  it.each([
    { ...event, isAllDay: true, startsAt: '2026-10-17', endsAt: '2026-10-18' },
    { ...event, startsAt: '2026-10-17T23:00:00', endsAt: '2026-10-18T01:00:00' },
  ])('preserves all-day and multi-day dates when editing other details', (original) => {
    const payload = updateEventPayload(original, draft);
    expect(payload).not.toHaveProperty('date');
    expect(payload).not.toHaveProperty('startTime');
    expect(payload).not.toHaveProperty('endTime');
    expect(payload.title).toBe('Updated review');
  });
});

describe('draft validation', () => {
  it.each([
    { date: '2026-02-30' }, { date: '' }, { startTime: '24:00' }, { endTime: '09:90' }, { title: '   ' }, { calendarId: '' },
  ])('rejects invalid date, time, title, and calendar fields', (patch) => {
    expect(createEventFormSchema.safeParse({ ...draft, ...patch }).success).toBe(false);
  });
});
