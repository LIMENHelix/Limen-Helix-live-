#!/usr/bin/env python3
"""
UNPREDETERMINED run: ~50 large-caps NOT hand-picked for their arcs, through the core
walk (absolute mode -- no sector groups), aggregate the EMERGENT STRUCTURE: phase
dwell + phase->phase transition counts across all of them. Output JSON for a
structure (transition-network) chart. Selection is by "large + not previously used +
sector spread", NOT by knowing the phase history -> removes arc-cherry-pick bias.
"""
import sys, os, json
import urllib.request
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402
import events as ev                   # noqa: E402

TICKERS = ["ABT", "TMO", "DHR", "BDX", "IDXX", "IQV", "MTD", "RMD", "ALGN", "BAX",
           "SNPS", "CDNS", "ANSS", "KEYS", "TER", "NTAP", "WDC", "STX", "JNPR", "HPE",
           "DOV", "AME", "FTV", "XYL", "IEX", "NDSN", "SNA", "SWK", "GWW", "FAST",
           "URI", "PWR", "HSY", "MKC", "SJM", "HRL", "TSN", "CPB", "MNST", "ORLY",
           "AZO", "TSCO", "GPC", "POOL", "WSM", "PSX", "OKE", "TRGP", "LYB", "CF",
           "FMC", "IFF", "PPG", "VMC", "MLM", "OMC", "EA", "TTWO"]


def t2c():
    req = urllib.request.Request("https://www.sec.gov/files/company_tickers.json",
                                 headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in d.values()}


def norm(p):
    # collapse the variant labels to the core phase for the structure graph
    if p.startswith("P6") or "P2/P5" in p or "P5" in p:
        return {"P6-order": "P6", "P6-OUTgrow-sector": "P6", "P6-LAG-sector(healthy)": "P6",
                "P6-strategic-lever": "P6", "P2/P5-stable(in-line)": "P2", "P8-self-correct": "P8"}.get(p, "P6")
    return {"P0-null": "P0", "P3-fracture": "P3", "P3-fracture(profitability)": "P3p",
            "coherent-decline": "P3d", "sector-headwind(riding-macro)": "P3d",
            "post-spinoff-rebasing": "P7", "P4-scaffold": "P4", "P8-self-correct": "P8",
            "P1-acquisition(8K-confirmed)": "P1", "P7-separation(8K-confirmed)": "P7",
            "structural-event(8K)": "P7", "transition": None}.get(p, p)


def main():
    import time
    from collections import Counter, defaultdict
    C = t2c()
    dwell = Counter()
    trans = defaultdict(int)
    current = Counter()
    ok = 0
    for t in TICKERS:
        if t not in C:
            continue
        try:
            facts = lb.fetch_sec_facts(C[t])
            qs, rows = iw.build(facts)
            base = iw.persist([pw.arbitrate_rel(qs, rows, i, {}) for i in range(len(qs))])
            over = ev.overlay(qs, base, rows, ev.event_quarters(C[t]))
            eps = [(s, e, norm(p)) for (s, e, p) in iw.episodes(qs, over) if norm(p)]
        except Exception:
            continue
        if not eps:
            continue
        ok += 1
        for (s, e, p) in eps:
            dwell[p] += (e[0] * 4 + e[1]) - (s[0] * 4 + s[1]) + 1
        for k in range(1, len(eps)):
            a, b = eps[k - 1][2], eps[k][2]
            if a != b:
                trans[(a, b)] += 1
        current[eps[-1][2]] += 1
        time.sleep(0.1)
    out = {"n": ok, "dwell": dict(dwell), "current": dict(current),
           "trans": [{"from": a, "to": b, "w": w} for (a, b), w in sorted(trans.items(), key=lambda x: -x[1])]}
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "universe_structure.json"), "w"))
    print("ran %d companies" % ok)
    print("dwell:", dict(dwell.most_common()))
    print("current phase:", dict(current.most_common()))
    print("top transitions:", [("%s->%s" % (a, b), w) for (a, b), w in sorted(trans.items(), key=lambda x: -x[1])[:14]])


if __name__ == "__main__":
    main()
