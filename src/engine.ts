// The jet lag planning engine. Pure: (profile, flights) -> plan, no I/O.
// Every rule here refers to a section of docs/SCIENCE.md.

import type { Airport } from './airports';
import { DAY, HOUR, offsetHours, roundToLocalHour, snapLocalHour, wrapHours } from './time';

export interface Profile {
  /** Usual bedtime, whole hour 0–23 (e.g. 22). */
  sleepHour: number;
  /** Usual wake time, whole hour 0–23 (e.g. 6). */
  wakeHour: number;
  /** Days to start adjusting before the first departure (0–3). */
  preDays: number;
  melatonin: boolean;
  /** Suggest short naps: in flight, and early afternoon on travel/adjustment days. */
  naps: boolean;
  caffeine: boolean;
}

export interface Flight {
  from: Airport;
  to: Airport;
  /** UTC instants. */
  depart: number;
  arrive: number;
}

export type AdviceKind =
  | 'depart'
  | 'arrive'
  | 'sleep'
  | 'sleep_flight'
  | 'nap'
  | 'light_seek'
  | 'light_avoid'
  | 'melatonin'
  | 'caffeine_cutoff';

export interface Advice {
  kind: AdviceKind;
  start: number;
  /** Absent for point-in-time advice (melatonin, caffeine cutoff, depart, arrive). */
  end?: number;
  /** Zone the times should be shown in: where the traveler is (destination zone in flight). */
  tz: string;
  place: string;
  inFlight: boolean;
  /** Pre-travel sleep: hours earlier (+) or later (-) than the usual bedtime. */
  shiftFromUsual?: number;
  /** Melatonin only: 'shift' moves the body clock; 'sleep' helps you fall asleep on the plane. */
  purpose?: 'shift' | 'sleep';
  flight?: Flight;
}

export type Direction = 'advance' | 'delay' | 'none';

export interface Plan {
  advice: Advice[];
  /** Direction and size of the shift toward the first long stay (SCIENCE §3). */
  direction: Direction;
  shiftHours: number;
  /** Bedtime of the first night with an adjusted schedule, if any. */
  startShifting?: number;
  /** Bedtime of the first night the body clock matches the final destination. */
  adaptedBy?: number;
}

// --- Tunable constants (SCIENCE.md) --------------------------------------------------

/** CBTmin sits about 2.5 h before habitual wake (§1). */
export const CBT_BEFORE_WAKE_H = 2.5;
/** Shift rates in hours/day (§3). Pre-travel is gentler because it fights home light. */
export const PRE_TRAVEL_RATE_H = 1;
export const ADVANCE_RATE_H = 1.5;
export const DELAY_RATE_H = 2;
/** Eastward shifts larger than this go the other way round the clock as a delay (§3). */
export const MAX_ADVANCE_H = 9;
/** A stay shorter than this is not worth adapting to (§7). */
export const SHORT_STAY_H = 72;
/** Light windows relative to CBTmin (§2). */
export const LIGHT_WINDOW_H = { advanceSeek: [0, 5], advanceAvoid: [-9, 0], delaySeek: [-9, 0], delayAvoid: [0, 6] };
/** Low-dose melatonin this long before target bedtime when advancing (§4). */
export const MELATONIN_BEFORE_SLEEP_H = 4;
export const MELATONIN_DOSE_MG = 0.5;
/** No caffeine this long before target bedtime (§5). */
export const CAFFEINE_CUTOFF_H = 6;
/** Time at the airport before a flight and after landing, when sleep isn't possible. */
export const AIRPORT_BEFORE_H = 2;
export const AIRPORT_AFTER_H = 1;
/** Shorter scraps of sleep left over around flights aren't worth suggesting. */
export const MIN_GROUND_SLEEP_H = 2;
export const MIN_FLIGHT_SLEEP_H = 1;
/** Melatonin to sleep on the plane: 1 h before (fast-release peaks in 30–60 min), only
 *  if the planned in-flight sleep is long enough to sleep it off (§4). */
export const FLIGHT_MELATONIN_BEFORE_H = 1;
export const FLIGHT_MELATONIN_MIN_SLEEP_H = 4;
/** Afternoon nap window, relative to tonight's bedtime: 9–7 h before (e.g. 1–3 pm for a 10 pm bedtime) (§6). */
export const AFTERNOON_NAP_H = [-9, -7];
/** In-flight nap rules (§6). */
export const NAP_MIN_FLIGHT_H = 6;
export const NAP_CLEAR_OF_SLEEP_H = 6;

const MAX_NIGHTS = 40;

// --- Interval helpers ----------------------------------------------------------------

type Interval = [number, number];

function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let pieces: Interval[] = [base];
  for (const [cs, ce] of cuts) {
    const next: Interval[] = [];
    for (const [s, e] of pieces) {
      if (ce <= s || cs >= e) {
        next.push([s, e]);
        continue;
      }
      if (cs > s) next.push([s, cs]);
      if (ce < e) next.push([ce, e]);
    }
    pieces = next;
  }
  return pieces;
}

function intersect([a, b]: Interval, [c, d]: Interval): Interval | null {
  const s = Math.max(a, c);
  const e = Math.min(b, d);
  return e > s ? [s, e] : null;
}

// --- Itinerary helpers ---------------------------------------------------------------

interface Stay {
  airport: Airport;
  start: number;
  end: number;
  long: boolean;
}

function staysOf(flights: Flight[]): Stay[] {
  return flights.map((f, i) => {
    const end = i + 1 < flights.length ? flights[i + 1].depart : Infinity;
    return { airport: f.to, start: f.arrive, end, long: end - f.arrive >= SHORT_STAY_H * HOUR };
  });
}

/** UTC offset (hours) the body clock should be heading for at instant `t`. */
function targetOffset(t: number, flights: Flight[], stays: Stay[]): number {
  const candidates = t < flights[0].depart ? stays : stays.filter((s) => s.end > t);
  const target = candidates.find((s) => s.long) ?? stays[stays.length - 1];
  return offsetHours(target.airport.tz, Math.max(t, target.start));
}

/** Where the traveler is at `t`: zone to display times in, and place name. */
function locate(t: number, flights: Flight[]): { tz: string; place: string; flight?: Flight } {
  if (t < flights[0].depart) return { tz: flights[0].from.tz, place: flights[0].from.city };
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (t >= f.depart && t < f.arrive) return { tz: f.to.tz, place: `On board to ${f.to.city}`, flight: f };
    const nextDepart = i + 1 < flights.length ? flights[i + 1].depart : Infinity;
    if (t >= f.arrive && t < nextDepart) return { tz: f.to.tz, place: f.to.city };
  }
  const last = flights[flights.length - 1];
  return { tz: last.to.tz, place: last.to.city };
}

export function validate(profile: Profile, flights: Flight[]): string[] {
  const errors: string[] = [];
  if (profile.sleepHour === profile.wakeHour) errors.push('Bedtime and wake time must be different.');
  if (flights.length === 0) errors.push('Add at least one flight.');
  flights.forEach((f, i) => {
    if (f.arrive <= f.depart) errors.push(`Flight ${i + 1}: duration must be more than zero.`);
    if (i > 0 && f.depart < flights[i - 1].arrive + HOUR)
      errors.push(`Flight ${i + 1} must depart at least 1 hour after flight ${i} lands.`);
  });
  return errors;
}

// --- The planner ---------------------------------------------------------------------

export function buildPlan(profile: Profile, flights: Flight[]): Plan {
  const errors = validate(profile, flights);
  if (errors.length) throw new Error(errors.join(' '));

  const stays = staysOf(flights);
  const firstDepart = flights[0].depart;
  const lastArrive = flights[flights.length - 1].arrive;

  // Body clock state: "body time" = UTC + bodyOffset hours (§1).
  const homeOffset = offsetHours(flights[0].from.tz, firstDepart);
  let bodyOffset = homeOffset;
  const sleepLen = (profile.wakeHour - profile.sleepHour + 24) % 24;
  const cbtBody = (profile.wakeHour - CBT_BEFORE_WAKE_H + 24) % 24;

  // First night: the pre-travel window, or the night before departure.
  const planStart = firstDepart - Math.max(profile.preDays, 1) * DAY;
  const startHour = (((planStart / HOUR + bodyOffset) % 24) + 24) % 24;
  let cbt = planStart + ((cbtBody - startHour + 24) % 24) * HOUR;

  const raw: Advice[] = [];
  const shifts: { kind: 'advance' | 'delay'; seek: Interval; avoid: Interval }[] = [];
  let summaryDirection: Direction | undefined;
  let summaryHours = 0;
  let startShifting: number | undefined;
  let adaptedBy: number | undefined;
  const napWindows: Interval[] = [];

  for (let night = 0; night < MAX_NIGHTS; night++) {
    const preTravel = cbt < firstDepart;
    const allowShift = !preTravel || firstDepart - cbt <= profile.preDays * DAY;
    const d = wrapHours(targetOffset(cbt, flights, stays) - bodyOffset);

    // Direction and remaining shift (§3).
    let direction: Direction = 'none';
    let remaining = 0;
    if (Math.abs(d) >= 0.25) {
      if (d > 0 && d <= MAX_ADVANCE_H) [direction, remaining] = ['advance', d];
      else if (d > 0) [direction, remaining] = ['delay', 24 - d];
      else [direction, remaining] = ['delay', -d];
    }
    if (summaryDirection === undefined && (direction !== 'none' || !preTravel)) {
      summaryDirection = direction;
      summaryHours = remaining;
    }
    if (!allowShift) direction = 'none';

    const rate = preTravel ? PRE_TRAVEL_RATE_H : direction === 'advance' ? ADVANCE_RATE_H : DELAY_RATE_H;
    const r = direction === 'none' ? 0 : Math.min(rate, remaining);
    const step = direction === 'advance' ? r : -r; // change in bodyOffset

    // Tonight's sleep follows the clock as it will be after tonight's shift.
    const anchor = cbt - step * HOUR;
    const sleepStart = anchor - (sleepLen - CBT_BEFORE_WAKE_H) * HOUR;
    const sleepEnd = anchor + CBT_BEFORE_WAKE_H * HOUR;
    const where = locate(sleepStart, flights);
    const totalShift = bodyOffset + step - homeOffset;
    raw.push({
      kind: 'sleep',
      start: sleepStart,
      end: sleepEnd,
      ...where,
      inFlight: false,
      shiftFromUsual: sleepStart < firstDepart ? totalShift : undefined,
    });
    if (direction !== 'none' && startShifting === undefined) startShifting = sleepStart;

    if (direction !== 'none') {
      const w = LIGHT_WINDOW_H;
      const at = ([a, b]: number[]): Interval => [cbt + a * HOUR, cbt + b * HOUR];
      shifts.push(
        direction === 'advance'
          ? { kind: 'advance', seek: at(w.advanceSeek), avoid: at(w.advanceAvoid) }
          : { kind: 'delay', seek: at(w.delaySeek), avoid: at(w.delayAvoid) },
      );
      if (direction === 'advance' && profile.melatonin) {
        const t = sleepStart - MELATONIN_BEFORE_SLEEP_H * HOUR;
        raw.push({ kind: 'melatonin', purpose: 'shift', start: t, ...locate(t, flights), inFlight: !!locate(t, flights).flight });
      }
    }
    // Afternoon nap on travel and adjustment days; not once adjusted, unless you landed that day.
    const finishing = direction === 'none' && cbt + DAY > lastArrive;
    const landedToday = flights.some((f) => f.arrive > sleepStart - DAY && f.arrive < sleepStart);
    if (profile.naps && !preTravel && (!finishing || landedToday)) {
      napWindows.push([sleepStart + AFTERNOON_NAP_H[0] * HOUR, sleepStart + AFTERNOON_NAP_H[1] * HOUR]);
    }
    if (profile.caffeine) {
      const t = sleepStart - CAFFEINE_CUTOFF_H * HOUR;
      raw.push({ kind: 'caffeine_cutoff', start: t, ...locate(t, flights), inFlight: !!locate(t, flights).flight });
    }

    bodyOffset += step;
    cbt += DAY - step * HOUR;

    if (cbt > lastArrive && direction === 'none' && !preTravel) {
      adaptedBy = sleepStart;
      break;
    }
  }

  return {
    advice: finalize(raw, shifts, flights, profile, napWindows),
    direction: summaryDirection ?? 'none',
    shiftHours: summaryHours,
    startShifting,
    adaptedBy,
  };
}

// --- Real-world filter (SPEC step 5) -------------------------------------------------

function finalize(
  raw: Advice[],
  shifts: { kind: 'advance' | 'delay'; seek: Interval; avoid: Interval }[],
  flights: Flight[],
  profile: Profile,
  napWindows: Interval[],
): Advice[] {
  const out: Advice[] = [];
  const flightSpans: Interval[] = flights.map((f) => [f.depart, f.arrive]);
  const airportSpans: Interval[] = flights.map((f) => [f.depart - AIRPORT_BEFORE_H * HOUR, f.arrive + AIRPORT_AFTER_H * HOUR]);
  const finalSleeps: Interval[] = [];

  // Sleep: on the plane it becomes in-flight sleep; at the airport it's dropped.
  for (const a of raw) {
    if (a.kind !== 'sleep') continue;
    const span: Interval = [a.start, a.end!];
    for (const piece of subtract(span, airportSpans)) {
      if (piece[1] - piece[0] < MIN_GROUND_SLEEP_H * HOUR) continue;
      finalSleeps.push(piece);
      out.push({ ...a, start: piece[0], end: piece[1], ...locate(piece[0], flights), inFlight: false });
    }
    flights.forEach((f, i) => {
      const piece = intersect(span, flightSpans[i]);
      if (!piece || piece[1] - piece[0] < MIN_FLIGHT_SLEEP_H * HOUR) return;
      finalSleeps.push(piece);
      out.push({ ...a, kind: 'sleep_flight', start: piece[0], end: piece[1], ...locate(piece[0], flights), inFlight: true, flight: f, shiftFromUsual: undefined });
    });
  }

  // Light: never while asleep (§2). Seek/avoid windows on board stay, with in-flight wording.
  const lightPieces: { kind: 'light_seek' | 'light_avoid'; span: Interval }[] = [];
  for (const s of shifts) {
    for (const span of subtract(s.seek, finalSleeps)) lightPieces.push({ kind: 'light_seek', span });
    for (const span of subtract(s.avoid, finalSleeps)) lightPieces.push({ kind: 'light_avoid', span });
  }
  for (const { kind, span } of lightPieces) {
    // Split at flight boundaries so each piece shows in the right zone and wording.
    const boundaries = flights.flatMap((f) => [f.depart, f.arrive]).filter((t) => t > span[0] && t < span[1]);
    const cuts = [span[0], ...boundaries, span[1]];
    for (let i = 0; i < cuts.length - 1; i++) {
      const where = locate(cuts[i], flights);
      out.push({ kind, start: cuts[i], end: cuts[i + 1], ...where, inFlight: !!where.flight });
    }
  }

  // Naps: on long flights with no planned sleep, a short nap well clear of bedtime (§6).
  const seekSpans = lightPieces.filter((p) => p.kind === 'light_seek').map((p) => p.span);
  flights.forEach((f, i) => {
    if (!profile.naps) return;
    if (f.arrive - f.depart < NAP_MIN_FLIGHT_H * HOUR) return;
    if (finalSleeps.some((s) => intersect(s, flightSpans[i]))) return;
    const nextSleep = finalSleeps.map((s) => s[0]).filter((t) => t >= f.depart).sort((a, b) => a - b)[0] ?? Infinity;
    const window = intersect(flightSpans[i], [f.depart, nextSleep - NAP_CLEAR_OF_SLEEP_H * HOUR]);
    if (!window) return;
    const options = subtract(window, seekSpans).filter(([s, e]) => e - s >= HOUR);
    const best = options.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (best) out.push({ kind: 'nap', start: best[0], end: best[1], ...locate(best[0], flights), inFlight: true, flight: f });
  });

  // Afternoon naps on the ground: never in bright-light time, asleep, or around flights (§6).
  for (const w of napWindows) {
    const options = subtract(w, [...airportSpans, ...finalSleeps, ...seekSpans]).filter(([s, e]) => e - s >= HOUR);
    const best = options.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (best) out.push({ kind: 'nap', start: best[0], end: best[1], ...locate(best[0], flights), inFlight: false });
  }

  // Melatonin to sleep on the plane, 1 h before a long enough in-flight sleep (§4).
  const flightDoses: number[] = [];
  if (profile.melatonin) {
    for (const a of out) {
      if (a.kind !== 'sleep_flight' || a.end! - a.start < FLIGHT_MELATONIN_MIN_SLEEP_H * HOUR) continue;
      const t = a.start - FLIGHT_MELATONIN_BEFORE_H * HOUR;
      flightDoses.push(a.start);
      const where = locate(t, flights);
      out.push({ kind: 'melatonin', purpose: 'sleep', start: t, ...where, inFlight: !!where.flight, flight: a.flight });
    }
  }

  // Point advice passes through (melatonin, caffeine). A clock-shifting dose meant for the
  // same night as an in-flight dose is dropped so nobody doubles up.
  const tooClose = (t: number) => flightDoses.some((s) => t >= s - 9 * HOUR && t <= s);
  for (const a of raw) {
    if (a.kind === 'caffeine_cutoff') out.push(a);
    if (a.kind === 'melatonin' && !tooClose(a.start)) out.push(a);
  }

  // Flights themselves (exact times, not rounded).
  for (const f of flights) {
    out.push({ kind: 'depart', start: f.depart, tz: f.from.tz, place: f.from.city, inFlight: false, flight: f });
    out.push({ kind: 'arrive', start: f.arrive, tz: f.to.tz, place: f.to.city, inFlight: false, flight: f });
  }

  // Whole hours only on the local clock; drop windows that round away to nothing.
  const rounded = out
    .map((a) => {
      if (a.kind === 'depart' || a.kind === 'arrive') return a;
      const start = roundToLocalHour(a.tz, a.start);
      const end = a.end === undefined ? undefined : roundToLocalHour(a.tz, a.end);
      return { ...a, start, end };
    })
    .filter((a) => a.end === undefined || a.end > a.start);

  // Rounding in different zones can nudge a window into sleep; sleep wins.
  const roundedSleeps: Interval[] = rounded
    .filter((a) => a.kind === 'sleep' || a.kind === 'sleep_flight')
    .map((a) => [a.start, a.end!]);
  const trimmed = rounded.flatMap((a) => {
    if (a.kind !== 'light_seek' && a.kind !== 'light_avoid' && a.kind !== 'nap') return [a];
    return subtract([a.start, a.end!], roundedSleeps)
      .map(([start, end]) => ({ ...a, start: snapLocalHour(a.tz, start, 'up'), end: snapLocalHour(a.tz, end, 'down') }))
      .filter((p) => p.end > p.start);
  });

  return trimmed.sort((a, b) => a.start - b.start || order(a.kind) - order(b.kind));
}

const ORDER: AdviceKind[] = ['arrive', 'depart', 'sleep', 'sleep_flight', 'nap', 'light_avoid', 'light_seek', 'melatonin', 'caffeine_cutoff'];
const order = (k: AdviceKind) => ORDER.indexOf(k);
