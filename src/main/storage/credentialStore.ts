import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
    return safeStorage.encryptString(JSON.stringify(tokens)).toString('base64');
  }

  return Buffer.from(JSON.stringify(tokens), 'utf8').toString('base64');
}

function decryptTokens(encryptedTokens: string): ProviderTokens {
  const buffer = Buffer.from(encryptedTokens, 'base64');

  if (safeStorage.isEncryptionAvailable()) {
    return JSON.parse(safeStorage.decryptString(buffer)) as ProviderTokens;
  }

  return JSON.parse(buffer.toString('utf8')) as ProviderTokens;
}

function readRecords(): StoredAccount[] {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as StoredAccount[];
  } catch {
    return [];
  }
}

function readVideoRecords(): StoredVideoAccount[] {
  const path = videoCredentialsPath();
  if (!existsSync(path)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as StoredVideoAccount[];
  } catch {
    return [];
  }
}

function writeRecords(records: StoredAccount[]): void {
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(records, null, 2));
}

function writeVideoRecords(records: StoredVideoAccount[]): void {
  const path = videoCredentialsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(records, null, 2));
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

  return decryptTokens(record.encryptedTokens);
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
  return record ? decryptTokens(record.encryptedTokens) : null;
}

export function saveVideoTokens(accountId: string, tokens: ProviderTokens): void {
  const records = readVideoRecords();
  writeVideoRecords(
    records.map((record) => (record.account.id === accountId ? { ...record, encryptedTokens: encryptTokens(tokens) } : record)),
  );
}
