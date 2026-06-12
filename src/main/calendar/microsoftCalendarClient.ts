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

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type MicrosoftUser = {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
};

type MicrosoftList<T> = {
  value?: T[];
};

type MicrosoftCalendar = {
  id: string;
  name?: string;
  color?: string;
  canEdit?: boolean;
  isDefaultCalendar?: boolean;
};

type MicrosoftEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  location?: { displayName?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  showAs?: string;
  webLink?: string;
  lastModifiedDateTime?: string;
  onlineMeetingUrl?: string;
  onlineMeeting?: { joinUrl?: string };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
    status?: { response?: string };
  }>;
};

const MICROSOFT_SCOPES = ['offline_access', 'User.Read', 'Calendars.ReadWrite'];

export const microsoftCalendarService: CalendarService = {
  provider: 'microsoft',
  async connect(): Promise<ConnectProviderResult> {
    const clientId = requiredEnv('WAYBETTER_MICROSOFT_CLIENT_ID', 'Microsoft Calendar');
    const authorizationUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('response_mode', 'query');

    const codeResult = await requestOAuthCode({
      provider: 'microsoft',
      authorizationUrl,
      scopes: MICROSOFT_SCOPES,
      port: optionalNumberEnv('WAYBETTER_MICROSOFT_REDIRECT_PORT'),
      redirectHost: 'localhost',
    });

    const token = await postMicrosoftForm<MicrosoftTokenResponse>(
      new URLSearchParams({
        client_id: clientId,
        code: codeResult.code,
        code_verifier: codeResult.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: codeResult.redirectUri,
        scope: MICROSOFT_SCOPES.join(' '),
      }),
    );
    const tokens: ProviderTokens = {
      provider: 'microsoft',
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: expiresAt(token.expires_in),
      scope: token.scope,
    };
    const user = await microsoftFetch<MicrosoftUser>('https://graph.microsoft.com/v1.0/me', tokens);
    const email = user.mail ?? user.userPrincipalName ?? user.id;
    const account: CalendarAccount = {
      id: `microsoft:${email}`,
      provider: 'microsoft',
      email,
      displayName: user.displayName ?? email,
      connectedAt: new Date().toISOString(),
    };

    saveAccount(account, tokens);
    const calendars = await listMicrosoftCalendars(account);
    return { account, calendars };
  },
  listCalendars(account?: CalendarAccount): Promise<CalendarSource[]> {
    return listMicrosoftCalendars(account);
  },
  async listEvents(input: ListEventsInput, calendars: CalendarSource[]): Promise<CalendarEvent[]> {
    const events = await Promise.all(
      calendars.map(async (calendar) => {
        const tokens = await getFreshMicrosoftTokens(calendar.accountId);
        const params = new URLSearchParams({
          startDateTime: input.startsAt,
          endDateTime: input.endsAt,
          '$top': '250',
          '$orderby': 'start/dateTime',
        });
        const response = await microsoftFetch<MicrosoftList<MicrosoftEvent>>(
          `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/calendarView?${params}`,
          tokens,
        );
        return (response.value ?? []).map((event) => mapMicrosoftEvent(event, calendar));
      }),
    );

    return events.flat();
  },
  async createEvent(input: CreateEventInput, calendar: CalendarSource): Promise<CalendarEvent> {
    const tokens = await getFreshMicrosoftTokens(calendar.accountId);
    const event = await microsoftFetch<MicrosoftEvent>(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events`,
      tokens,
      {
        method: 'POST',
        body: JSON.stringify(microsoftEventPayload(input, calendar)),
      },
    );
    return mapMicrosoftEvent(event, calendar);
  },
  async updateEvent(input: UpdateEventInput, calendar: CalendarSource): Promise<CalendarEvent> {
    const tokens = await getFreshMicrosoftTokens(calendar.accountId);
    const event = await microsoftFetch<MicrosoftEvent>(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events/${encodeURIComponent(input.id)}`,
      tokens,
      {
        method: 'PATCH',
        body: JSON.stringify(microsoftEventPayload(input, calendar)),
      },
    );
    return mapMicrosoftEvent(event, calendar);
  },
  async deleteEvent(input: DeleteEventInput, calendar: CalendarSource): Promise<void> {
    const tokens = await getFreshMicrosoftTokens(calendar.accountId);
    await microsoftFetch<void>(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(providerCalendarId(calendar.id))}/events/${encodeURIComponent(input.id)}`,
      tokens,
      { method: 'DELETE' },
    );
  },
};

async function listMicrosoftCalendars(account?: CalendarAccount): Promise<CalendarSource[]> {
  const accounts = account ? [account] : getAccountsByProvider('microsoft');
  const calendarLists = await Promise.all(
    accounts.map(async (item) => {
      const tokens = await getFreshMicrosoftTokens(item.id);
      const response = await microsoftFetch<MicrosoftList<MicrosoftCalendar>>('https://graph.microsoft.com/v1.0/me/calendars', tokens);
      return (response.value ?? []).map((calendar) => mapMicrosoftCalendar(calendar, item));
    }),
  );

  return calendarLists.flat();
}

async function getFreshMicrosoftTokens(accountId: string): Promise<ProviderTokens> {
  const tokens = getTokens(accountId);
  if (!tokens) {
    throw new Error('Microsoft account is not connected.');
  }

  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    return tokens;
  }

  const refreshed = await postMicrosoftForm<MicrosoftTokenResponse>(
    new URLSearchParams({
      client_id: requiredEnv('WAYBETTER_MICROSOFT_CLIENT_ID', 'Microsoft Calendar'),
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  );
  const nextTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: expiresAt(refreshed.expires_in),
    scope: refreshed.scope ?? tokens.scope,
  };
  saveTokens(accountId, nextTokens);
  return nextTokens;
}

function mapMicrosoftCalendar(calendar: MicrosoftCalendar, account: CalendarAccount): CalendarSource {
  return {
    id: createCalendarId('microsoft', account.id, calendar.id),
    accountId: account.id,
    provider: 'microsoft',
    name: calendar.name ?? 'Calendar',
    color: microsoftColor(calendar.color),
    isVisible: true,
    isPrimary: calendar.isDefaultCalendar,
    canWrite: calendar.canEdit ?? true,
  };
}

function mapMicrosoftEvent(event: MicrosoftEvent, calendar: CalendarSource): CalendarEvent {
  const description = stripHtml(event.body?.content) ?? event.bodyPreview;
  const conferenceUrl = event.onlineMeeting?.joinUrl ?? event.onlineMeetingUrl;

  return {
    id: event.id,
    providerEventId: event.id,
    provider: 'microsoft',
    calendarId: calendar.id,
    title: event.subject ?? 'Untitled event',
    description,
    location: event.location?.displayName,
    startsAt: graphDateToIso(event.start?.dateTime),
    endsAt: graphDateToIso(event.end?.dateTime),
    isAllDay: Boolean(event.isAllDay),
    timezone: event.start?.timeZone,
    status: event.showAs === 'free' ? 'tentative' : 'confirmed',
    attendees: event.attendees?.map((attendee) => ({
      email: attendee.emailAddress?.address ?? '',
      name: attendee.emailAddress?.name,
      responseStatus: mapMicrosoftResponse(attendee.status?.response),
    })),
    video: extractVideoConference({
      conferenceUrl,
      location: event.location?.displayName,
      description,
    }),
    sourceUrl: event.webLink,
    updatedAt: event.lastModifiedDateTime,
  };
}

function microsoftEventPayload(input: Partial<CreateEventInput>, calendar: CalendarSource): Record<string, unknown> {
  const date = input.date;
  const startTime = input.startTime;
  const endTime = input.endTime;

  return {
    subject: input.title,
    body: input.notes ? { contentType: 'text', content: input.notes } : undefined,
    location: input.location ? { displayName: input.location } : undefined,
    start: date && startTime ? { dateTime: `${date}T${startTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : undefined,
    end: date && endTime ? { dateTime: `${date}T${endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : undefined,
    attendees: input.guests ? microsoftAttendees(input.guests, calendar).map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })) : undefined,
    isOnlineMeeting: undefined,
    onlineMeetingProvider: undefined,
  };
}

function microsoftAttendees(guests: string[], calendar: CalendarSource): string[] {
  const ownerEmail = getAccount(calendar.accountId)?.email ?? accountEmailFromId(calendar.accountId);
  const seen = new Set<string>();

  return [ownerEmail, ...guests].filter((email): email is string => {
    const key = email?.trim().toLowerCase();
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

async function microsoftFetch<T>(url: string, tokens: ProviderTokens, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed with ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function postMicrosoftForm<T>(body: URLSearchParams): Promise<T> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Microsoft OAuth request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function createCalendarId(provider: string, accountId: string, providerId: string): string {
  return `${provider}::${accountId}::${encodeURIComponent(providerId)}`;
}

function providerCalendarId(calendarId: string): string {
  return decodeURIComponent(calendarId.split('::')[2] ?? calendarId);
}

function graphDateToIso(dateTime?: string): string {
  return new Date(dateTime ?? new Date().toISOString()).toISOString();
}

function mapMicrosoftResponse(response?: string): EventAttendee['responseStatus'] {
  if (response === 'accepted') {
    return 'accepted';
  }

  if (response === 'declined') {
    return 'declined';
  }

  if (response === 'tentativelyAccepted') {
    return 'tentative';
  }

  return 'needsAction';
}

function expiresAt(expiresIn: number): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function requiredEnv(name: string, label: string): string {
  const legacyName = name.replace(/^WAYBETTER_/, 'DAYLINE_');
  const value = process.env[name] ?? process.env[legacyName];
  if (!value) {
    throw new Error(`${label} requires ${name} or ${legacyName} to be set before connecting.`);
  }

  return value;
}

function optionalNumberEnv(name: string): number | undefined {
  const legacyName = name.replace(/^WAYBETTER_/, 'DAYLINE_');
  const value = process.env[name] ?? process.env[legacyName];
  return value ? Number(value) : undefined;
}

function stripHtml(value?: string): string | undefined {
  return value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function microsoftColor(color?: string): string {
  const colors: Record<string, string> = {
    auto: '#6264a7',
    lightBlue: '#4f9cf9',
    lightGreen: '#13a10e',
    lightOrange: '#f7630c',
    lightGray: '#69797e',
    lightYellow: '#fce100',
    lightTeal: '#00b7c3',
    lightPink: '#e3008c',
    lightBrown: '#8e562e',
    lightRed: '#d13438',
    maxColor: '#6264a7',
  };

  return colors[color ?? 'auto'] ?? '#6264a7';
}
