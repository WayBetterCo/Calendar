import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { shell } from 'electron';

type OAuthCodeResult = {
  code: string;
  redirectUri: string;
  codeVerifier: string;
};

type OAuthCodeInput = {
  provider: 'google' | 'microsoft' | 'zoom' | 'teams';
  authorizationUrl: URL;
  scopes: string[];
  port?: number;
  redirectHost?: string;
  timeoutMs?: number;
};

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function createState(): string {
  return base64Url(randomBytes(24));
}

export async function requestOAuthCode(input: OAuthCodeInput): Promise<OAuthCodeResult> {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createState();
  let redirectUri = '';

  return new Promise((resolve, reject) => {
    const server = createServer();
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error(`${input.provider} sign-in timed out.`));
    }, input.timeoutMs ?? 120_000);

    server.on('request', (request, response) => {
      if (!request.url) {
        return;
      }

      const callbackUrl = new URL(request.url, `http://${request.headers.host}`);
      const error = callbackUrl.searchParams.get('error');
      const returnedState = callbackUrl.searchParams.get('state');
      const code = callbackUrl.searchParams.get('code');

      if (error) {
        response.writeHead(400, { 'content-type': 'text/html' });
        response.end('<h1>WayBetter Calendar sign-in failed</h1><p>You can close this window.</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error(`${input.provider} sign-in failed: ${error}`));
        return;
      }

      if (returnedState !== state || !code) {
        response.writeHead(400, { 'content-type': 'text/html' });
        response.end('<h1>WayBetter Calendar sign-in failed</h1><p>Invalid OAuth callback.</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('Invalid OAuth callback state.'));
        return;
      }

      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<h1>WayBetter Calendar connected</h1><p>You can close this window and return to WayBetter Calendar.</p>');
      clearTimeout(timeout);
      server.close();
      resolve({
        code,
        codeVerifier,
        redirectUri,
      });
    });

    const redirectHost = input.redirectHost ?? '127.0.0.1';
    server.listen(input.port ?? 0, redirectHost, async () => {
      const port = addressPort(server.address());
      redirectUri = `http://${redirectHost}:${port}/oauth/${input.provider}/callback`;
      input.authorizationUrl.searchParams.set('redirect_uri', redirectUri);
      input.authorizationUrl.searchParams.set('scope', input.scopes.join(' '));
      input.authorizationUrl.searchParams.set('state', state);
      input.authorizationUrl.searchParams.set('code_challenge', codeChallenge);
      input.authorizationUrl.searchParams.set('code_challenge_method', 'S256');

      try {
        await shell.openExternal(input.authorizationUrl.toString());
      } catch (error) {
        clearTimeout(timeout);
        server.close();
        reject(error);
      }
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function addressPort(address: ReturnType<typeof createServer>['address'] extends () => infer T ? T : never): number {
  if (!address || typeof address === 'string') {
    throw new Error('Could not start local OAuth callback server.');
  }

  return address.port;
}
