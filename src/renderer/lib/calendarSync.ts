import type { QueryClient } from '@tanstack/react-query';

export const CALENDAR_SYNC_INTERVAL_MS = 60_000;

type SyncEnvironment = {
  window: Pick<Window, 'addEventListener' | 'removeEventListener' | 'setInterval' | 'clearInterval'>;
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  subscribeToResume: (callback: () => void) => () => void;
};

/** Keep external changes flowing even when the calendar stays open and unfocused. */
export function startCalendarSync(queryClient: QueryClient, environment: SyncEnvironment): () => void {
  const refresh = (): void => {
    for (const key of ['events', 'calendars', 'accounts']) {
      // Multiple wake/focus signals must share requests already in progress.
      void queryClient.invalidateQueries({ queryKey: [key] }, { cancelRefetch: false });
    }
  };
  const onVisible = (): void => {
    if (environment.document.visibilityState === 'visible') refresh();
  };

  const interval = environment.window.setInterval(refresh, CALENDAR_SYNC_INTERVAL_MS);
  environment.window.addEventListener('focus', refresh);
  environment.window.addEventListener('online', refresh);
  environment.document.addEventListener('visibilitychange', onVisible);
  const unsubscribeFromResume = environment.subscribeToResume(refresh);

  return () => {
    environment.window.clearInterval(interval);
    environment.window.removeEventListener('focus', refresh);
    environment.window.removeEventListener('online', refresh);
    environment.document.removeEventListener('visibilitychange', onVisible);
    unsubscribeFromResume();
  };
}
