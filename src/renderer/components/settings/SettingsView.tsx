import { CheckCircle2, X } from 'lucide-react';
import type { AppSettings, CalendarAccount, CalendarProvider, CalendarSource, CreatableVideoProvider, VideoAccount } from '../../types/calendar';
import googleIcon from '../../assets/icons/google.svg';
import meetIcon from '../../assets/icons/google-meet.svg';
import teamsIcon from '../../assets/icons/microsoft-teams.svg';
import zoomIcon from '../../assets/icons/zoom.svg';
import { CalendarAccounts } from './CalendarAccounts';

type SettingsViewProps = {
  open: boolean;
  calendars: CalendarSource[];
  accounts: CalendarAccount[];
  videoAccounts: VideoAccount[];
  settings: AppSettings;
  isConnecting: boolean;
  isConnectingVideo: boolean;
  connectionError: string;
  videoConnectionError: string;
  onClose: () => void;
  onConnect: (provider: Extract<CalendarProvider, 'google' | 'microsoft'>) => void;
  onDisconnect: (accountId: string) => void;
  onConnectVideo: (provider: CreatableVideoProvider) => void;
  onDisconnectVideo: (accountId: string) => void;
  onCalendarToggle: (calendarId: string) => void;
  onPatch: (patch: Partial<AppSettings>) => void;
};

export function SettingsView({
  open,
  calendars,
  accounts,
  videoAccounts,
  settings,
  isConnecting,
  isConnectingVideo,
  connectionError,
  videoConnectionError,
  onClose,
  onConnect,
  onDisconnect,
  onConnectVideo,
  onDisconnectVideo,
  onCalendarToggle,
  onPatch,
}: SettingsViewProps): React.JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p>{accounts.length ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} connected` : 'Connect a calendar account'}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-group">
          <h3>Calendar connections</h3>
          <div className="connection-buttons">
            <button type="button" className="provider-connect-button" disabled={isConnecting} onClick={() => onConnect('google')}>
              <img className="provider-button-icon" src={googleIcon} alt="" aria-hidden="true" />
              <span>Connect Google</span>
            </button>
            <button type="button" className="provider-connect-button" disabled={isConnecting} onClick={() => onConnect('microsoft')}>
              <img className="provider-button-icon" src={teamsIcon} alt="" aria-hidden="true" />
              <span>Connect Microsoft</span>
            </button>
          </div>
          {connectionError ? <div className="form-error">{connectionError}</div> : null}
          <div className="account-list">
            {accounts.length ? (
              accounts.map((account) => (
                <div className="account-row" key={account.id}>
                  <CheckCircle2 size={15} />
                  <div>
                    <strong>{account.displayName}</strong>
                    <span>{account.provider === 'google' ? 'Google Calendar' : 'Microsoft 365'} · {account.email}</span>
                  </div>
                  <button type="button" className="text-button" onClick={() => onDisconnect(account.id)}>
                    Disconnect
                  </button>
                </div>
              ))
            ) : (
              <p className="settings-help">
                WayBetter Calendar will use a system browser OAuth flow and store tokens locally with macOS-backed encryption when available.
              </p>
            )}
          </div>
        </div>

        <div className="settings-group">
          <h3>Video meetings</h3>
          <div className="connection-buttons three">
            <button type="button" className="provider-connect-button" disabled={isConnectingVideo} onClick={() => onConnectVideo('google_meet')}>
              <img className="provider-button-icon" src={meetIcon} alt="" aria-hidden="true" />
              <span>Meet</span>
            </button>
            <button type="button" className="provider-connect-button" disabled={isConnectingVideo} onClick={() => onConnectVideo('zoom')}>
              <img className="provider-button-icon" src={zoomIcon} alt="" aria-hidden="true" />
              <span>Zoom</span>
            </button>
            <button type="button" className="provider-connect-button" disabled={isConnectingVideo} onClick={() => onConnectVideo('teams')}>
              <img className="provider-button-icon" src={teamsIcon} alt="" aria-hidden="true" />
              <span>Teams</span>
            </button>
          </div>
          {videoConnectionError ? <div className="form-error">{videoConnectionError}</div> : null}
          <div className="account-list">
            {videoAccounts.length ? (
              videoAccounts.map((account) => (
                <div className="account-row" key={account.id}>
                  <CheckCircle2 size={15} />
                  <div>
                    <strong>{account.displayName}</strong>
                    <span>{videoProviderName(account.provider)} · {account.email}</span>
                  </div>
                  {account.provider !== 'google_meet' ? (
                    <button type="button" className="text-button" onClick={() => onDisconnectVideo(account.id)}>
                      Disconnect
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="settings-help">Connect Google Calendar for Meet, or connect Zoom/Teams to create standalone meeting links.</p>
            )}
          </div>
        </div>

        <CalendarAccounts calendars={calendars} selectedCalendarIds={settings.selectedCalendarIds} onToggle={onCalendarToggle} />

        <div className="settings-group">
          <h3>Defaults</h3>
          <label className="field-label">
            Calendar
            <select value={settings.defaultCalendarId} onChange={(event) => onPatch({ defaultCalendarId: event.currentTarget.value })}>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Duration
            <select
              value={settings.defaultDurationMinutes}
              onChange={(event) => onPatch({ defaultDurationMinutes: Number(event.currentTarget.value) })}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </label>
          <label className="field-label">
            Time format
            <select value={settings.timeFormat} onChange={(event) => onPatch({ timeFormat: event.currentTarget.value as AppSettings['timeFormat'] })}>
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </label>
        </div>

        <div className="settings-group">
          <h3>Weather</h3>
          <label className="toggle-row">
            <span>Show local high / low</span>
            <input type="checkbox" checked={settings.showWeather} onChange={() => onPatch({ showWeather: !settings.showWeather })} />
          </label>
          <label className="field-label">
            Location
            <input
              value={settings.weatherLocation ?? ''}
              disabled={!settings.showWeather}
              placeholder="Current location, city, or ZIP"
              onChange={(event) => onPatch({ weatherLocation: event.currentTarget.value })}
            />
          </label>
          <label className="field-label">
            Units
            <select
              value={settings.weatherUnit ?? 'fahrenheit'}
              disabled={!settings.showWeather}
              onChange={(event) => onPatch({ weatherUnit: event.currentTarget.value as AppSettings['weatherUnit'] })}
            >
              <option value="fahrenheit">Fahrenheit</option>
              <option value="celsius">Celsius</option>
            </select>
          </label>
        </div>

        <div className="settings-group">
          <h3>Window</h3>
          <label className="toggle-row">
            <span>Launch at login</span>
            <input type="checkbox" checked={settings.launchAtLogin} onChange={() => onPatch({ launchAtLogin: !settings.launchAtLogin })} />
          </label>
          <label className="toggle-row">
            <span>Keep window on top</span>
            <input type="checkbox" checked={settings.keepWindowOnTop} onChange={() => onPatch({ keepWindowOnTop: !settings.keepWindowOnTop })} />
          </label>
        </div>
      </aside>
    </div>
  );
}

function videoProviderName(provider: CreatableVideoProvider): string {
  if (provider === 'google_meet') {
    return 'Google Meet';
  }

  if (provider === 'zoom') {
    return 'Zoom';
  }

  return 'Microsoft Teams';
}
