#!/usr/bin/env python3
"""
marketcap.py — point-in-time market value of equity, for the market-equity veto
on the solvency signal (fixes negative-book-equity-from-buybacks false positives
like O'Reilly / Yum that Altman's book-equity ratios misread as distressed).

  shares  : XBRL shares outstanding, filed <= cutoff (point-in-time)
  price   : Yahoo v8 chart close at/just before cutoff (current if cutoff None)
  MVE     : shares * price
  veto    : if the MARKET values equity well above total liabilities, the
            company is not in solvency distress regardless of book equity.
"""
import sys, os, json, urllib.request
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
import altman  # noqa: E402

SHARE_TAGS_DEI = ["EntityCommonStockSharesOutstanding"]
SHARE_TAGS_GAAP = ["CommonStockSharesOutstanding", "CommonStockSharesIssued"]


def _shares_pit(facts, cutoff):
    # dei namespace first
    for ns, tags in (("dei", SHARE_TAGS_DEI), ("us-gaap", SHARE_TAGS_GAAP)):
        node = (facts or {}).get("facts", {}).get(ns, {})
        for tag in tags:
            t = node.get(tag)
            if not t:
                continue
            units = t.get("units", {})
            arr = units.get("shares") or (list(units.values())[0] if units else [])
            best = None
            for e in arr:
                end, filed, val = e.get("end"), e.get("filed"), e.get("val")
                if val is None or not end:
                    continue
                if cutoff and end > cutoff:
                    continue
                if cutoff and filed and filed > cutoff:
                    continue
                key = (end or "", filed or "")
                if best is None or key > (best[0], best[1]):
                    best = (end or "", filed or "", val)
            if best:
                return best[2]
    return None


def _price_at(ticker, cutoff):
    """Yahoo v8 chart close at/just before cutoff (latest if cutoff None)."""
    try:
        url = ("https://query1.finance.yahoo.com/v8/finance/chart/" + ticker +
               "?range=10y&interval=1mo")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.load(r)
        res = d["chart"]["result"][0]
        ts = res["timestamp"]
        closes = res["indicators"]["quote"][0]["close"]
        pairs = [(t, c) for t, c in zip(ts, closes) if c is not None]
        if not pairs:
            return None
        if not cutoff:
            return pairs[-1][1]
        cut = datetime.strptime(cutoff, "%Y-%m-%d").timestamp()
        prior = [c for (t, c) in pairs if t <= cut]
        return prior[-1] if prior else None
    except Exception:
        return None


def mve_to_liabilities(facts, ticker, cutoff):
    """market value of equity / total liabilities, point-in-time. None if unknown."""
    sh = _shares_pit(facts, cutoff)
    px = _price_at(ticker, cutoff)
    if sh is None or px is None:
        return None, None
    mve = sh * px
    TL = altman._latest(facts, ["Liabilities"], "instant", cutoff)
    if TL is None:
        TA = altman._latest(facts, ["Assets"], "instant", cutoff)
        EQ = altman._latest(facts, ["StockholdersEquity"], "instant", cutoff)
        TL = (TA - EQ) if (TA is not None and EQ is not None) else None
    if not TL or TL <= 0:
        return mve, None
    return mve, mve / TL


if __name__ == "__main__":
    import limen_backtest as lb
    import time
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
    tests = [("YUM", "0001041061", None, "buyback neg-equity, healthy"),
             ("ORLY", "0000898173", None, "buyback neg-equity, healthy"),
             ("AZO", "0000866787", None, "buyback neg-equity, healthy"),
             ("AAPL", "0000320193", None, "healthy"),
             ("REV", "0000887921", "2022-06-15", "Revlon bankrupt"),
             ("FSR", "0001720990", "2024-06-17", "Fisker bankrupt")]
    print("%-6s %-12s %-12s %s" % ("TICK", "MVE($B)", "MVE/TL", "note"))
    for (t, cik, cut, note) in tests:
        facts = lb.fetch_sec_facts(cik)
        mve, ratio = mve_to_liabilities(facts, t, cut)
        print("%-6s %-12s %-12s %s" % (
            t, ("%.1f" % (mve / 1e9)) if mve else "None",
            ("%.2f" % ratio) if ratio else "None", note))
        time.sleep(0.3)
