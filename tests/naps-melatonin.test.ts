import { describe, expect, it } from 'vitest';
import { buildPlan, FLIGHT_MELATONIN_MIN_SLEEP_H, type Advice } from '../src/engine';
import { HOUR, zonedParts } from '../src/time';
import { flight, profile } from './helpers';

const overlaps = (a: Advice, b: Advice) => a.start < b.end! && b.start < a.end!;
const trips = {
  'LAX → LHR': [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)],
  'LAX → NAN → MEL': [flight('LAX', 'NAN', '2026-10-27', '22:30', 11), flight('NAN', 'MEL', '2026-10-30', '08:30', 5.5)],
  'JFK → NRT': [flight('JFK', 'NRT', '2026-11-10', '12:00', 14)],
};

describe('melatonin to sleep on the plane', () => {
  for (const [name, flights] of Object.entries(trips)) {
    it(`${name}: 1 h before each in-flight sleep of 4 h or more`, () => {
      const plan = buildPlan(profile, flights);
      const longSleeps = plan.advice.filter((a) => a.kind === 'sleep_flight' && a.end! - a.start >= FLIGHT_MELATONIN_MIN_SLEEP_H * HOUR);
      const doses = plan.advice.filter((a) => a.kind === 'melatonin' && a.purpose === 'sleep');
      expect(doses.map((d) => d.start)).toEqual(longSleeps.map((s) => s.start - HOUR));
    });
  }

  it('is given on the LAX → LHR overnight flight', () => {
    const plan = buildPlan(profile, trips['LAX → LHR']);
    expect(plan.advice.some((a) => a.kind === 'melatonin' && a.purpose === 'sleep')).toBe(true);
  });

  it('never doubles up with a clock-shifting dose that evening', () => {
    const plan = buildPlan(profile, trips['LAX → LHR']);
    const doses = plan.advice.filter((a) => a.kind === 'melatonin').map((a) => a.start).sort((a, b) => a - b);
    for (let i = 1; i < doses.length; i++) expect(doses[i] - doses[i - 1]).toBeGreaterThanOrEqual(8 * HOUR);
  });

  it('is left out when melatonin is turned off', () => {
    const plan = buildPlan({ ...profile, melatonin: false }, trips['LAX → LHR']);
    expect(plan.advice.some((a) => a.kind === 'melatonin')).toBe(false);
  });
});

describe('afternoon naps', () => {
  for (const [name, flights] of Object.entries(trips)) {
    describe(name, () => {
      const plan = buildPlan(profile, flights);
      const groundNaps = plan.advice.filter((a) => a.kind === 'nap' && !a.inFlight);
      const blockers = plan.advice.filter((a) => ['sleep', 'sleep_flight', 'light_seek'].includes(a.kind));

      it('offers at least one, from departure day on', () => {
        expect(groundNaps.length).toBeGreaterThan(0);
        for (const n of groundNaps) expect(n.start).toBeGreaterThan(flights[0].depart - 24 * HOUR);
      });

      it('never overlaps sleep, bright-light time or a flight', () => {
        for (const n of groundNaps) {
          for (const b of blockers) expect(overlaps(n, b)).toBe(false);
          for (const f of flights) expect(n.end! <= f.depart - 2 * HOUR || n.start >= f.arrive + HOUR).toBe(true);
        }
      });

      it('ends at least 7 hours before the next bedtime', () => {
        const sleeps = plan.advice.filter((a) => a.kind === 'sleep' || a.kind === 'sleep_flight');
        for (const n of groundNaps) {
          const next = sleeps.find((s) => s.start >= n.end!)!;
          expect(next.start - n.end!).toBeGreaterThanOrEqual(7 * HOUR);
        }
      });
    });
  }

  it('are left out when naps are turned off', () => {
    const plan = buildPlan({ ...profile, naps: false }, trips['LAX → NAN → MEL']);
    expect(plan.advice.some((a) => a.kind === 'nap')).toBe(false);
  });
});

it('LAX → NAN → MEL arrival day has an early-afternoon nap in Melbourne', () => {
  const plan = buildPlan(profile, trips['LAX → NAN → MEL']);
  const nap = plan.advice.find((a) => a.kind === 'nap' && a.tz === 'Australia/Melbourne')!;
  expect(nap).toBeDefined();
  const h = zonedParts(nap.tz, nap.start).hour;
  expect(h).toBeGreaterThanOrEqual(12);
  expect(h).toBeLessThanOrEqual(16);
});
