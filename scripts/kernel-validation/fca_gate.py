#!/usr/bin/env python3
"""
fca_gate.py — scope-exclusion gate for FCA calibration. The kernel has NO validity
on financials (Altman doesn't transfer to deposit-funded / premium / investment
balance sheets). It must ABSTAIN on them, never flag — a distress claim on a bank
from a model that doesn't apply to banks is a miscalibrated claim.

SIC ranges:
  6000-6799  FINANCIALS (banks, S&Ls, insurers, real estate, investment) -> EXCLUDE
  4900-4999  regulated utilities -> REVIEW (capital-intensive; fuel pass-through
             looks like revenue volatility) -> not auto-claim
"""
import json, urllib.request

_SIC_CACHE = {}


def get_sic(cik):
    cik = str(cik).zfill(10)
    if cik in _SIC_CACHE:
        return _SIC_CACHE[cik]
    try:
        url = "https://data.sec.gov/submissions/CIK%s.json" % cik
        req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.load(r)
        sic = int(d.get("sic")) if d.get("sic") else None
    except Exception:
        sic = None
    _SIC_CACHE[cik] = sic
    return sic


def scope(cik):
    """Return ('exclude'|'review'|'in-scope'|'unknown', sic, label)."""
    sic = get_sic(cik)
    if sic is None:
        return "unknown", None, "unknown"
    if 6000 <= sic <= 6799:
        return "exclude", sic, "financial"
    if 4900 <= sic <= 4999:
        return "review", sic, "utility"
    return "in-scope", sic, "industrial/other"


if __name__ == "__main__":
    import time
    flagged = [("WFC", "0000072971"), ("BNY", "0001390777"), ("AFL", "0000004977"),
               ("PRU", "0001137774"), ("APO", "0001858681"), ("BAM", "0001001085"),
               ("ETR", "0000065984"), ("PEG", "0000788784"), ("PCG", "0001004980"),
               ("AEE", "0001002910"), ("BA", "0000012927"), ("GM", "0001467858"),
               ("RKT", "0001805521"), ("SATS", "0001832168"), ("VG", "0001272830")]
    print("%-6s %-9s %-8s %s" % ("TICK", "scope", "sic", "label"))
    for t, cik in flagged:
        s, sic, lab = scope(cik)
        print("%-6s %-9s %-8s %s" % (t, s, sic, lab))
        time.sleep(0.1)
