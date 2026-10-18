import { describe, expect, it } from 'vitest';
import { parse } from 'dotenv';
import { releaseEnvironment } from './write-release-env.mjs';

describe('packaged OAuth environment', () => {
  it('ships public provider defaults and overrides while excluding secrets', () => {
    const content = releaseEnvironment({ WAYBETTER_GOOGLE_CLIENT_ID: 'override', WAYBETTER_GOOGLE_CLIENT_SECRET: 'must-not-ship', WAYBETTER_TEAMS_CLIENT_ID: 'teams', WAYBETTER_ZOOM_CLIENT_SECRET: 'private' }, { WAYBETTER_GOOGLE_CLIENT_ID: 'default', WAYBETTER_MICROSOFT_CLIENT_ID: 'microsoft' });
    expect(parse(content)).toMatchObject({ WAYBETTER_GOOGLE_CLIENT_ID: 'override', WAYBETTER_MICROSOFT_CLIENT_ID: 'microsoft', WAYBETTER_TEAMS_CLIENT_ID: 'teams', WAYBETTER_GOOGLE_REDIRECT_PORT: '53682' });
    expect(content).not.toMatch(/SECRET|must-not-ship|private/);
  });
  it('rejects config injection and unusable callback ports', () => {
    expect(() => releaseEnvironment({ WAYBETTER_GOOGLE_CLIENT_ID: 'client\nINJECTED=true' })).toThrow();
    for (const port of ['abc', '-1', '65536', '80']) expect(() => releaseEnvironment({ WAYBETTER_GOOGLE_REDIRECT_PORT: port })).toThrow();
  });
});
