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


def rev_series(facts, cutoff=None, n=16):
    d = decumulate(facts, lb.TAG_MAP["Revenue"], cutoff)
    return [v for _, v in sorted(d.items())][-n:]


def cost_series(facts, cutoff=None, n=16):
    for tag in COST_TAGS:
        if not (facts or {}).get("facts", {}).get("us-gaap", {}).get(tag):
            continue
        v = [x for _, x in sorted(decumulate(facts, [tag], cutoff).items())][-n:]
        if len(v) >= 8 and all(x > 0 for x in v):
            return v
    return None


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
