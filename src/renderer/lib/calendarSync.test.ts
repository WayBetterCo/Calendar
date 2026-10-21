import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_SYNC_INTERVAL_MS, startCalendarSync } from './calendarSync';

let queryClient: QueryClient;
let windowEvents: EventTarget;
let documentEvents: EventTarget & { visibilityState: DocumentVisibilityState };
let resume: () => void;
let stop: () => void;
let unsubscribeResume: ReturnType<typeof vi.fn<() => void>>;
let unsubscribeQueries: Array<() => void>;

beforeEach(() => {
  vi.useFakeTimers();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  windowEvents = new EventTarget();
  documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  unsubscribeResume = vi.fn();
  unsubscribeQueries = [];
  stop = startCalendarSync(queryClient, {
    window: Object.assign(windowEvents, {
      setInterval: (callback: () => void, delay: number) => Number(setInterval(callback, delay)),
      clearInterval: (id: number) => clearInterval(id),
    }),
    document: documentEvents,
    subscribeToResume: (callback) => {
      resume = callback;
      return unsubscribeResume;
    },
  });
});

afterEach(() => {
  stop();
  for (const unsubscribe of unsubscribeQueries) unsubscribe();
  queryClient.clear();
  vi.useRealTimers();
});

function observe<T>(key: string, initial: T, queryFn: () => Promise<T>): void {
  queryClient.setQueryData([key], initial);
  const observer = new QueryObserver(queryClient, { queryKey: [key], queryFn });
  unsubscribeQueries.push(observer.subscribe(() => undefined));
}

describe('automatic calendar sync', () => {
  it('discovers externally added events and refreshes sources while unfocused', async () => {
    let providerEvents = ['existing'];
    const events = vi.fn(async () => providerEvents);
    const calendars = vi.fn(async () => ['updated calendar']);
    const accounts = vi.fn(async () => ['connected account']);
    observe('events', ['existing'], events);
    observe('calendars', ['old calendar'], calendars);
    observe('accounts', [], accounts);
    documentEvents.visibilityState = 'hidden';
    providerEvents = ['existing', 'new invitation'];

    await vi.advanceTimersByTimeAsync(CALENDAR_SYNC_INTERVAL_MS - 1);
    expect(events).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(queryClient.getQueryData(['events'])).toEqual(providerEvents);
    expect(queryClient.getQueryData(['calendars'])).toEqual(['updated calendar']);
    expect(queryClient.getQueryData(['accounts'])).toEqual(['connected account']);
  });

  it('keeps existing events during a transient error and recovers on the next poll', async () => {
    const events = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValue(['existing', 'new invitation']);
    observe('events', ['existing'], events);

    await vi.advanceTimersByTimeAsync(CALENDAR_SYNC_INTERVAL_MS);
    expect(queryClient.getQueryData(['events'])).toEqual(['existing']);
    expect(queryClient.getQueryState(['events'])?.status).toBe('error');
    await vi.advanceTimersByTimeAsync(CALENDAR_SYNC_INTERVAL_MS);

    expect(queryClient.getQueryData(['events'])).toEqual(['existing', 'new invitation']);
    expect(queryClient.getQueryState(['events'])?.status).toBe('success');
  });

  it.each(['focus', 'online', 'visible', 'resume'])('refreshes immediately on %s', async (signal) => {
    const events = vi.fn(async () => ['new invitation']);
    observe('events', [], events);

    if (signal === 'resume') resume();
    else if (signal === 'visible') documentEvents.dispatchEvent(new Event('visibilitychange'));
    else windowEvents.dispatchEvent(new Event(signal));
    await vi.advanceTimersByTimeAsync(0);

    expect(events).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['events'])).toEqual(['new invitation']);
  });

  it('shares in-flight requests across simultaneous wake and focus signals', async () => {
    let complete!: (events: string[]) => void;
    const events = vi.fn(() => new Promise<string[]>((resolve) => { complete = resolve; }));
    observe('events', ['existing'], events);

    windowEvents.dispatchEvent(new Event('focus'));
    windowEvents.dispatchEvent(new Event('online'));
    resume();
    expect(events).toHaveBeenCalledTimes(1);
    complete(['existing', 'new invitation']);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryClient.getQueryData(['events'])).toEqual(['existing', 'new invitation']);
  });

  it('ignores hiding and removes the timer and listeners when stopped', async () => {
    const events = vi.fn(async () => []);
    observe('events', [], events);
    documentEvents.visibilityState = 'hidden';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    stop();
    expect(unsubscribeResume).toHaveBeenCalledTimes(1);

    windowEvents.dispatchEvent(new Event('focus'));
    windowEvents.dispatchEvent(new Event('online'));
    documentEvents.visibilityState = 'visible';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(CALENDAR_SYNC_INTERVAL_MS * 2);
    expect(events).not.toHaveBeenCalled();
  });
});
