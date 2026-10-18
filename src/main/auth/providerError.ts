/** Provider errors should tell the user whether retrying or reconnecting can help. */
export async function providerError(response: Response, label: string, oauth = false): Promise<Error> {
  let code = '';
  let detail = '';
  try {
    const body = await response.json() as { error?: string | { code?: string; message?: string }; error_description?: string; message?: string };
    code = typeof body.error === 'string' ? body.error : body.error?.code ?? '';
    detail = body.error_description ?? (typeof body.error === 'object' ? body.error.message : body.message) ?? '';
  } catch { /* Non-JSON gateway errors still get a useful status. */ }
  if (response.status === 401 || code === 'invalid_grant') {
    return new Error(`${label} sign-in has expired or was revoked. Reconnect the account in Settings.`);
  }
  if (response.status === 403) {
    return new Error(`${label} denied access. Check the account's calendar or meeting permissions and reconnect in Settings.${detail ? ` ${detail}` : ''}`);
  }
  return new Error(`${label} ${oauth ? 'sign-in' : 'request'} failed with ${response.status}.${detail ? ` ${detail}` : ''}`);
}
