#!/usr/bin/env python3
"""
litigation.py — contingent-liability / legal-overhang signal for the failure
class the solvency, liquidity, and trajectory signals all miss: companies
bankrupted by LITIGATION (Endo, Mallinckrodt — opioid) that present solvent
balance sheets and flat revenue, with the liability buried in loss-contingency
footnotes until it crystallizes.

Self-normalizing (the Amazon!=Burger King principle): J&J carries billions in
talc/opioid liability too, but as a $400B company the ratio is tiny. Endo is
small -> the ratio is huge. So the signal is contingency burden RELATIVE to the
company's own size/equity, point-in-time (filed<=cutoff).

XBRL loss-contingency tags (footnote-level):
  LossContingencyAccrualAtCarryingValue   — booked reserve
  LossContingencyEstimateOfPossibleLoss   — estimated possible loss
  LossContingencyDamagesSoughtValue       — damages sought against the company
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import altman  # noqa: E402

LC_TAGS = [
    "LossContingencyAccrualAtCarryingValue",
    "LossContingencyEstimateOfPossibleLoss",
    "LossContingencyDamagesSoughtValue",
    "LossContingencyAccrualPayments",
]


def _max_contingency(facts, cutoff):
    """Largest disclosed loss-contingency value (any tag, any member) filed<=cutoff."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    best = 0.0
    found = False
    for tag in LC_TAGS:
        node = gaap.get(tag)
        if not node:
            continue
        units = node.get("units", {})
        arr = units.get("USD") or (list(units.values())[0] if units else [])
        for e in arr:
            end, filed, val = e.get("end"), e.get("filed"), e.get("val")
            if val is None or not end:
                continue
            if cutoff and end > cutoff:
                continue
            if cutoff and filed and filed > cutoff:
                continue
            found = True
            if abs(val) > best:
                best = abs(val)
    return (best if found else None)


def litigation_burden(facts, cutoff=None):
    """contingency / total assets  and  contingency / |equity|, point-in-time."""
    cont = _max_contingency(facts, cutoff)
    TA = altman._latest(facts, ["Assets"], "instant", cutoff)
    EQ = altman._latest(facts, ["StockholdersEquity"], "instant", cutoff)
    burden_ta = (cont / TA) if (cont and TA and TA > 0) else None
    burden_eq = (cont / abs(EQ)) if (cont and EQ and EQ != 0) else None
    return {"contingency": cont, "assets": TA, "equity": EQ,
            "burden_ta": round(burden_ta, 2) if burden_ta else None,
            "burden_eq": round(burden_eq, 2) if burden_eq else None}


if __name__ == "__main__":
    import limen_backtest as lb
    import time
    cases = [
        ("ENDP", "0001593034", "2022-08-16", "OPIOID-LITIGATION fail"),
        ("MNK",  "0001567892", "2020-10-12", "OPIOID-LITIGATION fail"),
        ("JNJ",  "0000200406", None, "huge litigation but $400B (control)"),
        ("PFE",  "0000078003", None, "litigation, large (control)"),
        ("BMY",  "0000014272", None, "litigation, large (control)"),
        ("BBBY", "0000886158", "2023-04-23", "operational fail (no litigation)"),
        ("AAPL", "0000320193", None, "healthy"),
        ("CHK",  "0000895126", "2020-06-28", "solvency fail (no litigation)"),
    ]
    print("%-6s %-26s %-12s %-9s %-9s" % ("TICK", "TYPE", "contingency$B", "/assets", "/|equity|"))
    for (t, cik, ev, note) in cases:
        facts = lb.fetch_sec_facts(cik)
        r = litigation_burden(facts, ev)
        cb = ("%.1f" % (r["contingency"] / 1e9)) if r["contingency"] else "None"
        print("%-6s %-26s %-12s %-9s %-9s" % (t, note, cb, str(r["burden_ta"]), str(r["burden_eq"])))
        time.sleep(0.25)
