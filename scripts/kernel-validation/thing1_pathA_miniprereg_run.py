#!/usr/bin/env python3
"""thing1_pathA_miniprereg_run.py — executes THING1_PATHA_MINIPREREG_v1.0
(operator-signed 2026-10-09, cache-only, EXPLORATORY).

Q1: alert quarters for the 17 >=$1B v1->shadow flips + event evidence
    (efts full-text snippets; instrument caveat recorded in the prereg).
Q2: feature-distribution shift, calibration cohort (v1 vs research frame).
Q3: seasonality variables on the 17 flips.
Writes thing1_pathA_miniprereg_results.json. Classifications are added by the
reviewer pass (frozen rules) — this script records raw evidence only.
"""
import json
import re
import sys
import time
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
for p in (str(REPO), str(REPO / "python_runtime"),
          str(REPO / "python_runtime" / "helix_app" / "thing1"),
          str(REPO / "python_runtime" / "helix_app" / "thing2"), str(HERE)):
    sys.path.insert(0, p)

import requests  # noqa: E402
import limen_app  # noqa: E402,F401
import limen_backtest as lb  # noqa: E402
from flows import decumulate  # noqa: E402
import financial_phase_map as fpm  # noqa: E402

CUTOFF = "2026-10-08"
UA = {"User-Agent": "limenhelix@gmail.com"}
FLIPS17 = ["CAR", "CCL", "CNX", "DO", "FRPT", "GM", "HTZ", "JPM", "M", "MCD",
           "NFE", "PYPL", "RCL", "RTX", "RYAM", "WHR", "WLL"]
CALIB16 = ["HTZ", "JCP", "CHK", "BBBY", "WE", "SIVB", "FRC", "SBNY",
           "CAR", "M", "XOM", "WMT", "JPM", "SLG", "SCHW", "USB"]

AUDIT = HERE / "shadow_cache_frame_audit"
files = {}
for d in (AUDIT, HERE / "shadow_cache"):
    for f in d.glob("facts_*.json"):
        files.setdefault(f.name.split("_")[1], f)


def build(facts, rev=None, ocf=None):
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
    cyq = (2026, 3)
    pit = {m: {q: v for q, v in s.items() if q <= cyq} for m, s in data.items()}
    df = lb.compute_all_features(pit, {})
    if df is None or df.empty:
        return None
    return lb.score_all_phases(lb.analyse_trajectory(df) if False else df) \
        if False else lb.analyse_trajectory(lb.score_all_phases(df))


def score(df):
    _, first_q, det = lb.compute_composite_score(df, event_str=CUTOFF,
                                                 p3_entry=limen_app.P3_ENTRY_FROZEN)
    return det, first_q


def season(vals):
    vals = [v for v in vals if v > 0]
    if len(vals) < 12:
        return None, None
    return fpm.temporal_dyad(vals)


def efts(query, tries=2):
    for a in range(tries):
        try:
            r = requests.get("https://efts.sec.gov/LATEST/search-index",
                             params={"q": query, "dateRange": "all"},
                             headers=UA, timeout=30)
            if r.status_code == 200:
                h = r.json().get("hits", {}).get("hits", [])
                out = []
                for x in h[:8]:
                    s = x.get("_source", {})
                    out.append({"date": s.get("file_date"), "form": s.get("form"),
                                "snippet": (x.get("highlight", {}).get("content", [""]) or [""])[0][:220]})
                return out
        except Exception:
            pass
        time.sleep(1.0 + a)
    return None


NAMES = {"CAR": "Avis Budget", "CCL": "Carnival", "CNX": "CNX Resources",
         "DO": "Diamond Offshore", "FRPT": "Freshpet", "GM": "General Motors",
         "HTZ": "Hertz", "JPM": "JPMorgan", "M": "Macy", "MCD": "McDonald",
         "NFE": "New Fortress Energy", "PYPL": "PayPal", "RCL": "Royal Caribbean",
         "RTX": "RTX", "RYAM": "Rayonier Advanced", "WHR": "Whirlpool", "WLL": "Whiting Petroleum"}


def main():
    out = {"config": {"prereg": "THING1_PATHA_MINIPREREG_v1.0.md",
                      "signed": "operator 2026-10-09", "cutoff": CUTOFF,
                      "designation": "EXPLORATORY", "cache_only": True},
           "q1_alert_quarters": {}, "q1_events": {}, "q2_shift": {}, "q3_seasonality": {}}

    # ---- Q1: alert quarters + events ----
    for t in FLIPS17:
        f = files.get(t)
        if not f:
            continue
        facts = json.loads(Path(f).read_text(encoding="utf-8"))
        rev_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).items()}
        ocf_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["OCF"], CUTOFF).items()}
        df1 = build(facts)
        df2 = build(facts, rev=rev_d, ocf=ocf_d)
        _, fq2 = score(df2)
        out["q1_alert_quarters"][t] = ("%dQ%d" % fq2) if fq2 else None
        nm = NAMES[t]
        ev = {}
        ev["item103"] = efts('"Item 1.03" "%s"' % nm)
        time.sleep(0.25)
        ev["covenant"] = efts('("covenant waiver" OR "covenant relief" OR "amendment to the credit agreement") "%s"' % nm)
        time.sleep(0.25)
        ev["dividend"] = efts('("dividend" ) "%s" "8-K"' % nm)
        time.sleep(0.25)
        ev["downgrade"] = efts('("downgraded" OR "downgrade") "%s"' % nm)
        time.sleep(0.25)
        out["q1_events"][t] = ev
        print("Q1 %s alert=%s events=%d/%d/%d/%d" %
              (t, out["q1_alert_quarters"][t],
               len(ev["item103"] or []), len(ev["covenant"] or []),
               len(ev["dividend"] or []), len(ev["downgrade"] or [])), flush=True)

    # ---- Q2: distribution shift on calibration cohort ----
    cols = ["z_var_Revenue", "z_ac_Revenue", "z_slope_Revenue", "p3"]
    for t in CALIB16:
        f = files.get(t)
        if not f:
            out["q2_shift"][t] = {"error": "no cached facts"}
            continue
        facts = json.loads(Path(f).read_text(encoding="utf-8"))
        rev_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).items()}
        ocf_d = {k: v for k, v in decumulate(facts, lb.TAG_MAP["OCF"], CUTOFF).items()}
        df1 = build(facts)
        df2 = build(facts, rev=rev_d, ocf=ocf_d)
        if df1 is None or df2 is None:
            out["q2_shift"][t] = {"error": "empty df"}
            continue
        ev1 = df1[df1["quarter"].apply(lambda q: q[0] >= 2015)]
        ev2 = df2[df2["quarter"].apply(lambda q: q[0] >= 2015)]
        d1, _ = score(df1)
        d2, _ = score(df2)
        rec = {"rows_v1": int(len(ev1)), "rows_shadow": int(len(ev2)),
               "rev_cov_v1": round(float(ev1["Revenue"].notna().mean()), 3),
               "rev_cov_shadow": round(float(ev2["Revenue"].notna().mean()), 3),
               "ocf_cov_v1": round(float(ev1["OCF"].notna().mean()), 3),
               "ocf_cov_shadow": round(float(ev2["OCF"].notna().mean()), 3),
               "stress_v1": d1.get("stress_rate"), "stress_shadow": d2.get("stress_rate"),
               "path_a_v1": d1.get("path_a"), "path_a_shadow": d2.get("path_a")}
        for c in cols:
            rec[c + "_v1"] = round(float(ev1[c].mean()), 3)
            rec[c + "_shadow"] = round(float(ev2[c].mean()), 3)
        out["q2_shift"][t] = rec
    # cohort summary
    ok = [r for r in out["q2_shift"].values() if "error" not in r]
    if ok:
        summ = {}
        for key in ("z_var_Revenue", "z_ac_Revenue", "z_slope_Revenue", "p3"):
            v1 = [r[key + "_v1"] for r in ok]
            sh = [r[key + "_shadow"] for r in ok]
            summ[key] = {"v1_mean": round(sum(v1) / len(v1), 3),
                         "shadow_mean": round(sum(sh) / len(sh), 3)}
        summ["stress_rate"] = {"v1_mean": round(sum(r["stress_v1"] for r in ok) / len(ok), 3),
                               "shadow_mean": round(sum(r["stress_shadow"] for r in ok) / len(ok), 3)}
        summ["coverage"] = {"rev_v1": round(sum(r["rev_cov_v1"] for r in ok) / len(ok), 3),
                            "rev_shadow": round(sum(r["rev_cov_shadow"] for r in ok) / len(ok), 3),
                            "ocf_v1": round(sum(r["ocf_cov_v1"] for r in ok) / len(ok), 3),
                            "ocf_shadow": round(sum(r["ocf_cov_shadow"] for r in ok) / len(ok), 3)}
        out["q2_summary"] = summ

    # ---- Q3: seasonality on the 17 flips ----
    for t in FLIPS17:
        f = files.get(t)
        if not f:
            continue
        facts = json.loads(Path(f).read_text(encoding="utf-8"))
        rev = [v for k, v in sorted(decumulate(facts, lb.TAG_MAP["Revenue"], CUTOFF).items())
               if k[0] >= 2015]
        coh, amp = season(rev)
        out["q3_seasonality"][t] = {"strength": coh, "amplitude": amp}

    op = HERE / "thing1_pathA_miniprereg_results.json"
    op.write_text(json.dumps(out, indent=1, default=str))
    print("\nresults: %s" % op)


if __name__ == "__main__":
    main()
