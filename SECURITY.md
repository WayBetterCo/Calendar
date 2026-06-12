# Security Policy

## Credentials

Never commit real OAuth credentials, refresh tokens, access tokens, API keys, signing certificates, or private keys.

Use a local `.env` copied from `.env.example`:

```sh
cp .env.example .env
```

The repository `.gitignore` excludes `.env`, `.env.*`, generated builds, dependency folders, and local planning artifacts. If a secret is ever committed, revoke it immediately and rotate the provider app credentials before publishing new history.

## OAuth Data

Provider credentials are read only in the Electron main process. Calendar and video tokens are persisted in the app user data directory and encrypted with Electron `safeStorage` when available.

## Reporting

Please report security issues privately to the maintainers of WayBetterCo before opening a public issue.

## Maintainer Checklist

Before pushing a public release:

```sh
npm run typecheck
npm test
npm run build
git status --ignored --short
```

Also run a secret scan that excludes generated output and dependencies, then inspect the files staged for commit.
