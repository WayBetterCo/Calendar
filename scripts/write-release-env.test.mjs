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
  it('packages explicitly supplied Desktop app identity only when client IDs match', () => {
    const identity = { installed: { client_id: 'desktop', client_secret: 'public-desktop-value' } };
    const values = parse(releaseEnvironment({ WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS: JSON.stringify(identity), GITHUB_REF: 'refs/tags/v1.1.1' }, { WAYBETTER_GOOGLE_CLIENT_ID: 'desktop' }));
    expect(values.WAYBETTER_GOOGLE_CLIENT_ID).toBe('desktop');
    expect(values.WAYBETTER_GOOGLE_CLIENT_SECRET).toBe('public-desktop-value');
    expect(() => releaseEnvironment({ WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS: JSON.stringify(identity) }, { WAYBETTER_GOOGLE_CLIENT_ID: 'different' })).toThrow(/do not match/);
    expect(parse(releaseEnvironment({ WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS: JSON.stringify(identity) })).WAYBETTER_GOOGLE_CLIENT_ID).toBe('desktop');
  });
  it('rejects Web, malformed, empty and injectable Desktop credentials', () => {
    const invalid = ['not-json', 'null', '{}', JSON.stringify({ web: { client_id: 'web', client_secret: 'private' } }), JSON.stringify({ installed: { client_id: '', client_secret: 'value' } }), JSON.stringify({ installed: { client_id: 'desktop', client_secret: '' } }), JSON.stringify({ installed: { client_id: 'desktop', client_secret: 'value\nINJECTED=true' } })];
    for (const credentials of invalid) expect(() => releaseEnvironment({ WAYBETTER_GOOGLE_DESKTOP_CREDENTIALS: credentials })).toThrow();
  });
  it('prevents Google-enabled tag releases from silently shipping broken sign-in', () => {
    expect(() => releaseEnvironment({ GITHUB_REF: 'refs/tags/v1.1.1' }, { WAYBETTER_GOOGLE_CLIENT_ID: 'desktop' })).toThrow(/GOOGLE_DESKTOP_OAUTH_JSON/);
    expect(() => releaseEnvironment({ GITHUB_REF: 'refs/heads/main' }, { WAYBETTER_GOOGLE_CLIENT_ID: 'desktop' })).not.toThrow();
  });
});
