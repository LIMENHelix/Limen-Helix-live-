#!/usr/bin/env python3
"""
DARK SLICE — the continuous, always-on substrate (Book I + real neuroscience), not a
discrete label. Per company over time, compute TWO measured quantities the literature
says govern a self-organized-critical, allostatically-regulated system:

  r(t)  = inter-line COHERENCE  (Kuramoto order parameter over the 5 regulatory lines'
          momentum/acceleration phase). High r = lines regulate in concert (P6/order);
          r collapses = decoherence (P3/fracture). This is the COMPUTED r (no longer
          narrative) -- answers "compute it or drop it" with: compute it.
  S(t)  = CRITICAL SLOWING DOWN susceptibility (rising variance + rising lag-1
          autocorrelation of the aggregate regulatory momentum). Documented EARLY-WARNING
          signal of regime transitions in real complex systems. The honest forecast test:
          does S RISE BEFORE the break the old label-engine caught only coincidentally?

Test, unbiased: (a) does r ebb & flow DISTINCTLY across companies, or smear to uniform?
(b) does S lead the documented break (lead >= 2q) or merely coincide (~1q)?
NOT building the brain -- one measurable slice, then look at what it says.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402

EPS = 1e-9


def _z(a):
    a = np.asarray(a, float)
    m = a[~np.isnan(a)]
    if len(m) < 3 or np.std(m) < EPS:
        return np.full(len(a), np.nan)
    return (a - np.nanmean(m)) / (np.nanstd(m) + EPS)


def lines(qs, rows):
    """5 regulatory lines as YoY momentum series aligned on qs (NaN where unavailable)."""
    n = len(qs)
    rev = np.array([rows[q]["rev"] if rows[q]["rev"] else np.nan for q in qs], float)
    cost = np.array([rows[q]["cost"] if rows[q]["cost"] else np.nan for q in qs], float)
    opinc = np.array([rows[q]["opinc"] if rows[q]["opinc"] is not None else np.nan for q in qs], float)
    ocf = np.array([rows[q]["ocf"] if rows[q]["ocf"] is not None else np.nan for q in qs], float)
    debt = np.array([rows[q]["debt"] if rows[q]["debt"] else np.nan for q in qs], float)
    gm = np.where((rev > 0) & ~np.isnan(cost), (rev - cost) / rev, np.nan)
    om = np.where(rev > 0, opinc / rev, np.nan)

    def yoy_g(x):                                   # growth for flow lines
        o = np.full(n, np.nan)
        for i in range(4, n):
            if not np.isnan(x[i]) and not np.isnan(x[i - 4]) and abs(x[i - 4]) > EPS:
                o[i] = (x[i] - x[i - 4]) / (abs(x[i - 4]) + EPS)
        return o

    def yoy_d(x):                                   # delta for ratio lines
        o = np.full(n, np.nan)
        for i in range(4, n):
            if not np.isnan(x[i]) and not np.isnan(x[i - 4]):
                o[i] = x[i] - x[i - 4]
        return o

    L = {"rev": yoy_g(rev), "gm": yoy_d(gm), "om": yoy_d(om),
         "ocf": yoy_g(ocf), "debt": -yoy_g(debt)}   # debt flipped: + = deleveraging (health-aligned)
    return {k: _z(v) for k, v in L.items()}


def coherence_susceptibility(qs, rows, W=6):
    L = lines(qs, rows)
    n = len(qs)
    keys = list(L)
    M = np.vstack([L[k] for k in keys])             # 5 x n standardized momentum
    A = np.full_like(M, np.nan)                     # acceleration
    A[:, 1:] = np.diff(M, axis=1)
    r = np.full(n, np.nan)
    for t in range(n):
        th = []
        for j in range(len(keys)):
            if not np.isnan(M[j, t]) and not np.isnan(A[j, t]):
                th.append(np.arctan2(A[j, t], M[j, t]))
        if len(th) >= 3:
            r[t] = abs(np.mean(np.exp(1j * np.array(th))))
    # aggregate regulatory momentum (health-oriented mean across lines)
    c = np.nanmean(M, axis=0)
    var = np.full(n, np.nan)
    ar1 = np.full(n, np.nan)
    for t in range(W, n):
        w = c[t - W:t + 1]
        w = w[~np.isnan(w)]
        if len(w) >= 4:
            var[t] = np.var(w)
            if np.std(w[:-1]) > EPS and np.std(w[1:]) > EPS:
                ar1[t] = np.corrcoef(w[:-1], w[1:])[0, 1]
    S = _z(var) + _z(ar1)                            # critical slowing down: both rise -> transition
    return r, S, c


def break_quarter(qs, rows):
    """first sustained DOWN per the OLD label-engine, after a non-down stretch."""
    ph = iw.persist([iw.arbitrate(qs, rows, i) for i in range(len(qs))])
    down = {"P3-fracture", "coherent-decline"}
    for i in range(9, len(qs)):
        if ph[i] in down and ph[i - 1] not in down and any(ph[j] and ph[j] not in down for j in range(max(0, i - 6), i)):
            return i
    return None


# EXTERNALLY-KNOWN stress onsets (dividend cuts / bankruptcy run-ups / public collapses).
# Hard-coded so I CANNOT move them to fit the result. PLACEBO = mid-history window for a
# healthy firm with NO known break = the negative control (must NOT light up).
PANEL = [("INTC", "0000050863", "broke", (2022, 3)), ("BBBY", "0000886158", "broke", (2022, 2)),
         ("GE", "0000040545", "broke", (2017, 4)), ("WBA", "0000104207", "broke", (2023, 3)),
         ("NVDA", "0001045810", "broke", (2022, 3)),
         ("MSFT", "0000789019", "placebo", (2016, 1)), ("KO", "0000021344", "placebo", (2017, 1)),
         ("JNJ", "0000200406", "placebo", (2015, 1))]

# PRE-COMMITTED criteria (set BEFORE seeing output):
#  broke   -> dr <= -0.15 (coherence collapses vs own baseline) AND S_max > +1.0 with lead >= 2q
#  placebo -> dr > -0.10 (no collapse) AND no sustained S > +1.0
#  if broke and placebo are indistinguishable -> idea FAILS -> drop the forecast claim, keep
#  only the substrate reframe (continuous spectrum) as description, not prediction.


def _win(a, qs, lo, hi):
    v = [a[i] for i in range(max(0, lo), min(len(qs), hi + 1)) if not np.isnan(a[i])]
    return v


def main():
    import time
    print("%-6s %-8s | base_r appr_r   dr  | S_max  S_lead | verdict" % ("tkr", "kind"))
    print("-" * 66)
    res = []
    for (t, cik, kind, bdate) in PANEL:
        try:
            facts = lb.fetch_sec_facts(cik)
            qs, rows = iw.build(facts)
            r, S, c = coherence_susceptibility(qs, rows)
            bi = qs.index(bdate) if bdate in qs else min(range(len(qs)), key=lambda i: abs(qs[i][0] * 4 + qs[i][1] - bdate[0] * 4 - bdate[1]))
        except Exception as ex:
            print("%-6s ERR %s" % (t, str(ex)[:40]))
            continue
        base = _win(r, qs, bi - 16, bi - 8)          # firm's own earlier baseline
        appr = _win(r, qs, bi - 6, bi)               # approach to the break
        base_r = float(np.median(base)) if base else float("nan")
        appr_r = float(np.median(appr)) if appr else float("nan")
        dr = appr_r - base_r
        # susceptibility in the approach window + lead (first q in window with S>1, sustained next q)
        S_max, S_lead = -9.0, 0
        for k in range(6, -1, -1):
            j = bi - k
            if 0 <= j < len(qs) and not np.isnan(S[j]):
                S_max = max(S_max, S[j])
                if S[j] > 1.0 and k >= 1 and j + 1 < len(qs) and not np.isnan(S[j + 1]) and S[j + 1] > 0.5 and S_lead == 0:
                    S_lead = k
        if kind == "broke":
            ok = (dr <= -0.15) and (S_max > 1.0) and (S_lead >= 2)
        else:
            ok = (dr > -0.10) and not (S_max > 1.0)
        res.append((kind, ok, dr, S_max, S_lead))
        print("%-6s %-8s | %5.2f  %5.2f  %+5.2f | %+5.1f   %3dq  | %s" % (
            t, kind, base_r, appr_r, dr, S_max, S_lead, "PASS" if ok else "fail"))
        time.sleep(0.15)
    nb = sum(1 for k, o, *_ in res if k == "broke" and o)
    npl = sum(1 for k, o, *_ in res if k != "broke" and o)
    tb = sum(1 for k, *_ in res if k[0] == "broke")
    tpl = sum(1 for k, *_ in res if k[0] != "broke")
    print("\nbroke PASS %d/%d   placebo PASS %d/%d" % (nb, tb, npl, tpl))
    drb = [d for k, o, d, *_ in res if k == "broke"]
    drp = [d for k, o, d, *_ in res if k != "broke"]
    print("median dr  broke=%.2f  placebo=%.2f  (separation = %.2f)" % (
        np.median(drb), np.median(drp), np.median(drp) - np.median(drb)))
    print("VERDICT: separation > ~0.15 AND broke leads >=2q => continuous slice carries forecast signal.")
    print("         else => keep the continuous SUBSTRATE as description; DROP the forecast claim (honest).")


if __name__ == "__main__":
    main()
