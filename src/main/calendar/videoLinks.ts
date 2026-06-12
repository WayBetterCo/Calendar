import type { VideoConference, VideoProvider } from '../../shared/calendar';

const VIDEO_PATTERNS: Array<{ provider: VideoProvider; label: string; regex: RegExp }> = [
  {
    provider: 'google_meet',
    label: 'Meet',
    regex: /https?:\/\/(meet\.google\.com\/[^\s<]+)/i,
  },
  {
    provider: 'zoom',
    label: 'Zoom',
    regex: /https?:\/\/([a-z0-9.-]*zoom\.us\/j\/[^\s<]+)/i,
  },
  {
    provider: 'teams',
    label: 'Teams',
    regex: /https?:\/\/teams\.microsoft\.com\/[^\s<]+/i,
  },
];

export function classifyVideoUrl(url: string): VideoConference {
  for (const pattern of VIDEO_PATTERNS) {
    if (pattern.regex.test(url)) {
      return { provider: pattern.provider, label: pattern.label, url };
    }
  }

  return { provider: 'unknown', label: 'Join', url };
}

export function extractVideoConference(input: {
  conferenceUrl?: string;
  location?: string;
  description?: string;
}): VideoConference | null {
  const direct = input.conferenceUrl?.trim();

  if (direct) {
    return classifyVideoUrl(direct);
  }

  const haystack = [input.location, input.description].filter(Boolean).join('\n');

  for (const pattern of VIDEO_PATTERNS) {
    const match = haystack.match(pattern.regex);
    if (match?.[0]) {
      return {
        provider: pattern.provider,
        label: pattern.label,
        url: match[0],
      };
    }
  }

  return null;
}
