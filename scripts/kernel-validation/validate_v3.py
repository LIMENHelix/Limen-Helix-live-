#!/usr/bin/env python3
"""
validate_v3.py — Phase-weighted distress detector (the "sliding formula").

Instead of the three rigid paths (A/B/C) reading raw cash/debt mechanics, v3
detects FROM the phase substrate: each quarter's distress is a weighted sum of
the 11 phase scores the kernel already computes —

    D(t) = Σ wᵢ · Pᵢ(t)

with weights wᵢ encoding each phase's financial direction (healthy P0/P6/P10
negative; the descent P3→P7→P7a→P9 escalating positive). D(t) is accumulated
over the company's run-up; the company score is the time-normalised peak of that
accumulator. The single slider τ is the alert threshold — we sweep it to see the
whole precision/recall curve and find where it "catches everything" without
lighting up the healthy names.

Reads ONLY columns the locked kernel already produces (p0..p10, p7a, p7b).
Does not modify limen_backtest.py.
"""
import sys, os, time
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb            # noqa: E402
from validate_kernel import COHORT, resolve_ciks  # noqa: E402

# ── Phase weights (from the financial-direction map) ──
WEIGHTS = {
    "p0": 0.0,    # Source — stable baseline
    "p1": 0.3,    # Rupture — first disruption (warning)
    "p2": 0.0,    # Rhythm — healthy growth
    "p3": 1.0,    # Instability — core distress
    "p4": -0.3,   # Stabilisation — recovering
    "p5": -0.2,   # Endurance — recovering
    "p6": -0.6,   # Order — healthy
    "p7": 0.8,    # Divergence — structural break + debt
    "p7a": 1.3,   # Terminal — routes to collapse
    "p7b": -0.3,  # Separation — controlled, routes to new baseline
    "p8": -0.2,   # Pivot — growth break
    "p9": 1.5,    # Collapse threshold
    "p10": -0.5,  # Resurrection — new baseline
}
DECAY = 0.6   # accumulator discharge on a recovery (D<0) quarter


def _window(df, event_str):
    dfw = df[df["quarter"].apply(lambda q: q[0] >= lb.START_YEAR)].copy()
    if event_str:
        from datetime import datetime
        ev = lb.date_to_quarter(datetime.strptime(event_str, "%Y-%m-%d"))
        dfw = dfw[dfw["quarter"].apply(lambda q: q <= ev)]
    return dfw


def phase_distress_score(df, event_str):
    """Time-normalised peak of the accumulated phase-distress signal."""
    dfw = _window(df, event_str)
    if dfw.empty:
        return 0.0
    n = len(dfw)
    D = np.zeros(n)
    for ph, w in WEIGHTS.items():
        if ph in dfw.columns and w != 0.0:
            D += w * np.nan_to_num(dfw[ph].values.astype(float), nan=0.0)
    acc, peak = 0.0, 0.0
    for d in D:
        acc = acc + d if d > 0 else max(0.0, acc * DECAY)
        peak = max(peak, acc)
    return peak / np.sqrt(max(1, n))


def build_df(cik):
    facts = lb.fetch_sec_facts(cik)
    if not facts:
        return None
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
        return None
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    return df


def metrics_at(scored, tau):
    tp = sum(1 for (lab, s) in scored if lab == 1 and s >= tau)
    fp = sum(1 for (lab, s) in scored if lab == 0 and s >= tau)
    tn = sum(1 for (lab, s) in scored if lab == 0 and s < tau)
    fn = sum(1 for (lab, s) in scored if lab == 1 and s < tau)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    return tp, fp, tn, fn, prec, rec, f1, fpr


def main():
    cohort = resolve_ciks(COHORT)
    rows = []
    print("Scoring %d companies with phase-distress formula...\n" % len(cohort))
    print("%-7s %-6s %-9s %-9s" % ("TICK", "LABEL", "PHASE_SC", "NOTE"))
    for (t, cik, label, note, event) in cohort:
        if not cik:
            continue
        try:
            df = build_df(cik)
            if df is None:
                print("%-7s  no-data" % t); continue
            s = phase_distress_score(df, event)
        except Exception as e:
            print("%-7s  ERR %s" % (t, e)); continue
        rows.append((t, label, round(s, 3), note))
        time.sleep(0.3)

    rows.sort(key=lambda r: -r[2])
    print("\n=== company phase-distress scores (sorted) ===")
    for (t, label, s, note) in rows:
        tag = "DISTRESS" if label == 1 else "healthy "
        print("  %-7s %-9s %s  %s" % (t, s, tag, note))

    scored = [(label, s) for (_, label, s, _) in rows]
    print("\n=== SLIDER SWEEP (τ = alert threshold) ===")
    print("  %-6s %-4s %-4s %-4s %-4s %-7s %-7s %-7s %-7s" % ("tau", "TP", "FP", "TN", "FN", "prec", "recall", "F1", "FPR"))
    best = None
    for tau in [round(x * 0.1, 1) for x in range(2, 26)]:
        tp, fp, tn, fn, prec, rec, f1, fpr = metrics_at(scored, tau)
        mark = ""
        if best is None or f1 > best[1]:
            best = (tau, f1); mark = ""
        print("  %-6s %-4d %-4d %-4d %-4d %-7.3f %-7.3f %-7.3f %-7.3f" % (tau, tp, fp, tn, fn, prec, rec, f1, fpr))
    # report best-F1 operating point
    bt = best[0]
    tp, fp, tn, fn, prec, rec, f1, fpr = metrics_at(scored, bt)
    print("\n  BEST-F1 τ=%.1f → precision %.3f  recall %.3f  F1 %.3f  FPR %.3f  (TP %d FP %d TN %d FN %d)" % (bt, prec, rec, f1, fpr, tp, fp, tn, fn))
    print("\n  vs v1 (precision 0.28 recall 0.50 F1 0.36) and v2 (precision 0.57 recall 0.40 F1 0.47)")
    print("\n  At τ=%.1f — FALSE POSITIVES:" % bt)
    for (t, label, s, note) in rows:
        if label == 0 and s >= bt:
            print("    %-7s %s — %s" % (t, s, note))
    print("  At τ=%.1f — MISSED distress:" % bt)
    for (t, label, s, note) in rows:
        if label == 1 and s < bt:
            print("    %-7s %s — %s" % (t, s, note))


if __name__ == "__main__":
    main()
