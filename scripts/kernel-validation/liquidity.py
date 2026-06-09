#!/usr/bin/env python3
"""
liquidity.py — accounting liquidity signal to catch the failures a SOLVENCY
model (Altman) structurally misses: COVID/run-type liquidity collapses (Hertz,
WeWork) that were solvent on the balance sheet but couldn't fund near-term
obligations.

Trap: healthy companies (McDonald's, Starbucks) routinely run current ratio < 1
and are fine. So the signal must capture liquidity COLLAPSE under cash burn, not
a low static level. Metrics (point-in-time, filed<=cutoff):

  current_ratio = AssetsCurrent / LiabilitiesCurrent
  ocf_ttm       = sum of last 4 quarterly OCF (as-reported)
  cash          = cash & equivalents
  runway_q      = cash / |quarterly burn|  when OCF burning
  burn          = ocf_ttm < 0
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb       # noqa: E402
import altman                     # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

CASH_TAGS = ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]


def liquidity(facts, cutoff=None):
    AC = altman._latest(facts, ["AssetsCurrent"], "instant", cutoff)
    LC = altman._latest(facts, ["LiabilitiesCurrent"], "instant", cutoff)
    cash = altman._latest(facts, CASH_TAGS, "instant", cutoff)
    ocf_q = extract_pit(facts, lb.TAG_MAP["OCF"], True, cutoff)  # quarterly OCF, as-reported
    ocfs = [v for _, v in sorted(ocf_q.items())][-4:]
    ocf_ttm = sum(ocfs) if ocfs else None
    cur = (AC / LC) if (AC and LC) else None
    burn_q = (-ocf_ttm / 4.0) if (ocf_ttm is not None and ocf_ttm < 0) else None
    runway = (cash / burn_q) if (cash and burn_q and burn_q > 0) else None
    return {"current_ratio": round(cur, 2) if cur else None,
            "ocf_ttm": ocf_ttm, "cash": cash,
            "runway_q": round(runway, 1) if runway else None,
            "burning": ocf_ttm is not None and ocf_ttm < 0}


if __name__ == "__main__":
    import time
    cases = [
        ("HTZ", "0001657853", "2020-05-22", "LIQUIDITY-FAIL"),
        ("WE",  "0001813756", "2023-11-06", "LIQUIDITY-FAIL"),
        ("CHK", "0000895126", "2020-06-28", "solvency-fail"),
        ("BBBY", "0000886158", "2023-04-23", "masking-fail"),
        ("JCP", "0001166126", "2020-05-15", "retail-fail"),
        ("MCD", None, None, "healthy-low-CR"),
        ("SBUX", None, None, "healthy-low-CR"),
        ("AAPL", None, None, "healthy"),
        ("WMT", None, None, "healthy"),
        ("KO",  None, None, "healthy"),
    ]
    from validate_kernel import resolve_ciks
    resolved = resolve_ciks([(t, c, 0, n, e) for (t, c, e, n) in cases])
    print("%-6s %-15s %-9s %-9s %-9s %-8s" % ("TICK", "TYPE", "curr_rat", "ocf_ttm", "runway_q", "burning"))
    for (t, cik, _, note, ev) in resolved:
        if not cik:
            print(t, "no cik"); continue
        facts = lb.fetch_sec_facts(cik)
        r = liquidity(facts, ev)
        print("%-6s %-15s %-9s %-9s %-9s %-8s" % (
            t, note, str(r["current_ratio"]), str(r["ocf_ttm"]),
            str(r["runway_q"]), str(r["burning"])))
        time.sleep(0.25)
