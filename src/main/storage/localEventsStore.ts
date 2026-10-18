import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { CalendarEvent } from '../../shared/calendar';
import { getMockEvents } from '../../shared/mockData';
import { writeJsonStore } from './jsonStore';

function eventsPath(): string {
  return join(app.getPath('userData'), 'local-events.json');
}

export function readLocalEvents(): CalendarEvent[] {
  const path = eventsPath();
  if (!existsSync(path)) {
    // Seed demo data once, then preserve both user edits and its actual dates.
    const events = getMockEvents();
    writeLocalEvents(events);
    return events;
  }
  try {
    const events: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(events) || events.some((event) => !event || typeof event.id !== 'string' || typeof event.calendarId !== 'string')) {
      throw new Error('Invalid local event data.');
    }
    return events as CalendarEvent[];
  } catch {
    throw new Error('Local events could not be read. Your saved file has been preserved.');
  }
}

export function writeLocalEvents(events: CalendarEvent[]): void {
  writeJsonStore(eventsPath(), events);
}
