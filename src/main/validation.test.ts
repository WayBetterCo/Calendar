import { describe, expect, it } from 'vitest';
import { createEventSchema, updateEventSchema, listEventsSchema } from './validation';
const valid = { title: 'Planning', date: '2026-10-17', startTime: '09:00', endTime: '09:30', calendarId: 'cal_team', addVideoCall: false, guests: ['hello@example.com'] };
describe('event IPC validation', () => {
  it('rejects impossible dates, times, guests and nonpositive durations before provider writes', () => {
    for (const patch of [{ date: '2026-02-30' }, { startTime: '25:00' }, { endTime: '09:00' }, { endTime: '08:00' }, { guests: ['invalid'] }]) {
      expect(createEventSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
    expect(createEventSchema.parse(valid).title).toBe('Planning');
  });
  it('keeps metadata-only edits partial so all-day times and guests are preserved', () => {
    expect(updateEventSchema.parse({ id: 'all-day', calendarId: 'calendar', notes: '' })).toEqual({ id: 'all-day', calendarId: 'calendar', notes: '' });
  });
  it('rejects reversed event query ranges', () => {
    expect(listEventsSchema.safeParse({ startsAt: '2026-10-18T00:00:00Z', endsAt: '2026-10-17T00:00:00Z' }).success).toBe(false);
  });
});
