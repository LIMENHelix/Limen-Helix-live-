#!/usr/bin/env python3
"""
fusion4.py — fusion3 + market-value-of-equity VETO on the solvency tier, run on
a SECOND fresh holdout (none of these companies used in any prior design/test).

Veto: if book-equity Altman flags distress but the MARKET values equity above
MVE_VETO x total liabilities, it's a buyback/negative-book-equity artifact (Yum,
O'Reilly), not distress. Point-in-time MVE (shares filed<=cutoff x price at
cutoff); delisted bankrupts return None -> not vetoed -> flag kept.

Frozen rules (Z/runway/CR/traj thresholds unchanged from fusion3) + the veto.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, liquidity, marketcap   # noqa: E402
from pit_trajectory import clean_df, comp, shift  # noqa: E402
from validate_kernel import resolve_ciks  # noqa: E402
from fusion3 import Z_DISTRESS, Z_SAFE, Z_DROP, TRAJ, RUNWAY_Q, CR_MAX  # frozen

MVE_VETO = 1.2  # market equity > 1.2x total liabilities = market says solvent

# SECOND fresh holdout — none used in COHORT/HOLDOUT/EXPANDED/post_design_holdout.
FRESH2 = [
    # fresh Ch11 distress, explicit CIKs (verify by entity), scored at event
    ("VAL",  "0001737706", 1, "Valaris — Ch11 Aug 2020", "2020-08-19"),
    ("TLRD", "0000884217", 1, "Tailored Brands — Ch11 Aug 2020", "2020-08-02"),
    ("CRC",  "0001609253", 1, "California Resources — Ch11 Jul 2020", "2020-07-15"),
    ("GTX",  "0001735707", 1, "Garrett Motion — Ch11 Sep 2020", "2020-09-20"),
    ("I",    "0001525773", 1, "Intelsat — Ch11 May 2020", "2020-05-13"),
    ("CONN", "0001223389", 1, "Conn's — Ch11 Jul 2024", "2024-07-23"),
    ("LL",   "0001396033", 1, "LL Flooring — Ch11 Aug 2024", "2024-08-11"),
    ("DO",   "0001099744", 1, "Diamond Offshore — Ch11 Apr 2020", "2020-04-26"),
    ("GNC",  "0001502034", 1, "GNC — Ch11 Jun 2020", "2020-06-23"),
    # fresh IG controls + buyback-negative-equity names (the veto's real test)
    ("DPZ",  None, 0, "Domino's — buyback NEG equity (veto test)", None),
    ("HD",   "0000354950", 0, "Home Depot — buyback thin equity", None),
    ("MCD",  None, 0, "McDonald's — buyback NEG equity (veto test)", None),
    ("SBUX", None, 0, "Starbucks — buyback NEG equity (veto test)", None),
    ("KHC", None, 0, "Kraft Heinz — BBB", None), ("MDLZ", None, 0, "Mondelez — BBB", None),
    ("CL", None, 0, "Colgate — A+", None), ("CLX", None, 0, "Clorox — A-", None),
    ("MKC", None, 0, "McCormick — BBB", None), ("TSN", None, 0, "Tyson — BBB", None),
    ("ADM", None, 0, "ADM — A", None), ("NXPI", None, 0, "NXP — BBB+", None),
    ("MCHP", None, 0, "Microchip — BBB", None), ("GLW", None, 0, "Corning — BBB+", None),
    ("HPQ", None, 0, "HP — BBB (buyback neg equity)", None), ("DELL", None, 0, "Dell — BBB", None),
    ("EW", None, 0, "Edwards Lifesciences — A", None), ("BSX", None, 0, "Boston Scientific — BBB+", None),
    ("RMD", None, 0, "ResMed — A-", None), ("HCA", None, 0, "HCA — BB+ (levered)", None),
    ("CI", None, 0, "Cigna — BBB+", None), ("ELV", None, 0, "Elevance — A", None),
]


def decide(ticker, facts, cutoff, dfc):
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    zp = altman.z_from_facts(facts, shift(cutoff, 1)) if cutoff else None
    zp = None if (not zp or zp.get("error")) else zp["Z"]
    liq = liquidity.liquidity(facts, cutoff)
    cr = liq.get("current_ratio")
    c = comp(dfc, cutoff) or 0.0

    if zval is not None and zval < Z_DISTRESS:
        _, ratio = marketcap.mve_to_liabilities(facts, ticker, cutoff)
        if not (ratio is not None and ratio > MVE_VETO):   # market doesn't veto
            return 1, "solvency", zval, c
    if (liq.get("burning") and liq.get("runway_q") is not None and liq["runway_q"] < RUNWAY_Q
            and cr is not None and cr < CR_MAX):
        return 1, "liquidity", zval, c
    eroding = (zval is not None and zval < Z_SAFE) or \
              (zval is not None and zp is not None and zval < zp - Z_DROP)
    if c >= TRAJ and eroding:
        # market-equity veto also applies to the masking/trajectory tier
        _, ratio = marketcap.mve_to_liabilities(facts, ticker, cutoff)
        if not (ratio is not None and ratio > MVE_VETO):
            return 1, "trajectory", zval, c
    return 0, "clear", zval, c


def main():
    cohort = resolve_ciks(FRESH2)
    rows = []
    print("FRESH HOLDOUT #2 — frozen rules + market-equity veto, n=%d\n" % len(cohort))
    print("%-6s %-6s %-5s %-11s %-24s" % ("TICK", "LABEL", "PRED", "TIER", "ENTITY"))
    for (t, cik, label, note, event) in cohort:
        if not cik:
            print("  %-6s NO CIK" % t); continue
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            print("  %-6s no facts" % t); continue
        entity = (facts.get("entityName") or "")[:24]
        dfc = clean_df(facts, event)
        pred, tier, z, c = decide(t, facts, event, dfc)
        flag = "OK" if pred == label else "MISS"
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier, "entity": entity})
        print("%-6s %-6d %-5d %-11s %-24s %s" % (t, label, pred, tier, entity, flag))
        time.sleep(0.2)
    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    P = tp / (tp + fp) if (tp + fp) else 0
    R = tp / (tp + fn) if (tp + fn) else 0
    FPR = fp / (fp + tn) if (fp + tn) else 0
    F1 = 2 * P * R / (P + R) if (P + R) else 0
    print("\n=== FRESH HOLDOUT #2 (frozen rules + market veto) ===")
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, P, R, FPR, F1))
    print("  (post-design holdout WITHOUT veto was P 0.67; design cohort P 1.00)")
    print("  FALSE POSITIVES:", [(r["t"], r["tier"]) for r in rows if r["label"] == 0 and r["pred"] == 1])
    print("  FALSE NEGATIVES:", [r["t"] for r in rows if r["label"] == 1 and r["pred"] == 0])


if __name__ == "__main__":
    main()
