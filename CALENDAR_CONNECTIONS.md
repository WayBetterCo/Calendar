# Calendar Connections

Provider OAuth and API requests run in the Electron main process. Use Settings to connect accounts, choose visible calendars, or disconnect an account. Local events work without OAuth.

Local credentials belong in an ignored `.env` file. Installed apps also read configuration from their user data directory, which remains `~/Library/Application Support/Dayline` on macOS. Existing `DAYLINE_*` variable names remain compatibility aliases. Public releases package Google, Microsoft, and Teams client IDs and redirect ports from `resources/release.env` or process environment overrides, plus explicitly supplied Google Desktop credentials as described below. Packaging never reads local `.env` files.

An explicit `WAYBETTER_USER_DATA_DIR` isolates that profile from legacy, executable-directory, and working-directory environment files. It reads its own `.env`, packaged configuration, and any explicit `WAYBETTER_ENV_FILE` or `DAYLINE_ENV_FILE` paths.

## Google Calendar and Meet

Create an OAuth client with the **Desktop app** application type in Google Cloud. A Web application client requires a confidential server flow and must not be reused as the public desktop client. Enable the Google Calendar API and configure the OAuth consent audience, test users, and any required verification. See [Google's OAuth setup](https://developers.google.com/identity/protocols/oauth2/) and [Desktop app flow](https://developers.google.com/identity/protocols/oauth2/native-app).

```dotenv
WAYBETTER_GOOGLE_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
WAYBETTER_GOOGLE_REDIRECT_PORT=53682
```

The system browser returns to `http://localhost:53682/oauth/google/callback`. Desktop clients support loopback redirects; use the Desktop registration rather than adding this callback to a Web application registration. The app uses PKCE. Some Desktop clients, including the configured WayBetter Desktop client, also require their issued `client_secret` for code exchange and refresh. Google explicitly treats installed-app client secrets as nonconfidential and permits embedding them. See [Google's installed application guidance](https://developers.google.com/identity/protocols/oauth2/#installed).

For distributable builds, provide the Google Cloud Desktop credentials JSON in the packaging process environment:

```sh
export WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS='{"installed":{"client_id":"your-desktop-client-id.apps.googleusercontent.com","client_secret":"your-desktop-client-value"}}'
npm run package
```

Packaging accepts the `installed` Desktop form only, rejects a Web application credential object, and requires the JSON client ID to match the effective `WAYBETTER_GOOGLE_CLIENT_ID`. It copies only the validated Desktop credential fields. In GitHub Actions, store this JSON as the `GOOGLE_DESKTOP_OAUTH_JSON` repository secret; tag releases with a configured Google client ID require it. Do not commit the JSON or place it in `resources/release.env`.

`WAYBETTER_GOOGLE_CLIENT_SECRET` remains a local runtime compatibility setting and is never copied from a developer's environment into a release. A local installed build can read it from the existing app support `.env`; a clean distributable needs the explicit Desktop JSON during packaging. This exception does not apply to confidential Web application credentials, Zoom secrets, access tokens, or refresh tokens.

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

If Google returns `redirect_uri_mismatch`, check the Desktop client type and callback configuration. If it reports `client_secret is missing`, verify the matching Desktop JSON was supplied when packaging, or the local installed app has its runtime configuration. If consent is blocked, check the app's publishing audience, verification status, and approved test users. Moving the audience to Production does not remove warnings or limits that apply to an unverified app. If saved credentials cannot be unlocked, unlock the system keychain or reconnect from Settings. Never include tokens or credentials in a bug report.

Apple Calendar and generic CalDAV are not connected providers in this version.
