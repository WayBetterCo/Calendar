import { MapPin } from 'lucide-react';
import type { CalendarEvent } from '../../types/calendar';
import { calendarApi } from '../../api/calendarApi';
import { getGoogleMapsUrl } from '../../lib/eventLocation';

export function LocationButton({ event }: { event: CalendarEvent }): React.JSX.Element | null {
  const url = getGoogleMapsUrl(event.location);
  if (!url) return null;

  return (
    <button
      type="button"
      className="location-button"
      aria-label={`Open location in Google Maps for ${event.title}`}
      title={`In person: ${event.location?.trim()}. Open in Google Maps`}
      onClick={() => void calendarApi.openExternal(url)}
    >
      <MapPin size={20} aria-hidden="true" />
    </button>
  );
}
