#!/usr/bin/env python3
"""
OUT-OF-SAMPLE phase classifier — FROZEN detectors (P0-P7), no per-company tuning.

Addresses retrofitting: the prove_*.py panels were small and tuned-to-pass (near-100%
is a red flag). This runs the BUILT detectors with thresholds FROZEN on a large,
mostly-held-out universe and reports where they land + where they fail. Expect WELL
under 100%; the misses/ambiguities are the real findings.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402
import phase_signals as ps             # noqa: E402
from prove_p1 import branch_signals    # noqa: E402
from prove_p7 import max_shed          # noqa: E402
from prove_p5 import early_late        # noqa: E402

OCF = ["NetCashProvidedByUsedInOperatingActivities",
       "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF = ["NetCashProvidedByUsedInFinancingActivities",
       "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def classify(facts):
    rev = ps.rev_series(facts)
    if not rev or len(rev) < 12:
        return "insufficient", {}
    growth, cv = ps.growth_cv(rev)
    cost = ps.cost_series(facts)
    any_rhythm, temporal, relational = ps.has_rhythm(rev, cost)
    tcoh, _ = ps.rhythm(rev)
    ocf = flows.ttm_flow(facts, OCF) or 0
    cff = flows.ttm_flow(facts, CFF) or 0
    d_share, d_eq = branch_signals(facts)
    shed = max_shed(facts)
    e_cff, l_cff = early_late(facts, CFF)
    e_ocf, l_ocf = early_late(facts, OCF)
    info = {"growth": growth, "ocf": ocf / 1e6, "cff": cff / 1e6, "tcoh": tcoh,
            "rhythm": any_rhythm, "shed": shed}

    # FROZEN priority (event states first, then capital, then trajectory)
    if d_share is not None and d_share > 0.5 and d_eq is not None and d_eq > 0.5:
        return "P1-branch", info
    if shed is not None and shed < -0.15 and ocf > 0:
        return "P7-shear", info
    if cff > 0 and cff > 0.5 * abs(ocf):
        return "P4-scaffold", info
    if growth < -0.05:
        return ("P3-fracture" if (tcoh is not None and tcoh < 0.6) else "coherent-decline"), info
    if growth > 0.055 and ocf > 0 and cff < 0.3 * ocf:
        if e_cff is not None and e_cff > 0 and l_ocf is not None and l_ocf > 0:
            return "P5/P6 (came-off-scaffold)", info
        return "P6-order", info
    if any_rhythm:
        return "P2-rhythm", info
    if abs(growth) < 0.04:
        return "P0-null", info
    return "ambiguous", info


# large, mostly-HELD-OUT universe (most NOT in any prove_*.py tuning panel)
UNIVERSE = [
    ("NVDA", "0001045810"), ("META", "0001326801"), ("AMZN", "0001018724"),
    ("JPM", "0000019617"), ("JNJ", "0000200406"), ("HD", "0000354950"),
    ("MCD", "0000063908"), ("NKE", "0000320187"), ("PEP", "0000077476"),
    ("CL", "0000021665"), ("MO", "0000764180"), ("T", "0000732717"),
    ("DUK", "0001326160"), ("KMI", "0001506307"), ("SNOW", "0001640147"),
    ("PLTR", "0001321655"), ("RIVN", "0001874178"), ("NIO", "0001736541"),
    ("UBER", "0001543151"), ("ABNB", "0001559720"), ("F", "0000037996"),
    ("WBA", "0001618921"), ("PARA", "0000813828"), ("GE", "0000040545"),
    ("MMM", "0000066740"), ("IBM", "0000051143"), ("KVUE", "0001944048"),
    ("CAT", "0000018230"), ("X", "0001163302"), ("INTC", "0000050863"),
]


def main():
    import time
    from collections import Counter
    dist = Counter()
    print("OUT-OF-SAMPLE phase classification (frozen detectors)\n")
    print("%-6s %-26s %-8s %-9s %-9s %s" % ("TICK", "-> PHASE", "growth", "OCF$M", "CFF$M", "tcoh"))
    for (t, cik) in UNIVERSE:
        try:
            facts = lb.fetch_sec_facts(cik)
            phase, info = classify(facts)
        except Exception as e:
            phase, info = "error:%s" % str(e)[:20], {}
        dist[phase.split()[0]] += 1
        if info:
            print("%-6s %-26s %-+8.0f%% %-9.0f %-9.0f %s" % (
                t, phase, info["growth"] * 100, info["ocf"], info["cff"],
                ("%.2f" % info["tcoh"]) if info["tcoh"] is not None else "n/a"))
        else:
            print("%-6s %-26s" % (t, phase))
        time.sleep(0.15)
    print("\n=== phase distribution across %d companies ===" % len(UNIVERSE))
    for p, n in dist.most_common():
        print("  %-26s %d" % (p, n))


if __name__ == "__main__":
    main()
