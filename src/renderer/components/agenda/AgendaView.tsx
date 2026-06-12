import type { CalendarEvent, CalendarSource, WeatherForecast } from '../../types/calendar';
import { groupEventsByDate } from '../../lib/events';
import { toDateKey } from '../../lib/dates';
import { DateSection } from './DateSection';

type AgendaViewProps = {
  dates: Date[];
  events: CalendarEvent[];
  calendars: CalendarSource[];
  timeFormat: '12h' | '24h';
  now: Date;
  weatherForecast: WeatherForecast | null;
  isLoading: boolean;
  onCreate: (date: Date) => void;
  onEdit: (event: CalendarEvent) => void;
};

export function AgendaView({
  dates,
  events,
  calendars,
  timeFormat,
  now,
  weatherForecast,
  isLoading,
  onCreate,
  onEdit,
}: AgendaViewProps): React.JSX.Element {
  const groups = groupEventsByDate(events);

  if (isLoading) {
    return (
      <main className="agenda-scroll">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-section" key={index}>
            <div className="skeleton-line short" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ))}
      </main>
    );
  }

  return (
    <main className="agenda-scroll">
      {dates.map((date) => (
        <DateSection
          key={toDateKey(date)}
          date={date}
          events={groups.get(toDateKey(date)) ?? []}
          calendars={calendars}
          timeFormat={timeFormat}
          now={now}
          weatherForecast={weatherForecast}
          onCreate={onCreate}
          onEdit={onEdit}
        />
      ))}
    </main>
  );
}
