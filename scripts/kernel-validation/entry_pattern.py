#!/usr/bin/env python3
"""
entry_pattern.py — test the trauma-neuroscience claim (Kozlowska 2015 defense
cascade; Corrigan 2010 window of tolerance) in the FINANCIAL substrate:

  Do systems enter distress SEQUENTIALLY (health -> P1 collapse -> P2 -> P3) or
  do they JUMP directly from apparent health to P3/P7 (non-sequential entry)?

The literature says dysregulated systems JUMP — they re-enter at the locked-in
state, skipping intermediate phases. If financial systems do the same, the
transition operator cannot be sequential and "masking" = apparent-health with a
primed distress attractor.

Method: replay the Is-posterior (dominant phase) over each company's history;
find the first DISTRESS-dominant quarter; classify the 1-2 quarters BEFORE it:
  JUMP        : prior phase was HEALTH (P0/P2/P5/P6/P10)
  SEQUENTIAL  : prior phase was P1 collapse (traversed the cascade)
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import arbitration                    # noqa: E402
import snr_envelope                   # noqa: E402

HEALTH = {"P0_source", "P2_rhythm", "P5_endurance", "P6_order", "P10_return"}
DISTRESS = {"P3_fracture", "P7_fork", "P9_threshold"}   # the dysregulated states
CASCADE = {"P1_collapse", "P4_scaffold"}                # intermediate cascade markers

COHORT = [
    ("BBBY", "0000886158", "2023-03-31"),
    ("JCP",  "0001166126", "2020-03-31"),
    ("CHK",  "0000895126", "2020-06-28"),
    ("WLL",  "0001255474", "2020-03-31"),
    ("REV",  "0000887921", "2022-06-15"),
    ("YELL", "0000716006", "2023-06-30"),
    ("PIR",  "0000278130", "2020-02-17"),
    ("SHLDQ","0001310067", "2018-10-15"),
]


def main():
    import time
    print("Distress ENTRY pattern — sequential cascade vs non-sequential JUMP\n")
    print("%-6s %-5s %-14s %-11s %s" % ("TICK", "SNR", "walk", "entry", "pre-distress -> first distress"))
    jumps = seqs = 0
    from pit_trajectory import extract_pit
    from datetime import datetime
    for (t, cik, ev) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        snr, _ = snr_envelope.transition_snr(facts, ev)
        if snr is None or snr < snr_envelope.ABSTAIN_SNR:
            print("%-6s %-5s OUT-OF-ENVELOPE (abstain)" % (t, ("%.2f" % snr) if snr else "?")); continue
        revd = extract_pit(facts, lb.TAG_MAP["Revenue"], True, ev)
        qs = sorted(revd.keys())
        ec = datetime.strptime(ev, "%Y-%m-%d")
        qs = [q for q in qs if lb.quarter_to_date(q) <= ec][-20:]   # 5y — catch the pre-distress health period
        walk = []
        for yq in qs:
            cut = lb.quarter_to_date(yq).strftime("%Y-%m-%d")
            walk.append(arbitration.resolve_phase(facts, cut, t)["dominant"])
            time.sleep(0.05)
        di = next((i for i, p in enumerate(walk) if p in DISTRESS), None)
        code = "".join({"P0_source": "0", "P2_rhythm": "2", "P5_endurance": "5",
                        "P6_order": "6", "P10_return": "X", "P1_collapse": "1",
                        "P4_scaffold": "4", "P3_fracture": "3", "P7_fork": "7",
                        "P9_threshold": "9", "P8_reflection": "8"}.get(p, ".") for p in walk)
        if di is None:
            print("%-6s %-5.1f %-14s %-11s no distress in window" % (t, snr, code, "-")); continue
        pre = walk[max(0, di - 3):di]          # up to 3 quarters before first distress
        before = walk[di - 1] if di > 0 else "(start)"
        if di == 0:
            entry = "AT-START"
        elif any(p in CASCADE for p in pre):
            entry = "SEQUENTIAL"; seqs += 1     # traversed P1/P4 cascade first
        else:
            entry = "JUMP"; jumps += 1          # health straight to distress
        print("%-6s %-5.1f %-14s %-11s %s -> %s" % (t, snr, code, entry, before, walk[di]))
        time.sleep(0.1)
    print("\n=== ENTRY PATTERN ===")
    print("  JUMP (non-sequential, health->distress): %d" % jumps)
    print("  SEQUENTIAL (via P1 collapse cascade):     %d" % seqs)
    print("  => if JUMP dominates, financial systems re-enter at the locked-in state")
    print("     (Kozlowska defense cascade) — transition operator must be non-sequential.")


if __name__ == "__main__":
    main()
