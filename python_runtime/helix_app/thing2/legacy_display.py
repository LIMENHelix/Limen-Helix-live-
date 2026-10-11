"""
legacy_display.py — live-surface display policy for the LEGACY Thing 2 engine.

Operator directive 2026-10-10 (priority before Stage 2, recorded in
THING2_REPLACEMENT_PLAN.md): the legacy 11-phase engine (phase_engine.py
v4.0.2) remains live behind the portal API and the board legacy column, but
its distress readings do not ship. On every live surface:

- P3, the P7 fork (P7a/P7b) and P9 read UNKNOWN, matching the 9.14(c)
  abstention that governs the new fpm-r2 path;
- all remaining legacy output is labeled "legacy — unvalidated".

DISPLAY-ONLY. No engine math changes; phase_engine.py is untouched. This
module only re-shapes the section dict that index.py already emits.
"""

# Legacy distress phases: the union of the 9.14(c) abstained set (P3, P7
# family) and P9 (Threshold/Collapse) — all read UNKNOWN on live surfaces.
SUPPRESSED_DISTRESS_PHASES = ("p3", "p7", "p7a", "p7b", "p9")

_LEGACY_NARRATIVE = (
    "Legacy engine v4.0.2 — unvalidated. Distress phases (P3, P7 family, P9) "
    "read UNKNOWN on this surface per 9.14(c); full cutover to the definitional "
    "map is staged (THING2_REPLACEMENT_PLAN.md)."
)


def apply_legacy_display_policy(section):
    """Apply the legacy display policy to a `_build_thing2_section()` dict.

    Mutates and returns the section. Suppression is keyed off the DISPLAYED
    dominant phase; suppressed phases are zeroed in every exposed score dict
    so no live surface can surface them.
    """
    section["kernel_lineage"] = "legacy"
    section["legacy_unvalidated"] = True

    dominant = section.get("dominant_phase")
    if dominant in SUPPRESSED_DISTRESS_PHASES:
        section["dominant_phase"] = None
        section["phase_state_label"] = None
        reasons = section.setdefault("unsupported_reasons", [])
        reasons.append(
            "legacy distress reading (%s) suppressed to UNKNOWN per 9.14(c)"
            % dominant)
        section["suppressed_phases"] = [dominant]

    for key in ("phase_scores", "intrinsic_phase_scores", "coupled_phase_scores"):
        scores = section.get(key)
        if isinstance(scores, dict):
            for p in SUPPRESSED_DISTRESS_PHASES:
                if p in scores:
                    scores[p] = 0.0

    narrative = section.setdefault("narrative_safe", [])
    if _LEGACY_NARRATIVE not in narrative:
        narrative.append(_LEGACY_NARRATIVE)
    return section
