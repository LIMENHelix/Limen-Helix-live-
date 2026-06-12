#!/usr/bin/env python3
"""
PROVE P7 — Shear / Separation (book verbiage) + the 7a/7b fork.

Book I P7 = "functional disaggregation... structural individuation through tension";
"components separate cleanly without detachment"; a CONTROLLED reduction in synchrony
(order parameter lowered to r*, 0<r*<1) -- explicitly UNLIKE P3 (driven to 0,
chaotic). 7b = the fork: reintegrate (->P8) vs terminal (7a).

Translation: a DELIBERATE structural SEPARATION -- spinoff / breakup / division into
individuated parts -- while the remaining entity stays viable. Distinct from:
  - P1 (structure COMBINES/branches, assets GROW) : P7 sheds, assets DROP
  - P3 (chaotic fracture, incoherent, OCF burning): P7 is controlled, viable (OCF>0)
  - P6 (growth, assets grow)                       : P7 is a deliberate shed
Signature: a discontinuous DROP in total assets (a division shed) + remaining entity
viable (OCF>0). The 7a/7b fork = viable-core: OCF>0 -> 7b reintegrate; else 7a.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                           # noqa: E402

OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]


def assets_series(facts, cutoff=None):
    node = (facts or {}).get("facts", {}).get("us-gaap", {}).get("Assets")
    if not node:
        return []
    by_end = {}
    for e in node.get("units", {}).get("USD", []):
        end, val, filed = e.get("end"), e.get("val"), e.get("filed")
        if not end or val is None or val <= 0:
            continue
        if cutoff and end > cutoff:
            continue
        if end not in by_end or (filed and filed > by_end[end][0]):
            by_end[end] = (filed, val)
    return sorted((end, v) for end, (f, v) in by_end.items())


def max_shed(facts, cutoff=None, window=16):
    s = assets_series(facts, cutoff)
    if len(s) < 6:
        return None
    vals = [v for _, v in s][-window:]
    drops = [(vals[i] - vals[i - 1]) / vals[i - 1] for i in range(1, len(vals)) if vals[i - 1] > 0]
    return min(drops) if drops else 0.0       # most negative single-step = biggest shed


PANEL = [
    # deliberate SEPARATION (P7) -- spun a division, score after the spin
    ("MMM",  "0000066740", "2024-09-30", "P7-separation"),   # 3M spun Solventum 2024
    ("IBM",  "0000051143", "2022-03-31", "P7-separation"),   # spun Kyndryl Nov 2021
    ("RTX",  "0000101829", "2020-06-30", "P7-separation"),   # UTC spun Carrier+Otis 2020
    ("GE",   "0000040545", "2024-06-30", "P7-separation"),   # spun GE Vernova 2024
    # NOT P7 -- growth (P6, assets grow)
    ("MSFT", "0000789019", None, "P6-grow"),
    ("AAPL", "0000320193", None, "P6-grow"),
    # NOT P7 -- chaotic fracture (P3)
    ("BBBY", "0000886158", "2022-12-31", "P3-fracture"),
]


def main():
    import time
    rows = []
    print("PROVE P7 — deliberate shed of a division (assets step down) + viable?\n")
    print("%-6s %-15s %-12s %-11s %-9s %-7s %s" % (
        "TICK", "expected", "max_shed", "ttm_OCF$M", "P7_det", "fork", ""))
    for (t, cik, cut, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        shed = max_shed(facts, cut)
        ocf = flows.ttm_flow(facts, OCF_TAGS, cut)
        if shed is None or ocf is None:
            rows.append({"t": t, "exp": exp, "ok": None}); print("%-6s %-15s no data" % (t, exp)); continue
        # P7 = a large deliberate shed AND remaining entity viable (controlled, not chaotic)
        p7 = (shed < -0.15) and (ocf > 0)
        fork = ("7b-reintegrate" if ocf > 0 else "7a-terminal") if p7 else "-"
        should = exp == "P7-separation"
        ok = (p7 == should)
        rows.append({"t": t, "exp": exp, "p7": p7, "ok": ok})
        print("%-6s %-15s %-+12.0f%% %-11.0f %-9s %-7s %s" % (
            t, exp, shed * 100, ocf / 1e6, "SHEAR" if p7 else "  .  ", fork,
            "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P7 proof: controlled separation (shed + viable) == shear? ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P7:", [r["t"] for r in scored if r.get("p7") and not r["ok"]])
    print("  missed:", [r["t"] for r in scored if not r.get("p7") and not r["ok"]])


if __name__ == "__main__":
    main()
