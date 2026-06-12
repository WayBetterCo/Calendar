import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import type { CalendarSource } from '../../types/calendar';

type AppShellProps = {
  calendars: CalendarSource[];
  eventCountLabel: string;
  weekEventCountLabel: string;
  selectedCalendarIds: string[];
  selectedDate: Date;
  search: string;
  searchOpen: boolean;
  weatherLabel: string;
  children: ReactNode;
  onCalendarToggle: (calendarId: string) => void;
  onCalendarSet: (calendarIds: string[]) => void;
  onDateChange: (date: Date) => void;
  onSearchChange: (search: string) => void;
  onSearchToggle: () => void;
  onCreate: () => void;
  onSettings: () => void;
};

export function AppShell(props: AppShellProps): React.JSX.Element {
  return (
    <div className="app-frame">
      <Header
        calendars={props.calendars}
        eventCountLabel={props.eventCountLabel}
        weekEventCountLabel={props.weekEventCountLabel}
        selectedCalendarIds={props.selectedCalendarIds}
        selectedDate={props.selectedDate}
        search={props.search}
        searchOpen={props.searchOpen}
        weatherLabel={props.weatherLabel}
        onCalendarToggle={props.onCalendarToggle}
        onCalendarSet={props.onCalendarSet}
        onDateChange={props.onDateChange}
        onSearchChange={props.onSearchChange}
        onSearchToggle={props.onSearchToggle}
        onCreate={props.onCreate}
      />
      {props.children}
      <Footer calendars={props.calendars} onSettings={props.onSettings} />
    </div>
  );
}
