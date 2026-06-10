#!/usr/bin/env python3
"""
PROVE P0 — Source / null (steady-state equilibrium).

Book I: P0 = undifferentiated, no recursion, equilibrium. Financial signature =
flat, low-variance, solvent; NOT growing (that's P6 order) and NOT declining
(that's P3). The thing to prove: the P0 detector tags genuinely-flat companies
and SEPARATES them from growers and decliners.

Operational (non-circular) label:
  P0 if   |mean YoY revenue growth| < 4%  (flat)         AND solvent
  P6 if   mean YoY growth > +6%  (growing)
  P3-ish  mean YoY growth < -6%  (declining)
Detector under test (phase_kernels.k_p0_source): revenue CV < 0.08 AND Z'' > 2.6.
Proof = detector fire matches the FLAT label, not the growing/declining ones.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, phase_kernels as pk    # noqa: E402
from flows import decumulate          # noqa: E402

PANEL = [
    # expected FLAT / steady-state (P0)
    ("KO",   "0000021344", "flat-staple"),
    ("GIS",  "0000040704", "flat-staple"),
    ("KMB",  "0000055785", "flat-staple"),
    ("VZ",   "0000732712", "flat-telecom"),
    ("SO",   "0000092122", "flat-utility"),
    # expected GROWING (P6, not P0)
    ("AAPL", "0000320193", "growing"),
    ("MSFT", "0000789019", "growing"),
    ("COST", "0000909832", "growing"),
    ("V",    "0001403161", "growing"),
    # expected DECLINING (P3-ish, not P0)
    ("BBBY", "0000886158", "declining"),
    ("JCP",  "0001166126", "declining"),
    ("PIR",  "0000278130", "declining"),
]


def rev_stats(facts, cutoff=None):
    d = decumulate(facts, lb.TAG_MAP["Revenue"], cutoff)
    vals = [v for _, v in sorted(d.items())][-12:]
    if len(vals) < 8:
        return None
    arr = np.array(vals, float)
    cv = np.std(arr) / (abs(np.mean(arr)) + 1e-9)
    yoy = [(arr[i] - arr[i - 4]) / abs(arr[i - 4]) for i in range(4, len(arr)) if abs(arr[i - 4]) > 1e6]
    growth = float(np.mean(yoy)) if yoy else 0.0
    return cv, growth


def label(growth, zval):
    solvent = zval is not None and zval > 2.6
    if growth > 0.06:
        return "P6_grow"
    if growth < -0.06:
        return "P3_decline"
    if abs(growth) < 0.04 and solvent:
        return "P0_flat"
    return "ambiguous"


def main():
    import time
    rows = []
    print("PROVE P0 — does the detector tag FLAT (P0) and exclude growing/declining?\n")
    print("%-6s %-13s %-7s %-8s %-7s %-11s %-7s %s" % (
        "TICK", "expected", "rev_CV", "growth", "Z''", "true-label", "P0_det", ""))
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        st = rev_stats(facts)
        z = altman.z_from_facts(facts, None)
        zval = None if z.get("error") else z["Z"]
        if st is None:
            print("%-6s %-13s insufficient" % (t, exp)); continue
        cv, growth = st
        true = label(growth, zval)
        p0_fire = pk.k_p0_source(facts, None, None)[0]
        # proof: detector should fire IFF true-label is P0_flat
        ok = (p0_fire == (true == "P0_flat"))
        rows.append({"t": t, "true": true, "p0": p0_fire, "ok": ok})
        print("%-6s %-13s %-7.3f %-+8.1f %-7s %-11s %-7s %s" % (
            t, exp, cv, growth * 100, ("%.1f" % zval) if zval else "?", true,
            "FIRE" if p0_fire else " . ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    ok = sum(1 for r in rows if r["ok"])
    print("\n=== P0 proof: detector fire == flat-label? ===")
    print("  agreement %d/%d = %.2f" % (ok, len(rows), ok / len(rows) if rows else 0))
    fp = [r["t"] for r in rows if r["p0"] and r["true"] != "P0_flat"]
    fn = [r["t"] for r in rows if not r["p0"] and r["true"] == "P0_flat"]
    print("  detector fired on NON-flat (false P0):", fp)
    print("  detector MISSED a flat company:", fn)


if __name__ == "__main__":
    main()
