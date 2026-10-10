// Time zone helpers built on the browser's Intl API (IANA tz data), so daylight
// saving time is always handled for the exact date in question.

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** UTC offset of `tz` at `instant`, in hours (e.g. -7, 5.5). */
export function offsetHours(tz: string, instant: number): number {
  const parts = formatter(tz).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const wholeSeconds = Math.floor(instant / 1000) * 1000;
  return Math.round((asUtc - wholeSeconds) / 60_000) / 60;
}

/** Converts a wall-clock time in `tz` ("2026-11-02", "21:35") to a UTC instant. */
export function zonedToInstant(tz: string, date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let instant = wall - offsetHours(tz, wall) * HOUR;
  // A second pass corrects for an offset change between the guess and the answer.
  instant = wall - offsetHours(tz, instant) * HOUR;
  return instant;
}

/** Wall-clock fields of `instant` in `tz`. */
export function zonedParts(tz: string, instant: number) {
  const local = new Date(instant + offsetHours(tz, instant) * HOUR);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    weekday: local.getUTCDay(),
  };
}

/** Rounds `instant` to the nearest whole hour on the local clock of `tz`. */
export function roundToLocalHour(tz: string, instant: number): number {
  const off = offsetHours(tz, instant) * HOUR;
  return Math.round((instant + off) / HOUR) * HOUR - off;
}

/** Moves `instant` to a whole hour on the local clock of `tz`, rounding up or down. */
export function snapLocalHour(tz: string, instant: number, dir: 'up' | 'down'): number {
  const off = offsetHours(tz, instant) * HOUR;
  const f = dir === 'up' ? Math.ceil : Math.floor;
  return f((instant + off) / HOUR) * HOUR - off;
}

/** "YYYY-MM-DD" of `instant` in `tz`; used to group advice into days. */
export function localDateKey(tz: string, instant: number): string {
  const p = zonedParts(tz, instant);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Wraps an hour difference into (-12, 12]. */
export function wrapHours(h: number): number {
  let x = ((h % 24) + 24) % 24;
  if (x > 12) x -= 24;
  return x;
}
