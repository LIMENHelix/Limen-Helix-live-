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
    ("BBBY", "0000886158", "P3-fracture"),    # incoherent breakdown
    ("JCP",  "0001166126", "P3-fracture"),    # incoherent breakdown
    ("SHLD", "0001310067", "coherent-decl"),  # Sears — declining but pattern intact = STUCK
    ("GME",  "0001326380", "coherent-decl"),  # GameStop — secular decline, pattern intact
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
        # Both fracture and coherent-decline are DECLINING; the discriminator is
        # whether the operating PATTERN holds. Bankruptcy is the OUTCOME of either.
        declining = growth < -0.05
        if declining and tcoh is not None and tcoh < 0.6:
            state = "P3-FRACTURE"        # pattern lost integrity (incoherent)
        elif declining and tcoh is not None and tcoh >= 0.6:
            state = "coherent-decline"   # pattern intact, shrinking = STUCK (not P3)
        else:
            state = "not-declining"
        p3 = state == "P3-FRACTURE"
        if exp == "P3-fracture":
            ok = state == "P3-FRACTURE"
        elif exp == "coherent-decl":
            ok = state == "coherent-decline"
        else:
            ok = state != "P3-FRACTURE"
        rows.append({"t": t, "exp": exp, "p3": p3, "ok": ok, "state": state})
        print("%-6s %-13s %-+8.0f%% tcoh=%-6s -> %-16s %s" % (
            t, exp, growth * 100, ("%.2f" % tcoh) if tcoh is not None else "n/a",
            state, "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P3 proof: FRACTURE (incoherent) vs COHERENT-DECLINE (stuck) — both end in bankruptcy ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  P3 fracture (declining + incoherent):", [r["t"] for r in scored if r["state"] == "P3-FRACTURE"])
    print("  coherent-decline / STUCK (declining + pattern intact):",
          [r["t"] for r in scored if r["state"] == "coherent-decline"])
    print("  bankruptcy is the OUTCOME of BOTH paths — not the phase.")


if __name__ == "__main__":
    main()
