#!/usr/bin/env python3
"""
PROVE P2 — Structural Pairing / Rhythm / Bonding (book verbiage).

Book I P2 = "the emergence and stabilization of dyadic structure—the minimal
recursive unit formed through bonding"; "coherence through relational symmetry";
"symmetric recursion: stable back-and-forth between paired nodes"; phase coherence;
the recurrence x_n = f(x_{n-1}, x_{n-2}). The FIRST STABLE recursive loop.

The dyad has two candidate business forms — test EACH (operator: sometimes one,
sometimes the other, sometimes both):
  (a) TEMPORAL dyad: one stream phase-locks to its OWN prior states — a stable,
      coherent rhythm. Measured: second-order (seasonal) coherence of revenue,
      with an amplitude floor so a FLAT P0 line does not trivially pass.
  (b) RELATIONAL dyad: two distinct streams in a stable mutually-defining
      relationship (revenue <-> cost). "Each element defined by the other."
      Measured: stability of the cost/revenue coupling (stable ratio = locked).

Both must stay quiet on P0 (flat, no recursion) and P3 (loop decoheres).
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
        node = (facts or {}).get("facts", {}).get("us-gaap", {}).get(tag)
        if not node:
            continue
        d = decumulate(facts, [tag], cutoff)
        v = [x for _, x in sorted(d.items())][-n:]
        if len(v) >= 8 and all(x > 0 for x in v):
            return v
    return None


def _trailing_mean(x, k=4):
    return np.array([np.mean(x[max(0, i - k + 1):i + 1]) for i in range(len(x))])


def temporal_dyad(rev):
    """Stable self-rhythm = the series phase-locks to its own prior cycle. Detrend
    GROWTH (log-linear), then lag-4 autocorrelation (each quarter locks to the same
    quarter a year prior) + amplitude floor (so a flat P0 line does not pass)."""
    if len(rev) < 12 or any(v <= 0 for v in rev):
        return None, None
    lx = np.log(np.array(rev, float))
    t = np.arange(len(lx))
    resid = lx - np.polyval(np.polyfit(t, lx, 1), t)   # remove growth trend
    amp = float(np.std(resid))                          # seasonal amplitude (0 = flat)
    a, b = resid[:-4], resid[4:]                         # lag-4 = annual phase-lock
    if np.std(a) < 1e-9 or np.std(b) < 1e-9:
        return 0.0, amp
    ac4 = float(np.corrcoef(a, b)[0, 1])
    return ac4, amp


def relational_dyad(rev, cost):
    """Stability of the revenue<->cost coupling (stable ratio = phase-locked)."""
    if cost is None or len(cost) < 8:
        return None
    n = min(len(rev), len(cost))
    r = np.array(rev[-n:], float); c = np.array(cost[-n:], float)
    ratio = c / (r + 1e-9)
    cv = float(np.std(ratio) / (abs(np.mean(ratio)) + 1e-9))
    return 1 - min(cv / 0.15, 1)                  # 1 = perfectly locked, 0 = decoupled


TEMPORAL_COH, TEMPORAL_AMP = 0.5, 0.03
RELATIONAL_LOCK = 0.6

PANEL = [
    # stable SEASONAL rhythm -> temporal dyad expected
    ("TGT",  "0000027419", "seasonal"),
    ("LOW",  "0000060667", "seasonal"),
    ("DPZ",  "0001286681", "seasonal"),
    # stable MARGINS -> relational dyad expected
    ("PG",   "0000080424", "stable-margin"),
    ("KO",   "0000021344", "stable-margin"),
    ("SO",   "0000092122", "stable-margin"),
    # flat P0 (neither strongly)
    ("VZ",   "0000732712", "P0-flat"),
    # decohering P3 (neither)
    ("BBBY", "0000886158", "P3-decohere"),
    ("JCP",  "0001166126", "P3-decohere"),
]


def main():
    import time
    print("PROVE P2 — test BOTH dyad forms; which fires for whom?\n")
    print("%-6s %-13s %-8s %-7s %-9s %-10s %s" % (
        "TICK", "expected", "T_coh", "T_amp", "T_dyad", "R_lock", "R_dyad"))
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        rev = rev_series(facts)
        coh, amp = temporal_dyad(rev) if rev else (None, None)
        rlock = relational_dyad(rev, cost_series(facts)) if rev else None
        tfire = (coh is not None and coh > TEMPORAL_COH and amp > TEMPORAL_AMP)
        rfire = (rlock is not None and rlock > RELATIONAL_LOCK)
        print("%-6s %-13s %-8s %-7s %-9s %-10s %s" % (
            t, exp,
            ("%.2f" % coh) if coh is not None else "n/a",
            ("%.3f" % amp) if amp is not None else "n/a",
            "RHYTHM" if tfire else " . ",
            ("%.2f" % rlock) if rlock is not None else "n/a",
            "LOCKED" if rfire else " . "))
        time.sleep(0.2)
    print("\n  T_dyad = stable temporal rhythm (one stream, x_n=f(x_n-1,x_n-2)+amplitude)")
    print("  R_dyad = stable relational coupling (revenue<->cost locked ratio)")
    print("  Expect: seasonal->RHYTHM, stable-margin->LOCKED, P0-flat & P3-decohere->neither")


if __name__ == "__main__":
    main()
