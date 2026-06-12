# Calendar Connections

WayBetter Calendar supports real read/write calendar connections through provider OAuth in the Electron main process.

## Google Calendar

Set:

```sh
WAYBETTER_GOOGLE_CLIENT_ID=...
WAYBETTER_GOOGLE_CLIENT_SECRET=... # optional, depends on your OAuth client
```

Existing `DAYLINE_*` environment variable names are still accepted as compatibility aliases.

Use a Google OAuth client that can use loopback redirects. WayBetter Calendar opens the system browser and receives the callback on `http://127.0.0.1:<dynamic-port>/oauth/google/callback`.

Scopes requested:

```txt
openid
email
profile
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.events
```

## Microsoft 365 Calendar

Set:

```sh
WAYBETTER_MICROSOFT_CLIENT_ID=...
WAYBETTER_MICROSOFT_REDIRECT_PORT=53685
```

Use an Entra app registration that allows public client flows. WayBetter Calendar opens the system browser and receives the callback on `http://localhost:<port>/oauth/microsoft/callback`. If `WAYBETTER_MICROSOFT_REDIRECT_PORT` is omitted, the app uses an available dynamic loopback port.

Scopes requested:

```txt
offline_access
User.Read
Calendars.ReadWrite
```

WayBetter Calendar uses Microsoft Graph to list calendars, read calendar views, and create/update/delete events.

## Video Meeting Providers

Google Meet is available after Google Calendar is connected. For Zoom and Teams, WayBetter Calendar creates a standalone meeting link first, then attaches that link to the calendar event.

### Zoom

Set:

```sh
WAYBETTER_ZOOM_CLIENT_ID=...
WAYBETTER_ZOOM_CLIENT_SECRET=...
WAYBETTER_ZOOM_REDIRECT_PORT=53683
```

Configure the Zoom app redirect URL to match `http://localhost:53683/oauth/zoom/callback`, or change the port env var and use that value instead.

Scopes requested:

```txt
user:read:user
meeting:write:meeting
```

WayBetter Calendar creates Zoom meetings with `POST /v2/users/me/meetings`.

### Microsoft Teams

Set:

```sh
WAYBETTER_TEAMS_CLIENT_ID=...
```

Use an Entra app registration that allows public client flows. WayBetter Calendar opens the system browser and receives the callback on `http://localhost:<port>/oauth/teams/callback`. If `WAYBETTER_TEAMS_REDIRECT_PORT` is omitted, the app uses an available dynamic loopback port.

Scopes requested:

```txt
offline_access
User.Read
OnlineMeetings.ReadWrite
```

WayBetter Calendar creates Teams links with Microsoft Graph `POST /me/onlineMeetings`. This is intentionally separate from the Microsoft 365 calendar connection so users can choose Outlook calendar sync without also enabling Teams meeting creation.

## Security Notes

- Tokens stay in the Electron main process.
- Renderer code only calls narrow IPC methods.
- Tokens are stored under Electron `userData` with `safeStorage` encryption when available.
- Meeting URLs are opened with Electron `shell.openExternal`.

## Current Provider Scope

Implemented:

- Connect/disconnect Google calendar accounts
- Connect/disconnect Microsoft 365 calendar accounts
- Connect/disconnect Zoom and Teams video accounts
- List accounts
- List calendars across connected accounts
- Read events across selected calendars
- Create events on provider calendars
- Update/delete provider events through IPC APIs
- Google Meet creation via Google conference data
- Zoom meeting creation via Zoom Meetings API
- Microsoft Teams meeting link creation via Graph online meetings

Still future work:

- UI affordances for editing and deleting existing events
- Apple Calendar via native EventKit bridge
- Generic CalDAV
- Local SQLite cache and background sync
