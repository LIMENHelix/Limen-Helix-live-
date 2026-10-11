# Thing 2 Replacement Plan — fpm-r2 over the legacy 11-phase engine

Status: through Stage 2 (signed + run) and Stage 1.5 (legacy suppression,
operator directive). Dated 2026-10-10.
Nothing in this plan deploys. Deploy of any surface remains gated on
decision 9.15 and the operator's queue.

## Vocabulary guard (checkpoint glossary)

- **Things** = layers: Thing 0 (eligibility gate), Thing 1 (locked kernel,
  `limen_backtest.py`, sha256 `3ce4a652…82d20`, never edited), Thing 2
  (formula phase map — holds the formulas for all phases P0–P10).
- **Phases** = states from `phase-registry.js`. P1 is a phase, not Thing 1.
  P2 is a phase, not Thing 2.

## Answers to the operator's questions (2026-10-10)

1. **Thing 1 changes?** None. Zero code changes; the kernel stays locked.
   Everything Thing 1 was documentation: `THING1_V1_SCOPED_CLAIM.md` (with
   clause 6), the board label "(v1, 2015+)". Decision (a) adopted, (b) deferred.
2. **Thing 2 changes?** Yes — additive only, branch-only, not deployed.
   The new Thing 2 is `python_runtime/helix_app/thing2/financial_phase_map.py`
   (fpm-r2, `FORMULA_VERSION = 2026-10-09.fpm-r2`): definitional formulas for
   **P0/P2/P4/P5 only**, everything else UNKNOWN with explicit reason codes.
   It currently feeds only the ADDED board channel
   (`assets/data/command-board-thing2-readings.json` → `kernel-comparison.js`,
   n=493, frozen titles P0 Source / P2 Rhythm / P4 Scaffolding / P5 Endurance).
3. **The old ("previous") Thing 2 still runs everything else**, in three places:
   - `assets/js/limen-thing2-kernel.js` — JS kernel (sync source for the port);
   - `python_runtime/helix_app/thing2/phase_engine.py` — Python port v4.0.2,
     powering the live portal API `_build_thing2_section()` in `index.py`
     (all 13 phases + trajectory + polyvagal Pass 2);
   - `assets/js/limen-thing2-adapter.js` → `assets/data/command-board-data.json`
     per-CIK phase (`p`) — the board's legacy Phase column, consumed by
     `kernel-comparison.js` verdict rules and front pages.

## Replacement is scoped per phase — never wholesale

fpm-r2 defines P0/P2/P4/P5. The old engine covers 13 phases. A cutover can
therefore only replace readings for the four definitional phases; every other
phase reads UNKNOWN (P1/P6/P8–P10 not built; P3/P7 abstained per 9.14(c)) —
or, where a consumer genuinely needs a legacy phase string, it must be labeled
legacy. UNKNOWN never promotes to a phase (standing rule).

## Seams (where replacement happens, in order)

- **Seam A — portal API** `index.py::_build_thing2_section`. Live Helix Report
  portals render old-engine phases. Cutover = source the section from the
  fpm-r2 verdict via the bridge, same output shape. Polyvagal Pass 2 has NO
  fpm-r2 equivalent (isolation constraint: no context parameter) — its
  disposition is an explicit operator decision, recorded below; it is not
  silently dropped.
- **Seam B — board legacy Phase column** (`command-board-data.json` `p`).
  Replaced for definitional phases only; this is deploy-gated (9.15) and
  interlocks with the CIK-adjudication queue.
- **Seam C — downstream consumers** of old phase strings: peer-cohort drag,
  counterparty/domain propagation (`index.py`), `dsm-circuit-map.js`,
  simulation engine. Re-spec AFTER A/B: propagate definitional readings only;
  UNKNOWN propagates as no-signal.

## Stage plan (each stage separately committable)

- **Stage 0 (done, this doc):** map + plan recorded.
- **Stage 1 (done):** `thing2/fpm_bridge.py` — dead-code seam,
  `build_fpm_section(revenue, ocf, cff, solvency_z, cost, end_quarter)` returns
  the `_build_thing2_section()` output shape sourced from `fpm.evaluate`.
  Nothing calls it. Tests in `thing2/tests/test_fpm_bridge.py`.
- **Stage 1.5 (done, operator directive 2026-10-10):** legacy live-surface
  suppression, display-only, ships via main only on the operator's go.
  - `thing2/legacy_display.py` — `apply_legacy_display_policy(section)`:
    legacy distress phases (P3, P7 family, P9) read UNKNOWN per 9.14(c);
    all remaining legacy output labeled "legacy — unvalidated". Wired into
    both return paths of `index.py::_build_thing2_section`; the legacy engine
    itself is untouched. Tests: `thing2/tests/test_legacy_display.py`.
  - `assets/js/kernel-comparison.js` — board legacy column: `_legacyPhase()`
    suppression in `classifySignal` (distress rules can no longer fire on
    withheld readings; the Thing-1 ALERT rule is untouched) and
    `_legacyPhaseChip()` at both render sites (table cell + expand panel).
    Note: the Thing-1-gated VERDICT_TAG register still keys off the raw
    legacy phase on validated alerts — recorded as Seam C work, not changed.
- **Stage 2 (SIGNED 2026-10-10, ran):** `scripts/kernel-validation/verify_release1.py`
  — independent reference (stdlib-only, imports nothing from the production
  tree: de-cumulation and Altman Z'' ported; fpm-r2 scoring re-implemented
  from the frozen constants). First run against the committed artifact
  (cutoff 2026-10-09, meta n=493): **477/477 verifiable rows match exactly**
  (P0 45, P2 133, P4 20, P5 35, all UNKNOWN classes); 0 scoring divergences;
  invariants: formula_version pinned OK, grammar OK, no validated:true OK.
  Two artifact-hygiene findings (scoring is clean; the JSON is not):
  (a) 24 stale duplicate rows — title "UNKNOWN — ENTITY UNRESOLVED" over a
  live scored reading, `entity_status: duplicate_row_dropped` (CIK
  re-keying left the old-CIK row behind);
  (b) 14 readings keys have no cache file (SKIP_NO_CACHE_FILE).
  Proposed repair (operator approval required, not applied): drop the 24
  stale duplicate keys; re-key or refetch the 14. Report:
  `verify_release1_report.json`. No surface claims "verified" yet — the
  claim change is staged with the deploy decision; the bridge keeps
  `verification_status: "not_run"` until then.
- **Stage 3 (deploy-gated):** wire the bridge into `_build_thing2_section`
  behind an explicit flag (default off = legacy engine). Label reconciliation:
  index.py's `_PHASE_STATE_LABELS["p4"] = "p4 stabilization state"` predates
  the frozen title Scaffolding — frozen registry titles win on every released
  surface.
- **Stage 4 (deploy-gated, decision 9.15):** board legacy Phase column cutover.
- **Stage 5:** consumer re-spec (Seam C) after 3–4 are stable.

## Operator decisions recorded

1. **Polyvagal Pass 2 — NOT ported to fpm-r2** (decision 2026-10-10). Stays in
   the legacy engine, labeled, until legacy retirement. Rationale: polyvagal
   theory's core claims are actively contested in the literature (Grossman &
   Taylor 2007 and later critiques — recalled, not re-verified this session);
   under the structural-homology standard a contested correlate cannot carry
   weight in a phase decision. fpm-r2's no-context isolation constraint stands.
2. **Legacy suppression ships via main only on the operator's go**; the
   merge-to-main rule stands (merge = deploy). The changes live on the agent
   branch as a reviewable diff.
3. Stage 2 signature granted 2026-10-10 (independent code path condition met).

## Open decisions for the operator

1. Approval to drop the 24 stale duplicate readings rows and repair/re-key
   the 14 no-cache rows (artifact hygiene; no scoring changes).
2. Whether Seam A or Seam B cuts over first (current plan: A behind a flag,
   B at 9.15).
3. Disposition of the Thing-1-gated VERDICT_TAG register's use of the raw
   legacy phase (Seam C).

## Non-goals / standing rules (unchanged)

- Thing 1: no code changes, ever, under this plan.
- `phase_engine.py` is not deleted while any seam still consumes it; final
  disposition is its own decision after cutover.
- Thing 2 stays interpretive only: no alert field, no validation, zero alert
  authority on every surface.
- One label vocabulary: frozen titles P0 Source / P2 Rhythm / P4 Scaffolding /
  P5 Endurance; "Stabilisation" and "Peace" are retired on released surfaces.
- Pre-registration discipline: Stage 2 runs only on the operator's signature;
  no numbers change after first results.

