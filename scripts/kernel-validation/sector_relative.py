#!/usr/bin/env python3
"""
SECTOR layer (step 2): peer-relative line signals via SIC grouping + financials
excluded. The confirmed missing variable is the EXOGENOUS sector/macro component;
subtract the sector median per line so only the IDIOSYNCRATIC (own-phase) signal
remains.

Builds a universe with real sector coverage (>=4 per SIC major group), buckets by
SIC, excludes financials (fca_gate), computes the sector median per line, and shows
each company's RAW vs SECTOR-RELATIVE growth and margin. Demonstrates where
peer-relative flips the read (a company growing with its sector is not a P6 star;
a company compressing margin with its sector is not fracturing).
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps             # noqa: E402
import fca_gate                         # noqa: E402

UNIVERSE = [
    # software (73)
    ("MSFT", "0000789019"), ("ORCL", "0001341439"), ("CRM", "0001108524"),
    ("ADBE", "0000796343"), ("NOW", "0001373715"),
    # semis (36)
    ("NVDA", "0001045810"), ("INTC", "0000050863"), ("AMD", "0000002488"),
    ("TXN", "0000097476"), ("QCOM", "0000804328"), ("AVGO", "0001730168"),
    # retail (53-59)
    ("WMT", "0000104169"), ("TGT", "0000027419"), ("COST", "0000909832"),
    ("HD", "0000354950"), ("LOW", "0000060667"), ("DG", "0000029534"),
    # food/staples (20)
    ("KO", "0000021344"), ("PEP", "0000077476"), ("GIS", "0000040704"),
    ("K", "0000055067"), ("CAG", "0000023217"), ("KHC", "0001637459"),
    # pharma (28)
    ("JNJ", "0000200406"), ("PFE", "0000078003"), ("MRK", "0000310158"),
    ("ABBV", "0001551152"), ("LLY", "0000059478"), ("BMY", "0000014272"),
    # autos (37)
    ("F", "0000037996"), ("GM", "0001467858"), ("TSLA", "0001318605"),
    ("RIVN", "0001874178"), ("LCID", "0001811210"),
    # energy (13/29)
    ("XOM", "0000034088"), ("CVX", "0000093410"), ("COP", "0001163165"),
    ("OXY", "0000797468"), ("KMI", "0001506307"),
    # industrials (35)
    ("CAT", "0000018230"), ("DE", "0000315189"), ("MMM", "0000066740"),
    ("HON", "0000773840"), ("EMR", "0000032604"),
    # telecom (48)
    ("T", "0000732717"), ("VZ", "0000732712"), ("TMUS", "0001283699"),
    # financials -> EXCLUDE (test the gate)
    ("JPM", "0000019617"), ("BAC", "0000070858"), ("GS", "0000886982"),
]


def line_signals(facts):
    rev = ps.rev_series(facts, n=20)
    if not rev or len(rev) < 12:
        return None
    growth, _ = ps.growth_cv(rev)
    gm = ps.margin_series(facts, n=20)
    md = None
    if gm and len(gm) >= 12:
        h = len(gm) // 2
        md = float(np.mean(gm[h:]) - np.mean(gm[:h]))
    return {"growth": growth, "margin_delta": md}


def main():
    import time
    rows = []
    excluded = []
    for (t, cik) in UNIVERSE:
        sc, sic, lab = fca_gate.scope(cik)
        if sc == "exclude":
            excluded.append((t, sic))
            continue
        facts = lb.fetch_sec_facts(cik)
        sig = line_signals(facts)
        if sig is None:
            continue
        rows.append({"t": t, "sic": sic, "sector": (sic // 100) if sic else 0, **sig})
        time.sleep(0.15)

    # sector medians (only sectors with >=4 members)
    from collections import defaultdict
    by_sec = defaultdict(list)
    for r in rows:
        by_sec[r["sector"]].append(r)
    med = {}
    for s, members in by_sec.items():
        if len(members) >= 4:
            med[s] = {
                "growth": float(np.median([m["growth"] for m in members])),
                "margin_delta": float(np.median([m["margin_delta"] for m in members if m["margin_delta"] is not None]) or 0),
            }

    print("SECTOR-RELATIVE line signals (financials excluded: %s)\n" % ", ".join("%s/%s" % e for e in excluded))
    print("%-6s %-4s %-8s %-9s %-9s %-9s %s" % (
        "TICK", "SIC2", "growth", "secG", "relG", "relMargin", "read"))
    for r in sorted(rows, key=lambda x: x["sector"]):
        s = r["sector"]
        if s not in med:
            continue
        relG = r["growth"] - med[s]["growth"]
        relM = (r["margin_delta"] - med[s]["margin_delta"]) if r["margin_delta"] is not None else None
        # peer-relative read: strong/weak vs sector, idiosyncratic margin fracture
        read = []
        if relG > 0.04:
            read.append("OUTGROW-sector")
        elif relG < -0.04:
            read.append("LAG-sector")
        if relM is not None and relM < -0.03:
            read.append("idiosyncratic-margin-fracture")
        print("%-6s %-4d %-+8.0f%% %-+9.0f%% %-+9.0f%% %-9s %s" % (
            r["t"], s, r["growth"] * 100, med[s]["growth"] * 100, relG * 100,
            ("%+.0f%%" % (relM * 100)) if relM is not None else "n/a", ", ".join(read) or "in-line"))
    print("\n  sectors with peer median (>=4): %s" % sorted(med.keys()))
    print("  peer-relative subtracts the sector/macro component -> only idiosyncratic phase remains.")


if __name__ == "__main__":
    main()
