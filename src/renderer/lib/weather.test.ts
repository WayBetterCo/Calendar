import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalWeatherForecast } from './weather';

afterEach(() => vi.unstubAllGlobals());

describe('local weather location', () => {
  it('does not substitute a guessed timezone city when device location is denied', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: unknown, denied: () => void) => denied() } });
    await expect(getLocalWeatherForecast('fahrenheit', '')).rejects.toThrow('Location permission');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses device coordinates even when browser storage cannot be written', async () => {
    const getDailyForecast = vi.fn().mockResolvedValue({ high: 21, low: 12, currentTemperature: 18, weatherCode: 1, unit: 'celsius' });
    vi.stubGlobal('window', { waybetterCalendar: { weather: { getDailyForecast } } });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Storage blocked'); } });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: (position: unknown) => void) => success({ coords: { latitude: 49.2827, longitude: -123.1207 } }) } });
    await expect(getLocalWeatherForecast('celsius', '')).resolves.toMatchObject({ high: 21 });
    expect(getDailyForecast).toHaveBeenCalledWith({ latitude: 49.2827, longitude: -123.1207, unit: 'celsius' });
  });
});
