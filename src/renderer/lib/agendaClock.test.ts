import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDateAfterRollover, startAgendaClock } from './agendaClock';

let windowEvents: EventTarget;
let documentEvents: EventTarget & { hidden: boolean };
let stopClock: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 59, 500));
  windowEvents = new EventTarget();
  documentEvents = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('document', documentEvents);
});

afterEach(() => {
  stopClock?.();
  stopClock = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('agenda clock', () => {
  it('advances the current agenda at local midnight, including the last partial clock interval', () => {
    let selectedDate = new Date(2026, 9, 20);
    const tick = vi.fn((now: Date, previousNow: Date) => {
      selectedDate = getDateAfterRollover(selectedDate, previousNow, now) ?? selectedDate;
    });
    stopClock = startAgendaClock(tick);

    vi.advanceTimersByTime(499);
    expect(tick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(selectedDate).toEqual(new Date(2026, 9, 21));
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('preserves a date deliberately selected away from today when midnight passes', () => {
    let selectedDate = new Date(2026, 9, 25);
    stopClock = startAgendaClock((now, previousNow) => {
      selectedDate = getDateAfterRollover(selectedDate, previousNow, now) ?? selectedDate;
    });

    vi.advanceTimersByTime(500);
    expect(selectedDate).toEqual(new Date(2026, 9, 25));
  });

  it('waits for local midnight on a daylight-saving transition day', () => {
    vi.setSystemTime(new Date(2026, 2, 8, 1, 59, 59, 500));
    let selectedDate = new Date(2026, 2, 8);
    stopClock = startAgendaClock((now, previousNow) => {
      selectedDate = getDateAfterRollover(selectedDate, previousNow, now) ?? selectedDate;
    });

    vi.advanceTimersByTime(30_000);
    expect(selectedDate).toEqual(new Date(2026, 2, 8));

    vi.setSystemTime(new Date(2026, 2, 8, 23, 59, 59, 500));
    windowEvents.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(500);
    expect(selectedDate).toEqual(new Date(2026, 2, 9));
  });

  it('catches up across several days of sleep as soon as the window regains focus', () => {
    let selectedDate = new Date(2026, 9, 20);
    stopClock = startAgendaClock((now, previousNow) => {
      selectedDate = getDateAfterRollover(selectedDate, previousNow, now) ?? selectedDate;
    });

    vi.setSystemTime(new Date(2026, 9, 23, 8));
    windowEvents.dispatchEvent(new Event('focus'));
    expect(selectedDate).toEqual(new Date(2026, 9, 23));
  });

  it('rechecks the date when the app becomes visible after midnight', () => {
    const tick = vi.fn();
    stopClock = startAgendaClock(tick);
    documentEvents.hidden = true;
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(tick).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(2026, 9, 21, 6));
    documentEvents.hidden = false;
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(tick).toHaveBeenCalledWith(new Date(2026, 9, 21, 6), new Date(2026, 9, 20, 23, 59, 59, 500));
  });

  it('reconciles native resume events and removes all timers and subscriptions on cleanup', () => {
    const tick = vi.fn();
    const unsubscribe = vi.fn();
    let resume = (): void => undefined;
    stopClock = startAgendaClock(tick, (refresh) => {
      resume = refresh;
      return unsubscribe;
    });

    vi.setSystemTime(new Date(2026, 9, 21, 7));
    resume();
    expect(tick).toHaveBeenCalledTimes(1);

    stopClock();
    stopClock = undefined;
    windowEvents.dispatchEvent(new Event('focus'));
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
