import { findAirport } from '../src/airports';
import type { Flight, Profile } from '../src/engine';
import { HOUR, zonedToInstant } from '../src/time';

export const profile: Profile = { sleepHour: 22, wakeHour: 6, preDays: 3, melatonin: true, caffeine: true };

export function flight(from: string, to: string, date: string, time: string, hours: number): Flight {
  const a = findAirport(from)!;
  const b = findAirport(to)!;
  const depart = zonedToInstant(a.tz, date, time);
  return { from: a, to: b, depart, arrive: depart + hours * HOUR };
}
