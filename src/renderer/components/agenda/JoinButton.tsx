import type { CalendarEvent, VideoConference } from '../../types/calendar';
import { calendarApi } from '../../api/calendarApi';
import meetIcon from '../../assets/icons/google-meet.svg';
import teamsIcon from '../../assets/icons/microsoft-teams.svg';
import zoomIcon from '../../assets/icons/zoom.svg';

type JoinButtonProps = {
  event: CalendarEvent;
  video: VideoConference;
};

export function JoinButton({ event, video }: JoinButtonProps): React.JSX.Element {
  const icon = video.provider === 'zoom' ? zoomIcon : video.provider === 'teams' ? teamsIcon : video.provider === 'google_meet' ? meetIcon : null;

  return (
    <button
      type="button"
      className="join-button"
      aria-label={`Join ${video.label} meeting for ${event.title}`}
      title={`Join ${video.label}`}
      onClick={() => void calendarApi.openExternal(video.url)}
    >
      {icon ? <img className="meeting-provider-icon" src={icon} alt="" aria-hidden="true" /> : null}
    </button>
  );
}
