import { addDays, setHours, setMinutes } from 'date-fns';
import type { AppSettings, CalendarEvent, CalendarSource } from './calendar';

export const mockCalendars: CalendarSource[] = [
  {
    id: 'cal_team',
    accountId: 'acct_google_primary',
    provider: 'google',
    name: 'Team',
    color: '#2f80ed',
    isVisible: true,
    isPrimary: true,
  },
  {
    id: 'cal_investors',
    accountId: 'acct_google_primary',
    provider: 'google',
    name: 'Investors',
    color: '#27ae60',
    isVisible: true,
  },
  {
    id: 'cal_product',
    accountId: 'acct_google_primary',
    provider: 'google',
    name: 'Product',
    color: '#9b51e0',
    isVisible: true,
  },
  {
    id: 'cal_personal',
    accountId: 'acct_google_primary',
    provider: 'google',
    name: 'Personal',
    color: '#f2994a',
    isVisible: true,
  },
];

export const mockSettings: AppSettings = {
  defaultCalendarId: 'cal_team',
  defaultDurationMinutes: 30,
  startWeekOn: 'monday',
  timeFormat: '12h',
  showWeather: true,
  weatherUnit: 'fahrenheit',
  weatherLocation: '',
  launchAtLogin: false,
  keepWindowOnTop: false,
  selectedCalendarIds: mockCalendars.map((calendar) => calendar.id),
};

function at(base: Date, dayOffset: number, hour: number, minute = 0): string {
  return setMinutes(setHours(addDays(base, dayOffset), hour), minute).toISOString();
}

export function getMockEvents(now = new Date()): CalendarEvent[] {
  const today = new Date(now);

  return [
    {
      id: 'evt_1',
      providerEventId: 'google_1',
      provider: 'google',
      calendarId: 'cal_team',
      title: 'Daily Stand-Up',
      startsAt: at(today, 0, 9),
      endsAt: at(today, 0, 9, 15),
      isAllDay: false,
      video: { provider: 'zoom', label: 'Zoom', url: 'https://zoom.us/j/123456789' },
    },
    {
      id: 'evt_2',
      providerEventId: 'google_2',
      provider: 'google',
      calendarId: 'cal_investors',
      title: 'Investor Meeting - Sequoia',
      startsAt: at(today, 0, 11),
      endsAt: at(today, 0, 12),
      isAllDay: false,
      attendees: [{ email: 'partner@example.com', name: 'Leadership' }],
      video: { provider: 'google_meet', label: 'Meet', url: 'https://meet.google.com/abc-defg-hij' },
    },
    {
      id: 'evt_3',
      providerEventId: 'google_3',
      provider: 'google',
      calendarId: 'cal_product',
      title: 'Product Review',
      startsAt: at(today, 0, 13, 30),
      endsAt: at(today, 0, 14),
      isAllDay: false,
      video: { provider: 'teams', label: 'Teams', url: 'https://teams.microsoft.com/l/meetup-join/example' },
    },
    {
      id: 'evt_4',
      providerEventId: 'google_4',
      provider: 'google',
      calendarId: 'cal_personal',
      title: 'Lunch with Sarah',
      location: 'The Grove',
      startsAt: at(today, 0, 12),
      endsAt: at(today, 0, 13),
      isAllDay: false,
      video: null,
    },
    {
      id: 'evt_5',
      providerEventId: 'google_5',
      provider: 'google',
      calendarId: 'cal_team',
      title: 'Design Critique',
      startsAt: at(today, 1, 10),
      endsAt: at(today, 1, 11),
      isAllDay: false,
      video: { provider: 'google_meet', label: 'Meet', url: 'https://meet.google.com/day-line-ux' },
    },
    {
      id: 'evt_6',
      providerEventId: 'google_6',
      provider: 'google',
      calendarId: 'cal_product',
      title: 'Launch Readiness Review',
      startsAt: at(today, 2, 15),
      endsAt: at(today, 2, 16),
      isAllDay: false,
      location: 'Boardroom 3',
      video: null,
    },
    {
      id: 'evt_7',
      providerEventId: 'google_7',
      provider: 'google',
      calendarId: 'cal_personal',
      title: 'Focus day',
      startsAt: at(today, 3, 0),
      endsAt: at(today, 4, 0),
      isAllDay: true,
      video: null,
    },
  ];
}
