# Domain Runtime Health Board — 2026-07-21

Firewalled (repo/history only). Produced by EXECUTING all 20 domain brains headless against the live
`/api/domain-snapshot`, running a real `cycle()` each (not static analysis). This is the runtime
verification half of the port — the "second agent." Method: `scratchpad/domain-healthboard.js`.

## Headline: the port works. All 20 brains run end-to-end.

Every domain brain instantiated, ran a full cycle, derived diagnoses from its portal issues,
recommended treatments, and surfaced opportunities — with zero crashes. The shared-substrate port is
structurally sound at runtime, not just in config. What varies is whether each brain has REAL DATA to
think about, and that is a data problem, not a code problem.

## The board (verdict axis = realFeeds, the only reliable column)

| domain | live stress | numeric drivers | **realFeeds** | active dx | verdict |
|---|---|---|---|---|---|
| economy | 0.38 | 14 | **11** | 2/6 | feed-backed |
| finance | 0.53 | 10 | **10** | 3/6 | feed-backed |
| infrastructure | 0.76 | 17 | **8** | 2/5 | feed-backed (fenced) |
| agriculture | 0.84 | 11 | **6** | 5/6 | feed-backed |
| defense | 0.49 | 8 | **5** | 6/6 | feed-backed |
| trade | 0.96 | 8 | **5** | 4/5 | feed-backed |
| energy | 0.81 | 16 | 3 | 6/6 | feed-backed |
| intelligence | 0.53 | 10 | 3 | 5/5 | thin |
| communication | 0.71 | 4 | 2 | 5/5 | thin |
| defense/law/education/environment/medicine | — | — | 2 | — | thin |
| governance, population, science, technology | 0.13–0.3 | — | 1 | — | very thin |
| **industry** | 0.13 | 9 | **0** | 5/5 | **BROKEN FEEDS (fixable)** |
| **culture** | 0.30 | 7 | **0** | 5/5 | **NO NUMERIC FEED (data gap)** |
| **religion** | 0.26 | 10 | **0** | 5/5 | **NO NUMERIC FEED (data gap)** |

Note: the automated `CIRCULAR` verdict in the harness was UNRELIABLE (it false-flagged energy, which
provably does not synthesize conditions from stress). Ignore it; `realFeeds` is the trustworthy signal.

## What each category means, and who fixes it

### Fixed this session (code)
- **agriculture, communication**: `_actuation.refractory=true` but no `_refractoryParams` → the brake
  constructed as a silent no-op (`absoluteWindow:0`). Added the reuse-default params (matches
  energy/finance). Both `node --check` clean. The armed brake now actually gates duplicate drafts.

### industry — FIXABLE (real feed bug, not a data gap)
industry HAS two real numeric feeds configured but both fail at runtime:
- `BLS Manufacturing PPI` (series `PCUOMFG--OMFG--`) and `BLS Employment`/`BLS Freight PPI` all hit
  `api.bls.gov`. The v2 public API allows **25 calls/day/IP without a key**; production burns that
  across all BLS feeds → throttled → `broken`. FIX: register a free BLS key
  (https://data.bls.gov/registrationEngine/ , raises to 500/day), set env `BLS_API_KEY`. The fetchers
  now read it (added 2026-07-21, additive, keyless-fallback preserved).
- SECOND BUG (independent): the stress formula `clamp((val-120)/40,0,1)` in `fetchBLSManufacturing`
  pegs to 1.0 for any real value (the index sits ~275, far above the 160 ceiling). Miscalibrated.
  Flagged, NOT blind-tuned — correct calibration needs the series' meaningful range, which is real
  analysis, not a guess. Worklist item, not an autonomous fix.
- `World Bank Manufacturing` (WBManufacturing) also `broken` — separate check pending.

### culture, religion — NOT code-fixable (genuine data/design gap)
Every source is a qualitative RSS headline (classified `event`, value=100 placeholder). There is NO
numeric-driver feed by design, so their stress (0.26–0.30) is the LOW_SIGNAL floor, not a measurement.
The headlines are real; the STRESS NUMBER is not measured. Making these honest requires either adding
a real numeric series (a cultural/religious quantitative index — a data-sourcing decision, cannot be
fabricated) or labelling their stress as unmeasured. Operator/content decision.

### Operator decisions (not autonomous)
- **Stress-derived diagnosis circularity** ([[stress-derived-diagnosis-circularity]]): 16 domains
  activate diagnoses partly from stress thresholds. The `_`-prefix remediation exists
  (`domain-console-brain.js:594-597`) and is applied to only 3 domains. Applying it to the rest is
  mechanical but VISIBLY reduces shown diagnoses — a change to what the site claims. Staged for the
  operator, not swept autonomously.
- **Stress promotion**: widen `STRESS_PROMOTION_DOMAINS` per domain after 2 clean live ticks. Finance
  is the top candidate.

## Bottom line for the operator's standing question (real vs fancy)
Real, feed-backed today: economy, finance, infrastructure, agriculture, defense, trade, energy.
Thin but real: intelligence, communication, and the 2-realfeed cluster.
Running on empty: industry (fixable — broken feeds), culture + religion (need a numeric data source).
The brains all work. The gap is data, and the board says exactly where.
