import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonStore } from '../storage/jsonStore';
import { app } from 'electron';
import type { AppSettings } from '../../shared/calendar';
import { mockSettings } from '../../shared/mockData';
import { settingsPatchSchema } from '../validation';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function readSettings(): AppSettings {
  const path = settingsPath();

  if (!existsSync(path)) {
    return structuredClone(mockSettings);
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const valid = settingsPatchSchema.safeParse(parsed);
    return { ...structuredClone(mockSettings), ...(valid.success ? valid.data : {}) };
  } catch {
    return structuredClone(mockSettings);
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch };
  const path = settingsPath();
  writeJsonStore(path, next);
  return next;
}
