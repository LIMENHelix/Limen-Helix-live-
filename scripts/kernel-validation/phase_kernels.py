#!/usr/bin/env python3
"""
phase_kernels.py — the ACTUAL architecture: ONE KERNEL PER PHASE.

The monolithic score_all_phases collapses to P4/flatness because it scores 11
phases from one shared feature set (feature underdetermination). The fix is an
ensemble of specialists: each phase kernel answers a single BINARY question
("is the system in THIS phase?") in its OWN feature space.

Each kernel below maps a Book I phase signature to a financial observable.
This file proves the architecture: each binary detector fires cleanly on the
right companies where the 11-way argmax could not separate anything.

Phase signatures (Book I -> finance):
  P0 Source       : null symmetry        -> flat low-variance, solvent, no trend
  P2 Rhythm       : Kuramoto phase-lock  -> stable bounded oscillation
  P3 Fracture     : pattern instability  -> rising variance/slope (VALIDATED)
  P4 Scaffolding  : exogenous support    -> living on raised capital (CFF+ , OCF-)
  P5 Endurance    : internal recursion   -> recovered on own OCF, no raise
  P7 Shear/fork   : bifurcation          -> viability breach (7a) vs viable core (7b)
"""
import sys, os
import numpy as np
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                         # noqa: E402
from pit_trajectory import clean_df, extract_pit  # noqa: E402

CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def annual_flow(facts, tags, cutoff):
    """Most recent ANNUAL (FY ~365-day) flow value, filed<=cutoff. Use this for
    cash-flow signals: the quarterly extractor breaks on cumulative-YTD reporters
    (validated in p45_validate.py — fixed P4/P5 from 0.42 to 1.00)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    best = None
    for tag in tags:
        node = gaap.get(tag.split("/")[-1])
        if not node:
            continue
        for e in node.get("units", {}).get("USD") or []:
            start, end, filed, val = e.get("start"), e.get("end"), e.get("filed"), e.get("val")
            if not (start and end and val is not None):
                continue
            try:
                days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
            except Exception:
                continue
            if not (330 <= days <= 400):
                continue
            if cutoff and (end > cutoff or (filed and filed > cutoff)):
                continue
            key = (end, filed or "")
            if best is None or key > (best[0], best[1]):
                best = (end, filed or "", val)
    return best[2] if best else None


def _series(facts, tag_key, is_flow, cutoff):
    return [v for _, v in sorted(extract_pit(facts, lb.TAG_MAP[tag_key], is_flow, cutoff).items())]


def _cff(facts, cutoff):
    return [v for _, v in sorted(extract_pit(facts, CFF_TAGS, True, cutoff).items())]


# ── one detector per phase: returns (fires: bool, score, evidence) ──

def k_p0_source(facts, cutoff, dfc):
    """Null symmetry: flat, low-variance, solvent — undifferentiated baseline."""
    rev = _series(facts, "Revenue", True, cutoff)[-8:]
    if len(rev) < 4:
        return False, 0.0, "insufficient"
    cv = np.std(rev) / (abs(np.mean(rev)) + 1e-9)            # coefficient of variation
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    fires = cv < 0.08 and zval is not None and zval > 2.6
    return fires, round(1 - min(cv / 0.08, 1), 2), "cv=%.3f z=%s" % (cv, zval)


def k_p2_rhythm(facts, cutoff, dfc):
    """P2 = dyadic recurrence x_n = f(x_{n-1}, x_{n-2}) HOLDING (operator algebra).
    Operationalized as AR(2) coherence (R^2) across the core signals: a healthy
    system follows its own dyadic recurrence (high coherence); P3 is this
    recurrence breaking (|R|>theta -> decoherence). Validated directionally
    (dyadic.py): healthy mean 0.61 vs distress 0.39."""
    import dyadic
    coh = dyadic.coherence(facts, cutoff)
    if coh is None:
        return False, 0.0, "insufficient"
    return coh > 0.5, round(coh, 2), "ar2_coherence=%.2f" % coh


def k_p3_fracture(facts, cutoff, dfc, ticker=None):
    """Pattern instability — the VALIDATED masking/instability composite, with an
    optional market-equity VETO: if the market values equity > 1.2x total
    liabilities, the trajectory is buyback/structural noise, not distress (kills
    COST/PEP/FIS/SBUX). Real distress (BBBY/JCP/PIR) has a collapsed market cap
    so it is NOT vetoed."""
    if dfc is None:
        return False, 0.0, "no df"
    try:
        c, _, _ = lb.compute_composite_score(dfc, cutoff, lb.HOLDOUT_P3_ENTRY)
    except Exception:
        return False, 0.0, "err"
    fires = c >= 1.1
    if fires and ticker:
        import marketcap
        _, ratio = marketcap.mve_to_liabilities(facts, ticker, cutoff)
        if ratio is not None and ratio > 1.2:
            return False, round(float(c), 2), "composite=%.2f VETOED(mve/tl=%.1f)" % (c, ratio)
    return fires, round(float(c), 2), "composite=%.2f" % c


def k_p4_scaffold(facts, cutoff, dfc):
    """P4 = R_int = integral R_i: survival BOUND by external capital. VALIDATED
    (p45_validate.py 6/6): annual OCF burning AND financing inflow plugging it
    (cff > 0.5*|ocf|). Annual flows + no solvency guard (annual OCF<0 already
    excludes cash machines). Would collapse if the raised capital stopped."""
    import flows
    ocf = flows.ttm_flow(facts, lb.TAG_MAP["OCF"], cutoff)
    cff = flows.ttm_flow(facts, flows.CFF_TAGS, cutoff)
    if ocf is None or cff is None:
        return False, 0.0, "no flows"
    fires = ocf < 0 and cff > 0.5 * abs(ocf)
    cover = cff / abs(ocf) if ocf else 0
    return fires, round(min(max(cover, 0), 3) / 3, 2), "ocf=%.0fM cff=%.0fM cff/|ocf|=%.1f" % (
        ocf / 1e6, cff / 1e6, cover)


def k_p5_endurance(facts, cutoff, dfc):
    """P5 = Delta = R_new - R_old: a new self-sustaining regime on the system's
    OWN operating cash (opposite of P4). VALIDATED (p45_validate.py 6/6): annual
    OCF positive AND operations dominate financing (cff < ocf)."""
    import flows
    ocf = flows.ttm_flow(facts, lb.TAG_MAP["OCF"], cutoff)
    cff = flows.ttm_flow(facts, flows.CFF_TAGS, cutoff)
    if ocf is None or cff is None:
        return False, 0.0, "no flows"
    fires = ocf > 0 and cff < ocf
    return fires, round(1.0 if fires else 0.0, 2), "ocf=%.0fM cff=%.0fM" % (ocf / 1e6, cff / 1e6)


def k_p7_fork(facts, cutoff, dfc):
    """Bifurcation node (VALIDATED, p7_validate.py: 77% on 22 labeled outcomes).
    The discriminator is the VIABLE CORE = operating cash to reorganize around,
    NOT equity (equity is negative for liquidators AND survivors alike).
      OCF/assets > 0  -> 7b restructure (viable core)
      OCF/assets <= 0 -> 7a liquidate   (no core, terminal)
    Known blind spots: intangible cores (brand/franchise -> REV, RAD emerged on
    negative OCF) and retailer-lender hybrids (CONN)."""
    TA = altman._latest(facts, ["Assets"], "instant", cutoff)
    ocf = sum(_series(facts, "OCF", True, cutoff)[-4:]) if _series(facts, "OCF", True, cutoff) else None
    if TA is None or TA == 0 or ocf is None:
        return "unknown", 0.0, "no data"
    ocf_ta = ocf / TA
    fork = "7b_restructure" if ocf_ta > 0 else "7a_liquidate"
    return fork, round(ocf_ta, 3), "ocf/ta=%.3f" % ocf_ta


def k_p1_collapse(facts, cutoff, dfc):
    """P1 = R(Σ)→R(L), Σ̇≈0: collapse to a localized frozen core — an ACUTE
    single-quarter rupture (sudden contraction in revenue or cash)."""
    # only the RECENT transitions — P1 is collapsing NOW, not any past sharp quarter
    rev = _series(facts, "Revenue", True, cutoff)[-3:]
    cash = _series(facts, "Cash", False, cutoff)[-3:]
    drops = []
    for s in (rev, cash):
        for i in range(1, len(s)):
            if s[i - 1] and abs(s[i - 1]) > 0:
                drops.append((s[i] - s[i - 1]) / abs(s[i - 1]))
    if not drops:
        return False, 0.0, "insufficient"
    worst = min(drops)
    return worst < -0.40, round(abs(worst), 2), "recent_q_drop=%.0f%%" % (worst * 100)


def k_p6_order(facts, cutoff, dfc):
    """P6 = x(t)→ω-lock: mature coordinated ORDER — strong solvency + dyadic
    coherence + growing (active order, vs P0's quiet null)."""
    import dyadic
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    coh = dyadic.coherence(facts, cutoff)
    rev = _series(facts, "Revenue", True, cutoff)[-8:]
    growing = len(rev) >= 4 and np.mean(rev[-2:]) > np.mean(rev[:2])
    fires = (zval is not None and zval > 4 and coh is not None and coh > 0.5 and growing)
    return fires, round(coh or 0, 2), "z=%s coh=%.2f grow=%s" % (
        ("%.1f" % zval) if zval else "?", coh or 0, growing)


def _kendall(y):
    y = np.asarray(y, float)
    n = len(y)
    if n < 3:
        return 0.0
    s = sum(np.sign(y[j] - y[i]) for i in range(n) for j in range(i + 1, n))
    return s / (0.5 * n * (n - 1))


def k_p8_reflection(facts, cutoff, dfc):
    """P8 = R(R): recursion on itself — proactive self-repair, a SUSTAINED
    DELEVERAGING trend (debt/assets falling steadily). Was-layer adds prior-
    distress (deleveraging from a high-leverage start = self-correction)."""
    dc = _series(facts, "DebtCurrent", False, cutoff)[-8:]
    dl = _series(facts, "DebtLong", False, cutoff)[-8:]
    n = min(len(dc), len(dl))
    if n < 5:
        return False, 0.0, "insufficient"
    debt = [dc[-n + i] + dl[-n + i] for i in range(n)]
    tau = _kendall(debt)                      # sustained direction of debt
    if not debt[0]:
        return False, 0.0, "no debt"
    chg = (debt[-1] - debt[0]) / abs(debt[0])
    fires = tau < -0.4 and chg < -0.08        # steadily down, materially
    return fires, round(abs(min(tau, 0)), 2), "debt_trend=%.2f chg=%.0f%%" % (tau, chg * 100)


def k_p9_threshold(facts, cutoff, dfc):
    """P9 = R_syn=∪Rᵢ: the POISED threshold — high leverage + composite ELEVATED
    but not yet full rupture (0.8 ≤ comp < 2.0) + not clearly safe. The knife-edge
    BEFORE the P3 fracture, not the fracture itself."""
    TA = altman._latest(facts, ["Assets"], "instant", cutoff)
    TL = altman._latest(facts, ["Liabilities"], "instant", cutoff)
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    c = 0.0
    if dfc is not None:
        try:
            c, _, _ = lb.compute_composite_score(dfc, cutoff, lb.HOLDOUT_P3_ENTRY)
        except Exception:
            c = 0.0
    lev = (TL / TA) if (TA and TL) else 0
    fires = (lev > 0.65 and 0.8 <= c < 2.0 and (zval is None or zval < 3.0))
    return fires, round(float(c), 2), "comp=%.2f lev=%.2f z=%s" % (
        c, lev, ("%.1f" % zval) if zval else "?")


def k_p10_return(facts, cutoff, dfc):
    """P10 = R→S₀: return to a (transformed) stable baseline — solvent, low
    composite, positive own cash. Was-layer distinguishes it from P0 (prior
    distress = returned; no prior distress = never left)."""
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    c = 0.0
    if dfc is not None:
        try:
            c, _, _ = lb.compute_composite_score(dfc, cutoff, lb.HOLDOUT_P3_ENTRY)
        except Exception:
            c = 0.0
    ocf = annual_flow(facts, lb.TAG_MAP["OCF"], cutoff)
    fires = (zval is not None and zval > 2.6 and c < 0.8 and ocf is not None and ocf > 0)
    return fires, round(1.0 if fires else 0.0, 2), "z=%s comp=%.2f ocf+=%s" % (
        ("%.1f" % zval) if zval else "?", c, (ocf or 0) > 0)


KERNELS = [("P0_source", k_p0_source), ("P1_collapse", k_p1_collapse),
           ("P2_rhythm", k_p2_rhythm), ("P3_fracture", k_p3_fracture),
           ("P4_scaffold", k_p4_scaffold), ("P5_endurance", k_p5_endurance),
           ("P6_order", k_p6_order), ("P7_fork", k_p7_fork),
           ("P8_reflection", k_p8_reflection), ("P9_threshold", k_p9_threshold),
           ("P10_return", k_p10_return)]

# hand-labeled face-validity panel: which phase SHOULD dominate
PANEL = [
    ("WMT",  "0000104169", None, "mature stable -> P0/P2/P6"),
    ("KO",   "0000021344", None, "mature stable -> P0/P2"),
    ("WE",   "0001813756", "2022-06-30", "burning on raised capital -> P4 scaffold"),
    ("JCP",  "0001166126", "2019-06-30", "operational erosion -> P3"),
    ("BBBY", "0000886158", "2022-06-30", "masking -> P3"),
    ("CHK",  "0000895126", "2020-06-28", "viable core bankrupt -> P7b restructure"),
    ("SHLDQ","0001310067", "2018-10-15", "viability breach -> P7a liquidate"),
    ("DAL",  "0000027904", "2021-06-30", "post-COVID recovery on own cash -> P5"),
    ("T",    "0000732717", None,         "AT&T deleveraging post-WarnerMedia -> P8"),
    ("CCL",  "0000815097", "2020-08-31", "COVID acute rupture -> P1"),
    ("WBD",  "0001437107", "2023-06-30", "Warner Bros Discovery levered cliff -> P9"),
]


def main():
    import time
    print("ONE KERNEL PER PHASE — each fires in its own feature space\n")
    for (t, cik, cut, expect) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        dfc = clean_df(facts, cut)
        print("%-6s  (%s)" % (t, expect))
        fired = []
        for name, fn in KERNELS:
            res, score, ev = fn(facts, cut, dfc)
            if name == "P7_fork":
                print("        %-13s -> %-14s [%s]" % (name, res, ev))
            else:
                mark = "FIRES" if res else "  .  "
                if res:
                    fired.append(name)
                print("        %-13s %s score=%-4s [%s]" % (name, mark, score, ev))
        print("        => dominant: %s\n" % (", ".join(fired) or "none"))
        time.sleep(0.2)


if __name__ == "__main__":
    main()
