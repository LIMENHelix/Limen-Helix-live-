#!/usr/bin/env python3
"""
was.py — the WAS layer (path history). P5 proved this is necessary: phases like
endurance/masking/scaffolding are undefinable from the present alone — they need
to know where the system has BEEN.

Replays the Is-kernels point-in-time at each historical quarter to build H(t) =
the phase walk, extracts path features (ever-distressed? prior P3 dwell? was it
scaffolded?), and resolves the regulation MODE as a system output:

  GENUINE-BASELINE : never hit P3                      (healthy, not "enduring")
  MASKING          : P3 firing now WHILE presenting solvent on surface ratios
  OVERT-DISTRESS   : P3 firing now AND insolvent on surface
  SCAFFOLDING      : prior P3, currently held by RAISED capital (P4)
  ENDURANCE        : prior P3, recovered on its OWN operating cash (P5)

The triad (masking / scaffolding / endurance) = Was (prior P3) x Is (current
kernel). The same surface state resolves to different modes given different
histories — the operator's founding insight, made computable.
"""
import sys, os
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, phase_kernels as pk    # noqa: E402
from pit_trajectory import clean_df, extract_pit  # noqa: E402

# NOTE: the Was regulation-MODE uses SPECIFIC kernel combinations (is it scaffolded?
# recovered?), NOT the single arbitration-dominant phase. Wiring the arbitration
# dominant in here regressed 0.90 -> 0.40 (distress-dominance hides the scaffolding
# signal at the trough). arbitration.py stays as the standalone Is-posterior.


def phase_history(facts, ticker=None, end_cutoff=None, lookback=16):
    """Run the mode-relevant Is-kernels point-in-time at each quarter."""
    rev = extract_pit(facts, lb.TAG_MAP["Revenue"], True, end_cutoff)
    quarters = sorted(rev.keys())
    if end_cutoff:
        ec = datetime.strptime(end_cutoff, "%Y-%m-%d")
        quarters = [q for q in quarters if lb.quarter_to_date(q) <= ec]
    quarters = quarters[-lookback:]
    H = []
    for yq in quarters:
        cutoff = lb.quarter_to_date(yq).strftime("%Y-%m-%d")
        dfc = clean_df(facts, cutoff)
        H.append({"q": yq,
                  "P3": pk.k_p3_fracture(facts, cutoff, dfc, ticker)[0],
                  "P4": pk.k_p4_scaffold(facts, cutoff, dfc)[0],
                  "P5": pk.k_p5_endurance(facts, cutoff, dfc)[0],
                  "solvent": (lambda z: z.get("error") or z["Z"] > 1.1)(altman.z_from_facts(facts, cutoff))})
    return H


def was_features(H):
    return {"ever_p3": any(h["P3"] for h in H), "p3_count": sum(h["P3"] for h in H),
            "ever_p4": any(h["P4"] for h in H), "n": len(H)}


def regulation_mode(facts, ticker=None, end_cutoff=None):
    H = phase_history(facts, ticker, end_cutoff)
    if not H:
        return "unknown", "", {}
    f = was_features(H)
    cur = H[-1]
    walk = "".join("3" if h["P3"] else ("4" if h["P4"] else ("5" if h["P5"] else ".")) for h in H)
    prior_distress = f["ever_p3"] or f["ever_p4"]
    if not prior_distress:
        mode = "GENUINE-BASELINE"
    elif cur["P3"] and cur["solvent"]:
        mode = "MASKING"
    elif cur["P3"]:
        mode = "OVERT-DISTRESS"
    elif cur["P4"]:
        mode = "SCAFFOLDING"
    elif cur["P5"]:
        mode = "ENDURANCE"
    else:
        mode = "POST-DISTRESS-STABLE"
    return mode, walk, f


PANEL = [
    ("WMT",  "0000104169", None,         "healthy, never distressed -> BASELINE"),
    ("CCL",  "0000815097", "2021-06-30", "scored DURING COVID -> SCAFFOLDING (on raised capital now)"),
    ("AAL",  "0000006201", None,         "scaffolded then recovered -> ENDURANCE"),
    ("CCL",  "0000815097", None,         "scaffolded then recovered (current) -> ENDURANCE"),
    ("BBBY", "0000886158", "2022-09-30", "eroding while presenting solvent -> MASKING"),
]


def main():
    import time
    print("WAS layer — same surface, different mode given different history\n")
    print("  walk: 3=P3  4=P4-scaffold  5=P5-endurance  .=other  (oldest->newest)\n")
    for (t, cik, cut, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        mode, walk, f = regulation_mode(facts, t, cut)
        print("%-6s %-44s" % (t, note))
        print("       walk: %s" % walk)
        print("       ever_P3=%s  P3_dwell=%d  ever_P4=%s  =>  MODE: %s\n" % (
            f.get("ever_p3"), f.get("p3_count", 0), f.get("ever_p4"), mode))
        time.sleep(0.2)


if __name__ == "__main__":
    main()
