#!/usr/bin/env python3
"""
fusion.py — The fused kernel: balance-sheet solvency anchor (Altman Z'') +
phase-trajectory lead-time derivative.

Decision at a cutoff date:
  CONFIRMED  if Z'' < Z_DISTRESS                         (insolvent now — accuracy)
  EARLY      if trajectory elevated AND solvency eroding (lead time, noise-gated)
               where "eroding" = Z'' below safe OR Z'' falling vs a year earlier
  CLEAR      otherwise

The solvency-erosion gate is what filters the trajectory's false alarms: healthy
companies (Kroger, Chevron) keep a high, flat Z'', so their trajectory noise is
ignored; pre-bankruptcy companies have a falling Z'', so their early trajectory
signal is kept.

Measures BOTH accuracy (precision/recall/FPR at event/current) and lead time.
New file; locked kernel untouched.
"""
import sys, os, time
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb       # noqa: E402
import altman                     # noqa: E402
from validate_v3 import build_df  # noqa: E402
from validate_kernel import COHORT, resolve_ciks  # noqa: E402
from validate_holdout import HOLDOUT  # noqa: E402

Z_DISTRESS = 1.1     # insolvency threshold
Z_SAFE = 2.6         # above this = clearly solvent
Z_DROP_1Y = 1.0      # Z'' falling more than this per year = eroding
TRAJ_THRESH = 1.1    # LIMEN composite alert level


def _shift(date_str, years):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.replace(year=d.year - years).strftime("%Y-%m-%d")


def _comp(df, cutoff):
    if df is None:
        return 0.0
    try:
        c, _, _ = lb.compute_composite_score(df, cutoff, lb.HOLDOUT_P3_ENTRY)
        return float(c)
    except Exception:
        return 0.0


def decide(facts, df, cutoff):
    """Return (label_pred, tier, z, comp) at a cutoff date."""
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    zprev = altman.z_from_facts(facts, _shift(cutoff, 1)) if cutoff else None
    zprev = None if (not zprev or zprev.get("error")) else zprev["Z"]
    comp = _comp(df, cutoff)

    if zval is not None and zval < Z_DISTRESS:
        return 1, "confirmed", zval, comp
    eroding = (zval is not None and zval < Z_SAFE) or \
              (zval is not None and zprev is not None and zval < zprev - Z_DROP_1Y)
    if comp >= TRAJ_THRESH and eroding:
        return 1, "early", zval, comp
    return 0, "clear", zval, comp


def main():
    full = [("in", r) for r in resolve_ciks(COHORT)] + [("out", r) for r in resolve_ciks(HOLDOUT)]
    rows = []
    print("Scoring fused kernel on full cohort...\n")
    for src, (t, cik, label, note, event) in full:
        if not cik:
            continue
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            continue
        df = build_df(cik)
        cutoff = event  # distress scored at event; healthy at current (event=None)
        pred, tier, z, comp = decide(facts, df, cutoff)
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier, "z": z, "comp": comp, "note": note})
        time.sleep(0.3)

    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    prec = tp / (tp + fp) if (tp + fp) else 0
    rec = tp / (tp + fn) if (tp + fn) else 0
    fpr = fp / (fp + tn) if (fp + tn) else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0
    print("=== FUSED KERNEL — accuracy on full cohort (n=%d) ===" % len(rows))
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, prec, rec, fpr, f1))
    print("  vs Altman-alone (prec 1.00 rec 0.83) and trajectory-alone out-of-sample (rec 0.00)")
    print("\n  FALSE POSITIVES:")
    for r in rows:
        if r["label"] == 0 and r["pred"] == 1:
            print("    %-7s tier=%s z=%s comp=%.2f — %s" % (r["t"], r["tier"], r["z"], r["comp"], r["note"]))
    print("  FALSE NEGATIVES:")
    for r in rows:
        if r["label"] == 1 and r["pred"] == 0:
            print("    %-7s z=%s comp=%.2f — %s" % (r["t"], r["z"], r["comp"], r["note"]))

    # ── lead time of the fused signal vs Altman-alone ──
    CASES = [("CHK", "0000895126", "2020-06-28"), ("BBBY", "0000886158", "2023-04-23"),
             ("WE", "0001813756", "2023-11-06"), ("JCP", "0001166126", "2020-05-15"),
             ("DNR", "0000945764", "2020-07-30"), ("REV", "0000887921", "2022-06-15"),
             ("ENDP", "0001593034", "2022-08-16"), ("AVYA", "0001418100", "2023-02-14"),
             ("PRTY", "0001592058", "2023-01-17"), ("RAD", "0000084129", "2023-10-15")]
    print("\n=== LEAD TIME (years before bankruptcy each first flags) ===")
    print("  %-6s %-8s %-8s %-8s" % ("TICK", "FUSED", "Altman", "tier@earliest"))
    fused_leads, alt_leads = [], []
    for (t, cik, ev) in CASES:
        facts = lb.fetch_sec_facts(cik)
        df = build_df(cik)
        fused_lead, alt_lead, tier_at = -1, -1, "-"
        for yrs in [3, 2, 1, 0]:
            cut = ev if yrs == 0 else _shift(ev, yrs)
            pred, tier, z, comp = decide(facts, df, cut)
            if pred == 1 and fused_lead < yrs:
                fused_lead = yrs; tier_at = tier
            if z is not None and z < Z_DISTRESS and alt_lead < yrs:
                alt_lead = yrs
        fused_leads.append(fused_lead); alt_leads.append(alt_lead)
        print("  %-6s %-8s %-8s %-8s" % (t, "%dy" % fused_lead if fused_lead >= 0 else "miss",
                                          "%dy" % alt_lead if alt_lead >= 0 else "miss", tier_at))
        time.sleep(0.2)
    av = lambda x: sum(v for v in x if v >= 0) / max(1, len([v for v in x if v >= 0]))
    print("\n  Avg lead — FUSED %.1fy   vs Altman-alone %.1fy" % (av(fused_leads), av(alt_leads)))


if __name__ == "__main__":
    main()
