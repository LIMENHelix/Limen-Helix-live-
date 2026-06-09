#!/usr/bin/env python3
"""
dyadic.py — implement the OPERATOR-ALGEBRA forms of P2 and P3 directly:
  P2: x_n = f(x_{n-1}, x_{n-2})        (dyadic recurrence  ==  AR(2) model)
  P3: |R| > theta -> decoherence       (recursive-update magnitude exceeds
                                         threshold -> the AR(2) recurrence breaks)

These are DISCRETE recurrences (unlike Kuramoto/CSD continuous dynamics), so they
should transfer to quarterly data. Coherence = how well AR(2) predicts the series
from its own prior two states (R^2). |R| = the recursive-update magnitude = the
AR(2) one-step surprise (residual). P3 decoherence = coherence collapses / |R|
spikes as the company approaches the event.

TEST: does AR(2) coherence stay HIGH for healthy companies and DROP (decohere)
before bankruptcy?
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

SIGNALS = [("Revenue", True), ("OCF", True), ("Cash", False)]


def ar2_fit(x):
    """Fit x_n = a*x_{n-1} + b*x_{n-2} + c. Return (R^2 coherence, residual std)."""
    x = np.asarray(x, float)
    n = len(x)
    if n < 6 or np.std(x) == 0:
        return None
    x = (x - x.mean()) / np.std(x)               # normalize
    X = np.column_stack([x[1:-1], x[:-2], np.ones(n - 2)])
    y = x[2:]
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    pred = X @ coef
    res = y - pred
    ss_res = np.sum(res ** 2)
    ss_tot = np.sum((y - y.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return r2, float(np.std(res))


def coherence(facts, cutoff, window=None):
    """Mean AR(2) coherence across core signals (optionally last `window` q)."""
    out = []
    for key, flow in SIGNALS:
        d = extract_pit(facts, lb.TAG_MAP[key], flow, cutoff)
        if not d:
            continue
        vals = [v for _, v in sorted(d.items())]
        if window:
            vals = vals[-window:]
        r = ar2_fit(vals)
        if r:
            out.append(r[0])
    return float(np.mean(out)) if out else None


PANEL = [
    ("WMT",  "0000104169", None,         0, "healthy mature"),
    ("KO",   "0000021344", None,         0, "healthy mature"),
    ("AAPL", "0000320193", None,         0, "healthy"),
    ("PG",   "0000080424", None,         0, "healthy"),
    ("COST", "0000909832", None,         0, "healthy"),
    ("JCP",  "0001166126", "2020-05-15", 1, "slow decline -> Ch11"),
    ("BBBY", "0000886158", "2023-04-23", 1, "masking -> Ch11"),
    ("CHK",  "0000895126", "2020-06-28", 1, "commodity bankrupt"),
    ("SHLDQ","0001310067", "2018-10-15", 1, "Sears -> liquidation"),
    ("REV",  "0000887921", "2022-06-15", 1, "Revlon -> Ch11"),
    ("PIR",  "0000278130", "2020-02-17", 1, "Pier 1 -> liquidation"),
    ("YELL", "0000716006", "2023-08-06", 1, "Yellow -> liquidation"),
]


def main():
    import time
    print("DYADIC RECURRENCE (P2 = AR(2)) and its DECOHERENCE (P3 = |R|>theta)\n")
    print("  coherence = AR(2) R^2 (how well x_n follows from x_{n-1}, x_{n-2})\n")
    print("%-6s %-22s %-10s %-10s" % ("TICK", "type", "coher_full", "coher_last8"))
    h, d = [], []
    for (t, cik, cut, label, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        cf = coherence(facts, cut)
        cl = coherence(facts, cut, window=8)
        if cf is None:
            print("%-6s %-22s insufficient" % (t, note)); continue
        print("%-6s %-22s %-10.2f %-10s" % (t, note, cf, ("%.2f" % cl) if cl is not None else "-"))
        (d if label else h).append(cf)
        time.sleep(0.2)
    av = lambda x: float(np.mean(x)) if x else 0
    print("\n  mean coherence — healthy %.2f | distress %.2f" % (av(h), av(d)))
    print("  => P2 holds (high coherence) for healthy; P3 decoheres (low) for distress?")


if __name__ == "__main__":
    main()
