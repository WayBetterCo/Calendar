import { createServer, type Server } from 'node:http';
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
  return buffer.toString('base64url');
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
  const redirectHost = input.redirectHost ?? '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(redirectHost)) {
    throw new Error('OAuth callbacks must use a local loopback address.');
  }
  if (input.port !== undefined && (!Number.isInteger(input.port) || input.port < 0 || input.port > 65_535)) {
    throw new Error('OAuth redirect port must be an integer between 0 and 65535.');
  }
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createState();
  const callbackPath = `/oauth/${input.provider}/callback`;
  let redirectUri = '';

  return new Promise((resolve, reject) => {
    const server = createServer();
    let settled = false;
    const finish = (error?: Error, code?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      server.closeIdleConnections();
      if (error) reject(error);
      else resolve({ code: code!, codeVerifier, redirectUri });
    };
    const timeout = setTimeout(() => {
      finish(new Error(`${input.provider} sign-in timed out. Try connecting again in Settings.`));
    }, input.timeoutMs ?? 120_000);

    server.on('request', (request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      let callbackUrl: URL;
      try {
        callbackUrl = new URL(request.url ?? '/', redirectUri);
      } catch {
        response.writeHead(400).end('Invalid callback URL.');
        return;
      }
      if (request.method !== 'GET' || callbackUrl.pathname !== callbackPath) {
        response.writeHead(404).end('Not found.');
        return;
      }
      // Ignore unrelated traffic and invalid state instead of cancelling a real sign-in.
      if (callbackUrl.searchParams.get('state') !== state) {
        response.writeHead(400).end('Invalid OAuth callback state.');
        return;
      }
      const error = callbackUrl.searchParams.get('error');
      const code = callbackUrl.searchParams.get('code');
      if (error) {
        response.writeHead(400).end('<h1>WayBetter Calendar sign-in failed</h1><p>You can close this window.</p>');
        finish(new Error(`${input.provider} sign-in failed: ${error}`));
        return;
      }
      if (!code) {
        response.writeHead(400).end('OAuth callback is missing a code.');
        return;
      }
      response.writeHead(200).end('<h1>WayBetter Calendar connected</h1><p>You can close this window and return to WayBetter Calendar.</p>');
      finish(undefined, code);
    });

    server.on('error', (error) => finish(error));
    server.listen(input.port ?? 0, redirectHost, async () => {
      const host = redirectHost === '::1' ? '[::1]' : redirectHost;
      redirectUri = `http://${host}:${addressPort(server)}${callbackPath}`;
      const authorizationUrl = new URL(input.authorizationUrl);
      authorizationUrl.searchParams.set('redirect_uri', redirectUri);
      authorizationUrl.searchParams.set('scope', input.scopes.join(' '));
      authorizationUrl.searchParams.set('state', state);
      authorizationUrl.searchParams.set('code_challenge', codeChallenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');
      try {
        await shell.openExternal(authorizationUrl.toString());
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Could not open the sign-in page.'));
      }
    });
  });
}

function addressPort(server: Server): number {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start local OAuth callback server.');
  }
  return address.port;
}
