#!/usr/bin/env python3
"""
fusion3.py — Three-signal point-in-time fused distress kernel on an EXPANDED
cohort, with entity-name verification.

  1. SOLVENCY  — Altman Z'' < 1.1                          (structural insolvency)
  2. LIQUIDITY — OCF burning AND runway < RUNWAY_Q quarters (near-term cash death)
  3. TRAJECTORY— phase composite elevated AND solvency eroding (masking/operational)

All three are point-in-time clean (filed<=cutoff, as-originally-reported).
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, liquidity              # noqa: E402
from pit_trajectory import clean_df, comp, shift  # noqa: E402
from validate_kernel import COHORT, resolve_ciks  # noqa: E402
from validate_holdout import HOLDOUT  # noqa: E402

Z_DISTRESS, Z_SAFE, Z_DROP, TRAJ, RUNWAY_Q, CR_MAX = 1.1, 2.6, 1.0, 1.1, 4.0, 1.05

# CIKs that resolve to the WRONG entity (verified by entity name) — exclude.
SKIP = {"EXPR", "DBD", "FTCHQ"}  # Scorpio Tankers / Stanley Black&Decker / Arlo

# ── Expanded cohort: more bankruptcies (varied modes) + more IG controls ──
# (ticker, explicit_cik, label, note, event)  — CIKs verified by entity in output.
EXPANDED = [
    # recent Ch11 distress (XBRL era)
    ("SAVE", "0001498710", 1, "Spirit Airlines — Ch11 Nov 2024", "2024-11-18"),
    ("BIG",  "0000768835", 1, "Big Lots — Ch11 Sep 2024", "2024-09-09"),
    ("EXPR", "0001483934", 1, "Express — Ch11 Apr 2024", "2024-04-22"),
    ("TUP",  "0001008654", 1, "Tupperware — Ch11 Sep 2024", "2024-09-17"),
    ("TWOU", "0001459417", 1, "2U — Ch11 Jul 2024", "2024-07-25"),
    ("RIDE", "0001759546", 1, "Lordstown — Ch11 Jun 2023", "2023-06-27"),
    ("PTRA", "0001722969", 1, "Proterra — Ch11 Aug 2023", "2023-08-07"),
    ("FTR",  "0000020520", 1, "Frontier Comms — Ch11 Apr 2020", "2020-04-14"),
    ("MNK",  "0001567892", 1, "Mallinckrodt — Ch11 Oct 2020", "2020-10-12"),
    ("CYH",  "0001108109", 0, "Community Health — distressed but survived (control)", None),
    # more IG controls, diverse sectors
    ("ABT", None, 0, "Abbott — AA-", None), ("BMY", None, 0, "Bristol Myers — A", None),
    ("AMGN", None, 0, "Amgen — BBB+", None), ("GILD", None, 0, "Gilead — A-", None),
    ("SYK", None, 0, "Stryker — A", None), ("BDX", None, 0, "Becton Dickinson — BBB", None),
    ("HON", None, 0, "Honeywell — A", None), ("ETN", None, 0, "Eaton — A-", None),
    ("SHW", None, 0, "Sherwin-Williams — BBB+", None), ("APD", None, 0, "Air Products — A", None),
    ("SLB", None, 0, "Schlumberger — A", None), ("COP", None, 0, "ConocoPhillips — A-", None),
    ("KMI", None, 0, "Kinder Morgan — BBB", None), ("AEP", None, 0, "American Electric — BBB+", None),
    ("TMUS", None, 0, "T-Mobile — BBB", None), ("CMCSA", None, 0, "Comcast — A-", None),
    ("NOW", None, 0, "ServiceNow — A", None), ("INTU", None, 0, "Intuit — A", None),
    ("MU", None, 0, "Micron — BBB (cyclical)", None), ("LRCX", None, 0, "Lam Research — A", None),
    ("FCX", None, 0, "Freeport (cyclical miner)", None), ("NEM", None, 0, "Newmont (cyclical gold)", None),
    ("F", None, 0, "Ford — BBB- (levered, cyclical)", None), ("GM", None, 0, "GM — BBB (levered)", None),
]


def decide(facts, cutoff, df_clean):
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    zp = altman.z_from_facts(facts, shift(cutoff, 1)) if cutoff else None
    zp = None if (not zp or zp.get("error")) else zp["Z"]
    liq = liquidity.liquidity(facts, cutoff)
    c = comp(df_clean, cutoff) or 0.0

    cr = liq.get("current_ratio")
    if zval is not None and zval < Z_DISTRESS:
        return 1, "solvency", zval, liq.get("runway_q"), c
    # Liquidity: burning + short runway + weak current ratio. The current-ratio
    # gate filters lumpy-OCF industrials (defense receivables push CR > 1) while
    # keeping genuine cash-death (WE 0.34, BBBY 0.73).
    if (liq.get("burning") and liq.get("runway_q") is not None and liq["runway_q"] < RUNWAY_Q
            and cr is not None and cr < CR_MAX):
        return 1, "liquidity", zval, liq.get("runway_q"), c
    eroding = (zval is not None and zval < Z_SAFE) or \
              (zval is not None and zp is not None and zval < zp - Z_DROP)
    if c >= TRAJ and eroding:
        return 1, "trajectory", zval, liq.get("runway_q"), c
    return 0, "clear", zval, liq.get("runway_q"), c


def main():
    full = resolve_ciks(COHORT) + resolve_ciks(HOLDOUT) + resolve_ciks(EXPANDED)
    rows = []
    print("3-signal point-in-time fused kernel, n=%d (verifying entities)...\n" % len(full))
    for (t, cik, label, note, event) in full:
        if t in SKIP:
            continue
        if not cik:
            print("  %-7s NO CIK" % t); continue
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            print("  %-7s no facts" % t); continue
        entity = (facts.get("entityName") or "")[:24]
        dfc = clean_df(facts, event)
        pred, tier, z, rw, c = decide(facts, event, dfc)
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier, "entity": entity, "note": note})
        time.sleep(0.2)

    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    P = tp / (tp + fp) if (tp + fp) else 0
    R = tp / (tp + fn) if (tp + fn) else 0
    FPR = fp / (fp + tn) if (fp + tn) else 0
    F1 = 2 * P * R / (P + R) if (P + R) else 0
    by_tier = {}
    for r in rows:
        if r["label"] == 1 and r["pred"] == 1:
            by_tier[r["tier"]] = by_tier.get(r["tier"], 0) + 1
    print("\n=== 3-SIGNAL FUSED KERNEL (point-in-time, n=%d) ===" % len(rows))
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, P, R, FPR, F1))
    print("  catches by tier: %s" % by_tier)
    print("\n  FALSE POSITIVES:")
    for r in rows:
        if r["label"] == 0 and r["pred"] == 1:
            print("    %-7s tier=%-10s %-24s — %s" % (r["t"], r["tier"], r["entity"], r["note"]))
    print("  FALSE NEGATIVES:")
    for r in rows:
        if r["label"] == 1 and r["pred"] == 0:
            print("    %-7s %-24s — %s" % (r["t"], r["entity"], r["note"]))
    print("\n  ENTITY-VERIFY distress rows (catch wrong CIKs):")
    for r in rows:
        if r["label"] == 1:
            print("    %-7s -> %-24s %s" % (r["t"], r["entity"], "[check]" if r["t"].lower() not in r["entity"].lower().replace(" ", "") else ""))


if __name__ == "__main__":
    main()
