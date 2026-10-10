// Human wording for advice, shared by the web page and the calendar export.

import type { Advice } from './engine';
import { HOUR, zonedParts } from './time';

// --- Formatting ----------------------------------------------------------------------

export function fmtHour(hour: number, minute = 0): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${h12}:${String(minute).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export function fmtTime(tz: string, t: number): string {
  const p = zonedParts(tz, t);
  return fmtHour(p.hour, p.minute);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(tz: string, t: number): string {
  const p = zonedParts(tz, t);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
}

export function fmtRange(a: Advice): string {
  return `${fmtTime(a.tz, a.start)} – ${fmtTime(a.tz, a.end!)}`;
}

export const ICONS: Record<Advice['kind'], string> = {
  depart: '✈️',
  arrive: '🛬',
  sleep: '🛏️',
  sleep_flight: '😴',
  nap: '💤',
  light_seek: '☀️',
  light_avoid: '🕶️',
  melatonin: '💊',
  caffeine_cutoff: '☕',
};

/** Where in the flight a step falls, for when you don't know the time on board:
 *  "2–6 h after takeoff (10:30 pm – 2:30 am Los Angeles time)". */
export function flightPhase(a: Advice): string | undefined {
  const f = a.flight;
  if (!a.inFlight || !f) return undefined;
  const dur = Math.round((f.arrive - f.depart) / HOUR);
  const h = (t: number) => Math.max(0, Math.min(dur, Math.round((t - f.depart) / HOUR)));
  const origin = (t: number) => fmtTime(f.from.tz, t);
  if (a.end === undefined) return `${h(a.start)} h after takeoff (${origin(a.start)} ${f.from.city} time)`;
  const [h0, h1] = [h(a.start), h(a.end)];
  const when =
    h0 === 0 && h1 === dur ? 'The whole flight'
    : h0 === 0 ? `First ${h1} h of the flight`
    : h1 === dur ? `Last ${dur - h0} h before landing`
    : `${h0}–${h1} h after takeoff`;
  return `${when} (${origin(a.start)} – ${origin(a.end)} ${f.from.city} time)`;
}

export function describe(a: Advice): { title: string; note?: string } {
  const base = describeBase(a);
  const phase = flightPhase(a);
  return phase ? { title: base.title, note: base.note ? `${phase}. ${base.note}` : phase } : base;
}

function describeBase(a: Advice): { title: string; note?: string } {
  switch (a.kind) {
    case 'depart':
      return { title: `Depart ${a.flight!.from.code} at ${fmtTime(a.tz, a.start)}`, note: `To ${a.flight!.to.city}` };
    case 'arrive':
      return { title: `Land in ${a.flight!.to.city} at ${fmtTime(a.tz, a.start)}`, note: 'Local time' };
    case 'sleep': {
      const s = a.shiftFromUsual;
      const note =
        s === undefined || Math.round(s) === 0
          ? undefined
          : `${Math.abs(Math.round(s))} h ${s > 0 ? 'earlier' : 'later'} than usual`;
      return { title: `Sleep ${fmtRange(a)}`, note };
    }
    case 'sleep_flight':
      return { title: `Sleep on the plane ${fmtRange(a)}`, note: 'Eye mask and earplugs help' };
    case 'nap':
      return {
        title: `Short nap OK between ${fmtRange(a)}`,
        note: a.inFlight
          ? 'Max 30 minutes. Skip it if you’re not tired'
          : '20–30 minutes max, set an alarm. Longer naps slow your adjustment',
      };
    case 'light_seek':
      return {
        title: `Get bright light ${fmtRange(a)}`,
        note: a.inFlight ? 'Window shade open, cabin or screen light on' : 'Go outside, or sit by a bright window',
      };
    case 'light_avoid':
      return {
        title: `Avoid bright light ${fmtRange(a)}`,
        note: a.inFlight ? 'Shade down, eye mask on' : 'Sunglasses outside, dim lights inside',
      };
    case 'melatonin':
      return a.purpose === 'sleep'
        ? { title: `Take melatonin at ${fmtTime(a.tz, a.start)}`, note: 'To sleep on the plane: 0.5–3 mg fast-release, 1 hour before' }
        : { title: `Take melatonin at ${fmtTime(a.tz, a.start)}`, note: '0.5 mg, low dose. Shifts your body clock' };
    case 'caffeine_cutoff':
      return { title: `No caffeine after ${fmtTime(a.tz, a.start)}` };
  }
}

/** Short title + details for a calendar event; times live in the event itself. */
export function calendarText(a: Advice): { summary: string; description: string } {
  const { title, note } = describe(a);
  const NAMES: Record<Advice['kind'], string> = {
    depart: 'Depart',
    arrive: 'Land',
    sleep: 'Sleep',
    sleep_flight: 'Sleep on the plane',
    nap: 'Short nap OK',
    light_seek: 'Get bright light',
    light_avoid: 'Avoid bright light',
    melatonin: 'Take melatonin (0.5 mg)',
    caffeine_cutoff: 'Last caffeine',
  };
  const where = a.inFlight && a.flight ? `${a.flight.to.city} time` : `${a.place} time`;
  const description = [`${title} (${where}).`, note ? `${note}.` : ''].filter(Boolean).join(' ');
  return { summary: `${ICONS[a.kind]} ${NAMES[a.kind]}`, description };
}
