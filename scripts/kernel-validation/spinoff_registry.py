#!/usr/bin/env python3
"""
SPINOFF REGISTRY (attempt to catch pro-rata spinoffs that 8-K Item 2.01 misses).

*** TESTED + NOT WIRED -- precision FAILED (2026-06-10). ***
The spun CHILD files a Form 10-12B naming the parent; EFTS full-text search finds
candidates. But a full-text MENTION != a spinoff FROM the parent, and the structural
confirmation (parent revenue YoY drop near the 10-12B date) DOES NOT disambiguate:
 - Yum!: confirmed 8 but only Yum China real (Kontoor/Hilton-GV/Hertz/PayPal are
   OTHER companies' spinoffs that cite Yum; Yum had coincidental revenue dips)
 - Apple/Coca-Cola: confirmed 2 each, ALL false (iPhone dip / cyclical dips
   coincidentally "confirmed" unrelated spinoffs)
 - Honeywell: confirmed only Resideo, MISSED Garrett+AdvanSix (under-caught).
A parent dips for many reasons + many companies mention big parents -> the two noisy
signals don't combine to precision. Wiring it would false-tag Apple/Coke/Yum with
spinoffs they never did (2-forward-3-back), so per research-integrity it is NOT wired.
PRECISE detection requires PARSING the 10-12B document text (a real spinoff names the
parent in the cover/intro: "...distribution to shareholders of Honeywell..."), a
heavier fetch+parse build -- left as the decision point.
"""
import sys, os
import json
import urllib.request
import urllib.parse
import time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))

_CAND_CACHE = {}


def _efts(name, retries=3):
    q = urllib.parse.quote('"%s"' % name)
    url = "https://efts.sec.gov/LATEST/search-index?q=%s&forms=10-12B" % q
    for k in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except Exception:
            time.sleep(1.0 + k)
    return {}


def candidate_children(parent_name):
    """{(year,q): earliest 10-12B date} per unique child filer mentioning the parent."""
    if parent_name in _CAND_CACHE:
        return _CAND_CACHE[parent_name]
    by_child = {}
    d = _efts(parent_name)
    for h in d.get("hits", {}).get("hits", []):
        s = h.get("_source", {})
        date = s.get("file_date")
        if not date:
            continue
        child = (s.get("display_names") or ["?"])[0].split("(")[0].strip()
        if child not in by_child or date < by_child[child]:
            by_child[child] = date
    _CAND_CACHE[parent_name] = by_child
    return by_child


def confirmed_spinoff_quarters(parent_name, rev_dict, drop=0.06, window=5):
    """keep candidates where the PARENT's revenue drops >drop YoY within `window`
    quarters AFTER the 10-12B (the spinoff completes after registration)."""
    out = {}
    for child, date in candidate_children(parent_name).items():
        cq = (int(date[:4]), (int(date[5:7]) - 1) // 3 + 1)
        # parent revenue YoY drop in [cq, cq+window]?
        confirmed = False
        for k in range(0, window + 1):
            tot = cq[0] * 4 + (cq[1] - 1) + k
            q = (tot // 4, tot % 4 + 1)
            qp = (q[0] - 1, q[1])
            if q in rev_dict and qp in rev_dict and rev_dict[qp] > 0:
                if (rev_dict[q] - rev_dict[qp]) / rev_dict[qp] < -drop:
                    confirmed = True
                    break
        if confirmed:
            out[cq] = child
    return out


if __name__ == "__main__":
    import limen_backtest as lb
    import phase_signals as ps
    # precision test: real spinoff parents vs non-spinoff
    TESTS = [("Honeywell International", "0000773840"), ("Yum! Brands", "0001041061"),
             ("Apple Inc", "0000320193"), ("Coca-Cola Company", "0000021344")]
    for name, cik in TESTS:
        rev = ps._rev_dict(lb.fetch_sec_facts(cik))
        cand = candidate_children(name)
        conf = confirmed_spinoff_quarters(name, rev)
        print("\n%s" % name)
        print("  candidates (%d): %s" % (len(cand), list(cand.keys())[:6]))
        print("  CONFIRMED (%d): %s" % (len(conf), {"%dQ%d" % q: c for q, c in conf.items()}))
        time.sleep(1.0)
