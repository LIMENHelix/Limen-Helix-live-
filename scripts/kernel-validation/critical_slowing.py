#!/usr/bin/env python3
"""
critical_slowing.py — the CANONICAL bifurcation-approach formula for the distress
phases (P2->P3->P7). Book I's P3 row = "pre-bifurcation regime, loss of stable
attractor." The established math for detecting an approaching bifurcation from a
time series is CRITICAL SLOWING DOWN (Scheffer et al., Nature 2009; Dakos 2012):

  as a system approaches a tipping point, its recovery from perturbations slows,
  so VARIANCE rises and LAG-1 AUTOCORRELATION (AR1) rises toward 1.

This is the rigorous version of what the validated P3 kernel measures. Test:
does the trend of (variance, AR1) RISE before bankruptcy (distress) and stay
FLAT for healthy companies? Trend measured by Kendall's tau over rolling windows.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

WIN = 6   # rolling window (quarters)


def kendall_tau(y):
    y = np.asarray(y, float)
    n = len(y)
    if n < 4:
        return 0.0
    s = 0
    for i in range(n):
        for j in range(i + 1, n):
            s += np.sign(y[j] - y[i])
    return s / (0.5 * n * (n - 1))


def ar1(x):
    x = np.asarray(x, float)
    if len(x) < 3 or np.std(x) == 0:
        return 0.0
    x = x - x.mean()
    denom = np.sum(x[:-1] ** 2)
    return float(np.sum(x[:-1] * x[1:]) / denom) if denom > 0 else 0.0


def csd_signal(facts, cutoff, key="Cash", flow=False):
    """Return Kendall trend of rolling variance and rolling AR1 for one signal
    (positive = critical slowing down = approaching a bifurcation)."""
    d = extract_pit(facts, lb.TAG_MAP[key], flow, cutoff)
    if not d or len(d) < WIN + 4:
        return None
    vals = np.array([v for _, v in sorted(d.items())], float)
    # work on residuals after removing slow trend (Gaussian-ish via moving average)
    if np.std(vals) == 0:
        return None
    # detrend with a short moving average to isolate fluctuations
    k = 3
    ma = np.convolve(vals, np.ones(k) / k, mode="same")
    resid = vals - ma
    var_series, ar_series = [], []
    for i in range(WIN, len(resid) + 1):
        w = resid[i - WIN:i]
        var_series.append(np.var(w))
        ar_series.append(ar1(w))
    if len(var_series) < 4:
        return None
    return kendall_tau(var_series), kendall_tau(ar_series)


def csd_combined(facts, cutoff):
    """Average CSD trend across the core signals (variance + AR1 trends)."""
    out = []
    for key, flow in [("Cash", False), ("Revenue", True), ("OCF", True)]:
        r = csd_signal(facts, cutoff, key, flow)
        if r:
            out.append(r)
    if not out:
        return None
    var_t = float(np.mean([v for v, a in out]))
    ar_t = float(np.mean([a for v, a in out]))
    return var_t, ar_t


PANEL = [
    ("WMT",  "0000104169", None,         0, "healthy mature"),
    ("KO",   "0000021344", None,         0, "healthy mature"),
    ("AAPL", "0000320193", None,         0, "healthy"),
    ("PG",   "0000080424", None,         0, "healthy"),
    ("JCP",  "0001166126", "2020-05-15", 1, "slow decline -> Ch11"),
    ("BBBY", "0000886158", "2023-04-23", 1, "masking -> Ch11"),
    ("CHK",  "0000895126", "2020-06-28", 1, "commodity bankrupt"),
    ("SHLDQ","0001310067", "2018-10-15", 1, "Sears -> liquidation"),
    ("REV",  "0000887921", "2022-06-15", 1, "Revlon -> Ch11"),
    ("WLL",  "0001255474", "2020-04-01", 1, "Whiting -> Ch11"),
]


def main():
    import time
    print("CRITICAL SLOWING DOWN (Scheffer 2009) — trend of variance & AR1 approaching event")
    print("  positive trend = approaching a bifurcation (P3->P7); flat/neg = stable\n")
    print("%-6s %-22s %-9s %-9s %s" % ("TICK", "type", "var_trend", "ar1_trend", "CSD?"))
    h_csd, d_csd = [], []
    for (t, cik, cut, label, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        r = csd_combined(facts, cut)
        if r is None:
            print("%-6s %-22s insufficient" % (t, note)); continue
        var_t, ar_t = r
        csd = (var_t + ar_t) / 2
        flag = "RISING" if csd > 0.15 else ("flat" if csd > -0.15 else "falling")
        print("%-6s %-22s %-9.2f %-9.2f %s" % (t, note, var_t, ar_t, flag))
        (d_csd if label else h_csd).append(csd)
        time.sleep(0.2)
    av = lambda x: float(np.mean(x)) if x else 0
    print("\n  mean CSD — healthy %.2f | distress %.2f" % (av(h_csd), av(d_csd)))
    print("  => if distress CSD >> healthy, critical slowing down detects the approaching bifurcation.")


if __name__ == "__main__":
    main()
