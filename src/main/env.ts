import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import { config as loadDotenv } from 'dotenv';

const legacyStorageName = 'Dayline';

export function loadAppEnv(): void {
  // An explicit profile must not inherit credentials from the developer or legacy profile.
  const isolatedProfile = Boolean(process.env.WAYBETTER_USER_DATA_DIR);
  const candidates = [
    process.env.WAYBETTER_ENV_FILE,
    process.env.DAYLINE_ENV_FILE,
    join(app.getPath('userData'), '.env'),
    ...(!isolatedProfile ? [join(app.getPath('appData'), legacyStorageName, '.env')] : []),
    join(app.getAppPath(), 'resources', '.env'),
    join(process.resourcesPath, '.env'),
    ...(!isolatedProfile ? [join(dirname(process.execPath), '.env'), join(process.cwd(), '.env')] : []),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, quiet: true });
    }
  }
}
