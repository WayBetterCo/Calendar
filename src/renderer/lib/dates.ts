import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from 'date-fns';

export function toDateKey(date: Date | string): string {
  const value = typeof date === 'string' ? parseISO(date) : date;
  return format(value, 'yyyy-MM-dd');
}

export function getAgendaRange(selectedDate: Date, days = 7): { startsAt: string; endsAt: string; dates: Date[] } {
  const start = startOfDay(selectedDate);
  return {
    startsAt: start.toISOString(),
    endsAt: addDays(start, days).toISOString(),
    dates: Array.from({ length: days }, (_, index) => addDays(start, index)),
  };
}

export function formatSectionEyebrow(date: Date): string {
  if (isToday(date)) {
    return 'TODAY';
  }

  if (isTomorrow(date)) {
    return 'TOMORROW';
  }

  return format(date, 'EEE, MMM d').toUpperCase();
}

export function formatSectionDate(date: Date): string {
  return format(date, 'EEEE, MMMM d');
}

export function formatSelectedDate(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }

  if (isTomorrow(date)) {
    return 'Tomorrow';
  }

  return format(date, 'EEE, MMM d');
}

export function formatEventTime(startsAt: string, endsAt: string, isAllDay: boolean, timeFormat: '12h' | '24h'): string {
  if (isAllDay) {
    return 'All day';
  }

  const pattern = timeFormat === '24h' ? 'HH:mm' : 'h:mm a';
  return `${format(parseISO(startsAt), pattern)}\n${format(parseISO(endsAt), pattern)}`;
}

export function getRelativeDayHint(date: Date): string {
  const delta = differenceInCalendarDays(date, new Date());

  if (delta === 0) {
    return 'Current day';
  }

  if (delta === 1) {
    return '1 day ahead';
  }

  if (delta > 1) {
    return `${delta} days ahead`;
  }

  return `${Math.abs(delta)} days ago`;
}

export function defaultDraftTimes(date: Date, durationMinutes = 30): { startTime: string; endTime: string } {
  const now = new Date();
  const sameDay = toDateKey(now) === toDateKey(date);
  const latestStart = Math.floor((24 * 60 - durationMinutes - 1) / 15) * 15;
  const nextQuarter = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15;
  const startMinute = Math.min(sameDay ? Math.max(nextQuarter, 9 * 60) : 9 * 60, latestStart);
  return {
    startTime: timeFromMinutes(startMinute),
    endTime: timeFromMinutes(startMinute + durationMinutes),
  };
}

function timeFromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
