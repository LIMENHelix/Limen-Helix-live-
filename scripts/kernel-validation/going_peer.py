#!/usr/bin/env python3
"""
going_peer.py — the GOING layer, PEER-RELATIVE. The naive viable-core derivative
failed (0.21) because the momentary trend is fooled by turning points. The
diagnosis: the real discriminator is whether distress is SHARED by the sector
(exogenous shock → reversible → recover) or IDIOSYNCRATIC (peers healthy → secular
decline → terminal). This is "Amazon ≠ Burger King" for projection.

At the distress point, compare the target's viable core (TTM-OCF/assets) to its
SECTOR PEERS:
  SHARED      : peers also distressed (sector-wide shock) -> predict RECOVER
  IDIOSYNCRATIC: peers healthy, target distressed (alone) -> predict COLLAPSE
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, flows                  # noqa: E402
from validate_kernel import resolve_ciks  # noqa: E402

PEERS = {
    "CCL": ["NCLH", "RCL"], "NCLH": ["CCL", "RCL"], "RCL": ["CCL", "NCLH"],
    "AAL": ["UAL", "DAL", "LUV"], "UAL": ["AAL", "DAL", "LUV"],
    "MGM": ["LVS", "WYNN", "CZR"], "XOM": ["CVX", "COP"],
    "BBBY": ["WSM", "TGT", "WMT"], "JCP": ["M", "KSS", "DDS"],
    "PIR": ["WSM", "RH", "WMT"], "REV": ["EL", "ULTA"],
    "YELL": ["ODFL", "JBHT", "KNX"], "SHLDQ": ["TGT", "WMT", "M"],
    "WLL": ["DVN", "MRO", "EOG"],
}

# target distress cohort with actual outcome
COHORT = [
    ("CCL",  "0000815097", "2021-06-30", "RECOVER"),
    ("AAL",  "0000006201", "2021-03-31", "RECOVER"),
    ("NCLH", "0001513761", "2021-06-30", "RECOVER"),
    ("RCL",  "0000884887", "2021-06-30", "RECOVER"),
    ("UAL",  "0000100517", "2021-03-31", "RECOVER"),
    ("MGM",  "0000789570", "2021-03-31", "RECOVER"),
    ("BBBY", "0000886158", "2022-09-30", "COLLAPSE"),
    ("JCP",  "0001166126", "2019-09-30", "COLLAPSE"),
    ("PIR",  "0000278130", "2019-06-30", "COLLAPSE"),
    ("REV",  "0000887921", "2021-12-31", "COLLAPSE"),
    ("YELL", "0000716006", "2022-12-31", "COLLAPSE"),
    ("WLL",  "0001255474", "2019-09-30", "COLLAPSE"),
]


def core(facts, cutoff):
    ocf = flows.ttm_flow(facts, lb.TAG_MAP["OCF"], cutoff)
    ta = altman._latest(facts, ["Assets"], "instant", cutoff)
    return (ocf / ta) if (ocf is not None and ta) else None


def main():
    import time
    # resolve all peer CIKs once
    allpeers = sorted(set(p for ps in PEERS.values() for p in ps))
    pc = {t: cik for (t, cik, _, _, _) in resolve_ciks([(p, None, 0, "", None) for p in allpeers])}
    rows = []
    print("GOING (peer-relative) — is the distress SHARED (recover) or ALONE (collapse)?\n")
    print("%-6s %-9s %-9s %-9s %-13s %s" % ("TICK", "outcome", "self_core", "peer_med", "pred", ""))
    for (t, cik, cut, outcome) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        self_core = core(facts, cut)
        peer_cores = []
        for p in PEERS.get(t, []):
            if pc.get(p):
                pf = lb.fetch_sec_facts(pc[p])
                c = core(pf, cut)
                if c is not None:
                    peer_cores.append(c)
            time.sleep(0.1)
        if self_core is None or not peer_cores:
            print("%-6s insufficient" % t); continue
        peer_med = float(np.median(peer_cores))
        # SHARED if peers also weak (sector shock); IDIOSYNCRATIC if peers healthy
        shared = peer_med < 0.02
        pred = "RECOVER" if shared else "COLLAPSE"
        ok = pred == outcome
        rows.append({"t": t, "outcome": outcome, "pred": pred, "ok": ok})
        print("%-6s %-9s %-9.3f %-9.3f %-13s %s" % (t, outcome, self_core, peer_med, pred, "OK" if ok else "MISS"))
        time.sleep(0.2)
    acc = sum(1 for r in rows if r["ok"]) / len(rows) if rows else 0
    print("\n=== GOING peer-relative (vs naive 0.21) ===")
    print("  accuracy %d/%d = %.2f" % (sum(1 for r in rows if r["ok"]), len(rows), acc))
    for o in ("RECOVER", "COLLAPSE"):
        sub = [r for r in rows if r["outcome"] == o]
        print("  %-9s %d/%d" % (o, sum(1 for r in sub if r["ok"]), len(sub)))


if __name__ == "__main__":
    main()
