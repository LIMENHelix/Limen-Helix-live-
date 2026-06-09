#!/usr/bin/env python3
"""
altman.py — Balance-sheet ratio distress model (Altman Z'') as a benchmark
against the LIMEN trajectory kernel.

Z'' (Altman's non-manufacturing / emerging-market variant) needs only
accounting data (no market cap), so it runs on the same SEC facts the kernel
already fetches:

    Z'' = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
      X1 = working capital / total assets   (liquidity)
      X2 = retained earnings / total assets (cumulative profitability / deficit)
      X3 = EBIT / total assets              (current profitability)
      X4 = book equity / total liabilities  (leverage / solvency)

Zones:  Z'' > 2.6 safe · 1.1–2.6 grey · < 1.1 distress.

This reads MORE XBRL tags than the kernel (Assets, Liabilities, equity,
retained earnings, EBIT) — the ratio features the kernel lacks. Read-only;
imports the kernel's fetch only.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb  # noqa: E402

# concept -> candidate XBRL tags (first that resolves wins); kind: instant|duration
CONCEPTS = {
    "Assets":        (["Assets"], "instant"),
    "AssetsCurrent": (["AssetsCurrent"], "instant"),
    "LiabCurrent":   (["LiabilitiesCurrent"], "instant"),
    "Liabilities":   (["Liabilities"], "instant"),
    "Equity":        (["StockholdersEquity",
                       "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "instant"),
    "RetainedEarn":  (["RetainedEarningsAccumulatedDeficit"], "instant"),
    "EBIT":          (["OperatingIncomeLoss",
                       "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
                       "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"], "duration"),
}


def _date_le(d, cutoff):
    return cutoff is None or (d is not None and d <= cutoff)


def _latest(facts, tags, kind, cutoff):
    """Point-in-time latest USD value for any of `tags`, using ONLY data that
    was publicly FILED on or before `cutoff` (no lookahead, no post-event
    restatements). Among eligible points, take the latest period-end, then the
    latest filing date (the most recent view available as of the cutoff)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    best = None  # (end, filed, val)
    for tag in tags:
        node = gaap.get(tag)
        if not node:
            continue
        units = node.get("units", {})
        arr = units.get("USD") or next(iter(units.values()), [])
        for e in arr:
            end = e.get("end")
            filed = e.get("filed")
            if not _date_le(end, cutoff):
                continue                      # period must be in the past
            if cutoff and filed and filed > cutoff:
                continue                      # not yet public as of cutoff — avoid lookahead
            key = (end or "", filed or "")
            if best is None or key > (best[0], best[1]):
                best = (end or "", filed or "", e.get("val"))
        if best is not None:
            break
    return best[2] if best else None


def z_from_facts(facts, event_str=None):
    """Compute Z'' from an already-fetched companyfacts object (lets callers
    evaluate Z'' at many cutoff dates without re-fetching)."""
    if not facts:
        return {"error": "no_facts"}
    v = {k: _latest(facts, tags, kind, event_str) for k, (tags, kind) in CONCEPTS.items()}
    TA = v["Assets"]
    if not TA or TA == 0:
        return {"error": "no_assets", "raw": v}
    AC = v["AssetsCurrent"] or 0
    LC = v["LiabCurrent"] or 0
    TL = v["Liabilities"]
    if TL is None and v["Equity"] is not None:
        TL = TA - v["Equity"]            # fallback: liabilities = assets - equity
    TL = TL or (TA - (v["Equity"] or 0))
    EQ = v["Equity"] if v["Equity"] is not None else (TA - (TL or 0))
    RE = v["RetainedEarn"] or 0
    EBIT = v["EBIT"] or 0

    X1 = (AC - LC) / TA
    X2 = RE / TA
    X3 = EBIT / TA
    X4 = (EQ / TL) if TL and TL != 0 else 0.0
    Z = 3.25 + 6.56 * X1 + 3.26 * X2 + 6.72 * X3 + 1.05 * X4
    zone = "safe" if Z > 2.6 else ("distress" if Z < 1.1 else "grey")
    return {"Z": round(Z, 2), "zone": zone, "entity": facts.get("entityName", ""),
            "X1": round(X1, 3), "X2": round(X2, 3), "X3": round(X3, 3), "X4": round(X4, 3),
            "as_of": event_str or "current"}


def altman_z2(cik, event_str=None):
    facts = lb.fetch_sec_facts(cik)
    if not facts:
        return {"error": "no_facts"}
    return z_from_facts(facts, event_str)


if __name__ == "__main__":
    import time
    sys.path.insert(0, os.path.dirname(__file__))
    from validate_kernel import COHORT, resolve_ciks
    from validate_holdout import HOLDOUT
    full = resolve_ciks(COHORT) + resolve_ciks(HOLDOUT)
    rows = []
    print("%-7s %-6s %-7s %-9s %-7s %-7s %-7s %-7s %s" % ("TICK", "LABEL", "Z''", "ZONE", "X1_liq", "X2_RE", "X3_EBIT", "X4_lev", "ENTITY"))
    for (t, cik, label, note, event) in full:
        if not cik:
            continue
        try:
            r = altman_z2(cik, event)
        except Exception as e:
            print("%-7s ERR %s" % (t, str(e)[:40])); continue
        if r.get("error"):
            print("%-7s %-6d %s" % (t, label, r["error"])); continue
        # threshold: distress if Z'' < 1.1
        pred = 1 if r["Z"] < 1.1 else 0
        rows.append({"t": t, "label": label, "pred": pred, "Z": r["Z"], "note": note})
        flag = "OK" if pred == label else "MISS"
        print("%-7s %-6d %-7s %-9s %-7s %-7s %-7s %-7s %-18s %s" % (
            t, label, r["Z"], r["zone"], r["X1"], r["X2"], r["X3"], r["X4"], (r["entity"] or "")[:18], flag))
        time.sleep(0.25)

    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    prec = tp / (tp + fp) if (tp + fp) else 0
    rec = tp / (tp + fn) if (tp + fn) else 0
    fpr = fp / (fp + tn) if (fp + tn) else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0
    print("\n=== Altman Z'' on FULL cohort (in-sample + holdout, n=%d) ===" % len(rows))
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, prec, rec, fpr, f1))
    print("\n  distress mean Z'': %.2f | healthy mean Z'': %.2f" % (
        (sum(r["Z"] for r in rows if r["label"] == 1) / max(1, sum(1 for r in rows if r["label"] == 1))),
        (sum(r["Z"] for r in rows if r["label"] == 0) / max(1, sum(1 for r in rows if r["label"] == 0)))))
