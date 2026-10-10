import { describe, expect, it } from 'vitest';
import { buildPlan, validate, type Advice } from '../src/engine';
import { zonedParts } from '../src/time';
import { flight, profile } from './helpers';

const local = (a: Advice, t = a.start) => zonedParts(a.tz, t);
const of = (advice: Advice[], kind: Advice['kind']) => advice.filter((a) => a.kind === kind);
const overlaps = (a: Advice, b: Advice) => a.start < b.end! && b.start < a.end!;

describe('LAX → LHR (8 h east)', () => {
  const plan = buildPlan(profile, [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)]);

  it('advances by 8 hours', () => {
    expect(plan.direction).toBe('advance');
    expect(plan.shiftHours).toBe(8);
  });

  it('moves bedtime 1 h earlier on each of the 3 days before departure', () => {
    const pre = of(plan.advice, 'sleep').filter((a) => a.shiftFromUsual !== undefined).slice(0, 3);
    expect(pre.map((a) => a.shiftFromUsual)).toEqual([1, 2, 3]);
    expect(pre.map((a) => local(a).hour)).toEqual([21, 20, 19]);
    expect(plan.startShifting).toBe(pre[0].start);
  });

  it('ends on the usual 10 pm – 6 am in London', () => {
    const last = of(plan.advice, 'sleep').at(-1)!;
    expect(last.tz).toBe('Europe/London');
    expect([local(last).hour, local(last, last.end).hour]).toEqual([22, 6]);
    expect(plan.adaptedBy).toBeDefined();
  });

  it('gives melatonin only while advancing', () => {
    expect(of(plan.advice, 'melatonin').length).toBeGreaterThan(0);
    const noMel = buildPlan({ ...profile, melatonin: false }, [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)]);
    expect(of(noMel.advice, 'melatonin')).toHaveLength(0);
  });
});

describe('JFK → NRT (14 h east)', () => {
  it('goes the long way round as a 10 h delay', () => {
    const plan = buildPlan(profile, [flight('JFK', 'NRT', '2026-11-10', '12:00', 14)]);
    expect(plan.direction).toBe('delay');
    expect(plan.shiftHours).toBe(10);
    expect(of(plan.advice, 'melatonin')).toHaveLength(0);
    const pre = of(plan.advice, 'sleep').filter((a) => a.shiftFromUsual !== undefined);
    expect(pre[0].shiftFromUsual).toBe(-1); // 1 h later than usual
  });
});

describe('direction and size', () => {
  it.each([
    ['MEX', 'MAD', 11, 'advance', 7],
    ['LHR', 'JFK', 8, 'delay', 5],
    ['SFO', 'HNL', 6, 'delay', 2],
  ])('%s → %s', (from, to, hours, direction, shift) => {
    const plan = buildPlan(profile, [flight(from, to, '2026-11-10', '10:00', hours)]);
    expect(plan.direction).toBe(direction);
    expect(plan.shiftHours).toBe(shift);
  });
});

describe('real-world rules', () => {
  const trips = {
    'LAX → LHR': [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)],
    'JFK → NRT': [flight('JFK', 'NRT', '2026-11-10', '12:00', 14)],
    'LHR → DEL (+5:30)': [flight('LHR', 'DEL', '2026-11-10', '20:30', 8.75)],
    'four legs': [
      flight('LAX', 'JFK', '2026-11-01', '08:00', 5.5),
      flight('JFK', 'LHR', '2026-11-03', '19:00', 7),
      flight('LHR', 'DXB', '2026-11-10', '09:00', 7),
      flight('DXB', 'SIN', '2026-11-12', '02:30', 7.5),
    ],
  };

  for (const [name, flights] of Object.entries(trips)) {
    describe(name, () => {
      const plan = buildPlan(profile, flights);
      const advice = plan.advice.filter((a) => a.kind !== 'depart' && a.kind !== 'arrive');
      const sleeps = advice.filter((a) => a.kind === 'sleep' || a.kind === 'sleep_flight');

      it('uses whole local hours only', () => {
        for (const a of advice) {
          expect(local(a).minute).toBe(0);
          if (a.end) expect(local(a, a.end).minute).toBe(0);
        }
      });

      it('never gives light advice while asleep', () => {
        for (const light of advice.filter((a) => a.kind.startsWith('light'))) {
          for (const s of sleeps) expect(overlaps(light, s)).toBe(false);
        }
      });

      it('never plans ground sleep in the 2 h before a flight', () => {
        for (const s of of(advice, 'sleep')) {
          for (const f of flights) expect(s.end! <= f.depart - 2 * 3_600_000 || s.start >= f.arrive).toBe(true);
        }
      });

      it('finishes adapted to the final destination', () => {
        expect(plan.adaptedBy).toBeGreaterThan(flights.at(-1)!.arrive);
        const last = of(advice, 'sleep').at(-1)!;
        expect(last.tz).toBe(flights.at(-1)!.to.tz);
        expect(local(last).hour).toBe(22);
      });
    });
  }

  it('stays on home time for a short round trip (§7)', () => {
    const plan = buildPlan(profile, [
      flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5),
      flight('LHR', 'LAX', '2026-11-13', '10:00', 11),
    ]);
    expect(plan.direction).toBe('none');
    expect(plan.advice.some((a) => a.kind.startsWith('light'))).toBe(false);
  });
});

describe('validate', () => {
  it('rejects overlapping flights and identical sleep/wake times', () => {
    const errors = validate({ ...profile, wakeHour: 22 }, [
      flight('LAX', 'JFK', '2026-11-10', '08:00', 5.5),
      flight('JFK', 'LHR', '2026-11-10', '10:00', 7),
    ]);
    expect(errors).toHaveLength(2);
  });
});
