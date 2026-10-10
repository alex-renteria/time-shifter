import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/engine';
import { buildIcs } from '../src/ics';
import { flight, profile } from './helpers';

const plan = buildPlan(profile, [flight('LAX', 'LHR', '2026-11-10', '21:00', 10.5)]);
const ics = buildIcs(plan.advice, { reminders: true, now: Date.UTC(2026, 10, 1) });
const events = ics.split('BEGIN:VEVENT').slice(1);

describe('calendar export', () => {
  it('is a valid calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('has one event per advice item, leaving out the flights', () => {
    const expected = plan.advice.filter((a) => a.kind !== 'depart' && a.kind !== 'arrive').length;
    expect(events).toHaveLength(expected);
  });

  it('writes times in UTC', () => {
    const firstSleep = plan.advice.find((a) => a.kind === 'sleep')!;
    // 9 pm in Los Angeles on 7 Nov 2026 (PST, UTC-8) = 05:00 UTC on 8 Nov.
    expect(ics).toContain('DTSTART:20261108T050000Z');
    expect(firstSleep.start).toBe(Date.UTC(2026, 10, 8, 5));
  });

  it('keeps every line within 75 octets', () => {
    const encoder = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
  });

  it('adds reminders only when asked', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(buildIcs(plan.advice, { reminders: false })).not.toContain('BEGIN:VALARM');
  });

  it('says which local time the advice refers to', () => {
    const sleep = events.find((e) => e.includes('SUMMARY:🛏️ Sleep'))!;
    expect(sleep.replace(/\r\n /g, '')).toContain('Los Angeles time');
  });
});
