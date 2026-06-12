import type { CalendarEvent, CalendarSource } from '../../types/calendar';
import { formatEventTime } from '../../lib/dates';
import { getEventSubtitle } from '../../lib/events';
import { cn } from '../../lib/cn';
import { CalendarColorDot } from './CalendarColorDot';
import { JoinButton } from './JoinButton';

type EventRowProps = {
  event: CalendarEvent;
  calendar?: CalendarSource;
  timeFormat: '12h' | '24h';
  now: Date;
  isCurrent: boolean;
  isNext: boolean;
  onEdit: (event: CalendarEvent) => void;
};

export function EventRow({ event, calendar, timeFormat, now, isCurrent, isNext, onEdit }: EventRowProps): React.JSX.Element {
  const subtitle = getEventSubtitle(event, calendar?.name);
  const isComplete = !event.isAllDay && new Date(event.endsAt).getTime() <= now.getTime();

  return (
    <div className={cn('event-row', isComplete && 'event-row-complete', isCurrent && 'event-row-current', isNext && 'event-row-next')}>
      <CalendarColorDot color={calendar?.color ?? '#6b7280'} />
      <div className="event-time">{formatEventTime(event.startsAt, event.endsAt, event.isAllDay, timeFormat)}</div>
      <div className="event-copy">
        <button type="button" className="event-title event-title-link" onClick={() => onEdit(event)}>
          {event.title || 'Untitled event'}
        </button>
        {subtitle ? <div className="event-subtitle">{subtitle}</div> : null}
      </div>
      <div className="event-actions">
        {event.video ? <JoinButton event={event} video={event.video} /> : null}
      </div>
    </div>
  );
}
