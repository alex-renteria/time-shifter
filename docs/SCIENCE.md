# The science behind the planner

Every number below exists as a named constant at the top of `src/engine.ts`, so the
rules can be tuned in one place.

These notes justify every rule the algorithm will use. Every rule in the code should
point back to a section here. The numbers are approximate, population-average figures
from the literature. People differ, so the planner should treat them as tunable defaults.

## 1. The body clock and how to estimate it

- The circadian clock runs on a cycle of roughly 24 hours. It keeps timing for sleep,
  alertness, body temperature, digestion and hormones.
- The anchor point the planner uses is **CBTmin**, the daily low point of core body
  temperature. For someone on a stable schedule, it falls about **2–3 hours before
  their usual wake time**.
- **First-pass estimate:** `CBTmin = habitual wake time − 2.5 h`. Users enter their
  usual sleep and wake times. Chronotype (early bird or night owl) moves this.
- The planner tracks CBTmin day by day as the clock shifts. That tracked value is the
  user's "biological time".

## 2. Light: the main lever

Light's effect depends on when it lands relative to CBTmin. This relationship is
called the phase response curve (PRC):

| Light exposure timing | Effect on the clock | Useful when |
|---|---|---|
| In the ~6 h **after** CBTmin (biological morning) | **Advance** (clock moves earlier) | Flying **east** |
| In the ~6 h **before** CBTmin (biological evening/night) | **Delay** (clock moves later) | Flying **west** |

Rules that follow:
- **Seek light** in the window that pushes the clock the way you need it to go.
- **Avoid light** in the opposite window (dark sunglasses, staying indoors, an eye mask).
  This matters as much as seeking light. Many classic jet lag tips get it wrong, such
  as "get morning sun on arrival", which can be exactly the wrong advice after a long
  eastward flight.
- As CBTmin moves each day, the light windows move with it.

## 3. How fast the clock can move

- Without help, the clock adapts at roughly **1 h/day**, and more slowly when advancing.
- With well-timed light (and melatonin), it can move about **1–1.5 h/day** when
  advancing and **1.5–2 h/day** when delaying.
- **Spreading the shift.** The traveler picks when adjustment should be finished: on
  landing, or 1 or 2 days after. The planner spreads the shift evenly, in whole hours,
  over every night from the first pre-travel night to that deadline, never faster than
  the rates above. Finishing after landing means smaller steps each day, and sleep on
  arrival day sits partway between home and local time instead of jumping straight to
  local time.
- **Eastward trips are harder.** The clock naturally drifts slightly later each day, so
  delaying comes easier than advancing.
- **Direction for big shifts:** for eastward shifts of about **8–9 h or more**, it can be
  easier to *delay* the other way around the clock. A naive advance at that size also
  risks putting light in the wrong window and pushing the clock the wrong way
  ("antidromic" re-entrainment). The planner should compare both directions and pick
  the one that needs fewer days.

## 4. Melatonin (optional)

- Melatonin's PRC runs roughly **opposite to light's**:
  - Taken in the **afternoon/early evening** (before your natural melatonin rise), it
    **advances** the clock.
  - Taken in the **morning**, it **delays** the clock. This use is rare and generally
    not recommended because it causes drowsiness.
- Low doses (around 0.5 mg) shift the clock about as well as higher doses, with less
  next-day grogginess.
- **What the planner does:** when advancing, 0.5 mg about 4 h before the target bedtime
  that night (the literature puts the best timing roughly 3–5 h before bedtime).
  No melatonin advice for shifting when delaying.
- **To sleep on the plane:** standard (fast-release) melatonin peaks in the blood about
  30–60 min after taking it, so the planner says **1 h before** the planned in-flight sleep.
  It's only suggested when that sleep is **at least 4 h**: taken when you can't sleep it
  off, melatonin causes daytime drowsiness and can slow adjustment. The in-flight sleep
  is already placed in your *biological* night, so the dose lands at the right body time.
  Doses of 0.5–5 mg work about equally well, and more than 5 mg adds nothing. If an
  in-flight dose is planned, the clock-shifting dose for that same night is dropped, so
  there is never a double dose.
- **Caution:** people with epilepsy or taking warfarin should check with a doctor first.
- A separate effect: at bedtime, melatonin can also help you fall asleep at an
  unfamiliar time.
- The planner makes this **opt-in**, with a medical disclaimer.

## 5. Caffeine

- Use it **strategically to stay alert** during the hardest stretches of the shift.
- **Avoid it for roughly 6–8 h before planned sleep.** It lasts long and fragments sleep.
- Caffeine has a small clock-shifting effect too, but in this model it is mainly an
  alertness tool.

## 6. Sleep and naps

- Plan sleep around the **shifting body clock**, moving toward local bedtime over the
  course of the plan.
- **Naps:** short (20–30 min, with an alarm) and early in the afternoon. Long naps, or
  naps late in the day, pull the clock back toward the old time zone and eat into the
  night's sleep.
- **What the planner does (optional, "Include naps"):** on travel and adjustment days, it
  offers a nap window of **9–7 h before that night's bedtime** (1–3 pm for a 10 pm
  bedtime). The window is moved out of bright-light time, away from airports and flights,
  and is shown on the day you land even if your clock is already adjusted. On long
  flights with no planned sleep, a short nap is offered at least 6 h before the next
  sleep.
- **On the plane:** sleep if it fits the plan's sleep window, stay awake (and manage
  light) if it doesn't. "Sleep as much as possible on the plane" is not a rule.

## 7. Short trips

- If you'll only be away for about 2–3 days, a full shift isn't worth it: you'd arrive
  home with jet lag again. It's better to **stay roughly on home time** and schedule
  important events into your biological daytime.

## 8. Myths to avoid building in

- **Fasting** as a main lever: the evidence is weak compared with light.
- **Morning exercise** as a reliable shifter: its effect is small and inconsistent next
  to light.
- **Melatonin at any time = good:** wrong timing can make jet lag worse.

## References

- CDC Yellow Book, *Jet Lag Disorder* chapter.
  https://www.cdc.gov/yellow-book/hcp/travel-air-sea/jet-lag-disorder.html
- Eastman CI, Burgess HJ. *How to travel the world without jet lag.* Sleep Med Clin, 2009.
- Khalsa SBS et al. *A phase response curve to single bright light pulses in human
  subjects.* J Physiol, 2003.
- Burgess HJ et al. *Human phase response curves to three days of daily melatonin:
  0.5 mg versus 3.0 mg.* J Clin Endocrinol Metab, 2010.
- Herxheimer A, Petrie KJ. *Melatonin for the prevention and treatment of jet lag.*
  Cochrane Database Syst Rev, 2002. https://pubmed.ncbi.nlm.nih.gov/12076414/
- Harpsøe NG et al. *Clinical pharmacokinetics of melatonin: a systematic review.*
  Eur J Clin Pharmacol, 2015 (oral Tmax about 30–60 min).
- Timeshifter's public science pages, for orientation only:
  https://www.timeshifter.com/circadian-rhythms
