import { ChevronDown, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Plus, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isToday } from 'date-fns';
import { useState } from 'react';
import type { CalendarEvent, CalendarSource, WeatherForecast } from '../../types/calendar';
import { cn } from '../../lib/cn';
import { formatSectionDate, formatSectionEyebrow } from '../../lib/dates';
import { EventRow } from './EventRow';

type DateSectionProps = {
  date: Date;
  events: CalendarEvent[];
  calendars: CalendarSource[];
  timeFormat: '12h' | '24h';
  now: Date;
  weatherForecast: WeatherForecast | null;
  onCreate: (date: Date) => void;
  onEdit: (event: CalendarEvent) => void;
};

export function DateSection({ date, events, calendars, timeFormat, now, weatherForecast, onCreate, onEdit }: DateSectionProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const today = isToday(date);
  const WeatherIcon = weatherForecast ? weatherIconForCode(weatherForecast.weatherCode) : null;
  const nowTime = now.getTime();
  const activeEventId = today
    ? events.find((event) => !event.isAllDay && new Date(event.startsAt).getTime() <= nowTime && new Date(event.endsAt).getTime() > nowTime)?.id
    : undefined;
  const nextEventId =
    today && !activeEventId
      ? events.find((event) => !event.isAllDay && new Date(event.startsAt).getTime() >= nowTime && new Date(event.endsAt).getTime() > nowTime)?.id
      : undefined;

  return (
    <section className={cn('date-section', today && 'date-section-today')}>
      <header className="date-section-header">
        <button
          type="button"
          className="section-collapse"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${formatSectionDate(date)}`}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="section-title-group">
          <div className="section-title-line">
            <span className={cn('section-eyebrow', today && 'today-pill')}>{formatSectionEyebrow(date)}</span>
            <span className="section-count">{events.length}</span>
          </div>
          <div className="section-date">{formatSectionDate(date)}</div>
        </div>
        {today && weatherForecast && WeatherIcon ? (
          <div className="today-weather" aria-label={`Current weather ${formatCurrentTemperature(weatherForecast)}`} title="Current weather">
            <WeatherIcon size={14} />
            <span>{formatCurrentTemperature(weatherForecast)}</span>
          </div>
        ) : null}
        <button
          type="button"
          aria-label={`Create event on ${formatSectionDate(date)}`}
          title={`Create event on ${formatSectionDate(date)}`}
          className="date-add-button"
          onClick={() => onCreate(date)}
        >
          <Plus size={14} />
        </button>
      </header>

      {!collapsed ? (
        <div className="event-list">
          {events.length ? (
            events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                calendar={calendars.find((calendar) => calendar.id === event.calendarId)}
                timeFormat={timeFormat}
                now={now}
                isCurrent={event.id === activeEventId}
                isNext={event.id === nextEventId}
                onEdit={onEdit}
              />
            ))
          ) : (
            <div className="empty-day">
              <strong>No events today</strong>
              <span>{today ? 'You have a clear day.' : 'Nothing scheduled.'}</span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatCurrentTemperature(forecast: WeatherForecast): string {
  const unitLabel = forecast.unit === 'fahrenheit' ? 'F' : 'C';
  return `${Math.round(forecast.currentTemperature)}°${unitLabel}`;
}

function weatherIconForCode(code: number): LucideIcon {
  if (code === 0) {
    return Sun;
  }

  if (code === 1 || code === 2) {
    return CloudSun;
  }

  if (code === 3) {
    return Cloud;
  }

  if (code === 45 || code === 48) {
    return CloudFog;
  }

  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) {
    return CloudDrizzle;
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return CloudSnow;
  }

  if (code >= 80 && code <= 82) {
    return CloudRain;
  }

  if (code >= 95) {
    return CloudLightning;
  }

  return CloudSun;
}
