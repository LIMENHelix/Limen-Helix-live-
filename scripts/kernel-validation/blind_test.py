#!/usr/bin/env python3
"""
BLIND-SET TEST: run the integrated peer-relative walk on companies NOT cherry-picked
for clean arcs (mix of healthy/struggling/cyclical/boring), across sectors. The
honest test of "solved" -- do the walks COHERE on companies I didn't pre-select, or
fall apart? I will read them straight and flag the incoherent ones, not rationalize.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402

PEERS = {
    "staples":  [("KO", "0000021344"), ("PG", "0000080424"), ("CL", "0000021665"),
                 ("GIS", "0000040704"), ("CLX", "0000021076"), ("KMB", "0000055785")],
    "retail":   [("WMT", "0000104169"), ("TGT", "0000027419"), ("COST", "0000909832"),
                 ("TJX", "0000109198"), ("ROST", "0000745732"), ("DG", "0000029534")],
    "industrials": [("HON", "0000773840"), ("EMR", "0000032604"), ("ETN", "0001551182"),
                    ("PH", "0000076334"), ("MMM", "0000066740"), ("ROK", "0001024478")],
    "pharma":   [("PFE", "0000078003"), ("MRK", "0000310158"), ("ABBV", "0001551152"),
                 ("GILD", "0000882095"), ("BMY", "0000014272"), ("LLY", "0000059478")],
    "hardware": [("AAPL", "0000320193"), ("HPQ", "0000047217"), ("DELL", "0001571996"),
                 ("CSCO", "0000858877"), ("ANET", "0001596532")],
    "energy":   [("XOM", "0000034088"), ("CVX", "0000093410"), ("COP", "0001163165"),
                 ("VLO", "0001035002"), ("MPC", "0001510295"), ("EOG", "0000821189")],
    "semis":    [("NVDA", "0001045810"), ("INTC", "0000050863"), ("AMD", "0000002488"),
                 ("TXN", "0000097476"), ("QCOM", "0000804328"), ("MU", "0000723125")],
    "software": [("MSFT", "0000789019"), ("ORCL", "0001341439"), ("CRM", "0001108524"),
                 ("ADBE", "0000796343"), ("NOW", "0001373715"), ("INTU", "0000896878")],
}

# BLIND companies (not validated; mix of healthy/struggling/cyclical/boring)
BLIND = [
    ("CL",   "0000021665", "staples"),       # boring staple
    ("TJX",  "0000109198", "retail"),        # strong off-price
    ("M",    "0000794367", "retail"),        # Macy's - struggling dept store
    ("HON",  "0000773840", "industrials"),   # diversified industrial
    ("GILD", "0000882095", "pharma"),        # Gilead
    ("CSCO", "0000858877", "hardware"),      # networking
    ("VLO",  "0001035002", "energy"),        # refiner (cyclical)
    ("MU",   "0000723125", "semis"),         # memory (very cyclical)
    ("ADBE", "0000796343", "software"),      # Adobe
    ("BBY",  "0000764478", "retail"),        # Best Buy - challenged retailer
    ("DELL", "0001571996", "hardware"),      # Dell
    ("MRK",  "0000310158", "pharma"),        # Merck
]


def main():
    import time
    # precompute sector medians once
    secmeds = {}
    for sec in set(s for _, _, s in BLIND):
        secmeds[sec] = pw.sector_median_growth_from(PEERS[sec])
    for (t, cik, sec) in BLIND:
        facts = lb.fetch_sec_facts(cik)
        qs, rows = iw.build(facts)
        if not qs:
            print("\n%s [%s]: insufficient data" % (t, sec)); continue
        phases = iw.persist([pw.arbitrate_rel(qs, rows, i, secmeds[sec]) for i in range(len(qs))])
        eps = [e for e in iw.episodes(qs, phases) if not (e[0] == e[1] and e[2] == "transition")]
        print("\n%s  [%s]" % (t, sec))
        for (s, e, p) in eps[-6:]:           # last ~6 episodes (recent walk)
            print("  %s-%s  %s" % (iw.fmt(s), iw.fmt(e), p) if s != e else "  %s        %s" % (iw.fmt(s), p))
        time.sleep(0.2)
    print("\n  BLIND read: do these cohere, or fall apart? (flag the incoherent ones honestly)")


if __name__ == "__main__":
    main()
