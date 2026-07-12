# Energy — Offline Maintenance Cycle (concrete proposal)

**Source (only):** LIMEN Helix Comprehensive Neurology Reference — Part XIII.9 (sleep /
offline processing), XIII.6 (homeostatic scaling), IV.6 (termination / clearance), XIV
(excitotoxicity, neurodegeneration).
**Domain:** Energy. **Contract:** additive; proposes a new maintenance pass, modifies **no**
existing Energy file. The reference implementation operates on a **deep copy** and **never
writes to disk**. Defaults are a full **no-op** — nothing happens until the operator sets the
parameters the source document does not provide.

## The invariant being satisfied

> Part XIII.9: "a mandatory offline maintenance/reset phase — a system with no downtime
> accumulates damage." Sleep **down-scales synapses globally while consolidating select
> memories** (Niethard 2017) and **drives glymphatic clearance** of waste (Benveniste 2018).
> XIII.6: a **homeostatic-scaling counter-process** must keep Hebbian learning from running
> away. IV.6 / XIV: **uncleared signal becomes toxic** (excitotoxicity); accumulated waste +
> failed clearance = neurodegeneration.

Energy currently has no offline phase, so accumulated edge weight and stale signal have no
reset — the exact failure the document names.

## The pass — four operations

Run periodically (a "downtime" between active cycles). Each operation names its document basis
and its Energy-data effect. **Every numeric parameter is flagged `operator-set` — it is NOT in
the source document and is NOT invented here.**

### 1. Global down-scaling with selective consolidation  — XIII.9 + XIII.6
- **Does:** proportional multiplicative down-scaling `w' = w * downscaleFactor` (factor ≤ 1) —
  reduces total drive and **preserves relative order/ratios**. The top-`K` edges by weight are
  **consolidated** (protected from down-scaling) — the document's "consolidate select memories
  while down-scaling globally."
- **Why:** returns total drive to range so learning can't ratchet weights to saturation; keeps
  the validated/strong structure.
- **operator-set:** `downscaleFactor ∈ (0,1]` (1 = no-op), `consolidateTopK`. The document gives
  the **shape** ("down-scales synapses globally" = proportional reduction) but **no rate** — the
  rate is the operator's to set.
- **Correction note:** an earlier draft pulled weights toward a computed mean (`baseline`); that
  could *increase* total drive, contradicting XIII.9's "down-scales." Replaced with proportional
  scaling, which can only reduce drive. The invented `baseline` parameter was removed.

### 2. Signal clearance / termination  — IV.6 + XIV (excitotoxicity)
- **Does:** reset transient activation state that has persisted beyond its bound (uncleared
  signal → toxic).
- **HONEST GAP:** Energy activations carry `state` but **no age/timestamp/persistence field**.
  There is nothing to key "stale" on. This operation therefore **cannot run** on current data
  and is **skipped with a flag**, not faked. To enable it, Energy would need a per-signal
  last-active field (that is an authoring item, not something to guess here).

### 3. Waste clearance / pruning  — XIII.9 (glymphatic) + XIV (neurodegeneration)
- **Does:** prune accumulated near-dead structure — edges at or below a `pruneThreshold`
  (the analog of clearing waste that would otherwise aggregate).
- **operator-set:** `pruneThreshold` (default `0` = prune nothing = no-op). Document gives the
  principle (clear accumulated waste during downtime), not a threshold.

### 4. E/I re-balance check  — XIII.1 (report only, no mutation)
- **Does:** recompute per-node excit/inhib in-degree after down-scaling and report imbalance.
- **Caveat carried forward:** as found in the authored-overlay run, Energy's inhib edges target
  canonical nodes outside the 21 activations, so this check is **reported, not acted on** —
  it does not flag seizure risk on in-degree alone.

## Safeguards (why this is safe to propose)

- **Order-preserving** down-scaling: relative importance is retained; the pass renormalizes,
  it does not flatten.
- **Consolidation** protects the strongest structure from erosion (no wiping validated work).
- **Defaults are a no-op** (`downscaleFactor=1`, `consolidateTopK=∞`, `pruneThreshold=0`): the
  pass changes nothing until the operator deliberately sets parameters.
- **Copy-only:** the reference implementation returns a new maintained object + a report and
  **never mutates or writes** `energy.json`.

## Two honest gaps (flagged, not filled)

1. **Signal-age field is missing** in Energy data → operation 2 (clearance) cannot run. Needs a
   per-signal last-active field first. Not invented.
2. **No numeric rates in the source document** → `downscaleFactor`, `consolidateTopK`,
   `baseline`, `pruneThreshold` are all operator-set placeholders. I did not fabricate values.
3. **Hook point:** the exact place in Energy's operating loop to schedule this pass is **not in
   this document**. Recommend the operator confirm the insertion point rather than me assuming
   it from other artifacts (which this task is scoped to exclude).

## Reference implementation

`assets/js/energy-offline-maintenance.js` — a pure `runOfflineMaintenance(energy, params)` that
implements operations 1, 3, and 4 on a deep copy, skips 2 with a flag, and returns
`{ maintained, report }`. With default params it is a verified no-op.
