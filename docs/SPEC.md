# Product spec

## Goal

Generate a personalized, day-by-day jet lag plan for any itinerary, and show it as a
"what to do now" view plus a full timeline. Personal use first. Polished UI later.

## User inputs

**Profile (one-time)**
- Usual sleep time and wake time
- Chronotype: early / intermediate / late
- Melatonin: opt-in yes/no
- Caffeine: yes/no
- Willingness to start adjusting before the trip: yes/no

**Trip**
- One or more flight legs: departure airport + local time, arrival airport + local time
- Stopovers: any number, each with its own legs
- Return flight (optional)

Time zones come from the airport codes, using IANA tz data. Never ask the user for UTC
offsets: daylight saving time changes would make them wrong.

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

Each item carries: start, end, local time zone, the reason (linked to the matching
`SCIENCE.md` section) and a priority, which the real-world filter uses.

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
| **0. Docs** | This spec + the science notes | Settle the rules before writing code |
| **1. Engine** | Pure plan-generation library + unit tests, with known trips (e.g. SFO→LHR, JFK→NRT, MEX→MAD) as golden test cases | The algorithm is the product. Validate it before building any UI |
| **2. CLI** | `time-shifter plan --from SFO --to LHR --depart ...` that prints the timeline | The fastest way to use it on a real trip and see how it feels |
| **3. Web app (PWA)** | Trip entry form, now view, full timeline, works offline | Works on a phone without the app stores. Installable to the home screen |
| **4. Notifications** | Web push or calendar export (.ics) of the advice | .ics is a cheap first step: reminders come from your existing calendar |
| **5. Nice-to-haves** | Flight lookup by flight number, delay re-planning, sleep tracker import, feedback loop to tune personal shift rates | Personalization after the base works |

## Open decisions

- **Stack.** Leaning toward TypeScript end to end, so one engine can serve the CLI, web
  app and service worker. Python is the alternative if fast iteration on the engine
  matters more.
- **Plan storage.** Local-only (IndexedDB) at first. Sync only if it's ever needed.
- **Validation.** How do I check the plans are actually good? Option: compare against
  worked examples in Eastman & Burgess 2009, and keep a simple personal travel log
  (jet lag severity 1–5 per day).
