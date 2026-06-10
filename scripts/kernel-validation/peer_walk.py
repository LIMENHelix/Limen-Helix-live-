#!/usr/bin/env python3
"""
PEER-RELATIVE WALK — wire the confirmed missing variable (exogenous sector component)
into the integrated walk. Arbitrate on the company's growth RELATIVE to its sector
median AT EACH QUARTER, so an exogenous sector decline (OXY falling with oil) is NOT
read as the company's own phase, while idiosyncratic growth (TSLA vs legacy autos)
still reads as order.

Reuses integrated_walk.build/persist/episodes; replaces absolute growth with
sector-relative growth in the arbitration.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from flows import decumulate          # noqa: E402
import integrated_walk as iw          # noqa: E402

SECTOR_PEERS = {
    "energy": [("XOM", "0000034088"), ("CVX", "0000093410"), ("COP", "0001163165"),
               ("OXY", "0000797468"), ("EOG", "0000821189"), ("DVN", "0001090012")],
    "semis":  [("NVDA", "0001045810"), ("INTC", "0000050863"), ("AMD", "0000002488"),
               ("TXN", "0000097476"), ("QCOM", "0000804328"), ("MU", "0000723125")],
    "autos":  [("F", "0000037996"), ("GM", "0001467858"), ("TSLA", "0001318605"),
               ("STLA", "0001605484"), ("HMC", "0000715153")],
    "tech":   [("AAPL", "0000320193"), ("MSFT", "0000789019"), ("GOOGL", "0001652044"),
               ("META", "0001326801"), ("ORCL", "0001341439")],
}


def yoy_by_q(facts):
    rev = decumulate(facts, lb.TAG_MAP["Revenue"])
    qs = sorted(rev)
    out = {}
    for i in range(4, len(qs)):
        a, b = rev[qs[i]], rev[qs[i - 4]]
        if a and b and b > 0:
            out[qs[i]] = (a - b) / abs(b)
    return out


def sector_median_growth(sector):
    peer_g = [yoy_by_q(lb.fetch_sec_facts(cik)) for _, cik in SECTOR_PEERS[sector]]
    allq = sorted(set().union(*[set(g) for g in peer_g]))
    med = {}
    for q in allq:
        vals = [g[q] for g in peer_g if q in g]
        if len(vals) >= 3:
            med[q] = float(np.median(vals))
    return med


def arbitrate_rel(qs, rows, i, secmed):
    """integrated_walk.arbitrate but with SECTOR-RELATIVE growth."""
    if i < 8:
        return None
    q = qs[i]
    rv = [rows[qs[j]]["rev"] for j in range(i - 7, i + 1) if rows[qs[j]]["rev"]]
    if len(rv) < 6 or rv[-1] is None or rv[-5] is None or rv[-5] == 0:
        return None
    g_abs = (rv[-1] - rv[-5]) / abs(rv[-5])
    g = g_abs - secmed.get(q, 0.0)                  # SECTOR-RELATIVE growth
    ocf_ttm = sum(rows[qs[j]]["ocf"] or 0 for j in range(i - 3, i + 1))
    cff_ttm = sum(rows[qs[j]]["cff"] or 0 for j in range(i - 3, i + 1))
    dch = None
    d_now, d_then = rows[q]["debt"], rows[qs[i - 4]]["debt"]
    if d_now and d_then and d_then > 0:
        dch = (d_now - d_then) / d_then
    burn = ocf_ttm < 0
    take_in = cff_ttm > 0 and cff_ttm > 0.5 * abs(ocf_ttm)
    delever = dch is not None and dch < -0.12
    lever = dch is not None and dch > 0.12
    if burn and (take_in or lever):
        return "P4-scaffold"
    if g < -0.06:
        return "P3-fracture-or-lag"     # declining RELATIVE to sector = idiosyncratic
    if delever and not burn:
        return "P8-self-correct"
    if g > 0.05 and not burn:
        return "P6-OUTgrow-sector"      # outgrowing sector = idiosyncratic strength
    if not burn and lever:
        return "P6-strategic-lever"
    if not burn:
        return "P2/P5-stable(in-line)"  # in-line with sector = riding the macro
    return "transition"


PANEL = [("OXY", "0000797468", "energy", "should stop reading exogenous oil decline"),
         ("INTC", "0000050863", "semis", "should still show idiosyncratic lag/fracture"),
         ("TSLA", "0001318605", "autos", "should still OUTgrow legacy autos"),
         ("AAPL", "0000320193", "tech", "softpatch vs strong tech sector")]


def main():
    import time
    for (t, cik, sector, note) in PANEL:
        secmed = sector_median_growth(sector)
        facts = lb.fetch_sec_facts(cik)
        qs, rows = iw.build(facts)
        phases = iw.persist([arbitrate_rel(qs, rows, i, secmed) for i in range(len(qs))])
        eps = [e for e in iw.episodes(qs, phases) if not (e[0] == e[1] and e[2] == "transition")]
        print("\n%s  [%s sector]  (%s)" % (t, sector, note))
        for (s, e, p) in eps:
            print("  %s-%s  %s" % (iw.fmt(s), iw.fmt(e), p) if s != e else "  %s        %s" % (iw.fmt(s), p))
        time.sleep(0.2)
    print("\n  Growth is now RELATIVE to sector -> exogenous macro removed; only idiosyncratic phase remains.")


if __name__ == "__main__":
    main()
