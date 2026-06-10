#!/usr/bin/env python3
"""
PHASE TRAJECTORY (operator, 2026-06-10): don't pigeonhole a company into one phase
at a snapshot -- companies ROTATE through phases over TIME (a brief P8, a long P6,
a fracture, a recovery). Map the PATTERN (the walk), not a static label.

This is the WAS layer: roll the per-line detectors POINT-IN-TIME across cutoffs ->
each company's phase trajectory over time. Observation of the walk, NOT forecasting
(Going stays dropped). The value is the pattern; a snapshot is one point on it.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402
import phase_signals as ps             # noqa: E402

OCF = ["NetCashProvidedByUsedInOperatingActivities",
       "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF = ["NetCashProvidedByUsedInFinancingActivities",
       "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def profile_at(facts, cutoff):
    """Per-line phase profile point-in-time at `cutoff`."""
    rev = ps.rev_series(facts, cutoff, n=16)
    if not rev or len(rev) < 12:
        return None
    growth, _ = ps.growth_cv(rev)
    tcoh, _ = ps.rhythm(rev)
    any_r, _, _ = ps.has_rhythm(rev, None)
    ocf = flows.ttm_flow(facts, OCF, cutoff)
    cff = flows.ttm_flow(facts, CFF, cutoff)
    gm = ps.margin_series(facts, cutoff, n=16)

    # revenue line
    if growth < -0.05:
        rl = "fracture" if (tcoh is not None and tcoh < 0.6) else "decline"
    elif growth > 0.055:
        rl = "grow"
    elif any_r:
        rl = "rhythm"
    else:
        rl = "flat"
    # capital line (the P4/P5/P6 story)
    if ocf is not None and cff is not None:
        if ocf < 0 and cff > 0 and cff > 0.5 * abs(ocf):
            cap = "P4-scaffold"
        elif ocf > 0 and cff < -0.0:
            cap = "P6-return"
        elif ocf > 0:
            cap = "P5-selffund"
        else:
            cap = "burn"
    else:
        cap = "?"
    # margin line
    ml = "?"
    if gm and len(gm) >= 12:
        h = len(gm) // 2
        d = float(np.mean(gm[h:]) - np.mean(gm[:h]))
        ml = "compress" if d < -0.03 else ("expand" if d > 0.03 else "stable")
    return {"growth": growth, "rev": rl, "cap": cap, "margin": ml}


def trajectory(facts, years):
    out = []
    for y in years:
        p = profile_at(facts, "%d-12-31" % y)
        out.append((y, p))
    return out


PANEL = [
    ("TSLA", "0001318605", "scaffold->endurance->order arc"),
    ("F",    "0000037996", "mature auto cycling"),
    ("INTC", "0000050863", "order->fracture arc"),
]
YEARS = [2017, 2019, 2021, 2023, 2025]


def main():
    import time
    for (t, cik, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        print("\n%s  (%s)" % (t, note))
        print("  year  rev       margin    capital")
        for (y, p) in trajectory(facts, YEARS):
            if p is None:
                print("  %d   (insufficient history)" % y); continue
            print("  %d   %-9s %-9s %-12s" % (y, p["rev"], p["margin"], p["cap"]))
        time.sleep(0.2)
    print("\n  The WALK is the pattern (a company rotates through phases over time).")
    print("  e.g. TSLA: scaffold (burning+raising) -> selffund (came off scaffold) -> return (order).")


if __name__ == "__main__":
    main()
