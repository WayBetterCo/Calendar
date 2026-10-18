import { app, BrowserWindow } from 'electron';
import type { AppSettings } from '../../shared/calendar';

export function applySystemSettings(settings: AppSettings, updateLoginItem = false): void {
  if (updateLoginItem && app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32')) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }
  for (const window of BrowserWindow.getAllWindows()) {
    window.setAlwaysOnTop(settings.keepWindowOnTop);
  }
}
