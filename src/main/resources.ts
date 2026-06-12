import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export function appIconPath(): string {
  const candidates = [
    join(app.getAppPath(), 'resources', 'waybetter-calendar-icon.png'),
    join(__dirname, '../../resources/waybetter-calendar-icon.png'),
  ];

  return candidates.find((path) => existsSync(path)) ?? candidates[0];
}
