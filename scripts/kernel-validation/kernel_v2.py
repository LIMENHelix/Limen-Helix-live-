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
OCF_POS_FRAC_HEALTHY = 0.75   # >=75% of recent quarters with positive OCF = cash-generating
OCF_WINDOW = 8                # quarters of OCF history to judge "healthy"
PATH_B_DAMP = 0.45            # Path B multiplier when OCF is healthy
PATH_C_DAMP = 0.0             # Path C multiplier for an uncorroborated rupture (0 = suppress)
SUSTAIN_TAIL = 3              # final quarters checked for sustained P3 stress


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

    # OCF health: fraction of recent quarters with positive operating cash flow
    ocf = dfw["OCF"].values.astype(float) if "OCF" in dfw.columns else np.array([])
    ocf = ocf[~np.isnan(ocf)]
    recent = ocf[-OCF_WINDOW:] if len(ocf) >= OCF_WINDOW else ocf
    ocf_pos_frac = float((recent > 0).mean()) if len(recent) else 1.0
    ocf_healthy = ocf_pos_frac >= OCF_POS_FRAC_HEALTHY

    # Sustained stress: P3 still at/above entry in the final quarters of the window
    p3v = dfw["p3"].values.astype(float) if "p3" in dfw.columns else np.array([])
    tail = p3v[-SUSTAIN_TAIL:] if len(p3v) >= 1 else np.array([])
    sustained = bool((tail >= p3_entry).any()) if len(tail) else False

    # ── Path B discriminator ──
    pb_v2 = pb
    if ocf_healthy:
        pb_v2 = pb * PATH_B_DAMP

    # ── Path C discriminator ──
    pc_v2 = pc
    if pc >= lb.COMPOSITE_THRESH_C and ocf_healthy and not sustained:
        pc_v2 = pc * PATH_C_DAMP   # uncorroborated rupture in a healthy company = artifact

    comp_v2 = max(pa, pb_v2, pc_v2)
    d2 = dict(details)
    d2["path_a"], d2["path_b"], d2["path_c"] = pa, pb_v2, pc_v2
    d2["_v2_ocf_pos_frac"] = round(ocf_pos_frac, 2)
    d2["_v2_ocf_healthy"] = ocf_healthy
    d2["_v2_sustained"] = sustained
    return comp_v2, first_q, d2
