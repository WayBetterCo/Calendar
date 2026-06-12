import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const appName = 'WayBetter Calendar';
const electronDist = join(root, 'node_modules/electron/dist');
const electronModulePath = join(root, 'node_modules/electron/path.txt');
const electronApp = join(electronDist, 'Electron.app');
const staleDaylineApp = join(electronDist, 'Dayline.app');
const plist = join(electronApp, 'Contents/Info.plist');
const appIcon = join(root, 'resources/waybetter-calendar-icon.icns');
const bundleIcon = join(electronApp, 'Contents/Resources/waybetter-calendar.icns');

prepareDevElectron();

const electronVite = join(root, 'node_modules/electron-vite/bin/electron-vite.js');
const child = spawn(process.execPath, [electronVite, 'dev', ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function prepareDevElectron() {
  if (process.platform !== 'darwin') {
    return;
  }

  if (!existsSync(electronApp)) {
    return;
  }

  rmSync(staleDaylineApp, { force: true, recursive: true });

  setPlistValue('CFBundleName', appName);
  setPlistValue('CFBundleDisplayName', appName);
  setPlistValue('CFBundleExecutable', 'Electron');
  setPlistValue('CFBundleIdentifier', 'ai.dayline.app.dev');
  setPlistValue('CFBundleIconFile', 'waybetter-calendar.icns');

  if (existsSync(appIcon) && existsSync(electronApp)) {
    cpSync(appIcon, bundleIcon);
  }

  writeFileSync(electronModulePath, 'Electron.app/Contents/MacOS/Electron', 'utf8');
  spawnSync('/usr/bin/touch', [electronApp], { stdio: 'ignore' });
  spawnSync(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-f', electronApp],
    { stdio: 'ignore' },
  );
}

function setPlistValue(key, value) {
  if (!existsSync(plist)) {
    return;
  }

  const set = spawnSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'ignore' });
  if (set.status === 0) {
    return;
  }

  spawnSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist], { stdio: 'ignore' });
}
