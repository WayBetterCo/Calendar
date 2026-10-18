import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('browser preview calendar', () => {
  it('persists create, update, and delete across renderer reloads', async () => {
    let { calendarApi } = await import('./calendarApi');
    const input = {
      title: 'Preview regression', date: '2030-01-01', startTime: '09:00', endTime: '10:00',
      calendarId: 'cal_team', addVideoCall: false, guests: ['friend@example.com'],
    };
    const created = await calendarApi.createEvent(input);
    const updated = await calendarApi.updateEvent({ id: created.id, calendarId: created.calendarId, title: 'Updated preview', notes: '', location: '' });
    expect(updated.video).toEqual(created.video);
    vi.resetModules();
    ({ calendarApi } = await import('./calendarApi'));
    const range = { startsAt: new Date(2030, 0, 1).toISOString(), endsAt: new Date(2030, 0, 2).toISOString() };
    expect((await calendarApi.listEvents(range)).map((event) => event.title)).toEqual(['Updated preview']);
    expect(await calendarApi.listEvents({ ...range, search: 'friend@example.com' })).toHaveLength(1);
    expect(await calendarApi.listEvents({ ...range, calendarIds: [] })).toEqual([]);
    await calendarApi.deleteEvent({ id: created.id, calendarId: created.calendarId });
    vi.resetModules();
    ({ calendarApi } = await import('./calendarApi'));
    expect(await calendarApi.listEvents(range)).toEqual([]);
  });

  it('keeps calendar visibility settings after a reload', async () => {
    let { calendarApi } = await import('./calendarApi');
    await calendarApi.updateSettings({ selectedCalendarIds: [], defaultDurationMinutes: 45 });
    vi.resetModules();
    ({ calendarApi } = await import('./calendarApi'));
    expect(await calendarApi.getSettings()).toMatchObject({ selectedCalendarIds: [], defaultDurationMinutes: 45 });
  });
});
