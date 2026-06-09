#!/usr/bin/env python3
"""
pit_trajectory.py — Does the LIMEN trajectory's early-warning signal survive
POINT-IN-TIME-CLEAN data?

The locked kernel's extract_quarterly_series keys by period-END and ingests
restated values (lookahead). This builds a clean data dict using ONLY values
publicly FILED on or before the cutoff, taking the AS-ORIGINALLY-REPORTED value
per quarter (earliest filing), then runs it through the kernel's own pipeline
(compute_all_features -> score_all_phases -> analyse_trajectory ->
compute_composite_score) WITHOUT modifying the locked kernel.

Compares kernel-composite (lookahead) vs clean-composite at the event and 1/2/3y
before, for the distress cohort — does the trajectory still elevate EARLY on the
masking cases (BBBY, DNR) once restatements are removed?
"""
import sys, os, time
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb       # noqa: E402
from validate_v3 import build_df  # noqa: E402  (kernel/lookahead df builder)

TAGS = {
    "Revenue": (lb.TAG_MAP["Revenue"], True),
    "OCF":     (lb.TAG_MAP["OCF"], True),
    "Cash":    (lb.TAG_MAP["Cash"], False),
    "DebtCurrent": (lb.TAG_MAP["DebtCurrent"], False),
    "DebtLong":    (lb.TAG_MAP["DebtLong"], False),
}


def extract_pit(facts, tag_names, is_flow, cutoff):
    """As-originally-reported quarterly series, filings <= cutoff. MERGES across
    all tags (fixes ASC-606-style tag changes that truncated the series at the
    switch year) and DE-CUMULATES YTD flow reporters (cash-flow statements are
    YTD-only; the old 60-120-day filter dropped all but Q1)."""
    us_gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    merged = {}  # yq -> (filed, val); first tag (then earliest filing) wins
    for tag_path in tag_names:
        node = us_gaap.get(tag_path.split("/")[-1])
        if not node:
            continue
        arr = node.get("units", {}).get("USD") or (list(node.get("units", {}).values())[0] if node.get("units") else [])
        if is_flow:
            # collect per-(start,end) period, earliest filing <= cutoff
            periods = {}
            for e in arr:
                if e.get("form", "") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                    continue
                val, end, filed, start = e.get("val"), e.get("end"), e.get("filed"), e.get("start")
                if val is None or not end or not filed or not start:
                    continue
                if cutoff and filed > cutoff:
                    continue
                try:
                    days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
                except Exception:
                    continue
                if not (75 <= days <= 400):       # quarter through annual
                    continue
                k = (start, end)
                if k not in periods or filed < periods[k][0]:
                    periods[k] = (filed, val)
            # group by fiscal-year start, difference consecutive cumulatives
            groups = {}
            for (start, end), (filed, val) in periods.items():
                groups.setdefault(start, []).append((end, filed, val))
            for start, lst in groups.items():
                lst.sort()                         # by end date
                prev = 0.0
                for (end, filed, val) in lst:
                    yq = lb.date_to_quarter(datetime.strptime(end, "%Y-%m-%d"))
                    if yq not in merged:
                        merged[yq] = (filed, val - prev)
                    prev = val
        else:
            for e in arr:
                if e.get("form", "") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                    continue
                val, end, filed = e.get("val"), e.get("end"), e.get("filed")
                if val is None or not end or not filed:
                    continue
                if cutoff and filed > cutoff:
                    continue
                try:
                    end_dt = datetime.strptime(end, "%Y-%m-%d")
                except Exception:
                    continue
                yq = lb.date_to_quarter(end_dt)
                if yq not in merged or filed < merged[yq][0]:
                    merged[yq] = (filed, val)
    return {yq: v for yq, (f, v) in merged.items()}


def clean_df(facts, cutoff):
    data = {
        "Revenue": extract_pit(facts, lb.TAG_MAP["Revenue"], True, cutoff),
        "OCF":     extract_pit(facts, lb.TAG_MAP["OCF"], True, cutoff),
        "Cash":    extract_pit(facts, lb.TAG_MAP["Cash"], False, cutoff),
    }
    dc = extract_pit(facts, lb.TAG_MAP["DebtCurrent"], False, cutoff)
    dl = extract_pit(facts, lb.TAG_MAP["DebtLong"], False, cutoff)
    allq = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in allq}
    if not any(data.values()):
        return None
    df = lb.compute_all_features(data, {})
    if df is None or df.empty:
        return None
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    return df


def comp(df, cutoff):
    if df is None:
        return None
    try:
        c, _, _ = lb.compute_composite_score(df, cutoff, lb.HOLDOUT_P3_ENTRY)
        return round(float(c), 2)
    except Exception:
        return None


def shift(date_str, years):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.replace(year=d.year - years).strftime("%Y-%m-%d")


CASES = [
    ("CHK", "0000895126", "2020-06-28"), ("BBBY", "0000886158", "2023-04-23"),
    ("WE", "0001813756", "2023-11-06"), ("JCP", "0001166126", "2020-05-15"),
    ("DNR", "0000945764", "2020-07-30"), ("REV", "0000887921", "2022-06-15"),
    ("ENDP", "0001593034", "2022-08-16"), ("RAD", "0000084129", "2023-10-15"),
]


def main():
    print("KERNEL composite (lookahead) vs CLEAN composite (point-in-time) — alert if >=1.1\n")
    print("%-6s | %-26s | %-26s" % ("TICK", "KERNEL (T/-1/-2/-3y)", "CLEAN  (T/-1/-2/-3y)"))
    k_lead, c_lead = [], []
    for (t, cik, ev) in CASES:
        facts = lb.fetch_sec_facts(cik)
        kdf = build_df(cik)              # lookahead df
        ks, cs = [], []
        for yrs in [0, 1, 2, 3]:
            cut = ev if yrs == 0 else shift(ev, yrs)
            ks.append(comp(kdf, cut))
            cs.append(comp(clean_df(facts, cut), cut))
            time.sleep(0.15)
        kf = " / ".join("%5s" % ("-" if v is None else v) for v in ks)
        cf = " / ".join("%5s" % ("-" if v is None else v) for v in cs)
        kl = max([y for y, v in zip([0, 1, 2, 3], ks) if v is not None and v >= 1.1] + [-1])
        cl = max([y for y, v in zip([0, 1, 2, 3], cs) if v is not None and v >= 1.1] + [-1])
        k_lead.append(kl); c_lead.append(cl)
        print("%-6s | %-26s | %-26s  Klead=%s Clead=%s" % (
            t, kf, cf, "%dy" % kl if kl >= 0 else "miss", "%dy" % cl if cl >= 0 else "miss"))
    av = lambda x: sum(v for v in x if v >= 0) / max(1, len([v for v in x if v >= 0]))
    nhit = lambda x: len([v for v in x if v >= 0])
    print("\n  KERNEL (lookahead): %d/%d flagged, avg lead %.1fy" % (nhit(k_lead), len(k_lead), av(k_lead)))
    print("  CLEAN (point-in-time): %d/%d flagged, avg lead %.1fy" % (nhit(c_lead), len(c_lead), av(c_lead)))
    print("\n  => if CLEAN holds, the trajectory's early-warning is real, not lookahead.")


if __name__ == "__main__":
    main()
