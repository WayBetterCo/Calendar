import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  AppSettings,
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  CalendarSource,
  ConnectVideoProviderResult,
  ConnectProviderResult,
  CreatableVideoProvider,
  CreateEventInput,
  DeleteEventInput,
  ListEventsInput,
  UpdateEventInput,
  VideoAccount,
  WeatherForecast,
  WeatherForecastInput,
  WeatherLocationResult,
} from '../shared/calendar';

const api = {
  theme: {
    get(): Promise<'dark' | 'light'> {
      return ipcRenderer.invoke('theme:get');
    },
    onChange(callback: (theme: 'dark' | 'light') => void): () => void {
      const listener = (_event: IpcRendererEvent, theme: 'dark' | 'light') => callback(theme);
      ipcRenderer.on('theme:changed', listener);
      return () => ipcRenderer.removeListener('theme:changed', listener);
    },
  },
  calendar: {
    listEvents(input: ListEventsInput): Promise<CalendarEvent[]> {
      return ipcRenderer.invoke('calendar:list-events', input);
    },
    createEvent(input: CreateEventInput): Promise<CalendarEvent> {
      return ipcRenderer.invoke('calendar:create-event', input);
    },
    updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
      return ipcRenderer.invoke('calendar:update-event', input);
    },
    deleteEvent(input: DeleteEventInput): Promise<void> {
      return ipcRenderer.invoke('calendar:delete-event', input);
    },
    listCalendars(): Promise<CalendarSource[]> {
      return ipcRenderer.invoke('calendar:list-calendars');
    },
  },
  auth: {
    listAccounts(): Promise<CalendarAccount[]> {
      return ipcRenderer.invoke('auth:list-accounts');
    },
    connectProvider(provider: Extract<CalendarProvider, 'google' | 'microsoft'>): Promise<ConnectProviderResult> {
      return ipcRenderer.invoke('auth:connect-provider', provider);
    },
    connectGoogle(): Promise<ConnectProviderResult> {
      return ipcRenderer.invoke('auth:connect-provider', 'google');
    },
    connectMicrosoft(): Promise<ConnectProviderResult> {
      return ipcRenderer.invoke('auth:connect-provider', 'microsoft');
    },
    disconnectAccount(_accountId: string): Promise<void> {
      return ipcRenderer.invoke('auth:disconnect-account', _accountId);
    },
  },
  video: {
    listAccounts(): Promise<VideoAccount[]> {
      return ipcRenderer.invoke('video:list-accounts');
    },
    connectProvider(provider: CreatableVideoProvider): Promise<ConnectVideoProviderResult> {
      return ipcRenderer.invoke('video:connect-provider', provider);
    },
    disconnectAccount(accountId: string): Promise<void> {
      return ipcRenderer.invoke('video:disconnect-account', accountId);
    },
  },
  shell: {
    openExternal(url: string): Promise<void> {
      return ipcRenderer.invoke('shell:open-external', url);
    },
  },
  settings: {
    get(): Promise<AppSettings> {
      return ipcRenderer.invoke('settings:get');
    },
    update(patch: Partial<AppSettings>): Promise<AppSettings> {
      return ipcRenderer.invoke('settings:update', patch);
    },
  },
  weather: {
    getDailyForecast(input: WeatherForecastInput): Promise<WeatherForecast> {
      return ipcRenderer.invoke('weather:get-daily-forecast', input);
    },
    resolveLocation(location: string): Promise<WeatherLocationResult> {
      return ipcRenderer.invoke('weather:resolve-location', location);
    },
  },
};

contextBridge.exposeInMainWorld('waybetterCalendar', api);

export type WayBetterCalendarApi = typeof api;
