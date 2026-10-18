import { format, isValid, parseISO } from 'date-fns';
import { z } from 'zod';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types/calendar';
import { toDateKey } from './dates';

export const createEventFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) && format(parseISO(value), 'yyyy-MM-dd') === value, 'Choose a valid date'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid start time'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid end time'),
  calendarId: z.string().min(1, 'Choose a calendar'),
  addVideoCall: z.boolean(),
  videoProvider: z.enum(['google_meet', 'zoom', 'teams']).optional(),
  location: z.string(),
  notes: z.string(),
});

export function preservesEventTiming(event: CalendarEvent): boolean {
  return event.isAllDay || toDateKey(event.startsAt) !== toDateKey(event.endsAt);
}

export function updateEventPayload(event: CalendarEvent, input: CreateEventInput): UpdateEventInput {
  const { addVideoCall: _addVideoCall, videoProvider: _videoProvider, ...details } = input;
  const payload: UpdateEventInput = { ...details, id: event.id, calendarId: event.calendarId };
  if (preservesEventTiming(event)) {
    delete payload.date;
    delete payload.startTime;
    delete payload.endTime;
  }
  return payload;
}
