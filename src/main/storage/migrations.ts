export const migrations: string[] = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    connected_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    is_visible INTEGER NOT NULL DEFAULT 1,
    is_primary INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    provider_event_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    video_provider TEXT,
    video_url TEXT,
    video_label TEXT,
    updated_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
];
