const URI_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const URL_SCHEMES = new Set(['http', 'https', 'javascript', 'vbscript', 'data', 'file', 'mailto', 'tel', 'sms', 'ftp', 'ftps', 'sftp', 'ssh', 'about', 'blob', 'chrome', 'ws', 'wss', 'zoommtg', 'msteams', 'ms-teams', 'sip', 'sips', 'facetime']);
const BARE_URL = /^(?:\/\/|(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)|localhost(?::\d+)?(?:[/?#]|$)|\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:[/?#]|$))/i;
const INVALID_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const VIRTUAL_OR_PLACEHOLDER = /^(?:(?:online|remote|virtual)(?: meeting)?|(?:zoom|google meet|(?:microsoft )?teams|(?:cisco )?webex)(?: meeting)?|tbd|tba|tbc|n\/a)$/i;

export function getGoogleMapsUrl(location?: string): string | null {
  const value = location?.trim();
  if (!value || INVALID_CONTROL.test(value) || VIRTUAL_OR_PLACEHOLDER.test(value.replace(/\s+/g, ' '))) return null;

  const label = value.match(/^([a-z][a-z\d+.-]*):\s+/i);
  const isTextLabel = Boolean(label && !URL_SCHEMES.has(label[1].toLowerCase()));

  let url: URL | undefined;
  if (!isTextLabel) {
    try {
      url = new URL(value);
    } catch {
      // Plain room names and addresses are searched below.
    }
  }

  if (url) {
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;

    const mapsPath = url.pathname === '/maps' || url.pathname.startsWith('/maps/');
    const isMapsUrl =
      (['google.com', 'www.google.com', 'google.ca', 'www.google.ca'].includes(url.hostname) && mapsPath) ||
      ['maps.google.com', 'maps.google.ca', 'maps.app.goo.gl'].includes(url.hostname) ||
      (url.hostname === 'goo.gl' && mapsPath);

    return isMapsUrl ? url.href : null;
  }

  const urlCandidate = value.replace(/[\t\r\n]/g, '');
  if ((!isTextLabel && URI_SCHEME.test(urlCandidate)) || BARE_URL.test(urlCandidate)) return null;

  const query = new URLSearchParams({ api: '1', query: value });
  return `https://www.google.com/maps/search/?${query.toString()}`;
}
