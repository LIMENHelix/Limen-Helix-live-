#!/usr/bin/env python3
"""
8-K EVENT LAYER (high-precision, additive). Confirms P1/P7 structural events from
actual 8-K Item 2.01 filings (Completion of Acquisition or Disposition of Assets) --
a HARD signal a writedown can't fake. Classifies acquisition (P1) vs disposition (P7)
by asset direction. Used as an OVERLAY: punctuates the financials walk at confirmed
event quarters, never alters the rest -> cannot break a working case.

Data limit: SEC 'recent' submissions cover ~2020+; older events for high-volume
filers need the historical filing files (not fetched here).
"""
import json
import urllib.request

_CACHE = {}


def event_quarters(cik):
    """quarters with a confirmed 8-K Item 2.01 (acquisition/disposition)."""
    cik = str(cik).zfill(10)
    if cik in _CACHE:
        return _CACHE[cik]
    out = set()
    try:
        url = "https://data.sec.gov/submissions/CIK%s.json" % cik
        req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.load(r)
        rec = d.get("filings", {}).get("recent", {})
        forms, items, dates = rec.get("form", []), rec.get("items", []), rec.get("filingDate", [])
        for i, f in enumerate(forms):
            it = items[i] if i < len(items) else ""
            if f == "8-K" and "2.01" in it:
                dt = dates[i]
                out.add((int(dt[:4]), (int(dt[5:7]) - 1) // 3 + 1))
    except Exception:
        pass
    _CACHE[cik] = out
    return out


def classify_event(rows, q):
    """acquisition (P1) vs disposition/separation (P7) by asset direction YoY."""
    qp = (q[0] - 1, q[1])
    a_now = rows.get(q, {}).get("assets")
    a_then = rows.get(qp, {}).get("assets")
    if a_now and a_then and a_then > 0:
        chg = (a_now - a_then) / a_then
        if chg < -0.08:
            return "P7-separation(8K-confirmed)"
        if chg > 0.08:
            return "P1-acquisition(8K-confirmed)"
    return "structural-event(8K)"


def overlay(qs, phases, rows, evq):
    """punctuate the (already-persisted) walk with confirmed events. Additive only."""
    out = list(phases)
    for i, q in enumerate(qs):
        if q in evq and out[i] is not None:
            out[i] = classify_event(rows, q)
    return out
