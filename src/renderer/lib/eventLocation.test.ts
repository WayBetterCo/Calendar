import { describe, expect, it } from 'vitest';
import { getGoogleMapsUrl } from './eventLocation';

describe('physical event locations', () => {
  it.each([undefined, '', ' \t\n '])('skips an empty location', (location) => {
    expect(getGoogleMapsUrl(location)).toBeNull();
  });

  it.each([
    'Boardroom 3',
    '  123 Main St, Vancouver, BC  ',
    'Café & Studio #2, 100% Main Street',
    '500 W Georgia St\nFloor 12\nVancouver, BC',
    'St. Louis Office',
    'Room: Boardroom 3',
    'Address:\n500 W Georgia St\nVancouver, BC',
    'Zoom Room 3',
  ])('encodes the complete address or room name as a Maps search: %s', (location) => {
    const result = new URL(getGoogleMapsUrl(location)!);
    expect(`${result.origin}${result.pathname}`).toBe('https://www.google.com/maps/search/');
    expect(result.searchParams.get('api')).toBe('1');
    expect(result.searchParams.get('query')).toBe(location.trim());
    expect([...result.searchParams.keys()]).toEqual(['api', 'query']);
  });

  it('uses URLSearchParams encoding so address punctuation cannot add URL parameters', () => {
    expect(getGoogleMapsUrl('Studio #2 & Café')).toBe('https://www.google.com/maps/search/?api=1&query=Studio+%232+%26+Caf%C3%A9');
  });
});

describe('existing Google Maps URLs', () => {
  it.each([
    'https://www.google.com/maps/place/Vancouver/@49.28,-123.12,15z',
    'https://google.com/maps?api=1&query=Main+Street',
    'http://maps.google.com/?q=Boardroom+3',
    'https://maps.app.goo.gl/AbCd123',
    'https://goo.gl/maps/AbCd123',
    'https://www.google.ca/maps/place/Vancouver',
    'https://google.ca/maps?api=1&query=Main+Street',
    'https://maps.google.ca/?q=Vancouver',
  ])('preserves approved Maps links: %s', (location) => {
    expect(getGoogleMapsUrl(` ${location} `)).toBe(location);
  });

  it('normalizes an approved link before opening it', () => {
    expect(getGoogleMapsUrl('https://WWW.GOOGLE.COM:443/maps/place/Main Street')).toBe('https://www.google.com/maps/place/Main%20Street');
  });
});

describe('nonphysical and unsafe locations', () => {
  it.each([
    'https://meet.google.com/abc-defg-hij',
    'https://us02web.zoom.us/j/123456789',
    'https://teams.microsoft.com/l/meetup-join/example',
    'https://example.com/office',
    'meet.google.com/abc-defg-hij',
    'zoom.us/j/123456789',
    '//meet.google.com/abc-defg-hij',
    'www.google.com/maps/place/Vancouver',
    'https://',
    'https:/',
    'mailto:person@example.com',
    'tel:+16045550123',
    'javascript:alert(1)',
    'javascript: alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data: text/html,<script>alert(1)</script>',
    'mailto: person@example.com',
    'file:///Users/shared/event',
    'ftp://example.com/office',
    'https://person:password@www.google.com/maps',
    'https://www.google.com:8443/maps',
    'https://www.google.com/maps-other',
    'https://www.google.com/search?q=maps',
    'https://www.google.com.evil.example/maps',
    'https://maps.google.com.evil.example/place/office',
    'https://evil.example/?next=https://www.google.com/maps',
    'https://goo.gl/maps-other/123',
    'https://goo.gl/anything-else',
    'https://maps.app.goo.gl.evil.example/123',
    'https://www.google.ca.evil.example/maps/place/Vancouver',
    'https://maps.google.ca.evil.example/?q=Vancouver',
    '123 Main\u0000Street',
  ])('does not open or search a URL-like location: %s', (location) => {
    expect(getGoogleMapsUrl(location)).toBeNull();
  });

  it.each([
    'Zoom', 'Zoom meeting', 'Google Meet', 'Google Meet Meeting', 'Teams', 'Teams meeting',
    'Microsoft Teams Meeting', 'Webex', 'Cisco Webex Meeting', 'Online', 'Remote', 'Virtual',
    'Virtual meeting', 'TBD', 'TBA', 'TBC', 'N/A', '  microsoft  teams   meeting  ',
  ])('skips virtual meeting labels and location placeholders: %s', (location) => {
    expect(getGoogleMapsUrl(location)).toBeNull();
  });
});
