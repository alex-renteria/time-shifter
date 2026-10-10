import { describe, expect, it } from 'vitest';
import { localDateKey, offsetHours, roundToLocalHour, wrapHours, zonedParts, zonedToInstant } from '../src/time';

describe('time zones', () => {
  it('follows daylight saving time', () => {
    expect(offsetHours('America/New_York', Date.UTC(2026, 0, 15))).toBe(-5);
    expect(offsetHours('America/New_York', Date.UTC(2026, 6, 15))).toBe(-4);
  });

  it('handles half-hour and 45-minute zones', () => {
    expect(offsetHours('Asia/Kolkata', Date.UTC(2026, 0, 1))).toBe(5.5);
    expect(offsetHours('Asia/Kathmandu', Date.UTC(2026, 0, 1))).toBe(5.75);
  });

  it('converts local wall time to an instant and back', () => {
    const t = zonedToInstant('Asia/Tokyo', '2026-11-10', '21:35');
    expect(t).toBe(Date.UTC(2026, 10, 10, 12, 35));
    expect(zonedParts('Asia/Tokyo', t)).toMatchObject({ year: 2026, month: 11, day: 10, hour: 21, minute: 35 });
    expect(localDateKey('Asia/Tokyo', t)).toBe('2026-11-10');
  });

  it('rounds to whole hours on the local clock, even in half-hour zones', () => {
    const t = zonedToInstant('Asia/Kolkata', '2026-11-10', '07:20');
    expect(zonedParts('Asia/Kolkata', roundToLocalHour('Asia/Kolkata', t))).toMatchObject({ hour: 7, minute: 0 });
  });

  it('wraps hour differences into (-12, 12]', () => {
    expect(wrapHours(14)).toBe(-10);
    expect(wrapHours(-13)).toBe(11);
    expect(wrapHours(12)).toBe(12);
  });
});
