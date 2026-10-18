import { Settings } from 'lucide-react';
import type { CalendarAccount } from '../../types/calendar';

type FooterProps = {
  accounts: CalendarAccount[];
  onSettings: () => void;
};

export function Footer({ accounts, onSettings }: FooterProps): React.JSX.Element {
  const providers = [...new Set(accounts.map((account) => account.provider))];
  return (
    <footer className="app-footer">
      <button type="button" className="footer-settings" onClick={onSettings}>
        <Settings size={15} />
        <span>Settings</span>
      </button>
      <div className="connection-status">
        <span>{providers.length ? 'Connected' : 'Local demo'}</span>
        {providers.map((provider) => <span className="provider-badge" key={provider}>{provider === 'google' ? 'Google' : provider === 'microsoft' ? 'Microsoft' : provider}</span>)}
      </div>
    </footer>
  );
}
