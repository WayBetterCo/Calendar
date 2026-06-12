import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import type { AppSettings } from '../../shared/calendar';
import { mockSettings } from '../../shared/mockData';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function readSettings(): AppSettings {
  const path = settingsPath();

  if (!existsSync(path)) {
    return mockSettings;
  }

  try {
    return { ...mockSettings, ...JSON.parse(readFileSync(path, 'utf8')) };
  } catch {
    return mockSettings;
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch };
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2));
  return next;
}
