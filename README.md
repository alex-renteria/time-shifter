# Time-Shifter

A personal, from-scratch rebuild of a science-based **jet lag planner**, inspired by the
[Timeshifter jet lag app](https://www.timeshifter.com/jet-lag-app).

You enter a trip. Time-Shifter builds an hour-by-hour plan telling you **when to seek
light, when to avoid it, when to sleep, and when to use (or skip) caffeine and
melatonin**, so your body clock moves to the destination's time zone faster.

> **Status:** first working version. A static website: enter your normal sleep and up to
> 4 flights, and get a day-by-day plan. Everything runs in your browser. No server, no account.

## Run it

```bash
npm install
npm run dev     # local site at http://localhost:5173
npm test        # engine + time zone tests
npm run build   # static site in dist/, ready to host anywhere
```

Hosting: import the repo on Vercel (it detects Vite automatically: build `npm run build`,
output `dist`). Every push to `main` then redeploys.

## Why build my own

Timeshifter is a polished commercial product. Building my own version is a way to:

- **Learn the science properly.** Circadian phase, phase response curves and light timing
  are worth understanding, not just following as notifications.
- **Own the tool.** No subscription and no account. My trips and sleep data stay with me.
- **Fit it to how I travel.** I can tune the defaults to my routine and add integrations
  I want, such as calendar import and flight lookup.

This is a personal, non-commercial project. It is not affiliated with Timeshifter Inc.
See [Disclaimer](#disclaimer).

## What it does (target feature set)

| Capability | What it means here |
|---|---|
| **Body-clock-based advice** | Advice is timed to your *estimated biological time* (circadian phase), not just to the destination's clock. |
| **Real-world filter** | Advice is reshaped to fit real life: no "see bright light at 3 am" while you're asleep, and it respects meetings and flights. |
| **Pre-travel adjustment** | Optionally start shifting 1–3 days before departure. |
| **Short-trip mode** | For trips of about 2–3 days or less, stay mostly on home time instead of adapting and then adapting back. |
| **Simple trip entry** | Up to 4 flights. Each one is departure airport, date and local time, duration, and arrival airport. The site works out the local arrival time. No flight-number lookup needed. |
| **Whole hours only** | All advice uses whole clock hours ("sleep 9 pm – 5 am"), even in half-hour time zones such as India. |
| **Multi-city trips** | One-way, round-trip and multi-city. Stays under 3 days count as short: you stay on your current clock. |
| **Flight editing** | Change any flight and rebuild the plan. |
| **Melatonin on the plane** | Optional: 1 h before an in-flight sleep of 4 h or more, never doubled with a clock-shifting dose. |
| **Naps** | Optional: a 20–30 min early-afternoon nap on travel and adjustment days, plus naps on long flights. |
| **Calendar reminders** | One tap downloads the plan as calendar events with alerts, for Apple, Google or Outlook Calendar. |
| *Later:* now view | A "next 3 hours" view. |

The detailed spec, data model and roadmap are in [`docs/SPEC.md`](docs/SPEC.md).
The science behind the algorithm is in [`docs/SCIENCE.md`](docs/SCIENCE.md).

## The core idea in one paragraph

Light is the strongest signal that resets the body clock. Light at certain biological
times moves the clock **earlier** (an advance, which helps when flying east). Light at
other times moves it **later** (a delay, which helps when flying west). Light at the
wrong time pushes the clock the wrong way and makes jet lag worse. So the planner has to
(1) estimate where your clock is right now, (2) decide which direction to shift and by
how much, and (3) schedule light, darkness, sleep, caffeine and melatonin around that,
day by day, until the clock matches the destination.

## Disclaimer

- **Not medical advice.** This is a personal experiment. Talk to a doctor before using
  melatonin or changing your sleep, especially if you're pregnant, have a medical
  condition or take medication.
- **Not affiliated with Timeshifter Inc.** "Timeshifter", "Circadian Time",
  "Practicality Filter", "Quick Turnaround" and "Timeshift" are their trademarks. This
  project uses generic names for its own features. Timeshifter also lists patents, so
  this project is for personal, non-commercial use only. Check that before ever
  distributing it.
- The algorithm is based on published circadian research (see `docs/SCIENCE.md`), not on
  Timeshifter's proprietary implementation.
