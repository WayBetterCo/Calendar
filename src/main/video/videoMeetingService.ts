import type {
  ConnectVideoProviderResult,
  CreatableVideoProvider,
  CreateEventInput,
  VideoAccount,
  VideoConference,
} from '../../shared/calendar';
import { requestOAuthCode } from '../auth/oauth';
import {
  getAccountsByProvider,
  getVideoAccountsByProvider,
  getVideoTokens,
  listVideoAccounts,
  removeVideoAccount,
  saveVideoAccount,
  saveVideoTokens,
  type ProviderTokens,
} from '../storage/credentialStore';

type VideoMeetingInput = CreateEventInput & {
  subject: string;
};

type ZoomTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type ZoomUser = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

type ZoomMeeting = {
  id: number;
  join_url: string;
};

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

type TeamsOnlineMeeting = {
  id: string;
  joinWebUrl?: string;
};

const ZOOM_SCOPES = ['user:read:user', 'meeting:write:meeting'];
const TEAMS_SCOPES = ['offline_access', 'User.Read', 'OnlineMeetings.ReadWrite'];

export function getConnectedVideoAccounts(): VideoAccount[] {
  const meetAccounts: VideoAccount[] = getAccountsByProvider('google').map((account) => ({
    id: `meet:${account.id}`,
    provider: 'google_meet',
    email: account.email,
    displayName: account.displayName,
    connectedAt: account.connectedAt,
  }));

  return [...meetAccounts, ...listVideoAccounts()];
}

export async function connectVideoProvider(provider: CreatableVideoProvider): Promise<ConnectVideoProviderResult> {
  if (provider === 'google_meet') {
    const account = getConnectedVideoAccounts().find((item) => item.provider === 'google_meet');
    if (!account) {
      throw new Error('Connect Google Calendar before creating Google Meet links.');
    }
    return { account };
  }

  if (provider === 'zoom') {
    return connectZoom();
  }

  return connectTeams();
}

export function disconnectVideoAccount(accountId: string): void {
  if (accountId.startsWith('meet:')) {
    throw new Error('Disconnect the Google calendar account to remove Google Meet.');
  }

  removeVideoAccount(accountId);
}

export async function createVideoMeeting(input: VideoMeetingInput): Promise<VideoConference | null> {
  if (!input.addVideoCall) {
    return null;
  }

  const provider = input.videoProvider ?? 'google_meet';

  if (provider === 'google_meet') {
    return null;
  }

  if (provider === 'zoom') {
    return createZoomMeeting(input);
  }

  return createTeamsMeeting(input);
}

async function connectZoom(): Promise<ConnectVideoProviderResult> {
  const clientId = requiredEnv('WAYBETTER_ZOOM_CLIENT_ID', 'Zoom');
  const clientSecret = requiredEnv('WAYBETTER_ZOOM_CLIENT_SECRET', 'Zoom');
  const authorizationUrl = new URL('https://zoom.us/oauth/authorize');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('response_type', 'code');

  const codeResult = await requestOAuthCode({
    provider: 'zoom',
    authorizationUrl,
    scopes: ZOOM_SCOPES,
    port: optionalNumberEnv('WAYBETTER_ZOOM_REDIRECT_PORT'),
    redirectHost: 'localhost',
  });
  const token = await zoomTokenRequest<ZoomTokenResponse>(
    new URLSearchParams({
      code: codeResult.code,
      grant_type: 'authorization_code',
      redirect_uri: codeResult.redirectUri,
      code_verifier: codeResult.codeVerifier,
    }),
    clientId,
    clientSecret,
  );
  const tokens: ProviderTokens = {
    provider: 'zoom',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: expiresAt(token.expires_in),
    scope: token.scope,
  };
  const user = await zoomFetch<ZoomUser>('https://api.zoom.us/v2/users/me', tokens);
  const email = user.email ?? user.id;
  const account: VideoAccount = {
    id: `zoom:${email}`,
    provider: 'zoom',
    email,
    displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || email,
    connectedAt: new Date().toISOString(),
  };
  saveVideoAccount(account, tokens);
  return { account };
}

async function connectTeams(): Promise<ConnectVideoProviderResult> {
  const clientId = requiredEnv('WAYBETTER_TEAMS_CLIENT_ID', 'Teams');
  const authorizationUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('response_mode', 'query');

  const codeResult = await requestOAuthCode({
    provider: 'teams',
    authorizationUrl,
    scopes: TEAMS_SCOPES,
    port: optionalNumberEnv('WAYBETTER_TEAMS_REDIRECT_PORT'),
    redirectHost: 'localhost',
  });
  const token = await microsoftTokenRequest<MicrosoftTokenResponse>(
    new URLSearchParams({
      client_id: clientId,
      code: codeResult.code,
      code_verifier: codeResult.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: codeResult.redirectUri,
      scope: TEAMS_SCOPES.join(' '),
    }),
  );
  const tokens: ProviderTokens = {
    provider: 'teams',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: expiresAt(token.expires_in),
    scope: token.scope,
  };
  const user = await microsoftFetch<MicrosoftUser>('https://graph.microsoft.com/v1.0/me', tokens);
  const email = user.mail ?? user.userPrincipalName ?? user.id;
  const account: VideoAccount = {
    id: `teams:${email}`,
    provider: 'teams',
    email,
    displayName: user.displayName ?? email,
    connectedAt: new Date().toISOString(),
  };
  saveVideoAccount(account, tokens);
  return { account };
}

async function createZoomMeeting(input: VideoMeetingInput): Promise<VideoConference> {
  const account = getVideoAccountsByProvider('zoom')[0];
  if (!account) {
    throw new Error('Connect a Zoom account before creating Zoom meetings.');
  }

  const tokens = await getFreshZoomTokens(account.id);
  const response = await zoomFetch<ZoomMeeting>('https://api.zoom.us/v2/users/me/meetings', tokens, {
    method: 'POST',
    body: JSON.stringify({
      topic: input.subject,
      type: 2,
      start_time: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
      duration: durationMinutes(input.startTime, input.endTime),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      agenda: input.notes,
    }),
  });

  return { provider: 'zoom', label: 'Zoom', url: response.join_url };
}

async function createTeamsMeeting(input: VideoMeetingInput): Promise<VideoConference> {
  const account = getVideoAccountsByProvider('teams')[0];
  if (!account) {
    throw new Error('Connect a Teams account before creating Teams meetings.');
  }

  const tokens = await getFreshTeamsTokens(account.id);
  const response = await microsoftFetch<TeamsOnlineMeeting>('https://graph.microsoft.com/v1.0/me/onlineMeetings', tokens, {
    method: 'POST',
    body: JSON.stringify({
      subject: input.subject,
      startDateTime: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
      endDateTime: new Date(`${input.date}T${input.endTime}:00`).toISOString(),
    }),
  });

  if (!response.joinWebUrl) {
    throw new Error('Teams did not return a meeting join URL.');
  }

  return { provider: 'teams', label: 'Teams', url: response.joinWebUrl };
}

async function getFreshZoomTokens(accountId: string): Promise<ProviderTokens> {
  const tokens = getVideoTokens(accountId);
  if (!tokens) {
    throw new Error('Zoom account is not connected.');
  }

  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    return tokens;
  }

  const refreshed = await zoomTokenRequest<ZoomTokenResponse>(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
    requiredEnv('WAYBETTER_ZOOM_CLIENT_ID', 'Zoom'),
    requiredEnv('WAYBETTER_ZOOM_CLIENT_SECRET', 'Zoom'),
  );
  const nextTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: expiresAt(refreshed.expires_in),
    scope: refreshed.scope ?? tokens.scope,
  };
  saveVideoTokens(accountId, nextTokens);
  return nextTokens;
}

async function getFreshTeamsTokens(accountId: string): Promise<ProviderTokens> {
  const tokens = getVideoTokens(accountId);
  if (!tokens) {
    throw new Error('Teams account is not connected.');
  }

  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    return tokens;
  }

  const refreshed = await microsoftTokenRequest<MicrosoftTokenResponse>(
    new URLSearchParams({
      client_id: requiredEnv('WAYBETTER_TEAMS_CLIENT_ID', 'Teams'),
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      scope: TEAMS_SCOPES.join(' '),
    }),
  );
  const nextTokens = {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: expiresAt(refreshed.expires_in),
    scope: refreshed.scope ?? tokens.scope,
  };
  saveVideoTokens(accountId, nextTokens);
  return nextTokens;
}

async function zoomFetch<T>(url: string, tokens: ProviderTokens, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Zoom request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
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
    throw new Error(`Teams request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function zoomTokenRequest<T>(body: URLSearchParams, clientId: string, clientSecret: string): Promise<T> {
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Zoom OAuth request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function microsoftTokenRequest<T>(body: URLSearchParams): Promise<T> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Teams OAuth request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function requiredEnv(name: string, label: string): string {
  const legacyName = legacyEnvName(name);
  const value = process.env[name] ?? process.env[legacyName];
  if (!value) {
    throw new Error(`${label} requires ${name} or ${legacyName} to be set before connecting.`);
  }

  return value;
}

function optionalNumberEnv(name: string): number | undefined {
  const value = process.env[name] ?? process.env[legacyEnvName(name)];
  return value ? Number(value) : undefined;
}

function legacyEnvName(name: string): string {
  return name.replace(/^WAYBETTER_/, 'DAYLINE_');
}

function expiresAt(expiresIn: number): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function durationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  return Math.max(1, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}
