import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const paths = vi.hoisted(() => ({ userData: '', appData: '', appPath: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: (name: 'userData' | 'appData') => paths[name],
    getAppPath: () => paths.appPath,
  },
}));
import { loadAppEnv } from '../../src/main/env';

const testKeys = [
  'WAYBETTER_TEST_ENV_PROFILE', 'WAYBETTER_TEST_ENV_LEGACY', 'WAYBETTER_TEST_ENV_APP_RESOURCE',
  'WAYBETTER_TEST_ENV_RESOURCE', 'WAYBETTER_TEST_ENV_EXECUTABLE', 'WAYBETTER_TEST_ENV_CWD',
  'WAYBETTER_TEST_ENV_EXPLICIT', 'WAYBETTER_TEST_ENV_LEGACY_EXPLICIT', 'WAYBETTER_TEST_ENV_ORDER',
];
let directory: string;
let originalExecPath: PropertyDescriptor | undefined;
let originalResourcesPath: PropertyDescriptor | undefined;
let executableDirectory: string;
let resourcesDirectory: string;
let cwdDirectory: string;

function envFile(path: string, contents: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'waybetter-env-'));
  paths.userData = join(directory, 'profile');
  paths.appData = join(directory, 'app-data');
  paths.appPath = join(directory, 'application');
  executableDirectory = join(directory, 'bin');
  resourcesDirectory = join(directory, 'resources');
  cwdDirectory = join(directory, 'working-directory');
  originalExecPath = Object.getOwnPropertyDescriptor(process, 'execPath');
  originalResourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
  Object.defineProperty(process, 'execPath', { configurable: true, value: join(executableDirectory, 'app') });
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: resourcesDirectory });
  vi.spyOn(process, 'cwd').mockReturnValue(cwdDirectory);
  vi.stubEnv('WAYBETTER_USER_DATA_DIR', undefined);
  vi.stubEnv('WAYBETTER_ENV_FILE', undefined);
  vi.stubEnv('DAYLINE_ENV_FILE', undefined);
  for (const key of testKeys) vi.stubEnv(key, undefined);
  envFile(join(paths.userData, '.env'), 'WAYBETTER_TEST_ENV_PROFILE=profile\nWAYBETTER_TEST_ENV_ORDER=profile');
  envFile(join(paths.appData, 'Dayline', '.env'), 'WAYBETTER_TEST_ENV_LEGACY=legacy');
  envFile(join(paths.appPath, 'resources', '.env'), 'WAYBETTER_TEST_ENV_APP_RESOURCE=application');
  envFile(join(resourcesDirectory, '.env'), 'WAYBETTER_TEST_ENV_RESOURCE=resource');
  envFile(join(executableDirectory, '.env'), 'WAYBETTER_TEST_ENV_EXECUTABLE=executable');
  envFile(join(cwdDirectory, '.env'), 'WAYBETTER_TEST_ENV_CWD=working-directory');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (originalExecPath) Object.defineProperty(process, 'execPath', originalExecPath);
  if (originalResourcesPath) Object.defineProperty(process, 'resourcesPath', originalResourcesPath);
  else Reflect.deleteProperty(process, 'resourcesPath');
  rmSync(directory, { recursive: true, force: true });
});

describe('app environment sources', () => {
  it('isolates an explicit profile from legacy, executable-directory and cwd credentials', () => {
    vi.stubEnv('WAYBETTER_USER_DATA_DIR', paths.userData);
    loadAppEnv();
    expect(process.env.WAYBETTER_TEST_ENV_PROFILE).toBe('profile');
    expect(process.env.WAYBETTER_TEST_ENV_APP_RESOURCE).toBe('application');
    expect(process.env.WAYBETTER_TEST_ENV_RESOURCE).toBe('resource');
    expect(process.env.WAYBETTER_TEST_ENV_LEGACY).toBeUndefined();
    expect(process.env.WAYBETTER_TEST_ENV_EXECUTABLE).toBeUndefined();
    expect(process.env.WAYBETTER_TEST_ENV_CWD).toBeUndefined();
  });

  it('still honors both explicit environment paths inside an isolated profile', () => {
    vi.stubEnv('WAYBETTER_USER_DATA_DIR', paths.userData);
    vi.stubEnv('WAYBETTER_ENV_FILE', envFile(join(directory, 'explicit.env'), 'WAYBETTER_TEST_ENV_EXPLICIT=explicit\nWAYBETTER_TEST_ENV_ORDER=explicit'));
    vi.stubEnv('DAYLINE_ENV_FILE', envFile(join(directory, 'legacy-explicit.env'), 'WAYBETTER_TEST_ENV_LEGACY_EXPLICIT=explicit-legacy\nWAYBETTER_TEST_ENV_ORDER=legacy-explicit'));
    loadAppEnv();
    expect(process.env.WAYBETTER_TEST_ENV_EXPLICIT).toBe('explicit');
    expect(process.env.WAYBETTER_TEST_ENV_LEGACY_EXPLICIT).toBe('explicit-legacy');
    expect(process.env.WAYBETTER_TEST_ENV_ORDER).toBe('explicit');
  });

  it('preserves all original fallback sources for the default profile', () => {
    loadAppEnv();
    expect(process.env.WAYBETTER_TEST_ENV_PROFILE).toBe('profile');
    expect(process.env.WAYBETTER_TEST_ENV_LEGACY).toBe('legacy');
    expect(process.env.WAYBETTER_TEST_ENV_APP_RESOURCE).toBe('application');
    expect(process.env.WAYBETTER_TEST_ENV_RESOURCE).toBe('resource');
    expect(process.env.WAYBETTER_TEST_ENV_EXECUTABLE).toBe('executable');
    expect(process.env.WAYBETTER_TEST_ENV_CWD).toBe('working-directory');
  });

  it('preserves existing process values and source precedence', () => {
    vi.stubEnv('WAYBETTER_TEST_ENV_ORDER', 'process-value');
    vi.stubEnv('WAYBETTER_ENV_FILE', envFile(join(directory, 'explicit.env'), 'WAYBETTER_TEST_ENV_ORDER=explicit'));
    loadAppEnv();
    expect(process.env.WAYBETTER_TEST_ENV_ORDER).toBe('process-value');
  });
});
