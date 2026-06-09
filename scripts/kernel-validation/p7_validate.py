#!/usr/bin/env python3
"""
p7_validate.py — validate the P7 specialist kernel (the bifurcation/fork detector)
across the full bankruptcy cohort, with a clean checkable label: did the company
LIQUIDATE (7a, terminal absorbing state) or EMERGE/reorganize (7b, recursion
re-entry)?

This is one-kernel-per-phase in action: P7 is a dedicated specialist whose only
job is the 7a/7b bifurcation among companies that reached collapse. Book I (Ch.15
Divergence Fork): viability breach -> terminal entropy (7a); viable core ->
re-entry (7b). Financial hypothesis: a VIABLE CORE = the business still generates
operating cash to reorganize around. No core (burning, deeply insolvent) -> only
liquidation remains.

Tests the current rule (equity/assets + OCF) AND shows the raw features so the
best discriminator is evidence-driven, not assumed.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                         # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

# (ticker, cik, event, outcome)  outcome: 7a=liquidated, 7b=emerged/reorganized
# Labels are well-documented public outcomes; fuzzy/mixed cases excluded.
COHORT = [
    # --- 7a LIQUIDATED (terminal) ---
    ("SHLDQ", "0001310067", "2018-10-15", "7a"),   # Sears -> liquidated
    ("PIR",   "0000278130", "2020-02-17", "7a"),   # Pier 1 -> liquidated
    ("BBBY",  "0000886158", "2023-04-23", "7a"),   # Bed Bath -> liquidated
    ("YELL",  "0000716006", "2023-08-06", "7a"),   # Yellow -> liquidated
    ("CONN",  "0001223389", "2024-07-23", "7a"),   # Conn's -> liquidated
    ("LL",    "0001396033", "2024-08-11", "7a"),   # LL Flooring -> liquidated
    ("FSR",   "0001720990", "2024-06-17", "7a"),   # Fisker -> Ch7 liquidation
    ("BIG",   "0000768835", "2024-09-09", "7a"),   # Big Lots -> liquidated
    ("SPWR",  "0000867773", "2024-08-05", "7a"),   # SunPower -> asset sale/wind-down
    ("NVTA",  "0001501134", "2024-02-13", "7a"),   # Invitae -> asset sale/dissolved
    # --- 7b EMERGED (reorganized, continued going concern) ---
    ("CHK",   "0000895126", "2020-06-28", "7b"),   # Chesapeake -> emerged (Expand Energy)
    ("WLL",   "0001255474", "2020-04-01", "7b"),   # Whiting -> emerged
    ("DNR",   "0000945764", "2020-07-30", "7b"),   # Denbury -> emerged
    ("REV",   "0000887921", "2022-06-15", "7b"),   # Revlon -> emerged
    ("AVYA",  "0001418100", "2023-02-14", "7b"),   # Avaya -> emerged (prepackaged)
    ("RAD",   "0000084129", "2023-10-15", "7b"),   # Rite Aid -> emerged (smaller)
    ("CRC",   "0001609253", "2020-07-15", "7b"),   # California Resources -> emerged
    ("GTX",   "0001735707", "2020-09-20", "7b"),   # Garrett Motion -> emerged
    ("I",     "0001525773", "2020-05-13", "7b"),   # Intelsat -> emerged
    ("HTZ",   "0001657853", "2020-05-22", "7b"),   # Hertz -> emerged (relisted)
    ("GNC",   "0001502034", "2020-06-23", "7b"),   # GNC -> emerged (sold, brand continued)
    ("SAVE",  "0001498710", "2024-11-18", "7b"),   # Spirit -> emerged 2025
    ("TWOU",  "0001459417", "2024-07-25", "7b"),   # 2U -> emerged (debt restructure)
]


def features(facts, cutoff):
    TA = altman._latest(facts, ["Assets"], "instant", cutoff)
    EQ = altman._latest(facts, ["StockholdersEquity"], "instant", cutoff)
    ocf_series = [v for _, v in sorted(extract_pit(facts, lb.TAG_MAP["OCF"], True, cutoff).items())]
    ocf = sum(ocf_series[-4:]) if ocf_series else None
    if TA is None or TA == 0:
        return None
    eq_ta = (EQ / TA) if EQ is not None else None
    ocf_ta = (ocf / TA) if ocf is not None else None
    return {"eq_ta": eq_ta, "ocf": ocf, "ocf_ta": ocf_ta, "TA": TA}


def predict_fork(f, ocf_ta_thresh=0.0):
    """Viable core = positive operating cash to reorganize around -> 7b.
    No core (burning) -> 7a. (OCF-based, the evidence-driven discriminator.)"""
    if f is None or f.get("ocf_ta") is None:
        return "?"
    return "7b" if f["ocf_ta"] > ocf_ta_thresh else "7a"


def main():
    import time
    rows = []
    print("P7 FORK KERNEL validation — liquidate (7a) vs emerge (7b)\n")
    print("%-6s %-5s %-8s %-9s %-9s %-6s %s" % ("TICK", "true", "eq/ta", "ocf$M", "ocf/ta", "pred", ""))
    for (t, cik, ev, true) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        f = features(facts, ev)
        if f is None or f.get("ocf_ta") is None:
            print("%-6s %-5s  insufficient" % (t, true)); continue
        pred = predict_fork(f)
        rows.append({"t": t, "true": true, "pred": pred, **f})
        mark = "OK" if pred == true else "MISS"
        print("%-6s %-5s %-8.2f %-9.0f %-9.3f %-6s %s" % (
            t, true, f["eq_ta"], (f["ocf"] or 0) / 1e6, f["ocf_ta"], pred, mark))
        time.sleep(0.2)

    # accuracy on current OCF-based rule
    ok = sum(1 for r in rows if r["pred"] == r["true"])
    print("\n=== current rule: 7b if OCF/assets > 0 (viable core) ===")
    print("  accuracy %d/%d = %.2f" % (ok, len(rows), ok / len(rows) if rows else 0))
    # confusion
    for true in ("7a", "7b"):
        sub = [r for r in rows if r["true"] == true]
        hit = sum(1 for r in sub if r["pred"] == true)
        print("  %s: %d/%d correct" % (true, hit, len(sub)))

    # evidence: mean features by outcome (is OCF/assets the separator?)
    for fld in ("eq_ta", "ocf_ta"):
        a = [r[fld] for r in rows if r["true"] == "7a"]
        b = [r[fld] for r in rows if r["true"] == "7b"]
        print("  mean %-7s — 7a %.3f | 7b %.3f" % (fld, np.mean(a), np.mean(b)))

    # threshold sweep on ocf/ta
    print("\n  OCF/assets threshold sweep:")
    for th in [-0.04, -0.02, 0.0, 0.02, 0.04]:
        acc = sum(1 for r in rows if predict_fork(r, th) == r["true"]) / len(rows)
        print("    thresh %+.2f -> acc %.2f" % (th, acc))


if __name__ == "__main__":
    main()
