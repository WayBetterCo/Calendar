import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import beforePack from './before-pack.cjs';
afterEach(() => vi.unstubAllEnvs());
it('treats blank Actions signing secrets as absent before electron-builder reads them', async () => {
  for (const key of ['CSC_LINK', 'WIN_CSC_LINK', 'CSC_NAME', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) vi.stubEnv(key, '');
  const root = mkdtempSync(join(tmpdir(), 'waybetter-pack-'));
  try {
    const options = {};
    await beforePack({ electronPlatformName: 'darwin', packager: { projectDir: root, platformSpecificBuildOptions: options } });
    expect(process.env.CSC_LINK).toBeUndefined();
    expect(process.env.WIN_CSC_LINK).toBeUndefined();
    expect(options).toEqual({ identity: '-', hardenedRuntime: false });
    vi.stubEnv('CSC_LINK', 'developer-certificate.p12');
    const signedOptions = { hardenedRuntime: true };
    await beforePack({ electronPlatformName: 'darwin', packager: { projectDir: root, platformSpecificBuildOptions: signedOptions } });
    expect(process.env.CSC_LINK).toBe('developer-certificate.p12');
    expect(signedOptions).toEqual({ hardenedRuntime: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
