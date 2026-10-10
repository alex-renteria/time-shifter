import { describe, expect, it } from 'vitest';
import { describe as describeAdvice } from '../src/describe';
import type { Advice } from '../src/engine';
import { zonedToInstant, HOUR } from '../src/time';

const tz = 'Europe/London';
const light = (kind: Advice['kind'], time: string, hours: number, inFlight = false): Advice => {
  const start = zonedToInstant(tz, '2026-11-12', time);
  return { kind, start, end: start + hours * HOUR, tz, place: 'London', inFlight };
};

describe('light wording follows the time of day', () => {
  it('says go outside in daylight', () => {
    expect(describeAdvice(light('light_seek', '09:00', 3)).note).toMatch(/outside/);
  });

  it('suggests bright indoor light at night, not going outside', () => {
    const note = describeAdvice(light('light_seek', '20:00', 3)).note!;
    expect(note).toMatch(/indoors/);
    expect(note).not.toMatch(/outside|window/);
  });

  it('covers both when a window runs from day into night', () => {
    expect(describeAdvice(light('light_seek', '16:00', 4)).note).toMatch(/Daylight while it lasts/);
  });

  it('uses the reading light and screen on a night flight', () => {
    const note = describeAdvice(light('light_seek', '22:00', 3, true)).note!;
    expect(note).toMatch(/Reading light/);
    expect(note).not.toMatch(/shade open/);
  });

  it('suggests dim lights, not sunglasses, when avoiding light at night', () => {
    expect(describeAdvice(light('light_avoid', '21:00', 2)).note).toMatch(/dim/);
    expect(describeAdvice(light('light_avoid', '21:00', 2)).note).not.toMatch(/Sunglasses/);
  });
});
