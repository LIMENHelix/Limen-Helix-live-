"""
LIMEN Helix — Business Phase Engine (Python)
Faithful port of business-data.js 11-Phase Pipeline.
DO NOT MODIFY MATH WITHOUT UPDATING JS AND BACKTEST.
"""

from __future__ import annotations

import math
from typing import Any

# ─── Version & Sync ──────────────────────────────────────────────
# Python port of the JS kernel. START_YEAR=2015 (recent companies).
# Accumulator/gating logic not fully ported to Python (recursive C(t) lives
#   in JS); shared dynamical-class constants ARE ported as of v4.0.2.
# SHARED CONSTANTS MUST STAY SYNCED with limen-thing2-kernel.js.
# v4.0.2 (2026-05-13): added DYNAMICAL_CLASS map and GAMMA_ATTRACTOR /
#   GAMMA_RECOVERY / GAMMA_TRANSIENT empirical values from Test #5.
#   Old GAMMA_TERMINAL / GAMMA_DEFAULT bucketing rejected as structurally
#   wrong — see docs/phase-coupling-template.md Section 5b.
KERNEL_VERSION = "4.0.2-python"

# ─── Constants (exact from JS / Python backtest) ────────────────

LIMEN = {
    "START_YEAR": 2015,
    "P3_ENTRY": 0.59,
    "RECOVERY_TH": 0.50,
    "RECOVERY_WINDOW": 6,
    # Accumulator C(t) — patent §3.6
    "LAMBDA": 6,
    # v4.0.2: empirical dynamical-class gammas from Test #5
    # (diagnostic/gamma_ratio_km_correction.py, KM-corrected MLE over
    # 32-fixture cohort, 1204 spells; see assets/data/empirical-gamma-by-phase.json).
    "GAMMA_ATTRACTOR": 0.510,  # p7a / p4 / p10 — basins
    "GAMMA_RECOVERY":  0.266,  # p0 / p1 / p3 / p5 / p6 / p8 — semi-stable
    "GAMMA_TRANSIENT": 0.043,  # p2 / p7 / p7b / p9 — pass-through
    "STRESS_CHARGE_RATE": 1.0,
    "P7_AMP": 0.2,
    "CONSEC_BONUS_RATE": 0.20,
    "MAX_CONSEC_QTRS": 6,
    "RECOVERY_DECAY": 0.30,
    "BASELINE_DECAY": 0.90,
    "ALERT_ACCUM_THRESH": 2.5,
    "COMPOSITE_THRESH_A": 1.1,
    "COMPOSITE_THRESH_B": 1.5,
    "COMPOSITE_THRESH_C": 1.5,
    "RUPTURE_CASH_DROP": 0.30,
    "RUPTURE_DEBT_SPIKE": 0.50,
    "RUPTURE_VAR_JUMP": 5.0,
    "RUPTURE_MIN_SIGNALS": 2,
    "SUSTAINED_THRESH": 0.50,
    "SUSTAINED_MIN_CONSEC": 4,
    "SUSTAINED_WEIGHT": 0.20,
    # Chronic stress override
    "CHRONIC_P3_THRESH": 0.52,
    "CHRONIC_MIN_CONSEC": 4,
    "CHRONIC_AVG_P3_THRESH": 0.48,
    "CHRONIC_CASH_DECLINE": 0.25,
    "CHRONIC_STRESS_ACCUM_MIN": 1.0,
    # P7 split — post-break monitoring window
    "P7_SPLIT_WINDOW": 4,
    # Recovery tightening
    "RECOVERY_CONSEC_REQUIRED": 3,
    # Recency weighting for dominant phase
    "RECENCY_LOOKBACK": 8,
    "RECENCY_HALF_LIFE": 6,
    # P3 probabilistic OR bias
    "P3_BIAS": 2.5,
    # Rolling baseline window for robust_z
    "BASELINE_WINDOW": 40,
}

# Dynamical-class taxonomy (v4.0.2) — phase -> persistence class.
# See docs/phase-coupling-template.md Section 4b and Test #5 output.
DYNAMICAL_CLASS = {
    "p0":  "RECOVERY",
    "p1":  "RECOVERY",
    "p2":  "TRANSIENT",
    "p3":  "RECOVERY",
    "p4":  "ATTRACTOR",
    "p5":  "RECOVERY",
    "p6":  "RECOVERY",
    "p7":  "TRANSIENT",
    "p7a": "ATTRACTOR",
    "p7b": "TRANSIENT",
    "p8":  "RECOVERY",
    "p9":  "TRANSIENT",
    "p10": "ATTRACTOR",
}


def gamma_for_phase(phase: str) -> float:
    cls = DYNAMICAL_CLASS.get(phase, "RECOVERY")
    if cls == "ATTRACTOR":
        return LIMEN["GAMMA_ATTRACTOR"]
    if cls == "TRANSIENT":
        return LIMEN["GAMMA_TRANSIENT"]
    return LIMEN["GAMMA_RECOVERY"]


# Shared constant fingerprint — comparable to JS CONSTANTS_HASH.
# v4.0.2: uses dynamical-class gammas instead of semantic-bucket gammas.
# RUNWAY_* still "N/A" (gating logic not ported to Python).
CONSTANTS_HASH = ",".join(str(x) for x in [
    LIMEN["P3_ENTRY"],            # 0.59
    LIMEN["LAMBDA"],              # 6
    LIMEN["GAMMA_ATTRACTOR"],     # 0.51
    LIMEN["GAMMA_RECOVERY"],      # 0.266
    LIMEN["GAMMA_TRANSIENT"],     # 0.043
    LIMEN["COMPOSITE_THRESH_A"],  # 1.1
    LIMEN["COMPOSITE_THRESH_B"],  # 1.5
    LIMEN["COMPOSITE_THRESH_C"],  # 1.5
    "N/A",                        # RUNWAY_ELEVATE_QTR (not ported)
    "N/A",                        # RUNWAY_FORCE_QTR (not ported)
    LIMEN["RECOVERY_TH"],         # 0.5
    LIMEN["SUSTAINED_THRESH"],    # 0.5
])
# Expected: "0.59,6,0.51,0.266,0.043,1.1,1.5,1.5,N/A,N/A,0.5,0.5"

TAG_MAP = {
    "Revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "InterestAndDividendIncomeOperating",
        "InterestIncomeExpenseNet",
        "NoninterestIncome",
    ],
    "OCF": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "Cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsAndShortTermInvestments",
        "Cash",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
    "DebtCurrent": [
        "DebtCurrent",
        "ShortTermBorrowings",
        "LongTermDebtCurrent",
        "CurrentPortionOfLongTermDebt",
    ],
    "DebtLong": [
        "LongTermDebtNoncurrent",
        "LongTermDebt",
        "LongTermDebtAndCapitalLeaseObligations",
    ],
    "Liabilities": [
        "Liabilities",
    ],
    "Deposits": [
        "Deposits",
    ],
}

PHASE_META = {
    "p0":  {"name": "Source",       "label": "P0 · SOURCE",       "summary": "Stable baseline — low variance, moderate positive growth, predictable operations."},
    "p1":  {"name": "Rupture",      "label": "P1 · RUPTURE",      "summary": "First disruption — revenue variance spike, sudden margin compression, first negative surprise."},
    "p2":  {"name": "Rhythm",       "label": "P2 · RHYTHM",       "summary": "Alliance building — revenue diversification increasing, growth accelerating under coordination."},
    "p3":  {"name": "Darkness",     "label": "P3 · INSTABILITY",  "summary": "Core instability — high variance, rising autocorrelation, declining slope, accelerating burn."},
    "p4":  {"name": "Peace",        "label": "P4 · STABILISATION","summary": "Stabilisation — variance decreasing after crisis, cash burn decelerating, slope flattening."},
    "p5":  {"name": "Endurance",    "label": "P5 · ENDURANCE",    "summary": "Stress inoculation — revenue recovering under elevated variance, debt being serviced."},
    "p6":  {"name": "Order",        "label": "P6 · ORDER",        "summary": "Control restored — low variance, stable metrics, debt declining, cash building."},
    "p7":  {"name": "Dissolution",  "label": "P7 · DIVERGENCE",   "summary": "Structural divergence — revenue/OCF breakpoints detected, accelerating debt."},
    "p7a": {"name": "Terminal Dissolution", "label": "P7a · TERMINAL",  "summary": "Post-break deterioration — cash slope negative and accelerating, debt increasing, no stabilization. Routes toward P9 collapse."},
    "p7b": {"name": "Differentiated Separation", "label": "P7b · SEPARATION", "summary": "Controlled post-break — variance plateauing, liquidity managed, slope stabilizing. Routes toward P10 new baseline."},
    "p8":  {"name": "Conscience",   "label": "P8 · PIVOT",        "summary": "Business-model pivot — structural break with positive slope, new revenue pattern emerging."},
    "p9":  {"name": "Threshold",    "label": "P9 · COLLAPSE",     "summary": "Collapse threshold — P3 elevated + liquidity risk + macro headwinds converging."},
    "p10": {"name": "Resurrection", "label": "P10 · RESURRECTION", "summary": "New baseline — structural break happened but variance now low, new steady state."},
}

ALL_PHASES = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p7a", "p7b", "p8", "p9", "p10"]


# ─── Math Helpers ───────────────────────────────────────────────

def sigmoid(x: float) -> float:
    x = max(-10.0, min(10.0, x))
    return 1.0 / (1.0 + math.exp(-x))


def robust_z(x: float, history: list[float]) -> float:
    if not history:
        return 0.0
    s = sorted(history)
    n = len(s)
    med = s[n // 2] if n % 2 == 1 else (s[n // 2 - 1] + s[n // 2]) / 2
    abs_devs = sorted(abs(v - med) for v in s)
    m = len(abs_devs)
    mad = abs_devs[m // 2] if m % 2 == 1 else (abs_devs[m // 2 - 1] + abs_devs[m // 2]) / 2
    z = 0.6745 * (x - med) / max(mad, 1e-8)
    return max(-5.0, min(5.0, z))


def nan_mean(arr: list) -> float:
    vals = [v for v in arr if v is not None and not math.isnan(v)]
    return sum(vals) / len(vals) if vals else 0.0


# ─── PELT Breakpoint Detection ─────────────────────────────────

def _cost_l2(signal: list[float], start: int, end: int) -> float:
    seg = signal[start:end]
    if not seg:
        return 0.0
    m = sum(seg) / len(seg)
    return sum((v - m) ** 2 for v in seg)


def pelt_breakpoints(signal: list[float], pen: float) -> list[int]:
    n = len(signal)
    if n < 2:
        return [n]
    F = [float("inf")] * (n + 1)
    F[0] = -pen
    cp: dict[int, list[int]] = {0: []}
    admissible = [0]

    for t_star in range(1, n + 1):
        best_cost = float("inf")
        best_t = 0
        costs = []
        for t in admissible:
            cost = F[t] + _cost_l2(signal, t, t_star) + pen
            costs.append(cost)
            if cost < best_cost:
                best_cost = cost
                best_t = t
        F[t_star] = best_cost
        cp[t_star] = (cp.get(best_t, []) or []) + [t_star]

        new_adm = []
        for j, t in enumerate(admissible):
            if costs[j] + _cost_l2(signal, t, t_star) <= F[t_star] + pen:
                new_adm.append(t)
        new_adm.append(t_star)
        admissible = new_adm

    return cp.get(n, [])


def detect_breaks(window_values: list[float]) -> int:
    if len(window_values) < 3:
        return 0
    m = sum(window_values) / len(window_values)
    variance = sum((v - m) ** 2 for v in window_values) / len(window_values)
    pen = max(math.log(len(window_values)) * variance, 1e-6)
    try:
        bps = pelt_breakpoints(window_values, pen)
        n_bps = len(bps) - 1 if bps and bps[-1] == len(window_values) else len(bps)
        return n_bps
    except Exception:
        return 0


# ─── Feature Engineering ───────────────────────────────────────

def compute_log_diff(series: dict[str, float]) -> dict[str, float]:
    keys = sorted(series.keys())
    result = {}
    for i in range(1, len(keys)):
        q, q_prev = keys[i], keys[i - 1]
        curr, prev = series[q], series[q_prev]
        if curr is None or prev is None:
            continue
        if prev > 0 and curr > 0:
            result[q] = math.log(curr / prev)
        elif abs(prev) > 1e-9:
            result[q] = (curr - prev) / abs(prev)
        else:
            result[q] = 0.0
    return result


def compute_rolling_features(log_diffs: dict[str, float], window_size: int = 4) -> dict[str, dict]:
    keys = sorted(log_diffs.keys())
    features: dict[str, dict] = {}

    for i, q in enumerate(keys):
        start_idx = max(0, i - window_size + 1)
        window_vals = [log_diffs[keys[j]] for j in range(start_idx, i + 1)]
        if len(window_vals) < window_size:
            continue

        feat: dict[str, Any] = {}
        m = sum(window_vals) / len(window_vals)
        feat["var"] = sum((v - m) ** 2 for v in window_vals) / len(window_vals)

        std = math.sqrt(feat["var"])
        if std < 1e-12:
            feat["ac"] = 0.0
        else:
            ac = sum(
                (window_vals[k] - m) * (window_vals[k - 1] - m)
                for k in range(1, len(window_vals))
            )
            ac /= (len(window_vals) - 1) * feat["var"]
            feat["ac"] = max(-1.0, min(1.0, ac))

        n = len(window_vals)
        x_mean = (n - 1) / 2
        num = sum((k - x_mean) * (window_vals[k] - m) for k in range(n))
        den = sum((k - x_mean) ** 2 for k in range(n))
        feat["slope"] = num / den if den > 1e-12 else 0.0

        if len(window_vals) >= 3:
            diffs2 = [
                (window_vals[k] - window_vals[k - 1]) - (window_vals[k - 1] - window_vals[k - 2])
                for k in range(2, len(window_vals))
            ]
            feat["accel"] = sum(diffs2) / len(diffs2)
        else:
            feat["accel"] = 0.0

        feat["break"] = detect_breaks(window_vals)
        features[q] = feat

    return features


# ─── Quarter Helpers ────────────────────────────────────────────

def date_to_quarter(year: int, month: int) -> str:
    return f"{year}Q{(month - 1) // 3 + 1}"


def quarter_year(q_key: str) -> int:
    return int(q_key.split("Q")[0])


def quarter_diff(q1: str, q2: str) -> int:
    p1 = q1.split("Q")
    p2 = q2.split("Q")
    return (int(p2[0]) - int(p1[0])) * 4 + (int(p2[1]) - int(p1[1]))


# ─── Compute All Features ──────────────────────────────────────

def _nan(v):
    return v is None or (isinstance(v, float) and math.isnan(v))


def _val(v, default=0.0):
    return default if _nan(v) else v


def compute_all_features(company_data: dict, fred_delta: dict | None = None) -> list[dict]:
    fred_delta = fred_delta or {}
    base_metrics = ["Revenue", "OCF", "Cash", "Debt"]
    metrics = base_metrics + [m for m in company_data if m not in base_metrics]

    log_diffs = {}
    for m in metrics:
        log_diffs[m] = compute_log_diff(company_data.get(m, {})) if company_data.get(m) else {}

    rolling4q = {}
    rolling8q = {}
    for m in metrics:
        rolling4q[m] = compute_rolling_features(log_diffs[m], 4) if log_diffs[m] else {}
        rolling8q[m] = compute_rolling_features(log_diffs[m], 8) if log_diffs[m] else {}

    all_quarters: set[str] = set()
    for m in metrics:
        all_quarters.update(rolling4q[m].keys())
    all_quarters_sorted = sorted(all_quarters)
    if not all_quarters_sorted:
        return []

    history: dict[str, dict[str, list]] = {m: {"var": [], "ac": [], "slope": [], "accel": []} for m in metrics}
    history8q: dict[str, dict[str, list]] = {m: {"var": [], "ac": [], "slope": [], "accel": []} for m in metrics}
    runway_history: list[float] = []
    dff_history: list[float] = []
    prev_var: dict[str, float | None] = {m: None for m in metrics}

    rows: list[dict] = []
    for q in all_quarters_sorted:
        row: dict[str, Any] = {"quarter": q}

        # Raw levels
        for m in metrics:
            src = company_data.get(m, {})
            row[m] = src.get(q, float("nan"))

        # 4Q rolling + z-scores
        for m in metrics:
            feat = rolling4q[m].get(q, {})
            for stat in ["var", "ac", "slope", "accel"]:
                val = feat.get(stat, float("nan"))
                col = f"{stat}_{m}"
                row[col] = val
                if not _nan(val):
                    history[m][stat].append(val)
                    window = history[m][stat][-LIMEN["BASELINE_WINDOW"]:]
                    row[f"z_{col}"] = robust_z(val, window)
                else:
                    row[f"z_{col}"] = float("nan")
            row[f"break_{m}"] = feat.get("break", 0)

            cur_var = feat.get("var", float("nan"))
            if not _nan(cur_var) and prev_var[m] is not None:
                row[f"delta_var_{m}"] = cur_var - prev_var[m]
            else:
                row[f"delta_var_{m}"] = float("nan")
            if not _nan(cur_var):
                prev_var[m] = cur_var

        # 8Q rolling + z-scores
        for m in metrics:
            feat8 = rolling8q[m].get(q, {})
            for stat in ["var", "ac", "slope", "accel"]:
                val = feat8.get(stat, float("nan"))
                col8 = f"{stat}_{m}_8q"
                row[col8] = val
                if not _nan(val):
                    history8q[m][stat].append(val)
                    window8 = history8q[m][stat][-LIMEN["BASELINE_WINDOW"]:]
                    row[f"z_{col8}"] = robust_z(val, window8)
                else:
                    row[f"z_{col8}"] = float("nan")
            row[f"break_{m}_8q"] = feat8.get("break", 0)

        # Liquidity runway
        cash_val = row.get("Cash", float("nan"))
        ocf_val = row.get("OCF", float("nan"))
        if not _nan(cash_val) and not _nan(ocf_val):
            runway = cash_val / max(1.0, abs(ocf_val))
            runway_history.append(runway)
            row["runway"] = runway
            row["z_runway"] = robust_z(runway, runway_history[-LIMEN["BASELINE_WINDOW"]:])
        else:
            row["runway"] = float("nan")
            row["z_runway"] = float("nan")

        # FRED delta
        dff = fred_delta.get(q, float("nan"))
        if not _nan(dff):
            dff_history.append(dff)
            row["delta_fedfunds"] = dff
            row["z_delta_fedfunds"] = robust_z(dff, dff_history[-LIMEN["BASELINE_WINDOW"]:])
        else:
            row["delta_fedfunds"] = float("nan")
            row["z_delta_fedfunds"] = float("nan")

        rows.append(row)

    return rows


# ─── 11-Phase Scoring ──────────────────────────────────────────

def score_all_phases(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows

    def _sig(row: dict, col: str, negate: bool = False) -> float:
        v = _val(row.get(col, float("nan")))
        return sigmoid(-v if negate else v)

    for r in rows:
        # Risk building blocks
        r["risk_var_rev"] = _sig(r, "z_var_Revenue")
        r["risk_ac_rev"] = _sig(r, "z_ac_Revenue")
        r["risk_slope_rev"] = _sig(r, "z_slope_Revenue", True)
        r["risk_accel_rev"] = _sig(r, "z_accel_Revenue", True)
        r["risk_var_ocf"] = _sig(r, "z_var_OCF")
        r["risk_ac_ocf"] = _sig(r, "z_ac_OCF")
        r["risk_slope_ocf"] = _sig(r, "z_slope_OCF", True)
        r["risk_accel_ocf"] = _sig(r, "z_accel_OCF", True)
        r["risk_slope_debt"] = _sig(r, "z_slope_Debt")
        r["risk_accel_debt"] = _sig(r, "z_accel_Debt")
        r["risk_slope_cash"] = _sig(r, "z_slope_Cash")
        r["risk_break_rev"] = 1.0 if r.get("break_Revenue", 0) > 1 else 0.0
        r["risk_break_ocf"] = 1.0 if r.get("break_OCF", 0) > 1 else 0.0
        r["risk_break_rev_8q"] = 1.0 if r.get("break_Revenue_8q", 0) > 1 else 0.0
        r["risk_liq"] = sigmoid(-_val(r.get("z_runway", float("nan"))))

        # Deposits (financial sector)
        if not _nan(r.get("z_slope_Deposits", float("nan"))):
            r["risk_slope_deposits"] = _sig(r, "z_slope_Deposits", True)
            r["risk_break_deposits"] = 1.0 if r.get("break_Deposits", 0) >= 1 else 0.0

        # Health signals
        r["stab_var_rev"] = 1.0 - r["risk_var_rev"]
        r["stab_var_ocf"] = 1.0 - r["risk_var_ocf"]
        r["health_slope_rev"] = 1.0 - r["risk_slope_rev"]
        r["health_slope_ocf"] = 1.0 - r["risk_slope_ocf"]
        r["health_accel_rev"] = 1.0 - r["risk_accel_rev"]
        r["health_slope_cash"] = _sig(r, "z_slope_Cash")
        r["health_slope_debt_neg"] = _sig(r, "z_slope_Debt", True)

        # Variance direction
        dv_rev = _val(r.get("delta_var_Revenue", float("nan")))
        dv_ocf = _val(r.get("delta_var_OCF", float("nan")))
        r["var_decreasing_rev"] = sigmoid(-10.0 * dv_rev)
        r["var_decreasing_ocf"] = sigmoid(-10.0 * dv_ocf)

        # Cash burn deceleration
        r["burn_decelerating"] = _sig(r, "z_accel_OCF")

        # Revenue diversification
        r["rev_diversity"] = 1.0 - r["risk_ac_rev"]

        # ── Phase scores ──
        # P0 — Source / Stable Baseline (spec Stage 3)
        r["p0"] = (r["stab_var_rev"] + r["stab_var_ocf"] + r["health_slope_rev"]
                   + sigmoid(_val(r.get("z_slope_Revenue", float("nan"))))) / 4

        # P1 — Rupture / First Disruption
        var_spike_rev = sigmoid(10.0 * dv_rev)
        r["p1"] = (var_spike_rev + r["risk_slope_rev"] + r["risk_accel_rev"]) / 3

        # P2 — Rhythm / Alliance Building
        r["p2"] = (r["rev_diversity"] + r["health_slope_rev"] + r["health_accel_rev"] + r["health_slope_ocf"]) / 4

        # P3 — Darkness / Instability (probabilistic OR)
        bias = LIMEN["P3_BIAS"]
        z_risk_rev = (max(0, _val(r.get("z_var_Revenue", 0)))
                      + max(0, _val(r.get("z_ac_Revenue", 0)))
                      + max(0, -_val(r.get("z_slope_Revenue", 0)))
                      + max(0, -_val(r.get("z_accel_Revenue", 0)))) / 4
        z_risk_ocf = (max(0, _val(r.get("z_var_OCF", 0)))
                      + max(0, _val(r.get("z_ac_OCF", 0)))
                      + max(0, -_val(r.get("z_slope_OCF", 0)))
                      + max(0, -_val(r.get("z_accel_OCF", 0)))) / 4
        z_risk_cash = max(0, -_val(r.get("z_slope_Cash", 0)))
        z_risk_debt = (max(0, _val(r.get("z_slope_Debt", 0)))
                       + max(0, _val(r.get("z_accel_Debt", 0)))) / 2
        r["p3_p_rev"] = sigmoid(z_risk_rev - bias)
        r["p3_p_ocf"] = sigmoid(z_risk_ocf - bias)
        r["p3_p_cash"] = sigmoid(z_risk_cash - bias)
        r["p3_p_debt"] = sigmoid(z_risk_debt - bias)
        # Deposits channel (financial institutions only)
        # Use max of 4Q and 8Q z-slopes — banking crises develop over 6-12 months
        _has_dep = not _nan(r.get("z_slope_Deposits", float("nan")))
        if _has_dep:
            z_slope_dep = max(max(0, -_val(r.get("z_slope_Deposits", 0))),
                              max(0, -_val(r.get("z_slope_Deposits_8q", 0))))
            z_accel_dep = max(max(0, -_val(r.get("z_accel_Deposits", 0))),
                              max(0, -_val(r.get("z_accel_Deposits_8q", 0))))
            z_risk_deposits = (z_slope_dep + z_accel_dep) / 2
            r["p3_p_deposits"] = sigmoid(z_risk_deposits - bias)
            r["p3"] = 1.0 - ((1.0 - r["p3_p_rev"]) * (1.0 - r["p3_p_ocf"])
                              * (1.0 - r["p3_p_cash"]) * (1.0 - r["p3_p_debt"])
                              * (1.0 - r["p3_p_deposits"]))
        else:
            r["p3"] = 1.0 - ((1.0 - r["p3_p_rev"]) * (1.0 - r["p3_p_ocf"])
                              * (1.0 - r["p3_p_cash"]) * (1.0 - r["p3_p_debt"]))

        # P4 — Peace / Stabilisation
        slope_flat = max(0.0, min(1.0, 1.0 - abs(r["risk_slope_rev"] - 0.5) * 2))
        r["p4"] = (r["var_decreasing_rev"] + r["var_decreasing_ocf"] + r["burn_decelerating"] + slope_flat) / 4

        # P5 — Endurance / Stress Inoculation
        r["p5"] = (r["health_slope_rev"] + r["health_slope_ocf"] + r["risk_var_rev"] + r["health_slope_debt_neg"]) / 4

        # P6 — Order / Control
        ac_flat = max(0.0, min(1.0, 1.0 - abs(r["risk_ac_rev"] - 0.5) * 2))
        r["p6"] = (r["stab_var_rev"] + r["stab_var_ocf"] + r["health_slope_cash"]
                   + r["health_slope_debt_neg"] + ac_flat) / 5

        # P7 — Dissolution / Structural Divergence
        if "risk_break_deposits" in r:
            r["p7"] = (r["risk_break_rev"] + r["risk_break_ocf"]
                       + r["risk_accel_debt"] + r["risk_break_deposits"]) / 4
        else:
            r["p7"] = (r["risk_break_rev"] + r["risk_break_ocf"] + r["risk_accel_debt"]) / 3

        # P8 — Conscience / Business-Model Pivot
        r["p8"] = (r["risk_break_rev"] + r["health_slope_rev"] + r["rev_diversity"] + r["risk_break_rev_8q"]) / 4

        # P10 — Resurrection / New Baseline
        r["p10"] = (r["risk_break_rev_8q"] + r["stab_var_rev"] + r["stab_var_ocf"] + slope_flat) / 4

    # Capital allocation mask: dampen P3 for intentional reinvestors.
    # If recent revenue growing + OCF stable + (cash growing or debt modest),
    # debt growth is investment not distress → dampen P3 by 40%.
    # Must run BEFORE P9 since P9 depends on P3 > 0.6.
    _CAP_ALLOC_LOOKBACK = 6
    for i, r in enumerate(rows):
        start = max(0, i - _CAP_ALLOC_LOOKBACK + 1)
        window = rows[start:i + 1]
        # Count revenue-growing and OCF-stable quarters (skip NaN)
        rev_vals = [rr.get("z_slope_Revenue", float("nan")) for rr in window]
        ocf_vals = [rr.get("z_slope_OCF", float("nan")) for rr in window]
        cash_vals = [rr.get("z_slope_Cash", float("nan")) for rr in window]
        rev_valid = [v for v in rev_vals if not _nan(v)]
        ocf_valid = [v for v in ocf_vals if not _nan(v)]
        cash_valid = [v for v in cash_vals if not _nan(v)]
        rev_growing = len(rev_valid) >= 2 and all(v > -0.5 for v in rev_valid)
        ocf_stable = len(ocf_valid) < 2 or all(v > -1.0 for v in ocf_valid)
        cash_ok = len(cash_valid) < 2 or sum(1 for v in cash_valid if v > -0.5) >= len(cash_valid) * 2 // 3
        if not (rev_growing and ocf_stable and cash_ok):
            continue
        # Cap P10 — structural breaks are growth-driven, not post-crisis
        r["p10"] = min(r.get("p10", 0), 0.5)
        # Dampen P3 when elevated and debt is the primary driver
        if r["p3"] >= 0.4 and r.get("p3_p_debt", 0) >= max(
                r.get("p3_p_rev", 0), r.get("p3_p_ocf", 0), r.get("p3_p_cash", 0)):
            r["p3"] *= 0.6
            r["p3_capalloc_dampened"] = True

    # P9 — Threshold / Collapse (conditional, uses dampened P3).
    # Tightened gates:
    #   1. P3 must exceed 0.75 (not 0.60) to even consider P9 — collapse
    #      is acute, not "p3 happened to peek above moderate-stress line".
    #   2. Multi-quarter persistence: previous OR next quarter must also
    #      show p3 ≥ 0.65, OR a structural break must have just occurred.
    #      Single-quarter p3 noise (common in mature operating companies
    #      with seasonality) shouldn't trip P9 by itself.
    for i, r in enumerate(rows):
        if r["p3"] > 0.75:
            prev_p3 = rows[i - 1]["p3"] if i > 0 else 0.0
            next_p3 = rows[i + 1]["p3"] if i + 1 < len(rows) else 0.0
            has_break = (r.get("break_Revenue", 0) > 0
                         or r.get("break_OCF", 0) > 0)
            sustained = (prev_p3 >= 0.65) or (next_p3 >= 0.65)
            if sustained or has_break:
                z_dff = _val(r.get("z_delta_fedfunds", float("nan")))
                raw = 0.5 * r["p3"] + 0.3 * r["risk_liq"] + 0.2 * r["risk_break_rev"] + 0.2 * max(0, z_dff)
                r["p9"] = sigmoid(raw)
            else:
                r["p9"] = 0.0
        else:
            r["p9"] = 0.0

    return rows


# ─── P7a/P7b Split — Post-Break Sub-Phases ────────────────────

def _viability_breached(rows: list[dict], end: int, lookback: int = 8) -> bool:
    """Check whether distress viability thresholds are breached in a recent window.

    P7a Terminal requires BOTH a structural break AND at least one of:
      - Revenue z-slope < -1.5 (severe revenue decline)
      - OCF z-slope < -1.5 (deeply negative cash flow)
      - Cash runway < 4 quarters (cash / |OCF| when OCF < 0)
      - Debt growth z-slope > 1.5 (accelerating leverage)
      - Deposit flight z-slope_8q < -2.0 (banking sector)
    """
    start = max(0, end - lookback + 1)
    for r in rows[start:end + 1]:
        z_rev = r.get("z_slope_Revenue", float("nan"))
        if not _nan(z_rev) and z_rev < -1.5:
            return True
        z_ocf = r.get("z_slope_OCF", float("nan"))
        if not _nan(z_ocf) and z_ocf < -1.5:
            return True
        cash = r.get("Cash", 0) or 0
        ocf = r.get("OCF", 0) or 0
        if (isinstance(cash, (int, float)) and isinstance(ocf, (int, float))
                and not _nan(cash) and not _nan(ocf) and cash > 0 and ocf < 0):
            if cash / abs(ocf) < 4.0:
                return True
        z_debt = r.get("z_slope_Debt", float("nan"))
        if not _nan(z_debt) and z_debt > 1.5:
            return True
        z_dep = r.get("z_slope_Deposits_8q", float("nan"))
        if not _nan(z_dep) and z_dep < -2.0:
            return True
    return False


def score_p7_split(rows: list[dict]) -> list[dict]:
    """Score P7a (Terminal Dissolution) and P7b (Differentiated Separation).

    After detecting a structural break, monitor the 2-4 quarter window:
      P7a: cash slope negative & accelerating, debt increasing, no stabilization → P9
      P7b: variance plateauing, controlled liquidity, stabilizing slope → P10

    P7a requires viability breach (revenue stress, OCF deeply negative, short
    cash runway, or debt growth).  Break WITHOUT viability breach → P7b only.
    """
    if not rows:
        return rows

    window = LIMEN["P7_SPLIT_WINDOW"]
    last_break_idx = -999

    for i, r in enumerate(rows):
        # Track structural break events (any break in revenue or OCF)
        if r.get("break_Revenue", 0) > 0 or r.get("break_OCF", 0) > 0:
            last_break_idx = i

        has_recent_break = 0 <= (i - last_break_idx) <= window

        if has_recent_break:
            p3_stress = r.get("p3", 0.5)

            # ── P7b: Differentiated Separation (always scored when break present) ──
            var_plateau = r.get("var_decreasing_rev", 0.5)
            liq_ok = 1.0 - r.get("risk_liq", 0.5)
            slope_flat = max(0.0, min(1.0, 1.0 - abs(r.get("risk_slope_rev", 0.5) - 0.5) * 2))
            separation = (var_plateau + liq_ok + slope_flat) / 3
            health = 1.0 - p3_stress
            r["p7b"] = 0.4 * health + 0.3 * separation + 0.3 * r.get("p7", 0)

            # ── P7a: Terminal Dissolution (requires viability breach) ──
            if _viability_breached(rows, i):
                cash_declining = 1.0 - r.get("health_slope_cash", 0.5)
                cash_accel_neg = sigmoid(-_val(r.get("z_accel_Cash", float("nan"))))
                debt_increasing = r.get("risk_slope_debt", 0.5)
                no_stab = max(0.0, 1.0 - r.get("p4", 0.5))
                terminal = (cash_declining + cash_accel_neg + debt_increasing + no_stab) / 4
                r["p7a"] = 0.4 * p3_stress + 0.3 * terminal + 0.3 * r.get("p7", 0)
            else:
                # Break without viability breach → controlled separation, not terminal
                r["p7a"] = 0.0
        else:
            r["p7a"] = 0.0
            r["p7b"] = 0.0

    return rows


# ─── Runway Gate — Cash Runway Adjustments ─────────────────────

def _apply_runway_gate(rows: list[dict]) -> list[dict]:
    """Compute cash runway and adjust distress scores.

    Per phase spec:
      - P7a (Liquidation / dorsal vagal collapse): runway <2Q forces P7a
        dominance. This is the spec-mandated hard override.
      - P9 (Collapse / pre-arrest): elevated alongside P7a on critical
        runway.

    runway_quarters = 4 × cash / abs(TTM_OCF) when TTM_OCF < 0. TTM OCF
    (sum of last 4 quarters of non-NaN OCF, requires ≥2 data points)
    replaces the previous stale-last-known-OCF carry-forward, which
    caused multi-year-old single-quarter OCF values to drive a "current"
    runway calc and force P7a as dominant for years (e.g. JCP labeled
    p7a from 2015Q1 onward via 2010-era OCF data). With TTM OCF, the
    spec-correct runway → P7a override only fires on actual current
    cash-burn distress.
    """
    if not rows:
        return rows

    # Index rows by quarter for TTM lookback
    q_to_idx = {r["quarter"]: i for i, r in enumerate(rows)}

    for i, r in enumerate(rows):
        cash = r.get("Cash", 0) or 0
        q = r["quarter"]

        # TTM OCF: sum of last 4 quarters (inclusive of current) with data
        ttm_ocf = 0.0
        ttm_n = 0
        y, qn = int(q.split("Q")[0]), int(q.split("Q")[1])
        for k in range(4):
            qk_n = qn - k
            qk_y = y
            while qk_n <= 0:
                qk_n += 4
                qk_y -= 1
            qk = f"{qk_y}Q{qk_n}"
            idx = q_to_idx.get(qk)
            if idx is None:
                continue
            v = rows[idx].get("OCF", float("nan"))
            if not _nan(v):
                ttm_ocf += v
                ttm_n += 1

        if (isinstance(cash, (int, float)) and not _nan(cash) and cash > 0
                and ttm_n >= 2 and ttm_ocf < 0):
            # Runway in quarters: 4 × cash / |TTM_OCF|
            runway = 4.0 * cash / abs(ttm_ocf)
        else:
            runway = float("inf")

        r["runway_quarters"] = runway

        if runway < 2.0:
            # Critical: spec mandates runway <2Q → force P7a (liquidation
            # pathway, dorsal vagal collapse). Also elevate P9.
            other_max = max(r.get(p, 0) for p in ALL_PHASES if p != "p7a")
            r["p7a"] = max(r.get("p7a", 0), other_max + 0.05, 0.65)
            r["p9"] = max(r.get("p9", 0), 0.55)
        elif runway < 4.0:
            # Distressed: elevate P7a and P9 proportionally
            boost = 0.15 * (4.0 - runway) / 2.0  # 0.15 at 2Q, 0 at 4Q
            r["p7a"] = max(r.get("p7a", 0), r.get("p7a", 0) + boost)
            r["p9"] = max(r.get("p9", 0), r.get("p9", 0) + boost)

    return rows


# ─── Cash Slope Helper ─────────────────────────────────────────

def _cash_slope(rows: list[dict], i: int, lookback: int = 6) -> float:
    vals = []
    for j in range(max(0, i - lookback + 1), i + 1):
        c = rows[j].get("Cash", float("nan"))
        if not _nan(c) and c > 0:
            vals.append((j, math.log(c)))
    if len(vals) < 3:
        return 0.0
    t_mean = sum(v[0] for v in vals) / len(vals)
    c_mean = sum(v[1] for v in vals) / len(vals)
    num = sum((v[0] - t_mean) * (v[1] - c_mean) for v in vals)
    den = sum((v[0] - t_mean) ** 2 for v in vals)
    return num / den if den > 1e-12 else 0.0


# ─── Trajectory Analysis ───────────────────────────────────────

def analyse_trajectory(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows

    cur_accum = 0.0
    consec_stress = 0
    consec_recovery = 0          # Fix 2: track consecutive recovery-qualifying quarters
    n_eval = 0

    for i, r in enumerate(rows):
        if quarter_year(r["quarter"]) < LIMEN["START_YEAR"]:
            r["stress_accum"] = 0.0
            r["distress_score"] = 0.0
            r["recovered"] = False
            cur_accum = 0.0
            consec_stress = 0
            consec_recovery = 0
            continue

        n_eval += 1

        has_rev = not _nan(r.get("z_var_Revenue", float("nan")))
        has_ocf = not _nan(r.get("z_var_OCF", float("nan")))
        if not has_rev and not has_ocf:
            r["stress_accum"] = cur_accum
            r["distress_score"] = cur_accum / max(math.sqrt(n_eval), 1)
            r["recovered"] = False
            consec_recovery = 0
            continue

        cslope = _cash_slope(rows, i, 6)

        if r["p3"] >= LIMEN["P3_ENTRY"]:
            consec_stress += 1
            consec_recovery = 0   # Reset recovery streak on any stressed quarter
            base_charge = r["p3"] * LIMEN["STRESS_CHARGE_RATE"]
            amplifier = 1.0 + LIMEN["P7_AMP"] * r["p7"]
            consec_bonus = 1.0 + LIMEN["CONSEC_BONUS_RATE"] * min(consec_stress, LIMEN["MAX_CONSEC_QTRS"])
            vuln_amp = 1.0
            if cslope < -0.15:
                vuln_amp += 1.0
            elif cslope < -0.05:
                vuln_amp += 0.5
            cur_accum += base_charge * amplifier * consec_bonus * vuln_amp
            r["recovered"] = False
        else:
            consec_stress = max(consec_stress - 1, 0)
            recovery_mean = (r["p4"] + r["p5"] + r["p6"]) / 3.0
            if recovery_mean > r["p3"] + 0.01:
                consec_recovery += 1
                # Fix 2: require 3+ consecutive qualifying quarters before full recovery
                if consec_recovery >= LIMEN["RECOVERY_CONSEC_REQUIRED"]:
                    decay = LIMEN["RECOVERY_DECAY"]
                    if cslope > 0.03:
                        decay *= 0.7
                    cur_accum *= decay
                    r["recovered"] = True
                else:
                    # Not enough consecutive recovery quarters yet — use slow baseline decay
                    cur_accum *= LIMEN["BASELINE_DECAY"]
                    r["recovered"] = False
            else:
                consec_recovery = 0  # Reset: didn't qualify this quarter
                cur_accum *= LIMEN["BASELINE_DECAY"]
                r["recovered"] = False

        r["stress_accum"] = max(cur_accum, 0.0)
        r["distress_score"] = r["stress_accum"] / max(math.sqrt(n_eval), 1)

    return rows


# ─── Rupture Detection — Path C ────────────────────────────────

def compute_rupture_score(rows: list[dict]) -> dict:
    if not rows:
        return {"score": 0, "quarter": None, "details": {}}

    bt_rows = [r for r in rows if quarter_year(r["quarter"]) >= LIMEN["START_YEAR"]]
    if not bt_rows:
        return {"score": 0, "quarter": None, "details": {}}

    n = len(bt_rows)
    rupture_events = []
    max_cash_drop = 0.0
    max_debt_spike = 0.0
    max_var_ratio = 0.0

    for i in range(1, n):
        signals = 0
        cash_drop_pct = 0.0
        debt_spike_pct = 0.0
        var_ratio = 0.0

        prev_cash = bt_rows[i - 1].get("Cash", float("nan"))
        curr_cash = bt_rows[i].get("Cash", float("nan"))
        if not _nan(prev_cash) and not _nan(curr_cash) and prev_cash > 0:
            cash_drop_pct = (prev_cash - curr_cash) / prev_cash
            if cash_drop_pct > LIMEN["RUPTURE_CASH_DROP"]:
                signals += 1
                max_cash_drop = max(max_cash_drop, cash_drop_pct)

        prev_debt = bt_rows[i - 1].get("Debt", float("nan"))
        curr_debt = bt_rows[i].get("Debt", float("nan"))
        if not _nan(prev_debt) and not _nan(curr_debt) and prev_debt > 0:
            debt_spike_pct = (curr_debt - prev_debt) / prev_debt
            if debt_spike_pct > LIMEN["RUPTURE_DEBT_SPIKE"]:
                signals += 1
                max_debt_spike = max(max_debt_spike, debt_spike_pct)
        elif not _nan(curr_debt) and curr_debt > 0 and (_nan(prev_debt) or prev_debt == 0):
            debt_spike_pct = 1.0
            signals += 1
            max_debt_spike = max(max_debt_spike, 1.0)

        curr_var = bt_rows[i].get("var_Revenue", float("nan"))
        if not _nan(curr_var) and i >= 4:
            trailing = [
                bt_rows[k].get("var_Revenue", float("nan"))
                for k in range(max(0, i - 8), i)
            ]
            trailing = [v for v in trailing if not _nan(v)]
            if len(trailing) >= 2:
                trailing.sort()
                tn = len(trailing)
                med_var = trailing[tn // 2] if tn % 2 == 1 else (trailing[tn // 2 - 1] + trailing[tn // 2]) / 2
                if med_var > 1e-12:
                    var_ratio = curr_var / med_var
                    if var_ratio > LIMEN["RUPTURE_VAR_JUMP"]:
                        signals += 1
                        max_var_ratio = max(max_var_ratio, var_ratio)

        if signals >= LIMEN["RUPTURE_MIN_SIGNALS"]:
            intensity = signals * (0.5 + max(cash_drop_pct, 0) + max(debt_spike_pct, 0) + min(var_ratio, 20.0) / 10.0)
            rupture_events.append({
                "idx": i, "quarter": bt_rows[i]["quarter"],
                "intensity": intensity, "signals": signals, "cash_drop": cash_drop_pct,
            })

    # Recovery filter
    RECOVERY_HORIZON = 4
    SURVIVORSHIP_QUARTERS = 8
    unrecovered = []
    for evt in rupture_events:
        remaining = n - evt["idx"] - 1
        if remaining < 2:
            unrecovered.append(evt)
            continue
        if remaining >= SURVIVORSHIP_QUARTERS:
            continue
        rupture_cash = bt_rows[evt["idx"]].get("Cash", float("nan"))
        recovered = False
        check_end = min(evt["idx"] + RECOVERY_HORIZON, n - 1)
        for ci in range(evt["idx"] + 1, check_end + 1):
            post_cash = bt_rows[ci].get("Cash", float("nan"))
            if not _nan(rupture_cash) and rupture_cash > 0:
                if not _nan(post_cash) and post_cash >= rupture_cash:
                    recovered = True
                    break
            elif not _nan(post_cash) and post_cash > 0:
                recovered = True
                break
        if not recovered:
            unrecovered.append(evt)

    best_score = 0.0
    first_q = None
    if unrecovered:
        best_score = max(e["intensity"] for e in unrecovered)
        first_q = min(e["quarter"] for e in unrecovered)

    return {
        "score": best_score, "quarter": first_q,
        "details": {
            "n_rupture_q": len(rupture_events), "n_unrecovered": len(unrecovered),
            "max_cash_drop": max_cash_drop, "max_debt_spike": max_debt_spike, "max_var_ratio": max_var_ratio,
        },
    }


# ─── Composite Score — Three-Path Alert ────────────────────────

def compute_composite_score(rows: list[dict]) -> dict:
    if not rows:
        return {"composite": 0, "first_q": None, "details": {}, "alert": False}

    bt_rows = [r for r in rows if quarter_year(r["quarter"]) >= LIMEN["START_YEAR"]]
    if not bt_rows:
        return {"composite": 0, "first_q": None, "details": {}, "alert": False}

    n_eval = len(bt_rows)
    p3_vals = [r["p3"] for r in bt_rows]
    cash_vals = [r.get("Cash", float("nan")) for r in bt_rows]

    stressed_mask = [v >= LIMEN["P3_ENTRY"] for v in p3_vals]
    n_stressed = sum(stressed_mask)
    stress_rate = n_stressed / max(n_eval, 1)

    max_consec = 0
    cur_c = 0
    for s in stressed_mask:
        cur_c = cur_c + 1 if s else 0
        max_consec = max(max_consec, cur_c)

    max_p3 = max(p3_vals)

    valid_cash = [(i, v) for i, v in enumerate(cash_vals) if not _nan(v) and v > 0]
    cash_decline = 0.0
    if len(valid_cash) >= 2:
        cash_decline = max(0.0, min(1.0, 1.0 - valid_cash[-1][1] / valid_cash[0][1]))

    # Sustained bonus
    sustained_mask = [v >= LIMEN["SUSTAINED_THRESH"] for v in p3_vals]
    max_consec_sustained = 0
    cur_cs = 0
    for s in sustained_mask:
        cur_cs = cur_cs + 1 if s else 0
        max_consec_sustained = max(max_consec_sustained, cur_cs)

    tail_n = min(2, len(p3_vals))
    still_stressed = tail_n > 0 and all(v >= LIMEN["P3_ENTRY"] for v in p3_vals[-tail_n:])
    sustained_bonus = 0.0
    if still_stressed and max_consec_sustained >= LIMEN["SUSTAINED_MIN_CONSEC"]:
        sustained_bonus = max(0, max_consec_sustained - (LIMEN["SUSTAINED_MIN_CONSEC"] - 1)) * LIMEN["SUSTAINED_WEIGHT"]

    # Paths
    path_a = 2.5 * stress_rate + 0.5 * max_consec / 10.0 + 0.5 * max(max_p3 - LIMEN["P3_ENTRY"], 0) + sustained_bonus
    path_b = 1.0 * stress_rate + 2.0 * cash_decline
    rupture = compute_rupture_score(rows)
    path_c = rupture["score"]
    composite = max(path_a, path_b, path_c)

    alert_a = path_a >= LIMEN["COMPOSITE_THRESH_A"]
    alert_b = path_b >= LIMEN["COMPOSITE_THRESH_B"]
    alert_c = path_c >= LIMEN["COMPOSITE_THRESH_C"]
    alert = alert_a or alert_b or alert_c

    # First alert quarter
    first_q = None
    if alert:
        candidates = []
        if alert_c and rupture["quarter"]:
            candidates.append(rupture["quarter"])
        if alert_a or alert_b:
            accum_vals = [r.get("stress_accum", 0) for r in bt_rows]
            max_accum = max(accum_vals) if accum_vals else 0
            if max_accum > 0:
                half_peak = max_accum * 0.5
                for i, av in enumerate(accum_vals):
                    if av >= half_peak:
                        candidates.append(bt_rows[i]["quarter"])
                        break
        if not candidates and n_stressed > 0:
            for i, s in enumerate(stressed_mask):
                if s:
                    candidates.append(bt_rows[i]["quarter"])
                    break
        if candidates:
            first_q = sorted(candidates)[0]

    # Trajectory classification
    ever_p3 = any(stressed_mask)
    ever_recovered = any(r.get("recovered", False) for r in bt_rows)
    if alert and path_c >= LIMEN["COMPOSITE_THRESH_C"]:
        trajectory = "RUPTURE"
    elif alert:
        trajectory = "UNRECOVERED_P3"
    elif not ever_p3:
        trajectory = "STABLE"
    elif ever_recovered and not alert:
        trajectory = "RECOVERED"
    else:
        trajectory = "MILD_STRESS"

    return {
        "composite": composite, "first_q": first_q, "alert": alert, "trajectory": trajectory,
        "details": {
            "stress_rate": stress_rate, "n_stressed": n_stressed, "max_consec": max_consec,
            "max_consec_sustained": max_consec_sustained, "sustained_bonus": sustained_bonus,
            "max_p3": max_p3, "cash_decline": cash_decline,
            "path_a": path_a, "path_b": path_b, "path_c": path_c,
            "rupture_max_cash_drop": rupture["details"].get("max_cash_drop", 0),
            "rupture_max_debt_spike": rupture["details"].get("max_debt_spike", 0),
            "rupture_max_var_ratio": rupture["details"].get("max_var_ratio", 0),
        },
    }


# ─── Dominant Phase ─────────────────────────────────────────────

def get_dominant_phase(row: dict, recent_rows: list[dict] | None = None) -> str | None:
    """Pick the dominant phase.

    If *recent_rows* is supplied (last N quarter rows, oldest-first),
    compute an exponentially-weighted average that favours recent
    quarters.  Otherwise fall back to the single latest row.
    """
    if not row:
        return None

    if recent_rows and len(recent_rows) >= 2:
        n = len(recent_rows)
        half_life = LIMEN["RECENCY_HALF_LIFE"]
        # Weights: latest row (index n-1) → age 0 → weight 1.0
        # Oldest row (index 0) → age n-1 → weight 2^(-(n-1)/half_life)
        weights = [2.0 ** (-(n - 1 - i) / half_life) for i in range(n)]
        total_w = sum(weights)

        best, best_val = None, -1.0
        for p in ALL_PHASES:
            wsum = sum(w * r.get(p, 0.0) for w, r in zip(weights, recent_rows))
            score = wsum / total_w
            if score > best_val:
                best_val = score
                best = p
        return best

    # Fallback: single row
    best, best_val = None, -1.0
    for p in ALL_PHASES:
        v = row.get(p, -1.0)
        if v > best_val:
            best_val = v
            best = p
    return best


# ─── Chronic Stress Override ────────────────────────────────────

def _apply_chronic_stress_override(rows: list[dict]) -> bool:
    """Force distress-phase dominance when chronic stress is detected.

    When structural breaks exist in the recent window, boosts P7a (terminal
    dissolution) instead of P3 — P7a is the more specific diagnosis.
    Otherwise falls back to boosting P3.

    Returns True if any override was applied (caller should use single-row
    dominant phase instead of recency-weighted selection).
    """
    if len(rows) < LIMEN["CHRONIC_MIN_CONSEC"]:
        return False

    latest = rows[-1]
    lookback = LIMEN["RECENCY_LOOKBACK"]
    recent = rows[-lookback:] if len(rows) >= lookback else rows

    # Check for structural breaks in the recent window
    has_breaks = any(
        r.get("break_Revenue", 0) > 0 or r.get("break_OCF", 0) > 0
        for r in recent
    )

    def _force_phase(target: str):
        """Boost target phase above all others in the latest row."""
        other_max = max(latest.get(p, 0) for p in ALL_PHASES if p != target)
        if latest.get(target, 0) <= other_max:
            latest[target] = max(latest.get(target, 0), other_max + 0.05, 0.55)

    def _apply_override() -> bool:
        if has_breaks:
            if _viability_breached(rows, len(rows) - 1):
                _force_phase("p7a")
            else:
                # Break without viability breach → controlled separation
                _force_phase("p7b")
        else:
            _force_phase("p3")
        return True

    # Path A: consecutive P3 above threshold ending at latest quarter
    thresh = LIMEN["CHRONIC_P3_THRESH"]
    required = LIMEN["CHRONIC_MIN_CONSEC"]
    consec = 0
    for r in reversed(rows):
        if r.get("p3", 0) >= thresh:
            consec += 1
        else:
            break
    if consec >= required:
        return _apply_override()

    avg_p3 = sum(r.get("p3", 0) for r in recent) / len(recent)

    # Path B: average P3 elevated + structural cash deterioration
    if avg_p3 >= LIMEN["CHRONIC_AVG_P3_THRESH"]:
        cash_first, cash_last = None, None
        for r in recent:
            c = r.get("Cash")
            if c is not None and not (isinstance(c, float) and math.isnan(c)) and c > 0:
                if cash_first is None:
                    cash_first = c
                cash_last = c
        if cash_first and cash_last and cash_first > 0:
            decline = (cash_first - cash_last) / cash_first
            if decline >= LIMEN["CHRONIC_CASH_DECLINE"]:
                return _apply_override()

    # Path C: persistent stress accumulation + recent acute P3 episode
    latest_accum = latest.get("stress_accum", 0)
    if latest_accum >= LIMEN["CHRONIC_STRESS_ACCUM_MIN"]:
        had_acute = any(r.get("p3", 0) >= LIMEN["P3_ENTRY"] for r in recent)
        if had_acute:
            return _apply_override()

    return False


# ─── Polyvagal Coupling (Pass 2) ────────────────────────────────
#
# Pass 1 (everything above) scores phases from the focal CIK's intrinsic
# SEC financials in isolation. That's single-channel ECG monitoring — it
# detects gross failure but cannot read autonomic phase coherently
# because phase is by definition a multi-system state (Porges polyvagal
# theory, McEwen allostatic load).
#
# Pass 2 admits supporting-cast context as biasing input — domain phase,
# peer cohort, counterparty exposure, capital-market context, labor /
# regulatory pressure, expanded macro — and applies it to the intrinsic
# phase vector as an additive bias. Pass 1 math is untouched; Pass 2 is
# a separate, fully optional, fully auditable second pass.
#
# Output:
#   coupling_mode = 'intrinsic_only'    (no context supplied or no signal)
#                 = 'polyvagal_coupled' (Pass 2 applied)
#   intrinsic_dominant_phase  — Pass 1 winner
#   intrinsic_phase_scores    — Pass 1 score vector
#   coupled_phase_scores      — Pass 2 score vector (only when coupled)
#   bias_contributions        — {signal_name: {phase: delta}} for audit
#   dominant_phase / phase_scores — the OUTPUT (coupled if active, else intrinsic)

def _safe_num(v: Any, default: float = 0.0) -> float:
    """Coerce maybe-None / maybe-NaN to float, with default."""
    if v is None:
        return default
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _compute_polyvagal_bias(context: dict, intrinsic_scores: dict) -> tuple[dict, dict]:
    """Compute per-phase bias from the polyvagal supporting-cast context.

    Returns (bias_by_phase, contributions_by_signal):
      bias_by_phase: {phase_id → signed delta} added to intrinsic scores
      contributions_by_signal: {signal_name → {phase_id → delta}} for audit

    Each rule below is conservative — biases are bounded so coupling
    never overwhelms the intrinsic signal. Calibration against historical
    cases (SIVB, BBBY, BA, RAD, BYND) is a separate work stream; these
    values are initial priors aligned with the spec rules in
    limen_thing2_polyvagal_coupling.md.
    """
    bias: dict = {p: 0.0 for p in ALL_PHASES}
    contributions: dict = {}

    if not context or not isinstance(context, dict):
        return bias, contributions

    def _add(signal_name: str, phase: str, delta: float) -> None:
        if phase not in ALL_PHASES or delta == 0:
            return
        bias[phase] += delta
        cont = contributions.setdefault(signal_name, {})
        cont[phase] = cont.get(phase, 0.0) + delta

    # ─── Domain phase: cohort drag + isolated-stress dampening ─────────
    domain = context.get("domainPhase")
    if isinstance(domain, dict):
        d_phase = domain.get("phase")
        d_stress = _safe_num(domain.get("stress"))
        if d_phase in ALL_PHASES and d_stress > 0:
            # Cohort drag: focal company's phase is biased toward the
            # domain's phase by the domain's stress intensity.
            drag = 0.20 * d_stress
            _add("domain_cohort_drag", d_phase, drag)

            # Isolated-stress dampener: if domain is P0 / P6 but intrinsic
            # is showing P3 stress, this is lone stress — not systemic —
            # so dampen toward P2 (recoverable).
            if d_phase in ("p0", "p6") and _safe_num(intrinsic_scores.get("p3")) > 0.5:
                _add("isolated_stress_dampener", "p3", -0.15)
                _add("isolated_stress_dampener", "p2",  0.15)

    # ─── Capital structure: lender phase propagates to P7 family ───────
    cap = context.get("capitalStructure")
    if isinstance(cap, dict):
        lenders = cap.get("lenders") or []
        if isinstance(lenders, list) and lenders:
            tot_exp = 0.0
            p7_exp = 0.0
            p7a_exp = 0.0
            for ln in lenders:
                if not isinstance(ln, dict):
                    continue
                ex = _safe_num(ln.get("exposureShare"))
                phase = str(ln.get("phase") or "").lower()
                tot_exp += ex
                if phase in ("p7", "p7a", "p9"):
                    p7_exp += ex
                if phase == "p7a":
                    p7a_exp += ex
            if tot_exp > 0:
                p7_ratio = p7_exp / tot_exp
                p7a_ratio = p7a_exp / tot_exp
                if p7_ratio > 0.5:
                    shift = 0.25 * p7_ratio
                    _add("lender_distress", "p7",  shift)
                    _add("lender_distress", "p7a", shift * 0.8)
                    _add("lender_distress", "p9",  shift * 0.4)
                elif p7a_ratio > 0.25:
                    # Even partial lender terminal exposure lifts P7a prior.
                    _add("lender_partial_terminal", "p7a", 0.15 * p7a_ratio)

        # Credit-spread widening is a perfusion-stress signal.
        spread_z = _safe_num(cap.get("creditSpreadZ"))
        if spread_z > 1.5:
            shift = 0.10 * min(1.0, (spread_z - 1.5) / 2.0)
            _add("credit_spread_widening", "p3",  shift)
            _add("credit_spread_widening", "p7b", shift * 0.5)

        # Covenant breach risk — categorical
        cov = str(cap.get("covenantStatus") or "").lower()
        if cov in ("breached", "near_breach"):
            _add("covenant_pressure", "p3",  0.10)
            _add("covenant_pressure", "p7b", 0.10)

    # ─── Peer cohort: median stress drags toward cohort baseline ───────
    cohort = context.get("peerCohort")
    if isinstance(cohort, dict):
        median_stress = _safe_num(cohort.get("medianStress"))
        # Healthy cohort dampens isolated P3 toward P2.
        if median_stress < 0.3 and _safe_num(intrinsic_scores.get("p3")) > 0.5:
            shift = 0.15 * ((0.3 - median_stress) / 0.3)
            _add("healthy_cohort_dampener", "p3", -shift)
            _add("healthy_cohort_dampener", "p2",  shift)
        # Stressed cohort drags P0 toward P3 (SIVB-style cohort drag).
        if median_stress > 0.5 and _safe_num(intrinsic_scores.get("p0")) > 0.5:
            shift = 0.20 * ((median_stress - 0.5) / 0.5)
            _add("stressed_cohort_drag", "p0", -shift)
            _add("stressed_cohort_drag", "p3",  shift)

    # ─── Counterparties: supplier rupture lifts P1; customer distress P3 ─
    cp = context.get("counterparties")
    if isinstance(cp, dict):
        # Suppliers
        suppliers = cp.get("suppliers") or []
        if isinstance(suppliers, list) and suppliers:
            sup_tot = 0.0
            sup_rupture = 0.0
            for s in suppliers:
                if not isinstance(s, dict):
                    continue
                ex = _safe_num(s.get("exposureShare"))
                phase = str(s.get("phase") or "").lower()
                sup_tot += ex
                if phase in ("p1", "p3", "p7", "p7a"):
                    sup_rupture += ex
            if sup_tot > 0 and (sup_rupture / sup_tot) > 0.3:
                shift = 0.20 * (sup_rupture / sup_tot)
                _add("supplier_rupture", "p1", shift)

        # Customers (concentration-weighted)
        customers = cp.get("customers") or []
        if isinstance(customers, list) and customers:
            cust_tot = 0.0
            cust_distress = 0.0
            for c in customers:
                if not isinstance(c, dict):
                    continue
                conc = _safe_num(c.get("concentrationShare"))
                phase = str(c.get("phase") or "").lower()
                cust_tot += conc
                if phase in ("p3", "p7", "p7a", "p9"):
                    cust_distress += conc
            if cust_tot > 0 and (cust_distress / cust_tot) > 0.3:
                shift = 0.18 * (cust_distress / cust_tot)
                _add("customer_demand_collapse", "p3",  shift)
                _add("customer_demand_collapse", "p7b", shift * 0.5)

    # ─── Labor: attrition + wage stress raises P3 ──────────────────────
    labor = context.get("laborContext")
    if isinstance(labor, dict):
        att = _safe_num(labor.get("sectorAttritionRate"))
        wage_z = _safe_num(labor.get("wageGrowthZ"))
        if att > 0.20 or wage_z > 1.5:
            shift = 0.0
            if att > 0.20:
                shift += 0.05 * min(1.0, (att - 0.20) / 0.20)
            if wage_z > 1.5:
                shift += 0.05 * min(1.0, (wage_z - 1.5) / 2.0)
            shift = min(shift, 0.15)
            _add("labor_destabilization", "p3", shift)

    # ─── Regulatory: enforcement velocity raises P1/P3 ─────────────────
    reg = context.get("regulatoryContext")
    if isinstance(reg, dict):
        vel = _safe_num(reg.get("enforcementVelocity30d"))
        # vel = ratio over baseline; > 2.0 means double normal velocity.
        if vel > 2.0:
            shift = 0.10 * min(1.0, (vel - 2.0) / 2.0)
            _add("regulatory_pressure", "p1", shift)
            _add("regulatory_pressure", "p3", shift * 0.7)

    # ─── Macro credit cycle (extension of existing fedfunds-only) ──────
    macro = context.get("macro")
    if isinstance(macro, dict):
        cycle = str(macro.get("creditCycleClass") or "").lower()
        if cycle == "tightening":
            _add("credit_cycle_tightening", "p3", 0.05)
        elif cycle == "loosening":
            _add("credit_cycle_loosening", "p6", 0.05)

        real_rate = _safe_num(macro.get("realRate"))
        # Real rates > 2.5% historically stress over-leveraged firms.
        if real_rate > 0.025:
            shift = 0.05 * min(1.0, (real_rate - 0.025) / 0.025)
            _add("real_rate_pressure", "p3", shift)

        demand_idx = _safe_num(macro.get("sectorDemandIndex"))
        # Negative demand index z-score = contracting demand environment.
        if demand_idx < -1.0:
            shift = 0.05 * min(1.0, (-1.0 - demand_idx) / 2.0)
            _add("sector_demand_contraction", "p3",  shift)
            _add("sector_demand_contraction", "p7b", shift * 0.3)

    return bias, contributions


def _apply_coupling(intrinsic_scores: dict, bias: dict) -> dict:
    """Apply additive bias to intrinsic phase scores, clamp to [0, 1].

    Conservative: we don't softmax (which would force renormalization
    and could amplify small biases into dominance shifts). Additive +
    clamp preserves the bias contributions visibly.
    """
    out: dict = {}
    for p in ALL_PHASES:
        v = _safe_num(intrinsic_scores.get(p)) + _safe_num(bias.get(p))
        out[p] = max(0.0, min(1.0, v))
    return out


def _dominant_from_scores(scores: dict) -> str:
    """Argmax over ALL_PHASES with deterministic tie-break (earlier phase wins)."""
    best_phase = ALL_PHASES[0]
    best_val = -1.0
    for p in ALL_PHASES:
        v = _safe_num(scores.get(p))
        if v > best_val:
            best_val = v
            best_phase = p
    return best_phase


# ─── Full Pipeline ──────────────────────────────────────────────

def run_pipeline(
    company_data: dict,
    fred_delta: dict | None = None,
    polyvagal_context: dict | None = None,
) -> dict:
    """data -> features -> phases -> P7 split -> runway gate -> trajectory
    -> composite alert -> [optional] polyvagal coupling (Pass 2).

    polyvagal_context (all keys optional, see limen_thing2_polyvagal_coupling.md):
      domainPhase, peerCohort, counterparties, capitalStructure,
      laborContext, regulatoryContext, macro

    When polyvagal_context is None or yields no biasing signal, the output
    is byte-identical to Pass 1 (intrinsic_only mode). When at least one
    signal contributes, the output emits both intrinsic_phase_scores and
    coupled_phase_scores plus per-signal bias_contributions for audit.
    """
    rows = compute_all_features(company_data, fred_delta or {})
    rows = score_all_phases(rows)
    rows = score_p7_split(rows)
    rows = _apply_runway_gate(rows)
    rows = analyse_trajectory(rows)

    # Chronic stress forces P3 dominance; returns True if override applied
    stress_override = _apply_chronic_stress_override(rows)

    result = compute_composite_score(rows)
    result["rows"] = rows

    # P0 suppression: cap P0 below dominant distress phases when composite > 0.5
    comp_score = result.get("composite", 0)
    if rows and comp_score > 0.5:
        latest = rows[-1]
        non_p0_max = max(latest.get(p, 0) for p in ALL_PHASES if p != "p0")
        if latest.get("p0", 0) >= non_p0_max:
            latest["p0"] = non_p0_max - 0.05

    # ─── Pass 1: intrinsic dominant phase ───────────────────────────────
    intrinsic_dominant: str | None = None
    intrinsic_scores: dict = {}
    intrinsic_source = "edgar_rows"   # audit trail for downstream consumers
    if rows:
        latest = rows[-1]
        capalloc = latest.get("p3_capalloc_dampened", False)
        if stress_override or capalloc:
            # Override or cap-alloc dampening → use single-row dominant (latest is most accurate)
            intrinsic_dominant = get_dominant_phase(latest)
        else:
            # Normal: recency-weighted phase selection over recent quarters
            lookback = LIMEN["RECENCY_LOOKBACK"]
            recent = rows[-lookback:] if len(rows) >= lookback else rows
            intrinsic_dominant = get_dominant_phase(latest, recent)
        intrinsic_scores = {p: latest.get(p, 0.0) for p in ALL_PHASES}
    else:
        # No EDGAR rows — use a neutral uniform prior so polyvagal coupling can
        # still produce a phase reading. Relaxed 2026-05-29: K2 must fire for
        # every portal regardless of EDGAR availability (private, ETF, banks,
        # bankrupt with sparse data, off-CB). intrinsic_dominant stays None
        # because the prior is informationless — the coupled reading carries
        # all the signal.
        intrinsic_scores = {p: 1.0 / len(ALL_PHASES) for p in ALL_PHASES}
        intrinsic_source = "neutral_prior"

    # ─── Pass 2: polyvagal coupling (optional) ──────────────────────────
    coupling_mode = "intrinsic_only"
    coupled_scores: dict = {}
    bias_contributions: dict = {}
    output_dominant = intrinsic_dominant

    # Rows no longer required — coupling fires whenever polyvagal context has
    # at least one signal contributing. Relaxed 2026-05-29.
    if polyvagal_context and isinstance(polyvagal_context, dict):
        bias, contributions = _compute_polyvagal_bias(polyvagal_context, intrinsic_scores)
        # Coupling fires only when at least one signal actually contributed.
        if any(abs(v) > 1e-9 for v in bias.values()):
            coupled_scores = _apply_coupling(intrinsic_scores, bias)
            coupled_dominant = _dominant_from_scores(coupled_scores)
            output_dominant = coupled_dominant
            bias_contributions = contributions
            coupling_mode = "polyvagal_coupled"
            # Record coupled scores on the latest row as suffixed fields
            # WITHOUT mutating the intrinsic p0..p10 values — downstream
            # accumulator / runway math reads intrinsic; UI can read coupled.
            # When rows is empty (neutral-prior path) there's no row to write
            # to; the coupled scores still flow through the result dict.
            if rows:
                latest = rows[-1]
                for p in ALL_PHASES:
                    latest[p + "_coupled"] = coupled_scores.get(p, 0.0)
                latest["coupling_mode"] = coupling_mode

    # ─── Compose output ─────────────────────────────────────────────────
    result["coupling_mode"] = coupling_mode
    result["intrinsic_dominant_phase"] = intrinsic_dominant
    result["intrinsic_phase_scores"] = intrinsic_scores
    result["intrinsic_source"] = intrinsic_source   # 'edgar_rows' | 'neutral_prior'
    if coupling_mode == "polyvagal_coupled":
        result["coupled_phase_scores"] = coupled_scores
        result["bias_contributions"] = bias_contributions
        # The OUTPUT phase scores switch to coupled when coupling fired.
        result["dominant_phase"] = output_dominant
        result["phase_meta"] = PHASE_META.get(output_dominant, {})
        result["phase_scores"] = coupled_scores
    else:
        result["dominant_phase"] = intrinsic_dominant
        result["phase_meta"] = PHASE_META.get(intrinsic_dominant or "p0", {})
        result["phase_scores"] = intrinsic_scores

    # Trajectory reconciliation (uses OUTPUT phase — coupled if active)
    dom = result.get("dominant_phase")
    comp = result.get("composite", 0)
    traj = result.get("trajectory")
    if dom == "p7a":
        result["trajectory"] = "TERMINAL_DIVERGENCE"
    elif dom == "p7b":
        result["trajectory"] = "CONTROLLED_SEPARATION"
    elif dom == "p3" and comp > 0.45 and traj in ("RECOVERED", "STABLE"):
        result["trajectory"] = "ACTIVE_STRESS"

    return result


# ─── EDGAR Data Extraction (mirrors JS extractQuarterlySeries) ──

def extract_quarterly_series(facts_json: dict, tag_names: list[str], is_flow: bool) -> dict[str, float]:
    if not facts_json:
        return {}
    us_gaap = facts_json.get("facts", {}).get("us-gaap", {})

    for tag in tag_names:
        tag_data = us_gaap.get(tag)
        if not tag_data:
            continue
        units = tag_data.get("units", {})
        unit_data = units.get("USD") or units.get("USD/shares")
        if not unit_data and units:
            unit_data = next(iter(units.values()))
        if not unit_data:
            continue

        frame_entries: dict[str, float] = {}
        raw_entries = []

        for entry in unit_data:
            form = entry.get("form", "")
            if form not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                continue
            raw_entries.append(entry)
            frame = entry.get("frame")
            if not frame:
                continue
            parsed = _parse_frame(frame)
            if not parsed:
                continue

            if is_flow:
                if "Q" in frame and "I" not in frame:
                    if parsed not in frame_entries or abs(entry.get("val", 0)) > 0:
                        frame_entries[parsed] = entry.get("val", 0)
            else:
                if parsed not in frame_entries:
                    frame_entries[parsed] = entry.get("val", 0)

        if len(frame_entries) >= 4:
            # Guard: detect annual-only data masquerading as quarterly.
            # If all entries share the same quarter suffix (e.g., all Q1),
            # these are likely annual totals — fall through to date-range fallback.
            quarter_suffixes = set(k[-2:] for k in frame_entries.keys() if len(k) >= 2)
            if len(quarter_suffixes) > 1:
                return frame_entries
            # else: single-quarter data (annual) — skip to fallback

        # Fallback: filed entries
        filed = []
        for entry in raw_entries:
            if entry.get("val") is not None and entry.get("end"):
                try:
                    from datetime import datetime
                    end_dt = datetime.fromisoformat(entry["end"])
                    start_dt = datetime.fromisoformat(entry["start"]) if entry.get("start") else None
                    filed.append({"val": entry["val"], "end": end_dt, "start": start_dt})
                except (ValueError, KeyError):
                    pass
        filed.sort(key=lambda e: e["end"])

        result: dict[str, float] = {}
        if is_flow:
            for e in filed:
                if e["start"]:
                    days = (e["end"] - e["start"]).days
                    if 60 <= days <= 120:
                        qk = date_to_quarter(e["end"].year, e["end"].month)
                        result[qk] = e["val"]
        else:
            for e in filed:
                qk = date_to_quarter(e["end"].year, e["end"].month)
                result[qk] = e["val"]

        if len(result) >= 2:
            return result

    return {}


def _parse_frame(frame: str) -> str | None:
    s = frame.replace("I", "")
    if "Q" in s:
        parts = s.replace("CY", "").split("Q")
        try:
            yr, qtr = int(parts[0]), int(parts[1])
            return f"{yr}Q{qtr}"
        except (ValueError, IndexError):
            return None
    else:
        try:
            yr = int(s.replace("CY", ""))
            return f"{yr}Q4"
        except ValueError:
            return None


def build_company_data(facts_json: dict, is_financial: bool = False) -> dict:
    """Convert raw SEC EDGAR facts JSON into pipeline-ready company data dict."""
    data: dict[str, dict] = {}
    data["Revenue"] = extract_quarterly_series(facts_json, TAG_MAP["Revenue"], True)
    data["OCF"] = extract_quarterly_series(facts_json, TAG_MAP["OCF"], True)
    data["Cash"] = extract_quarterly_series(facts_json, TAG_MAP["Cash"], False)

    if is_financial:
        data["Debt"] = extract_quarterly_series(facts_json, TAG_MAP["Liabilities"], False)
        data["Deposits"] = extract_quarterly_series(facts_json, TAG_MAP["Deposits"], False)
    else:
        dc = extract_quarterly_series(facts_json, TAG_MAP["DebtCurrent"], False)
        dl = extract_quarterly_series(facts_json, TAG_MAP["DebtLong"], False)
        all_q = set(dc.keys()) | set(dl.keys())
        data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}

    return data
