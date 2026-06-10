#!/usr/bin/env python3
"""
PROVE P1 — First Distinction / symmetry breaking (book verbiage only).

Book I: P1 = the FIRST DISTINCTION. "A previously uniform condition" becomes
unstable and "selects a localized state, resulting in broken symmetry and emergent
structure"; "a single stable state becomes unstable and branches into multiple
outcomes" (bifurcation); "A != A across conditions." Translated to business in
those terms: SYMMETRY BREAKING IN THE ENTITY'S STRUCTURE — a previously uniform
structural configuration becomes unstable and BRANCHES into a new configuration.

Detectable financial form of "a stable state branches into multiple outcomes" =
a DISCONTINUITY in ownership / share structure (the structure was uniform, then
branches): reverse merger / de-SPAC, major recapitalization, control change.

NOTES carried forward (operator):
 - TRIGGER LOCUS: Book says the First Distinction is INTERNAL ("not from external
   force"). In BUSINESS the structural branch is usually EXTERNALLY triggered.
   First substrate divergence on mechanism — flag, do not resolve here.
 - The structural branch is an EVENT; the cleanest signal is the 8-K / news, which
   investors DO track in feeds. Financials show the structural footprint
   (share-structure discontinuity), often lagged.
 - Where an entity's series BEGINS already-differentiated (a spun entity), the
   symmetry breaking occurred in the PARENT's structure, not the child's — detect
   it in the parent (a branching/reduction), not the spun entity.

Test: does a share-structure discontinuity tag entities whose structure underwent
symmetry breaking, and stay silent on uniform (continuous) structures?
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402

SHARE_TAGS = [("dei", "EntityCommonStockSharesOutstanding"),
              ("us-gaap", "CommonStockSharesOutstanding"),
              ("us-gaap", "CommonStockSharesIssued")]


def _series(facts, tag_list, unit, cutoff=None):
    for ns, tag in tag_list:
        node = (facts or {}).get("facts", {}).get(ns, {}).get(tag)
        if not node:
            continue
        arr = node.get("units", {}).get(unit) or []
        by_end = {}
        for e in arr:
            end, val, filed = e.get("end"), e.get("val"), e.get("filed")
            if not end or val is None:
                continue
            if cutoff and end > cutoff:
                continue
            if end not in by_end or (filed and filed > by_end[end][0]):
                by_end[end] = (filed, val)
        if len(by_end) >= 3:
            return sorted((end, v) for end, (f, v) in by_end.items())
    return []


def _max_disc(series, window):
    if len(series) < 4:
        return None
    vals = [v for _, v in series][-window:]
    chg = [abs(vals[i] - vals[i - 1]) / abs(vals[i - 1]) for i in range(1, len(vals)) if abs(vals[i - 1]) > 1e6]
    return max(chg) if chg else 0.0


EQUITY_TAGS = [("us-gaap", "StockholdersEquity"),
               ("us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest")]


def branch_signals(facts, cutoff=None, window=24):
    """Symmetry breaking = the structure branches: share-structure discontinuity
    that COINCIDES with an equity discontinuity (a stock split moves shares but
    NOT equity, so it is excluded)."""
    d_share = _max_disc(_series(facts, SHARE_TAGS, "shares", cutoff), window)
    d_eq = _max_disc(_series(facts, EQUITY_TAGS, "USD", cutoff), window)
    return d_share, d_eq


P1_THRESH = 0.50   # >50% single-step change in shares = the structure branches (symmetry breaking)
WINDOW = 24        # quarters; wide enough to hold the prior uniform state + the structural branch

PANEL = [
    # SYMMETRY BREAKING in the entity's OWN structure (P1) — structure branches
    ("NKLA", "0001731289", None, "symmetry_break"),   # VectoIQ -> Nikola (reverse merger)
    ("SPCE", "0001706946", None, "symmetry_break"),   # Social Capital -> Virgin Galactic
    ("QS",   "0001811414", None, "symmetry_break"),   # Kensington -> QuantumScape
    ("FSR",  "0001720990", None, "symmetry_break"),   # Spartan -> Fisker
    ("DKNG", "0001883685", None, "symmetry_break"),   # Diamond Eagle -> DraftKings
    # SPUN CHILD — symmetry breaking is in the PARENT; child begins already-differentiated.
    # Expected: NO branch in the child's own series (book-faithful, not a miss).
    ("OGN",  "0001821825", None, "spun_child"),       # Organon (from Merck)
    # UNIFORM (continuous) structure — not P1
    ("KO",   "0000021344", None, "uniform"),
    ("WMT",  "0000104169", None, "uniform"),
    ("AAPL", "0000320193", None, "uniform"),
    ("JNJ",  "0000200406", None, "uniform"),
    ("PG",   "0000080424", None, "uniform"),
]


def main():
    import time
    rows = []
    print("PROVE P1 — share+equity discontinuity = SYMMETRY BREAKING (structure branches, not a split)?\n")
    print("%-6s %-15s %-10s %-10s %-8s %s" % ("TICK", "expected", "dShares", "dEquity", "P1_det", ""))
    for (t, cik, cut, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        d_share, d_eq = branch_signals(facts, cut, WINDOW)
        if d_share is None:
            rows.append({"t": t, "exp": exp, "p1": None, "ok": None})
            print("%-6s %-15s no structural data" % (t, exp)); continue
        # P1 = BOTH branch together (split moves shares only -> excluded)
        p1 = (d_share > P1_THRESH) and (d_eq is not None and d_eq > P1_THRESH)
        should_fire = exp == "symmetry_break"
        ok = (p1 == should_fire)
        rows.append({"t": t, "exp": exp, "p1": p1, "ok": ok})
        print("%-6s %-15s %-+10.0f%% %-+10s %-8s %s" % (
            t, exp, d_share * 100, ("%+.0f%%" % (d_eq * 100)) if d_eq is not None else "n/a",
            "FIRE" if p1 else " . ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P1 proof: share-structure discontinuity == symmetry breaking (structure branches)? ===")
    print("  agreement %d/%d = %.2f (scored cases only)" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  fired on uniform/spun (false P1):", [r["t"] for r in scored if r["p1"] and r["exp"] != "symmetry_break"])
    print("  missed a structural branch:", [r["t"] for r in scored if not r["p1"] and r["exp"] == "symmetry_break"])
    print("  no structural data:", [r["t"] for r in rows if r["ok"] is None])
    print("\n  NOTE: trigger is EXTERNAL in business (book says the First Distinction is internal) — substrate divergence.")
    print("  NOTE: the structural branch is an EVENT — cleanest signal is 8-K/news (investors track in feeds);")
    print("        financials show the structural footprint, lagged. Spun children: detect the branch in the PARENT.")


if __name__ == "__main__":
    main()
