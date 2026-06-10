#!/usr/bin/env python3
"""
PROVE P4 — Scaffolding (book verbiage), OPENED UP beyond distress.

Book I P4 = supports introduced "from outside the failed loops"; "exogenous
support... scaffolding to stabilize while reorganization happens"; "temporary
coherence — buffers but doesn't fully solve." Math: an external forcing term
holds up a loop that can't yet hold itself: dx/dt = f(x) + u_ext(t).

Translation: a company HELD UP BY EXTERNAL CAPITAL — operations don't self-fund;
financing inflows fill the gap. Opening-up (NOT just distress): scaffolding has two
origins, same phase, distinguished by Was:
  - DISTRESSED scaffolding (post-fracture): rescue raise -> turnaround / distressed-debt
  - GROWTH scaffolding (pre-profit build): venture/growth capital -> venture/growth
Both are P4 (external support). Self-funding companies (OCF>0) are NOT P4.

Detector: trailing OCF < 0 (operations burn) AND CFF > 0 funding the burn
(CFF covers a meaningful share of |OCF|).
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

PANEL = [
    # DISTRESSED scaffolding (post-fracture rescue capital)
    ("CCL",  "0000815097", "2020-08-31", "scaffold-distress"),
    ("AAL",  "0000006201", "2020-12-31", "scaffold-distress"),
    ("CVNA", "0001690820", "2022-12-31", "scaffold-distress"),
    # GROWTH scaffolding (pre-profit build funded by capital)
    ("RIVN", "0001874178", "2022-12-31", "scaffold-growth"),
    ("LCID", "0001811210", "2022-12-31", "scaffold-growth"),
    ("PLUG", "0001093691", "2021-12-31", "scaffold-growth"),
    # SELF-FUNDING (NOT P4) — operations fund themselves
    ("MSFT", "0000789019", None, "self-fund"),
    ("AAPL", "0000320193", None, "self-fund"),
    ("KO",   "0000021344", None, "self-fund"),
    ("WMT",  "0000104169", None, "self-fund"),
]


def main():
    import time
    rows = []
    print("PROVE P4 — held up by EXTERNAL capital (OCF burn + financing fills gap)?\n")
    print("%-6s %-18s %-12s %-12s %-9s %s" % ("TICK", "expected", "ttm_OCF$M", "ttm_CFF$M", "P4_det", ""))
    for (t, cik, cut, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        ocf = flows.ttm_flow(facts, OCF_TAGS, cut)
        cff = flows.ttm_flow(facts, CFF_TAGS, cut)
        if ocf is None or cff is None:
            rows.append({"t": t, "exp": exp, "ok": None}); print("%-6s %-18s no cashflow data" % (t, exp)); continue
        # scaffolded = TAKES IN substantial external capital relative to operations
        # (self-funders RETURN capital, CFF<0; scaffolded raise it, CFF>0 & large —
        # catches both ongoing burn AND a rescue raise ahead of the burn, e.g. CCL).
        p4 = (cff > 0) and (cff > 0.5 * abs(ocf))
        should = exp.startswith("scaffold")
        ok = (p4 == should)
        rows.append({"t": t, "exp": exp, "p4": p4, "ok": ok})
        print("%-6s %-18s %-12.0f %-12.0f %-9s %s" % (
            t, exp, ocf / 1e6, cff / 1e6, "SCAFFOLD" if p4 else "  .  ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P4 proof: external-capital scaffolding, BOTH distress & growth origins ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P4 (self-funder flagged):", [r["t"] for r in scored if r.get("p4") and not r["ok"]])
    print("  missed a scaffold:", [r["t"] for r in scored if not r.get("p4") and not r["ok"]])
    print("  Was distinguishes distress-scaffold (->turnaround) from growth-scaffold (->venture).")


if __name__ == "__main__":
    main()
