import { addDays, format, isToday, isTomorrow, isYesterday, startOfDay } from 'date-fns';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgendaView } from './components/agenda/AgendaView';
import { AppShell } from './components/app-shell/AppShell';
import { CreateEventModal } from './components/event-create/CreateEventModal';
import { SettingsView } from './components/settings/SettingsView';
import { calendarApi } from './api/calendarApi';
import { getAgendaRange } from './lib/dates';
import { updateEventPayload } from './lib/eventDraft';
import { eventOccursOnDate } from './lib/events';
import { isEditingField } from './lib/shortcuts';
import { useAgendaStore } from './state/useAgendaStore';
import { useSettingsStore } from './state/useSettingsStore';
import type { AppSettings, CalendarEvent, CreateEventInput, DeleteEventInput, UpdateEventInput, WeatherForecast } from './types/calendar';
import { formatWeatherForecast, getLocalWeatherForecast } from './lib/weather';
import { mockSettings } from '../shared/mockData';

export function App(): React.JSX.Element {
  const queryClient = useQueryClient();
  const {
    selectedDate,
    search,
    searchOpen,
    settingsOpen,
    createDate,
    editingEvent,
    setSelectedDate,
    setSearch,
    setSearchOpen,
    setSettingsOpen,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
  } = useAgendaStore();
  const { settings, setSettings } = useSettingsStore();
  const [now, setNow] = useState(() => new Date());
  const [weatherLabel, setWeatherLabel] = useState('');
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: calendarApi.getSettings,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendars'],
    queryFn: calendarApi.listCalendars,
  });
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: calendarApi.listAccounts,
  });
  const videoAccountsQuery = useQuery({
    queryKey: ['video-accounts'],
    queryFn: calendarApi.listVideoAccounts,
  });

  const effectiveSettings = settings ?? settingsQuery.data ?? mockSettings;
  const showWeather = effectiveSettings.showWeather ?? true;
  const weatherUnit = effectiveSettings.weatherUnit ?? 'fahrenheit';
  const weatherLocation = effectiveSettings.weatherLocation ?? '';
  const range = getAgendaRange(selectedDate, 7);
  const eventsQuery = useQuery({
    queryKey: ['events', range.startsAt, range.endsAt, effectiveSettings.selectedCalendarIds, search],
    queryFn: () =>
      calendarApi.listEvents({
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        calendarIds: effectiveSettings.selectedCalendarIds,
        search,
      }),
    enabled: Boolean(settingsQuery.data || settings),
  });

  const settingsMutation = useMutation({
    mutationFn: calendarApi.updateSettings,
    scope: { id: 'settings' },
    onSuccess: (nextSettings) => {
      setSettings(nextSettings);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => {
      if (settingsQuery.data) setSettings(settingsQuery.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateEventInput) => calendarApi.createEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: UpdateEventInput) => calendarApi.updateEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (input: DeleteEventInput) => calendarApi.deleteEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const connectMutation = useMutation({
    mutationFn: calendarApi.connectProvider,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['calendars'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const disconnectMutation = useMutation({
    mutationFn: calendarApi.disconnectAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['calendars'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const connectVideoMutation = useMutation({
    mutationFn: calendarApi.connectVideoProvider,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-accounts'] });
    },
  });
  const disconnectVideoMutation = useMutation({
    mutationFn: calendarApi.disconnectVideoAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-accounts'] });
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data, setSettings]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!showWeather) {
      setWeatherLabel('');
      setWeatherForecast(null);
      return () => {
        cancelled = true;
      };
    }

    function refreshWeather(): void {
      void getLocalWeatherForecast(weatherUnit, weatherLocation)
        .then((forecast) => {
          if (!cancelled) {
            setWeatherForecast(forecast);
            setWeatherLabel(formatWeatherForecast(forecast));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setWeatherForecast(null);
            setWeatherLabel('Weather --');
          }
        });
    }

    const debounce = window.setTimeout(refreshWeather, 500);
    const interval = window.setInterval(refreshWeather, 15 * 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      window.clearInterval(interval);
    };
  }, [showWeather, weatherUnit, weatherLocation]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeCreate();
        closeEdit();
        setSettingsOpen(false);
        setSearchOpen(false);
        setSearch('');
        return;
      }

      if (event.defaultPrevented || event.isComposing) return;
      const commandKey = event.metaKey || event.ctrlKey;

      if (commandKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void queryClient.invalidateQueries({ queryKey: ['events'] });
        return;
      }

      if (isEditingField(event.target) || createDate || editingEvent || settingsOpen) return;

      if (commandKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCreate(selectedDate);
      }

      if (commandKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (commandKey && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }

      if (event.key.toLowerCase() === 't' && !event.metaKey && !event.ctrlKey) {
        setSelectedDate(startOfDay(new Date()));
      }

      if (event.key === 'ArrowLeft' && !commandKey && !event.altKey) {
        event.preventDefault();
        setSelectedDate(addDays(selectedDate, -1));
      }

      if (event.key === 'ArrowRight' && !commandKey && !event.altKey) {
        event.preventDefault();
        setSelectedDate(addDays(selectedDate, 1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCreate, closeEdit, createDate, editingEvent, openCreate, queryClient, selectedDate, setSearch, setSearchOpen, setSelectedDate, setSettingsOpen, settingsOpen]);

  const calendars = calendarsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const videoAccounts = videoAccountsQuery.data ?? [];
  const eventCount = countEventsForDate(eventsQuery.data ?? [], selectedDate);
  const eventCountLabel = formatEventCountLabel(eventCount, selectedDate);
  const weekEventCountLabel = formatWeekEventCountLabel(eventsQuery.data?.length ?? 0);

  function patchSettings(patch: Partial<AppSettings>): void {
    const next = { ...effectiveSettings, ...patch };
    setSettings(next);
    settingsMutation.mutate(patch);
  }

  function toggleCalendar(calendarId: string): void {
    const existing = new Set(effectiveSettings.selectedCalendarIds);
    if (existing.has(calendarId)) {
      existing.delete(calendarId);
    } else {
      existing.add(calendarId);
    }

    const nextIds = Array.from(existing);
    patchSettings({ selectedCalendarIds: nextIds });
  }

  return (
    <>
      <AppShell
        calendars={calendars}
        accounts={accounts}
        eventCountLabel={eventCountLabel}
        weekEventCountLabel={weekEventCountLabel}
        selectedCalendarIds={effectiveSettings.selectedCalendarIds}
        selectedDate={selectedDate}
        search={search}
        searchOpen={searchOpen}
        weatherLabel={weatherLabel}
        onCalendarToggle={toggleCalendar}
        onCalendarSet={(calendarIds) => patchSettings({ selectedCalendarIds: calendarIds })}
        onDateChange={(date) => setSelectedDate(startOfDay(date))}
        onSearchChange={setSearch}
        onSearchToggle={() => {
          if (searchOpen) setSearch('');
          setSearchOpen(!searchOpen);
        }}
        onCreate={() => openCreate(selectedDate)}
        onSettings={() => setSettingsOpen(true)}
      >
        <AgendaView
          dates={range.dates}
          events={eventsQuery.data ?? []}
          calendars={calendars}
          timeFormat={effectiveSettings.timeFormat}
          now={now}
          weatherForecast={showWeather ? weatherForecast : null}
          isLoading={eventsQuery.isLoading || calendarsQuery.isLoading || settingsQuery.isLoading}
          error={eventsQuery.error?.message || calendarsQuery.error?.message || settingsQuery.error?.message || ''}
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['events'] });
            void queryClient.invalidateQueries({ queryKey: ['calendars'] });
            void queryClient.invalidateQueries({ queryKey: ['settings'] });
          }}
          onCreate={openCreate}
          onEdit={openEdit}
        />
      </AppShell>

      <CreateEventModal
        date={createDate}
        calendars={calendars}
        defaultCalendarId={effectiveSettings.defaultCalendarId}
        defaultDurationMinutes={effectiveSettings.defaultDurationMinutes}
        onClose={closeCreate}
        onSubmit={(input) => createMutation.mutateAsync(input).then(() => undefined)}
      />

      <CreateEventModal
        mode="edit"
        date={null}
        event={editingEvent}
        calendars={calendars}
        defaultCalendarId={effectiveSettings.defaultCalendarId}
        onClose={closeEdit}
        onSubmit={(input) =>
          editingEvent ? updateMutation.mutateAsync(updateEventPayload(editingEvent, input)).then(() => undefined) : Promise.resolve()
        }
        onDelete={(event) => deleteMutation.mutateAsync({ id: event.id, calendarId: event.calendarId }).then(() => undefined)}
      />

      <SettingsView
        open={settingsOpen}
        calendars={calendars}
        accounts={accounts}
        videoAccounts={videoAccounts}
        settings={effectiveSettings}
        isConnecting={connectMutation.isPending || disconnectMutation.isPending}
        isConnectingVideo={connectVideoMutation.isPending || disconnectVideoMutation.isPending}
        connectionError={
          connectMutation.error instanceof Error
            ? connectMutation.error.message
            : disconnectMutation.error instanceof Error
              ? disconnectMutation.error.message
              : ''
        }
        videoConnectionError={
          connectVideoMutation.error instanceof Error
            ? connectVideoMutation.error.message
            : disconnectVideoMutation.error instanceof Error
              ? disconnectVideoMutation.error.message
              : ''
        }
        settingsError={settingsMutation.error instanceof Error ? settingsMutation.error.message : ''}
        onClose={() => setSettingsOpen(false)}
        onConnect={(provider) => connectMutation.mutate(provider)}
        onDisconnect={(accountId) => disconnectMutation.mutate(accountId)}
        onConnectVideo={(provider) => connectVideoMutation.mutate(provider)}
        onDisconnectVideo={(accountId) => disconnectVideoMutation.mutate(accountId)}
        onCalendarToggle={toggleCalendar}
        onPatch={patchSettings}
      />
    </>
  );
}

function countEventsForDate(events: CalendarEvent[], date: Date): number {
  return events.filter((event) => eventOccursOnDate(event, date)).length;
}

function formatEventCountLabel(eventCount: number, date: Date): string {
  const eventText = eventCount === 1 ? 'event' : 'events';

  if (isToday(date)) {
    return `${eventCount} ${eventText} today`;
  }

  if (isYesterday(date)) {
    return `${eventCount} ${eventText} yesterday`;
  }

  if (isTomorrow(date)) {
    return `${eventCount} ${eventText} tomorrow`;
  }

  return `${eventCount} ${eventText} ${format(date, 'EEE, MMM d')}`;
}

function formatWeekEventCountLabel(eventCount: number): string {
  const eventText = eventCount === 1 ? 'event' : 'events';
  return `${eventCount} ${eventText} over 7 days`;
}
