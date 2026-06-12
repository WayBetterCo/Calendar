import type { WayBetterCalendarApi } from '../../preload';

declare global {
  interface Window {
    waybetterCalendar?: WayBetterCalendarApi;
  }
}

export {};
