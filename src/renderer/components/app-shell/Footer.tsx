import { Settings } from 'lucide-react';
import type { CalendarSource } from '../../types/calendar';

type FooterProps = {
  calendars: CalendarSource[];
  onSettings: () => void;
};

export function Footer({ calendars, onSettings }: FooterProps): React.JSX.Element {
  return (
    <footer className="app-footer">
      <button type="button" className="footer-settings" onClick={onSettings}>
        <Settings size={15} />
        <span>Settings</span>
      </button>
      <div className="connection-status">
        <span>Connected</span>
        <span className="provider-badge">Google</span>
        {calendars.length > 3 ? <span className="overflow-badge">+{calendars.length - 3}</span> : null}
      </div>
    </footer>
  );
}
