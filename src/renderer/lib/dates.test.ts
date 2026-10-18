import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultDraftTimes, getAgendaRange } from './dates';

afterEach(() => vi.useRealTimers());

describe('event draft times', () => {
  it('uses the next quarter hour and the configured duration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 10, 2));
    expect(defaultDraftTimes(new Date(), 45)).toEqual({ startTime: '10:15', endTime: '11:00' });
  });

  it('keeps a late-night draft within the date and available time choices', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 23, 56));
    expect(defaultDraftTimes(new Date(), 60)).toEqual({ startTime: '22:45', endTime: '23:45' });
  });

  it('starts future-day drafts at 9 AM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 19, 2));
    expect(defaultDraftTimes(new Date(2026, 9, 18), 30)).toEqual({ startTime: '09:00', endTime: '09:30' });
  });
});

it('uses an exclusive midnight agenda end so events in the final millisecond are included', () => {
  const range = getAgendaRange(new Date(2026, 9, 17, 12));
  expect(new Date(range.startsAt)).toEqual(new Date(2026, 9, 17));
  expect(new Date(range.endsAt)).toEqual(new Date(2026, 9, 24));
  expect(range.dates).toHaveLength(7);
});
