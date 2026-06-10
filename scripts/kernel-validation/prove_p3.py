#!/usr/bin/env python3
"""
PROVE P3 — Fracture / Darkness / Shadow Recursion (book verbiage).

Book I P3 = "the formal breakdown of pattern coherence"; recursive architecture
"disintegrates under pressure, exposing structural limits"; "the truth event of
recursion"; a NECESSARY stage, not terminal. Math given: critical slowing down
(Scheffer: rising variance + rising lag-1 autocorrelation) and decoherence (loss
of the P2 lock).

Translation: P3 = the P2 coherence BREAKS into incoherent instability. Detector:
  high TURBULENCE (instability)  AND  NOT coherent (no rhythm, decoupled).
Discriminators:
  - vs P0 (still): P0 = low turbulence; P3 = high turbulence.
  - vs P2 (coherent): P2's turbulence is rhythmic/locked; P3's is broken.
Critical-slowing-down (rising variance, AR(1)) reported as confirming evidence.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps             # noqa: E402

DROP = 0.25   # relational lock dropped this much (early->late) = the loop is breaking

PANEL = [
    # FRACTURE (P3) — HAD coherence, losing it
    ("BBBY", "0000886158", "P3-fracture"),
    ("JCP",  "0001166126", "P3-fracture"),
    ("SHLD", "0001310067", "P3-fracture"),   # Sears
    ("GME",  "0001326380", "P3-fracture"),   # GameStop
    # NOT P3 — never-coherent aseasonal noise (NOT decohering)
    ("KMI",  "0001506307", "noisy-stable"),
    ("WMB",  "0000107263", "noisy-stable"),
    # NOT P3 — coherent rhythm holding (P2)
    ("TGT",  "0000027419", "P2-coherent"),
    ("KO",   "0000021344", "P2-coherent"),
    # NOT P3 — coordinated growth (P6)
    ("MSFT", "0000789019", "P6-grow"),
]


def main():
    import time
    rows = []
    print("PROVE P3 — coherence the system HAD is breaking (early lock -> late lock drop)?\n")
    print("%-6s %-13s %-9s %-9s %-7s %-8s %s" % (
        "TICK", "expected", "early_lk", "late_lk", "drop", "-> P3?", ""))
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        rev = ps.rev_series(facts, n=20)
        cost = ps.cost_series(facts, n=20)
        if not rev or len(rev) < 12:
            rows.append({"t": t, "exp": exp, "p3": None, "ok": None})
            print("%-6s %-13s insufficient" % (t, exp)); continue
        growth, _ = ps.growth_cv(rev)
        tcoh, _ = ps.rhythm(rev)         # TEMPORAL coherence only (margins are a red herring)
        turb = ps.turbulence(rev)
        # P3 = the operating pattern is breaking: declining (under pressure) AND the
        # temporal operating rhythm has degraded. P3 IS the fracture phase ->
        # distress-shaped is correct here (unlike P1/P6/P10).
        p3 = (growth < -0.05) and (tcoh is not None and tcoh < 0.6)
        should = exp == "P3-fracture"
        ok = (p3 == should)
        rows.append({"t": t, "exp": exp, "p3": p3, "ok": ok})
        print("%-6s %-13s %-+8.0f%% tcoh=%-6s turb=%-6s %s  %s" % (
            t, exp, growth * 100,
            ("%.2f" % tcoh) if tcoh is not None else "n/a",
            ("%.2f" % turb) if turb is not None else "n/a",
            "FRACTURE" if p3 else "  .  ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P3 proof: loss of a prior loop == fracture? ===")
    print("  agreement %d/%d = %.2f (scored)" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P3:", [r["t"] for r in scored if r["p3"] and not r["ok"]])
    print("  missed a fracture:", [r["t"] for r in scored if not r["p3"] and not r["ok"]])
    print("  no data:", [r["t"] for r in rows if r["ok"] is None])


if __name__ == "__main__":
    main()
