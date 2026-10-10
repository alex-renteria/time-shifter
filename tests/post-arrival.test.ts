import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/engine';
import { DAY, HOUR, zonedParts } from '../src/time';
import { flight, profile } from './helpers';

const viaNadi = [flight('LAX', 'NAN', '2026-10-27', '22:30', 11), flight('NAN', 'MEL', '2026-10-30', '08:30', 5.5)];
const sleeps = (postDays: number) =>
  buildPlan({ ...profile, postDays }, viaNadi).advice.filter((a) => a.kind === 'sleep' || a.kind === 'sleep_flight');

describe('finish adjusting after landing', () => {
  it('when I land: already on local time the first night in Melbourne', () => {
    const night = sleeps(0).find((s) => s.tz === 'Australia/Melbourne')!;
    expect(zonedParts(night.tz, night.start).hour).toBe(22);
  });

  it('2 days after: still shifting the first night, on local time by the second', () => {
    const nights = sleeps(2).filter((s) => s.tz === 'Australia/Melbourne');
    expect(zonedParts(nights[0].tz, nights[0].start).hour).not.toBe(22);
    expect(zonedParts(nights[1].tz, nights[1].start).hour).toBe(22);
  });

  it('pushes the "adjusted by" date later', () => {
    const at = (postDays: number) => buildPlan({ ...profile, postDays }, viaNadi).adaptedBy!;
    expect(at(2)).toBeGreaterThan(at(0));
    expect(at(2) - viaNadi[1].arrive).toBeLessThanOrEqual(2 * DAY);
  });

  it('never moves bedtime by more than 2 hours between nights, always in whole hours', () => {
    for (const postDays of [0, 1, 2]) {
      const plan = buildPlan({ ...profile, postDays }, [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)]);
      const starts = plan.advice.filter((a) => a.kind === 'sleep' && a.end! - a.start === 8 * HOUR).map((a) => a.start);
      for (let i = 1; i < starts.length; i++) {
        const gap = (starts[i] - starts[i - 1]) / HOUR;
        if (gap > 36) continue; // the night on the plane isn't a ground sleep
        expect(Math.abs(gap - 24)).toBeLessThanOrEqual(2);
        expect(Number.isInteger(gap)).toBe(true);
      }
    }
  });
});
