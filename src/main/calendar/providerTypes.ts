import type {
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  CalendarSource,
  ConnectProviderResult,
  CreateEventInput,
  DeleteEventInput,
  ListEventsInput,
  UpdateEventInput,
} from '../../shared/calendar';

export type CalendarService = {
  provider: Extract<CalendarProvider, 'google' | 'microsoft'>;
  connect(): Promise<ConnectProviderResult>;
  listCalendars(account?: CalendarAccount): Promise<CalendarSource[]>;
  listEvents(input: ListEventsInput, calendars: CalendarSource[]): Promise<CalendarEvent[]>;
  createEvent(input: CreateEventInput, calendar: CalendarSource): Promise<CalendarEvent>;
  updateEvent(input: UpdateEventInput, calendar: CalendarSource): Promise<CalendarEvent>;
  deleteEvent(input: DeleteEventInput, calendar: CalendarSource): Promise<void>;
};
