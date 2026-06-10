#!/usr/bin/env python3
"""
PER-LINE phase profile (operator, 2026-06-10): a company is NOT in one phase.
It has multiple LINES, each in its own phase. Run one pass PER LINE -> a profile,
not a scalar. Explains the single-pass failures (WBA: revenue stable but margin
fracturing; AMZN: multi-segment).

Lines (financial dimensions available today; business segments are the deeper
version, needs segment data):
  revenue   : demand/top-line          -> grow / rhythm / flat / decline
  margin    : profitability trajectory -> expand / stable / COMPRESS(fracture)
  cash      : OCF self-fund vs burn     -> generate / burn
  capital   : financing direction       -> return(mature) / scaffold(take-in)
  structure : ownership/assets          -> branch(P1) / shed(P7) / stable
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402
import phase_signals as ps             # noqa: E402
from prove_p1 import branch_signals    # noqa: E402
from prove_p7 import max_shed          # noqa: E402

OCF = ["NetCashProvidedByUsedInOperatingActivities",
       "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF = ["NetCashProvidedByUsedInFinancingActivities",
       "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def revenue_line(rev):
    growth, _ = ps.growth_cv(rev)
    tcoh, _ = ps.rhythm(rev)
    any_r, _, _ = ps.has_rhythm(rev, None)
    if growth is None:
        return "?"
    if growth < -0.05:
        return "P3-fracture" if (tcoh is not None and tcoh < 0.6) else "decline-coherent"
    if growth > 0.055:
        return "P6-grow"
    if any_r:
        return "P2-rhythm"
    return "P0-flat"


def margin_line(facts):
    """gross margin trajectory: expanding / stable / COMPRESSING (fracture).
    Uses aligned-by-quarter, artifact-cleaned margin_series."""
    gm = ps.margin_series(facts)
    if gm is None or len(gm) < 12:
        return "?"
    h = len(gm) // 2
    d = float(np.mean(gm[h:]) - np.mean(gm[:h]))
    if d < -0.03:
        return "COMPRESS"      # margins fracturing (P3-on-margin)
    if d > 0.03:
        return "expand"
    return "stable"


def cash_line(facts):
    ocf = flows.ttm_flow(facts, OCF)
    if ocf is None:
        return "?"
    return "generate" if ocf > 0 else "burn"


def capital_line(facts):
    cff = flows.ttm_flow(facts, CFF)
    ocf = flows.ttm_flow(facts, OCF) or 0
    if cff is None:
        return "?"
    if cff > 0 and cff > 0.5 * abs(ocf):
        return "scaffold(take-in)"
    if cff < 0:
        return "return(mature)"
    return "neutral"


def structure_line(facts):
    d_share, d_eq = branch_signals(facts)
    shed = max_shed(facts)
    if d_share is not None and d_share > 0.5 and d_eq is not None and d_eq > 0.5:
        return "P1-branch"
    if shed is not None and shed < -0.15:
        return "P7-shed"
    return "stable"


PANEL = ["WBA", "PARA", "AMZN", "NVDA", "JNJ", "BBBY", "INTC", "KMI"]
CIK = {"WBA": "0001618921", "PARA": "0000813828", "AMZN": "0001018724",
       "NVDA": "0001045810", "JNJ": "0000200406", "BBBY": "0000886158",
       "INTC": "0000050863", "KMI": "0001506307"}


def main():
    import time
    print("PER-LINE phase profile (one pass per line, not one label per company)\n")
    print("%-6s %-16s %-10s %-9s %-18s %s" % (
        "TICK", "revenue", "margin", "cash", "capital", "structure"))
    for t in PANEL:
        facts = lb.fetch_sec_facts(CIK[t])
        rev = ps.rev_series(facts)
        cost = ps.cost_series(facts)
        if not rev:
            print("%-6s insufficient" % t); continue
        print("%-6s %-16s %-10s %-9s %-18s %s" % (
            t, revenue_line(rev), margin_line(facts), cash_line(facts),
            capital_line(facts), structure_line(facts)))
        time.sleep(0.15)
    print("\n  A company = a PROFILE across lines, not one phase.")
    print("  e.g. WBA: revenue stable but margin COMPRESS -> the fracture one label hid.")


if __name__ == "__main__":
    main()
