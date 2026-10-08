"""
shadow_proposals.py — SHADOW-ONLY dead code for the P4 and P6 proposals
(recovered §25 of the 2026-10-07 checkpoint; approved 2026-10-08 §27 as dead
code / shadow only).

Nothing in production imports this module. No board, Helix Report, or adapter
surface consumes it. It exists so the two cheap, unblocked proposals from §25
are built and testable BEFORE their gating conditions are met:
  (a) the semantic-drift fix (one meaning per number, pinned per layer), and
  (b) a pre-registered check per phase.
Until both land for a phase, its output here is analysis material only and
must never reach a company-facing surface.

Contents:
- P4 valence two-field contract: instantaneous valence vs cumulative cost.
  The registry reads P4 as "Peace" (stabilization) and the research kernel
  reads the same number as scaffolding (distress); §25's open item is to keep
  BOTH fields visible instead of letting one label win.
- P6 capital-return line: the third component the research says P6 needs
  (solvency + AR(2) rhythm + growth), which nothing currently checks.
  Dividends/buybacks arrive as their own input series.

Everything preserves the release-1 evidence discipline: MEASURED_ZERO is a
real observation, missing is never zero, and no phase verdict is emitted.
"""

from evidence import measured, missing, unsupported
from financial_phase_map import (
    WAS_WINDOW_QTRS,
    Z_SOLVENT,
    _scaffold_fires,
    _ttm,
    temporal_dyad,
)

SHADOW_VERSION = "2026-10-08.shadow-p4p6-r1"


# --------------------------------------------------------------------------
# P4 — valence two-field contract (shadow)
# --------------------------------------------------------------------------

def p4_valence_contract(ocf, cff, end_quarter, window_qtrs=WAS_WINDOW_QTRS):
    """Split P4's two readings into separate fields.

    ocf / cff: {quarter_label: Availability}, same frame as evaluate().

    Returns a dict:
      instantaneous_valence : 'SCAFFOLDING_NOW' | 'NO_CURRENT_SCAFFOLD' | None
            None = current TTM not computable (missing never reads healthy)
      valence_basis         : the TTM inputs behind the valence read
      cumulative_cost       : Availability — total measured external financing
            (sum of positive CFF) over the trailing window; MEASURED_ZERO when
            the window is measured and the company took no outside money.
            MISSING when the window is not fully measured.
      window_quarters       : number of quarters in the trailing window
    """
    ttm_ocf = _ttm(ocf, end_quarter)
    ttm_cff = _ttm(cff, end_quarter)
    if ttm_ocf.is_measured and ttm_cff.is_measured:
        valence = ("SCAFFOLDING_NOW"
                   if _scaffold_fires(ttm_ocf.value, ttm_cff.value)
                   else "NO_CURRENT_SCAFFOLD")
    else:
        valence = None

    grid = []
    q = end_quarter
    for _ in range(window_qtrs):
        grid.append(q)
        y, n = q.split("Q")
        n = int(n) - 1
        if n < 1:
            n, y = 4, int(y) - 1
        else:
            y = int(y)
        q = "%dQ%d" % (y, n)

    total = 0.0
    fully_measured = True
    for g in grid:
        a = cff.get(g)
        if a is None or not a.is_measured:
            fully_measured = False
            break
        if a.value > 0.0:
            total += a.value

    cumulative = (measured(total) if fully_measured
                  else missing("cff window incomplete: quarter not measured"))

    return {
        "instantaneous_valence": valence,
        "valence_basis": {"ttm_ocf": ttm_ocf.kind, "ttm_cff": ttm_cff.kind},
        "cumulative_cost": cumulative,
        "window_quarters": len(grid),
        "shadow_version": SHADOW_VERSION,
    }


# --------------------------------------------------------------------------
# P6 — capital-return line + three-component readiness (shadow)
# --------------------------------------------------------------------------

def p6_capital_return_line(dividends, repurchases, end_quarter,
                           window_qtrs=WAS_WINDOW_QTRS):
    """The capital-return component: did the company actually return capital?

    dividends / repurchases: {quarter_label: Availability} or None.

    Returns a dict:
      ttm_dividends    : Availability (MEASURED_ZERO is a real zero quarter)
      ttm_repurchases  : Availability
      returned_in_window : Availability — MEASURED when both series are
            measured across the trailing window; value = quarters with any
            positive capital return. None input series -> UNSUPPORTED.
    """
    def _ttm_or_unsupported(s):
        if s is None:
            return unsupported("capital-return input not provided")
        return _ttm(s, end_quarter)

    ttm_div = _ttm_or_unsupported(dividends)
    ttm_rep = _ttm_or_unsupported(repurchases)

    if dividends is None or repurchases is None:
        return {
            "ttm_dividends": ttm_div,
            "ttm_repurchases": ttm_rep,
            "returned_in_window": unsupported("capital-return input not provided"),
            "shadow_version": SHADOW_VERSION,
        }

    grid = []
    q = end_quarter
    for _ in range(window_qtrs):
        grid.append(q)
        y, n = q.split("Q")
        n = int(n) - 1
        if n < 1:
            n, y = 4, int(y) - 1
        else:
            y = int(y)
        q = "%dQ%d" % (y, n)

    hits = 0
    for g in grid:
        d = dividends.get(g)
        r = repurchases.get(g)
        if (d is None or not d.is_measured) or (r is None or not r.is_measured):
            return {
                "ttm_dividends": ttm_div,
                "ttm_repurchases": ttm_rep,
                "returned_in_window": missing(
                    "capital-return window incomplete: quarter not measured"),
                "shadow_version": SHADOW_VERSION,
            }
        if d.value > 0.0 or r.value > 0.0:
            hits += 1

    return {
        "ttm_dividends": ttm_div,
        "ttm_repurchases": ttm_rep,
        "returned_in_window": measured(float(hits)),
        "shadow_version": SHADOW_VERSION,
    }


def p6_readiness(solvency_z, revenue, capital_return):
    """Three-component readiness report for P6 (shadow).

    Research (§25): P6 Order = solvency + AR(2) rhythm + growth; the
    capital-return line is the input nothing currently checks. This reports
    each component's measurability — it never emits a phase verdict.

      solvency_z     : Availability of Altman Z''
      revenue        : {quarter_label: Availability} (rhythm component)
      capital_return : output of p6_capital_return_line()
    """
    solvency_measured = solvency_z.is_measured
    solvent = solvency_measured and solvency_z.value > Z_SOLVENT

    rev_values = [revenue[q].value for q in sorted(revenue)
                  if revenue[q].is_measured]
    coh, amp = temporal_dyad(rev_values)
    rhythm_measurable = coh is not None

    cr = capital_return.get("returned_in_window")
    capital_measured = cr is not None and cr.is_measured

    return {
        "solvency_component": {
            "measured": solvency_measured,
            "solvent": solvent if solvency_measured else None,
        },
        "rhythm_component": {
            "measurable": rhythm_measurable,
            "coherence": coh,
            "amplitude": amp,
        },
        "capital_return_component": {
            "measured": capital_measured,
            "quarters_with_return": cr.value if capital_measured else None,
        },
        "all_components_measured": (solvency_measured and rhythm_measurable
                                    and capital_measured),
        "shadow_version": SHADOW_VERSION,
    }
