#!/usr/bin/env python3
"""
flows.py — de-cumulate quarterly cash flows so the P4/P5 kernels detect TIMELY
(point-in-time), not on year-lagged annual data.

Most filers report cash flows as cumulative YTD, all sharing the SAME fiscal-year
START date: Q1=(S, S+3mo), H1=(S, S+6mo), 9mo=(S, S+9mo), FY=(S, S+12mo). Group
by start, sort by end, difference consecutive cumulative values to recover the
discrete quarter ending at each date:
    Q1 = v1,  Q2 = v2 - v1,  Q3 = v3 - v2,  Q4 = v4 - v3
Companies that already report discrete quarters have one period per start ->
singleton groups -> value used as-is. Then TTM = sum of the last 4 discrete
quarters, which updates EVERY quarter instead of once a year.
"""
import sys, os
from datetime import datetime
from collections import defaultdict
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402


def decumulate(facts, tags, cutoff=None):
    """Discrete quarterly flow values {(year,q): val}, point-in-time (filed<=cutoff)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    periods = {}  # (start,end) -> (filed, val) keep latest filing <= cutoff
    for tag in tags:
        node = gaap.get(tag.split("/")[-1])
        if not node:
            continue
        for e in node.get("units", {}).get("USD") or []:
            start, end, filed, val = e.get("start"), e.get("end"), e.get("filed"), e.get("val")
            if not (start and end and val is not None and filed):
                continue
            if cutoff and (end > cutoff or filed > cutoff):
                continue
            try:
                days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
            except Exception:
                continue
            if not (75 <= days <= 400):
                continue
            key = (start, end)
            if key not in periods or filed > periods[key][0]:
                periods[key] = (filed, val)
    groups = defaultdict(list)
    for (start, end), (filed, val) in periods.items():
        groups[start].append((end, val))
    discrete = {}
    for start, lst in groups.items():
        lst.sort()
        prev = 0.0
        for (end, val) in lst:
            yq = lb.date_to_quarter(datetime.strptime(end, "%Y-%m-%d"))
            discrete[yq] = val - prev
            prev = val
    return discrete


def ttm_flow(facts, tags, cutoff=None, min_q=4):
    """Trailing-twelve-month flow = sum of the last 4 discrete quarters (timely)."""
    d = decumulate(facts, tags, cutoff)
    qs = sorted(d.keys())
    if len(qs) < min_q:
        return None
    return sum(d[q] for q in qs[-4:])


CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


if __name__ == "__main__":
    # verify on a cumulative reporter (Carnival) — discrete quarterly OCF through COVID
    facts = lb.fetch_sec_facts("0000815097")
    d = decumulate(facts, lb.TAG_MAP["OCF"], "2021-01-31")
    print("CCL discrete quarterly OCF ($M), point-in-time 2021-01-31 (FY ends Nov):")
    for q in sorted(d.keys())[-8:]:
        print("  %s  %8.0f" % (str(q), d[q] / 1e6))
    print("  TTM OCF @2020-08-31: %.0fM (timely COVID burn, not waiting for the 10-K)" % (
        (ttm_flow(facts, lb.TAG_MAP["OCF"], "2020-08-31") or 0) / 1e6))
    print("  TTM OCF @2019-12-31 (pre-COVID): %.0fM" % (
        (ttm_flow(facts, lb.TAG_MAP["OCF"], "2019-12-31") or 0) / 1e6))
