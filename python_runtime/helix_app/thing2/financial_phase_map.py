"""
financial_phase_map.py — Thing 2 Financial Phase Map, release 1 (decision layer).

Pure decision layer over quarterly filing inputs. Implements ONLY the phases
authorized for release 1 under decision 9.14(c): P0, P2, P4, P5 and the Was
modes SCAFFOLDING / ENDURANCE / GENUINE_BASELINE. Everything else is UNKNOWN
with an explicit reason code (see evidence.py).

Isolation constraints (frozen plan, checkpoint §15):
- Accepts NO polyvagal/coupling context parameter and reads no board data.
- Missing evidence is never coerced to healthy or to zero; MEASURED_ZERO is
  preserved as a real observation.
- UNKNOWN never promotes into P0 or GENUINE_BASELINE.
- Windows count ELAPSED quarters; interior gaps do not silently shift them.

Rule sources (read from source, cited):
- P4: scripts/kernel-validation/LIMEN_FOUR_LAYER.md:67
      "annual/TTM OCF < 0 AND CFF > 0.5*|OCF|"           (reported 6/6)
- P5: LIMEN_FOUR_LAYER.md:68
      "OCF > 0 AND CFF < OCF (own cash dominates)"        (reported 6/6)
      plus a prior-P4 window (decision 9.12a)
- P2: scripts/kernel-validation/prove_p2.py:53-67 (temporal_dyad) and
      :70-78 (relational_dyad); constants at :81-82
      TEMPORAL_COH, TEMPORAL_AMP = 0.5, 0.03; RELATIONAL_LOCK = 0.6
      (lag-4 = annual phase-lock; input is decumulated discrete quarters,
      so the sampling interval is quarterly — prove_p2.py:54-56, 32-40)
- P0: positive flatness — seasonal amplitude below the P2 floor + measured
      solvency + sufficient history (spec: "S0, flat, low-variance, solvent")
- Was window: 16 elapsed quarters (was.py lookback=16; decision 9.11a)
- Solvency: Altman Z'' > 1.1 (LIMEN_FOUR_LAYER.md:70). A solvency error is
  NEVER read as solvent (fixes was.py:51 error-as-solvent, ledger D13).

This module never emits validation. Thing 2 is interpretive only.
"""

import math

from evidence import (
    Availability,
    PhaseVerdict,
    MEASURED,
    MEASURED_ZERO,
    MISSING,
    UNKNOWN_ABSTAINED,
    UNKNOWN_NOT_BUILT,
    UNKNOWN_INSUFFICIENT_HISTORY,
    measured,
    missing,
)

FORMULA_VERSION = "2026-10-07.fpm-r1"

# --- frozen constants (decision tags per checkpoint §11/§15) ---
WAS_WINDOW_QTRS = 16          # 9.11a: keep was.py lookback=16
MIN_HISTORY_QTRS = 8          # PENDING RATIFICATION (thing0Eligible hist>=8 precedent)
MIN_MEASURED_QTRS = 12        # prove_p2.py:57 len(rev) >= 12
TTM_QTRS = 4                  # prove_p2.py/flows.py trailing-four
P4_CFF_PLUG_RATIO = 0.5       # LIMEN_FOUR_LAYER.md:67
Z_SOLVENT = 1.1               # LIMEN_FOUR_LAYER.md:70
TEMPORAL_COH = 0.5            # prove_p2.py:81
TEMPORAL_AMP = 0.03           # prove_p2.py:81 (flat P0 lines must not pass)
RELATIONAL_LOCK = 0.6         # prove_p2.py:82

ABSTAINED_PHASES = ("p3", "p7", "p7a", "p7b")           # 9.14(c)
NOT_BUILT_PHASES = ("p1", "p6", "p8", "p9", "p10")      # no detector in r1


# --------------------------------------------------------------------------
# Quarter-grid helpers (elapsed quarters, gap-visible)
# --------------------------------------------------------------------------

def _q_split(q):
    y, n = q.split("Q")
    return int(y), int(n)


def _q_make(y, n):
    return "%dQ%d" % (y, n)


def _q_next(q):
    y, n = _q_split(q)
    n += 1
    if n > 4:
        n = 1
        y += 1
    return _q_make(y, n)


def _q_prev(q):
    y, n = _q_split(q)
    n -= 1
    if n < 1:
        n = 4
        y -= 1
    return _q_make(y, n)


def _elapsed_grid(start_q, end_q):
    """Inclusive list of elapsed quarter labels start_q..end_q."""
    out = []
    q = start_q
    while True:
        out.append(q)
        if q == end_q:
            return out
        q = _q_next(q)


# --------------------------------------------------------------------------
# Small statistics (population std, matching numpy defaults used by prove_p2)
# --------------------------------------------------------------------------

def _mean(xs):
    return sum(xs) / float(len(xs))


def _std(xs):
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / float(len(xs)))


def _linfit_slope_intercept(xs, ys):
    n = float(len(xs))
    sx = sum(xs)
    sy = sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(xs[i] * ys[i] for i in range(len(xs)))
    denom = n * sxx - sx * sx
    if denom == 0.0:
        return 0.0, sy / n
    slope = (n * sxy - sx * sy) / denom
    return slope, (sy - slope * sx) / n


# --------------------------------------------------------------------------
# Dyads — ports of prove_p2.py (cited above)
# --------------------------------------------------------------------------

def temporal_dyad(rev_values):
    """Port of prove_p2.py:53-67. rev_values: measured positive revenue,
    oldest first. Returns (coherence, amplitude); (None, None) if insufficient
    (< 12 positive quarters)."""
    if len(rev_values) < MIN_MEASURED_QTRS:
        return None, None
    if any(v <= 0 for v in rev_values):
        return None, None
    lx = [math.log(v) for v in rev_values]
    n = len(lx)
    t = list(range(n))
    slope, intercept = _linfit_slope_intercept(t, lx)
    resid = [lx[i] - (slope * t[i] + intercept) for i in range(n)]
    amp = _std(resid)
    a = resid[:-4]
    b = resid[4:]
    if _std(a) < 1e-9 or _std(b) < 1e-9:
        return 0.0, amp
    ma = _mean(a)
    mb = _mean(b)
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(len(a))) / float(len(a))
    cor = cov / (_std(a) * _std(b))
    return cor, amp


def relational_dyad(rev_values, cost_values):
    """Port of prove_p2.py:70-78. Lock = 1 - min(cv/0.15, 1).
    Returns None when fewer than 8 cost quarters."""
    if cost_values is None or len(cost_values) < 8:
        return None
    n = min(len(rev_values), len(cost_values))
    r = rev_values[-n:]
    c = cost_values[-n:]
    ratio = [c[i] / (r[i] + 1e-9) for i in range(n)]
    m = _mean(ratio)
    cv = _std(ratio) / (abs(m) + 1e-9)
    return 1.0 - min(cv / 0.15, 1.0)


# --------------------------------------------------------------------------
# Kernel rules (point-in-time)
# --------------------------------------------------------------------------

def _ttm(series, end_q, n=TTM_QTRS):
    """Sum of the n consecutive MEASURED quarters ending at end_q (inclusive).
    MISSING if any window slot is unmeasured — never coerced to zero."""
    vals = []
    q = end_q
    for _ in range(n):
        a = series.get(q)
        if a is None or not a.is_measured:
            return missing("ttm window incomplete: quarter %s not measured" % q)
        vals.append(a.value)
        q = _q_prev(q)
    return measured(sum(vals))


def _scaffold_fires(ttm_ocf, ttm_cff):
    # LIMEN_FOUR_LAYER.md:67
    return ttm_ocf < 0.0 and ttm_cff > P4_CFF_PLUG_RATIO * abs(ttm_ocf)


def _endurance_fires(ttm_ocf, ttm_cff):
    # LIMEN_FOUR_LAYER.md:68
    return ttm_ocf > 0.0 and ttm_cff < ttm_ocf


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------

def evaluate(revenue, ocf, cff, solvency_z, cost=None, end_quarter=None,
             formula_version=FORMULA_VERSION):
    """Evaluate one company at one quarter.

    revenue / ocf / cff / cost: {quarter_label: Availability}
    solvency_z: Availability of Altman Z'' (MEASURED) or MISSING/err
    end_quarter: evaluation quarter; default = latest measured revenue quarter.

    No coupling/context parameter exists by design (isolation test asserts this).
    """
    evidence = {
        "abstained_phases": list(ABSTAINED_PHASES),
        "not_built_phases": list(NOT_BUILT_PHASES),
    }

    rev_qs = sorted([q for q, a in revenue.items() if a.is_measured])
    if not rev_qs:
        return PhaseVerdict(None, None, UNKNOWN_INSUFFICIENT_HISTORY,
                            "no measured revenue history", formula_version, evidence)

    end_q = end_quarter or rev_qs[-1]
    grid = _elapsed_grid(rev_qs[0], end_q)
    gaps = [q for q in grid if q not in revenue or not revenue[q].is_measured]
    evidence["history_elapsed_quarters"] = len(grid)
    evidence["interior_gaps"] = gaps

    if len(grid) < MIN_HISTORY_QTRS:
        return PhaseVerdict(None, None, UNKNOWN_INSUFFICIENT_HISTORY,
                            "elapsed history %d < %d quarters" % (len(grid), MIN_HISTORY_QTRS),
                            formula_version, evidence)
    if gaps:
        # zero-tolerated-interior-gaps default (pending ratification)
        return PhaseVerdict(None, None, UNKNOWN_INSUFFICIENT_HISTORY,
                            "interior gap(s) %s; window does not shift across gaps" % ",".join(gaps),
                            formula_version, evidence)

    # --- current-quarter kernels ---
    ttm_ocf = _ttm(ocf, end_q)
    ttm_cff = _ttm(cff, end_q)
    evidence["ttm_ocf"] = ttm_ocf.kind
    evidence["ttm_cff"] = ttm_cff.kind

    flows_ok = ttm_ocf.is_measured and ttm_cff.is_measured
    cur_p4 = _scaffold_fires(ttm_ocf.value, ttm_cff.value) if flows_ok else None
    cur_p5 = _endurance_fires(ttm_ocf.value, ttm_cff.value) if flows_ok else None

    # --- prior-P4 window (decision 9.12a: P4-only history) ---
    window = grid[-WAS_WINDOW_QTRS:]
    prior = None  # None = not computable anywhere in window
    if flows_ok:
        computable = 0
        prior = False
        for q in window:
            o = _ttm(ocf, q)
            c = _ttm(cff, q)
            if not (o.is_measured and c.is_measured):
                # TTM boundary: the first quarters of company history have no
                # prior 4 quarters to sum — skip, do not abort the window.
                # (Interior gaps were already excluded by the gap check above.)
                continue
            computable += 1
            if _scaffold_fires(o.value, c.value):
                prior = True
                break
        if computable == 0:
            prior = None
    evidence["window_quarters"] = len(window)
    evidence["ever_p4_in_window"] = prior

    # --- solvency: an error is never 'solvent' ---
    solvency_known = solvency_z.is_measured
    solvent = solvency_known and solvency_z.value > Z_SOLVENT
    evidence["solvency"] = solvency_z.kind

    # --- rhythm / flatness (P2 / P0) ---
    trail = [revenue[q].value for q in grid[-16:]]
    coh, amp = temporal_dyad(trail)
    lock = None
    if cost is not None:
        cost_measured = [cost[q].value for q in sorted(cost)
                         if q in grid and cost[q].is_measured]
        rev_measured = [revenue[q].value for q in sorted(revenue)
                        if q in grid and revenue[q].is_measured]
        lock = relational_dyad(rev_measured, cost_measured)
    evidence["temporal_coherence"] = coh
    evidence["seasonal_amplitude"] = amp
    evidence["relational_lock"] = lock

    rhythm_measurable = coh is not None
    p2_fires = (rhythm_measurable and coh >= TEMPORAL_COH and amp >= TEMPORAL_AMP) or \
               (lock is not None and lock >= RELATIONAL_LOCK)
    flat_measurable = rhythm_measurable
    p0_flat = flat_measurable and amp < TEMPORAL_AMP

    # --- phase precedence: P4 > P5 > P2 > P0; otherwise UNKNOWN ---
    if cur_p4:
        return PhaseVerdict("p4", "SCAFFOLDING", "p4",
                            "TTM OCF<0 and CFF>0.5*|OCF| (LIMEN_FOUR_LAYER.md:67)",
                            formula_version, evidence)

    if cur_p5 is True:
        if prior is True:
            return PhaseVerdict("p5", "ENDURANCE", "p5",
                                "own-cash dominant now with prior P4 window (9.12a)",
                                formula_version, evidence)
        if prior is False:
            # always-self-funded: never fell -> never 'recovered' (Gap 4 fix)
            pass  # fall through to rhythm/baseline evaluation; P5 is NOT emitted
        else:
            return PhaseVerdict(None, None, UNKNOWN_INSUFFICIENT_HISTORY,
                                "prior-P4 window not computable; P5 history rule needs it",
                                formula_version, evidence)

    if cur_p5 is None:
        return PhaseVerdict(None, None, UNKNOWN_INSUFFICIENT_HISTORY,
                            "OCF/CFF window incomplete; P4/P5 not evaluable (missing never reads healthy)",
                            formula_version, evidence)

    if p2_fires:
        mode = "GENUINE_BASELINE" if prior is False else None
        return PhaseVerdict("p2", mode, "p2",
                            "lag-4 coherence %.3f >= %.2f with amplitude %.4f >= %.3f (prove_p2.py:53-67,81)"
                            % (coh, TEMPORAL_COH, amp, TEMPORAL_AMP),
                            formula_version, evidence)

    if p0_flat and solvency_known and solvent:
        mode = "GENUINE_BASELINE" if prior is False else None
        return PhaseVerdict("p0", mode, "p0",
                            "positive flatness: amplitude %.4f below floor %.3f, solvent, %d elapsed quarters"
                            % (amp, TEMPORAL_AMP, len(grid)),
                            formula_version, evidence)

    if p0_flat and not (solvency_known and solvent):
        return PhaseVerdict(None, None, UNKNOWN_ABSTAINED,
                            "flat but solvency not established as solvent; P0 requires positive evidence",
                            formula_version, evidence)

    return PhaseVerdict(None, None, UNKNOWN_NOT_BUILT,
                        "no release-1 detector fired (P1/P6/P8-P10 not built; P3/P7 abstained per 9.14c)",
                        formula_version, evidence)
