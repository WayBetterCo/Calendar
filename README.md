# WayBetter Calendar

A compact Electron desktop calendar with local events, Google Calendar and Microsoft 365 sync, and Google Meet, Zoom, and Microsoft Teams meeting links. You can use the local calendar without a provider account.

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

This local build uses an ad hoc signature. Downloadable Mac releases need Developer ID signing and Apple notarization for normal Gatekeeper acceptance.

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

Every packaging command regenerates `resources/.env` through the `beforePack` hook. Only allowlisted public Google, Microsoft, and Teams client IDs and redirect ports are included. Defaults come from `resources/release.env`, with process environment overrides. Your local `.env` and client secrets never enter the release configuration.

## Releases

Validation runs on pull requests, pushes to `main` and `codex/**`, and manual dispatch. It checks the code and launches packaged Mac and Windows apps. The release workflow runs on `v*` tags or manual dispatch; a tag must match `package.json`, for example `v1.1.0`. Manual runs build artifacts; tag runs also create the GitHub release. Release artifacts include the version, platform, architecture, and SHA-256 checksums.

Set these repository secrets for signed, notarized Mac distribution:

- `MAC_CSC_LINK`: Developer ID Application certificate as a supported electron-builder certificate link or base64 value.
- `MAC_CSC_KEY_PASSWORD`: certificate password.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`: Apple notarization credentials.

Optional Windows signing uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. Public provider client IDs and redirect ports can be repository variables named as in `.env.example`; Google, Microsoft, and Teams are supported by the release workflow. Zoom uses your own local credentials only.

Without the Mac signing and notarization configuration, release assets remain in a draft for review. Successful compilation alone does not make an unsigned build ready for public distribution. See [electron-builder's Mac distribution documentation](https://www.electron.build/v26/docs/mac/).

Updates are installed manually from [GitHub Releases](https://github.com/WayBetterCo/Calendar/releases). The app does not automatically download or install updates.

See [SECURITY.md](SECURITY.md) for credential handling and release checks.
