#!/usr/bin/env python3
"""
PROVE P5 — Endurance / Recursive Stability (book verbiage).

Book I P5 = "sustained internal recursion, where the system no longer relies on
external scaffolding but stabilizes via endogenous regulatory rhythms"; it has
INTERNALIZED the P4 supports. Operator algebra: Delta = R_new - R_old (a NEW
self-sustaining regime distinct from the prior scaffolded one).

P5 is Was-dependent: it is the company that CAME OFF THE SCAFFOLD -- WAS externally
funded (P4), NOW self-funds. Distinct from:
  - P4: still scaffolded (taking external capital, OCF burning)
  - P2: never-scaffolded mature self-funder (always returned capital)
  - P6: coordinated growth
Signature = a TRANSITION: early window took in capital (CFF>0) -> late window
self-funds (OCF>0) and no longer depends on external capital (CFF <= operations).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402

OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def early_late(facts, tags, cutoff=None, n=20):
    d = flows.decumulate(facts, tags, cutoff)
    qs = sorted(d)[-n:]
    if len(qs) < 12:
        return None, None
    h = len(qs) // 2
    return sum(d[q] for q in qs[:h]), sum(d[q] for q in qs[h:])


PANEL = [
    # CAME OFF THE SCAFFOLD (P5) — early-scaffolded -> late-self-funding
    ("TSLA", "0001318605", "2022-12-31", "P5-endurance"),
    ("UBER", "0001543151", "2024-12-31", "P5-endurance"),
    ("ABNB", "0001559720", "2024-12-31", "P5-endurance"),
    ("DASH", "0001792789", "2025-03-31", "P5-endurance"),
    # STILL scaffolded (P4, not P5)
    ("RIVN", "0001874178", None, "P4-still-scaffold"),
    ("LCID", "0001811210", None, "P4-still-scaffold"),
    # never scaffolded mature self-funder (P2/P6, not P5)
    ("KO",   "0000021344", None, "never-scaffold"),
    ("MSFT", "0000789019", None, "never-scaffold"),
    # declining (P3, not P5)
    ("BBBY", "0000886158", "2022-12-31", "P3-decline"),
]


def main():
    import time
    rows = []
    print("PROVE P5 — came OFF the scaffold (was funded -> now self-funds)?\n")
    print("%-6s %-18s %-10s %-10s %-10s %-9s %s" % (
        "TICK", "expected", "e_CFF$M", "l_OCF$M", "l_CFF$M", "P5_det", ""))
    for (t, cik, cut, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        e_cff, l_cff = early_late(facts, CFF_TAGS, cut)
        e_ocf, l_ocf = early_late(facts, OCF_TAGS, cut)
        if e_cff is None or l_ocf is None:
            rows.append({"t": t, "exp": exp, "ok": None}); print("%-6s %-18s no data" % (t, exp)); continue
        # P5 = WAS scaffolded (early took capital) AND NOW self-funds (late OCF>0,
        # operations exceed any remaining financing inflow)
        p5 = (e_cff > 0) and (l_ocf > 0) and (l_cff < l_ocf)
        should = exp == "P5-endurance"
        ok = (p5 == should)
        rows.append({"t": t, "exp": exp, "p5": p5, "ok": ok})
        print("%-6s %-18s %-10.0f %-10.0f %-10.0f %-9s %s" % (
            t, exp, e_cff / 1e6, l_ocf / 1e6, l_cff / 1e6,
            "ENDURE" if p5 else "  .  ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P5 proof: came off the scaffold (was-funded -> self-funding) == endurance? ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P5:", [r["t"] for r in scored if r.get("p5") and not r["ok"]])
    print("  missed:", [r["t"] for r in scored if not r.get("p5") and not r["ok"]])


if __name__ == "__main__":
    main()
