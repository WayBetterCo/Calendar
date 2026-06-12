import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
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
    endsAt: endOfDay(addDays(start, days - 1)).toISOString(),
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

export function defaultDraftTimes(date: Date): { startTime: string; endTime: string } {
  const now = new Date();
  const sameDay = toDateKey(now) === toDateKey(date);
  const baseHour = sameDay ? Math.max(now.getHours() + 1, 9) : 9;
  const start = setToQuarterHour(baseHour, sameDay ? nextQuarterMinute(now.getMinutes()) : 0);
  const [hour, minute] = start.split(':').map(Number);
  const endDate = new Date(date);
  endDate.setHours(hour, minute + 30, 0, 0);

  return {
    startTime: start,
    endTime: format(endDate, 'HH:mm'),
  };
}

function setToQuarterHour(hour: number, minute: number): string {
  const extraHour = minute >= 60 ? 1 : 0;
  const clampedHour = Math.min(Math.max(hour + extraHour, 0), 23);
  const clampedMinute = minute >= 60 ? 0 : minute;
  return `${String(clampedHour).padStart(2, '0')}:${String(clampedMinute).padStart(2, '0')}`;
}

function nextQuarterMinute(minute: number): number {
  return Math.ceil(minute / 15) * 15;
}
