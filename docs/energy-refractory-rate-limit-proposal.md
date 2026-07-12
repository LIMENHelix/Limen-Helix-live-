# Energy — Refractory Rate-Limit (concrete proposal)

**Source (only):** LIMEN Helix Neurology Reference — III.3 (action potential:
absolute refractory ~1-2 ms, relative refractory), Part XV (parameter table), and the
Neuro↔Business Cross-Reference Chart C (`REFRACTORY_RATE_LIMIT`: "dead-time preventing
immediate re-firing"; lesion if absent: "whiplash, thrash, strategy churn").
**Domain:** Energy. **Contract:** additive; the reference implementation holds its **own**
event log, **never writes** `energy.json`, and **defaults to a no-op** (disabled) until the
operator sets a window. Nothing existing is modified.

## The mechanism (grounded)

> III.3: **Absolute refractory period (~1-2 ms)** — no second action possible; enforces
> one-way propagation and **caps maximum firing rate**. **Relative refractory period** — a
> **stronger-than-normal stimulus can fire**. ⟨fractal-critical: a built-in rate limiter /
> dead-time after action⟩

So refractoriness is **two-phase**, and both matter:
1. **Absolute** — a hard dead-time: an action cannot re-fire at all within `absoluteWindow`.
2. **Relative** — a raised bar: within `relativeWindow`, the action can re-fire **only if the
   new signal strength exceeds an elevated threshold** (`overrideThreshold`). Genuine surprises
   still get through; noise-level re-triggers do not.

Modeling only the absolute phase would be an incomplete circuit (the document has both).

## The Energy analog

Energy "actions" (an issue firing, a node state-change, an alert/emission) currently have **no
dead-time** — the cross-ref's exact lesion, "decisions re-litigated instantly → thrash." This
adds a limiter that, keyed by an Energy action id (e.g. an issue id like `GRID_COLLAPSE`, or a
node id), enforces:
- re-fire **blocked** inside the absolute window,
- re-fire **allowed only on a stronger-than-normal signal** inside the relative window,
- re-fire **normal** after.

## Parameters — all operator-set (NOT in the document at business scale)

| Param | Meaning | Default | Basis |
|---|---|---|---|
| `absoluteWindow` | hard dead-time after a fire | `0` (disabled → no-op) | shape from III.3; business-scale duration **operator-set** |
| `relativeWindow` | raised-bar window (≥ absolute) | `0` | shape from III.3; duration operator-set |
| `overrideThreshold` | strength needed to fire in the relative phase | `Infinity` (never override) | III.3 "stronger-than-normal stimulus"; level operator-set |

**Units are caller-defined** (the same unit for `now` and the windows). The document gives
~1-2 ms at neural scale; the **business-scale value must be derived from the two-timescale ratio
invariant**, not copied.

### Derived window sizing (from the cross-ref, flagged — not asserted)

The Neuro↔Business Cross-Reference fixes the business-side span: operational decisions
minutes–hours, governance weeks–quarters (~10³–10⁴). So a refractory window should scale to the
**tier** of the action:

| Action tier | Suggested window span | Status |
|---|---|---|
| Operational | minutes – hours | **derived from cross-ref; operator to confirm** |
| Management | days – weeks | derived; confirm |
| Governance | weeks – quarters | derived; confirm |

`suggestWindow(tier)` returns this **span**, not a single number — it will **not** auto-plug a
fabricated value into the limiter. The operator picks the actual number. Which Energy action maps
to which tier is **not** in either document, so the limiter never assigns it automatically.

## Safeguards

- **Defaults are a no-op** (`absoluteWindow=0`): the limiter allows everything until deliberately
  configured.
- **Relative-phase override** preserves genuine surprises (a real escalation still fires), so the
  limiter damps thrash without blinding the system — the document's design, not a blunt mute.
- **Log-only:** the limiter keeps its own `{key → last fire}` map and **never reads or writes**
  `energy.json`.

## Honest gaps (flagged, not filled)

1. **No timestamp field on Energy actions.** `energy.json` issues/activations carry no
   `lastFired`/timestamp. The limiter therefore holds its **own** external log rather than
   reading one off the domain data. Adding a per-action timestamp is a separate authoring item.
2. **Business-scale durations + override level are not in the source document** → `absoluteWindow`,
   `relativeWindow`, `overrideThreshold` are operator-set placeholders. Not fabricated.
3. **Action→tier mapping** (which Energy action counts as operational vs governance) is in neither
   document → the caller supplies `tier`; the limiter does not guess it.

## Reference implementation

`assets/js/energy-refractory-limiter.js` — a `RefractoryLimiter` with `check()` (evaluate without
recording), `fire()` (evaluate + record if allowed), a pure `evaluate()`, and `suggestWindow(tier)`.
Defaults make it a verified no-op.
