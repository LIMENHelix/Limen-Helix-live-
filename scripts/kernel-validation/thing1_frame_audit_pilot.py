#!/usr/bin/env python3
"""thing1_frame_audit_pilot.py — EXPLORATORY/PILOT run per prereg v1.2 §5.

Consumes ONLY the already-cached v1.0 panel data + v1.0 results JSON. Adds:
source_lists (corrected calibration tagging), seasonal_strength/amplitude,
S1/E1/E2/S2/S3 for flagged companies (S-rule v2), Table 2b excluding
UNMEASURED, exploratory seasonality test, per-list validation dependence.
Writes thing1_frame_audit_results_v12_pilot.json. No v1.0 file is modified.
"""
import json
import math
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "python_runtime"))
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing1"))
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing2"))
sys.path.insert(0, str(HERE))

import limen_app  # noqa: E402,F401
import limen_backtest as lb  # noqa: E402
from flows import decumulate  # noqa: E402
import financial_phase_map as fpm  # noqa: E402  (temporal_dyad port of prove_p2)

AUDIT = HERE / "shadow_cache_frame_audit"
CUTOFF = "2026-10-08"

CALIB_D = {c["ticker"] for c in lb.DISTRESS}
CALIB_C = {c["ticker"] for c in lb.CONTROLS}
HOT_B = {"HTZ", "VAL", "WLL", "DO", "FTR", "MNK", "NMRD", "YELL", "TUEM", "EXPR", "FRG", "DDS_x"}
HOT_H = {"LMT", "GD", "NOC", "UNP", "CSX", "NSC", "ADP", "PAYX", "WM"}
K3_B = {"FYBR", "WLL", "DNR", "SN", "GYMB", "PIR", "SHLDQ", "BRS", "MCKPQ", "WMPVQ"}
K3_H = {"PG", "KO", "HD", "NEE", "RTX", "JNJ", "MCD", "BRK-B", "UNH", "LMT"}
V13_B = {"HTZ", "VAL", "WLL", "DO", "FTR", "MNK", "YELL", "TUEM", "EXPR"}
V13_H = {"LMT", "GD", "NOC", "UNP", "CSX", "NSC", "ADP", "PAYX", "WM"}
V13_N = {"CAR", "M", "XOM", "SCHW", "CCL", "AAL", "NCLH", "RCL", "UAL"}


def source_lists(t):
    out = []
    if t in CALIB_D: out.append("calibration-distress[LOCKED-CODE]")
    if t in CALIB_C: out.append("calibration-control[LOCKED-CODE]")
    if t in HOT_B: out.append("heldout_test-bankrupt")
    if t in HOT_H: out.append("heldout_test-healthy")
    if t in K3_B: out.append("v1-manifest-distress[DOC-pending]")
    if t in K3_H: out.append("v1-manifest-healthy[DOC-pending]")
    if t in V13_B: out.append("v13-prereg-bankrupt")
    if t in V13_H: out.append("v13-prereg-healthy")
    if t in V13_N: out.append("v13-prereg-hardneg")
    out.append("panel-draw")
    return out


def _yq(y, q):
    return "%dQ%d" % (y, q)


def _prev(y, q, n=1):
    for _ in range(n):
        q -= 1
        if q < 1:
            q, y = 4, y - 1
    return y, q


def seasonality(facts):
    rev = {k: v for k, v in decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).items()
           if k[0] >= 2015 and v > 0}
    vals = [rev[k] for k in sorted(rev)]
    if len(vals) < 12:
        return None, None, len(vals)
    coh, amp = fpm.temporal_dyad(vals)
    return coh, amp, len(vals)


RESTRUCT_TAGS = ["RestructuringCharges",
                 "RestructuringAndRelatedCostIncurredCosts",
                 "ImpairmentCharges", "GoodwillImpairmentLosses"]
DIV_TAGS = ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"]


def _last8_grid(rev_keys):
    ks = sorted(k for k in rev_keys if k <= _cut_yq())
    if not ks:
        return []
    last = ks[-1]
    return [_prev(last[0], last[1], i) for i in range(8)][::-1]


def _cut_yq():
    d = datetime.strptime(CUTOFF, "%Y-%m-%d")
    return (d.year, (d.month - 1) // 3 + 1)


def s_rule(facts):
    """Returns dict with S1, E1, E2, S2, S3 + classification per v1.2 §2."""
    grid = _last8_grid(decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).keys())
    out = {"n_last8": len(grid)}
    if len(grid) < 4:
        out["classification"] = "UNMEASURED-INSUFFICIENT"
        return out
    ni = decumulate(facts, ["us-gaap/NetIncomeLoss"], CUTOFF)
    losses = sum(1 for k in grid if k in ni and ni[k] < 0)
    out["S1"] = bool(losses >= 2)
    # E1 dividend cut/suspension (ASSUMPTION thresholds, v1.2 §2)
    div = {}
    for tg in DIV_TAGS:
        for k, v in decumulate(facts, ["us-gaap/" + tg], CUTOFF).items():
            div[k] = div.get(k, 0.0) + v
    def ttm(series, end):
        ys = [_prev(end[0], end[1], i) for i in range(4)]
        if not all(yq in series for yq in ys):
            return None
        return sum(series[yq] for yq in ys)
    e1 = False
    if div and grid:
        last = grid[-1]
        t_now = ttm(div, last)
        prior = [ttm(div, q) for q in
                 [_prev(last[0], last[1], i) for i in range(4, 40, 4)]
                 if ttm(div, q) is not None]
        paid_prior8 = any(k in div and div[k] > 0 for k in
                          [_prev(last[0], last[1], i) for i in range(2, 10)])
        zero_now = all(div.get(q, 0) == 0 for q in
                       [_prev(last[0], last[1], i) for i in range(4)])
        cut = (t_now is not None and prior and t_now < 0.5 * max(prior))
        e1 = bool(cut or (zero_now and paid_prior8))
    out["E1"] = e1
    # E2 restructuring/impairment in last 8q
    gaap = facts.get("facts", {}).get("us-gaap", {})
    e2 = False
    gset = set(grid)
    for tg in RESTRUCT_TAGS:
        node = gaap.get(tg)
        if not node:
            continue
        for e in node.get("units", {}).get("USD") or []:
            if e.get("form") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                continue
            try:
                d = datetime.strptime(e.get("end", ""), "%Y-%m-%d")
            except Exception:
                continue
            if (d.year, (d.month - 1) // 3 + 1) in gset and (e.get("val") or 0) > 0:
                e2 = True
    out["E2"] = e2
    # S2 OCF < 70% of own peak TTM (ASSUMPTION)
    ocf = {k: v for k, v in decumulate(facts, lb.TAG_MAP["OCF"], CUTOFF).items()
           if k[0] >= 2015}
    ttms = {}
    for k in sorted(ocf):
        t = ttm(ocf, k)
        if t is not None:
            ttms[k] = t
    s2 = False
    if ttms and grid:
        t_now = ttms.get(grid[-1])
        if t_now is not None:
            peak = max(v for k, v in ttms.items() if k <= grid[-1])
            s2 = bool(peak > 0 and t_now < 0.7 * peak)
    out["S2"] = s2
    # S3 debt > 130% of 8 quarters earlier (ASSUMPTION)
    dc = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtCurrent"], "DC", False)
    dl = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtLong"], "DL", False)
    debt = {q: dc.get(q, 0) + dl.get(q, 0) for q in set(list(dc) + list(dl))}
    s3 = False
    if grid:
        last, then = grid[-1], _prev(grid[-1][0], grid[-1][1], 8)
        if last in debt and then in debt and debt[then] > 0:
            s3 = bool(debt[last] > 1.3 * debt[then])
    out["S3"] = s3
    if out["S1"] or out["E1"] or out["E2"]:
        out["classification"] = "STRESSED-SURVIVED"
    elif out["S2"] or out["S3"]:
        out["classification"] = "S2S3-ONLY"
    else:
        out["classification"] = "UNEXPLAINED"
    return out


def mean_ci(a, b):
    n1, n0 = len(a), len(b)
    if n1 < 5 or n0 < 5:
        return {"verdict": "INCONCLUSIVE-small-n", "n_flagged": n1, "n_unflagged": n0}
    m1, m0 = sum(a) / n1, sum(b) / n0
    v1 = sum((x - m1) ** 2 for x in a) / (n1 - 1)
    v0 = sum((x - m0) ** 2 for x in b) / (n0 - 1)
    se = math.sqrt(v1 / n1 + v0 / n0)
    diff = m1 - m0
    lo, hi = diff - 1.96 * se, diff + 1.96 * se
    if lo > 0:
        v = "SUPPORTED"
    elif hi <= 0:
        v = "REJECTED"
    else:
        v = "INCONCLUSIVE-CI"
    return {"diff": diff, "ci95": [lo, hi], "mean_flagged": m1, "mean_unflagged": m0,
            "n_flagged": n1, "n_unflagged": n0, "verdict": v}


def main():
    v10 = json.loads((HERE / "thing1_frame_audit_results.json").read_text(encoding="utf-8"))
    state = json.loads((AUDIT / "panel_state.json").read_text(encoding="utf-8"))
    facts_for = {}
    for ff in AUDIT.glob("facts_*.json"):
        facts_for[ff.name.split("_")[1]] = ff

    flagged_s, manual_queue, s2s3_count = {}, [], 0
    season_rows = []
    for rec in v10["companies"]:
        t = rec["ticker"]
        rec["source_lists"] = source_lists(t)
        rec["designation"] = "EXPLORATORY_PILOT"
        ff = facts_for.get(t)
        if ff:
            facts = json.loads(Path(ff).read_text(encoding="utf-8"))
            coh, amp, n = seasonality(facts)
            rec["seasonal_strength"] = coh
            rec["seasonal_amplitude"] = amp
            rec["seasonal_n_quarters"] = n
            if rec.get("alert"):
                s = s_rule(facts)
                flagged_s[t] = s
                if s["classification"] == "S2S3-ONLY":
                    s2s3_count += 1
                if s["classification"] in ("S2S3-ONLY", "UNEXPLAINED"):
                    manual_queue.append({"ticker": t, "classification": s["classification"],
                                         "reason": "E3 going-concern / E4 covenant 8-K / E5 downgrade require document review"})
        rc = (rec["rev_measured"] / float(rec["eval_rows"])) if rec.get("eval_rows") else 0.0
        rec["rev_coverage"] = round(rc, 4)
        if rc >= 0.8 and rec.get("seasonal_strength") is not None:
            season_rows.append((bool(rec.get("alert")), rec["seasonal_strength"],
                                rec["seasonal_amplitude"]))

    # Table 2b: rates excluding UNMEASURED
    meas = [r for r in v10["companies"] if r.get("eval_rows") and
            (r.get("neutral_floor_share") or 0) < 0.5]
    unm = len(v10["companies"]) - len(meas)
    flag_meas = sum(1 for r in meas if r.get("alert"))
    t2b = {"measured_n": len(meas), "unmeasured_n": unm,
           "flagged_among_measured": flag_meas,
           "flag_rate_measured": round(flag_meas / float(len(meas)), 4) if meas else None}

    # exploratory seasonality test
    fl = [s for a, s, _ in season_rows if a]
    un = [s for a, s, _ in season_rows if not a]
    test_strength = mean_ci(fl, un)
    fla = [a for f, _, a in season_rows if f]
    una = [a for f, _, a in season_rows if not f]
    test_amp = mean_ci(fla, una)

    # validation per-list (v1.1 §E) with corrected tags + S-rule for alerts
    val = {}
    for k, r in v10["validation"].items():
        grp, t = k.split("/", 1)
        if "error" in r:
            val[k] = {"error": r["error"], "source_lists": source_lists(t)}
            continue
        t = r.get("ticker", t)
        entry = {"source_lists": [s for s in source_lists(t) if s != "panel-draw"],
                 "alert": r.get("alert"), "cf_alert": (r.get("cf") or {}).get("alert"),
                 "path_a": r.get("path_a"), "feature_class": r.get("feature_class"),
                 "neutral_floor_share": r.get("neutral_floor_share")}
        alerts_now = bool(r.get("alert")) or bool((r.get("cf") or {}).get("alert"))
        if alerts_now:
            ff = facts_for.get(t)
            if ff:
                facts = json.loads(Path(ff).read_text(encoding="utf-8"))
                entry["s_rule"] = s_rule(facts)
                entry["s_rule"]["applies_to"] = "production-alert" if r.get("alert") else "counterfactual-alert-only"
        val[k] = entry

    out = {"config": {"designation": "EXPLORATORY_PILOT",
                      "prereg": ["v1.0 d1543ae5", "v1.1 412f7991", "v1.2 94e0c981"],
                      "signed": "operator 'run the cache pilot' 2026-10-08",
                      "confirmatory_draw": "seed 20261009 — defined, NOT authorized, no pulls",
                      "cutoff": CUTOFF,
                      "n_panel": len(v10["companies"]),
                      "note": "pilot reuses v1.0 cached panel; seasonality hypothesis was formed from PAYX/ADP/M and cannot be confirmed here"},
           "table2b_rates_over_measured_only": t2b,
           "seasonality_test_exploratory": {"strength": test_strength, "amplitude": test_amp,
                                            "complete_coverage_n": len(season_rows)},
           "flagged_srule_v2": flagged_s,
           "s2s3_only_count": s2s3_count,
           "manual_review_queue": manual_queue,
           "companies": v10["companies"],
           "validation_per_list": val}
    op = HERE / "thing1_frame_audit_results_v12_pilot.json"
    op.write_text(json.dumps(out, indent=1, default=str))

    print("=== PILOT (EXPLORATORY) summary ===")
    print("panel n=%d | measured n=%d unmeasured n=%d | flagged among measured=%d (%.3f)"
          % (len(v10["companies"]), t2b["measured_n"], t2b["unmeasured_n"],
             t2b["flagged_among_measured"], t2b["flag_rate_measured"] or 0))
    print("\nseasonality test (complete-coverage n=%d):" % len(season_rows))
    print("  strength: %s" % json.dumps(test_strength))
    print("  amplitude: %s" % json.dumps(test_amp))
    print("\nflagged S-rule v2 classifications:")
    from collections import Counter
    print("  %s" % dict(Counter(s["classification"] for s in flagged_s.values())))
    print("  S2S3-ONLY count (would-have-reclassified): %d" % s2s3_count)
    print("\nvalidation alerts under v2 rule:")
    for k, e in val.items():
        if "s_rule" in e:
            print("  %-28s prod=%s cf=%s -> %s (%s) S1=%s E1=%s E2=%s S2=%s S3=%s"
                  % (k, e["alert"], e["cf_alert"], e["s_rule"]["classification"],
                     e["s_rule"].get("applies_to"),
                     e["s_rule"].get("S1"), e["s_rule"].get("E1"), e["s_rule"].get("E2"),
                     e["s_rule"].get("S2"), e["s_rule"].get("S3")))
    print("\nresults: %s" % op)


if __name__ == "__main__":
    main()
