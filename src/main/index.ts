import { join } from 'node:path';
import { BrowserWindow, app, nativeImage, nativeTheme, session } from 'electron';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { appIconPath } from './resources';
import { installApplicationMenu } from './menu';
import { loadAppEnv } from './env';

const APP_NAME = 'WayBetter Calendar';
const LEGACY_STORAGE_NAME = 'Dayline';

// Preserve existing local settings and OAuth token files after the public rename.
app.setPath('userData', join(app.getPath('appData'), LEGACY_STORAGE_NAME));
// safeStorage can depend on the runtime app name, so keep the legacy encryption identity.
app.setName(LEGACY_STORAGE_NAME);
loadAppEnv();
nativeTheme.themeSource = 'system';

registerIpcHandlers();

app.whenReady().then(() => {
  const icon = nativeImage.createFromPath(appIconPath());
  app.setAboutPanelOptions({ applicationName: APP_NAME });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation');
  });
  installApplicationMenu();
  if (process.platform === 'darwin' && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  createMainWindow();

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    for (const window of BrowserWindow.getAllWindows()) {
      window.setBackgroundColor(theme === 'dark' ? '#272822' : '#f8f8f9');
      window.webContents.send('theme:changed', theme);
    }
  });

  app.on('activate', () => {
    if (process.platform === 'darwin' && BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
