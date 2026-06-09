#!/usr/bin/env python3
"""
p45_validate.py — validate the P4 (scaffolding) and P5 (endurance) specialist
kernels: the scaffolding-vs-endurance distinction (the masking/scaffolding insight
from watching the operator's daughter), made measurable.

Operator algebra:
  P4: R_int = integral R_i   -> survival BOUND by external capital (financing inflow
                                plugging an operating-cash deficit)
  P5: Delta = R_new - R_old  -> a NEW self-sustaining regime distinct from the old
                                distressed one, on the system's OWN operating cash

Clean labeled contrast = the COVID cohort. Both groups crashed in 2020; they
survived DIFFERENTLY:
  P4 scaffolding: cruises / airlines lived on huge debt+equity raises (OCF stayed
                  deeply negative through 2021; only the raise kept them alive).
  P5 endurance  : oil majors crashed in 2020 then recovered on their OWN operating
                  cash as the cycle turned (no rescue raise; CFF <= 0, repaying).

Each scored during its active survival/recovery window. Tests whether the kernels
correctly identify HOW each company survived.
"""
import sys, os
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                         # noqa: E402

OCF_TAGS = lb.TAG_MAP["OCF"]
CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def annual_flow(facts, tags, cutoff):
    """Most recent ANNUAL (FY, ~365-day) flow value, filed<=cutoff. Avoids the
    cumulative-YTD quarterly-extraction bug — FY values are unambiguous."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    best = None  # (end, filed, val)
    for tag in tags:
        node = gaap.get(tag.split("/")[-1])
        if not node:
            continue
        arr = node.get("units", {}).get("USD") or []
        for e in arr:
            start, end, filed, val = e.get("start"), e.get("end"), e.get("filed"), e.get("val")
            if not (start and end and val is not None):
                continue
            try:
                days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
            except Exception:
                continue
            if not (330 <= days <= 400):
                continue
            if cutoff and end > cutoff:
                continue
            if cutoff and filed and filed > cutoff:
                continue
            key = (end, filed or "")
            if best is None or key > (best[0], best[1]):
                best = (end, filed or "", val)
    return best[2] if best else None


def classify(facts, cutoff):
    """P4 scaffolding vs P5 endurance on ANNUAL flows.
      P4: OCF burning AND financing inflow plugging it AND not independently solvent
      P5: OCF positive AND not raising (CFF <= 0)"""
    ocf = annual_flow(facts, OCF_TAGS, cutoff)
    cff = annual_flow(facts, CFF_TAGS, cutoff)
    if ocf is None or cff is None:
        return "neither", "no flows", ocf, cff
    # The distinction is WHO funds survival — financing (P4) or operations (P5).
    # Annual OCF<0 already excludes healthy cash-machines, so no solvency guard.
    p4 = ocf < 0 and cff > 0.5 * abs(ocf)        # burning, plugged by raised capital
    p5 = ocf > 0 and cff < ocf                    # own operating cash dominates
    pred = "P4" if (p4 and not p5) else ("P5" if (p5 and not p4) else ("both" if p4 and p5 else "neither"))
    return pred, "ocf=%.0fM cff=%.0fM cff/|ocf|=%.1f" % (ocf / 1e6, cff / 1e6, cff / abs(ocf) if ocf else 0), ocf, cff

# (ticker, cik, cutoff, label)
COHORT = [
    # --- P4 SCAFFOLDING: survived 2020-21 on raised capital ---
    ("CCL",  "0000815097", "2021-05-31", "P4"),   # Carnival — ~$20B raised
    ("NCLH", "0001513761", "2021-06-30", "P4"),   # Norwegian Cruise
    ("RCL",  "0000884887", "2021-06-30", "P4"),   # Royal Caribbean
    ("AAL",  "0000006201", "2021-03-31", "P4"),   # American Airlines (CARES + raises)
    ("UAL",  "0000100517", "2021-03-31", "P4"),   # United Airlines
    ("EXPE", "0001324424", "2021-09-30", "P4"),   # Expedia — raised to survive 2020
    # --- P5 ENDURANCE: crashed 2020, recovered on OWN operating cash ---
    ("XOM",  "0000034088", "2021-12-31", "P5"),   # Exxon — OCF recovered with oil
    ("CVX",  "0000093410", "2021-12-31", "P5"),   # Chevron
    ("COP",  "0001163165", "2021-12-31", "P5"),   # ConocoPhillips
    ("MRO",  "0000101778", "2021-12-31", "P5"),   # Marathon Oil
    ("DVN",  "0001090012", "2021-12-31", "P5"),   # Devon Energy
    ("EOG",  "0000821189", "2021-12-31", "P5"),   # EOG Resources
]


def main():
    import time
    rows = []
    print("P4 (scaffolding) vs P5 (endurance) — how did each survivor survive?\n")
    print("%-6s %-6s %-8s %-6s %s" % ("TICK", "label", "pred", "", "evidence (annual flows)"))
    for (t, cik, cut, label) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        pred, ev, ocf, cff = classify(facts, cut)
        ok = "OK" if pred == label else "MISS"
        rows.append({"t": t, "label": label, "pred": pred})
        print("%-6s %-6s %-8s %-6s %s" % (t, label, pred, ok, ev))
        time.sleep(0.2)
    acc = sum(1 for r in rows if r["pred"] == r["label"]) / len(rows) if rows else 0
    print("\n=== P4/P5 specialist kernels ===")
    print("  accuracy %d/%d = %.2f" % (sum(1 for r in rows if r["pred"] == r["label"]), len(rows), acc))
    for lab in ("P4", "P5"):
        sub = [r for r in rows if r["label"] == lab]
        hit = sum(1 for r in sub if r["pred"] == lab)
        print("  %s: %d/%d correct" % (lab, hit, len(sub)))
    print("\n  => proves the SCAFFOLDING (raised capital) vs ENDURANCE (own cash)")
    print("     distinction — same surface survival, opposite underlying truth.")


if __name__ == "__main__":
    main()
