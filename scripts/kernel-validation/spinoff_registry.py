#!/usr/bin/env python3
"""
SPINOFF REGISTRY (precise, doc-parse). Catches pro-rata spinoffs that 8-K Item 2.01
misses (HON Garrett/Resideo, YUM Yum China). The spun CHILD files a Form 10-12B whose
INFORMATION STATEMENT names the parent throughout. EFTS full-text search finds
candidates; CONFIRM by parsing the matched document and counting WORD-BOUNDARY parent
mentions -- a real spinoff's doc names the parent 27-84x; a mere mention (Kontoor
citing Yum, Motorola citing Apple) is 0. Threshold cleanly separates them.

(The earlier full-text + revenue-drop confirmation FAILED precision -- documented in
git history. This doc-parse version is the precise one.)
"""
import sys, os
import json
import re
import urllib.request
import urllib.parse
import time
sys.path.insert(0, os.path.dirname(__file__))

_REG_CACHE = {}


def _efts(name, pages=5):
    """paginate EFTS (10 hits/page) so all spinoff children are captured, not just
    the top 10."""
    q = urllib.parse.quote('"%s"' % name)
    hits = []
    for p in range(pages):
        url = "https://efts.sec.gov/LATEST/search-index?q=%s&forms=10-12B&from=%d" % (q, p * 10)
        got = None
        for k in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    got = json.load(r)
                break
            except Exception:
                time.sleep(1.0 + k)
        page_hits = (got or {}).get("hits", {}).get("hits", [])
        if not page_hits:
            break
        hits.extend(page_hits)
        time.sleep(0.3)
    return {"hits": {"hits": hits}}


def _doc_parent_count(cik, adsh, fn, token, window=20000):
    url = "https://www.sec.gov/Archives/edgar/data/%s/%s/%s" % (int(cik), adsh.replace("-", ""), fn)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
        with urllib.request.urlopen(req, timeout=25) as r:
            html = r.read().decode("utf-8", "ignore")
        txt = re.sub("<[^>]+>", " ", html)
        return len(re.findall(r"\b" + re.escape(token) + r"\b", txt[:window], re.I))
    except Exception:
        return -1


def confirmed_spinoffs(parent_name, token, min_count=12, max_children=30):
    """{(year,q): child} for children whose 10-12B names the parent >= min_count times."""
    key = (parent_name, token)
    if key in _REG_CACHE:
        return _REG_CACHE[key]
    out = {}
    d = _efts(token)     # search the distinctive token (broad); doc-count filter is precise
    children = {}     # nm -> list of (date, cik, adsh, fn) in EFTS RELEVANCE order
    for h in d.get("hits", {}).get("hits", []):
        s = h.get("_source", {})
        nm = (s.get("display_names") or ["?"])[0].split("(")[0].strip()
        date = s.get("file_date")
        if not date or not s.get("ciks"):
            continue
        children.setdefault(nm, []).append((date, s["ciks"][0], s.get("adsh"), h["_id"].split(":")[-1]))
    for nm, hlist in list(children.items())[:max_children]:
        date0, cik0, adsh0, fn0 = hlist[0]          # MOST RELEVANT hit = the info statement
        if _doc_parent_count(cik0, adsh0, fn0, token) >= min_count:
            earliest = min(h[0] for h in hlist)      # earliest filing date = spinoff timing
            out[(int(earliest[:4]), (int(earliest[5:7]) - 1) // 3 + 1)] = nm
        time.sleep(0.2)
    _REG_CACHE[key] = out
    return out


if __name__ == "__main__":
    # precision test: real spinoff parents vs non-spinoff
    TESTS = [("Honeywell International", "Honeywell"), ("Yum! Brands", "Yum"),
             ("Apple Inc", "Apple"), ("Coca-Cola Company", "Coca-Cola"),
             ("General Electric", "General Electric")]
    for name, tok in TESTS:
        conf = confirmed_spinoffs(name, tok)
        print("%-26s CONFIRMED %d: %s" % (name, len(conf), {"%dQ%d" % q: c[:22] for q, c in conf.items()}))
        time.sleep(1.0)
