#!/usr/bin/env python3
"""
HELD-OUT test (pre-registered 2026-06-12). The ONLY two kernels with INDEPENDENT
external ground truth:
  P3-fracture  -> label = bankruptcy filing (objective)         [anchor = Thing 1]
  P7-fork      -> label = Ch7 liquidate vs Ch11 reorg+emerge    [linchpin = new?]
P0/P4/P5/P6 are DEFINITIONAL (deterministic functions of reported numbers) -> no
external label -> NOT tested (held-out accuracy would be tautological). Stated before
running, not after.

FROZEN company lists below — disjoint from ALL design panels (BBBY/JCP/SHLD/SHLDQ/
GME/REV/CHK/WE/RAD/PIR/CONN). No swapping after seeing results.

PRE-COMMITTED thresholds: Holds acc>=0.75 & WilsonLB>=0.60 | Degraded 0.60-0.75 &
LB>=0.50 | Falls LB<0.50.  THING-3 CRITERION: requires P7 (non-P3) to HOLD.
"""
import sys, os, math, json
import urllib.request
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_kernels as pk            # noqa: E402
from pit_trajectory import clean_df   # noqa: E402

# (ticker, point-in-time cutoff BEFORE filing, P7 outcome) — outcome from public record.
HELDOUT_BANKRUPT = [
    ("HTZ",  "2020-03-31", "7b_restructure"),   # Hertz 2020 -> emerged 2021
    ("VAL",  "2020-06-30", "7b_restructure"),   # Valaris 2020 -> emerged 2021
    ("WLL",  "2020-03-31", "7b_restructure"),   # Whiting 2020 -> emerged
    ("DO",   "2020-03-31", "7b_restructure"),   # Diamond Offshore 2020 -> emerged
    ("FTR",  "2020-03-31", "7b_restructure"),   # Frontier 2020 -> emerged 2021
    ("MNK",  "2020-06-30", "7b_restructure"),   # Mallinckrodt 2020 -> emerged
    ("NMRD", "2020-03-31", "7b_restructure"),   # (resolve-or-skip)
    ("YELL", "2023-06-30", "7a_liquidate"),     # Yellow 2023 -> liquidated
    ("TUEM", "2022-12-31", "7a_liquidate"),     # Tuesday Morning 2023 -> liquidated
    ("EXPR", "2023-12-31", "7a_liquidate"),     # Express 2024 -> sold/liquidated
    ("FRG",  "2023-06-30", "7a_liquidate"),     # (resolve-or-skip)
    ("DDS_x","2019-12-31", "7a_liquidate"),     # placeholder resolve-or-skip
]
HELDOUT_HEALTHY = ["LMT", "GD", "NOC", "UNP", "CSX", "NSC", "ADP", "PAYX",
                   "MMC", "TRV", "PGR", "WM"]


def t2c():
    req = urllib.request.Request("https://www.sec.gov/files/company_tickers.json",
                                 headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in d.values()}


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, c - h), min(1.0, c + h))


def verdict(lb_):
    return "HOLDS" if lb_ >= 0.60 else ("DEGRADED" if lb_ >= 0.50 else "FALLS")


def main():
    C = t2c()
    # ---------- P3-fracture (anchor) ----------
    tp = fp = tn = fn = 0
    miss = []
    for (t, cut, _o) in HELDOUT_BANKRUPT:
        if t not in C:
            continue
        try:
            facts = lb.fetch_sec_facts(C[t])
            dfc = clean_df(facts, cut)
            fires, sc, ev = pk.k_p3_fracture(facts, cut, dfc, ticker=t)
        except Exception:
            continue
        if fires:
            tp += 1
        else:
            fn += 1
            miss.append("%s(%s)" % (t, ev))
    for t in HELDOUT_HEALTHY:
        if t not in C:
            continue
        try:
            facts = lb.fetch_sec_facts(C[t])
            dfc = clean_df(facts, None)
            fires, sc, ev = pk.k_p3_fracture(facts, None, dfc, ticker=t)
        except Exception:
            continue
        if fires:
            fp += 1
        else:
            tn += 1
    n3 = tp + fp + tn + fn
    acc3 = (tp + tn) / n3 if n3 else 0
    p3p, p3lo, p3hi = wilson(tp + tn, n3)
    rec = tp / (tp + fn) if (tp + fn) else 0
    prec = tp / (tp + fp) if (tp + fp) else 0

    # ---------- P7-fork (linchpin) ----------
    p7_ok = p7_n = 0
    p7_detail = []
    for (t, cut, outcome) in HELDOUT_BANKRUPT:
        if t not in C:
            continue
        try:
            facts = lb.fetch_sec_facts(C[t])
            dfc = clean_df(facts, cut)
            fork, sc, ev = pk.k_p7_fork(facts, cut, dfc)
        except Exception:
            continue
        if fork in ("7a_liquidate", "7b_restructure"):
            p7_n += 1
            hit = (fork == outcome)
            p7_ok += 1 if hit else 0
            p7_detail.append("%-6s pred=%-15s actual=%-15s %s" % (t, fork, outcome, "OK" if hit else "X"))
    p7p, p7lo, p7hi = wilson(p7_ok, p7_n)

    print("=" * 64)
    print("HELD-OUT TEST — pre-registered, frozen list, external labels only")
    print("=" * 64)
    print("\nP3-FRACTURE (anchor; label = bankruptcy)  n=%d" % n3)
    print("  TP=%d FN=%d | TN=%d FP=%d" % (tp, fn, tn, fp))
    print("  accuracy=%.2f  Wilson95=[%.2f, %.2f]  recall=%.2f precision=%.2f -> %s" % (
        acc3, p3lo, p3hi, rec, prec, verdict(p3lo)))
    if miss:
        print("  P3 missed (bankrupt, did not fire): %s" % ", ".join(miss))
    print("\nP7-FORK (linchpin; label = Ch7 liquidate vs Ch11 emerge)  n=%d" % p7_n)
    for d in p7_detail:
        print("   " + d)
    print("  accuracy=%.2f  Wilson95=[%.2f, %.2f] -> %s%s" % (
        p7p, p7lo, p7hi, verdict(p7lo), "  (UNDERPOWERED)" if p7_n < 10 else ""))
    print("\n" + "-" * 64)
    print("THING-3 CRITERION (pre-committed): P7 must HOLD (non-P3 external kernel).")
    if p7_n < 10:
        print("VERDICT: P7 n=%d < 10 -> UNDERPOWERED; cannot certify Thing 3 on this set" % p7_n)
        print("         regardless of point accuracy. P3 anchor: %s." % verdict(p3lo))
    else:
        print("VERDICT: Thing 3 %s" % ("SUPPORTED" if verdict(p7lo) == "HOLDS" else "NOT supported"))


if __name__ == "__main__":
    main()
