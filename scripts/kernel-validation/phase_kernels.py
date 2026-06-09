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
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman                         # noqa: E402
from pit_trajectory import clean_df, extract_pit  # noqa: E402

CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


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


def k_p3_fracture(facts, cutoff, dfc):
    """Pattern instability — the VALIDATED masking/instability composite."""
    if dfc is None:
        return False, 0.0, "no df"
    try:
        c, _, _ = lb.compute_composite_score(dfc, cutoff, lb.HOLDOUT_P3_ENTRY)
    except Exception:
        return False, 0.0, "err"
    return (c >= 1.1), round(float(c), 2), "composite=%.2f" % c


def k_p4_scaffold(facts, cutoff, dfc):
    """Exogenous support: living on RAISED capital — financing inflow funding an
    operating-cash deficit. Would collapse if the external capital stopped."""
    ocf = _series(facts, "OCF", True, cutoff)[-4:]
    cff = _cff(facts, cutoff)[-4:]
    if len(ocf) < 2 or len(cff) < 2:
        return False, 0.0, "insufficient"
    ocf_ttm, cff_ttm = sum(ocf), sum(cff)
    # burning operationally AND plugging the hole with financing inflow AND not
    # independently solvent (a cash machine with a one-off negative-OCF quarter
    # is NOT scaffolded — guard on solvency).
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    solvent = zval is not None and zval > 2.6
    fires = ocf_ttm < 0 and cff_ttm > 0 and cff_ttm > 0.5 * abs(ocf_ttm) and not solvent
    cover = (cff_ttm / abs(ocf_ttm)) if ocf_ttm < 0 else 0
    return fires, round(min(cover, 2) / 2, 2), "ocf=%.0fM cff=%.0fM cover=%.1f" % (
        ocf_ttm / 1e6, cff_ttm / 1e6, cover)


def k_p5_endurance(facts, cutoff, dfc):
    """Internal recursion: recovered on its OWN cash — OCF turned/held positive
    WITHOUT relying on financing inflow (the opposite of P4 scaffolding)."""
    ocf = _series(facts, "OCF", True, cutoff)[-6:]
    cff = _cff(facts, cutoff)[-6:]
    if len(ocf) < 4:
        return False, 0.0, "insufficient"
    recent_ocf = sum(ocf[-4:])
    cff_ttm = sum(cff[-4:]) if len(cff) >= 4 else 0
    # positive operating cash, NOT propped by financing (cff <= 0 = repaying, not raising)
    fires = recent_ocf > 0 and cff_ttm <= 0
    return fires, round(1.0 if fires else 0.0, 2), "ocf=%.0fM cff=%.0fM" % (
        recent_ocf / 1e6, cff_ttm / 1e6)


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


KERNELS = [("P0_source", k_p0_source), ("P2_rhythm", k_p2_rhythm),
           ("P3_fracture", k_p3_fracture), ("P4_scaffold", k_p4_scaffold),
           ("P5_endurance", k_p5_endurance), ("P7_fork", k_p7_fork)]

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
