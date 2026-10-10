"""
fpm_bridge.py — dead-code seam: fpm-r2 verdict -> Thing 2 section shape.

Stage 1 of THING2_REPLACEMENT_PLAN.md (scripts/kernel-validation/).
NOT WIRED anywhere: index.py still builds the Thing 2 section from
phase_engine.run_pipeline. This module exists so the Seam A cutover is a
reviewed one-line source swap instead of a new design under time pressure.

Scope honesty (do not widen without a ratified decision):
- fpm-r2 defines P0/P2/P4/P5 only. P1/P6/P8-P10 are not built, P3/P7 are
  abstained (9.14(c)); every one of them reads UNKNOWN with an explicit code.
  The legacy engine's scores for those phases have NO equivalent here and are
  never synthesized.
- UNKNOWN never promotes: dominant_phase is None for UNKNOWN verdicts.
- No coupling/context input exists (financial_phase_map isolation constraint).
- Never emits alert, never emits validation, zero alert authority.
- verification_status stays "not_run" until the independent reference
  verification (Stage 2) is signed and run.
"""

import math

from evidence import measured, missing
import financial_phase_map as fpm

KERNEL_ID = "financial_phase_map.py"
KERNEL_RUNTIME = "python-vercel"

# Frozen registry titles (operator decision 2026-10-09). "Stabilisation" and
# "Peace" are retired on released surfaces; do not reintroduce them here.
FROZEN_TITLES = {
    "p0": "P0 Source",
    "p2": "P2 Rhythm",
    "p4": "P4 Scaffolding",
    "p5": "P5 Endurance",
}
UNKNOWN_TITLE = "UNKNOWN"

# Neutral state labels, mirror of index.py _PHASE_STATE_LABELS for the four
# definitional phases. Reconcile p4's label ("stabilization state" there vs
# Scaffolding frozen title) at Stage 3 wiring — frozen title wins.
_STATE_LABELS = {
    "p0": "p0 baseline state",
    "p2": "p2 rhythm state",
    "p4": "p4 scaffolding state",
    "p5": "p5 endurance state",
}


def _to_availability(series):
    """{quarter_label: number|None} -> {quarter_label: Availability}.

    None / non-numeric / NaN / inf entries are DROPPED, not zero-filled: a
    dropped quarter is what fpm-r2's gap and window gates must see
    (missing never reads healthy; zero interior gaps tolerated).
    """
    out = {}
    if not series:
        return out
    for q, v in series.items():
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if math.isnan(f) or math.isinf(f):
            continue
        out[str(q)] = measured(f)
    return out


def build_fpm_section(revenue, ocf=None, cff=None, solvency_z=None, cost=None,
                      end_quarter=None):
    """Evaluate one company through fpm-r2, returned in the
    index.py::_build_thing2_section() output shape.

    revenue / ocf / cff / cost: {quarter_label: number|None} — measured
    values only; absence is handled by the map's own gates.
    solvency_z: Altman Z'' float, or None -> MISSING (P0 then cannot fire:
    a solvency error is never read as solvent).

    Dead code: nothing calls this yet (Stage 1). Cutover is Stage 3.
    """
    solv = (measured(float(solvency_z)) if solvency_z is not None
            else missing("solvency_z not supplied to bridge"))

    verdict = fpm.evaluate(
        revenue=_to_availability(revenue),
        ocf=_to_availability(ocf),
        cff=_to_availability(cff),
        solvency_z=solv,
        cost=_to_availability(cost) if cost else None,
        end_quarter=end_quarter,
    )

    unknown = verdict.is_unknown
    phase = None if unknown else verdict.phase

    narrative = [
        "Long-arc phase tracker is interpretive only. It is not a validated distress alert.",
        "Phase posture is descriptive, not diagnostic. Authority for distress assertions belongs to Thing 1.",
        "Definitional reading (fpm-r2): release-1 phases P0/P2/P4/P5 only; "
        "P1/P6/P8-P10 not built, P3/P7 abstained (9.14c); everything else reads UNKNOWN.",
    ]

    return {
        "available": True,
        "kernel_id": KERNEL_ID,
        "kernel_runtime": KERNEL_RUNTIME,
        "kernel_version": fpm.FORMULA_VERSION,
        "validation_status": "experimental",
        "verification_status": "not_run",
        "interpretive_only": True,
        "definitional": True,
        "phase_state_label": None if unknown else _STATE_LABELS.get(phase),
        "phase_title": UNKNOWN_TITLE if unknown else FROZEN_TITLES.get(phase, phase),
        "dominant_phase": phase,
        "phase_mode": verdict.mode,
        # fpm-r2 is definitional, not a scorer: no synthetic score vector.
        "phase_scores": {},
        "reading": verdict.to_dict(),
        "state_summary": {},
        "narrative_safe": narrative,
        "unsupported_reasons": [verdict.reason] if unknown else [],
        # No fpm-r2 equivalent exists (isolation constraint); explicit, not omitted.
        "coupling_mode": "not_supported",
    }
