import { addDays, isSameDay, startOfDay } from 'date-fns';

type AgendaClockTick = (now: Date, previousNow: Date) => void;

export function getDateAfterRollover(selectedDate: Date, previousNow: Date, now: Date): Date | null {
  if (isSameDay(previousNow, now) || !isSameDay(selectedDate, previousNow)) return null;
  return startOfDay(now);
}

export function startAgendaClock(onTick: AgendaClockTick, subscribeRefresh?: (refresh: () => void) => () => void): () => void {
  let previousNow = new Date();
  let timer: ReturnType<typeof setTimeout>;

  function schedule(now: Date): void {
    const nextMidnight = addDays(startOfDay(now), 1);
    const delay = Math.max(1, Math.min(30_000, nextMidnight.getTime() - now.getTime()));
    timer = setTimeout(refresh, delay);
  }

  function refresh(): void {
    clearTimeout(timer);
    const now = new Date();
    onTick(now, previousNow);
    previousNow = now;
    schedule(now);
  }

  function handleVisibilityChange(): void {
    if (!document.hidden) refresh();
  }

  schedule(previousNow);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const unsubscribeRefresh = subscribeRefresh?.(refresh);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeRefresh?.();
  };
}
