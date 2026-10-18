import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonStore } from './jsonStore';
import { app, safeStorage } from 'electron';
import type { CalendarAccount, CalendarProvider, CreatableVideoProvider, VideoAccount } from '../../shared/calendar';

export type ProviderTokens = {
  provider: Extract<CalendarProvider, 'google' | 'microsoft'> | 'zoom' | 'teams';
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
};

type StoredAccount = {
  account: CalendarAccount;
  encryptedTokens: string;
};

type StoredVideoAccount = {
  account: VideoAccount;
  encryptedTokens: string;
};

function credentialsPath(): string {
  return join(app.getPath('userData'), 'calendar-accounts.json');
}

function videoCredentialsPath(): string {
  return join(app.getPath('userData'), 'video-accounts.json');
}

function encryptTokens(tokens: ProviderTokens): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `encrypted:${safeStorage.encryptString(JSON.stringify(tokens)).toString('base64')}`;
  }

  throw new Error('Secure credential storage is unavailable. Unlock your system keychain and try connecting again.');
}

function decryptTokens(encryptedTokens: string): ProviderTokens {
  const encoded = encryptedTokens.replace(/^encrypted:/, '');
  const buffer = Buffer.from(encoded, 'base64');
  // Legacy versions stored unmarked base64 JSON when the keychain was unavailable.
  if (!encryptedTokens.startsWith('encrypted:')) {
    try {
      const legacy = JSON.parse(buffer.toString('utf8')) as ProviderTokens;
      if (legacy.accessToken && legacy.provider) return legacy;
    } catch { /* Continue with legacy encrypted storage. */ }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Saved accounts require access to your system keychain. Unlock it and try again.');
  }
  try {
    return JSON.parse(safeStorage.decryptString(buffer)) as ProviderTokens;
  } catch {
    throw new Error('Saved credentials could not be unlocked. Reconnect the account in Settings.');
  }
}

function readRecords(): StoredAccount[] {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return [];
  }

  try {
    const records: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(records) || records.some((record) => !record?.account?.id || typeof record.encryptedTokens !== 'string')) throw new Error('Invalid account data.');
    return records as StoredAccount[];
  } catch {
    throw new Error('Saved calendar accounts could not be read. Your account file has been preserved.');
  }
}

function readVideoRecords(): StoredVideoAccount[] {
  const path = videoCredentialsPath();
  if (!existsSync(path)) {
    return [];
  }

  try {
    const records: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(records) || records.some((record) => !record?.account?.id || typeof record.encryptedTokens !== 'string')) throw new Error('Invalid account data.');
    return records as StoredVideoAccount[];
  } catch {
    throw new Error('Saved video accounts could not be read. Your account file has been preserved.');
  }
}

function writeRecords(records: StoredAccount[]): void {
  const path = credentialsPath();
  writeJsonStore(path, records);
}

function writeVideoRecords(records: StoredVideoAccount[]): void {
  const path = videoCredentialsPath();
  writeJsonStore(path, records);
}

export function listAccounts(): CalendarAccount[] {
  return readRecords().map((record) => record.account);
}

export function getAccount(accountId: string): CalendarAccount | null {
  return readRecords().find((record) => record.account.id === accountId)?.account ?? null;
}

export function getAccountsByProvider(provider: CalendarProvider): CalendarAccount[] {
  return listAccounts().filter((account) => account.provider === provider);
}

export function saveAccount(account: CalendarAccount, tokens: ProviderTokens): void {
  const records = readRecords().filter((record) => record.account.id !== account.id);
  records.push({ account, encryptedTokens: encryptTokens(tokens) });
  writeRecords(records);
}

export function removeAccount(accountId: string): void {
  writeRecords(readRecords().filter((record) => record.account.id !== accountId));
}

export function getTokens(accountId: string): ProviderTokens | null {
  const record = readRecords().find((item) => item.account.id === accountId);

  if (!record) {
    return null;
  }

  const tokens = decryptTokens(record.encryptedTokens);
  if (!record.encryptedTokens.startsWith('encrypted:') && safeStorage.isEncryptionAvailable()) saveTokens(accountId, tokens);
  return tokens;
}

export function saveTokens(accountId: string, tokens: ProviderTokens): void {
  const records = readRecords();
  const next = records.map((record) =>
    record.account.id === accountId ? { ...record, encryptedTokens: encryptTokens(tokens) } : record,
  );
  writeRecords(next);
}

export function listVideoAccounts(): VideoAccount[] {
  return readVideoRecords().map((record) => record.account);
}

export function getVideoAccountsByProvider(provider: CreatableVideoProvider): VideoAccount[] {
  return listVideoAccounts().filter((account) => account.provider === provider);
}

export function saveVideoAccount(account: VideoAccount, tokens: ProviderTokens): void {
  const records = readVideoRecords().filter((record) => record.account.id !== account.id);
  records.push({ account, encryptedTokens: encryptTokens(tokens) });
  writeVideoRecords(records);
}

export function removeVideoAccount(accountId: string): void {
  writeVideoRecords(readVideoRecords().filter((record) => record.account.id !== accountId));
}

export function getVideoTokens(accountId: string): ProviderTokens | null {
  const record = readVideoRecords().find((item) => item.account.id === accountId);
  if (!record) return null;
  const tokens = decryptTokens(record.encryptedTokens);
  if (!record.encryptedTokens.startsWith('encrypted:') && safeStorage.isEncryptionAvailable()) saveVideoTokens(accountId, tokens);
  return tokens;
}

export function saveVideoTokens(accountId: string, tokens: ProviderTokens): void {
  const records = readVideoRecords();
  writeVideoRecords(
    records.map((record) => (record.account.id === accountId ? { ...record, encryptedTokens: encryptTokens(tokens) } : record)),
  );
}
