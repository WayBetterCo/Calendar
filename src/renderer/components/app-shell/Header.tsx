import { addDays, isToday, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import type { CalendarSource } from '../../types/calendar';
import { cn } from '../../lib/cn';
import { formatSelectedDate } from '../../lib/dates';
import { DatePickerPopover } from '../date-picker/DatePickerPopover';

type HeaderProps = {
  calendars: CalendarSource[];
  eventCountLabel: string;
  weekEventCountLabel: string;
  selectedCalendarIds: string[];
  selectedDate: Date;
  search: string;
  searchOpen: boolean;
  weatherLabel: string;
  onCalendarToggle: (calendarId: string) => void;
  onCalendarSet: (calendarIds: string[]) => void;
  onDateChange: (date: Date) => void;
  onSearchChange: (search: string) => void;
  onSearchToggle: () => void;
  onCreate: () => void;
};

export function Header({
  calendars,
  eventCountLabel,
  weekEventCountLabel,
  selectedCalendarIds,
  selectedDate,
  search,
  searchOpen,
  weatherLabel,
  onCalendarToggle,
  onCalendarSet,
  onDateChange,
  onSearchChange,
  onSearchToggle,
  onCreate,
}: HeaderProps): React.JSX.Element {
  const selectedDateIsToday = isToday(selectedDate);

  return (
    <header className="app-header">
      <div className="titlebar-spacer" />
      <div className="brand-row">
        <div className="day-summary" aria-live="polite">
          <h1>{eventCountLabel}</h1>
          <span>{weekEventCountLabel}</span>
        </div>
        <div className="header-actions">
          {weatherLabel ? (
            <div className="weather-badge" aria-label={`Local weather high and low: ${weatherLabel}`} title="Local high / low">
              {weatherLabel}
            </div>
          ) : null}
          <button type="button" className="icon-button" aria-label="Search" title="Search" onClick={onSearchToggle}>
            <Search size={16} />
          </button>
          <button type="button" className="icon-button primary-icon" aria-label="Create event" title="Create event" onClick={onCreate}>
            <Plus size={17} />
          </button>
        </div>
      </div>

      <div className="date-nav">
        <button type="button" className="nav-button" aria-label="Previous day" onClick={() => onDateChange(addDays(selectedDate, -1))}>
          <ChevronLeft size={16} />
        </button>
        <div className={cn('selected-date', !selectedDateIsToday && 'jump-to-today')}>
          <span className="selected-date-label">{formatSelectedDate(selectedDate)}</span>
          {selectedDateIsToday ? (
            <DatePickerPopover value={selectedDate} onChange={onDateChange} />
          ) : (
            <button
              type="button"
              className="date-jump-button"
              aria-label="Jump to today"
              title="Jump to today"
              onClick={() => onDateChange(startOfDay(new Date()))}
            >
              Today
            </button>
          )}
        </div>
        <button type="button" className="nav-button" aria-label="Next day" onClick={() => onDateChange(addDays(selectedDate, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      {searchOpen ? (
        <input
          className="search-input"
          autoFocus
          value={search}
          placeholder="Search agenda"
          aria-label="Search loaded events"
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      ) : null}

      <div className="calendar-filter-row" aria-label="Calendar filters">
        <button
          type="button"
          className={cn('calendar-chip', selectedCalendarIds.length === calendars.length && 'active')}
          onClick={() => {
            const nextIds =
              selectedCalendarIds.length === calendars.length
                ? [calendars.find((calendar) => calendar.isPrimary)?.id ?? calendars[0]?.id].filter(Boolean)
                : calendars.map((calendar) => calendar.id);
            onCalendarSet(nextIds);
          }}
        >
          All Calendars
        </button>
        <div className="calendar-dots-menu">
          <div className="calendar-dots" aria-label="Calendar color filters">
            {calendars.map((calendar) => (
              <button
                key={calendar.id}
                type="button"
                className={cn('calendar-dot-button', selectedCalendarIds.includes(calendar.id) && 'selected')}
                style={{ '--calendar-color': calendar.color } as React.CSSProperties}
                aria-label={`${selectedCalendarIds.includes(calendar.id) ? 'Hide' : 'Show'} ${calendar.name}`}
                title={calendar.name}
                onClick={() => onCalendarToggle(calendar.id)}
              />
            ))}
          </div>
          {calendars.length ? (
            <div className="calendar-filter-popover" role="menu" aria-label="Toggle calendars">
              <div className="calendar-filter-popover-header">
                <span>Calendars</span>
                <button type="button" className="text-button" onClick={() => onCalendarSet(calendars.map((calendar) => calendar.id))}>
                  All
                </button>
              </div>
              <div className="calendar-filter-list">
                {calendars.map((calendar) => {
                  const selected = selectedCalendarIds.includes(calendar.id);
                  return (
                    <button
                      key={calendar.id}
                      type="button"
                      className="calendar-filter-item"
                      role="menuitemcheckbox"
                      aria-checked={selected}
                      onClick={() => onCalendarToggle(calendar.id)}
                    >
                      <span className="calendar-filter-swatch" style={{ '--calendar-color': calendar.color } as React.CSSProperties} />
                      <span>{calendar.name}</span>
                      <span className={cn('calendar-filter-check', selected && 'selected')} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
