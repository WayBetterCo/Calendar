import type { ProviderTokens } from '../storage/credentialStore';

const pendingRefreshes = new Map<string, Promise<ProviderTokens>>();

/** Share refreshes across concurrent calendar requests, especially rotating refresh tokens. */
export async function freshTokens(input: {
  key: string;
  label: string;
  read: () => ProviderTokens | null;
  save: (tokens: ProviderTokens) => void;
  refresh: (tokens: ProviderTokens & { refreshToken: string }) => Promise<ProviderTokens>;
}): Promise<ProviderTokens> {
  const tokens = input.read();
  if (!tokens) {
    throw new Error(`${input.label} account is not connected. Reconnect it in Settings.`);
  }
  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return tokens;
  }
  const pending = pendingRefreshes.get(input.key);
  if (pending) {
    return pending;
  }
  if (!tokens.refreshToken) {
    throw new Error(`${input.label} sign-in has expired. Reconnect the account in Settings.`);
  }

  const refresh = (async () => {
    const nextTokens = await input.refresh({ ...tokens, refreshToken: tokens.refreshToken! });
    // A disconnect or a new sign-in while refreshing must not revive old credentials.
    const current = input.read();
    if (!current) {
      throw new Error(`${input.label} account was disconnected.`);
    }
    if (current.accessToken !== tokens.accessToken) {
      return current;
    }
    input.save(nextTokens);
    return nextTokens;
  })();
  pendingRefreshes.set(input.key, refresh);
  try {
    return await refresh;
  } finally {
    if (pendingRefreshes.get(input.key) === refresh) {
      pendingRefreshes.delete(input.key);
    }
  }
}
