import { existsSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const appName = 'WayBetter Calendar.app';
const installPath = join('/Applications', appName);
const localEnv = join(root, '.env');
const appSupportDir = join(homedir(), 'Library/Application Support/Dayline');
const appSupportEnv = join(appSupportDir, '.env');

run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--mac', '--dir']);

const packagedApp = findPackagedApp();
if (!packagedApp) {
  throw new Error('Could not find the packaged WayBetter Calendar.app in dist/.');
}

rmSync(installPath, { recursive: true, force: true });
run('/usr/bin/ditto', [packagedApp, installPath]);

if (existsSync(localEnv)) {
  mkdirSync(appSupportDir, { recursive: true });
  cpSync(localEnv, appSupportEnv);
  console.log(`Copied local .env to ${appSupportEnv}`);
}

console.log(`Installed ${installPath}`);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
}

function findPackagedApp() {
  const candidates = [
    join(root, 'dist/mac-arm64', appName),
    join(root, 'dist/mac-x64', appName),
    join(root, 'dist/mac', appName),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
