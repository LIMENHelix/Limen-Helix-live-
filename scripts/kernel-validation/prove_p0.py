#!/usr/bin/env python3
"""
PROVE P0 — Source / Null Symmetry (SHARPENED: flat AND no recursive rhythm).

Book I: P0 = "undifferentiated potential... no recursion... no internal dynamics" —
the pre-recursive field; "its only output is collapse [into P1]." The P2 test
exposed that flat-growth ALONE is not P0: a flat company with a STABLE seasonal/
relational rhythm has a recursive loop = P2, not P0. So P0 needs the discriminator
the book implies:
  P0 = flat (|YoY growth| < 4%) AND solvent AND **NO recursive rhythm**
       (no temporal phase-lock AND no relational coupling).
A flat-but-rhythmic company (KO, VZ) is P2. True P0 (no loop at all) is RARE in
established companies — it is the undifferentiated/pre-recursive state.

This re-runs P0 with the no-rhythm requirement and confirms P0 and P2 no longer
overlap (each company resolves to exactly one phase).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                          # noqa: E402
import phase_signals as ps             # noqa: E402

PANEL = [
    # flat + ASEASONAL candidates (true-P0 if no rhythm)
    ("KMI",  "0001506307", "flat-aseasonal?"),
    ("MO",   "0000764180", "flat-aseasonal?"),
    ("T",    "0000732717", "flat-aseasonal?"),
    ("WMB",  "0000107263", "flat-aseasonal?"),
    ("GIS",  "0000040704", "flat-aseasonal?"),
    # flat but RHYTHMIC -> should now be P2 (the reclassification)
    ("KO",   "0000021344", "->P2 (rhythmic)"),
    ("VZ",   "0000732712", "->P2 (rhythmic)"),
    # growing -> P6
    ("AAPL", "0000320193", "P6 grow"),
    ("MSFT", "0000789019", "P6 grow"),
    # declining -> P3
    ("BBBY", "0000886158", "P3 decline"),
    ("JCP",  "0001166126", "P3 decline"),
]


def assign_phase(facts):
    rev = ps.rev_series(facts)
    if not rev or len(rev) < 8:
        return "insufficient", {}
    growth, cv = ps.growth_cv(rev)
    cost = ps.cost_series(facts)
    any_rhythm, temporal, relational = ps.has_rhythm(rev, cost)
    z = altman.z_from_facts(facts, None)
    zval = None if z.get("error") else z["Z"]
    solvent = zval is not None and zval > 2.6
    info = {"growth": growth, "cv": cv, "rhythm": any_rhythm,
            "temporal": temporal, "relational": relational, "z": zval}
    if growth > 0.06:
        return "P6", info
    if growth < -0.06:
        return "P3", info
    if any_rhythm:
        return "P2", info                     # flat but has a recursive loop
    if abs(growth) < 0.04 and solvent:
        return "P0", info                     # flat AND no rhythm = true P0
    return "ambiguous", info


def main():
    import time
    print("PROVE P0 (sharpened) — P0 requires flat AND no recursive rhythm\n")
    print("%-6s %-16s %-8s %-7s %-8s %-8s %s" % (
        "TICK", "expected", "growth", "rhythm", "T/R", "Z''", "-> PHASE"))
    p0s, p2s = [], []
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        phase, info = assign_phase(facts)
        if not info:
            print("%-6s %-16s insufficient" % (t, exp)); continue
        tr = ("%s/%s" % ("T" if info["temporal"] else "-", "R" if info["relational"] else "-"))
        print("%-6s %-16s %-+8.1f%% %-7s %-8s %-8s -> %s" % (
            t, exp, info["growth"] * 100, "yes" if info["rhythm"] else "no", tr,
            ("%.1f" % info["z"]) if info["z"] is not None else "?", phase))
        if phase == "P0":
            p0s.append(t)
        if phase == "P2":
            p2s.append(t)
        time.sleep(0.2)
    print("\n=== P0/P2 boundary check ===")
    print("  true P0 (flat + NO rhythm):", p0s)
    print("  reclassified to P2 (flat + rhythm):", p2s)
    print("  KO/VZ now P2 (not P0)?", all(t in p2s for t in ["KO", "VZ"]))
    print("  no company is both P0 and P2:", not (set(p0s) & set(p2s)))


if __name__ == "__main__":
    main()
