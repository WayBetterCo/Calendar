# Security Policy

## Credentials and local data

Never commit OAuth client secrets, access or refresh tokens, API keys, signing certificates, certificate passwords, or private keys. Public OAuth client IDs and redirect ports may be committed in `resources/release.env`. Use an ignored local `.env` for private provider configuration and repository secrets for release signing.

Provider authentication and tokens stay in the Electron main process. New token writes require Electron `safeStorage` encryption; the app reports a keychain error instead of falling back to plaintext. Older unmarked token records remain readable for compatibility. JSON stores are replaced atomically and written with owner-only permissions. On macOS, accounts, settings, local events, and private configuration remain under `~/Library/Application Support/Dayline` across reinstallations.

The renderer uses a limited preload API. External links are validated before opening in the system browser. Treat calendar content and provider responses as untrusted input.

## Release configuration

The packaging hook regenerates `resources/.env` using an allowlist of public Google, Microsoft, and Teams client IDs and redirect ports. Local `.env` files do not participate. Packaging includes only the selected application files and icons, not the entire resources directory. Zoom requires local private configuration and is excluded from generated release configuration.

Mac public distribution requires Developer ID signing and notarization. The workflow reads `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` from repository secrets. Optional Windows signing uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. When Mac signing is unconfigured, tag builds create draft releases. Signed Mac builds must pass signature, Gatekeeper, and stapled notarization checks.

Before releasing:

```sh
npm ci
npm run check
npm run package
npm run smoke:packaged
npm audit
git diff --check
git status --ignored --short
```

Use Node.js 24 LTS. Inspect staged changes and packaged configuration for secrets. Review dependency findings in context: Electron is a development dependency in npm but becomes the shipped runtime, so `npm audit --omit=dev` alone is insufficient. Do not force dependency downgrades merely to clear an audit report.

Release workflows validate version tags, exercise packaged startup and local event operations, and generate SHA-256 checksums. Live OAuth consent, provider permissions, token refresh, and meeting creation still require verification with authorized accounts as described in [Calendar Connections](CALENDAR_CONNECTIONS.md).

If a secret is exposed, revoke or rotate it immediately and remove it from published artifacts and repository history as appropriate.

## Reporting

Report security issues privately to the WayBetterCo maintainers before opening a public issue. Include reproducible steps and affected versions, with credentials and personal calendar data removed.
