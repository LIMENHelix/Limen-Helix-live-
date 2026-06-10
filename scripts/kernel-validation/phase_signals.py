#!/usr/bin/env python3
"""
Shared phase-signal primitives (book-grounded), reused across prove_*.py.

Built up phase by phase as the developmental grammar is proven from Book I:
 - rev/cost series (point-in-time, de-cumulated)
 - rhythm()            : temporal dyad — does the series phase-lock to its own
                         prior cycle? (lag-4 autocorr + amplitude). P0 has NONE;
                         P2 has a STABLE one.
 - relational_lock()   : relational dyad — two streams in a stable mutually-
                         defining relationship (revenue<->cost stable ratio).
 - growth_cv()         : trend + dispersion (P0 flat vs P6 grow vs P3 decline).
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from flows import decumulate          # noqa: E402

COST_TAGS = ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold",
             "CostsAndExpenses", "OperatingExpenses"]


def _clean_interp(vals):
    """Replace de-cumulation artifacts (ISOLATED spikes/dips) with the mean of
    neighbors, keeping the series REGULAR for lag-4/YoY. Compares each quarter to its
    LOCAL neighbors (median of i-2..i+2), NOT the global median, so a smooth growth
    RAMP (NVDA: big quarters next to big quarters) is preserved while an isolated
    artifact is caught:
      - TOO SMALL (<15% of local): restated-annual minus original-interim (MMM 11M
        between ~6000M neighbors)
      - TOO LARGE (>3.5x local): an un-de-cumulated annual (TGT cost spike)
    Seasonal highs (~1.3x) and sustained hypergrowth are within the local band."""
    if len(vals) < 5:
        return list(vals)
    out = list(vals)
    for i in range(len(out)):
        nb = [out[j] for j in (i - 2, i - 1, i + 1, i + 2) if 0 <= j < len(out)]
        loc = float(np.median(np.abs(nb))) if nb else 0.0
        if loc <= 0:
            continue
        if abs(out[i]) < 0.15 * loc or abs(out[i]) > 3.5 * loc:
            good = [out[j] for j in (i - 1, i + 1)
                    if 0 <= j < len(out) and 0.15 * loc <= abs(out[j]) <= 3.5 * loc]
            if good:
                out[i] = sum(good) / len(good)
    return out


def _rev_dict(facts, cutoff=None):
    return decumulate(facts, lb.TAG_MAP["Revenue"], cutoff)


def _cost_dict(facts, cutoff=None):
    for tag in COST_TAGS:
        if not (facts or {}).get("facts", {}).get("us-gaap", {}).get(tag):
            continue
        d = decumulate(facts, [tag], cutoff)
        v = [x for _, x in sorted(d.items())]
        if len(v) >= 8 and all(x > 0 for x in v[-8:]):
            return d
    return None


def rev_series(facts, cutoff=None, n=16):
    d = _rev_dict(facts, cutoff)
    return _clean_interp([v for _, v in sorted(d.items())])[-n:]


def cost_series(facts, cutoff=None, n=16):
    d = _cost_dict(facts, cutoff)
    if d is None:
        return None
    return _clean_interp([v for _, v in sorted(d.items())])[-n:]


def margin_series(facts, cutoff=None, n=16):
    """Gross-margin series ALIGNED by quarter key (not by position). Applies a
    DOMAIN-VALIDITY clamp: a real gross margin is in [-0.5, 0.95]; anything outside
    is provably a data artifact (un-de-cumulated annual cost -> TGT -134%; near-zero
    revenue -> RIVN/LCID +4500%) and is DROPPED (not interpolated). Returns the valid
    margins, or None if too few survive (e.g. pre-revenue companies -> margin N/A)."""
    rd, cd = _rev_dict(facts, cutoff), _cost_dict(facts, cutoff)
    if cd is None:
        return None
    shared = sorted(set(rd) & set(cd))[-(n + 6):]      # extra headroom for drops
    gm = []
    for q in shared:
        r, c = rd[q], cd[q]
        if r and r > 0:
            m = (r - c) / r
            if -0.5 <= m <= 0.95:                       # domain-valid only
                gm.append(m)
    return gm[-n:] if len(gm) >= 8 else None


def growth_cv(rev):
    """mean YoY growth, coefficient of variation."""
    if len(rev) < 8:
        return None, None
    a = np.array(rev, float)
    cv = float(np.std(a) / (abs(np.mean(a)) + 1e-9))
    yoy = [(a[i] - a[i - 4]) / abs(a[i - 4]) for i in range(4, len(a)) if abs(a[i - 4]) > 1e6]
    return (float(np.mean(yoy)) if yoy else 0.0), cv


def rhythm(rev):
    """Temporal dyad: detrend growth (log-linear), lag-4 autocorrelation (annual
    phase-lock) + seasonal amplitude. Returns (coherence, amplitude).
    P0 = no rhythm (low coherence / amplitude); P2 = stable rhythm."""
    if len(rev) < 12 or any(v <= 0 for v in rev):
        return None, None
    lx = np.log(np.array(rev, float))
    t = np.arange(len(lx))
    resid = lx - np.polyval(np.polyfit(t, lx, 1), t)
    amp = float(np.std(resid))
    a, b = resid[:-4], resid[4:]
    if np.std(a) < 1e-9 or np.std(b) < 1e-9:
        return 0.0, amp
    return float(np.corrcoef(a, b)[0, 1]), amp


def relational_lock(rev, cost):
    """Relational dyad: stability of the revenue<->cost coupling (stable ratio =
    phase-locked). Returns 1 (locked) .. 0 (decoupled), or None if no cost data."""
    if cost is None or len(cost) < 8:
        return None
    n = min(len(rev), len(cost))
    ratio = np.array(cost[-n:], float) / (np.array(rev[-n:], float) + 1e-9)
    cv = float(np.std(ratio) / (abs(np.mean(ratio)) + 1e-9))
    return 1 - min(cv / 0.15, 1)


def turbulence(rev):
    """Amplitude of the irregular (detrended) component. P0 = low (still); P2 & P3
    both elevated — but P2's is COHERENT (rhythmic), P3's is INCOHERENT (broken)."""
    if len(rev) < 8 or any(v <= 0 for v in rev):
        return None
    lx = np.log(np.array(rev, float))
    t = np.arange(len(lx))
    return float(np.std(lx - np.polyval(np.polyfit(t, lx, 1), t)))


def coherence_decline(rev, cost):
    """Fracture (P3) = LOSS of a prior loop, not mere noise. Compare coupling
    coherence in the early half vs the late half. P3 = had coherence, losing it.
    Returns (early, late) relational locks, or None if no cost data.
    (KMI/WMB never-coherent -> early~late~low -> NOT decohering -> not P3.
     BBBY/JCP were-coherent -> early high, late collapsed -> decohering -> P3.)"""
    if cost is None or len(rev) < 16 or len(cost) < 16:
        return None
    n = min(len(rev), len(cost))
    r, c = rev[-n:], cost[-n:]
    h = n // 2
    early = relational_lock(r[:h], c[:h])
    late = relational_lock(r[h:], c[h:])
    if early is None or late is None:
        return None
    return early, late


def critical_slowing(rev):
    """Scheffer early-warning: rising variance + lag-1 autocorrelation (resilience
    loss approaching a tipping point). Returns (variance_rising, ar1)."""
    if len(rev) < 12 or any(v <= 0 for v in rev):
        return None, None
    lx = np.log(np.array(rev, float))
    t = np.arange(len(lx))
    resid = lx - np.polyval(np.polyfit(t, lx, 1), t)
    h = len(resid) // 2
    ve, vl = np.var(resid[:h]), np.var(resid[h:])
    var_rising = float((vl - ve) / (ve + 1e-9))
    r = resid[h:]
    ar1 = float(np.corrcoef(r[:-1], r[1:])[0, 1]) if len(r) > 2 and np.std(r) > 1e-9 else 0.0
    return var_rising, ar1


# thresholds (hand-set on small panels; revisit on cohort expansion)
RHYTHM_COH, RHYTHM_AMP = 0.5, 0.03      # a STABLE rhythm exists (P2 temporal dyad)
RELATIONAL_LOCK = 0.6                     # streams are phase-locked (P2 relational dyad)


def has_rhythm(rev, cost=None):
    """True if EITHER dyad form is present (used to exclude P0)."""
    coh, amp = rhythm(rev)
    temporal = (coh is not None and coh > RHYTHM_COH and amp > RHYTHM_AMP)
    rlock = relational_lock(rev, cost) if cost is not None else None
    relational = (rlock is not None and rlock > RELATIONAL_LOCK)
    return temporal or relational, temporal, relational
