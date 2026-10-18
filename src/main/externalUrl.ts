import { shell } from 'electron';

export function isExternalWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function openExternalWebUrl(url: string): Promise<void> {
  if (!isExternalWebUrl(url)) throw new Error('Only HTTP and HTTPS links can be opened.');
  await shell.openExternal(url);
}
