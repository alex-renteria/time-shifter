import './style.css';
import { AIRPORTS, airportLabel, findAirport } from './airports';
import { buildPlan, validate, type Advice, type Flight, type Plan, type Profile } from './engine';
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
  profile: { sleepHour: 22, wakeHour: 6, preDays: 3, melatonin: true, caffeine: true },
  flights: [{ from: 'LAX', to: 'LHR', date: todayPlus(7), time: '21:00', hours: 10, minutes: 30 }],
};

function loadState(): FormState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as FormState;
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

// --- Formatting ----------------------------------------------------------------------

function fmtHour(hour: number, minute = 0): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${h12}:${String(minute).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

function fmtTime(tz: string, t: number): string {
  const p = zonedParts(tz, t);
  return fmtHour(p.hour, p.minute);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(tz: string, t: number): string {
  const p = zonedParts(tz, t);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
}

function fmtRange(a: Advice): string {
  return `${fmtTime(a.tz, a.start)} – ${fmtTime(a.tz, a.end!)}`;
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

  const sync = () => {
    state.profile = {
      sleepHour: Number($<HTMLSelectElement>('sleepHour').value),
      wakeHour: Number($<HTMLSelectElement>('wakeHour').value),
      preDays: Number($<HTMLSelectElement>('preDays').value),
      melatonin: $<HTMLInputElement>('melatonin').checked,
      caffeine: $<HTMLInputElement>('caffeine').checked,
    };
    saveState();
  };
  for (const id of ['sleepHour', 'wakeHour', 'preDays', 'melatonin', 'caffeine']) $(id).addEventListener('change', sync);
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

const ICONS: Record<Advice['kind'], string> = {
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

function describe(a: Advice): { title: string; note?: string } {
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
      return { title: `Short nap OK between ${fmtRange(a)}`, note: 'Max 30 minutes. Skip it if you’re not tired' };
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
      return { title: `Take melatonin at ${fmtTime(a.tz, a.start)}`, note: '0.5 mg, low dose' };
    case 'caffeine_cutoff':
      return { title: `No caffeine after ${fmtTime(a.tz, a.start)}` };
  }
}

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

function renderPlan(plan: Plan, flights: Flight[], profile: Profile) {
  const section = $('plan');
  section.replaceChildren(summary(plan, flights, profile));

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
