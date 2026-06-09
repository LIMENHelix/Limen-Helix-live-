#!/usr/bin/env python3
"""
post_design_holdout.py — The honest test (engineer move #6): FREEZE the 3-signal
fusion rules and run them on a cohort that played NO role in design.

Imports fusion3.decide unchanged (frozen thresholds). None of these companies
were used to choose any rule or threshold. If precision/recall hold here, the
result generalizes; if they degrade, the design overfit. Entity names printed to
catch wrong CIKs.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from pit_trajectory import clean_df   # noqa: E402
import fusion3                        # noqa: E402  (frozen decide)
from validate_kernel import resolve_ciks  # noqa: E402

# FRESH — none used in any prior cohort/design step.
FRESH = [
    # fresh Ch11 distress (XBRL era), scored at event
    ("FSR",  "0001720990", 1, "Fisker — Ch11 Jun 2024", "2024-06-17"),
    ("SPWR", "0000867773", 1, "SunPower — Ch11 Aug 2024", "2024-08-05"),
    ("EVA",  "0001592057", 1, "Enviva — Ch11 Mar 2024", "2024-03-13"),
    ("CANO", "0001800682", 1, "Cano Health — Ch11 Feb 2024", "2024-02-04"),
    ("NVTA", "0001501134", 1, "Invitae — Ch11 Feb 2024", "2024-02-13"),
    ("AUD",  "0001383312", 1, "Audacy — Ch11 Jan 2024", "2024-01-07"),
    ("GTLS", None, 0, "Chart Industries — control (levered acquirer, survived)", None),
    ("BBWI", None, 0, "Bath & Body Works — BB+ (levered spinoff, survived)", None),

    # fresh IG controls (different names than any prior set)
    ("UNP", None, 0, "Union Pacific — A-", None), ("CSX", None, 0, "CSX — BBB+", None),
    ("NSC", None, 0, "Norfolk Southern — BBB+", None), ("WM", None, 0, "Waste Mgmt — A-", None),
    ("RSG", None, 0, "Republic Services — BBB+", None), ("ROP", None, 0, "Roper — BBB+", None),
    ("AME", None, 0, "Ametek — A-", None), ("DOV", None, 0, "Dover — A", None),
    ("GWW", None, 0, "Grainger — A+", None), ("FAST", None, 0, "Fastenal — A+", None),
    ("ODFL", None, 0, "Old Dominion — A", None), ("ORLY", None, 0, "O'Reilly — BBB+", None),
    ("AZO", None, 0, "AutoZone — BBB", None), ("TJX", None, 0, "TJX — A", None),
    ("ROST", None, 0, "Ross — A-", None), ("DG", None, 0, "Dollar General — BBB", None),
    ("YUM", None, 0, "Yum Brands — BB+ (levered)", None), ("CMG", None, 0, "Chipotle — A-", None),
    ("MAR", None, 0, "Marriott — BBB", None), ("ACN", None, 0, "Accenture — A+", None),
    ("ADSK", None, 0, "Autodesk — BBB+", None), ("WDAY", None, 0, "Workday — BBB+", None),
]


def main():
    cohort = resolve_ciks(FRESH)
    rows = []
    print("POST-DESIGN HOLDOUT — frozen 3-signal rules, n=%d (never seen in design)\n" % len(cohort))
    print("%-6s %-6s %-7s %-12s %-24s" % ("TICK", "LABEL", "PRED", "TIER", "ENTITY"))
    for (t, cik, label, note, event) in cohort:
        if not cik:
            print("  %-6s NO CIK" % t); continue
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            print("  %-6s no facts" % t); continue
        entity = (facts.get("entityName") or "")[:24]
        dfc = clean_df(facts, event)
        pred, tier, z, rw, c = fusion3.decide(facts, event, dfc)
        flag = "OK" if pred == label else "MISS"
        rows.append({"t": t, "label": label, "pred": pred, "tier": tier, "entity": entity, "note": note})
        print("%-6s %-6d %-7d %-12s %-24s %s" % (t, label, pred, tier, entity, flag))
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
    print("\n=== POST-DESIGN HOLDOUT (frozen rules, fresh companies) ===")
    print("  TP %d FP %d TN %d FN %d | precision %.3f recall %.3f FPR %.3f F1 %.3f" % (tp, fp, tn, fn, P, R, FPR, F1))
    print("  catches by tier: %s" % bt)
    print("  vs design-cohort (P 1.00 R 0.67 FPR 0.00) — holds if similar")
    print("\n  FALSE POSITIVES:", [r["t"] for r in rows if r["label"] == 0 and r["pred"] == 1])
    print("  FALSE NEGATIVES:", [r["t"] for r in rows if r["label"] == 1 and r["pred"] == 0])


if __name__ == "__main__":
    main()
