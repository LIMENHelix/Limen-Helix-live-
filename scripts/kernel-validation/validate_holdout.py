#!/usr/bin/env python3
"""
validate_holdout.py — OUT-OF-SAMPLE test of the FROZEN v2 candidate.

The main cohort in validate_kernel.py was used to TUNE v2 (and deliberately
included v1's known false positives), so its precision/FPR are in-sample and
optimistic. This script measures the frozen v2 formula on a DISJOINT held-out
set the discriminator never saw — fresh investment-grade controls + fresh known
bankruptcies. No tuning happens here; this is the honest generalization number.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb            # noqa: E402
import kernel_v2                       # noqa: E402
from validate_kernel import resolve_ciks, score_company, metrics  # noqa: E402

# Held-out set — NONE of these were used to tune v2.
HOLDOUT = [
    # fresh investment-grade controls (label 0) — current data
    ("V",    None, 0, "Visa — AA-", None),
    ("MA",   None, 0, "Mastercard — A+", None),
    ("ADBE", None, 0, "Adobe — A+", None),
    ("ORCL", None, 0, "Oracle — BBB", None),
    ("TXN",  None, 0, "Texas Instruments — A+", None),
    ("QCOM", None, 0, "Qualcomm — A", None),
    ("AMAT", None, 0, "Applied Materials — A", None),
    ("NEE",  None, 0, "NextEra — A-", None),
    ("SO",   None, 0, "Southern Co — BBB+", None),
    ("DUK",  None, 0, "Duke Energy — BBB+", None),
    ("ABBV", None, 0, "AbbVie — A-", None),
    ("TMO",  None, 0, "Thermo Fisher — A-", None),
    ("DHR",  None, 0, "Danaher — A-", None),
    ("LIN",  None, 0, "Linde — A", None),
    ("ITW",  None, 0, "Illinois Tool Works — A+", None),
    ("EMR",  None, 0, "Emerson — A", None),
    ("GD",   None, 0, "General Dynamics — A-", None),
    ("NOC",  None, 0, "Northrop Grumman — BBB+", None),
    ("ADP",  None, 0, "ADP — AA-", None),
    ("AVGO", None, 0, "Broadcom — BBB", None),
    ("LOW",  None, 0, "Lowe's — BBB+", None),
    ("TGT",  None, 0, "Target — A", None),
    ("SBUX", None, 0, "Starbucks — BBB+", None),
    ("GIS",  None, 0, "General Mills — BBB", None),
    ("KMB",  None, 0, "Kimberly-Clark — A", None),
    ("D",    None, 0, "Dominion Energy — BBB+", None),
    ("PSX",  None, 0, "Phillips 66 — BBB (cyclical refiner)", None),
    ("VLO",  None, 0, "Valero — BBB (cyclical refiner)", None),
    ("DOW",  None, 0, "Dow — BBB (cyclical chemicals)", None),
    ("NUE",  None, 0, "Nucor — A- (cyclical steel)", None),

    # fresh known Ch11 distress (label 1) — scored at event date
    ("REV",  "0000887921", 1, "Revlon — Ch11 Jun 2022", "2022-06-15"),
    ("ENDP", "0001593034", 1, "Endo — Ch11 Aug 2022", "2022-08-16"),
    ("MNK",  "0001567892", 1, "Mallinckrodt — Ch11 Oct 2020", "2020-10-12"),
    ("AVYA", "0001418100", 1, "Avaya — Ch11 Feb 2023", "2023-02-14"),
    ("PRTY", "0001592058", 1, "Party City — Ch11 Jan 2023", "2023-01-17"),
    ("DBD",  "0000093556", 1, "Diebold Nixdorf — Ch11 Jun 2023", "2023-06-01"),
    ("RAD",  "0000084129", 1, "Rite Aid — Ch11 Oct 2023", "2023-10-15"),
    ("FTCHQ","0001736946", 1, "Farfetch — distress 2023", "2023-12-01"),
]


def main():
    cohort = resolve_ciks(HOLDOUT)
    rows = []
    print("OUT-OF-SAMPLE holdout — frozen v2, %d companies\n" % len(cohort))
    print("%-7s %-6s %-7s %-9s %-7s %-7s %-7s %-9s" % ("TICK", "LABEL", "PRED", "COMP", "PATH_A", "PATH_B", "PATH_C", "ENTITY"))
    for (t, cik, label, note, event) in cohort:
        if not cik:
            print("%-7s  (no CIK)" % t); continue
        try:
            r = score_company(cik, kernel_v2.compute_composite_v2, event_str=event)
        except Exception as e:
            print("%-7s  ERR %s" % (t, str(e)[:40])); continue
        if r.get("error"):
            print("%-7s  %s" % (t, r["error"])); continue
        pred = 1 if r["alert"] else 0
        flag = "OK" if pred == label else "MISS"
        rows.append({"ticker": t, "label": label, "pred": pred, "note": note, **r})
        print("%-7s %-6d %-7d %-9s %-7s %-7s %-7s %-9s %s" % (
            t, label, pred, r["composite"], r["path_a"], r["path_b"], r["path_c"], (r.get("entity") or "")[:22], flag))
        time.sleep(0.3)

    m = metrics(rows)
    print("\n=== HOLDOUT (out-of-sample) — frozen v2 ===")
    print("  TP %d  FP %d  TN %d  FN %d" % (m["tp"], m["fp"], m["tn"], m["fn"]))
    print("  precision %.3f  recall %.3f  FPR %.3f  F1 %.3f" % (m["precision"], m["recall"], m["fpr"], m["f1"]))
    print("\n  FALSE POSITIVES (the honest ones):")
    for r in rows:
        if r["label"] == 0 and r["pred"] == 1:
            print("    %-7s comp %.2f — %s" % (r["ticker"], r["composite"], r["note"]))


if __name__ == "__main__":
    main()
