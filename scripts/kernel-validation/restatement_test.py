#!/usr/bin/env python3
"""
restatement_test.py — DIRECT test of the restatement-robustness mechanism
(engineer step #2). Not the inferred differential-recall argument — a direct
measurement.

For each company, hold the PERIOD SET fixed (all periods ending <= cutoff) and
compute every signal TWICE:
  ORIGINAL  — the value as ORIGINALLY filed for each period (earliest filing)
  RESTATED  — the value as it stands in the LATEST filing for each period

Then measure how far each SIGNAL moves between original and restated data:
  - Altman Z''  (ratio model, measures absolute levels)
  - LIMEN composite (trajectory, measures period-over-period shape)

Mechanism hypothesis: |ΔZ''| >> |Δcomposite|. If true, the trajectory is
directly shown to be restatement-robust where the ratio model is not.
Also reports the restatement RATE (fraction of periods whose value changed).
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb  # noqa: E402

ALT_CONCEPTS = {
    "Assets": (["Assets"], "instant"), "AssetsCurrent": (["AssetsCurrent"], "instant"),
    "LiabCurrent": (["LiabilitiesCurrent"], "instant"), "Liabilities": (["Liabilities"], "instant"),
    "Equity": (["StockholdersEquity"], "instant"), "RetainedEarn": (["RetainedEarningsAccumulatedDeficit"], "instant"),
    "EBIT": (["OperatingIncomeLoss"], "duration"),
}


def _period_values(facts, tags, is_flow, period_cutoff, mode):
    """Per-period value dict, choosing original (earliest filed) or restated
    (latest filed) for each period ending <= cutoff. Returns (dict, n_restated)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    from datetime import datetime
    for tag in tags:
        node = gaap.get(tag.split("/")[-1])
        if not node:
            continue
        arr = node["units"].get("USD") or (list(node["units"].values())[0] if node["units"] else [])
        by_period = {}
        for e in arr:
            if e.get("form", "") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                continue
            end, filed, val, start = e.get("end"), e.get("filed"), e.get("val"), e.get("start")
            if not end or val is None or not filed:
                continue
            if period_cutoff and end > period_cutoff:
                continue
            if is_flow:
                if not start:
                    continue
                try:
                    days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
                except Exception:
                    continue
                if not (60 <= days <= 120):
                    continue
            by_period.setdefault(end, []).append((filed, val))
        if not by_period:
            continue
        out, n_restated = {}, 0
        for end, entries in by_period.items():
            entries.sort()  # by filed date
            orig, rest = entries[0][1], entries[-1][1]
            if orig != rest:
                n_restated += 1
            out[end] = orig if mode == "original" else rest
        if len(out) >= 2:
            return out, n_restated
    return {}, 0


def _alt_value(facts, tags, period_cutoff, mode):
    d, _ = _period_values(facts, tags, False, period_cutoff, mode)
    if not d:
        return None
    return d[max(d)]   # latest period


def altman_mode(facts, cutoff, mode):
    g = lambda k: _alt_value(facts, ALT_CONCEPTS[k][0], cutoff, mode)
    TA = g("Assets")
    if not TA:
        return None
    AC, LC = g("AssetsCurrent") or 0, g("LiabCurrent") or 0
    EQ = g("Equity")
    TL = g("Liabilities")
    if TL is None and EQ is not None:
        TL = TA - EQ
    TL = TL or (TA - (EQ or 0))
    EQ = EQ if EQ is not None else TA - (TL or 0)
    RE, EBIT = g("RetainedEarn") or 0, g("EBIT") or 0
    X1, X2, X3 = (AC - LC) / TA, RE / TA, EBIT / TA
    X4 = (EQ / TL) if TL else 0.0
    return 3.25 + 6.56 * X1 + 3.26 * X2 + 6.72 * X3 + 1.05 * X4


def comp_mode(facts, cutoff, mode):
    def yq(d):  # end-date dict -> quarter dict
        from datetime import datetime
        return {lb.date_to_quarter(datetime.strptime(k, "%Y-%m-%d")): v for k, v in d.items()}
    rev, nr_rev = _period_values(facts, lb.TAG_MAP["Revenue"], True, cutoff, mode)
    ocf, _ = _period_values(facts, lb.TAG_MAP["OCF"], True, cutoff, mode)
    cash, _ = _period_values(facts, lb.TAG_MAP["Cash"], False, cutoff, mode)
    dc, _ = _period_values(facts, lb.TAG_MAP["DebtCurrent"], False, cutoff, mode)
    dl, _ = _period_values(facts, lb.TAG_MAP["DebtLong"], False, cutoff, mode)
    data = {"Revenue": yq(rev), "OCF": yq(ocf), "Cash": yq(cash)}
    dcq, dlq = yq(dc), yq(dl)
    allq = sorted(set(list(dcq) + list(dlq)))
    data["Debt"] = {q: dcq.get(q, 0) + dlq.get(q, 0) for q in allq}
    if not any(data.values()):
        return None, nr_rev
    df = lb.compute_all_features(data, {})
    if df is None or df.empty:
        return None, nr_rev
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    try:
        c, _, _ = lb.compute_composite_score(df, None, lb.HOLDOUT_P3_ENTRY)
        return round(float(c), 2), nr_rev
    except Exception:
        return None, nr_rev


CASES = [
    ("CHK", "0000895126", "2020-06-28"), ("BBBY", "0000886158", "2023-04-23"),
    ("WLL", "0001255474", "2020-04-01"), ("DNR", "0000945764", "2020-07-30"),
    ("JCP", "0001166126", "2020-05-15"), ("REV", "0000887921", "2022-06-15"),
    ("ENDP", "0001593034", "2022-08-16"), ("SHLDQ", "0001310067", "2018-10-15"),
]


def main():
    print("DIRECT restatement-bias test: same periods, original vs restated values\n")
    print("%-6s | %-18s | %-18s | %s" % ("TICK", "Altman Z'' o->r (Δ)", "Composite o->r (Δ)", "restated periods"))
    dz, dc = [], []
    for (t, cik, ev) in CASES:
        facts = lb.fetch_sec_facts(cik)
        zo, zr = altman_mode(facts, ev, "original"), altman_mode(facts, ev, "restated")
        co, nr = comp_mode(facts, ev, "original")
        cr, _ = comp_mode(facts, ev, "restated")
        zd = (abs(zr - zo)) if (zo is not None and zr is not None) else None
        cd = (abs(cr - co)) if (co is not None and cr is not None) else None
        if zd is not None:
            dz.append(zd)
        if cd is not None:
            dc.append(cd)
        zs = "%6s->%6s (%s)" % (zo, zr, ("%.2f" % zd) if zd is not None else "-")
        cs = "%5s->%5s (%s)" % (co, cr, ("%.2f" % cd) if cd is not None else "-")
        print("%-6s | %-18s | %-18s | %d" % (t, zs, cs, nr))
        time.sleep(0.2)
    av = lambda x: sum(x) / len(x) if x else 0
    print("\n  Avg |Δ Altman Z''|  = %.2f  (ratio model — absolute levels)" % av(dz))
    print("  Avg |Δ Composite|   = %.2f  (trajectory — period-over-period shape)" % av(dc))
    if av(dc) > 0:
        print("  Ratio model moves %.1fx more than the trajectory under restatement." % (av(dz) / av(dc)))
    print("\n  => if Z'' moves >> composite, restatement-robustness of the trajectory is DIRECTLY shown.")


if __name__ == "__main__":
    main()
