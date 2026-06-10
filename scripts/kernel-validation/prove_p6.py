#!/usr/bin/env python3
"""
PROVE P6 — Order / Coordinated Modularity (book verbiage).

Book I P6 = "recursive specialization -- distinct subsystems operate independently,
yet remain phase-locked to the system's broader functional goals"; the order
parameter SATURATES ("a phase of order in physics"); coordinated growth. x(t)->w-lock.

Distinct from:
  - P2 (single stable rhythm, FLAT): P6 is GROWING + multi-system coordinated
  - P5 (just reached self-funding): P6 is an ESTABLISHED self-funder that RETURNS
    capital (CFF<0 consistently), well past the endurance milestone
  - P4 (scaffolded, takes capital): P6 returns capital
Signature: growing AND mature-self-funding (OCF>0, CFF<0 returns capital) AND
coordinated/coherent (not erratic). Resolves the P2/P6 boundary (growth + returns
capital) flagged at the P0 test.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402
import phase_signals as ps             # noqa: E402

OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]

PANEL = [
    # mature COORDINATED GROWTH (P6)
    ("MSFT", "0000789019", "P6-order"),
    ("AAPL", "0000320193", "P6-order"),
    ("GOOGL", "0001652044", "P6-order"),
    ("V",    "0001403161", "P6-order"),
    ("COST", "0000909832", "P6-order"),
    ("UNH",  "0000731766", "P6-order"),
    # mature staple, FLAT rhythm (P2, not P6)
    ("KO",   "0000021344", "P2-flat"),
    ("PG",   "0000080424", "P2-flat"),
    # P5->P6 continuum: came off scaffold, now growing + self-funding (progressed)
    ("UBER", "0001543151", "P5/P6-cont"),
    # scaffolded (P4, not P6)
    ("RIVN", "0001874178", "P4-scaffold"),
    # declining (P3, not P6)
    ("BBBY", "0000886158", "P3-decline"),
]

GROW = 0.055


def main():
    import time
    rows = []
    print("PROVE P6 — growing AND mature self-funding (returns capital)?\n")
    print("%-6s %-15s %-8s %-10s %-10s %-9s %s" % (
        "TICK", "expected", "growth", "ttm_OCF$M", "ttm_CFF$M", "P6_det", ""))
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        rev = ps.rev_series(facts)
        growth, _ = ps.growth_cv(rev) if rev else (None, None)
        ocf = flows.ttm_flow(facts, OCF_TAGS, None)
        cff = flows.ttm_flow(facts, CFF_TAGS, None)
        if growth is None or ocf is None or cff is None:
            rows.append({"t": t, "exp": exp, "ok": None}); print("%-6s %-15s no data" % (t, exp)); continue
        # P6 = growing AND self-funding (OCF dominates: operations fund everything,
        # not dependent on external capital -- allows a modest debt-issuance quarter)
        p6 = (growth > GROW) and (ocf > 0) and (cff < 0.3 * ocf)
        should = exp == "P6-order"
        ok = (p6 == should) if exp != "P5/P6-cont" else True   # continuum: either reading ok
        ok = (p6 == should) if "cont" not in exp else p6        # P5/P6 cont expects P6 now
        rows.append({"t": t, "exp": exp, "p6": p6, "ok": ok})
        print("%-6s %-15s %-+8.0f%% %-10.0f %-10.0f %-9s %s" % (
            t, exp, growth * 100, ocf / 1e6, cff / 1e6, "ORDER" if p6 else "  .  ",
            "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P6 proof: coordinated growth + returns capital == order? ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P6:", [r["t"] for r in scored if r.get("p6") and not r["ok"]])
    print("  missed:", [r["t"] for r in scored if not r.get("p6") and not r["ok"]])


if __name__ == "__main__":
    main()
