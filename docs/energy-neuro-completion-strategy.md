# Energy Neuro-Completion Strategy — self-tuning substrate

**Source (only):** LIMEN Helix Neurology Reference + its Neuro↔Business Cross-Reference.
**Domain:** Energy. **Contract:** additive; every module is read-only / copy-only, **never writes
`energy.json`**, defaults to a **no-op**, and flags anything the documents don't supply.

## The strategy

Across prior turns, Energy gained a set of **static** neural mechanisms (offline down-scaling,
refractory rate-limit, prediction-error compression). This turn completes Energy by (a) adding the
last missing mechanisms and (b) introducing a **new strategic layer — metaplasticity — that makes
the whole set self-tuning.** The substrate stops being a bag of parts and becomes a closed
regulatory loop: mechanisms act, a meta-controller reads system state and adapts their rates.

```
                    ┌──────────────────────────────────────────┐
   system state ──▶ │  METAPLASTICITY (XIII.6) — new strategy    │
   (volatility)     │  adapts the knobs of ↓                     │
                    └───┬───────────┬───────────────┬────────────┘
                        ▼           ▼               ▼
             offline down-scale  refractory   prediction-error
              (XIII.9/XIII.6)    (III.3)       compression (XIII.5)
                        ▲           ▲               ▲
   plus targeted removal + receiver feedback + connectivity diagnostics:
   EXTINCTION (V.2) · RETROGRADE THROTTLE (IV.5) · CONNECTIVITY/SPOF AUDIT (XIV)
```

## What this turn added

| Build-target | Module | Grounding | What it does |
|---|---|---|---|
| **Metaplasticity** (new strategy) | `energy-metaplasticity.js` | XIII.6 | Reads a volatility signal, raises change-thresholds when volatile (more down-scaling, longer refractory, higher exception bar) — homeostatic "plasticity of plasticity." Ties the mechanisms into one loop. |
| Retrograde negative feedback | `energy-retrograde-throttle.js` | IV.5 | The **receiver** dials back an overloading sender (endocannabinoid volume-knob), on a copy. |
| Extinction (completed) | `energy-extinction.js` | V.2 / XIV | **Targeted** retirement of an acquired response when its trigger is gone (complements global down-scaling). |
| Dense recurrent/lateral connectivity | `energy-connectivity-audit.js` | II.2 / XIII.8 | Diagnoses how mesh-like vs tree-like the graph is. |
| Distributed/redundant control | `energy-connectivity-audit.js` | XIV diaschisis | Finds single-points-of-failure (articulation nodes) and risk-concentrating hubs. |

## What the diagnostics found on real Energy data (read-only)

- **Recurrence axis is empty:** **0 of 62 edges are reciprocal/feedback** — Energy's graph is
  feedforward-only on the feedback axis. Lateral edges exist (~29% of the classifiable ones), but
  the total absence of feedback edges is exactly the cross-ref's org-tree warning on one axis.
  *Recommendation (not applied — would edit `energy.json`): add feedback edges where control loops
  should close.*
- **10 single-points-of-failure:** articulation nodes `M1, THAL, dlPFC, HIPP, BLA, PVN, V1, A1,
  AI, NAcc`; top risk-concentrating hubs `THAL(9), HIPP(8), M1(6)`. Removing THAL fragments the
  graph — the diaschisis pathology made concrete. *Recommendation (not applied): add redundant
  paths around the hubs.*

Both are **recommendations**, deliberately not applied, because adding/removing edges edits the
existing domain file.

## Verified behaviors (all default to no-op)

- **Metaplasticity:** calm/`gain 0` → no change; volatile (v=.8, gain=.5) → down-scale 0.90→0.54,
  refractory 10→14, exception threshold 0.15→0.21 (tightens all three, correctly).
- **Retrograde:** no overload → no-op; `dACC` overloaded → its 3 incoming edges dialed back.
- **Extinction:** no trigger context → no-op (won't guess what's obsolete); with active triggers →
  proposes retiring the responses whose triggers are inactive.

## Honest gaps (flagged, not filled)

1. **No runtime state in `energy.json`** (no volatility, load, timestamps, or active-trigger
   fields). Metaplasticity's volatility, retrograde's overload, and extinction's active-triggers
   are all **caller-supplied**. Adding these runtime fields is a separate authoring item.
2. **Numeric gains not in the documents** (`gain`, `throttleGain`, thresholds) → operator-set,
   defaulted to no-op. Not fabricated.
3. **The two graph recommendations** (add feedback edges; add redundancy around hubs) require
   editing `energy.json` and are therefore **proposed, not applied**, per the additive contract.

## Status

Energy build-target coverage against the cross-ref registry is now complete at the mechanism
level: **9/9 implemented or completed** (extinction moved PARTIAL→complete). What remains is not
new mechanism work but **operator decisions**: supply the runtime fields, set the gains, and
approve the two graph edits. Those are genuine hand-offs, not things to guess.
