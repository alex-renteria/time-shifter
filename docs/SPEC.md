# Product spec

## Goal

Generate a personalized, day-by-day jet lag plan for any itinerary, and show it as a
"what to do now" view plus a full timeline. Personal use first. Polished UI later.

## User inputs

**Profile**
- Usual bedtime and wake time (whole hours, e.g. 10 pm – 6 am). These anchor everything.
- Start adjusting: 0–3 days before the first flight
- Melatonin advice: on/off
- Caffeine advice: on/off

**Flights (1 to 4)**
- Departure airport (picked from a list)
- Departure date and local time
- Flight duration (hours + minutes)
- Arrival airport

The arrival time is **computed**, not entered, and shown for checking ("Arrives London
Sun 18 Oct, 3:30 pm local time"). Asking for both duration and arrival time would let a
typo create a contradiction. Each airport maps to an IANA time zone, so daylight saving
is right for the exact date. Users never type UTC offsets. The gap between flights is a
stay. A stay under 72 h is "short" and the plan doesn't adapt to it.

## Outputs

A list of timestamped **advice items**:

| Type | Example |
|---|---|
| `light_seek` | "Seek bright light 07:00–10:00" |
| `light_avoid` | "Avoid light 04:00–07:00 (dark glasses / stay indoors)" |
| `sleep` | "Sleep 22:30–06:30" |
| `nap` | "Optional nap ≤ 25 min before 15:00" |
| `caffeine_ok` / `caffeine_avoid` | "Caffeine OK until 13:00" |
| `melatonin` | "Take 0.5 mg melatonin at 18:00" |

Each item carries a start, an optional end, and the time zone to show it in (where the
traveler is; destination time while on board). All advice times are rounded to whole
hours on the local clock. The engine works in exact minutes and rounds only at the end,
so half-hour zones (India, Nepal, Newfoundland) still come out right.

## The algorithm, at a high level

1. **Estimate starting phase**: CBTmin from the profile (SCIENCE §1).
2. **Find the target**: the destination's equivalent CBTmin, i.e. the same wake-relative
   position in local time.
3. **Choose direction**: advance vs. delay, picking whichever needs fewer days given the
   per-day shift limits (§3).
4. **Simulate day by day**: from the pre-travel start through arrival, generate light,
   dark, sleep, caffeine and melatonin windows relative to the *current* CBTmin, then
   move CBTmin by the expected amount for that day.
5. **Real-world filter**: drop or reshape items that clash with flights, sleep or other
   constraints. Never advise light during scheduled sleep, and turn impossible "seek
   light" items into "it's fine if you can't" items. Lower-priority items give way first.
6. **Short-trip check**: if the time at the destination is under about 72 h, switch to
   the stay-on-home-time strategy (§7).
7. **Multi-leg**: run the simulation across every leg and stopover, carrying the phase
   forward continuously.

The engine should be a **pure function**: `(profile, itinerary, now) → plan`. No I/O
inside it, so it is easy to test against hand-worked cases and published examples.

## Roadmap

| Phase | Deliverable | Why this order |
|---|---|---|
| **0. Docs** ✅ | This spec + the science notes | Settle the rules before writing code |
| **1. Engine** ✅ | `src/engine.ts`, a pure function, plus tests on known trips (LAX→LHR, JFK→NRT, MEX→MAD, LHR→DEL, a 4-leg trip) | The algorithm is the product. Validate it before building any UI |
| **2. Website** ✅ | Static site: sleep profile, up to 4 flights, day-by-day plan; saves the form in the browser | Works on any phone with nothing to install |
| **3. Calendar export** ✅ | "Add to my calendar" downloads an .ics file: one event per step, optional alerts, times in UTC so any phone shows them in its own zone. Flights are left out (the airline already adds them) | Reminders on the phone with no app and no server |
| **4. Hosting + PWA** | Deploy on Vercel from `main`, add-to-home-screen, offline | Use it on a real trip |
| **5. Nice-to-haves** | Flight lookup by flight number, delay re-planning, sleep tracker import, feedback loop to tune personal shift rates | Personalization after the base works |

## Open decisions

- **Stack (decided).** Vite + TypeScript, no UI framework, no backend. The form is saved
  in the browser's localStorage only.
- **Short-trip sleep.** On a short trip the plan keeps you on home time, which can mean
  "sleep 6 am – 2 pm" abroad. That's correct for the body clock, but a softer compromise
  (sleep partly toward local time) may suit real life better. To be tested.
- **Validation.** How do I check the plans are actually good? Option: compare against
  worked examples in Eastman & Burgess 2009, and keep a simple personal travel log
  (jet lag severity 1–5 per day).
