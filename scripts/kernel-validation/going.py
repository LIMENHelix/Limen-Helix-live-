#!/usr/bin/env python3
"""
going.py — the GOING layer (where it's heading). The first step from detection to
regulation: given a system in distress NOW, project the fork it's moving toward.

Grounding: the P7 fork (validated) is decided by the VIABLE CORE = operating cash.
The Going layer is its TIME DERIVATIVE — is the core strengthening (heading to
ENDURANCE/recovery) or weakening (heading to P7/collapse)? Per the operator's
architecture, projection is conditioned on the PATH (Was), not just the present.

Predictor: the trend of TTM operating cash over the recent window (de-cumulated,
point-in-time) + its current level.
  RECOVERING : TTM-OCF trend rising (core strengthening)
  COLLAPSING : TTM-OCF deteriorating AND still negative (core failing)
  AT-RISK    : negative but flat
  STABLE     : positive, not deteriorating

TEST: at a distress point BEFORE the outcome, does Going predict the actual
outcome (recovered vs bankrupt)?
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                          # noqa: E402


def kendall_tau(y):
    y = np.asarray(y, float)
    n = len(y)
    if n < 3:
        return 0.0
    s = sum(np.sign(y[j] - y[i]) for i in range(n) for j in range(i + 1, n))
    return s / (0.5 * n * (n - 1))


def going(facts, cutoff):
    ocf_q = flows.decumulate(facts, lb.TAG_MAP["OCF"], cutoff)
    qs = sorted(ocf_q.keys())
    if len(qs) < 8:
        return None
    ttm = [sum(ocf_q[q] for q in qs[i - 4:i]) for i in range(4, len(qs) + 1)]
    recent = ttm[-6:]
    trend = kendall_tau(recent)         # +1 improving .. -1 deteriorating
    level = recent[-1]
    if trend > 0.2:
        pred = "RECOVERING"
    elif level < 0 and trend < -0.2:
        pred = "COLLAPSING"
    elif level < 0:
        pred = "AT-RISK"
    else:
        pred = "STABLE"
    return {"pred": pred, "trend": round(trend, 2), "ttm_ocf": level}


# (ticker, cik, cutoff-at-distress, actual outcome)
COHORT = [
    # RECOVERED — in COVID distress, scored at the trough, recovered
    ("CCL",  "0000815097", "2021-06-30", "RECOVER"),
    ("AAL",  "0000006201", "2021-03-31", "RECOVER"),
    ("NCLH", "0001513761", "2021-06-30", "RECOVER"),
    ("RCL",  "0000884887", "2021-06-30", "RECOVER"),
    ("UAL",  "0000100517", "2021-03-31", "RECOVER"),
    ("XOM",  "0000034088", "2020-12-31", "RECOVER"),   # oil crash 2020 -> recovered
    ("MGM",  "0000789570", "2021-03-31", "RECOVER"),   # casinos COVID -> recovered
    # COLLAPSED — in distress, scored ~6-12mo before Ch11, went bankrupt
    ("BBBY", "0000886158", "2022-09-30", "COLLAPSE"),
    ("JCP",  "0001166126", "2019-09-30", "COLLAPSE"),
    ("PIR",  "0000278130", "2019-06-30", "COLLAPSE"),
    ("REV",  "0000887921", "2021-12-31", "COLLAPSE"),
    ("YELL", "0000716006", "2022-12-31", "COLLAPSE"),
    ("SHLDQ","0001310067", "2017-10-31", "COLLAPSE"),
    ("WLL",  "0001255474", "2019-09-30", "COLLAPSE"),
]


def main():
    import time
    rows = []
    print("GOING layer — at a distress point, where is it heading?\n")
    print("%-6s %-11s %-9s %-12s %-9s %s" % ("TICK", "cutoff", "outcome", "pred", "trend", "ttm_ocf$M"))
    for (t, cik, cut, outcome) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        g = going(facts, cut)
        if g is None:
            print("%-6s insufficient" % t); continue
        # map prediction -> recover/collapse for scoring
        pred_class = "RECOVER" if g["pred"] in ("RECOVERING", "STABLE") else "COLLAPSE"
        ok = pred_class == outcome
        rows.append({"t": t, "outcome": outcome, "pred_class": pred_class, "ok": ok})
        print("%-6s %-11s %-9s %-12s %-9s %-10.0f %s" % (
            t, cut, outcome, g["pred"], g["trend"], g["ttm_ocf"] / 1e6, "OK" if ok else "MISS"))
        time.sleep(0.2)
    acc = sum(1 for r in rows if r["ok"]) / len(rows) if rows else 0
    print("\n=== GOING layer (recover vs collapse from the viable-core derivative) ===")
    print("  accuracy %d/%d = %.2f" % (sum(1 for r in rows if r["ok"]), len(rows), acc))
    for o in ("RECOVER", "COLLAPSE"):
        sub = [r for r in rows if r["outcome"] == o]
        print("  %-9s %d/%d" % (o, sum(1 for r in sub if r["ok"]), len(sub)))


if __name__ == "__main__":
    main()
