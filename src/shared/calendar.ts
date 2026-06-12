export type CalendarProvider = 'google' | 'microsoft' | 'apple' | 'caldav';

export type VideoProvider = 'google_meet' | 'zoom' | 'teams' | 'unknown';
export type CreatableVideoProvider = Exclude<VideoProvider, 'unknown'>;
export type WeatherUnit = 'fahrenheit' | 'celsius';

export type CalendarAccount = {
  id: string;
  provider: CalendarProvider;
  email: string;
  displayName: string;
  connectedAt: string;
};

export type CalendarSource = {
  id: string;
  accountId: string;
  provider: CalendarProvider;
  name: string;
  color: string;
  isVisible: boolean;
  isPrimary?: boolean;
  canWrite?: boolean;
};

export type EventAttendee = {
  email: string;
  name?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
};

export type VideoConference = {
  provider: VideoProvider;
  url: string;
  label: string;
};

export type CalendarEvent = {
  id: string;
  providerEventId: string;
  provider: CalendarProvider;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  timezone?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  attendees?: EventAttendee[];
  video?: VideoConference | null;
  sourceUrl?: string;
  updatedAt?: string;
};

export type ListEventsInput = {
  startsAt: string;
  endsAt: string;
  calendarIds?: string[];
  search?: string;
};

export type CreateEventInput = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  calendarId: string;
  addVideoCall: boolean;
  videoProvider?: CreatableVideoProvider;
  guests: string[];
  location?: string;
  notes?: string;
};

export type UpdateEventInput = Partial<CreateEventInput> & {
  id: string;
  calendarId: string;
};

export type DeleteEventInput = {
  id: string;
  calendarId: string;
};

export type ConnectProviderResult = {
  account: CalendarAccount;
  calendars: CalendarSource[];
};

export type VideoAccount = {
  id: string;
  provider: CreatableVideoProvider;
  email: string;
  displayName: string;
  connectedAt: string;
};

export type ConnectVideoProviderResult = {
  account: VideoAccount;
};

export type WeatherForecastInput = {
  latitude: number;
  longitude: number;
  unit: WeatherUnit;
};

export type WeatherForecast = {
  high: number;
  low: number;
  currentTemperature: number;
  weatherCode: number;
  unit: WeatherUnit;
};

export type WeatherLocationResult = {
  name: string;
  latitude: number;
  longitude: number;
};

export type AppSettings = {
  defaultCalendarId: string;
  defaultDurationMinutes: number;
  startWeekOn: 'sunday' | 'monday';
  timeFormat: '12h' | '24h';
  showWeather: boolean;
  weatherUnit: WeatherUnit;
  weatherLocation: string;
  launchAtLogin: boolean;
  keepWindowOnTop: boolean;
  selectedCalendarIds: string[];
};
