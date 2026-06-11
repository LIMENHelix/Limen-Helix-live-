#!/usr/bin/env python3
"""
RUN 30 MORE companies (NONE used before) through the current engine (smoothed growth
+ category-aware persist + 8-K events; spinoff overlay omitted for speed) -> certify
the core changes on a fresh set + emit JSON for the LIMEN chart. CIKs resolved from
SEC's ticker file (no hand-typed CIK errors).
"""
import sys, os, json
import urllib.request
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402
import events as ev                   # noqa: E402

SECTORS = {
    "chemicals": ["DOW", "DD", "LYB", "EMN", "CE", "ALB"],
    "machinery": ["ITW", "CMI", "PCAR", "DE", "PH", "EMR"],
    "materials": ["LIN", "APD", "SHW", "ECL", "PPG"],
    "metals": ["NEM", "FCX", "GOLD", "AEM", "NUE"],
    "biotech": ["REGN", "VRTX", "GILD", "AMGN", "BIIB", "MRNA"],
    "medtech": ["MDT", "SYK", "BSX", "ZBH", "ISRG", "DXCM"],
    "semicap": ["AMAT", "LRCX", "KLAC", "MCHP", "ADI", "TXN"],
    "security": ["PANW", "CRWD", "FTNT", "ZS", "GEN"],
    "social": ["SNAP", "PINS", "META", "RBLX", "MTCH"],
    "solar": ["ENPH", "FSLR", "SEDG", "RUN", "NXT"],
    "oilEP": ["FANG", "EOG", "DVN", "COP", "APA"],
    "bev": ["STZ", "KDP", "MDLZ", "KHC", "KO"],
    "travel": ["BKNG", "EXPE", "MAR", "HLT", "ABNB"],
    "cruise": ["NCLH", "CCL", "RCL"],
    "apparel": ["VFC", "RL", "PVH", "ANF", "DECK"],
    "restaurants": ["DRI", "WEN", "MCD", "SBUX", "YUM"],
}
TARGETS = [
    ("DOW", "chemicals"), ("CTVA", "chemicals"), ("ITW", "machinery"), ("CMI", "machinery"),
    ("LIN", "materials"), ("SHW", "materials"), ("NEM", "metals"), ("MRNA", "biotech"),
    ("REGN", "biotech"), ("VRTX", "biotech"), ("MDT", "medtech"), ("SYK", "medtech"),
    ("ISRG", "medtech"), ("DXCM", "medtech"), ("AMAT", "semicap"), ("LRCX", "semicap"),
    ("MCHP", "semicap"), ("PANW", "security"), ("CRWD", "security"), ("SNAP", "social"),
    ("RBLX", "social"), ("ENPH", "solar"), ("FANG", "oilEP"), ("STZ", "bev"),
    ("MDLZ", "bev"), ("BKNG", "travel"), ("NCLH", "cruise"), ("VFC", "apparel"),
    ("DRI", "restaurants"), ("CMI", "machinery"),
]


def ticker_cik_map():
    req = urllib.request.Request("https://www.sec.gov/files/company_tickers.json",
                                 headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in d.values()}


def main():
    import time
    T2C = ticker_cik_map()
    secmeds = {}
    for sec, peers in SECTORS.items():
        plist = [(t, T2C[t]) for t in peers if t in T2C]
        secmeds[sec] = pw.sector_median_growth_from(plist)
    results = []
    seen = set()
    for (t, sec) in TARGETS:
        if t in seen or t not in T2C:
            continue
        seen.add(t)
        try:
            facts = lb.fetch_sec_facts(T2C[t])
            qs, rows = iw.build(facts)
            base = iw.persist([pw.arbitrate_rel(qs, rows, i, secmeds[sec]) for i in range(len(qs))])
            over = ev.overlay(qs, base, rows, ev.event_quarters(T2C[t]))
            eps = [(("%dQ%d" % s), ("%dQ%d" % e), p) for (s, e, p) in iw.episodes(qs, over)
                   if not (s == e and p == "transition")]
        except Exception as ex:
            eps = [("err", "err", str(ex)[:30])]
        results.append({"t": t, "sector": sec, "eps": eps[-7:]})
        print("\n%-6s [%s]" % (t, sec))
        for s, e, p in eps[-7:]:
            print("  %s-%s  %s" % (s, e, p))
        time.sleep(0.1)
    with open(os.path.join(os.path.dirname(__file__), "run30b_results.json"), "w") as f:
        json.dump(results, f)
    print("\n  wrote run30b_results.json (%d companies)" % len(results))


if __name__ == "__main__":
    main()
