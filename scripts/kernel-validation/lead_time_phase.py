#!/usr/bin/env python3
"""
PHASE LEAD-TIME TEST (the decisive predictive question): does the driving LINE move
BEFORE the phase break (early warning) or only coincident with it (explanation, no
warning)? For each fracture/scaffold break, trace the driving line's CONTINUOUS value
in the 8 quarters before the break and find when it first clearly turned. Honest read
-- over-reach lives here; if it's just the persistence lag, say so.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps            # noqa: E402

CASES = [
    ("EL",   "0001001250", (2024, 3), "rev+margin"),   # China collapse
    ("INTC", "0000050863", (2022, 3), "margin"),        # Intel fracture
    ("BA",   "0000012927", (2019, 2), "rev+margin"),    # 737-MAX
    ("DLTR", "0000935703", (2023, 2), "margin"),        # Family Dollar drag
    ("EL",   "0001001250", (2022, 3), "margin"),
]


def yoy(rev, q):
    qp = (q[0] - 1, q[1])
    if q in rev and qp in rev and rev[qp] > 0:
        return (rev[q] - rev[qp]) / rev[qp]
    return None


def qoff(q, k):
    tot = q[0] * 4 + (q[1] - 1) - k
    return (tot // 4, tot % 4 + 1)


def main():
    import time
    leads = []
    for (t, cik, bq, drv) in CASES:
        facts = lb.fetch_sec_facts(cik)
        rev = ps._rev_dict(facts)
        cd = ps._cost_dict(facts)
        gm = {}
        if cd:
            for q in set(rev) & set(cd):
                if rev[q] and rev[q] > 0:
                    m = (rev[q] - cd[q]) / rev[q]
                    if -0.5 <= m <= 0.95:
                        gm[q] = m
        window = [qoff(bq, k) for k in range(8, -1, -1)]
        print("\n%s  break %dQ%d  [driver: %s]" % (t, bq[0], bq[1], drv))
        print("  quarter   YoY-growth   gross-margin")
        for q in window:
            g = yoy(rev, q)
            m = gm.get(q)
            print("  %dQ%d      %-9s    %s" % (
                q[0], q[1], ("%+.0f%%" % (g * 100)) if g is not None else "n/a",
                ("%.2f" % m) if m is not None else "n/a"))
        # HONEST lead = CONTIGUOUS deterioration immediately before the break (not a
        # lone noisy quarter at the window edge, which falsely reads 8q).
        lead = 0
        for k in range(1, 8):
            g = yoy(rev, qoff(bq, k))
            if g is not None and g < -0.02:
                lead = k
            else:
                break
        leads.append(lead)
        print("  -> CONTIGUOUS deterioration into the break = %dq (real lead, not edge-noise)" % lead)
        time.sleep(0.15)
    valid = [x for x in leads if x > 0]
    print("\n=== LEAD TIME (quarters the driving line turned BEFORE the phase break) ===")
    print("  per case:", leads)
    print("  positive lead: %d/%d   median: %s quarters" % (
        len(valid), len(leads), int(np.median(valid)) if valid else "n/a"))
    print("  lead>0 consistently -> EARLY WARNING (predictive); ~0 -> explanation only.")


if __name__ == "__main__":
    main()
