import type {
  CalendarAccount,
  CalendarEvent,
  EventAttendee,
  CalendarSource,
  ConnectProviderResult,
  CreateEventInput,
  DeleteEventInput,
  ListEventsInput,
  UpdateEventInput,
} from '../../shared/calendar';
import { requestOAuthCode } from '../auth/oauth';
import { getAccount, getAccountsByProvider, getTokens, saveAccount, saveTokens, type ProviderTokens } from '../storage/credentialStore';
import { extractVideoConference } from './videoLinks';
import type { CalendarService } from './providerTypes';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GoogleUserInfo = {
  email: string;
  name?: string;
};

type GoogleCalendarList = {
  items?: GoogleCalendarItem[];
};

type GoogleCalendarItem = {
  id: string;
  summary?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
};

type GoogleEventsList = {
  items?: GoogleEvent[];
};

type GoogleEvent = {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }>;
  };
  hangoutLink?: string;
};

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export const googleCalendarService: CalendarService = {
  provider: 'google',
  async connect(): Promise<ConnectProviderResult> {
    const clientId = requiredEnv('WAYBETTER_GOOGLE_CLIENT_ID', 'Google Calendar');
    const clientSecret = optionalEnv('WAYBETTER_GOOGLE_CLIENT_SECRET');
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('access_type', 'offline');
    authorizationUrl.searchParams.set('prompt', 'consent');
    authorizationUrl.searchParams.set('include_granted_scopes', 'true');

    const codeResult = await requestOAuthCode({
      provider: 'google',
      authorizationUrl,
      scopes: GOOGLE_SCOPES,
    });

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      code: codeResult.code,
      code_verifier: codeResult.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: codeResult.redirectUri,
    });

    if (clientSecret) {
      tokenBody.set('client_secret', clientSecret);
    }

    const token = await postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', tokenBody);
    const tokens: ProviderTokens = {
      provider: 'google',
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: expiresAt(token.expires_in),
      scope: token.scope,
    };
    const userInfo = await googleFetch<GoogleUserInfo>('https://www.googleapis.com/oauth2/v2/userinfo', tokens);
    const account: CalendarAccount = {
      id: `google:${userInfo.email}`,
      provider: 'google',
      email: userInfo.email,
      displayName: userInfo.name ?? userInfo.email,
      connectedAt: new Date().toISOString(),
    };

    saveAccount(account, tokens);
    const calendars = await listGoogleCalendars(account);
    return { account, calendars };
  },
  listCalendars(account?: CalendarAccount): Promise<CalendarSource[]> {
    return listGoogleCalendars(account);
  },
  async listEvents(input: ListEventsInput, calendars: CalendarSource[]): Promise<CalendarEvent[]> {
    const events = await Promise.all(
      calendars.map(async (calendar) => {
        const tokens = await getFreshGoogleTokens(calendar.accountId);
        const params = new URLSearchParams({
          timeMin: input.startsAt,
          timeMax: input.endsAt,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '2500',
          conferenceDataVersion: '1',
        });
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events?${params}`;
        const response = await googleFetch<GoogleEventsList>(url, tokens);
        return (response.items ?? []).map((event) => mapGoogleEvent(event, calendar));
      }),
    );

    return events.flat();
  },
  async createEvent(input: CreateEventInput, calendar: CalendarSource): Promise<CalendarEvent> {
    const tokens = await getFreshGoogleTokens(calendar.accountId);
    const body = googleEventPayload(input, calendar);
    const params = new URLSearchParams({ conferenceDataVersion: shouldCreateGoogleMeet(input) ? '1' : '0' });
    const event = await googleFetch<GoogleEvent>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events?${params}`,
      tokens,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
    return mapGoogleEvent(event, calendar);
  },
  async updateEvent(input: UpdateEventInput, calendar: CalendarSource): Promise<CalendarEvent> {
    const tokens = await getFreshGoogleTokens(calendar.accountId);
    const event = await googleFetch<GoogleEvent>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events/${encodeURIComponent(input.id)}`,
      tokens,
      {
        method: 'PATCH',
        body: JSON.stringify(googleEventPayload(input, calendar)),
      },
    );
    return mapGoogleEvent(event, calendar);
  },
  async deleteEvent(input: DeleteEventInput, calendar: CalendarSource): Promise<void> {
    const tokens = await getFreshGoogleTokens(calendar.accountId);
    await googleFetch<void>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events/${encodeURIComponent(input.id)}`,
      tokens,
      { method: 'DELETE' },
    );
  },
};

async function listGoogleCalendars(account?: CalendarAccount): Promise<CalendarSource[]> {
  const accounts = account ? [account] : getAccountsByProvider('google');
  const calendarLists = await Promise.all(
    accounts.map(async (item) => {
      const tokens = await getFreshGoogleTokens(item.id);
      const response = await googleFetch<GoogleCalendarList>('https://www.googleapis.com/calendar/v3/users/me/calendarList', tokens);
      return (response.items ?? []).map((calendar) => mapGoogleCalendar(calendar, item));
    }),
  );

  return calendarLists.flat();
}

async function getFreshGoogleTokens(accountId: string): Promise<ProviderTokens> {
  const tokens = getTokens(accountId);
  if (!tokens) {
    throw new Error('Google account is not connected.');
  }

  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    return tokens;
  }

  const clientId = requiredEnv('WAYBETTER_GOOGLE_CLIENT_ID', 'Google Calendar');
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const clientSecret = optionalEnv('WAYBETTER_GOOGLE_CLIENT_SECRET');
  if (clientSecret) {
    tokenBody.set('client_secret', clientSecret);
  }

  const refreshed = await postForm<GoogleTokenResponse>('https://oauth2.googleapis.com/token', tokenBody);
  const nextTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    expiresAt: expiresAt(refreshed.expires_in),
    scope: refreshed.scope ?? tokens.scope,
  };
  saveTokens(accountId, nextTokens);
  return nextTokens;
}

function mapGoogleCalendar(calendar: GoogleCalendarItem, account: CalendarAccount): CalendarSource {
  const canWrite = ['owner', 'writer'].includes(calendar.accessRole ?? '');
  return {
    id: createCalendarId('google', account.id, calendar.id),
    accountId: account.id,
    provider: 'google',
    name: calendar.summary ?? calendar.id,
    color: calendar.backgroundColor ?? '#2f80ed',
    isVisible: true,
    isPrimary: calendar.primary,
    canWrite,
  };
}

function mapGoogleEvent(event: GoogleEvent, calendar: CalendarSource): CalendarEvent {
  const startsAt = event.start?.dateTime ?? dateToAllDayIso(event.start?.date);
  const endsAt = event.end?.dateTime ?? dateToAllDayIso(event.end?.date);
  const conferenceUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video' && entry.uri)?.uri;

  return {
    id: event.id,
    providerEventId: event.id,
    provider: 'google',
    calendarId: calendar.id,
    title: event.summary ?? 'Untitled event',
    description: stripHtml(event.description),
    location: event.location,
    startsAt,
    endsAt,
    isAllDay: Boolean(event.start?.date),
    timezone: event.start?.timeZone,
    status: event.status,
    attendees: event.attendees?.map((attendee) => ({
      email: attendee.email,
      name: attendee.displayName,
      responseStatus: mapGoogleResponse(attendee.responseStatus),
    })),
    video: extractVideoConference({
      conferenceUrl,
      location: event.location,
      description: event.description,
    }),
    sourceUrl: event.htmlLink,
    updatedAt: event.updated,
  };
}

function googleEventPayload(input: Partial<CreateEventInput>, calendar: CalendarSource): Record<string, unknown> {
  const date = input.date;
  const startTime = input.startTime;
  const endTime = input.endTime;
  return {
    summary: input.title,
    description: input.notes,
    location: input.location,
    start: date && startTime ? { dateTime: new Date(`${date}T${startTime}:00`).toISOString() } : undefined,
    end: date && endTime ? { dateTime: new Date(`${date}T${endTime}:00`).toISOString() } : undefined,
    attendees: input.guests ? googleAttendees(input.guests, calendar) : undefined,
    conferenceData: shouldCreateGoogleMeet(input)
      ? {
          createRequest: {
            requestId: `waybetter-calendar-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        }
      : undefined,
  };
}

function shouldCreateGoogleMeet(input: Partial<CreateEventInput>): boolean {
  return Boolean(input.addVideoCall && (!input.videoProvider || input.videoProvider === 'google_meet'));
}

function googleAttendees(guests: string[], calendar: CalendarSource): Array<{ email: string; responseStatus?: string }> {
  const ownerEmail = getAccount(calendar.accountId)?.email ?? accountEmailFromId(calendar.accountId);
  const attendees = ownerEmail
    ? [{ email: ownerEmail, responseStatus: 'accepted' }, ...guests.map((email) => ({ email }))]
    : guests.map((email) => ({ email }));
  const seen = new Set<string>();

  return attendees.filter((attendee) => {
    const key = attendee.email.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function accountEmailFromId(accountId: string): string {
  return accountId.includes(':') ? accountId.slice(accountId.indexOf(':') + 1) : accountId;
}

async function googleFetch<T>(url: string, tokens: ProviderTokens, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar request failed with ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function postForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google OAuth request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function createCalendarId(provider: string, accountId: string, providerId: string): string {
  return `${provider}::${accountId}::${encodeURIComponent(providerId)}`;
}

function providerCalendarId(calendarId: string): string {
  return decodeURIComponent(calendarId.split('::')[2] ?? calendarId);
}

function expiresAt(expiresIn: number): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function dateToAllDayIso(date?: string): string {
  return new Date(`${date ?? new Date().toISOString().slice(0, 10)}T00:00:00`).toISOString();
}

function requiredEnv(name: string, label: string): string {
  const legacyName = legacyEnvName(name);
  const value = process.env[name] ?? process.env[legacyName];
  if (!value) {
    throw new Error(`${label} requires ${name} or ${legacyName} to be set before connecting.`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] ?? process.env[legacyEnvName(name)];
}

function legacyEnvName(name: string): string {
  return name.replace(/^WAYBETTER_/, 'DAYLINE_');
}

function stripHtml(value?: string): string | undefined {
  return value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapGoogleResponse(response?: string): EventAttendee['responseStatus'] {
  if (response === 'accepted' || response === 'declined' || response === 'tentative' || response === 'needsAction') {
    return response;
  }

  return undefined;
}
