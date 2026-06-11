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


def _fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def event_quarters(cik):
    """quarters with a confirmed 8-K Item 2.01 (acquisition/disposition), from BOTH
    the recent submissions AND the historical filing-files (>=2010) -> catches
    pre-2020 acq/disp for high-volume filers (recent window was ~2020+).
    NOTE: pro-rata SPINOFFS (HON/YUM) use generic Item 8.01, not 2.01, so they are
    NOT caught -- a filing-convention limit (5.04 tested unreliable: misses YUM,
    false-fires KO). The reliable spinoff signal (child's Form 10-12B) needs a
    parent-child cross-ref the per-company data lacks."""
    cik = str(cik).zfill(10)
    if cik in _CACHE:
        return _CACHE[cik]
    out = set()

    def process(rec):
        forms, items, dates = rec.get("form", []), rec.get("items", []), rec.get("filingDate", [])
        for i, f in enumerate(forms):
            it = items[i] if i < len(items) else ""
            if f.startswith("8-K") and "2.01" in it:
                dt = dates[i]
                out.add((int(dt[:4]), (int(dt[5:7]) - 1) // 3 + 1))

    try:
        d = _fetch_json("https://data.sec.gov/submissions/CIK%s.json" % cik)
        process(d.get("filings", {}).get("recent", {}))
        for fo in d.get("filings", {}).get("files", []):
            if fo.get("filingTo", "") >= "2010":
                try:
                    process(_fetch_json("https://data.sec.gov/submissions/%s" % fo["name"]))
                except Exception:
                    pass
    except Exception:
        pass
    _CACHE[cik] = out
    return out


def parent_token(facts):
    """distinctive parent name token from entityName (Honeywell Intl Inc -> Honeywell)."""
    import re
    nm = re.sub(r"(?i)\b(inc|corp|corporation|company|co|international|holdings|group|plc|ltd|the|llc|sa|nv)\b",
                "", (facts or {}).get("entityName", ""))
    parts = re.sub(r"[^A-Za-z ]", " ", nm).strip().split()
    return parts[0].title() if parts else None


def spinoff_overlay(qs, phases, facts):
    """OPTIONAL + SLOW (~30 doc fetches/company, cached): tag confirmed 10-12B spinoff
    quarters as P7-spinoff. Catches PRO-RATA spinoffs that 8-K Item 2.01 misses (HON
    Garrett/Resideo, YUM Yum China). Additive (only overlays confirmed quarters).
    NOTE: the parent's revenue REBASES lower for ~4q post-spinoff, which the decline
    detector may still read as coherent-decline -- a separate residual artifact."""
    try:
        import spinoff_registry as sr
    except Exception:
        return phases
    tok = parent_token(facts)
    if not tok:
        return phases
    spins = sr.confirmed_spinoffs(tok, tok)
    out = list(phases)
    suppressible = ("coherent-decline", "P3-fracture", "sector-headwind(riding-macro)")
    for i, q in enumerate(qs):
        if q in spins and out[i] is not None:
            out[i] = "P7-spinoff(10-12B)"
            # the parent's revenue REBASES lower for ~4q (until YoY laps the spinoff);
            # that drop is the spinoff footprint, not a decline phase. Applied AFTER
            # persist -> bounded to the 4q window (not absorbed into a long episode).
            for k in range(1, 5):
                if i + k < len(out) and out[i + k] in suppressible:
                    out[i + k] = "post-spinoff-rebasing"
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
