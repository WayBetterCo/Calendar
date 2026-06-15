import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import { config as loadDotenv } from 'dotenv';

const legacyStorageName = 'Dayline';

export function loadAppEnv(): void {
  const candidates = [
    process.env.WAYBETTER_ENV_FILE,
    process.env.DAYLINE_ENV_FILE,
    join(app.getPath('userData'), '.env'),
    join(app.getPath('appData'), legacyStorageName, '.env'),
    join(app.getAppPath(), 'resources', '.env'),
    join(process.resourcesPath, '.env'),
    join(dirname(process.execPath), '.env'),
    join(process.cwd(), '.env'),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
    }
  }
}
