# Calendar Connections

Provider OAuth and API requests run in the Electron main process. Use Settings to connect accounts, choose visible calendars, or disconnect an account. Local events work without OAuth.

Local credentials belong in an ignored `.env` file. Installed apps also read configuration from their user data directory, which remains `~/Library/Application Support/Dayline` on macOS. Existing `DAYLINE_*` variable names remain compatibility aliases. Public releases package only Google, Microsoft, and Teams client IDs and redirect ports from `resources/release.env` or process environment overrides; they do not read your local `.env` during packaging.

## Google Calendar and Meet

Create an OAuth client with the **Desktop app** application type in Google Cloud. A Web application client requires a confidential server flow and must not be reused as the public desktop client. Enable the Google Calendar API and configure the OAuth consent audience, test users, and any required verification. See [Google's OAuth setup](https://developers.google.com/identity/protocols/oauth2/) and [Desktop app flow](https://developers.google.com/identity/protocols/oauth2/native-app).

```dotenv
WAYBETTER_GOOGLE_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
WAYBETTER_GOOGLE_REDIRECT_PORT=53682
```

The system browser returns to `http://localhost:53682/oauth/google/callback`. Desktop clients support loopback redirects; use the Desktop registration rather than adding this callback to a Web application registration. The app uses PKCE. `WAYBETTER_GOOGLE_CLIENT_SECRET` is an optional compatibility setting for private local development and is never packaged.

Requested scopes are `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, and `https://www.googleapis.com/auth/calendar.events`.

Google Meet creation requires a connected Google Calendar account and a Google calendar for the event. Connecting Google also makes that account available for Meet; there is no separate Meet login.

## Microsoft 365 Calendar

Create an Entra registration with the intended supported account types. Configure Mobile and desktop applications, allow public client flows, and register `http://localhost:53685/oauth/microsoft/callback` for the system browser flow. See [Microsoft's desktop app guidance](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration).

```dotenv
WAYBETTER_MICROSOFT_CLIENT_ID=your-entra-application-client-id
WAYBETTER_MICROSOFT_REDIRECT_PORT=53685
```

Requested scopes are `offline_access`, `User.Read`, and `Calendars.ReadWrite`. Tenant consent policies can require an administrator's approval. No Microsoft client secret is used.

## Microsoft Teams

Teams meeting creation connects separately from Microsoft calendar sync. Configure a public desktop client registration with callback `http://localhost:53684/oauth/teams/callback`:

```dotenv
WAYBETTER_TEAMS_CLIENT_ID=your-entra-application-client-id
WAYBETTER_TEAMS_REDIRECT_PORT=53684
```

Requested scopes are `offline_access`, `User.Read`, and `OnlineMeetings.ReadWrite`. Creating meetings through Microsoft Graph requires an eligible work or school Teams account and the tenant's consent. A personal Microsoft account does not support this delegated online meeting API. See [Microsoft Graph online meeting requirements](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings?view=graph-rest-1.0).

Teams public client defaults are optional and are included in release configuration when supplied. The resulting standalone meeting link is attached to the calendar event.

## Zoom

Zoom support uses your own local OAuth registration and client secret:

```dotenv
WAYBETTER_ZOOM_CLIENT_ID=your-zoom-client-id
WAYBETTER_ZOOM_CLIENT_SECRET=your-own-local-client-secret
WAYBETTER_ZOOM_REDIRECT_PORT=53683
```

Configure the Zoom redirect URL as `http://localhost:53683/oauth/zoom/callback` and enable `user:read:user` and `meeting:write:meeting`. The app creates a standalone meeting through `POST /v2/users/me/meetings`, then attaches its join link to the event.

Zoom secrets are never packaged. Do not add a shared Zoom secret to public builds; distributing Zoom support without local configuration requires a separate server integration.

## Verify a live connection

Automated tests and the packaged smoke test use isolated local data and controlled provider responses. They cannot confirm a provider's registration, consent screen, tenant policy, or live account permissions.

Unknown developer Mac releases use the same provider registrations and consent flows as signed releases. Release signing does not establish a live provider connection.

For each configured provider:

1. Open the installed app and connect the account from Settings through the system browser.
2. Confirm the callback returns successfully and the correct account and calendars appear.
3. Create a disposable event, verify it in the provider's calendar, then edit and delete it from the app.
4. Restart the app and confirm the connection remains usable. Recheck after access-token expiry to exercise refresh.
5. For meeting providers, create a disposable event with a meeting link and confirm the link belongs to the intended account.

If Google returns `redirect_uri_mismatch` or requests a confidential client secret, check the client type and callback configuration. If consent is blocked, check the app's publishing audience and approved test users. If saved credentials cannot be unlocked, unlock the system keychain or reconnect from Settings. Never include tokens or secrets in a bug report.

Apple Calendar and generic CalDAV are not connected providers in this version.
