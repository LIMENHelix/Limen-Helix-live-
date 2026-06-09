#!/usr/bin/env python3
"""
lead_time.py — Does Altman Z'' fire EARLY or LATE?

For each known bankruptcy, compute Z'' (ratio/solvency snapshot) and the LIMEN
composite (trajectory) at the event date and 1/2/3 years BEFORE it. The question
that decides whether the phase kernel has surviving value:

  - If Z'' only crosses into distress near the event (lagging), but the LIMEN
    trajectory elevates earlier (leading), then ratios+trajectory fusion gives
    BOTH accuracy AND lead time — a genuinely novel combination.
  - If Z'' already flags 2-3 years out, the trajectory adds little and the
    honest move is to narrow to the ratio model.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb       # noqa: E402
import altman                     # noqa: E402
from validate_v3 import build_df, _window  # noqa: E402
from datetime import datetime

# distress co's with reliable CIK + event date
CASES = [
    ("CHK",  "0000895126", "2020-06-28"),
    ("BBBY", "0000886158", "2023-04-23"),
    ("WE",   "0001813756", "2023-11-06"),
    ("JCP",  "0001166126", "2020-05-15"),
    ("DNR",  "0000945764", "2020-07-30"),
    ("REV",  "0000887921", "2022-06-15"),
    ("ENDP", "0001593034", "2022-08-16"),
    ("AVYA", "0001418100", "2023-02-14"),
    ("PRTY", "0001592058", "2023-01-17"),
    ("RAD",  "0000084129", "2023-10-15"),
]


def shift_years(date_str, years):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.replace(year=d.year - years).strftime("%Y-%m-%d")


def limen_composite_at(df, cutoff):
    if df is None:
        return None
    try:
        c, _, _ = lb.compute_composite_score(df, cutoff, lb.HOLDOUT_P3_ENTRY)
        return round(float(c), 2)
    except Exception:
        return None


def main():
    print("Z'' (distress if <1.1) and LIMEN composite (alert if >=1.1) at T and 1/2/3y before bankruptcy\n")
    print("%-6s | %-26s | %-26s" % ("TICK", "Altman Z''  (T / -1y / -2y / -3y)", "LIMEN comp (T / -1y / -2y / -3y)"))
    z_lead, l_lead = [], []
    for (t, cik, ev) in CASES:
        df = build_df(cik)
        zs, ls = [], []
        for yrs in [0, 1, 2, 3]:
            cutoff = ev if yrs == 0 else shift_years(ev, yrs)
            try:
                z = altman.altman_z2(cik, cutoff)
                zs.append(z.get("Z") if not z.get("error") else None)
            except Exception:
                zs.append(None)
            ls.append(limen_composite_at(df, cutoff))
            time.sleep(0.15)
        zf = " / ".join("%6s" % ("-" if v is None else v) for v in zs)
        lf = " / ".join("%5s" % ("-" if v is None else v) for v in ls)
        # earliest lead (years) each flags distress
        zlead = max([y for y, v in zip([0, 1, 2, 3], zs) if v is not None and v < 1.1] + [-1])
        llead = max([y for y, v in zip([0, 1, 2, 3], ls) if v is not None and v >= 1.1] + [-1])
        z_lead.append(zlead); l_lead.append(llead)
        print("%-6s | %-26s | %-26s   Zlead=%dy Llead=%dy" % (t, zf, lf, zlead, llead))

    def avg(x):
        x = [v for v in x if v >= 0]
        return sum(x) / len(x) if x else 0
    print("\n  Avg earliest-flag lead — Altman: %.1fy   LIMEN: %.1fy" % (avg(z_lead), avg(l_lead)))
    print("  (higher = earlier warning. 3y = flagged at the -3y snapshot.)")


if __name__ == "__main__":
    main()
