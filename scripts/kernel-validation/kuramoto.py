#!/usr/bin/env python3
"""
kuramoto.py — implement the CANONICAL Book I formula (Kuramoto order parameter)
on EDGAR data and see if companies actually run through the phase grammar.

Book I maps the phase grammar to the Kuramoto order parameter r (coherence of
coupled oscillators):
  P0 null      : r ~ 0, low amplitude  (undifferentiated, quiet)
  P2 rhythm    : r high, stable         (phase-locked order)
  P3 fracture  : r drops, amplitude high (desynchronization / turbulence) [VALIDATED phase]
  P4 scaffold  : r restored by external driving term
  P6 order     : r high, multi-scale
  P7 shear     : r bistable / collapsing -> fork (7a absorbing / 7b unstable cycle)

Oscillators = the company's financial signals (Revenue, OCF, Cash, Debt, Assets).
Each signal's instantaneous PHASE comes from the Hilbert transform of its
detrended, z-scored series. r(t) = | (1/N) Sum_j exp(i*theta_j(t)) |.

THE TEST: does r stay high for healthy companies and DROP as a company
desynchronizes into bankruptcy? If yes, the canonical formula lives in the data.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

SIGNALS = [("Revenue", True), ("OCF", True), ("Cash", False),
           ("DebtLong", False), ("DebtCurrent", False)]


def hilbert_analytic(x):
    """Analytic signal via FFT (manual Hilbert transform; numpy only)."""
    x = np.asarray(x, float)
    n = len(x)
    X = np.fft.fft(x)
    h = np.zeros(n)
    if n % 2 == 0:
        h[0] = h[n // 2] = 1.0
        h[1:n // 2] = 2.0
    else:
        h[0] = 1.0
        h[1:(n + 1) // 2] = 2.0
    return np.fft.ifft(X * h)


def detrend_z(x):
    x = np.asarray(x, float)
    n = len(x)
    if n < 4 or np.std(x) == 0:
        return None
    t = np.arange(n)
    # remove linear trend
    a, b = np.polyfit(t, x, 1)
    r = x - (a * t + b)
    s = np.std(r)
    return r / s if s > 0 else None


def order_parameter(facts, cutoff):
    """Return (quarters, r(t), amplitude(t)) for the financial-oscillator panel."""
    series = {}
    for key, flow in SIGNALS:
        d = extract_pit(facts, lb.TAG_MAP[key], flow, cutoff)
        if d:
            series[key] = d
    if len(series) < 3:
        return None
    # common quarter axis
    allq = sorted(set.intersection(*[set(d.keys()) for d in series.values()]))
    if len(allq) < 8:
        # fall back to union with forward-fill-ish: use quarters present in >=3 signals
        from collections import Counter
        cnt = Counter(q for d in series.values() for q in d)
        allq = sorted(q for q, c in cnt.items() if c >= 3)
        if len(allq) < 8:
            return None
    # build phase for each signal
    phases, amps = [], []
    for key in series:
        vals = [series[key].get(q, np.nan) for q in allq]
        vals = np.array(vals, float)
        # fill gaps by linear interp
        idx = np.arange(len(vals))
        good = ~np.isnan(vals)
        if good.sum() < 6:
            continue
        vals = np.interp(idx, idx[good], vals[good])
        z = detrend_z(vals)
        if z is None:
            continue
        an = hilbert_analytic(z)
        phases.append(np.angle(an))
        amps.append(np.abs(an))
    if len(phases) < 3:
        return None
    phases = np.array(phases)          # [N_signals, T]
    amps = np.array(amps)
    r = np.abs(np.mean(np.exp(1j * phases), axis=0))   # order parameter per quarter
    amp = np.mean(amps, axis=0)
    return allq, r, amp


PANEL = [
    ("WMT",  "0000104169", None,         "healthy mature"),
    ("KO",   "0000021344", None,         "healthy mature"),
    ("AAPL", "0000320193", None,         "healthy"),
    ("JCP",  "0001166126", "2020-05-15", "slow decline -> Ch11"),
    ("BBBY", "0000886158", "2023-04-23", "masking -> Ch11"),
    ("CHK",  "0000895126", "2020-06-28", "commodity bankrupt"),
    ("SHLDQ","0001310067", "2018-10-15", "Sears -> liquidation"),
    ("REV",  "0000887921", "2022-06-15", "Revlon -> Ch11"),
]


def main():
    import time
    print("Kuramoto order parameter r(t) on EDGAR financial oscillators")
    print("  high r = phase-locked (healthy rhythm) | low r + amplitude = P3 desync\n")
    print("%-6s %-16s %-9s %-9s %s" % ("TICK", "type", "r_early", "r_late", "r(t) recent (x10)"))
    healthy_late, distress_late = [], []
    for (t, cik, cut, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        res = order_parameter(facts, cut)
        if res is None:
            print("%-6s %-16s insufficient" % (t, note)); continue
        q, r, amp = res
        n = len(r)
        r_early = float(np.mean(r[:max(2, n // 2)]))
        r_late = float(np.mean(r[-4:]))
        recent = "".join(str(min(9, int(v * 10))) for v in r[-12:])
        print("%-6s %-16s %-9.2f %-9.2f %s" % (t, note, r_early, r_late, recent))
        (healthy_late if cut is None else distress_late).append(r_late)
        time.sleep(0.2)
    av = lambda x: float(np.mean(x)) if x else 0
    print("\n  mean r_late — healthy %.2f | distress(pre-event) %.2f" % (av(healthy_late), av(distress_late)))
    print("  => if healthy r >> distress r, the Kuramoto order parameter discriminates phases.")


if __name__ == "__main__":
    main()
