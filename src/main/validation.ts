import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid calendar date.');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.');
const eventFields = z.object({
  title: z.string().trim().min(1).max(1000),
  date,
  startTime: time,
  endTime: time,
  calendarId: z.string().min(1),
  addVideoCall: z.boolean(),
  videoProvider: z.enum(['google_meet', 'zoom', 'teams']).optional(),
  guests: z.array(z.email()).max(500),
  location: z.string().max(5000).optional(),
  notes: z.string().max(100000).optional(),
});
const validTimes = (input: { startTime?: string; endTime?: string }) => !input.startTime || !input.endTime || input.endTime > input.startTime;
export const createEventSchema = eventFields.extend({ guests: eventFields.shape.guests.default([]) }).refine(validTimes, { message: 'End time must be after start time on the same day.', path: ['endTime'] });
export const updateEventSchema = eventFields.partial().extend({ id: z.string().min(1), calendarId: z.string().min(1) }).refine(validTimes, { message: 'End time must be after start time on the same day.', path: ['endTime'] }).refine((input) => {
  const fields = [input.date, input.startTime, input.endTime];
  return fields.every(value => value === undefined) || fields.every(value => value !== undefined);
}, 'Provide date, start time and end time together.');
export const listEventsSchema = z.object({
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  calendarIds: z.array(z.string()).optional(),
  search: z.string().optional(),
}).refine((input) => Date.parse(input.endsAt) > Date.parse(input.startsAt), 'The end of the date range must follow its start.');
export const settingsPatchSchema = z.object({
  defaultCalendarId: z.string().optional(),
  defaultDurationMinutes: z.number().int().min(15).max(240).optional(),
  startWeekOn: z.enum(['sunday', 'monday']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  showWeather: z.boolean().optional(),
  weatherUnit: z.enum(['fahrenheit', 'celsius']).optional(),
  weatherLocation: z.string().max(500).optional(),
  launchAtLogin: z.boolean().optional(),
  keepWindowOnTop: z.boolean().optional(),
  selectedCalendarIds: z.array(z.string()).optional(),
});
