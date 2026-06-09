#!/usr/bin/env python3
"""
arbitration.py — the Is-POSTERIOR. Resolves the 11-kernel multi-fire into a
single dominant phase (+ ranked posterior + fork modifier).

Principle: DISTRESS dominates HEALTH (being in distress is the salient,
actionable state), with a salience ordering inside each group. The P7 fork
(7a liquidate / 7b restructure) is reported as a modifier when a distress phase
is dominant. The Was layer then conditions the health side (baseline vs endurance
vs return) using prior-distress history.

Salience (higher = more salient -> dominant):
  P7 fork 10 · P3 fracture 9 · P9 threshold 8 · P1 collapse 7   [distress]
  P4 scaffold 6 · P8 reflection 5                                [transition]
  P6 order 4 · P5 endurance 3 · P10 return 2 · P2 rhythm 1 · P0 0 [health]
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_kernels as pk            # noqa: E402
from pit_trajectory import clean_df   # noqa: E402

SALIENCE = {
    "P7_fork": 10, "P3_fracture": 9, "P9_threshold": 8, "P1_collapse": 7,
    "P4_scaffold": 6, "P8_reflection": 5, "P6_order": 4, "P5_endurance": 3,
    "P10_return": 2, "P2_rhythm": 1, "P0_source": 0,
}
DISTRESS = {"P3_fracture", "P9_threshold", "P1_collapse", "P4_scaffold"}


def resolve_phase(facts, cutoff, ticker=None):
    dfc = clean_df(facts, cutoff)
    fired, fork = [], None
    for name, fn in pk.KERNELS:
        if name == "P7_fork":
            fork = fn(facts, cutoff, dfc)[0]      # 7a_liquidate / 7b_restructure
            continue
        if name == "P3_fracture":
            res = fn(facts, cutoff, dfc, ticker)[0]
        else:
            res = fn(facts, cutoff, dfc)[0]
        if res:
            fired.append(name)
    if not fired:
        return {"dominant": "P0_source", "fork": None, "fired": []}
    ranked = sorted(fired, key=lambda n: -SALIENCE.get(n, 0))
    dominant = ranked[0]
    fork_mod = fork if dominant in DISTRESS else None
    return {"dominant": dominant, "fork": fork_mod, "fired": ranked}


PANEL = [
    ("WMT",  "0000104169", None,         "order/baseline"),
    ("KO",   "0000021344", None,         "order/baseline"),
    ("WE",   "0001813756", "2022-06-30", "scaffold/collapse"),
    ("JCP",  "0001166126", "2019-06-30", "masking (P3)"),
    ("BBBY", "0000886158", "2022-09-30", "masking (P3)"),
    ("CHK",  "0000895126", "2020-06-28", "distress -> 7b restructure"),
    ("SHLDQ","0001310067", "2018-10-15", "scaffold -> 7a liquidate"),
    ("CCL",  "0000815097", "2021-06-30", "scaffolding (COVID)"),
    ("CCL",  "0000815097", None,         "recovered"),
    ("XOM",  "0000034088", None,         "order/endurance"),
]


def main():
    import time
    print("Is-POSTERIOR — multi-fire resolved to one dominant phase (+ fork)\n")
    print("%-6s %-11s %-22s %-14s %s" % ("TICK", "cutoff", "expected", "DOMINANT", "fired (ranked)"))
    for (t, cik, cut, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        r = resolve_phase(facts, cut, t)
        dom = r["dominant"] + (("/" + r["fork"].split("_")[0]) if r["fork"] else "")
        print("%-6s %-11s %-22s %-14s %s" % (
            t, str(cut or "current"), exp, dom, ", ".join(r["fired"])))
        time.sleep(0.2)


if __name__ == "__main__":
    main()
