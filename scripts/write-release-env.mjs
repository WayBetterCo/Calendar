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
  return [
    '# Generated during packaging. Public OAuth configuration only.',
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
