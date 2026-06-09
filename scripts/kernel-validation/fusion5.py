#!/usr/bin/env python3
"""
fusion5.py — FOUR-signal point-in-time fused kernel:
  1. SOLVENCY  (Altman Z'' < 1.1, market-equity veto)   — structural insolvency
  2. LITIGATION(contingency / assets > LIT_BURDEN)       — legal overhang
  3. LIQUIDITY (burning + runway<4q + current ratio<1.05)— near-term cash death
  4. TRAJECTORY(phase comp elevated + solvency eroding, market-veto'd) — masking

Run on the full design set (COHORT+HOLDOUT+EXPANDED) to measure the net effect
of adding the litigation tier: does it catch Endo without adding false positives?
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, liquidity, marketcap, litigation  # noqa: E402
from pit_trajectory import clean_df, comp, shift  # noqa: E402
from validate_kernel import COHORT, resolve_ciks  # noqa: E402
from validate_holdout import HOLDOUT  # noqa: E402
from fusion3 import Z_DISTRESS, Z_SAFE, Z_DROP, TRAJ, RUNWAY_Q, CR_MAX, SKIP  # frozen
from fusion3 import EXPANDED
from fusion4 import MVE_VETO

LIT_BURDEN = 0.20  # disclosed contingency > 20% of total assets = solvency-threatening overhang


def decide(ticker, facts, cutoff, dfc):
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    zp = altman.z_from_facts(facts, shift(cutoff, 1)) if cutoff else None
    zp = None if (not zp or zp.get("error")) else zp["Z"]
    liq = liquidity.liquidity(facts, cutoff)
    cr = liq.get("current_ratio")
    lit = litigation.litigation_burden(facts, cutoff)
    c = comp(dfc, cutoff) or 0.0

    def market_ok():  # True if market clearly says solvent (veto)
        _, ratio = marketcap.mve_to_liabilities(facts, ticker, cutoff)
        return ratio is not None and ratio > MVE_VETO

    if zval is not None and zval < Z_DISTRESS and not market_ok():
        return 1, "solvency", zval, c
    if lit.get("burden_ta") is not None and lit["burden_ta"] > LIT_BURDEN:
        return 1, "litigation", zval, c
    if (liq.get("burning") and liq.get("runway_q") is not None and liq["runway_q"] < RUNWAY_Q
            and cr is not None and cr < CR_MAX):
        return 1, "liquidity", zval, c
    eroding = (zval is not None and zval < Z_SAFE) or \
              (zval is not None and zp is not None and zval < zp - Z_DROP)
    if c >= TRAJ and eroding and not market_ok():
        return 1, "trajectory", zval, c
    return 0, "clear", zval, c


def main():
    full = resolve_ciks(COHORT) + resolve_ciks(HOLDOUT) + resolve_ciks(EXPANDED)
    seen, rows = set(), []
    print("4-signal fused kernel on design set...\n")
    for (t, cik, label, note, event) in full:
        if t in SKIP or not cik or t in seen:
            continue
        seen.add(t)
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            continue
        dfc = clean_df(facts, event)
        pred, tier, z, c = decide(t, facts, event, dfc)
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier})
        time.sleep(0.2)
    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    P = tp / (tp + fp) if (tp + fp) else 0
    R = tp / (tp + fn) if (tp + fn) else 0
    FPR = fp / (fp + tn) if (fp + tn) else 0
    F1 = 2 * P * R / (P + R) if (P + R) else 0
    bt = {}
    for r in rows:
        if r["label"] == 1 and r["pred"] == 1:
            bt[r["tier"]] = bt.get(r["tier"], 0) + 1
    print("=== 4-SIGNAL FUSED KERNEL (design set, n=%d) ===" % len(rows))
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, P, R, FPR, F1))
    print("  catches by tier: %s" % bt)
    print("  (3-signal was P 1.00 R 0.67; did litigation add Endo + keep precision?)")
    print("  FALSE POSITIVES:", [(r["t"], r["tier"]) for r in rows if r["label"] == 0 and r["pred"] == 1])
    print("  ENDP result:", [r["tier"] for r in rows if r["t"] == "ENDP"])
    print("  FALSE NEGATIVES:", [r["t"] for r in rows if r["label"] == 1 and r["pred"] == 0])


if __name__ == "__main__":
    main()
