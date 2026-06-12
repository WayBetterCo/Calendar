import type { CalendarSource } from '../../types/calendar';

type CalendarAccountsProps = {
  calendars: CalendarSource[];
  selectedCalendarIds: string[];
  onToggle: (calendarId: string) => void;
};

export function CalendarAccounts({ calendars, selectedCalendarIds, onToggle }: CalendarAccountsProps): React.JSX.Element {
  return (
    <div className="settings-group">
      <h3>Visible calendars</h3>
      {calendars.map((calendar) => (
        <label className="calendar-setting-row" key={calendar.id}>
          <span className="calendar-setting-dot" style={{ backgroundColor: calendar.color }} />
          <span>{calendar.name}</span>
          <input
            type="checkbox"
            checked={selectedCalendarIds.includes(calendar.id)}
            onChange={() => onToggle(calendar.id)}
          />
        </label>
      ))}
    </div>
  );
}
