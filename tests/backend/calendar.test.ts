import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CalendarAccount, CalendarSource, CreateEventInput } from '../../src/shared/calendar';

const system = vi.hoisted(() => ({ userData: '', secure: true, openExternal: vi.fn() }));
vi.mock('electron', () => ({
  app: { getPath: () => system.userData },
  shell: { openExternal: system.openExternal },
  safeStorage: {
    isEncryptionAvailable: () => system.secure,
    encryptString: (value: string) => Buffer.from(`locked:${value}`),
    decryptString: (value: Buffer) => {
      if (!value.toString().startsWith('locked:')) throw new Error('Invalid ciphertext');
      return value.toString().slice(7);
    },
  },
}));

import { createEvent, deleteEvent, disconnectProviderAccount, listCalendars, listEvents, updateEvent } from '../../src/main/calendar/calendarService';
import { getTokens, listAccounts, saveAccount, type ProviderTokens } from '../../src/main/storage/credentialStore';
import { googleCalendarService } from '../../src/main/calendar/googleCalendarClient';
import { microsoftCalendarService } from '../../src/main/calendar/microsoftCalendarClient';
import { readSettings, writeSettings } from '../../src/main/settings/settingsStore';
import { freshTokens } from '../../src/main/auth/tokenRefresh';
import { requestOAuthCode } from '../../src/main/auth/oauth';

const input: CreateEventInput = {
  calendarId: 'cal_team', title: 'A saved appointment', date: '2026-10-17',
  startTime: '10:00', endTime: '11:00', addVideoCall: false, guests: [], notes: 'Original note', location: 'Original location',
};
const range = { startsAt: '2026-10-16T00:00:00.000Z', endsAt: '2026-10-19T00:00:00.000Z' };
const tokens = (provider: 'google' | 'microsoft', expired = false): ProviderTokens => ({
  provider, accessToken: 'access', refreshToken: 'refresh',
  expiresAt: new Date(Date.now() + (expired ? -60_000 : 3_600_000)).toISOString(),
});
const account = (provider: 'google' | 'microsoft'): CalendarAccount => ({
  id: `${provider}:user@example.com`, provider, email: 'user@example.com', displayName: 'User', connectedAt: new Date().toISOString(),
});
const calendar = (provider: 'google' | 'microsoft'): CalendarSource => ({
  id: `${provider}::${account(provider).id}::primary`, accountId: account(provider).id, provider,
  name: 'Primary', color: '#000000', isVisible: true, canWrite: true,
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.stubEnv('TZ', 'America/Los_Angeles');
  system.userData = mkdtempSync(join(tmpdir(), 'waybetter-backend-'));
  system.secure = true;
  system.openExternal.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(system.userData, { recursive: true, force: true });
});

describe('desktop local calendar persistence', () => {
  it('creates, reloads, edits and deletes saved events without losing changes', async () => {
    const event = await createEvent(input);
    expect((await listEvents(range)).find((item) => item.id === event.id)?.title).toBe(input.title);
    const updated = await updateEvent({ id: event.id, calendarId: input.calendarId, title: 'Changed', notes: '', location: '' });
    expect(updated.description).toBe('');
    expect(updated.location).toBe('');
    expect(JSON.parse(readFileSync(join(system.userData, 'local-events.json'), 'utf8')).find((item: { id: string }) => item.id === event.id).title).toBe('Changed');
    await deleteEvent({ id: event.id, calendarId: input.calendarId });
    expect((await listEvents(range)).some((item) => item.id === event.id)).toBe(false);
  });

  it('honors an explicitly empty calendar selection', async () => {
    await createEvent(input);
    expect(await listEvents({ ...range, calendarIds: [] })).toEqual([]);
  });

  it('includes events overlapping the start of the requested range', async () => {
    const event = await createEvent(input);
    const start = new Date(event.startsAt).getTime();
    const events = await listEvents({ startsAt: new Date(start + 15 * 60_000).toISOString(), endsAt: new Date(start + 30 * 60_000).toISOString() });
    expect(events.some((item) => item.id === event.id)).toBe(true);
  });

  it('rejects disconnected IDs and fake conference links before reporting success', async () => {
    await expect(createEvent({ ...input, calendarId: 'google::removed::old' })).rejects.toThrow('no longer connected');
    await expect(createEvent({ ...input, addVideoCall: true })).rejects.toThrow('Connect a calendar');
    await expect(createEvent({ ...input, endTime: '09:00' })).rejects.toThrow('after its start');
  });

  it('can disconnect a broken account without making provider network calls', async () => {
    const saved = account('google');
    saveAccount(saved, tokens('google', true));
    writeSettings({ selectedCalendarIds: [calendar('google').id], defaultCalendarId: calendar('google').id });
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    await disconnectProviderAccount(saved.id);
    expect(listAccounts()).toEqual([]);
    expect(readSettings().defaultCalendarId).toBe('cal_team');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('provider calendar responses', () => {
  it('loads every Google page and omits cancelled events without valid dates', async () => {
    saveAccount(account('google'), tokens('google'));
    const fetch = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.has('conferenceDataVersion')).toBe(false);
      const id = parsed.searchParams.get('pageToken') ? 'second' : 'first';
      return json({ items: [{ id, start: { dateTime: '2026-10-17T10:00:00Z' }, end: { dateTime: '2026-10-17T11:00:00Z' } }, { id: 'removed', status: 'cancelled' }], ...(id === 'first' ? { nextPageToken: 'page2' } : {}) });
    });
    vi.stubGlobal('fetch', fetch);
    expect((await googleCalendarService.listEvents(range, [calendar('google')])).map((item) => item.id)).toEqual(['first', 'second']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('loads Graph pages and interprets zone-less UTC correctly', async () => {
    saveAccount(account('microsoft'), tokens('microsoft'));
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Prefer).toBe('outlook.timezone="UTC"');
      return json({ value: [{ id: url.includes('page=2') ? 'second' : 'first', start: { dateTime: '2026-10-17T17:30:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-17T18:30:00.0000000', timeZone: 'UTC' } }], ...(!url.includes('page=2') ? { '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/events?page=2' } : {}) });
    });
    vi.stubGlobal('fetch', fetch);
    const events = await microsoftCalendarService.listEvents(range, [calendar('microsoft')]);
    expect(events).toHaveLength(2);
    expect(events[0].startsAt).toBe('2026-10-17T17:30:00.000Z');
  });

  it('keeps all-day Microsoft events on their calendar dates', async () => {
    saveAccount(account('microsoft'), tokens('microsoft'));
    vi.stubGlobal('fetch', vi.fn(async () => json({ value: [{ id: 'all-day', isAllDay: true, start: { dateTime: '2026-10-17T00:00:00.0000000' }, end: { dateTime: '2026-10-18T00:00:00.0000000' } }] })));
    const [event] = await microsoftCalendarService.listEvents(range, [calendar('microsoft')]);
    expect(new Date(event.startsAt).getDate()).toBe(17);
    expect(new Date(event.startsAt).getHours()).toBe(0);
  });

  it('clears Microsoft descriptions and locations with empty edits', async () => {
    saveAccount(account('microsoft'), tokens('microsoft'));
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ body: { content: '' }, location: { displayName: '' } });
      return json({ id: 'event', start: { dateTime: '2026-10-17T17:30:00' }, end: { dateTime: '2026-10-17T18:30:00' } });
    });
    vi.stubGlobal('fetch', fetch);
    await microsoftCalendarService.updateEvent({ id: 'event', calendarId: calendar('microsoft').id, notes: '', location: '' }, calendar('microsoft'));
  });

  it('paginates calendars and does not replace a connected empty account with demos', async () => {
    saveAccount(account('google'), tokens('google'));
    const fetch = vi.fn(async (url: string) => json(new URL(url).searchParams.has('pageToken') ? { items: [{ id: 'second', accessRole: 'reader' }] } : { items: [{ id: 'first', accessRole: 'owner' }], nextPageToken: 'next' }));
    vi.stubGlobal('fetch', fetch);
    expect(await listCalendars()).toHaveLength(2);
    fetch.mockImplementation(async () => json({ items: [] }));
    expect(await listCalendars()).toEqual([]);
  });

  it('shares a Google refresh and preserves its rotated refresh token', async () => {
    saveAccount(account('google'), tokens('google', true));
    vi.stubEnv('WAYBETTER_GOOGLE_CLIENT_ID', 'test-client');
    const fetch = vi.fn(async (url: string) => url.includes('/token')
      ? json({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 })
      : json({ items: [] }));
    vi.stubGlobal('fetch', fetch);
    await Promise.all([googleCalendarService.listCalendars(), googleCalendarService.listCalendars()]);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/token'))).toHaveLength(1);
    expect(getTokens(account('google').id)?.refreshToken).toBe('rotated-refresh');
  });
});

describe('credential lifecycle', () => {
  it('does not resurrect an account disconnected while refresh was pending', async () => {
    let stored: ProviderTokens | null = tokens('google', true);
    let complete!: (tokens: ProviderTokens) => void;
    const refresh = new Promise<ProviderTokens>((resolve) => { complete = resolve; });
    const save = vi.fn();
    const result = freshTokens({ key: 'disconnect-test', label: 'Google', read: () => stored, save, refresh: () => refresh });
    stored = null;
    complete(tokens('google'));
    await expect(result).rejects.toThrow('disconnected');
    expect(save).not.toHaveBeenCalled();
  });

  it('reads legacy plaintext records but refuses new plaintext credentials', () => {
    writeFileSync(join(system.userData, 'calendar-accounts.json'), JSON.stringify([{ account: account('google'), encryptedTokens: Buffer.from(JSON.stringify(tokens('google'))).toString('base64') }]));
    expect(getTokens(account('google').id)?.accessToken).toBe('access');
    expect(JSON.parse(readFileSync(join(system.userData, 'calendar-accounts.json'), 'utf8'))[0].encryptedTokens).toMatch(/^encrypted:/);
    system.secure = false;
    expect(() => saveAccount(account('microsoft'), tokens('microsoft'))).toThrow('Secure credential storage');
  });
});

describe('OAuth loopback callback', () => {
  it('ignores favicon and invalid state before accepting the real callback', async () => {
    system.openExternal.mockImplementation(async (url: string) => {
      const authorization = new URL(url);
      const redirect = authorization.searchParams.get('redirect_uri')!;
      expect((await fetch(new URL('/favicon.ico', redirect))).status).toBe(404);
      expect((await fetch(`${redirect}?code=wrong&state=invalid`)).status).toBe(400);
      expect((await fetch(`${redirect}?code=accepted&state=${authorization.searchParams.get('state')}`)).status).toBe(200);
    });
    const result = await requestOAuthCode({ provider: 'google', authorizationUrl: new URL('https://accounts.google.com/o/oauth2/v2/auth'), scopes: ['openid'], timeoutMs: 5000 });
    expect(result.code).toBe('accepted');
    expect(result.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('rejects invalid callback ports before opening a browser', async () => {
    await expect(requestOAuthCode({ provider: 'google', authorizationUrl: new URL('https://accounts.google.com/o/oauth2/v2/auth'), scopes: [], port: NaN })).rejects.toThrow('redirect port');
    expect(system.openExternal).not.toHaveBeenCalled();
  });
});
