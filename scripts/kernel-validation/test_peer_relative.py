#!/usr/bin/env python3
"""
TEST the recurring-influence hypothesis (operator failure-mapping method):
the margin-COMPRESS over-fire is an EXOGENOUS COMMON FACTOR (macro/sector), not
company fracture. If so, PEER-RELATIVE margin (company delta MINUS sector-median
delta) should make the macro-driven compressions DROP OUT and leave only the
IDIOSYNCRATIC movers.

Honest test: run it and see. If sector-wide compressors stop flagging while a
genuine idiosyncratic mover (e.g. INTC vs other semis) still flags, the missing
variable is confirmed and peer-relative is the implementation. If not, the
hypothesis is wrong -- say so.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps             # noqa: E402

SECTORS = {
    "staples":   [("KO", "0000021344"), ("PG", "0000080424"), ("CL", "0000021665"),
                  ("GIS", "0000040704"), ("KMB", "0000055785"), ("MO", "0000764180")],
    "pharmacy":  [("WBA", "0001618921"), ("CVS", "0000064803")],
    "big-box":   [("WMT", "0000104169"), ("TGT", "0000027419"), ("COST", "0000909832")],
    "semis":     [("INTC", "0000050863"), ("NVDA", "0001045810"),
                  ("TXN", "0000097476"), ("AMD", "0000002488")],
    "tech-mega": [("MSFT", "0000789019"), ("GOOGL", "0001652044"),
                  ("META", "0001326801"), ("AAPL", "0000320193")],
}
COMPRESS = -0.03


def margin_delta(facts):
    rev = ps.rev_series(facts, n=20)
    cost = ps.cost_series(facts, n=20)
    if cost is None or len(rev) < 12 or len(cost) < 12:
        return None
    n = min(len(rev), len(cost))
    r, c = np.array(rev[-n:], float), np.array(cost[-n:], float)
    gm = (r - c) / (r + 1e-9)
    h = n // 2
    return float(np.mean(gm[h:]) - np.mean(gm[:h]))


def main():
    import time
    abs_flags = rel_flags = total = 0
    for sector, members in SECTORS.items():
        deltas = {}
        for (t, cik) in members:
            facts = lb.fetch_sec_facts(cik)
            d = margin_delta(facts)
            if d is not None:
                deltas[t] = d
            time.sleep(0.15)
        if len(deltas) < 2:
            continue
        med = float(np.median(list(deltas.values())))
        print("\nSECTOR %-10s (median margin delta %+.3f)" % (sector, med))
        for t, d in deltas.items():
            rel = d - med
            a = "COMPRESS-abs" if d < COMPRESS else "  .  "
            r = "COMPRESS-REL" if rel < COMPRESS else "  .  "
            total += 1
            abs_flags += d < COMPRESS
            rel_flags += rel < COMPRESS
            print("  %-6s delta %+.3f  %-13s | rel %+.3f  %s" % (t, d, a, rel, r))
    print("\n=== hypothesis: peer-relative removes the macro-common compression ===")
    print("  absolute COMPRESS flags: %d / %d" % (abs_flags, total))
    print("  peer-relative COMPRESS flags: %d / %d" % (rel_flags, total))
    print("  if rel << abs, the over-fire WAS exogenous macro -> peer-relative is the missing variable.")


if __name__ == "__main__":
    main()
