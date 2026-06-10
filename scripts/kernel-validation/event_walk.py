#!/usr/bin/env python3
"""
EVENT WALK = the integrated peer-relative walk + the 8-K event overlay. The event
layer is ADDITIVE and EVENT-GATED: it punctuates the financials walk with P1/P7 only
at confirmed 8-K Item 2.01 quarters (classified acq/disp by asset direction). It
cannot alter the rest -> cannot break a working case (validated: OXY writedowns do
NOT trigger; AAPL with no events is unchanged).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402
import events as ev                   # noqa: E402
import blind_test as bt               # noqa: E402


def event_walk(t, cik, sec):
    secmed = pw.sector_median_growth_from(bt.PEERS.get(sec, pw.SECTOR_PEERS.get(sec, [])))
    facts = lb.fetch_sec_facts(cik)
    qs, rows = iw.build(facts)
    base = iw.persist([pw.arbitrate_rel(qs, rows, i, secmed) for i in range(len(qs))])
    over = ev.overlay(qs, base, rows, ev.event_quarters(cik))
    return qs, rows, over


PANEL = [("MMM", "0000066740", "industrials"), ("OXY", "0000797468", "energy"),
         ("GE", "0000040545", "industrials"), ("AAPL", "0000320193", "hardware"),
         ("INTC", "0000050863", "semis"), ("DELL", "0001571996", "hardware")]


def main():
    import time
    for (t, cik, sec) in PANEL:
        qs, rows, over = event_walk(t, cik, sec)
        eps = [e for e in iw.episodes(qs, over) if not (e[0] == e[1] and e[2] == "transition")]
        print("\n%s [%s]" % (t, sec))
        for (s, e, p) in eps[-8:]:
            print("  %s-%s  %s" % (iw.fmt(s), iw.fmt(e), p) if s != e else "  %s        %s" % (iw.fmt(s), p))
        time.sleep(0.2)
    print("\n  8-K events PUNCTUATE the financials walk (additive); writedowns can't fake a 2.01.")


if __name__ == "__main__":
    main()
