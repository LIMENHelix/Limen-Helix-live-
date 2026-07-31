# CHART 01 — ENERGY SENSORS, AS THEY ACTUALLY ARE

Measured 2026-07-31 against the live repo. Energy is the best-instrumented of the 20 domains, so
this is the ceiling, not the average.

---

## THE NUMBER

**14 distinct observable conditions are reachable today.**

25 condition tokens are written in `energy-brain.js`. 11 are unreachable — see the dead paths below.

**Finest granularity the sensors support: 3 ordinal levels per sensor, maximum.**
Every condition is a hard threshold on a scalar. No continuous quantity survives into
`_activeConditions`. Crude gets 3 bands (≤90 / >90 / >100); eight sensors get 3 bands via two
thresholds; eight get 2 bands via one. The only continuous values retained anywhere are
`_canonicalCrudePrice` and `_feedDivergence` (`energy-brain.js:284-286`), and `_stressFlag` is
re-quantised to 3 levels at `:486-488`.

**This is the hard cap on brain-v2 under R3.** A finding library larger than what 14 three-level
sensors can distinguish is not a library, it is decoration.

---

## WHAT THE SENSORS ACTUALLY ARE

18 upstream sensors feed the energy domain object. Their quality is very uneven:

| kind | count | what they are |
|---|---|---|
| **numeric price series** | 3 | FRED `DCOILWTICO` (keyless CSV), EIA Brent `EPCBRENT`, Polygon `CL` |
| **Google News article COUNTS** | 11 | GridRel, EIA-natgas, EIA-petro, OPEC, Nuclear, EIA-elec, IEA, Solar, Wind, LNG, Coal |
| **reused cross-domain** | 4 | NOAA NWS alerts, CISA KEV, FedRegister NRC, FedRegister DOE |

Server-side channels: 16 keys, but **`marketScore` and `seriesScore` are the SAME FRED series**
(`DCOILWTICO`), differing only by window — 45-day vs 3650-day. Two "channels", one sensor.
`granularity` is reported and explicitly not weighted. Energy's 36-ticker basket is **display-only**;
`limen-worker-snapshot.js:305` routes energy to the FRED branch and never to `domainMarketFeed`.

`lib/limen-stress-propagator.js` contributes **nothing** to the energy domain — zero matches for
`energy`. It operates on company slugs and writes `stress_slim`. It is not an energy sensor.

---

## THREE DEFECTS THAT CAP THE REAL NUMBER BELOW THE WRITTEN ONE

### D1 — the entire event branch is dead (`energy-brain.js:315-333`)

Line 311 reads `sig.timestamp`. `handlers/defense-signals.js:152-163` builds each signal with
`eventType, articleCount, confidence, confidenceValue, magnitude, affectedDomains, titles, earliest,
latest, clusterSpanMinutes` — **there is no `timestamp` field**. It exists only on the response
envelope (`:274`), and `limen-worker-snapshot.js:128` copies signals verbatim.

So `sigAge = Infinity`, `sigFresh = false` on every tick, and the code takes the `'EXPIRED: … —
ignored'` branch at `:335` forever. **All 14 event-type conditions are unreachable**, including
`CYBER_ATTACK`, `MILITARY_ESCALATION`, `NUCLEAR_THREAT` as event-driven, plus the `grid_stress` push
at `:331`.

A field-name mismatch is silently eating the entire event channel.

### D2 — `energy-brain.js:446` reads a field that is never emitted

It tests `f3.stress`. `domain-snapshot.js:1539-1556` emits `name, value, label, channel, quality,
classification, signalType, updated, fetchedAt, sourceUpdatedAt, live, headlines, signal, activity,
rss` — **no `stress`**. `domain-brain-base.js:448-461` maps a subset that also excludes it. Always
`undefined`; that `grid_stress` push never fires.

### D3 — the brain reads the SATURATED field and ignores the unsaturated one sitting next to it

Every RSS threshold tests `f3.value`, which is the raw `<item>` count from a Google News page
(`domain-snapshot.js:4892`, `:4987`). The file's own comment at `:4929-4936` records **89 of 275
sources pinned at exactly 100**. Thresholds of 20/30/50/60 against a value whose ceiling is 100 are
effectively latched on.

**`recent7d` and `medianAgeDays` already exist**, unsaturated, on `_meta`/`rss`
(`:4965-4968`, `:1555`). The brain never reads them.

So 11 of the 14 live conditions are driven by a saturated proxy while a better one is already
computed and discarded. **This is the single highest-leverage finding for brain-v2**: the sensors
are better than the current brain's use of them.

---

## DOWNSTREAM, FOR SIZING

- **8** diagnoses in `diagnosisIndex` (`energy-brain.js:140-148`), exact-token matched
- **6** evidence contracts (`energy-pulse-engine.js:47-117`); the 2 datacenter diagnoses have none —
  `:218` returns `'No contract defined'`
- **10** evidence families (`:183-207`); `generation_mix`, `storage_low`, `energy_high_stress`,
  `structural_stress` map to **no family** — `:208-210` is an explicit no-op
- `energy-cortex-retrieval.js:10-11` states it is not wired into the cycle — inert

---

## WHAT THIS MEANS FOR BRAIN-V2

1. **Cap the library at what 14 three-level sensors distinguish.** Not 180. The existing 8 diagnoses
   are already near the honest ceiling.
2. **Read `recent7d`, not `value`.** Recovering the unsaturated field is worth more than any new
   sensor, and costs nothing — it is already computed.
3. **Fix or drop the event channel.** 14 conditions are written and unreachable over a field-name
   mismatch. Either wire `timestamp` through, or delete the branch so nobody counts it as capacity.
4. **Do not count `seriesScore` and `marketScore` as two sensors.** They are one series, two windows.
5. **State the cadence per sensor** (R6): 3 price series are daily/business-day, 11 RSS counts are
   per-fetch, company channels are quarterly sampled every 15 minutes.
