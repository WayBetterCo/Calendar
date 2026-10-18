import { existsSync, copyFileSync, chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('Local installation currently supports macOS. Use dist:win or dist:linux on other platforms.');
if (!['arm64', 'x64'].includes(process.arch)) throw new Error(`Unsupported Mac architecture: ${process.arch}`);

const root = fileURLToPath(new URL('..', import.meta.url));
const appName = 'WayBetter Calendar.app';
const installPath = join('/Applications', appName);
const appSupportDir = join(homedir(), 'Library/Application Support/Dayline');
const output = join(root, 'dist/local-install');

run('npm', ['run', 'check']);
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--mac', '--dir', `--${process.arch}`, '--publish', 'never', '--config.mac.identity=-', `--config.directories.output=${output}`]);

const packagedApp = [join(output, `mac-${process.arch}`, appName), join(output, 'mac', appName)].find(existsSync);
if (!packagedApp) throw new Error('Could not find the newly packaged app.');

// Stage and verify the full bundle before replacing an existing installation.
const stage = mkdtempSync('/Applications/.waybetter-calendar-install-');
const stagedApp = join(stage, appName);
const backup = join(stage, 'previous.app');
let previousMoved = false;
try {
  run('/usr/bin/ditto', [packagedApp, stagedApp]);
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', stagedApp]);
  if (existsSync(installPath)) {
    const running = spawnSync('/usr/bin/pgrep', ['-f', `${installPath}/Contents/MacOS/`]);
    if (running.status === 0) throw new Error('Quit WayBetter Calendar before replacing the installed app.');
    renameSync(installPath, backup);
    previousMoved = true;
  }
  renameSync(stagedApp, installPath);
} catch (error) {
  if (previousMoved && !existsSync(installPath)) renameSync(backup, installPath);
  throw error;
} finally {
  rmSync(stage, { recursive: true, force: true });
}

const localEnv = join(root, '.env');
const appSupportEnv = join(appSupportDir, '.env');
if (existsSync(localEnv) && !existsSync(appSupportEnv)) {
  mkdirSync(appSupportDir, { recursive: true, mode: 0o700 });
  copyFileSync(localEnv, appSupportEnv);
  chmodSync(appSupportEnv, 0o600);
  console.log('Installed local provider configuration.');
}
console.log(`Installed ${installPath} (${process.arch}). Existing accounts and settings are preserved.`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.status}`);
}
