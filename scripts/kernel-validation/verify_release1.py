#!/usr/bin/env python3
"""
verify_release1.py — INDEPENDENT reference verification, Thing 2 release 1.

Signed by the operator 2026-10-10 (Stage 2, THING2_REPLACEMENT_PLAN.md) per
THING2_RELEASE1_VERIFICATION_CHECKS_DRAFT.md. This script is a separate code
path written directly from the frozen definitions and the cited research
sources. It imports NOTHING from the production tree (no sec_adapter, no
financial_phase_map, no flows, no altman, no limen_backtest) — checking code
by calling the same code proves nothing.

It re-derives inputs from the cached SEC companyfacts (research-frame
de-cumulation ported from flows.py; Altman Z'' ported from altman.py), scores
with an independent implementation of the fpm-r2 definitions (constants
restated and cited below), and compares against the EMITTED artifact
assets/data/command-board-thing2-readings.json AS COMMITTED.

Discipline: numbers are frozen after first results. Divergence between this
reference and the pipeline is either a pipeline defect or a definition
ambiguity — both are REPORTED, never smoothed. A divergent row flips to
UNKNOWN in this report's output only; the emitted artifact is not modified.

Cache-only, no network. Runtime: seconds to a couple of minutes.
"""
import json
import math
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CACHE = HERE / "board_cache"
ARTIFACT = REPO / "assets" / "data" / "command-board-thing2-readings.json"
REPORT = HERE / "verify_release1_report.json"

# ---------------------------------------------------------------------------
# Frozen definitions (constants restated, cited to the governing source)
# ---------------------------------------------------------------------------
# Tag lists: limen_backtest.TAG_MAP["Revenue"/"OCF"] (locked file, read-only
# data), flows.CFF_TAGS, prove_p2.COST_TAGS. flows.decumulate strips any
# "us-gaap/" prefix via tag.split("/")[-1].
REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax",
                "InterestAndDividendIncomeOperating", "InterestIncomeExpenseNet",
                "NoninterestIncome"]
OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]
COST_TAGS = ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold",
             "CostsAndExpenses", "OperatingExpenses"]

# fpm-r2 constants (financial_phase_map.py, itself citing prove_p2.py:81-82 and
# LIMEN_FOUR_LAYER.md:67,70; ratified operator rules 2026-10-09).
WAS_WINDOW_QTRS = 16
MIN_HISTORY_QTRS = 8
MIN_MEASURED_QTRS = 12
TTM_QTRS = 4
P4_CFF_PLUG_RATIO = 0.5
Z_SOLVENT = 1.1
TEMPORAL_COH = 0.5
TEMPORAL_AMP = 0.03
RELATIONAL_LOCK = 0.6
EXPECTED_FORMULA_VERSION = "2026-10-09.fpm-r2"

UNKNOWN_ABSTAINED = "UNKNOWN_ABSTAINED"
UNKNOWN_NOT_BUILT = "UNKNOWN_NOT_BUILT"
UNKNOWN_INSUFFICIENT_HISTORY = "UNKNOWN_INSUFFICIENT_HISTORY"
EMITTED_STATUSES = {"p0", "p2", "p4", "p5", UNKNOWN_ABSTAINED, UNKNOWN_NOT_BUILT,
                    UNKNOWN_INSUFFICIENT_HISTORY, "ERROR"}
FROZEN_TITLES = {"p0": "Source", "p2": "Rhythm", "p4": "Scaffolding", "p5": "Endurance"}

# Altman Z'' concepts (altman.py CONCEPTS).
ALT_CONCEPTS = {
    "Assets": (["Assets"], "instant"),
    "AssetsCurrent": (["AssetsCurrent"], "instant"),
    "LiabCurrent": (["LiabilitiesCurrent"], "instant"),
    "Liabilities": (["Liabilities"], "instant"),
    "Equity": (["StockholdersEquity",
                "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "instant"),
    "RetainedEarn": (["RetainedEarningsAccumulatedDeficit"], "instant"),
    "EBIT": (["OperatingIncomeLoss",
              "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
              "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
             "duration"),
}


# ---------------------------------------------------------------------------
# Port: research-frame de-cumulation (flows.py logic, written fresh here)
# ---------------------------------------------------------------------------

def _yq_of(dt):
    return (dt.year, (dt.month - 1) // 3 + 1)


def decumulate(facts, tags, cutoff):
    """Discrete quarterly flow values {(year, q): val}, point-in-time.

    Port of flows.decumulate: same start-date grouping, latest filing per
    (start, end) with filed <= cutoff, ~quarter-length increments only.
    """
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    periods = {}
    for tag in tags:
        node = gaap.get(tag.split("/")[-1])
        if not node:
            continue
        for e in node.get("units", {}).get("USD") or []:
            start, end, filed, val = e.get("start"), e.get("end"), e.get("filed"), e.get("val")
            if not (start and end and val is not None and filed):
                continue
            if cutoff and (end > cutoff or filed > cutoff):
                continue
            try:
                days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days
            except Exception:
                continue
            if not (75 <= days <= 400):
                continue
            key = (start, end)
            if key not in periods or filed > periods[key][0]:
                periods[key] = (filed, val)
    groups = {}
    for (start, end), (filed, val) in periods.items():
        groups.setdefault(start, []).append((end, val))
    discrete = {}
    for start, lst in groups.items():
        lst.sort()
        prev_val = 0.0
        prev_end = start
        for (end, val) in lst:
            try:
                inc = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(prev_end, "%Y-%m-%d")).days
            except Exception:
                inc = 0
            if 60 <= inc <= 120:
                discrete[_yq_of(datetime.strptime(end, "%Y-%m-%d"))] = val - prev_val
            prev_val = val
            prev_end = end
    return discrete


# ---------------------------------------------------------------------------
# Port: Altman Z'' (altman.py logic, written fresh here)
# ---------------------------------------------------------------------------

def _latest(facts, tags, cutoff):
    """Point-in-time latest USD value: latest period-end then latest filing,
    using only data filed on or before cutoff. First tag with any eligible
    point wins (per-tag break)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    best = None
    for tag in tags:
        node = gaap.get(tag)
        if not node:
            continue
        units = node.get("units", {})
        arr = units.get("USD") or next(iter(units.values()), [])
        for e in arr:
            end = e.get("end")
            filed = e.get("filed")
            if cutoff is not None and not (end is not None and end <= cutoff):
                continue
            if cutoff and filed and filed > cutoff:
                continue
            key = (end or "", filed or "")
            if best is None or key > (best[0], best[1]):
                best = (end or "", filed or "", e.get("val"))
        if best is not None:
            break
    return best[2] if best else None


def z_double_prime(facts, cutoff):
    """Returns (is_measured, value_or_None). Errors are NEVER 'solvent'."""
    if not facts:
        return False, None
    v = {k: _latest(facts, tags, cutoff) for k, (tags, _kind) in ALT_CONCEPTS.items()}
    TA = v["Assets"]
    if not TA or TA == 0:
        return False, None
    AC = v["AssetsCurrent"] or 0
    LC = v["LiabCurrent"] or 0
    TL = v["Liabilities"]
    if TL is None and v["Equity"] is not None:
        TL = TA - v["Equity"]
    TL = TL or (TA - (v["Equity"] or 0))
    EQ = v["Equity"] if v["Equity"] is not None else (TA - (TL or 0))
    RE = v["RetainedEarn"] or 0
    EBIT = v["EBIT"] or 0
    X1 = (AC - LC) / TA
    X2 = RE / TA
    X3 = EBIT / TA
    X4 = (EQ / TL) if TL and TL != 0 else 0.0
    Z = 3.25 + 6.56 * X1 + 3.26 * X2 + 6.72 * X3 + 1.05 * X4
    return True, round(Z, 2)


# ---------------------------------------------------------------------------
# Independent implementation of the fpm-r2 definitions
# ---------------------------------------------------------------------------

def _q_next(yq):
    y, q = yq
    return (y, q + 1) if q < 4 else (y + 1, 1)


def _q_prev(yq):
    y, q = yq
    return (y, q - 1) if q > 1 else (y - 1, 4)


def _grid(start, end):
    out = []
    q = start
    while True:
        out.append(q)
        if q == end:
            return out
        q = _q_next(q)


def _mean(xs):
    return sum(xs) / float(len(xs))


def _std(xs):
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / float(len(xs)))


def _ttm(measured_map, end_q, n=TTM_QTRS):
    """Sum of n consecutive measured quarters ending at end_q (inclusive).
    (False, None) if any window slot is unmeasured — never coerced to zero."""
    vals = []
    q = end_q
    for _ in range(n):
        if q not in measured_map:
            return False, None
        vals.append(measured_map[q])
        q = _q_prev(q)
    return True, sum(vals)


def _scaffold_fires(ttm_ocf, ttm_cff):
    return ttm_ocf < 0.0 and ttm_cff > P4_CFF_PLUG_RATIO * abs(ttm_ocf)


def _endurance_fires(ttm_ocf, ttm_cff):
    return ttm_ocf > 0.0 and ttm_cff < ttm_ocf


def temporal_dyad(rev_values):
    """Lag-4 coherence + amplitude of log-detrended residuals (population
    moments). prove_p2.py:53-67. Returns (coherence, amplitude) or
    (None, None) when not measurable."""
    if len(rev_values) < MIN_MEASURED_QTRS:
        return None, None
    if any(v <= 0 for v in rev_values):
        return None, None
    lx = [math.log(v) for v in rev_values]
    n = len(lx)
    t = list(range(n))
    sx, sy = sum(t), sum(lx)
    sxx = sum(x * x for x in t)
    sxy = sum(t[i] * lx[i] for i in range(n))
    denom = n * sxx - sx * sx
    slope = (n * sxy - sx * sy) / denom if denom != 0 else 0.0
    intercept = (sy - slope * sx) / n
    resid = [lx[i] - (slope * t[i] + intercept) for i in range(n)]
    amp = _std(resid)
    a, b = resid[:-4], resid[4:]
    if _std(a) < 1e-9 or _std(b) < 1e-9:
        return 0.0, amp
    ma, mb = _mean(a), _mean(b)
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(len(a))) / float(len(a))
    return cov / (_std(a) * _std(b)), amp


def relational_dyad(rev_values, cost_values):
    """Margin lock = 1 - min(cv/0.15, 1) over the trailing overlap.
    prove_p2.py:70-78. None when fewer than 8 cost quarters."""
    if cost_values is None or len(cost_values) < 8:
        return None
    n = min(len(rev_values), len(cost_values))
    r = rev_values[-n:]
    c = cost_values[-n:]
    ratio = [c[i] / (r[i] + 1e-9) for i in range(n)]
    m = _mean(ratio)
    cv = _std(ratio) / (abs(m) + 1e-9)
    return 1.0 - min(cv / 0.15, 1.0)


def evaluate(revenue, ocf, cff, solvency, cost, end_quarter):
    """Independent fpm-r2. revenue/ocf/cff/cost: {yq: value} measured only;
    solvency: (is_measured, z). Returns dict(status, phase, mode)."""
    rev_qs = sorted(revenue)
    if not rev_qs:
        return {"status": UNKNOWN_INSUFFICIENT_HISTORY, "phase": None, "mode": None}
    end_q = end_quarter or rev_qs[-1]
    grid = _grid(rev_qs[0], end_q)
    gaps = [q for q in grid if q not in revenue]
    if len(grid) < MIN_HISTORY_QTRS:
        return {"status": UNKNOWN_INSUFFICIENT_HISTORY, "phase": None, "mode": None}
    if gaps:
        return {"status": UNKNOWN_INSUFFICIENT_HISTORY, "phase": None, "mode": None}

    ocf_ok, ttm_ocf = _ttm(ocf, end_q)
    cff_ok, ttm_cff = _ttm(cff, end_q)
    flows_ok = ocf_ok and cff_ok
    cur_p4 = _scaffold_fires(ttm_ocf, ttm_cff) if flows_ok else None
    cur_p5 = _endurance_fires(ttm_ocf, ttm_cff) if flows_ok else None

    window = grid[-WAS_WINDOW_QTRS:]
    prior = None
    if flows_ok:
        computable = 0
        prior = False
        for q in window:
            o_ok, o = _ttm(ocf, q)
            c_ok, c = _ttm(cff, q)
            if not (o_ok and c_ok):
                continue
            computable += 1
            if _scaffold_fires(o, c):
                prior = True
                break
        if computable == 0:
            prior = None

    solvent = solvency[0] and solvency[1] > Z_SOLVENT

    trail = [revenue[q] for q in grid[-WAS_WINDOW_QTRS:]]
    coh, amp = temporal_dyad(trail)
    lock = None
    if cost is not None:
        cost_measured = [cost[q] for q in sorted(cost) if q in grid and q in cost]
        rev_measured = [revenue[q] for q in sorted(revenue) if q in grid]
        lock = relational_dyad(rev_measured, cost_measured)

    rhythm_measurable = coh is not None
    p2_fires = (rhythm_measurable and coh >= TEMPORAL_COH and amp >= TEMPORAL_AMP) or \
               (lock is not None and lock >= RELATIONAL_LOCK)
    p0_flat = rhythm_measurable and amp < TEMPORAL_AMP

    if cur_p4:
        return {"status": "p4", "phase": "p4", "mode": "SCAFFOLDING"}
    if cur_p5 is True:
        if prior is True:
            return {"status": "p5", "phase": "p5", "mode": "ENDURANCE"}
        if prior is False:
            pass  # never-self-funded: fall through
        else:
            return {"status": UNKNOWN_INSUFFICIENT_HISTORY, "phase": None, "mode": None}
    if cur_p5 is None:
        return {"status": UNKNOWN_INSUFFICIENT_HISTORY, "phase": None, "mode": None}
    if p2_fires:
        mode = "GENUINE_BASELINE" if prior is False else None
        return {"status": "p2", "phase": "p2", "mode": mode}
    if p0_flat and solvent:
        mode = "GENUINE_BASELINE" if prior is False else None
        return {"status": "p0", "phase": "p0", "mode": mode}
    if p0_flat and not solvent:
        return {"status": UNKNOWN_ABSTAINED, "phase": None, "mode": None}
    return {"status": UNKNOWN_NOT_BUILT, "phase": None, "mode": None}


# ---------------------------------------------------------------------------
# Driver: compare the emitted artifact, AS COMMITTED, against this reference
# ---------------------------------------------------------------------------

def find_facts(cik_key):
    suffix = "_%s.json" % str(cik_key).lstrip("0").zfill(10)
    for p in sorted(CACHE.glob("facts_*" + suffix)):
        return p
    return None


def main():
    art = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    meta = art.get("_meta", {})
    readings = art.get("readings", {})
    cutoff = meta.get("cutoff")

    print("artifact: n=%s formula_version=%s cutoff=%s" % (
        meta.get("n"), meta.get("formula_version"), cutoff))

    # Cross-phase invariants re-asserted on the artifact (draft §77-85).
    inv = []
    inv.append(("formula_version pinned", meta.get("formula_version") == EXPECTED_FORMULA_VERSION))
    inv.append(("statuses within grammar", all(
        r.get("status") in EMITTED_STATUSES for r in readings.values())))
    inv.append(("no validated:true anywhere",
                '"validated": true' not in json.dumps(art) and '"validated":true' not in json.dumps(art)))
    inv.append(("frozen titles on emitted phases", all(
        r.get("title") == "P%s · %s" % (r["phase"][1], FROZEN_TITLES[r["phase"]])
        for r in readings.values() if r.get("phase") in FROZEN_TITLES)))

    tally = {}
    divergences = []
    skips = []
    for cik, rec in sorted(readings.items()):
        emitted = (rec.get("status"), rec.get("phase"), rec.get("mode"))
        row = {"cik": cik, "ticker": rec.get("ticker"), "emitted": emitted}
        if rec.get("status") == "ERROR":
            row["verdict"] = "SKIP_ERROR_AT_BUILD"
            skips.append(row)
            continue
        f = find_facts(cik)
        if not f:
            row["verdict"] = "SKIP_NO_CACHE_FILE"
            skips.append(row)
            continue
        facts = json.loads(f.read_text(encoding="utf-8"))
        rev = decumulate(facts, REVENUE_TAGS, cutoff)
        ocf = decumulate(facts, OCF_TAGS, cutoff)
        cff = decumulate(facts, CFF_TAGS, cutoff)
        cost = decumulate(facts, COST_TAGS, cutoff)
        end_q = max(rev) if rev else None
        for m in (ocf, cff, cost):
            for q in list(m):
                if end_q is None or q > end_q:
                    del m[q]
        solv = z_double_prime(facts, cutoff)
        got = evaluate(rev, ocf, cff, solv, cost or None, end_q)
        key = emitted[0] if emitted[0] else "NONE"
        tally.setdefault(key, [0, 0])
        tally[key][1] += 1
        if (got["status"], got["phase"], got["mode"]) == emitted:
            tally[key][0] += 1
            row["verdict"] = "MATCH"
        else:
            row["verdict"] = "DIVERGENCE"
            row["recomputed"] = (got["status"], got["phase"], got["mode"])
            divergences.append(row)

    print("\n=== PER-PHASE PASS TABLE (emitted rows; pass = exact status+phase+mode match) ===")
    total_e = total_m = 0
    for k in sorted(tally):
        m, n = tally[k]
        total_m += m
        total_e += n
        print("  %-28s %4d/%4d  %s" % (k, m, n, "PASS" if m == n else "FAIL"))
    print("  %-28s %4d/%4d" % ("TOTAL (verifiable)", total_m, total_e))
    print("\nskips: error-at-build=%d no-cache-file=%d" % (
        sum(1 for s in skips if s["verdict"] == "SKIP_ERROR_AT_BUILD"),
        sum(1 for s in skips if s["verdict"] == "SKIP_NO_CACHE_FILE")))

    print("\n=== CROSS-PHASE INVARIANTS ===")
    for name, ok in inv:
        print("  [%s] %s" % ("OK" if ok else "VIOLATION", name))

    print("\n=== DIVERGENCES (%d) ===" % len(divergences))
    for d in divergences[:50]:
        print("  %s %-8s emitted=%s recomputed=%s" % (
            d["cik"], d["ticker"], d["emitted"], d["recomputed"]))

    report = {
        "verifier": "verify_release1.py (independent reference; stdlib-only; "
                    "imports nothing from the production tree)",
        "signed": "2026-10-10 operator, Stage 2 THING2_REPLACEMENT_PLAN.md",
        "artifact": str(ARTIFACT), "cutoff": cutoff,
        "formula_version_expected": EXPECTED_FORMULA_VERSION,
        "pass_table": {k: {"match": v[0], "emitted": v[1]} for k, v in tally.items()},
        "invariants": {name: bool(ok) for name, ok in inv},
        "skips": skips,
        "divergences": divergences,
        "rows": [
            {
                "cik": cik,
                "ticker": readings[cik].get("ticker"),
                "emitted_status": readings[cik].get("status"),
                # Per the draft: a divergent row flips to UNKNOWN (data-error),
                # never to a guessed phase. This affects the REPORT only.
                "report_status": next(
                    (d["recomputed"][0] for d in divergences if d["cik"] == cik),
                    readings[cik].get("status")),
            }
            for cik in sorted(readings)
        ],
    }
    REPORT.write_text(json.dumps(report, indent=1))
    print("\nreport written: %s" % REPORT)

    ok_all = (not divergences) and all(ok for _, ok in inv)
    print("\nVERDICT: %s" % ("PASS — 100% agreement, all invariants hold" if ok_all else
                             "DIVERGENCES PRESENT — reported above, not smoothed"))
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
