#!/usr/bin/env python3
"""
kernel_v2.py — Candidate v2 composite, built as a WRAPPER over the locked v1
kernel. It does NOT modify limen_backtest.py. It takes v1's per-path scores and
the kernel's own feature dataframe, then applies two evidence-based
discriminators motivated by the v1 false-positive analysis:

  Path B (cash decline): a cash decline financed by HEALTHY operating cash flow
    is capital return (buybacks/capex/M&A), not distress. Dampen Path B when
    operating cash flow is consistently positive across the scored window.

  Path C (rupture): a single-quarter cash/debt/variance rupture in a
    cash-generating company that is NOT still stressed at the end of the window
    is almost always an M&A/accounting artifact (e.g. Kroger/Albertsons), not a
    distress event. Suppress Path C unless it is corroborated by either weak OCF
    or sustained stress.

Both discriminators read columns the locked kernel already produces (OCF, p3).
Tunable constants live at the top so we can iterate empirically.
"""
import numpy as np
import limen_backtest as lb

# ── Tunable discriminator constants ──
WINDOW = 8                    # quarters of history to judge trajectory
REV_DECLINE_SLOPE = -0.01     # mean revenue slope below this = eroding top line
REV_DECLINE_PCT = -0.15       # total revenue change below this = eroding top line
OCF_COLLAPSE_PCT = -0.50      # OCF fallback when revenue can't be parsed
PATH_A_DAMP = 0.5             # Path A multiplier when NOT in distress
PATH_B_DAMP = 0.45            # Path B multiplier when NOT in distress
PATH_C_DAMP = 0.0             # Path C multiplier for an uncorroborated rupture (0 = suppress)
LOWER_TIER = 0.60            # in-distress companies alert at this lower composite (slow decliners)


def _scored_window(df, event_str):
    dfw = df[df["quarter"].apply(lambda q: q[0] >= lb.START_YEAR)].copy()
    if event_str:
        from datetime import datetime
        ev = lb.date_to_quarter(datetime.strptime(event_str, "%Y-%m-%d"))
        dfw = dfw[dfw["quarter"].apply(lambda q: q <= ev)]
    return dfw


def compute_composite_v2(df, event_str, p3_entry):
    composite, first_q, details = lb.compute_composite_score(df, event_str, p3_entry)
    pa = float(details.get("path_a", 0.0))
    pb = float(details.get("path_b", 0.0))
    pc = float(details.get("path_c", 0.0))

    dfw = _scored_window(df, event_str)
    if dfw.empty:
        return composite, first_q, details

    # ── Distress context = the top line is actually eroding ──
    # The cleanest separator (phases conflate volatility with distress; revenue
    # direction doesn't). A company with growing/flat revenue is not failing,
    # regardless of cash mechanics — that's the difference between Paychex
    # (+37%) / HII (+4%) and Chesapeake (−77%) / JCP (−48%). When revenue can't
    # be parsed (e.g. BBBY), fall back to an OCF-collapse test.
    def _chg(series):
        v = series[~np.isnan(series)]
        v = v[-WINDOW:] if len(v) >= WINDOW else v
        if len(v) >= 2 and v[0] != 0:
            return float(v[-1] / abs(v[0]) - 1.0)
        return None

    rev = dfw["Revenue"].values.astype(float) if "Revenue" in dfw.columns else np.array([])
    rev_change = _chg(rev)
    rs_col = dfw["slope_Revenue"].values.astype(float) if "slope_Revenue" in dfw.columns else np.array([])
    rev_slope = float(np.nanmean(rs_col)) if len(rs_col) and not np.all(np.isnan(rs_col)) else None
    revenue_known = (rev_change is not None) or (rev_slope is not None)

    revenue_declining = False
    if rev_slope is not None and rev_slope < REV_DECLINE_SLOPE:
        revenue_declining = True
    if rev_change is not None and rev_change < REV_DECLINE_PCT:
        revenue_declining = True

    ocf = dfw["OCF"].values.astype(float) if "OCF" in dfw.columns else np.array([])
    ocf_change = _chg(ocf)
    ocf_mean = float(np.nanmean(ocf[-WINDOW:])) if len(ocf[~np.isnan(ocf)]) else 0.0
    ocf_collapsing = (ocf_mean < 0) or (ocf_change is not None and ocf_change < OCF_COLLAPSE_PCT)

    # In distress when the top line is eroding, or (revenue unreadable) OCF is
    # collapsing. Otherwise the alert mechanics are capital-return / noise.
    in_distress = revenue_declining or ((not revenue_known) and ocf_collapsing)

    pa_v2 = pa if in_distress else pa * PATH_A_DAMP
    pb_v2 = pb if in_distress else pb * PATH_B_DAMP
    pc_v2 = pc
    if pc >= lb.COMPOSITE_THRESH_C and not in_distress:
        pc_v2 = pc * PATH_C_DAMP   # rupture without top-line erosion = M&A/accounting artifact

    comp_v2 = max(pa_v2, pb_v2, pc_v2)

    # ── Distress-tier (slow decliners) ──
    # A company with eroding revenue showing meaningful but sub-threshold stress
    # is a slow-decay failure (the doc's documented retail blind spot, e.g. JCP).
    # Safe to promote to an alert because healthy companies are in_distress=False
    # and never reach here.
    if in_distress and LOWER_TIER <= comp_v2 < lb.COMPOSITE_THRESH_A:
        pa_v2 = lb.COMPOSITE_THRESH_A
        comp_v2 = max(pa_v2, pb_v2, pc_v2)

    d2 = dict(details)
    d2["path_a"], d2["path_b"], d2["path_c"] = pa_v2, pb_v2, pc_v2
    d2["_v2_rev_change"] = round(rev_change, 2) if rev_change is not None else None
    d2["_v2_rev_slope"] = round(rev_slope, 4) if rev_slope is not None else None
    d2["_v2_in_distress"] = in_distress
    return comp_v2, first_q, d2
