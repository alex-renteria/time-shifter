// Calendar export (RFC 5545 .ics). Times are written in UTC, so any calendar app shows
// them correctly in whatever time zone the phone is set to.

import { calendarText } from './describe';
import type { Advice } from './engine';

/** Reminder offsets in minutes before the event; 0 = when it starts. */
const ALARM_BEFORE_MIN: Partial<Record<Advice['kind'], number>> = {
  sleep: 30,
  sleep_flight: 0,
  light_seek: 0,
  light_avoid: 0,
  melatonin: 0,
  caffeine_cutoff: 0,
};

/** Point-in-time advice becomes a short event. */
const POINT_EVENT_MIN = 15;

function utcStamp(t: number): string {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets without splitting a UTF-8 character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export interface IcsOptions {
  reminders: boolean;
  /** Creation time; injectable for tests. */
  now?: number;
}

export function buildIcs(advice: Advice[], { reminders, now = Date.now() }: IcsOptions): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Time-Shifter//Jet lag plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Jet lag plan'];

  for (const a of advice) {
    // Flights are left out: they're usually already in the calendar from the airline.
    if (a.kind === 'depart' || a.kind === 'arrive') continue;
    const { summary, description } = calendarText(a);
    const end = a.end ?? a.start + POINT_EVENT_MIN * 60_000;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.kind}-${a.start}@time-shifter`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(a.start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'TRANSP:TRANSPARENT', // don't show as busy
    );
    const before = ALARM_BEFORE_MIN[a.kind];
    if (reminders && before !== undefined) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, `TRIGGER:-PT${before}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
