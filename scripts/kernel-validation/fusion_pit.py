#!/usr/bin/env python3
"""
fusion_pit.py — The fully point-in-time fused kernel. BOTH signals clean:
  - Altman Z'' from filings-filed-<=-cutoff (no restatement lookahead)
  - LIMEN trajectory from as-originally-reported series (pit_trajectory.clean_df)

This is the honest, defensible number: does ratio-anchor + phase-trajectory
(gated by solvency erosion) beat ratios-alone when NEITHER signal can see the
future?
"""
import sys, os, time
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                         # noqa: E402  (clean Z'')
from pit_trajectory import clean_df, comp, shift  # noqa: E402  (clean trajectory)
from validate_kernel import COHORT, resolve_ciks  # noqa: E402
from validate_holdout import HOLDOUT  # noqa: E402

Z_DISTRESS, Z_SAFE, Z_DROP_1Y, TRAJ = 1.1, 2.6, 1.0, 1.1


def decide(facts, cutoff):
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    zp = altman.z_from_facts(facts, shift(cutoff, 1)) if cutoff else None
    zp = None if (not zp or zp.get("error")) else zp["Z"]
    c = comp(clean_df(facts, cutoff), cutoff) or 0.0
    if zval is not None and zval < Z_DISTRESS:
        return 1, "confirmed", zval, c
    eroding = (zval is not None and zval < Z_SAFE) or \
              (zval is not None and zp is not None and zval < zp - Z_DROP_1Y)
    if c >= TRAJ and eroding:
        return 1, "early", zval, c
    return 0, "clear", zval, c


def main():
    full = resolve_ciks(COHORT) + resolve_ciks(HOLDOUT)
    rows = []
    print("Fully point-in-time fused kernel (both signals clean), n=%d...\n" % len(full))
    for (t, cik, label, note, event) in full:
        if not cik:
            continue
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            continue
        pred, tier, z, c = decide(facts, event)
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier, "z": z, "c": c, "note": note})
        time.sleep(0.25)
    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    P = tp / (tp + fp) if (tp + fp) else 0
    R = tp / (tp + fn) if (tp + fn) else 0
    FPR = fp / (fp + tn) if (fp + tn) else 0
    F1 = 2 * P * R / (P + R) if (P + R) else 0
    # trajectory's marginal contribution
    early_tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1 and r["tier"] == "early")
    print("=== FULLY POINT-IN-TIME FUSED KERNEL (n=%d) ===" % len(rows))
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, P, R, FPR, F1))
    print("  of which trajectory ('early' tier) caught %d the ratio anchor would have missed" % early_tp)
    print("\n  vs Altman-alone point-in-time (precision 1.00 recall 0.44)")
    print("\n  FALSE POSITIVES:")
    for r in rows:
        if r["label"] == 0 and r["pred"] == 1:
            print("    %-7s tier=%s z=%s c=%.2f — %s" % (r["t"], r["tier"], r["z"], r["c"], r["note"]))
    print("  trajectory-rescued distress (would be missed by ratios alone):")
    for r in rows:
        if r["label"] == 1 and r["pred"] == 1 and r["tier"] == "early":
            print("    %-7s z=%s c=%.2f — %s" % (r["t"], r["z"], r["c"], r["note"]))


if __name__ == "__main__":
    main()
