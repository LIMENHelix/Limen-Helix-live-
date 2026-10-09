#!/usr/bin/env python3
"""thing1_v101_shadow.py — SHADOW PHASE of the v1.0.1 extraction delta.

SIGNED by operator 2026-10-08 ("Signed: draft v3 shadow phase — cache only,
no pulls, no locked-file changes. Run it.").

Scores every cached company twice at cutoff 2026-10-08:
  v1     : production extraction (limen_backtest.extract_quarterly_series)
  shadow : v1.0.1 adapter — Revenue AND OCF from research PIT de-cumulation
           (flows.decumulate, shared with Thing 2); Cash/Debt unchanged.
Kernel limen_backtest.py is imported read-only and never modified.
Report-only: writes thing1_v101_shadow_results.json + printed summary.
"""
import json
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

import limen_app  # noqa: E402,F401  (stubs mpl/sklearn; imports locked kernel)
import limen_backtest as lb  # noqa: E402
from flows import decumulate  # noqa: E402

CUTOFF = "2026-10-08"
CACHE_DIRS = [HERE / "shadow_cache_frame_audit", HERE / "shadow_cache"]


def _cut_yq():
    d = datetime.strptime(CUTOFF, "%Y-%m-%d")
    return (d.year, (d.month - 1) // 3 + 1)


def build(facts, cutoff, rev=None, ocf=None):
    data = {
        "Revenue": rev if rev is not None else
        lb.extract_quarterly_series(facts, lb.TAG_MAP["Revenue"], "Revenue", True),
        "OCF": ocf if ocf is not None else
        lb.extract_quarterly_series(facts, lb.TAG_MAP["OCF"], "OCF", True),
        "Cash": lb.extract_quarterly_series(facts, lb.TAG_MAP["Cash"], "Cash", False),
    }
    dc = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtCurrent"], "DC", False)
    dl = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtLong"], "DL", False)
    all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}
    cyq = _cut_yq()
    pit = {m: {q: v for q, v in s.items() if q <= cyq} for m, s in data.items()}
    df = lb.compute_all_features(pit, {})
    if df is None or df.empty:
        return None
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    return df


def score(df):
    composite, first_q, det = lb.compute_composite_score(
        df, event_str=CUTOFF, p3_entry=limen_app.P3_ENTRY_FROZEN)
    alert = (det.get("path_a", 0) >= lb.COMPOSITE_THRESH_A or
             det.get("path_b", 0) >= lb.COMPOSITE_THRESH_B or
             det.get("path_c", 0) >= lb.COMPOSITE_THRESH_C)
    return det, bool(alert)


def ttm_rev(rev):
    ks = sorted(rev)
    if len(ks) < 4:
        return None
    last4 = ks[-4:]
    # require the 4 most recent measured quarters (consecutive in availability)
    return sum(rev[k] for k in last4)


def main():
    files = {}
    for cd in CACHE_DIRS:
        for f in cd.glob("facts_*.json"):
            t = f.name.split("_")[1]
            files.setdefault(t, f)
    print("companies cached: %d" % len(files))
    rows = []
    for t, f in sorted(files.items()):
        facts = json.loads(Path(f).read_text(encoding="utf-8"))
        rec = {"ticker": t}
        rev_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).items()}
        ocf_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["OCF"], CUTOFF).items()}
        df1 = build(facts, CUTOFF)
        df2 = build(facts, CUTOFF, rev=rev_d, ocf=ocf_d)
        if df1 is None or df2 is None:
            rec["error"] = "no data (v1=%s shadow=%s)" % (df1 is None, df2 is None)
            rows.append(rec)
            continue
        ev1 = df1[df1["quarter"].apply(lambda q: q[0] >= 2015)]
        ev2 = df2[df2["quarter"].apply(lambda q: q[0] >= 2015)]
        d1, a1 = score(df1)
        d2, a2 = score(df2)
        rec.update({
            "rows_v1": int(len(ev1)), "rows_shadow": int(len(ev2)),
            "rev_cov_v1": round(float(ev1["Revenue"].notna().mean()), 3),
            "rev_cov_shadow": round(float(ev2["Revenue"].notna().mean()), 3),
            "ocf_cov_v1": round(float(ev1["OCF"].notna().mean()), 3),
            "ocf_cov_shadow": round(float(ev2["OCF"].notna().mean()), 3),
            "alert_v1": a1, "alert_shadow": a2,
            "pa_v1": d1.get("path_a"), "pa_shadow": d2.get("path_a"),
            "pb_v1": d1.get("path_b"), "pb_shadow": d2.get("path_b"),
            "pc_v1": d1.get("path_c"), "pc_shadow": d2.get("path_c"),
            "stress_v1": d1.get("stress_rate"), "stress_shadow": d2.get("stress_rate"),
            "ttm_rev": ttm_rev({k: v for k, v in rev_d.items() if k[0] >= 2015}),
        })
        if a1 != a2:
            gained = [p for p, th in (("A", 1.1), ("B", 1.5), ("C", 1.5))
                      if (d2.get("path_%s" % p.lower(), 0) >= th)
                      and (d1.get("path_%s" % p.lower(), 0) < th)]
            lost = [p for p, th in (("A", 1.1), ("B", 1.5), ("C", 1.5))
                    if (d1.get("path_%s" % p.lower(), 0) >= th)
                    and (d2.get("path_%s" % p.lower(), 0) < th)]
            rec["delta"] = {"to": "SHADOW" if a2 else "V1",
                            "gained_paths": gained, "lost_paths": lost}
        rows.append(rec)

    n = len([r for r in rows if "error" not in r])
    flips = [r for r in rows if r.get("delta")]
    to_shadow = [r for r in flips if r["delta"]["to"] == "SHADOW"]
    to_v1 = [r for r in flips if r["delta"]["to"] == "V1"]
    big = [r for r in rows if "error" not in r and (r.get("ttm_rev") or 0) >= 1e9]
    big_flips = [r for r in big if r.get("delta")]
    print("\n=== SHADOW PHASE summary (cutoff %s) ===" % CUTOFF)
    print("scored n=%d | alert v1=%d shadow=%d" %
          (n, sum(1 for r in rows if r.get("alert_v1")),
           sum(1 for r in rows if r.get("alert_shadow"))))
    print("flips: %d total | to-shadow %d | to-v1 %d" % (len(flips), len(to_shadow), len(to_v1)))
    print(">=$1B TTM rev stratum: n=%d | alerts v1=%d shadow=%d | flips=%d" %
          (len(big), sum(1 for r in big if r.get("alert_v1")),
           sum(1 for r in big if r.get("alert_shadow")), len(big_flips)))
    print("\nflips detail:")
    for r in flips:
        print("  %-6s ->%-7s revcov %.2f->%.2f ocfcov %.2f->%.2f "
              "A %.2f->%.2f B %.2f->%.2f C %.2f->%.2f gained=%s lost=%s ttm_rev=%s" %
              (r["ticker"], r["delta"]["to"], r["rev_cov_v1"], r["rev_cov_shadow"],
               r["ocf_cov_v1"], r["ocf_cov_shadow"],
               r["pa_v1"] or 0, r["pa_shadow"] or 0, r["pb_v1"] or 0, r["pb_shadow"] or 0,
               r["pc_v1"] or 0, r["pc_shadow"] or 0,
               r["delta"]["gained_paths"], r["delta"]["lost_paths"],
               None if r.get("ttm_rev") is None else "%.2fB" % (r["ttm_rev"] / 1e9)))
    op = HERE / "thing1_v101_shadow_results.json"
    op.write_text(json.dumps({"config": {"signed": "operator 2026-10-08",
                                         "cutoff": CUTOFF,
                                         "delta": "Revenue+OCF via flows.decumulate; Cash/Debt unchanged; kernel untouched"},
                              "companies": rows}, indent=1, default=str))
    print("\nresults: %s" % op)


if __name__ == "__main__":
    main()
