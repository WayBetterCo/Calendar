import { format, parseISO } from 'date-fns';
import { Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import type { CalendarEvent, CalendarSource, CreatableVideoProvider, CreateEventInput } from '../../types/calendar';
import { defaultDraftTimes } from '../../lib/dates';
import { cn } from '../../lib/cn';
import meetIcon from '../../assets/icons/google-meet.svg';
import teamsIcon from '../../assets/icons/microsoft-teams.svg';
import zoomIcon from '../../assets/icons/zoom.svg';

const createEventFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  calendarId: z.string().min(1),
  addVideoCall: z.boolean(),
  videoProvider: z.enum(['google_meet', 'zoom', 'teams']).optional(),
  location: z.string(),
  notes: z.string(),
});

const CREATE_DURATION_MINUTES = [15, 30, 45, 60] as const;
const VIDEO_PROVIDER_OPTIONS = [
  { provider: 'google_meet', label: 'Google Meet', icon: meetIcon },
  { provider: 'zoom', label: 'Zoom', icon: zoomIcon },
  { provider: 'teams', label: 'Microsoft Teams', icon: teamsIcon },
] satisfies { provider: CreatableVideoProvider; label: string; icon: string }[];

type CreateEventModalProps = {
  date: Date | null;
  calendars: CalendarSource[];
  defaultCalendarId: string;
  mode?: 'create' | 'edit';
  event?: CalendarEvent | null;
  onClose: () => void;
  onSubmit: (input: CreateEventInput) => Promise<void>;
  onDelete?: (event: CalendarEvent) => Promise<void>;
};

export function CreateEventModal({
  date,
  calendars,
  defaultCalendarId,
  mode = 'create',
  event,
  onClose,
  onSubmit,
  onDelete,
}: CreateEventModalProps): React.JSX.Element | null {
  const modalDate = useMemo(() => {
    if (event) {
      return parseISO(event.startsAt);
    }

    return date;
  }, [date, event]);
  const initialTimes = useMemo(() => (modalDate ? defaultDraftTimes(modalDate) : { startTime: '09:00', endTime: '09:30' }), [modalDate]);
  const [title, setTitle] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [startTime, setStartTime] = useState(initialTimes.startTime);
  const [endTime, setEndTime] = useState(initialTimes.endTime);
  const [durationMinutes, setDurationMinutes] = useState<(typeof CREATE_DURATION_MINUTES)[number]>(30);
  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const [addVideoCall, setAddVideoCall] = useState(false);
  const [videoProvider, setVideoProvider] = useState<CreatableVideoProvider>('google_meet');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const startTimeOptions = useMemo(() => createQuarterHourOptions(durationMinutes), [durationMinutes]);

  useEffect(() => {
    if (event) {
      const startsAt = parseISO(event.startsAt);
      const endsAt = parseISO(event.endsAt);
      setTitle(event.title);
      setDateValue(format(startsAt, 'yyyy-MM-dd'));
      setStartTime(format(startsAt, 'HH:mm'));
      setEndTime(format(endsAt, 'HH:mm'));
      setDurationMinutes(nearestCreateDuration(minutesBetween(startsAt, endsAt)));
      setCalendarId(event.calendarId);
      setAddVideoCall(Boolean(event.video));
      setVideoProvider(event.video?.provider && event.video.provider !== 'unknown' ? event.video.provider : 'google_meet');
      setGuestEmails(uniqueGuests(event.attendees?.map((attendee) => attendee.email) ?? []));
      setGuestInput('');
      setLocation(event.location ?? '');
      setNotes(event.description ?? '');
      setError('');
      return;
    }

    if (date) {
      const nextTimes = defaultDraftTimes(date);
      setTitle('');
      setDateValue(format(date, 'yyyy-MM-dd'));
      setStartTime(nextTimes.startTime);
      setEndTime(nextTimes.endTime);
      setDurationMinutes(30);
      setCalendarId(defaultCalendarId);
      setAddVideoCall(false);
      setVideoProvider('google_meet');
      setGuestEmails([]);
      setGuestInput('');
      setLocation('');
      setNotes('');
      setError('');
    }
  }, [date, defaultCalendarId, event]);

  if (!modalDate) {
    return null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    const submittedEndTime = isEditMode ? endTime : addMinutesToTime(startTime, durationMinutes);

    const parsed = createEventFormSchema.safeParse({
      title,
      date: dateValue,
      startTime,
      endTime: submittedEndTime,
      calendarId,
      addVideoCall,
      videoProvider,
      location,
      notes,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the event details');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        ...parsed.data,
        videoProvider: parsed.data.addVideoCall ? parsed.data.videoProvider : undefined,
        guests: uniqueGuests([...guestEmails, ...parseGuestTokens(guestInput)]),
        location: parsed.data.location || undefined,
        notes: parsed.data.notes || undefined,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Could not ${mode === 'edit' ? 'save' : 'create'} event`);
    } finally {
      setSubmitting(false);
    }
  }

  function commitGuestInput(value = guestInput): void {
    const nextGuests = parseGuestTokens(value);
    if (!nextGuests.length) {
      return;
    }

    setGuestEmails((current) => uniqueGuests([...current, ...nextGuests]));
    setGuestInput('');
  }

  function removeGuest(email: string): void {
    setGuestEmails((current) => current.filter((guest) => guest !== email));
  }

  function handleGuestKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault();
      commitGuestInput();
      return;
    }

    if (event.key === 'Backspace' && !guestInput && guestEmails.length) {
      setGuestEmails((current) => current.slice(0, -1));
    }
  }

  function handleGuestPaste(event: React.ClipboardEvent<HTMLInputElement>): void {
    const text = event.clipboardData.getData('text');
    if (!/[;,\n]/.test(text)) {
      return;
    }

    event.preventDefault();
    commitGuestInput(`${guestInput},${text}`);
  }

  async function deleteEvent(): Promise<void> {
    if (!event || !onDelete) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${event.title || 'Untitled event'}"?`);
    if (!shouldDelete) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await onDelete(event);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete event');
    } finally {
      setDeleting(false);
    }
  }

  const isEditMode = mode === 'edit';
  const titleId = isEditMode ? 'edit-title' : 'create-title';
  const submitLabel = isEditMode ? 'Save' : 'Create';
  const pendingLabel = isEditMode ? 'Saving...' : 'Creating...';

  function changeDuration(nextDuration: (typeof CREATE_DURATION_MINUTES)[number]): void {
    setDurationMinutes(nextDuration);
    const options = createQuarterHourOptions(nextDuration);
    if (!options.includes(startTime)) {
      setStartTime(options.at(-1) ?? startTime);
    }
  }

  function toggleVideoProvider(provider: CreatableVideoProvider): void {
    if (addVideoCall && videoProvider === provider) {
      setAddVideoCall(false);
      return;
    }

    setVideoProvider(provider);
    setAddVideoCall(true);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="create-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <h2 id={titleId}>{isEditMode ? 'Edit event' : 'Create event'}</h2>
            <p>{format(modalDate, 'EEEE, MMMM d')}</p>
          </div>
          <button type="button" className="icon-button" aria-label={isEditMode ? 'Close edit event' : 'Close create event'} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <label className="field-label">
          Title
          <input autoFocus={!isEditMode} value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Event title" />
        </label>

        <label className="field-label">
          Date
          <input type="date" value={dateValue} onChange={(event) => setDateValue(event.currentTarget.value)} />
        </label>

        {isEditMode ? (
          <div className="form-grid">
            <label className="field-label">
              Start
              <input type="time" step={900} value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} />
            </label>
            <label className="field-label">
              End
              <input type="time" step={900} value={endTime} onChange={(event) => setEndTime(event.currentTarget.value)} />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field-label">
              Start
              <select value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)}>
                {startTimeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeOption(time)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Duration
              <select value={durationMinutes} onChange={(event) => changeDuration(Number(event.currentTarget.value) as (typeof CREATE_DURATION_MINUTES)[number])}>
                {CREATE_DURATION_MINUTES.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} min
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="field-label">
          Calendar
          <select value={calendarId} onChange={(event) => setCalendarId(event.currentTarget.value)} disabled={isEditMode}>
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
          {isEditMode ? <span className="field-help">Moving between calendars is coming next.</span> : null}
        </label>

        {!isEditMode ? (
          <div className="field-label">
            <span>Video</span>
            <div className="video-provider-picker" role="group" aria-label="Choose video provider">
              {VIDEO_PROVIDER_OPTIONS.map((option) => {
                const selected = addVideoCall && videoProvider === option.provider;
                return (
                  <button
                    key={option.provider}
                    type="button"
                    className={cn('video-provider-button', selected && 'selected')}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remove' : 'Add'} ${option.label} video meeting`}
                    title={option.label}
                    onClick={() => toggleVideoProvider(option.provider)}
                  >
                    <img className="video-provider-icon" src={option.icon} alt="" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="field-label">
          <span>Guests</span>
          <div className="guest-token-field" onClick={(event) => event.currentTarget.querySelector('input')?.focus()}>
            {guestEmails.map((email) => (
              <span className="guest-chip" key={email}>
                <span className="guest-chip-label">{email}</span>
                <button type="button" className="guest-chip-remove" aria-label={`Remove ${email}`} onClick={() => removeGuest(email)}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className="guest-token-input"
              value={guestInput}
              onBlur={() => commitGuestInput()}
              onChange={(event) => setGuestInput(event.currentTarget.value)}
              onKeyDown={handleGuestKeyDown}
              onPaste={handleGuestPaste}
              placeholder={guestEmails.length ? 'Add guest' : 'name@example.com'}
            />
          </div>
        </div>

        <label className="field-label">
          Location
          <input value={location} onChange={(event) => setLocation(event.currentTarget.value)} placeholder="Room, address, or short note" />
        </label>

        <label className="field-label">
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} rows={3} />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-actions modal-actions-split">
          {isEditMode && onDelete ? (
            <button type="button" className="danger-button" disabled={isDeleting || isSubmitting} onClick={deleteEvent}>
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <span />
          )}
          <div className="modal-action-group">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting || isDeleting}>
              {isSubmitting ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function parseGuestTokens(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((guest) => guest.trim())
    .filter(Boolean);
}

function uniqueGuests(guests: string[]): string[] {
  const seen = new Set<string>();
  return guests.filter((guest) => {
    const key = guest.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createQuarterHourOptions(durationMinutes: number): string[] {
  const latestStart = 24 * 60 - durationMinutes - 15;
  const options: string[] = [];

  for (let minute = 0; minute <= latestStart; minute += 15) {
    options.push(timeFromMinutes(minute));
  }

  return options;
}

function timeFromMinutes(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function minutesFromTime(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function addMinutesToTime(time: string, minutes: number): string {
  return timeFromMinutes(minutesFromTime(time) + minutes);
}

function formatTimeOption(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function nearestCreateDuration(minutes: number): (typeof CREATE_DURATION_MINUTES)[number] {
  return CREATE_DURATION_MINUTES.reduce((best, duration) => {
    return Math.abs(duration - minutes) < Math.abs(best - minutes) ? duration : best;
  }, 30);
}
