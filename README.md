# WayBetter Calendar

A slim Electron desktop calendar app with Google Calendar, Microsoft 365 Calendar, Google Meet, Zoom, and Microsoft Teams support.

This repository is designed for self-hosting and local builds. You provide your own OAuth app registrations and keep credentials in a local `.env` file that is intentionally ignored by git.

## Quick Start

```sh
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` with your own provider credentials before connecting real accounts. Do not commit `.env` or provider secrets.

## Provider Setup

Calendar providers:

- Google Calendar: `WAYBETTER_GOOGLE_CLIENT_ID`, optional `WAYBETTER_GOOGLE_REDIRECT_PORT`
- Microsoft 365 Calendar: `WAYBETTER_MICROSOFT_CLIENT_ID`, optional `WAYBETTER_MICROSOFT_REDIRECT_PORT`

Video providers:

- Google Meet: available after connecting Google Calendar
- Zoom: `WAYBETTER_ZOOM_CLIENT_ID`, `WAYBETTER_ZOOM_CLIENT_SECRET`, optional `WAYBETTER_ZOOM_REDIRECT_PORT`
- Microsoft Teams: `WAYBETTER_TEAMS_CLIENT_ID`, optional `WAYBETTER_TEAMS_REDIRECT_PORT`

See [CALENDAR_CONNECTIONS.md](CALENDAR_CONNECTIONS.md) for OAuth redirect URLs, scopes, and implementation notes.

## Development

```sh
npm run typecheck
npm test
npm run build
```

Packaging for macOS:

```sh
npm run package
```

Full distributable artifacts:

```sh
npm run dist
```

Release builds read public OAuth defaults from `resources/release.env` and write a generated `resources/.env` during packaging. Keep only public client IDs and redirect ports there; do not package OAuth client secrets into downloadable builds.

## Security

- `.env`, `.env.*`, `dist/`, `out/`, `.next/`, and `node_modules/` are ignored.
- OAuth tokens are stored locally under Electron `userData` and encrypted with Electron `safeStorage` when available.
- The renderer never receives provider secrets or raw tokens; it uses narrow IPC methods exposed by the preload script.
- Run a local secret scan before publishing changes that touch auth, env, or packaging.

See [SECURITY.md](SECURITY.md) for reporting and release hygiene.
