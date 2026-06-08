#!/usr/bin/env python3
"""
validate_kernel.py — Labeled-cohort accuracy harness for the LIMEN distress kernel.

Scores a cohort whose labels are INDEPENDENT of the kernel (known Ch11/Ch7
terminal events = distress=1; investment-grade, no credit event = healthy=0),
then reports the confusion matrix + precision/recall/FPR/PR-AUC for the CURRENT
three-path formula (v1).

The scoring engine is pluggable (`composite_fn`) so the identical harness will
later score a v2 candidate WITHOUT touching the locked limen_backtest.py.
Results are written to results_<tag>.json for v1-vs-v2 comparison.

READ-ONLY w.r.t. the locked kernel — imports it, never modifies it.

Usage:
  python scripts/kernel-validation/validate_kernel.py            # v1 baseline
  python scripts/kernel-validation/validate_kernel.py --tag v1
"""
import sys, os, json, time, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb  # noqa: E402
import requests  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# ─── Labeled cohort ───────────────────────────────────────────────────────────
# label: 1 = distress (known terminal credit event), 0 = healthy (IG, no event).
# Explicit CIKs for delisted names; tickers resolved via SEC map for the rest.
# The "FP" controls are healthy companies the v1 formula was observed to alert on
# — included so precision actually measures the false-positive problem.
# tuple: (ticker, explicit_cik_or_None, label, note, event_date_or_None)
# DISTRESS rows carry the terminal-event filing date — the kernel scores the
# PRE-EVENT run-up by cutting the series at that quarter (point-in-time, the way
# the original validation did). Healthy rows have event=None and score current data.
COHORT = [
    # ── DISTRESS (known Ch11 / terminal credit event), scored at the event ──
    ("HTZ",  "0001657853", 1, "Hertz Global — Ch11 May 2020", "2020-05-22"),
    ("CHK",  "0000895126", 1, "Chesapeake — Ch11 Jun 2020", "2020-06-28"),
    ("BBBY", "0000886158", 1, "Bed Bath & Beyond — Ch11 Apr 2023", "2023-04-23"),
    ("WE",   "0001813756", 1, "WeWork — Ch11 Nov 2023", "2023-11-06"),
    ("JCP",  "0001166126", 1, "J.C. Penney — Ch11 May 2020", "2020-05-15"),
    ("SHLDQ","0001310067", 1, "Sears Holdings — Ch11 Oct 2018", "2018-10-15"),
    ("PIR",  "0000278130", 1, "Pier 1 — Ch11 Feb 2020", "2020-02-17"),
    ("WLL",  "0001255474", 1, "Whiting Petroleum — Ch11 Apr 2020", "2020-04-01"),
    ("YELL", "0000716006", 1, "Yellow Corp — Ch11 Aug 2023", "2023-08-06"),
    ("DNR",  "0000945764", 1, "Denbury — Ch11 Jul 2020", "2020-07-30"),

    # ── HEALTHY controls (investment-grade, no credit event) — current data ──
    ("AAPL", None, 0, "Apple — AA+", None),
    ("MSFT", None, 0, "Microsoft — AAA", None),
    ("WMT",  None, 0, "Walmart — AA", None),
    ("XOM",  None, 0, "Exxon — AA-", None),
    ("JNJ",  None, 0, "J&J — AAA", None),
    ("PG",   None, 0, "P&G — AA-", None),
    ("KO",   None, 0, "Coca-Cola — A+", None),
    ("PEP",  None, 0, "PepsiCo — A+", None),
    ("HD",   None, 0, "Home Depot — A", None),
    ("MCD",  None, 0, "McDonald's — BBB+", None),
    ("UNH",  None, 0, "UnitedHealth — A+", None),
    ("LMT",  None, 0, "Lockheed — A-", None),
    ("RTX",  None, 0, "RTX — A-", None),
    ("CAT",  None, 0, "Caterpillar — A", None),
    ("DE",   None, 0, "Deere — A", None),
    ("NKE",  None, 0, "Nike — AA-", None),
    ("MRK",  None, 0, "Merck — A+", None),
    ("PFE",  None, 0, "Pfizer — A", None),
    ("CSCO", None, 0, "Cisco — AA-", None),
    ("COST", None, 0, "Costco — A+", None),

    # ── HEALTHY controls that v1 FALSE-POSITIVED on (the precision target) ──
    ("KR",   None, 0, "Kroger — BBB (v1 path C FP)", None),
    ("CEG",  None, 0, "Constellation Energy — IG (v1 path C FP)", None),
    ("FIS",  None, 0, "Fidelity National Info — BBB (v1 path C FP)", None),
    ("CACI", None, 0, "CACI — IG defense IT (v1 path C FP)", None),
    ("MDT",  None, 0, "Medtronic — A (v1 path B FP)", None),
    ("ZBH",  None, 0, "Zimmer Biomet — BBB+ (v1 path B FP)", None),
    ("MMC",  None, 0, "Marsh McLennan — A- (v1 path B FP)", None),
    ("MSI",  None, 0, "Motorola Solutions — BBB (v1 path B FP)", None),
    ("PAYX", None, 0, "Paychex — healthy (v1 path A FP)", None),
    ("ALL",  None, 0, "Allstate — A- (v1 path B FP)", None),
    ("CVX",  None, 0, "Chevron — AA- (doc 'stressed-but-survived')", None),
    ("HII",  None, 0, "Huntington Ingalls — BBB (v1 path B FP)", None),
    ("MATX", None, 0, "Matson — BBB (v1 path B FP)", None),
    ("MOS",  None, 0, "Mosaic — BBB (v1 path B FP)", None),
    ("WY",   None, 0, "Weyerhaeuser — BBB (v1 path B FP)", None),
]

SEC_HEADERS = getattr(lb, "SEC_HEADERS", {"User-Agent": "limenhelix@gmail.com"})


def resolve_ciks(cohort):
    """Fill in CIKs for tickers that don't have an explicit one."""
    need = [t for (t, c, _, _, _) in cohort if not c]
    tmap = {}
    if need:
        r = requests.get("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS, timeout=30)
        r.raise_for_status()
        for row in r.json().values():
            tmap[row["ticker"].upper()] = str(row["cik_str"]).zfill(10)
    out = []
    for (t, c, label, note, event) in cohort:
        cik = c or tmap.get(t.upper())
        out.append((t, cik, label, note, event))
    return out


def score_company(cik, composite_fn, event_str=None):
    """Run the validated pipeline; return alert + path scores. composite_fn lets
    a v2 candidate replace the composite stage without touching the kernel.
    event_str (filing date) makes the kernel score the PRE-EVENT run-up."""
    facts = lb.fetch_sec_facts(cik)
    if not facts:
        return {"error": "no_facts"}
    data = {
        "Revenue": lb.extract_quarterly_series(facts, lb.TAG_MAP["Revenue"], "Revenue", is_flow=True),
        "OCF": lb.extract_quarterly_series(facts, lb.TAG_MAP["OCF"], "OCF", is_flow=True),
        "Cash": lb.extract_quarterly_series(facts, lb.TAG_MAP["Cash"], "Cash", is_flow=False),
    }
    dc = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtCurrent"], "DebtCurrent", is_flow=False)
    dl = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtLong"], "DebtLong", is_flow=False)
    allq = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in allq}
    df = lb.compute_all_features(data, {})
    if df is None or df.empty:
        return {"error": "no_features"}
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    composite, first_q, details = composite_fn(df, event_str, lb.HOLDOUT_P3_ENTRY)
    pa, pb, pc = float(details.get("path_a", 0)), float(details.get("path_b", 0)), float(details.get("path_c", 0))
    alert = (pa >= lb.COMPOSITE_THRESH_A) or (pb >= lb.COMPOSITE_THRESH_B) or (pc >= lb.COMPOSITE_THRESH_C)
    latest = df.iloc[-1]["quarter"] if len(df) else None
    return {
        "entity": facts.get("entityName", ""),
        "alert": bool(alert), "composite": round(composite, 3),
        "path_a": round(pa, 3), "path_b": round(pb, 3), "path_c": round(pc, 3),
        "latest_quarter": f"{int(latest[0])}Q{int(latest[1])}" if latest is not None else None,
        "history": int(len(df)),
    }


def metrics(rows):
    tp = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 1)
    fp = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 1)
    tn = sum(1 for r in rows if r["label"] == 0 and r["pred"] == 0)
    fn = sum(1 for r in rows if r["label"] == 1 and r["pred"] == 0)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return dict(tp=tp, fp=fp, tn=tn, fn=fn, precision=round(prec, 3),
                recall=round(rec, 3), fpr=round(fpr, 3), f1=round(f1, 3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="v1")
    args = ap.parse_args()

    # Pluggable composite: v1 = locked kernel; v2 = candidate wrapper (no kernel edit)
    if args.tag == "v2":
        import kernel_v2
        composite_fn = kernel_v2.compute_composite_v2
    else:
        composite_fn = lb.compute_composite_score

    cohort = resolve_ciks(COHORT)
    rows = []
    print(f"Scoring {len(cohort)} companies (tag={args.tag})...\n")
    print("%-7s %-6s %-7s %-9s %-7s %-7s %-7s %-9s" % ("TICK", "LABEL", "PRED", "COMPOSITE", "PATH_A", "PATH_B", "PATH_C", "LATEST"))
    for (t, cik, label, note, event) in cohort:
        if not cik:
            print("%-7s  (no CIK resolved) — %s" % (t, note)); continue
        try:
            r = score_company(cik, composite_fn, event_str=event)
        except Exception as e:
            print("%-7s  ERROR %s" % (t, e)); continue
        if r.get("error"):
            print("%-7s  %s — %s" % (t, r["error"], note)); continue
        pred = 1 if r["alert"] else 0
        flag = "OK" if pred == label else "MISS"
        rows.append({"ticker": t, "cik": cik, "label": label, "pred": pred, "note": note, **r})
        print("%-7s %-6d %-7d %-9s %-7s %-7s %-7s %-9s %s" % (
            t, label, pred, r["composite"], r["path_a"], r["path_b"], r["path_c"], r["latest_quarter"], flag))
        time.sleep(0.3)

    m = metrics(rows)
    print("\n=== CONFUSION MATRIX (tag=%s, n=%d scored) ===" % (args.tag, len(rows)))
    print("  TP %d  FP %d  TN %d  FN %d" % (m["tp"], m["fp"], m["tn"], m["fn"]))
    print("  precision %.3f  recall %.3f  FPR %.3f  F1 %.3f" % (m["precision"], m["recall"], m["fpr"], m["f1"]))
    print("\n  FALSE POSITIVES (healthy, kernel alerted):")
    for r in rows:
        if r["label"] == 0 and r["pred"] == 1:
            print("    %-7s path %s — %s" % (r["ticker"], "C" if r["path_c"] >= lb.COMPOSITE_THRESH_C else "B" if r["path_b"] >= lb.COMPOSITE_THRESH_B else "A", r["note"]))
    print("\n  FALSE NEGATIVES (distress, kernel missed):")
    for r in rows:
        if r["label"] == 1 and r["pred"] == 0:
            print("    %-7s comp %.2f — %s" % (r["ticker"], r["composite"], r["note"]))

    out = os.path.join(HERE, f"results_{args.tag}.json")
    json.dump({"tag": args.tag, "metrics": m, "rows": rows}, open(out, "w"), indent=1)
    print("\nWrote", out)


if __name__ == "__main__":
    main()
