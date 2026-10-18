# WayBetter Calendar

A compact Electron desktop calendar with local events, Google Calendar and Microsoft 365 sync, and Google Meet, Zoom, and Microsoft Teams meeting links. You can use the local calendar without a provider account.

Agenda meeting buttons use the same colored provider logos as Settings. Events with a physical location show a map pin that opens Google Maps; events with both a location and a video link show both actions.

## Run locally

Use Node.js 24 LTS, matching `.nvmrc`:

```sh
nvm install
nvm use
npm ci
npm run dev
```

For your own provider registrations, copy `.env.example` to `.env` if you do not already have one, then fill in the relevant values. Provider accounts connect through Settings. Google requires a **Desktop app** OAuth client; a Web application client is unsuitable for a public desktop release. See [Calendar Connections](CALENDAR_CONNECTIONS.md) for setup and live verification.

## Install on this Mac

Quit any running WayBetter Calendar instance, then run:

```sh
npm run install:local
open "/Applications/WayBetter Calendar.app"
```

The installer checks the project, builds for this Mac's architecture, stages and verifies the app, and then replaces the installation. A failed replacement restores the previous app. Existing accounts, local events, and settings stay in `~/Library/Application Support/Dayline` to preserve compatibility with earlier versions. Local `.env` configuration is copied there only if no configuration already exists.

This local build uses an ad hoc signature. Mac releases can also be published as unknown developer builds without Developer ID signing or Apple notarization. macOS Gatekeeper may warn about or block these downloads.

## Validate and package

```sh
npm run check
npm run package
npm run smoke:packaged
```

`check` runs TypeScript checks and tests. The packaged smoke test launches the actual application with isolated test data and verifies startup and the local event lifecycle. It does not prove Google, Microsoft, Zoom, or Teams consent and token exchange against a live account.

For versioned installers and archives in `dist/`:

```sh
npm run dist:mac       # Intel and Apple silicon Mac
npm run dist:win       # Windows x64, on Windows
npm run dist:linux     # Linux x64, on Linux
```

Every packaging command regenerates `resources/.env` through the `beforePack` hook. Public Google, Microsoft, and Teams client IDs and redirect ports come from `resources/release.env`, with process environment overrides. Local `.env` files and private provider secrets are excluded.

Google Desktop credentials have one explicit exception: some Desktop clients, including the configured WayBetter Desktop client, require the issued `client_secret` during token exchange even with PKCE. Google treats this installed-app value as nonconfidential and permits embedding it. Supply `WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS` in the packaging process environment as JSON shaped like `{"installed":{"client_id":"...","client_secret":"..."}}`. Packaging accepts only the Desktop `installed` form and requires its client ID to match the effective public Google client ID. Generic `WAYBETTER_GOOGLE_CLIENT_SECRET` and Zoom secrets remain excluded. See [Google's installed application guidance](https://developers.google.com/identity/protocols/oauth2/#installed) and [Calendar Connections](CALENDAR_CONNECTIONS.md).

## Releases

Validation runs on pull requests, pushes to `main` and `codex/**`, and manual dispatch. It checks the code and launches packaged Mac and Windows apps. The release workflow runs on `v*` tags or manual dispatch; a tag must match `package.json`, for example `v1.1.0`. Manual runs build artifacts; tag runs also create the GitHub release. Release artifacts include the version, platform, architecture, and SHA-256 checksums.

Optionally set these repository secrets for signed, notarized Mac distribution:

- `MAC_CSC_LINK`: Developer ID Application certificate as a supported electron-builder certificate link or base64 value.
- `MAC_CSC_KEY_PASSWORD`: certificate password.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`: Apple notarization credentials.

Optional Windows signing uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. Public provider client IDs and redirect ports can be repository variables named as in `.env.example`; Google, Microsoft, and Teams are supported by the release workflow. Store the Google Desktop credentials JSON in the `GOOGLE_DESKTOP_OAUTH_JSON` repository secret; the workflow passes it to the packaging environment and requires it for tag releases with a configured Google client ID. Keep this JSON out of git. Zoom uses your own local credentials only.

Tag builds publish a normal latest release even when signing is unconfigured. Release notes identify unsigned Mac artifacts as unknown developer builds without Apple notarization. When Mac signing and notarization credentials are configured, the workflow also verifies the signature, Gatekeeper assessment, and stapled notarization ticket. See [electron-builder's Mac distribution documentation](https://www.electron.build/v26/docs/mac/).

Updates are installed manually from [GitHub Releases](https://github.com/WayBetterCo/Calendar/releases). The app does not automatically download or install updates.

See [SECURITY.md](SECURITY.md) for credential handling and release checks.
