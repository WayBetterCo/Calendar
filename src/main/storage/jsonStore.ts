import { chmodSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Replace stores atomically so interrupted writes cannot truncate saved accounts or events. */
export function writeJsonStore(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
    renameSync(temporaryPath, path);
    chmodSync(path, 0o600);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
