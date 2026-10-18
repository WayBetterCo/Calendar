import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const providers = { GOOGLE: 53682, MICROSOFT: 53685, TEAMS: 53684 };

// Only public configuration may cross into a distributable. Local .env files
// intentionally never participate, even when packaging on a developer's Mac.
export function releaseEnvironment(environment, defaults = {}) {
  const entries = [];
  for (const [provider, defaultPort] of Object.entries(providers)) {
    const prefix = `WAYBETTER_${provider}`;
    const clientId = environment[`${prefix}_CLIENT_ID`] || defaults[`${prefix}_CLIENT_ID`];
    const port = environment[`${prefix}_REDIRECT_PORT`] || defaults[`${prefix}_REDIRECT_PORT`] || String(defaultPort);
    if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
      throw new Error(`${prefix}_REDIRECT_PORT must be an integer between 1024 and 65535.`);
    }
    if (clientId) {
      if (/[\r\n\x00]/.test(clientId)) throw new Error(`${prefix}_CLIENT_ID contains invalid characters.`);
      entries.push([`${prefix}_CLIENT_ID`, clientId]);
    }
    entries.push([`${prefix}_REDIRECT_PORT`, port]);
  }
  const desktopJson = environment.WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS;
  if (desktopJson) {
    let credentials;
    try { credentials = JSON.parse(desktopJson); } catch { throw new Error('Google Desktop credentials must be valid installed-app JSON.'); }
    const installed = credentials?.installed;
    if (credentials?.web || !installed || typeof installed.client_id !== 'string' || !installed.client_id.trim() || typeof installed.client_secret !== 'string' || !installed.client_secret.trim()) {
      throw new Error('Only Google installed/Desktop OAuth credentials may be packaged. Web credentials must stay server-side.');
    }
    const configuredId = entries.find(([key]) => key === 'WAYBETTER_GOOGLE_CLIENT_ID')?.[1];
    if (configuredId && installed.client_id !== configuredId) throw new Error('Google Desktop credentials do not match the release client ID.');
    if (/[\r\n\x00]/.test(installed.client_id + installed.client_secret)) throw new Error('Google Desktop credentials contain invalid characters.');
    if (!configuredId) entries.push(['WAYBETTER_GOOGLE_CLIENT_ID', installed.client_id]);
    // Google expressly treats installed-app client secrets as non-confidential
    // app identity, distributable with the client. Never accept Web secrets here.
    entries.push(['WAYBETTER_GOOGLE_CLIENT_SECRET', installed.client_secret]);
  } else if (environment.GITHUB_REF?.startsWith('refs/tags/v') && entries.some(([key]) => key === 'WAYBETTER_GOOGLE_CLIENT_ID')) {
    throw new Error('Google-enabled releases require the GOOGLE_DESKTOP_OAUTH_JSON repository secret.');
  }
  return [
    '# Generated during packaging. Public OAuth app identity only; no account tokens.',
    ...entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    '',
  ].join('\n');
}

export function writeReleaseEnvironment(projectRoot = root, environment = process.env) {
  const defaultsPath = resolve(projectRoot, 'resources/release.env');
  const defaults = existsSync(defaultsPath) ? parse(readFileSync(defaultsPath)) : {};
  const outputPath = resolve(projectRoot, 'resources/.env');
  const content = releaseEnvironment(environment, defaults);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, { mode: 0o644 });
  console.log(`Wrote public release configuration to ${outputPath}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeReleaseEnvironment();
}
