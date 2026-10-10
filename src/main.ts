import './style.css';
import { AIRPORTS, airportLabel, findAirport } from './airports';
import { buildPlan, validate, type Flight, type Plan, type Profile } from './engine';
import { describe, fmtDate, fmtHour, fmtTime, ICONS } from './describe';
import { buildIcs } from './ics';
import { HOUR, localDateKey, zonedParts, zonedToInstant } from './time';

// --- Form state ----------------------------------------------------------------------

interface FlightForm {
  from: string;
  to: string;
  date: string;
  time: string;
  hours: number;
  minutes: number;
}

interface FormState {
  profile: Profile;
  flights: FlightForm[];
}

const MAX_FLIGHTS = 4;
const STORAGE_KEY = 'time-shifter:form';

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 24 * HOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_STATE: FormState = {
  profile: { sleepHour: 22, wakeHour: 6, preDays: 3, melatonin: true, caffeine: true, naps: true },
  flights: [{ from: 'LAX', to: 'LHR', date: todayPlus(7), time: '21:00', hours: 10, minutes: 30 }],
};

function loadState(): FormState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as FormState;
      // Older saved forms lack newer options: fill them from the defaults.
      return { ...parsed, profile: { ...DEFAULT_STATE.profile, ...parsed.profile } };
    }
  } catch {
    // Storage unavailable (private mode etc.): fall back to defaults.
  }
  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not critical.
  }
}

let state = loadState();

// --- DOM helpers ---------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) el.className = cls;
  Object.assign(el, rest);
  for (const c of children) if (c != null) el.append(c);
  return el;
}

// --- Profile inputs ------------------------------------------------------------------

function fillHourSelect(select: HTMLSelectElement, value: number) {
  for (let hr = 0; hr < 24; hr++) select.append(h('option', { value: String(hr), textContent: fmtHour(hr) }));
  select.value = String(value);
}

function initProfile() {
  const p = state.profile;
  fillHourSelect($('sleepHour'), p.sleepHour);
  fillHourSelect($('wakeHour'), p.wakeHour);
  $<HTMLSelectElement>('preDays').value = String(p.preDays);
  $<HTMLInputElement>('melatonin').checked = p.melatonin;
  $<HTMLInputElement>('caffeine').checked = p.caffeine;
  $<HTMLInputElement>('naps').checked = p.naps;

  const sync = () => {
    state.profile = {
      sleepHour: Number($<HTMLSelectElement>('sleepHour').value),
      wakeHour: Number($<HTMLSelectElement>('wakeHour').value),
      preDays: Number($<HTMLSelectElement>('preDays').value),
      melatonin: $<HTMLInputElement>('melatonin').checked,
      caffeine: $<HTMLInputElement>('caffeine').checked,
      naps: $<HTMLInputElement>('naps').checked,
    };
    saveState();
  };
  for (const id of ['sleepHour', 'wakeHour', 'preDays', 'melatonin', 'caffeine', 'naps']) $(id).addEventListener('change', sync);
}

// --- Flight inputs -------------------------------------------------------------------

function parseAirportInput(value: string) {
  return findAirport(value.slice(0, 3));
}

/** Turns a form row into a Flight, or explains what's missing. */
function toFlight(f: FlightForm, n: number): Flight | string {
  const from = findAirport(f.from);
  const to = findAirport(f.to);
  if (!from) return `Flight ${n}: choose a departure airport from the list.`;
  if (!to) return `Flight ${n}: choose an arrival airport from the list.`;
  if (!f.date || !f.time) return `Flight ${n}: enter the departure date and time.`;
  const depart = zonedToInstant(from.tz, f.date, f.time);
  return { from, to, depart, arrive: depart + (f.hours + f.minutes / 60) * HOUR };
}

function arrivalText(f: FlightForm): string {
  const flight = toFlight(f, 0);
  if (typeof flight === 'string') return '';
  return `Arrives ${flight.to.city} ${fmtDate(flight.to.tz, flight.arrive)}, ${fmtTime(flight.to.tz, flight.arrive)} local time`;
}

function renderFlights() {
  const container = $('flights');
  container.replaceChildren();
  state.flights.forEach((f, i) => {
    const arrival = h('p', { class: 'arrival', textContent: arrivalText(f) });
    const update = (patch: Partial<FlightForm>) => {
      Object.assign(f, patch);
      arrival.textContent = arrivalText(f);
      saveState();
    };

    const airportInput = (key: 'from' | 'to', label: string) => {
      const current = findAirport(f[key]);
      const input = h('input', {
        type: 'text',
        value: current ? airportLabel(current) : f[key],
        placeholder: 'City or airport code',
        autocomplete: 'off',
      });
      input.setAttribute('list', 'airports');
      input.addEventListener('change', () => {
        const a = parseAirportInput(input.value);
        if (a) input.value = airportLabel(a);
        update({ [key]: a ? a.code : input.value });
      });
      return h('label', { class: 'wide' }, label, input);
    };

    const date = h('input', { type: 'date', value: f.date });
    date.addEventListener('change', () => update({ date: date.value }));
    const time = h('input', { type: 'time', value: f.time });
    time.addEventListener('change', () => update({ time: time.value }));

    const hours = h('select');
    for (let x = 0; x <= 20; x++) hours.append(h('option', { value: String(x), textContent: `${x} h` }));
    hours.value = String(f.hours);
    hours.addEventListener('change', () => update({ hours: Number(hours.value) }));
    const minutes = h('select');
    for (let x = 0; x < 60; x += 5) minutes.append(h('option', { value: String(x), textContent: `${x} min` }));
    minutes.value = String(f.minutes);
    minutes.addEventListener('change', () => update({ minutes: Number(minutes.value) }));

    const remove = h('button', { type: 'button', class: 'link', textContent: 'Remove' });
    remove.hidden = state.flights.length === 1;
    remove.addEventListener('click', () => {
      state.flights.splice(i, 1);
      saveState();
      renderFlights();
    });

    container.append(
      h(
        'fieldset',
        { class: 'flight' },
        h('legend', {}, `Flight ${i + 1}`, ' ', remove),
        h('div', { class: 'row' }, airportInput('from', 'From')),
        h('div', { class: 'row' }, h('label', {}, 'Departure date', date), h('label', {}, 'Local time', time)),
        h('div', { class: 'row' }, h('label', {}, 'Flight duration', h('span', { class: 'pair' }, hours, minutes))),
        h('div', { class: 'row' }, airportInput('to', 'To')),
        arrival,
      ),
    );
  });

  $('flight-count').textContent = `${state.flights.length} of ${MAX_FLIGHTS}`;
  $<HTMLButtonElement>('add-flight').disabled = state.flights.length >= MAX_FLIGHTS;
}

function addFlight() {
  const prev = state.flights[state.flights.length - 1];
  const prevFlight = prev && toFlight(prev, 0);
  let date = todayPlus(7);
  if (prevFlight && typeof prevFlight !== 'string') {
    const p = zonedParts(prevFlight.to.tz, prevFlight.arrive + 3 * 24 * HOUR);
    date = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
  state.flights.push({ from: prev?.to ?? '', to: prev?.from ?? '', date, time: '10:00', hours: 8, minutes: 0 });
  saveState();
  renderFlights();
}

// --- Plan rendering ------------------------------------------------------------------

function summary(plan: Plan, flights: Flight[], profile: Profile): HTMLElement {
  const home = flights[0].from;
  const lines: string[] = [];
  if (plan.direction === 'none') {
    lines.push('Your trip is short enough to stay on home time. Keep your usual sleep and plan important things for your daytime.');
  } else {
    const way = plan.direction === 'advance' ? 'earlier' : 'later';
    lines.push(`Your body clock needs to move ${Math.round(plan.shiftHours)} hours ${way}.`);
    if (plan.startShifting) {
      lines.push(`Start on ${fmtDate(home.tz, plan.startShifting)} by going to bed at ${fmtTime(home.tz, plan.startShifting)}.`);
    }
  }
  if (plan.adaptedBy) {
    const last = flights[flights.length - 1].to;
    lines.push(`You should be fully adjusted to ${last.city} time by ${fmtDate(last.tz, plan.adaptedBy)}.`);
  }
  if (!profile.melatonin) lines.push('Melatonin is turned off. Turning it on can speed up eastward shifts.');
  return h('div', { class: 'card summary' }, h('h2', { textContent: 'Your plan' }), ...lines.map((l) => h('p', { textContent: l })));
}

function calendarCard(plan: Plan): HTMLElement {
  const reminders = h('input', { type: 'checkbox', checked: true });
  const button = h('button', { type: 'button', class: 'primary', textContent: '📅 Add to my calendar' });
  button.addEventListener('click', () => {
    const ics = buildIcs(plan.advice, { reminders: reminders.checked });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = h('a', { href: url, download: 'jet-lag-plan.ics' });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
  return h(
    'div',
    { class: 'card calendar' },
    h('h2', { textContent: 'Get reminders' }),
    h('p', { class: 'muted', textContent: 'Downloads every step as calendar events. Open the file to add them to Apple, Google or Outlook Calendar.' }),
    h('label', { class: 'check' }, reminders, 'Alert me when each step starts'),
    button,
  );
}

function renderPlan(plan: Plan, flights: Flight[], profile: Profile) {
  const section = $('plan');
  section.replaceChildren(summary(plan, flights, profile), calendarCard(plan));

  // Group into days on the local clock of wherever you are.
  let currentKey = '';
  let list: HTMLUListElement | null = null;
  for (const a of plan.advice) {
    const key = `${localDateKey(a.tz, a.start)}|${a.tz}`;
    if (key !== currentKey) {
      currentKey = key;
      const placeName = a.inFlight && a.flight ? `${a.flight.to.city} time` : a.place;
      list = h('ul', { class: 'advice' });
      section.append(
        h('div', { class: 'card day' }, h('h3', {}, fmtDate(a.tz, a.start), h('span', { class: 'muted' }, ` · ${placeName}`)), list),
      );
    }
    const { title, note } = describe(a);
    list!.append(
      h(
        'li',
        { class: `item ${a.kind}${a.inFlight ? ' in-flight' : ''}` },
        h('span', { class: 'icon', textContent: ICONS[a.kind] }),
        h('span', { class: 'text' }, h('strong', { textContent: title }), note ? h('small', { textContent: note }) : null),
      ),
    );
  }

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Submit --------------------------------------------------------------------------

function onSubmit(e: Event) {
  e.preventDefault();
  const errorsEl = $('errors');
  const parsed = state.flights.map((f, i) => toFlight(f, i + 1));
  const errors = parsed.filter((p): p is string => typeof p === 'string');
  const flights = parsed.filter((p): p is Flight => typeof p !== 'string');
  if (!errors.length) errors.push(...validate(state.profile, flights));

  errorsEl.replaceChildren(...errors.map((msg) => h('li', { textContent: msg })));
  errorsEl.hidden = errors.length === 0;
  if (errors.length) {
    $('plan').hidden = true;
    return;
  }
  renderPlan(buildPlan(state.profile, flights), flights, state.profile);
}

// --- Boot ----------------------------------------------------------------------------

$('airports').append(...AIRPORTS.map((a) => h('option', { value: airportLabel(a) })));
initProfile();
renderFlights();
$('add-flight').addEventListener('click', addFlight);
$('trip-form').addEventListener('submit', onSubmit);
