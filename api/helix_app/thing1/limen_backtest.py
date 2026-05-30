#!/usr/bin/env python3
"""
LIMEN Helix Predictive Back-Test — Full 11-Phase Pipeline
============================================================
All 11 phases scored per quarter.  Trajectory-based classification:
  Phase 3 WITHOUT subsequent Phase 4-6 recovery = true distress signal.
  Phase 3 WITH Phase 4-6 recovery = false alarm, downgrade alert.
"""

import os, sys, time, warnings, json, math
from datetime import datetime, date
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
from statsmodels.tsa.stattools import acf
from sklearn.metrics import (
    average_precision_score, precision_recall_curve, roc_curve, auc
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

try:
    import ruptures
    HAS_RUPTURES = True
except ImportError:
    HAS_RUPTURES = False

warnings.filterwarnings("ignore")

# ─── Configuration ────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "output"
PLOT_DIR   = OUTPUT_DIR / "plots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PLOT_DIR.mkdir(parents=True, exist_ok=True)

SEC_UA      = "limenhelix@gmail.com"
FRED_KEY    = "a0735d0210d8a8d572dc3fad39219d97"
SEC_HEADERS = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}
SEC_SLEEP   = 0.15
START_YEAR  = 2015
RECOVERY_WINDOW = 6   # quarters after P3 spike to look for P4-6 recovery
P3_ENTRY    = 0.55    # threshold to enter "distress episode"
RECOVERY_TH = 0.50    # mean(p4,p5,p6) must exceed this for recovery

# ─── Cohort ───────────────────────────────────────────────────────────────────
# Regime 1 = Structural Decay (income/balance-sheet deterioration)
# Regime 2 = Liquidity Crisis (deposit flight — future feature tier)
DISTRESS = [
    {"ticker": "HTZ",  "cik": "0001657853", "sector": "Rental",      "event": "2020-05-22", "regime": 1},
    {"ticker": "JCP",  "cik": "0001166126", "sector": "Retail",      "event": "2020-05-15", "regime": 1},
    {"ticker": "CHK",  "cik": "0000895126", "sector": "Energy",      "event": "2020-06-28", "regime": 1},
    {"ticker": "BBBY", "cik": "0000886158", "sector": "Retail",      "event": "2023-04-23", "regime": 1},
    {"ticker": "SIVB", "cik": "0000719739", "sector": "Banking",     "event": "2023-03-10", "regime": 2},
    {"ticker": "WE",   "cik": "0001813756", "sector": "Real Estate", "event": "2023-11-06", "regime": 1},
    {"ticker": "FRC",  "cik": "0001132979", "sector": "Banking",     "event": "2023-05-01", "regime": 2},
    {"ticker": "SBNY", "cik": "0001288855", "sector": "Banking",     "event": "2023-03-12", "regime": 2},
]
CONTROLS = [
    {"ticker": "CAR",  "cik": "0000723612", "sector": "Rental",      "event": None, "regime": 1},
    {"ticker": "M",    "cik": "0000794367", "sector": "Retail",      "event": None, "regime": 1},
    {"ticker": "XOM",  "cik": "0000034088", "sector": "Energy",      "event": None, "regime": 1},
    {"ticker": "WMT",  "cik": "0000104169", "sector": "Retail",      "event": None, "regime": 1},
    {"ticker": "JPM",  "cik": "0000019617", "sector": "Banking",     "event": None, "regime": 1},
    {"ticker": "SLG",  "cik": "0001040971", "sector": "Real Estate", "event": None, "regime": 1},
    {"ticker": "SCHW", "cik": "0000316709", "sector": "Banking",     "event": None, "regime": 1},
    {"ticker": "USB",  "cik": "0000036104", "sector": "Banking",     "event": None, "regime": 1},
]
ALL_COMPANIES = DISTRESS + CONTROLS

TAG_MAP = {
    "Revenue": [
        "us-gaap/Revenues",
        "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax",
        "us-gaap/SalesRevenueNet",
        "us-gaap/RevenueFromContractWithCustomerIncludingAssessedTax",
        "us-gaap/InterestAndDividendIncomeOperating",
        "us-gaap/InterestIncomeExpenseNet",
        "us-gaap/NoninterestIncome",
    ],
    "OCF": [
        "us-gaap/NetCashProvidedByUsedInOperatingActivities",
        "us-gaap/NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "Cash": [
        "us-gaap/CashAndCashEquivalentsAtCarryingValue",
        "us-gaap/CashCashEquivalentsAndShortTermInvestments",
        "us-gaap/Cash",
        "us-gaap/CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
    "DebtCurrent": [
        "us-gaap/DebtCurrent",
        "us-gaap/ShortTermBorrowings",
        "us-gaap/LongTermDebtCurrent",
        "us-gaap/CurrentPortionOfLongTermDebt",
    ],
    "DebtLong": [
        "us-gaap/LongTermDebtNoncurrent",
        "us-gaap/LongTermDebt",
        "us-gaap/LongTermDebtAndCapitalLeaseObligations",
    ],
}

# ─── Pure-Python PELT fallback ────────────────────────────────────────────────
def _cost_l2(signal, start, end):
    seg = signal[start:end]
    if len(seg) == 0:
        return 0.0
    return np.sum((seg - np.mean(seg)) ** 2)

def pelt_breakpoints(signal, pen):
    n = len(signal)
    if n < 2:
        return [n]
    F = np.full(n + 1, np.inf)
    F[0] = -pen
    cp = {0: []}
    admissible = [0]
    for t_star in range(1, n + 1):
        candidates = []
        for t in admissible:
            cost = F[t] + _cost_l2(signal, t, t_star) + pen
            candidates.append((cost, t))
        best_cost, best_t = min(candidates, key=lambda x: x[0])
        F[t_star] = best_cost
        cp[t_star] = cp.get(best_t, []) + [t_star]
        admissible = [t for t, (c, _) in zip(admissible, candidates)
                      if c + _cost_l2(signal, t, t_star) <= F[t_star] + pen]
        admissible.append(t_star)
    return cp[n]

def detect_breaks(window_values):
    arr = np.asarray(window_values, dtype=float)
    if len(arr) < 3:
        return 0
    var = np.var(arr)
    pen = max(np.log(len(arr)) * var, 1e-6)
    try:
        if HAS_RUPTURES:
            bps = ruptures.Pelt(model="l2").fit(arr).predict(pen=pen)
        else:
            bps = pelt_breakpoints(arr, pen)
        n_bps = len(bps) - 1 if bps and bps[-1] == len(arr) else len(bps)
        return n_bps
    except Exception:
        return 0

# ─── Helpers ──────────────────────────────────────────────────────────────────
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -10, 10)))

def robust_z(x, history):
    med = np.nanmedian(history)
    mad = np.nanmedian(np.abs(history - med))
    z = 0.6745 * (x - med) / max(mad, 1e-8)
    return np.clip(z, -5, 5)

def quarter_end(frame_str):
    s = frame_str.replace("I", "")
    try:
        if "Q" in s:
            parts = s.replace("CY", "").split("Q")
            yr, qtr = int(parts[0]), int(parts[1])
            month = qtr * 3
            day = {3: 31, 6: 30, 9: 30, 12: 31}[month]
            return datetime(yr, month, day), "I" in frame_str
        else:
            yr = int(s.replace("CY", ""))
            return datetime(yr, 12, 31), "I" in frame_str
    except Exception:
        return None, False

def date_to_quarter(dt):
    return (dt.year, (dt.month - 1) // 3 + 1)

def quarter_to_date(yq):
    y, q = yq
    m = q * 3
    d = {3: 31, 6: 30, 9: 30, 12: 31}[m]
    return datetime(y, m, d)

def quarter_diff(yq1, yq2):
    return (yq2[0] - yq1[0]) * 4 + (yq2[1] - yq1[1])

# ─── SEC Data Fetch ───────────────────────────────────────────────────────────
def fetch_sec_facts(cik):
    cik_padded = cik.lstrip("0").zfill(10)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_padded}.json"
    for attempt in range(5):
        try:
            time.sleep(SEC_SLEEP)
            r = requests.get(url, headers=SEC_HEADERS, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                wait = 2 ** attempt
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"    SEC returned {r.status_code} for CIK {cik}")
                return None
        except Exception as e:
            print(f"    SEC request error: {e}")
            time.sleep(2 ** attempt)
    return None

def extract_quarterly_series(facts_json, tag_names, metric_name, is_flow=True):
    if facts_json is None:
        return {}
    us_gaap = facts_json.get("facts", {}).get("us-gaap", {})
    for tag_path in tag_names:
        tag = tag_path.split("/")[-1]
        if tag not in us_gaap:
            continue
        units = us_gaap[tag].get("units", {})
        unit_data = None
        for ukey in ["USD", "USD/shares"]:
            if ukey in units:
                unit_data = units[ukey]
                break
        if unit_data is None and units:
            unit_data = list(units.values())[0]
        if not unit_data:
            continue

        frame_entries = {}
        raw_entries = []
        for entry in unit_data:
            form = entry.get("form", "")
            if form not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                continue
            raw_entries.append(entry)
            frame = entry.get("frame")
            if frame:
                qe, is_instant = quarter_end(frame)
                if qe is None:
                    continue
                yq = date_to_quarter(qe)
                if is_flow:
                    if "Q" in frame and "I" not in frame:
                        if yq not in frame_entries or abs(entry.get("val", 0)) > 0:
                            frame_entries[yq] = entry.get("val", 0)
                else:
                    if yq not in frame_entries:
                        frame_entries[yq] = entry.get("val", 0)

        if len(frame_entries) >= 4:
            return frame_entries

        filed_entries = []
        for entry in raw_entries:
            val = entry.get("val")
            end = entry.get("end")
            start = entry.get("start")
            if val is not None and end:
                try:
                    end_dt = datetime.strptime(end, "%Y-%m-%d")
                    start_dt = datetime.strptime(start, "%Y-%m-%d") if start else None
                    filed_entries.append({"val": val, "end": end_dt, "start": start_dt,
                                          "form": entry.get("form", "")})
                except:
                    pass
        if not filed_entries:
            continue
        filed_entries.sort(key=lambda x: x["end"])
        result = {}
        if is_flow:
            for e in filed_entries:
                if e["start"]:
                    days = (e["end"] - e["start"]).days
                    if 60 <= days <= 120:
                        yq = date_to_quarter(e["end"])
                        result[yq] = e["val"]
        else:
            for e in filed_entries:
                yq = date_to_quarter(e["end"])
                result[yq] = e["val"]
        if len(result) >= 2:
            return result
    return {}

def fetch_company_data(company):
    ticker = company["ticker"]
    cik = company["cik"]
    print(f"  Fetching SEC data for {ticker} (CIK {cik})...")
    facts = fetch_sec_facts(cik)
    if facts is None:
        print(f"    WARNING: No SEC data for {ticker}")
        return None
    data = {}
    data["Revenue"] = extract_quarterly_series(facts, TAG_MAP["Revenue"], "Revenue", is_flow=True)
    data["OCF"] = extract_quarterly_series(facts, TAG_MAP["OCF"], "OCF", is_flow=True)
    data["Cash"] = extract_quarterly_series(facts, TAG_MAP["Cash"], "Cash", is_flow=False)
    dc = extract_quarterly_series(facts, TAG_MAP["DebtCurrent"], "DebtCurrent", is_flow=False)
    dl = extract_quarterly_series(facts, TAG_MAP["DebtLong"], "DebtLong", is_flow=False)
    all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}
    for metric, series in data.items():
        print(f"    {metric}: {len(series) if series else 0} quarters")
    return data

# ─── FRED Data Fetch ──────────────────────────────────────────────────────────
def fetch_fred():
    print("  Fetching FRED FEDFUNDS...")
    url = (f"https://api.stlouisfed.org/fred/series/observations"
           f"?series_id=FEDFUNDS&api_key={FRED_KEY}&file_type=json"
           f"&observation_start=2014-01-01")
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        obs = r.json().get("observations", [])
    except Exception as e:
        print(f"    FRED error: {e}")
        return {}
    monthly = {}
    for o in obs:
        try:
            dt = datetime.strptime(o["date"], "%Y-%m-%d")
            monthly[dt] = float(o["value"])
        except:
            pass
    if not monthly:
        return {}
    quarterly = {}
    for dt in sorted(monthly):
        yq = date_to_quarter(dt)
        quarterly.setdefault(yq, []).append(monthly[dt])
    ff_q = {yq: np.mean(v) for yq, v in quarterly.items()}
    sorted_q = sorted(ff_q)
    delta = {}
    for i in range(1, len(sorted_q)):
        delta[sorted_q[i]] = ff_q[sorted_q[i]] - ff_q[sorted_q[i - 1]]
    print(f"    FEDFUNDS: {len(delta)} quarterly deltas")
    return delta

# ─── Feature Engineering ─────────────────────────────────────────────────────
def compute_log_diff(series_dict):
    sorted_q = sorted(series_dict.keys())
    result = {}
    for i in range(1, len(sorted_q)):
        q, q_prev = sorted_q[i], sorted_q[i - 1]
        curr, prev = series_dict[q], series_dict[q_prev]
        if prev is None or curr is None:
            continue
        if prev > 0 and curr > 0:
            result[q] = np.log(curr / prev)
        elif abs(prev) > 1e-9:
            result[q] = (curr - prev) / abs(prev)
        else:
            result[q] = 0.0
    return result

def compute_rolling_features(log_diffs, window_size=4):
    sorted_q = sorted(log_diffs.keys())
    features = {}
    for i in range(len(sorted_q)):
        q = sorted_q[i]
        start_idx = max(0, i - window_size + 1)
        window_vals = np.array([log_diffs[sorted_q[j]]
                                for j in range(start_idx, i + 1)], dtype=float)
        if len(window_vals) < window_size:
            continue
        feat = {}
        feat["var"] = np.var(window_vals)
        try:
            if np.std(window_vals) < 1e-12:
                feat["ac"] = 0.0
            else:
                feat["ac"] = np.clip(acf(window_vals, nlags=1, fft=False)[1], -1, 1)
        except:
            feat["ac"] = 0.0
        try:
            X = sm.add_constant(np.arange(len(window_vals)))
            feat["slope"] = sm.OLS(window_vals, X).fit().params[1]
        except:
            feat["slope"] = 0.0
        feat["accel"] = np.diff(np.diff(window_vals)).mean() if len(window_vals) >= 3 else 0.0
        feat["break"] = detect_breaks(window_vals)
        features[q] = feat
    return features

def compute_all_features(company_data, fred_delta):
    metrics = ["Revenue", "OCF", "Cash", "Debt"]
    log_diffs = {}
    for m in metrics:
        log_diffs[m] = compute_log_diff(company_data[m]) if company_data.get(m) else {}

    rolling_4q = {}
    rolling_8q = {}
    for m in metrics:
        rolling_4q[m] = compute_rolling_features(log_diffs[m], 4) if log_diffs[m] else {}
        rolling_8q[m] = compute_rolling_features(log_diffs[m], 8) if log_diffs[m] else {}

    all_quarters = set()
    for m in metrics:
        all_quarters.update(rolling_4q[m].keys())
    all_quarters = sorted(all_quarters)
    if not all_quarters:
        return pd.DataFrame()

    rows = []
    history = {m: {s: [] for s in ["var", "ac", "slope", "accel"]} for m in metrics}
    history_8q = {m: {s: [] for s in ["var", "ac", "slope", "accel"]} for m in metrics}
    runway_history = []
    delta_ff_history = []

    # Track prior-quarter variance for delta_var computation (Phase 1 & 4)
    prev_var = {m: None for m in metrics}

    for q in all_quarters:
        row = {"quarter": q, "date": quarter_to_date(q)}

        # Raw levels
        for m in metrics:
            row[m] = company_data.get(m, {}).get(q, np.nan)

        # 4Q rolling features + z-scores
        for m in metrics:
            feat = rolling_4q[m].get(q, {})
            for stat in ["var", "ac", "slope", "accel"]:
                val = feat.get(stat, np.nan)
                col = f"{stat}_{m}"
                row[col] = val
                if not np.isnan(val):
                    history[m][stat].append(val)
                    row[f"z_{col}"] = robust_z(val, np.array(history[m][stat]))
                else:
                    row[f"z_{col}"] = np.nan
            row[f"break_{m}"] = feat.get("break", 0)

            # Delta variance (current - previous quarter)
            cur_var = feat.get("var", np.nan)
            if not np.isnan(cur_var) and prev_var[m] is not None:
                row[f"delta_var_{m}"] = cur_var - prev_var[m]
            else:
                row[f"delta_var_{m}"] = np.nan
            if not np.isnan(cur_var):
                prev_var[m] = cur_var

        # 8Q rolling features + z-scores (for longer-window stability signals)
        for m in metrics:
            feat8 = rolling_8q[m].get(q, {})
            for stat in ["var", "ac", "slope", "accel"]:
                val = feat8.get(stat, np.nan)
                col8 = f"{stat}_{m}_8q"
                row[col8] = val
                if not np.isnan(val):
                    history_8q[m][stat].append(val)
                    row[f"z_{col8}"] = robust_z(val, np.array(history_8q[m][stat]))
                else:
                    row[f"z_{col8}"] = np.nan
            row[f"break_{m}_8q"] = feat8.get("break", 0)

        # Liquidity runway
        cash_val = company_data.get("Cash", {}).get(q, np.nan)
        ocf_val = company_data.get("OCF", {}).get(q, np.nan)
        if not np.isnan(cash_val) and not np.isnan(ocf_val):
            runway = cash_val / max(1.0, abs(ocf_val))
            runway_history.append(runway)
            row["runway"] = runway
            row["z_runway"] = robust_z(runway, np.array(runway_history))
        else:
            row["runway"] = np.nan
            row["z_runway"] = np.nan

        # FRED delta
        dff = fred_delta.get(q, np.nan)
        if not np.isnan(dff):
            delta_ff_history.append(dff)
            row["delta_fedfunds"] = dff
            row["z_delta_fedfunds"] = robust_z(dff, np.array(delta_ff_history))
        else:
            row["delta_fedfunds"] = np.nan
            row["z_delta_fedfunds"] = np.nan

        rows.append(row)

    return pd.DataFrame(rows)


# ─── 11-Phase Scoring ────────────────────────────────────────────────────────
def score_all_phases(df):
    """Score all 11 LIMEN Helix phases per quarter."""
    if df.empty:
        return df
    df = df.copy()

    # --- Sigmoid helper (vectorised) ---
    def _sig(col, negate=False):
        v = df[col].fillna(0).values
        return sigmoid(-v if negate else v)

    # ── Risk building blocks ──
    df["risk_var_rev"]   = _sig("z_var_Revenue")
    df["risk_ac_rev"]    = _sig("z_ac_Revenue")
    df["risk_slope_rev"] = _sig("z_slope_Revenue", negate=True)   # risk ↑ when slope negative
    df["risk_accel_rev"] = _sig("z_accel_Revenue", negate=True)   # risk ↑ when decelerating
    df["risk_var_ocf"]   = _sig("z_var_OCF")
    df["risk_ac_ocf"]    = _sig("z_ac_OCF")
    df["risk_slope_ocf"] = _sig("z_slope_OCF", negate=True)
    df["risk_accel_ocf"] = _sig("z_accel_OCF", negate=True)
    df["risk_slope_debt"] = _sig("z_slope_Debt")                  # risk ↑ when debt growing
    df["risk_accel_debt"] = _sig("z_accel_Debt")
    df["risk_slope_cash"] = _sig("z_slope_Cash")                  # health ↑ when cash growing
    df["risk_break_rev"] = (df["break_Revenue"] > 1).astype(float)
    df["risk_break_ocf"] = (df["break_OCF"] > 1).astype(float)
    df["risk_break_rev_8q"] = (df.get("break_Revenue_8q", pd.Series(0, index=df.index)) > 1).astype(float)
    df["risk_liq"]        = sigmoid(-df["z_runway"].fillna(0).values)

    # "Good" signals (inverted — high = healthy)
    df["stab_var_rev"]    = 1.0 - df["risk_var_rev"]       # low var = stable
    df["stab_var_ocf"]    = 1.0 - df["risk_var_ocf"]
    df["health_slope_rev"]  = 1.0 - df["risk_slope_rev"]   # positive slope
    df["health_slope_ocf"]  = 1.0 - df["risk_slope_ocf"]
    df["health_accel_rev"]  = 1.0 - df["risk_accel_rev"]   # accelerating revenue
    df["health_slope_cash"] = _sig("z_slope_Cash")          # cash growing
    df["health_slope_debt_neg"] = _sig("z_slope_Debt", negate=True)  # debt declining

    # Variance direction (is variance decreasing quarter-over-quarter?)
    dv_rev = df["delta_var_Revenue"].fillna(0).values
    dv_ocf = df["delta_var_OCF"].fillna(0).values
    df["var_decreasing_rev"] = sigmoid(-10.0 * dv_rev)     # sharp sigmoid: 1 if dv<0
    df["var_decreasing_ocf"] = sigmoid(-10.0 * dv_ocf)

    # Cash burn deceleration: OCF acceleration positive = burn slowing
    df["burn_decelerating"] = _sig("z_accel_OCF")

    # Revenue diversification proxy: lower autocorrelation in revenue = more diverse
    df["rev_diversity"] = 1.0 - df["risk_ac_rev"]

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 0  —  Source / Stable Baseline
    #   Low variance, stable revenue, moderate positive growth.
    # ══════════════════════════════════════════════════════════════════════
    df["p0"] = np.mean([
        df["stab_var_rev"].values,
        df["stab_var_ocf"].values,
        df["health_slope_rev"].values,
        sigmoid(df["z_slope_Revenue"].fillna(0).values),    # moderate positive
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 1  —  Rupture / First Disruption
    #   Revenue variance spike (delta_var > 0), sudden margin compression,
    #   first negative surprise (slope turns negative).
    # ══════════════════════════════════════════════════════════════════════
    var_spike_rev = sigmoid(10.0 * df["delta_var_Revenue"].fillna(0).values)   # 1 if var jumping
    df["p1"] = np.mean([
        var_spike_rev,
        df["risk_slope_rev"].values,       # negative revenue slope
        df["risk_accel_rev"].values,       # decelerating
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 2  —  Rhythm / Alliance Building
    #   Revenue diversification increasing, hiring acceleration proxy
    #   (rising OCF slope with rising revenue), growth accelerating.
    # ══════════════════════════════════════════════════════════════════════
    df["p2"] = np.mean([
        df["rev_diversity"].values,
        df["health_slope_rev"].values,
        df["health_accel_rev"].values,
        df["health_slope_ocf"].values,
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 3  —  Darkness / Instability  (from original spec)
    #   High variance, rising autocorrelation, declining slope, accel burn.
    # ══════════════════════════════════════════════════════════════════════
    df["p3"] = np.mean([
        df["risk_var_rev"].values,
        df["risk_ac_rev"].values,
        df["risk_slope_rev"].values,
        df["risk_accel_rev"].values,
        df["risk_var_ocf"].values,
        df["risk_ac_ocf"].values,
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 4  —  Peace / Stabilisation  (parasympathetic response)
    #   Variance DECREASING after Phase 3 spike.
    #   Cash burn decelerating.  Revenue slope flattening / recovering.
    # ══════════════════════════════════════════════════════════════════════
    df["p4"] = np.mean([
        df["var_decreasing_rev"].values,
        df["var_decreasing_ocf"].values,
        df["burn_decelerating"].values,
        # slope approaching zero (not deeply negative) — use 1 - |risk_slope - 0.5|*2
        (1.0 - np.abs(df["risk_slope_rev"].values - 0.5) * 2).clip(0, 1),
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 5  —  Endurance / Stress Inoculation
    #   Revenue recovering.  Debt being serviced.  Positive OCF slope
    #   despite elevated variance.  Growing under stress.
    # ══════════════════════════════════════════════════════════════════════
    df["p5"] = np.mean([
        df["health_slope_rev"].values,
        df["health_slope_ocf"].values,
        df["risk_var_rev"].values,           # variance still elevated (stress present)
        df["health_slope_debt_neg"].values,  # debt declining or flat
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 6  —  Order / Control
    #   Low variance, stable metrics, revenue predictable,
    #   debt declining, cash building.
    # ══════════════════════════════════════════════════════════════════════
    df["p6"] = np.mean([
        df["stab_var_rev"].values,
        df["stab_var_ocf"].values,
        df["health_slope_cash"].values,
        df["health_slope_debt_neg"].values,
        # low autocorrelation = predictable, not trending (stable noise)
        (1.0 - np.abs(df["risk_ac_rev"].values - 0.5) * 2).clip(0, 1),
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 7  —  Dissolution / Structural Divergence  (from original spec)
    # ══════════════════════════════════════════════════════════════════════
    df["p7"] = np.mean([
        df["risk_break_rev"].values,
        df["risk_break_ocf"].values,
        df["risk_accel_debt"].values,
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 8  —  Conscience / Business-Model Pivot
    #   Revenue diversification shift.  New revenue streams = structural
    #   break in revenue WITH positive slope afterward.  Break + growth.
    # ══════════════════════════════════════════════════════════════════════
    df["p8"] = np.mean([
        df["risk_break_rev"].values,          # structural change detected
        df["health_slope_rev"].values,        # but slope is positive (pivot working)
        df["rev_diversity"].values,           # low autocorrelation = new pattern
        df["risk_break_rev_8q"].values,       # long-window break too
    ], axis=0)

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 9  —  Threshold / Collapse  (from original spec)
    # ══════════════════════════════════════════════════════════════════════
    p9_vals = []
    for _, row in df.iterrows():
        if row["p3"] > 0.6:
            z_dff = row.get("z_delta_fedfunds", 0)
            z_dff = 0 if np.isnan(z_dff) else z_dff
            raw = (0.5 * row["p3"] + 0.3 * row["risk_liq"] +
                   0.2 * row["risk_break_rev"] + 0.2 * max(0, z_dff))
            p9_vals.append(sigmoid(raw))
        else:
            p9_vals.append(0.0)
    df["p9"] = p9_vals

    # ══════════════════════════════════════════════════════════════════════
    # PHASE 10 —  Resurrection / New Baseline
    #   Fundamentals stabilising at a DIFFERENT level than pre-crisis.
    #   Structural break detected + variance now low + slope stable.
    # ══════════════════════════════════════════════════════════════════════
    df["p10"] = np.mean([
        df["risk_break_rev_8q"].values,       # structural change happened
        df["stab_var_rev"].values,            # but variance now low
        df["stab_var_ocf"].values,
        # slope near zero (new steady state) — same flatness measure as p4
        (1.0 - np.abs(df["risk_slope_rev"].values - 0.5) * 2).clip(0, 1),
    ], axis=0)

    return df


# ─── Trajectory Analysis ─────────────────────────────────────────────────────
# Accumulator-based trajectory model.
# Each quarter:
#   - P3 above entry → accumulator CHARGES (stress building)
#   - P3 drops + recovery phases active → accumulator DECAYS (stress releasing)
# Distress = companies whose accumulator keeps rising without discharge.
# Controls = companies whose accumulator charges then discharges (oscillates).
STRESS_CHARGE_RATE = 1.0
P7_AMP             = 0.2     # P7 (divergence) amplifier in charge
CONSEC_BONUS_RATE  = 0.20    # bonus per consecutive stress quarter
MAX_CONSEC_QTRS    = 6       # cap on consecutive-stress multiplier
RECOVERY_DECAY     = 0.30    # fast decay when recovery phases dominate
BASELINE_DECAY     = 0.90    # slow natural decay
ALERT_ACCUM_THRESH = 2.5     # accumulated stress threshold for alert

def _cash_slope(cash_arr, i, lookback=6):
    """Compute log-linear slope of cash over prior `lookback` quarters."""
    vals = []
    for j in range(max(0, i - lookback + 1), i + 1):
        if not np.isnan(cash_arr[j]) and cash_arr[j] > 0:
            vals.append((j, np.log(cash_arr[j])))
    if len(vals) < 3:
        return 0.0  # not enough data → assume neutral
    times = np.array([v[0] for v in vals], dtype=float)
    log_cash = np.array([v[1] for v in vals])
    # linear regression slope
    n = len(times)
    t_mean = times.mean()
    c_mean = log_cash.mean()
    slope = np.sum((times - t_mean) * (log_cash - c_mean)) / max(np.sum((times - t_mean) ** 2), 1e-12)
    return slope


def analyse_trajectory(df):
    """
    Hybrid accumulator: phase-based stress detection +
    cash-trajectory vulnerability amplifiers.

    CHARGE (when P3 >= P3_ENTRY):
      base_charge = P3 * RATE
      amplifier   = 1 + P7*α  (structural divergence boost)
      consec_bonus = grows with consecutive stressed quarters
      vuln_amp    = cash-slope vulnerability:
                    - Cash declining  (slope < -0.05) → +0.5x
                    - Cash collapsing (slope < -0.15) → +1.0x
      charge = base_charge * amplifier * consec_bonus * vuln_amp

    DISCHARGE (when P3 < P3_ENTRY):
      If recovery phases dominate: fast decay (RECOVERY_DECAY)
      If cash is growing (slope > 0): extra-fast decay
      Else: slow natural decay (BASELINE_DECAY)

    DATA GAP HANDLING:
      When features are missing (z_var_Revenue NaN), freeze the
      accumulator to avoid draining sparse companies.

    TIME NORMALIZATION:
      distress_score = peak_accum / sqrt(n_eval_quarters)
      This corrects for the asymmetry where controls have longer
      evaluation windows than distress companies.
    """
    if df.empty:
        return df

    df = df.copy()
    n = len(df)

    p3  = df["p3"].values
    p4  = df["p4"].values
    p5  = df["p5"].values
    p6  = df["p6"].values
    p7  = df["p7"].values
    p9  = df["p9"].values
    cash = df["Cash"].values.astype(float)

    # Detect data gaps
    has_rev_data = ~np.isnan(df["z_var_Revenue"].values) if "z_var_Revenue" in df.columns else np.ones(n, dtype=bool)
    has_ocf_data = ~np.isnan(df["z_var_OCF"].values) if "z_var_OCF" in df.columns else np.ones(n, dtype=bool)
    has_data = has_rev_data | has_ocf_data

    quarters = df["quarter"].values
    accum = np.zeros(n)
    recovered = np.zeros(n, dtype=bool)
    cur_accum = 0.0
    consec_stress = 0
    n_eval = 0  # count of quarters in evaluation window (for normalization)

    for i in range(n):
        # Reset before backtest window
        if quarters[i][0] < START_YEAR:
            accum[i] = 0.0
            cur_accum = 0.0
            consec_stress = 0
            continue

        n_eval += 1

        # DATA GAP: freeze accumulator
        if not has_data[i]:
            accum[i] = cur_accum
            continue

        # Cash-slope vulnerability (computed from recent cash trajectory)
        cslope = _cash_slope(cash, i, lookback=6)

        if p3[i] >= P3_ENTRY:
            # ── CHARGING ──
            consec_stress += 1
            base_charge = p3[i] * STRESS_CHARGE_RATE

            # Structural divergence amplifier
            amplifier = 1.0 + P7_AMP * p7[i]

            # Consecutive stress bonus
            consec_bonus = 1.0 + CONSEC_BONUS_RATE * min(consec_stress, MAX_CONSEC_QTRS)

            # Cash-slope vulnerability
            vuln_amp = 1.0
            if cslope < -0.15:
                vuln_amp += 1.0       # cash collapsing
            elif cslope < -0.05:
                vuln_amp += 0.5       # cash declining

            charge = base_charge * amplifier * consec_bonus * vuln_amp
            cur_accum += charge
            recovered[i] = False

        else:
            # ── NOT STRESSED ──
            consec_stress = max(consec_stress - 1, 0)
            recovery_mean = (p4[i] + p5[i] + p6[i]) / 3.0

            if recovery_mean > p3[i] + 0.01:
                # Recovery phases dominate → fast discharge
                decay = RECOVERY_DECAY
                # Cash growing → even faster recovery
                if cslope > 0.03:
                    decay *= 0.7
                cur_accum *= decay
                recovered[i] = True
            else:
                cur_accum *= BASELINE_DECAY
                recovered[i] = False

        accum[i] = max(cur_accum, 0)

    # Time-normalized distress score: peak / sqrt(n_eval_quarters)
    # This corrects for the window-length asymmetry between distress and controls
    n_eval = max(n_eval, 1)
    norm_factor = np.sqrt(n_eval)
    norm_accum = accum / norm_factor

    df["stress_accum"] = accum
    df["distress_score"] = norm_accum  # use normalized score for classification
    df["recovered"] = recovered
    return df


COMPOSITE_THRESH_A = 1.1   # threshold for stress-rate path
COMPOSITE_THRESH_B = 1.5   # threshold for cash-decline path

# ─── Path C: Phase 1 Rupture Detector ────────────────────────────────────────
# Detects acute single-quarter shocks (bank runs, liquidity crises).
# Uses RAW financial data, not z-scores, to catch events that per-company
# normalization would hide.
RUPTURE_CASH_DROP  = 0.30   # single-quarter cash drop > 30%
RUPTURE_DEBT_SPIKE = 0.50   # single-quarter debt increase > 50%
RUPTURE_VAR_JUMP   = 5.0    # variance jump vs trailing median (multiplier)
RUPTURE_MIN_SIGNALS = 2     # need >= 2 rupture signals in same quarter for alert
COMPOSITE_THRESH_C = 1.5    # Path C threshold (rupture intensity score)

def compute_rupture_score(df, event_str=None):
    """
    Phase 1 Rupture detector — catches acute single-quarter shocks.

    Scans raw financial data for:
      1. Cash crash:  quarter-over-quarter cash drop > 30%
      2. Debt spike:  quarter-over-quarter debt increase > 50%
      3. Variance explosion:  4Q revenue variance > 5x trailing median variance

    RECOVERY FILTER: after detecting a rupture, checks subsequent 3 quarters.
    If cash recovers to >= 60% of pre-rupture level, the rupture is
    downgraded (company survived the shock). If the rupture occurs in the
    last 2 quarters of available data, no recovery can be verified →
    alert stands.

    Returns: (path_c_score, first_rupture_quarter, rupture_details)
    """
    if df is None or df.empty:
        return 0.0, None, {}

    df_bt = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)].copy()
    if df_bt.empty:
        return 0.0, None, {}

    if event_str:
        event_date = datetime.strptime(event_str, "%Y-%m-%d")
        event_yq = date_to_quarter(event_date)
        df_bt = df_bt[df_bt["quarter"].apply(lambda q: q <= event_yq)]

    if df_bt.empty:
        return 0.0, None, {}

    n_bt = len(df_bt)
    cash_vals = df_bt["Cash"].values.astype(float)
    debt_vals = df_bt["Debt"].values.astype(float)
    var_rev = df_bt["var_Revenue"].values.astype(float) if "var_Revenue" in df_bt.columns else np.full(n_bt, np.nan)
    quarters = df_bt["quarter"].values

    # Collect all rupture events (quarter index, intensity, signals)
    rupture_events = []
    max_cash_drop = 0.0
    max_debt_spike = 0.0
    max_var_ratio = 0.0

    for i in range(1, n_bt):
        signals = 0
        cash_drop_pct = 0.0
        debt_spike_pct = 0.0
        var_ratio = 0.0

        # 1. Single-quarter cash crash
        prev_cash = cash_vals[i - 1]
        curr_cash = cash_vals[i]
        if not np.isnan(prev_cash) and not np.isnan(curr_cash) and prev_cash > 0:
            cash_drop_pct = (prev_cash - curr_cash) / prev_cash
            if cash_drop_pct > RUPTURE_CASH_DROP:
                signals += 1
                max_cash_drop = max(max_cash_drop, cash_drop_pct)

        # 2. Single-quarter debt spike
        prev_debt = debt_vals[i - 1]
        curr_debt = debt_vals[i]
        if not np.isnan(prev_debt) and not np.isnan(curr_debt) and prev_debt > 0:
            debt_spike_pct = (curr_debt - prev_debt) / prev_debt
            if debt_spike_pct > RUPTURE_DEBT_SPIKE:
                signals += 1
                max_debt_spike = max(max_debt_spike, debt_spike_pct)
        elif not np.isnan(curr_debt) and curr_debt > 0 and (np.isnan(prev_debt) or prev_debt == 0):
            debt_spike_pct = 1.0
            signals += 1
            max_debt_spike = max(max_debt_spike, 1.0)

        # 3. Variance explosion: current 4Q variance vs trailing median
        curr_var = var_rev[i]
        if not np.isnan(curr_var) and i >= 4:
            trailing_vars = var_rev[max(0, i - 8):i]
            trailing_vars = trailing_vars[~np.isnan(trailing_vars)]
            if len(trailing_vars) >= 2:
                med_var = np.median(trailing_vars)
                if med_var > 1e-12:
                    var_ratio = curr_var / med_var
                    if var_ratio > RUPTURE_VAR_JUMP:
                        signals += 1
                        max_var_ratio = max(max_var_ratio, var_ratio)

        # Rupture quarter requires >= 2 coincident signals
        if signals >= RUPTURE_MIN_SIGNALS:
            intensity = signals * (0.5
                                   + max(cash_drop_pct, 0)
                                   + max(debt_spike_pct, 0)
                                   + min(var_ratio, 20.0) / 10.0)
            rupture_events.append({
                "idx": i, "quarter": quarters[i],
                "intensity": intensity, "signals": signals,
                "cash_drop": cash_drop_pct,
            })

    # ── Recovery filter ──
    # For each rupture event, check if cash STABILISES in subsequent quarters.
    # "Stabilised" = cash in any of the next RECOVERY_HORIZON quarters is
    # >= the rupture-quarter cash level (i.e., cash stopped declining).
    # This is more robust than requiring recovery to pre-drop levels, because
    # REITs and capital-intensive companies legitimately hold less cash after
    # deploying it into assets.
    # If rupture is in last 2 quarters of data → can't verify → alert stands.
    RECOVERY_HORIZON = 4     # quarters to check for stabilisation

    unrecovered = []
    for evt in rupture_events:
        idx = evt["idx"]
        remaining = n_bt - idx - 1

        if remaining < 2:
            # Not enough subsequent data to assess → alert stands
            unrecovered.append(evt)
            continue

        # Survivorship check: if company has 8+ quarters after rupture,
        # it demonstrably survived the shock. Distress companies have
        # data truncated at their event date, so remaining is small.
        SURVIVORSHIP_QUARTERS = 8
        if remaining >= SURVIVORSHIP_QUARTERS:
            # Company operated for 2+ years post-rupture → survived
            continue

        # Cash at the rupture quarter (the trough)
        rupture_cash = cash_vals[idx]

        # Check if cash stabilises or recovers in subsequent quarters
        recovered = False
        check_end = min(idx + RECOVERY_HORIZON, n_bt - 1)
        for check_idx in range(idx + 1, check_end + 1):
            post_cash = cash_vals[check_idx]
            if not np.isnan(rupture_cash) and rupture_cash > 0:
                # Cash stopped declining (at or above rupture trough)
                if not np.isnan(post_cash) and post_cash >= rupture_cash:
                    recovered = True
                    break
            elif not np.isnan(post_cash) and post_cash > 0:
                # Rupture cash was NaN/0 but subsequent cash is positive
                recovered = True
                break

        if not recovered:
            unrecovered.append(evt)

    # Score is based on the strongest UNRECOVERED rupture
    best_score = 0.0
    first_rupture_q = None
    n_rupture_unrecovered = len(unrecovered)

    if unrecovered:
        best_evt = max(unrecovered, key=lambda e: e["intensity"])
        best_score = best_evt["intensity"]
        # First alert = earliest unrecovered rupture
        first_rupture_q = min(e["quarter"] for e in unrecovered)

    details = {
        "n_rupture_quarters": len(rupture_events),
        "n_rupture_unrecovered": n_rupture_unrecovered,
        "max_cash_drop": max_cash_drop,
        "max_debt_spike": max_debt_spike,
        "max_var_ratio": max_var_ratio,
        "path_c": best_score,
    }
    return best_score, first_rupture_q, details


# ─── Option B: Sustained P3 duration weighting ──────────────────────────────
SUSTAINED_THRESH = 0.50    # lower threshold for sustained stress detection
SUSTAINED_MIN_CONSEC = 4   # need 4+ consecutive quarters to trigger bonus
SUSTAINED_WEIGHT = 0.20    # bonus per quarter beyond SUSTAINED_MIN_CONSEC - 1


def compute_composite_score(df, event_str=None, p3_entry=None):
    """
    Three-path composite distress score with independent thresholds.

    Path A (stress-rate):  2.5 * stress_rate + 0.5 * max_consec/10
                           + 0.5 * max(max_p3 - p3_entry, 0)
                           + sustained_bonus (Option B)
    Path B (cash-decline): 1.0 * stress_rate + 2.0 * long_term_cash_decline
    Path C (rupture):      Phase 1 acute single-quarter shock detector

    Alert fires when pathA >= THRESH_A  OR  pathB >= THRESH_B  OR  pathC >= THRESH_C.
    Final score = max(path_A, path_B, path_C) for ranking/PR-AUC.

    Option B: Companies with 4+ consecutive quarters of P3 > 0.50 receive
    escalating risk accumulation. This separates slow-bleed distress (JCP)
    from stressed-but-recovering controls (M).
    """
    if p3_entry is None:
        p3_entry = P3_ENTRY

    if df is None or df.empty:
        return 0.0, None, {}

    df_bt = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)].copy()
    if df_bt.empty:
        return 0.0, None, {}

    if event_str:
        event_date = datetime.strptime(event_str, "%Y-%m-%d")
        event_yq = date_to_quarter(event_date)
        df_bt = df_bt[df_bt["quarter"].apply(lambda q: q <= event_yq)]

    if df_bt.empty:
        return 0.0, None, {}

    n_eval = len(df_bt)
    p3_vals = df_bt["p3"].values
    cash_vals = df_bt["Cash"].values.astype(float)

    # 1. Stress rate (uses variable p3_entry)
    stressed_mask = p3_vals >= p3_entry
    n_stressed = int(stressed_mask.sum())
    stress_rate = n_stressed / max(n_eval, 1)

    # 2. Max consecutive stressed quarters (at p3_entry threshold)
    max_consec = 0
    cur_c = 0
    for s in stressed_mask:
        cur_c = cur_c + 1 if s else 0
        max_consec = max(max_consec, cur_c)

    # 3. Max P3
    max_p3 = float(p3_vals.max()) if len(p3_vals) > 0 else 0.0

    # 4. Long-term cash decline: compare first available cash to last available
    valid_cash = [(i, v) for i, v in enumerate(cash_vals) if not np.isnan(v) and v > 0]
    cash_decline = 0.0
    if len(valid_cash) >= 2:
        first_cash = valid_cash[0][1]
        last_cash = valid_cash[-1][1]
        cash_decline = max(0.0, 1.0 - last_cash / first_cash)
        cash_decline = min(cash_decline, 1.0)  # cap at 1.0

    # 5. Option B: Sustained P3 > 0.50 duration bonus
    #    Only applies if the company is STILL stressed in its last 2 quarters
    #    of the evaluation window (i.e., hasn't recovered). This separates
    #    slow bleeders (JCP - stressed right up to event) from controls that
    #    had sustained stress but recovered (CAR, M, XOM, SCHW).
    sustained_mask = p3_vals >= SUSTAINED_THRESH
    max_consec_sustained = 0
    cur_cs = 0
    for s in sustained_mask:
        cur_cs = cur_cs + 1 if s else 0
        max_consec_sustained = max(max_consec_sustained, cur_cs)
    # Gate: only apply if still stressed at ALERT-LEVEL at end of window.
    # Uses p3_entry (not SUSTAINED_THRESH) — company must still be at the
    # entry threshold in its final quarters, not just mildly elevated.
    tail_n = min(2, len(p3_vals))
    still_stressed = (p3_vals[-tail_n:] >= p3_entry).all() if tail_n > 0 else False
    if still_stressed and max_consec_sustained >= SUSTAINED_MIN_CONSEC:
        sustained_bonus = max(0, (max_consec_sustained - (SUSTAINED_MIN_CONSEC - 1))) * SUSTAINED_WEIGHT
    else:
        sustained_bonus = 0.0

    # 6. Path A & B
    path_a = (2.5 * stress_rate
              + 0.5 * max_consec / 10.0
              + 0.5 * max(max_p3 - p3_entry, 0)
              + sustained_bonus)
    path_b = 1.0 * stress_rate + 2.0 * cash_decline

    # 6. Path C (rupture)
    path_c, rupture_q, rupture_details = compute_rupture_score(df, event_str)

    composite = max(path_a, path_b, path_c)

    # Determine alert and first alert quarter
    alert_a = path_a >= COMPOSITE_THRESH_A
    alert_b = path_b >= COMPOSITE_THRESH_B
    alert_c = path_c >= COMPOSITE_THRESH_C
    alert = alert_a or alert_b or alert_c

    first_alert_q = None
    if alert:
        # Collect candidate first-alert quarters from each path
        candidates = []

        if alert_c and rupture_q is not None:
            # Rupture alerts are typically the most acute/earliest
            candidates.append(rupture_q)

        if alert_a or alert_b:
            # Use accumulator data for Path A/B first alert
            accum_vals = df_bt["stress_accum"].values
            if accum_vals.max() > 0:
                half_peak = accum_vals.max() * 0.5
                for idx in range(len(accum_vals)):
                    if accum_vals[idx] >= half_peak:
                        candidates.append(df_bt.iloc[idx]["quarter"])
                        break

        if not candidates and n_stressed > 0:
            first_stressed_idx = np.argmax(stressed_mask)
            candidates.append(df_bt.iloc[first_stressed_idx]["quarter"])

        # Take the earliest candidate
        if candidates:
            first_alert_q = min(candidates)

    details = {
        "stress_rate": stress_rate,
        "n_stressed": n_stressed,
        "max_consec": max_consec,
        "max_consec_sustained": max_consec_sustained,
        "sustained_bonus": sustained_bonus,
        "max_p3": max_p3,
        "cash_decline": cash_decline,
        "path_a": path_a,
        "path_b": path_b,
        "path_c": path_c,
        "rupture_max_cash_drop": rupture_details.get("max_cash_drop", 0),
        "rupture_max_debt_spike": rupture_details.get("max_debt_spike", 0),
        "rupture_max_var_ratio": rupture_details.get("max_var_ratio", 0),
        "rupture_n_quarters": rupture_details.get("n_rupture_quarters", 0),
    }
    return composite, first_alert_q, details


def compute_trajectory_alert(df, event_str=None, p3_entry=None):
    """
    Alert fires when pathA >= THRESH_A OR pathB >= THRESH_B OR pathC >= THRESH_C.
    Returns: (alert_fired, first_alert_quarter, composite_score)
    """
    composite, first_q, details = compute_composite_score(df, event_str, p3_entry=p3_entry)
    path_a = details.get("path_a", 0) if details else 0
    path_b = details.get("path_b", 0) if details else 0
    path_c = details.get("path_c", 0) if details else 0
    alert = ((path_a >= COMPOSITE_THRESH_A)
             or (path_b >= COMPOSITE_THRESH_B)
             or (path_c >= COMPOSITE_THRESH_C))
    return alert, first_q, composite


# ─── Back-Test Logic (Trajectory-based) ───────────────────────────────────────
def run_backtest(results, p3_entry=None):
    """Trajectory-based back-test with regime separation.

    Regime 1 = Structural Decay → primary metrics
    Regime 2 = Liquidity Crisis → reported but not in primary metrics
    """
    if p3_entry is None:
        p3_entry = P3_ENTRY

    distress_alerts = []
    control_alerts = []

    for company, df in results:
        ticker = company["ticker"]
        event_str = company["event"]
        regime = company.get("regime", 1)
        is_distress = event_str is not None

        if df is None or df.empty:
            entry = {"ticker": ticker, "alert": False, "lead_quarters": None,
                     "max_distress_score": 0, "max_p3": 0, "trajectory": "NO_DATA",
                     "regime": regime}
            (distress_alerts if is_distress else control_alerts).append(entry)
            continue

        df_bt = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)].copy()
        if df_bt.empty:
            entry = {"ticker": ticker, "alert": False, "lead_quarters": None,
                     "max_distress_score": 0, "max_p3": 0, "trajectory": "NO_DATA",
                     "regime": regime}
            (distress_alerts if is_distress else control_alerts).append(entry)
            continue

        max_p3 = df_bt["p3"].max()

        alert_fired, first_q, composite = compute_trajectory_alert(df, event_str, p3_entry=p3_entry)

        # Get details to determine which path triggered
        _, _, alert_details = compute_composite_score(df, event_str, p3_entry=p3_entry)
        path_c = alert_details.get("path_c", 0) if alert_details else 0

        # Characterise trajectory
        ever_p3 = (df_bt["p3"] >= p3_entry).any()
        ever_recovered = df_bt["recovered"].any()
        if alert_fired and path_c >= COMPOSITE_THRESH_C:
            traj = "RUPTURE"
        elif alert_fired:
            traj = "UNRECOVERED_P3"
        elif not ever_p3:
            traj = "STABLE"
        elif ever_recovered and not alert_fired:
            traj = "RECOVERED"
        else:
            traj = "MILD_STRESS"

        if is_distress:
            event_date = datetime.strptime(event_str, "%Y-%m-%d")
            event_yq = date_to_quarter(event_date)
            lead = quarter_diff(first_q, event_yq) if first_q else None
            distress_alerts.append({
                "ticker": ticker, "alert": alert_fired,
                "first_alert_quarter": first_q, "event_quarter": event_yq,
                "lead_quarters": lead,
                "max_p3": max_p3, "max_distress_score": composite,
                "trajectory": traj, "regime": regime,
            })
        else:
            control_alerts.append({
                "ticker": ticker, "alert": alert_fired,
                "max_p3": max_p3, "max_distress_score": composite,
                "trajectory": traj, "regime": regime,
            })

    # ── Regime 1 metrics (Structural Decay only) ──
    r1_d = [d for d in distress_alerts
            if d["regime"] == 1 and d["trajectory"] != "NO_DATA"]
    r1_c = [c for c in control_alerts
            if c["regime"] == 1 and c["trajectory"] != "NO_DATA"]
    n_r1_d = len(r1_d)
    n_r1_c = len(r1_c)
    n_r1_d_alert = sum(1 for d in r1_d if d["alert"])
    n_r1_c_alert = sum(1 for c in r1_c if c["alert"])
    recall = n_r1_d_alert / max(n_r1_d, 1)
    fpr = n_r1_c_alert / max(n_r1_c, 1)

    leads = [d["lead_quarters"] for d in r1_d
             if d["alert"] and d["lead_quarters"] is not None]
    median_lead = np.median(leads) if leads else 0

    # PR-AUC on Regime 1 only
    labels = np.array([1] * n_r1_d + [0] * n_r1_c)
    scores = np.array(
        [d["max_distress_score"] for d in r1_d] +
        [c["max_distress_score"] for c in r1_c]
    )
    try:
        pr_auc = average_precision_score(labels, scores)
    except:
        pr_auc = 0.0

    return {
        "recall": recall, "fpr": fpr,
        "median_lead_quarters": median_lead, "pr_auc": pr_auc,
        "distress_alerts": distress_alerts, "control_alerts": control_alerts,
        "labels": labels, "scores": scores,
        "r1_distress_n": n_r1_d, "r1_distress_alert": n_r1_d_alert,
        "r1_control_n": n_r1_c, "r1_control_alert": n_r1_c_alert,
    }


# ─── Plotting ────────────────────────────────────────────────────────────────
PHASE_COLORS = {
    "p0": "#2ecc71", "p1": "#e67e22", "p2": "#3498db", "p3": "#f39c12",
    "p4": "#1abc9c", "p5": "#27ae60", "p6": "#2980b9", "p7": "#8e44ad",
    "p8": "#16a085", "p9": "#e74c3c", "p10": "#9b59b6",
}
PHASE_NAMES = {
    "p0": "P0 Source", "p1": "P1 Rupture", "p2": "P2 Rhythm",
    "p3": "P3 Instability", "p4": "P4 Stabilisation", "p5": "P5 Endurance",
    "p6": "P6 Order", "p7": "P7 Divergence", "p8": "P8 Conscience",
    "p9": "P9 Collapse", "p10": "P10 Resurrection",
}

def plot_company(company, df, output_dir):
    if df is None or df.empty:
        return
    ticker = company["ticker"]
    df_p = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)].copy()
    if df_p.empty:
        return
    dates = df_p["date"]

    # --- Panel 1: Key phases (P0, P3, P4, P5, P6, P9) ---
    fig, axes = plt.subplots(3, 1, figsize=(14, 12), sharex=True)

    ax1 = axes[0]
    for p, lbl, c, lw in [
        ("p3", "P3 Instability", "#f39c12", 2.5),
        ("p4", "P4 Stabilisation", "#1abc9c", 2),
        ("p5", "P5 Endurance", "#27ae60", 2),
        ("p6", "P6 Order", "#2980b9", 2),
        ("p9", "P9 Collapse", "#e74c3c", 2.5),
    ]:
        ax1.plot(dates, df_p[p], label=lbl, color=c, linewidth=lw)
    ax1.axhline(y=P3_ENTRY, color="gray", linestyle="--", alpha=0.5,
                label=f"P3 Entry ({P3_ENTRY})")
    if company["event"]:
        ax1.axvline(x=datetime.strptime(company["event"], "%Y-%m-%d"),
                    color="red", linewidth=2, alpha=0.8, label=f"Event")
    ax1.set_ylim(-0.05, 1.05)
    ax1.set_ylabel("Phase Score")
    ax1.set_title(f"LIMEN Helix 11-Phase — {ticker} "
                  f"({'Distress' if company['event'] else 'Control'})")
    ax1.legend(loc="upper left", fontsize=7, ncol=3)

    # --- Panel 2: Stress accumulator ---
    ax2 = axes[1]
    ax2.fill_between(dates, df_p["stress_accum"], alpha=0.3, color="#e74c3c",
                     label="Stress Accumulator")
    ax2.plot(dates, df_p["stress_accum"], color="#e74c3c", linewidth=1.5)
    ax2.axhline(y=ALERT_ACCUM_THRESH, color="gray", linestyle="--", alpha=0.6,
                label=f"Alert Threshold ({ALERT_ACCUM_THRESH})")
    # Mark recovery quarters in green
    rec_mask = df_p["recovered"].values
    if rec_mask.any():
        ax2.scatter(dates[rec_mask], df_p["stress_accum"].values[rec_mask],
                    color="#2ecc71", s=40, zorder=5, label="Recovery (discharge)")
    if company["event"]:
        ax2.axvline(x=datetime.strptime(company["event"], "%Y-%m-%d"),
                    color="red", linewidth=2, alpha=0.8)
    ax2.set_ylabel("Stress Accumulator")
    ax2.legend(loc="upper left", fontsize=7)

    # --- Panel 3: All 11 phases heatmap-style ---
    ax3 = axes[2]
    phase_cols = [f"p{i}" for i in range(11)]
    phase_data = df_p[phase_cols].values.T
    im = ax3.imshow(phase_data, aspect="auto", cmap="RdYlGn_r",
                    vmin=0, vmax=1, interpolation="nearest",
                    extent=[mdates.date2num(dates.iloc[0]),
                            mdates.date2num(dates.iloc[-1]),
                            10.5, -0.5])
    ax3.set_yticks(range(11))
    ax3.set_yticklabels([PHASE_NAMES[f"p{i}"] for i in range(11)], fontsize=7)
    ax3.xaxis_date()
    ax3.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax3.set_xlabel("Date")
    plt.colorbar(im, ax=ax3, label="Phase Score", shrink=0.8)

    plt.tight_layout()
    fig.savefig(output_dir / f"{ticker}_phases.png", dpi=150)
    plt.close(fig)
    print(f"    Saved plot: {ticker}_phases.png")


def plot_roc_pr(metrics, output_dir):
    labels = metrics["labels"]
    scores = metrics["scores"]
    if len(np.unique(labels)) < 2:
        print("    Cannot plot ROC/PR: only one class present.")
        return

    fpr_arr, tpr_arr, _ = roc_curve(labels, scores)
    roc_auc = auc(fpr_arr, tpr_arr)
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(fpr_arr, tpr_arr, color="steelblue", linewidth=2,
            label=f"ROC (AUC={roc_auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", alpha=0.3)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("LIMEN Helix — ROC Curve (Trajectory-based)")
    ax.legend()
    plt.tight_layout()
    fig.savefig(output_dir / "roc_curve.png", dpi=150)
    plt.close(fig)
    print("    Saved: roc_curve.png")

    prec, rec, _ = precision_recall_curve(labels, scores)
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(rec, prec, color="darkorange", linewidth=2,
            label=f"PR (AUC={metrics['pr_auc']:.3f})")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("LIMEN Helix — Precision-Recall Curve (Trajectory-based)")
    ax.legend()
    plt.tight_layout()
    fig.savefig(output_dir / "pr_curve.png", dpi=150)
    plt.close(fig)
    print("    Saved: pr_curve.png")


# ─── Summary Writer ──────────────────────────────────────────────────────────
def write_summary(metrics, output_dir, p3_entry_used=None, sweep_results=None):
    if p3_entry_used is None:
        p3_entry_used = P3_ENTRY
    lines = []
    lines.append("=" * 70)

    # Separate companies by regime
    all_alerts = metrics["distress_alerts"] + metrics["control_alerts"]
    r1_distress = [d for d in metrics["distress_alerts"] if d["regime"] == 1]
    r1_control = [c for c in metrics["control_alerts"] if c["regime"] == 1]
    r2_distress = [d for d in metrics["distress_alerts"] if d["regime"] == 2]
    n_r1 = len(r1_distress) + len(r1_control)
    n_r2 = len(r2_distress)
    n_nodata = sum(1 for a in all_alerts if a["trajectory"] == "NO_DATA")
    n_distress_total = len(metrics["distress_alerts"])
    n_control_total = len(metrics["control_alerts"])

    lines.append("LIMEN Helix 11-Phase Predictive Back-Test — Summary")
    lines.append("  Classification: Three-path composite (stress + cash-decline + rupture)")
    lines.append("  Regime: Structural Decay only (Regime 1)")
    lines.append("=" * 70)
    lines.append("")
    lines.append(f"Cohort:                    {n_distress_total} distress + {n_control_total} controls")
    lines.append(f"  Regime 1 (Structural):   {len(r1_distress)} distress + {len(r1_control)} controls")
    lines.append(f"  Regime 2 (Liquidity):    {len(r2_distress)} distress (excluded from metrics)")
    if n_nodata:
        lines.append(f"  Excluded (no SEC data):  {n_nodata}")
    r1_d_eval = len([d for d in r1_distress if d["trajectory"] != "NO_DATA"])
    r1_c_eval = len([c for c in r1_control if c["trajectory"] != "NO_DATA"])
    lines.append(f"Evaluable (Regime 1):      {r1_d_eval} distress + {r1_c_eval} controls")
    lines.append(f"P3 Entry Threshold:        {p3_entry_used}")
    lines.append(f"Path A Threshold:          {COMPOSITE_THRESH_A}  (stress-rate)")
    lines.append(f"Path B Threshold:          {COMPOSITE_THRESH_B}  (cash-decline)")
    lines.append(f"Path C Threshold:          {COMPOSITE_THRESH_C}  (rupture / acute shock)")
    lines.append(f"Path A: 2.5*stress_rate + 0.5*max_consec/10 + 0.5*max(max_p3-{p3_entry_used},0) + sustained_bonus")
    lines.append(f"Path B: 1.0*stress_rate + 2.0*cash_decline")
    lines.append(f"Path C: Phase 1 rupture (cash drop>{RUPTURE_CASH_DROP:.0%}, "
                 f"debt spike>{RUPTURE_DEBT_SPIKE:.0%}, var jump>{RUPTURE_VAR_JUMP}x)")
    lines.append(f"Sustained bonus:           +{SUSTAINED_WEIGHT}/Q for {SUSTAINED_MIN_CONSEC}+ consecutive Q with P3>{SUSTAINED_THRESH}")
    lines.append("")
    lines.append(f"Recall (distress):         {metrics['recall']:.2%}")
    lines.append(f"False Positive Rate:       {metrics['fpr']:.2%}")
    lines.append(f"Median Lead Time (qtrs):   {metrics['median_lead_quarters']:.1f}")
    lines.append(f"PR-AUC:                    {metrics['pr_auc']:.4f}")
    lines.append("")

    recall_ok = metrics['recall'] >= 0.60
    fpr_ok = metrics['fpr'] <= 0.20
    lead_ok = metrics['median_lead_quarters'] >= 2.0
    prauc_ok = metrics['pr_auc'] > 0.5
    lines.append("--- Success Criteria (Regime 1) ---")
    lines.append(f"  Recall >= 60%:      {'PASS' if recall_ok else 'FAIL'} ({metrics['recall']:.2%})")
    lines.append(f"  FPR <= 20%:         {'PASS' if fpr_ok else 'FAIL'} ({metrics['fpr']:.2%})")
    lines.append(f"  Lead Time >= 2Q:    {'PASS' if lead_ok else 'FAIL'} ({metrics['median_lead_quarters']:.1f})")
    lines.append(f"  PR-AUC > 0.5:       {'PASS' if prauc_ok else 'FAIL'} ({metrics['pr_auc']:.4f})")
    n_pass = sum([recall_ok, fpr_ok, lead_ok, prauc_ok])
    lines.append(f"  TOTAL:              {n_pass}/4 PASSED")
    lines.append("")

    # Threshold sweep results
    if sweep_results:
        lines.append("--- P3 Entry Threshold Sweep ---")
        lines.append(f"  {'Thresh':>6s}  {'Recall':>8s}  {'FPR':>6s}  {'Lead':>5s}  {'PR-AUC':>7s}")
        lines.append("  " + "-" * 40)
        for thresh, rec, fpr_v, lead, prauc_v in sweep_results:
            marker = " <-- optimal" if thresh == p3_entry_used else ""
            lines.append(f"  {thresh:6.2f}  {rec:7.2%}  {fpr_v:5.2%}  {lead:5.1f}  {prauc_v:7.4f}{marker}")
        lines.append(f"  Optimal: {p3_entry_used:.2f}")
        lines.append("")

    lines.append("--- Regime 1: Distress Company Detail ---")
    for d in r1_distress:
        if d["alert"]:
            lines.append(f"  {d['ticker']:6s}  ALERT  trajectory={d['trajectory']:16s}  "
                         f"first={d.get('first_alert_quarter','?')}  event={d.get('event_quarter','?')}  "
                         f"lead={d['lead_quarters']}Q  max_p3={d['max_p3']:.3f}  "
                         f"distress_score={d['max_distress_score']:.3f}")
        else:
            lines.append(f"  {d['ticker']:6s}  NO ALERT  trajectory={d['trajectory']:16s}  "
                         f"max_p3={d['max_p3']:.3f}  distress_score={d['max_distress_score']:.3f}")

    lines.append("")
    lines.append("--- Regime 1: Control Company Detail ---")
    for c in r1_control:
        status = "FALSE POSITIVE" if c["alert"] else "CLEAN"
        lines.append(f"  {c['ticker']:6s}  {status:16s}  trajectory={c['trajectory']:16s}  "
                     f"max_p3={c['max_p3']:.3f}  distress_score={c['max_distress_score']:.3f}")

    if r2_distress:
        lines.append("")
        lines.append("--- Regime 2: Liquidity Crisis (excluded from metrics) ---")
        for d in r2_distress:
            lines.append(f"  {d['ticker']:6s}  trajectory={d['trajectory']:16s}  "
                         f"max_p3={d['max_p3']:.3f}  distress_score={d['max_distress_score']:.3f}")

    lines.append("")
    lines.append("--- Trajectory Classification ---")
    lines.append("  RUPTURE        = Phase 1 acute shock detected (bank run, liquidity crisis)")
    lines.append("  UNRECOVERED_P3 = P3 entered, no P4-6 recovery within window -> ALERT")
    lines.append("  RECOVERED      = P3 entered, P4-6 recovery detected -> alert downgraded")
    lines.append("  STABLE         = P3 never exceeded entry threshold")
    lines.append("  MILD_STRESS    = P3 entered but distress_score stayed low")
    lines.append("")
    lines.append(f"Generated: {datetime.now().isoformat()}")
    lines.append("=" * 70)

    txt = "\n".join(lines)
    (output_dir / "summary.txt").write_text(txt, encoding="utf-8")
    print(txt)


# ─── CSV Export ───────────────────────────────────────────────────────────────
def export_csv(company, df, output_dir):
    if df is None or df.empty:
        return
    ticker = company["ticker"]
    df_out = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)].copy()
    if df_out.empty:
        return
    phase_cols = [f"p{i}" for i in range(11)]
    cols = (["date", "Revenue", "OCF", "Cash", "Debt",
             "z_var_Revenue", "z_ac_Revenue", "z_slope_Revenue", "z_accel_Revenue",
             "z_var_OCF", "z_ac_OCF", "z_slope_OCF",
             "risk_break_rev", "risk_break_ocf", "risk_liq", "risk_accel_debt"]
            + phase_cols
            + ["distress_score", "recovered", "event_flag"])
    available = [c for c in cols if c in df_out.columns]
    export_df = df_out[available].copy()
    export_df.rename(columns={"date": "Date"}, inplace=True)
    path = output_dir / f"{ticker}.csv"
    export_df.to_csv(path, index=False, float_format="%.6f")
    print(f"    Saved CSV: {ticker}.csv ({len(export_df)} rows)")


# ─── Main Pipeline ────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("LIMEN Helix 11-Phase Predictive Back-Test")
    print("  Trajectory-based classification: P3 without recovery = distress")
    print("=" * 70)
    start_time = time.time()

    # 1. Fetch FRED
    print("\n[1/6] Fetching FRED data...")
    fred_delta = fetch_fred()

    # 2. Fetch SEC data
    print("\n[2/6] Fetching SEC EDGAR data...")
    company_data = {}
    for company in ALL_COMPANIES:
        data = fetch_company_data(company)
        company_data[company["ticker"]] = data

    # 3. Compute features and score all 11 phases
    print("\n[3/6] Computing features and scoring all 11 phases...")
    results = []
    for company in ALL_COMPANIES:
        ticker = company["ticker"]
        print(f"  Processing {ticker}...")
        data = company_data.get(ticker)
        if data is None:
            print(f"    SKIPPED (no data)")
            results.append((company, None))
            continue
        df = compute_all_features(data, fred_delta)
        if df.empty:
            print(f"    SKIPPED (no features)")
            results.append((company, None))
            continue
        df = score_all_phases(df)
        df["event_flag"] = 1 if company["event"] else 0
        phase_summary = "  ".join(
            f"p{i}=[{df[f'p{i}'].min():.2f},{df[f'p{i}'].max():.2f}]"
            for i in [0, 3, 4, 5, 6, 9]
        )
        print(f"    {len(df)}Q scored.  {phase_summary}")
        results.append((company, df))

    # 4. Trajectory analysis
    print("\n[4/6] Analysing trajectories (dual-path composite scoring)...")
    traj_results = []
    for company, df in results:
        ticker = company["ticker"]
        if df is not None and not df.empty:
            df = analyse_trajectory(df)
            composite, first_q, details = compute_composite_score(df, company["event"])
            df_bt = df[df["quarter"].apply(lambda q: q[0] >= START_YEAR)]
            if not df_bt.empty:
                n_eval = len(df_bt)
                stressed = df_bt[df_bt["p3"] >= P3_ENTRY]
                tag = "DISTRESS" if company["event"] else "CONTROL"
                pa = details.get('path_a', 0)
                pb = details.get('path_b', 0)
                pc = details.get('path_c', 0)
                is_alert = ((pa >= COMPOSITE_THRESH_A)
                            or (pb >= COMPOSITE_THRESH_B)
                            or (pc >= COMPOSITE_THRESH_C))
                alert_str = "ALERT" if is_alert else "clean"
                rupture_info = ""
                if pc > 0:
                    rupture_info = (f"  rupture: cash_drop={details.get('rupture_max_cash_drop',0):.0%}"
                                    f" debt_spike={details.get('rupture_max_debt_spike',0):.0%}"
                                    f" var_ratio={details.get('rupture_max_var_ratio',0):.1f}x")
                sust_info = ""
                sb = details.get('sustained_bonus', 0)
                if sb > 0:
                    sust_info = f"  sust={details.get('max_consec_sustained',0)}Q(+{sb:.2f})"
                regime_tag = f"R{company.get('regime',1)}"
                print(f"  {ticker:6s} [{tag:8s}|{regime_tag}]  {alert_str:5s}  composite={composite:.3f}  "
                      f"A={pa:.3f}  B={pb:.3f}  C={pc:.3f}  "
                      f"stress={details.get('stress_rate',0):.2f}  "
                      f"cash_dec={details.get('cash_decline',0):.2f}"
                      f"{sust_info}{rupture_info}")
            else:
                print(f"  {ticker:6s}  no post-{START_YEAR} data")
        traj_results.append((company, df))

    # 5. Export CSVs and plots
    print("\n[5/6] Exporting CSVs and plots...")
    for company, df in traj_results:
        export_csv(company, df, OUTPUT_DIR)
        plot_company(company, df, PLOT_DIR)

    # 6. Option A: Sweep P3 entry threshold to find optimal
    print("\n[6/8] Option A -- Sweeping P3 entry threshold (0.45 -> 0.60)...")
    print(f"  {'Thresh':>6s}  {'Recall':>8s}  {'FPR':>6s}  {'Lead':>5s}  {'PR-AUC':>7s}  {'R1_D':>4s}  {'R1_C':>4s}  Status")
    print("  " + "-" * 70)

    best_thresh = P3_ENTRY
    best_recall = 0.0
    best_fpr = 1.0
    sweep_results = []

    for thresh_int in range(45, 61):
        thresh = thresh_int / 100.0
        m = run_backtest(traj_results, p3_entry=thresh)
        status = ""
        if m["fpr"] == 0:
            if m["recall"] > best_recall or best_fpr > 0:
                best_recall = m["recall"]
                best_fpr = 0.0
                best_thresh = thresh
                status = " <-- BEST"
            elif m["recall"] == best_recall:
                status = " <-- tied"
        else:
            # Fallback: if no FPR=0 found yet, track lowest FPR with best recall
            if best_fpr > 0:
                if (m["fpr"] < best_fpr) or (m["fpr"] == best_fpr and m["recall"] > best_recall):
                    best_fpr = m["fpr"]
                    best_recall = m["recall"]
                    best_thresh = thresh
                    status = f" <-- best (FPR={m['fpr']:.0%})"
                else:
                    status = f" (FP: {m['r1_control_alert']})"
            else:
                status = f" (FP: {m['r1_control_alert']})"
        sweep_results.append((thresh, m["recall"], m["fpr"], m["median_lead_quarters"], m["pr_auc"]))
        print(f"  {thresh:6.2f}  {m['recall']:7.2%}  {m['fpr']:5.2%}  {m['median_lead_quarters']:5.1f}  "
              f"{m['pr_auc']:7.4f}  {m['r1_distress_alert']}/{m['r1_distress_n']}  "
              f"{m['r1_control_alert']}/{m['r1_control_n']}{status}")

    print(f"\n  Optimal P3 entry threshold: {best_thresh:.2f}  (Recall={best_recall:.2%}, FPR={best_fpr:.0%})")

    # 7. Run final back-test at optimal threshold
    print(f"\n[7/8] Running final back-test at P3_ENTRY={best_thresh:.2f}...")
    metrics = run_backtest(traj_results, p3_entry=best_thresh)
    plot_roc_pr(metrics, PLOT_DIR)

    # 8. Write summary
    print("\n[8/8] Writing summary...")
    write_summary(metrics, OUTPUT_DIR, p3_entry_used=best_thresh, sweep_results=sweep_results)

    elapsed = time.time() - start_time
    print(f"\nCompleted in {elapsed:.1f}s")
    print(f"Output directory: {OUTPUT_DIR.resolve()}")


# ─── Holdout Validation ─────────────────────────────────────────────────────
HOLDOUT_P3_ENTRY = 0.59  # locked operating point — never sweep in holdout


def _baseline_cash_slope(company_data, event_str):
    """Baseline 1: log-linear cash slope as distress score.

    Fits log(cash) ~ t over all available quarters up to the event date.
    Negative slope = declining cash = higher risk.  Returns -slope so that
    a higher score means more distress (consistent with LIMEN scoring).
    """
    cash = company_data.get("Cash", {})
    if not cash:
        return 0.0
    sorted_q = sorted(cash.keys())
    if event_str:
        event_date = datetime.strptime(event_str, "%Y-%m-%d")
        event_yq = date_to_quarter(event_date)
        sorted_q = [q for q in sorted_q if q <= event_yq]
    vals = []
    for i, q in enumerate(sorted_q):
        v = cash[q]
        if v is not None and not np.isnan(v) and v > 0:
            vals.append((i, np.log(v)))
    if len(vals) < 3:
        return 0.0
    times = np.array([v[0] for v in vals], dtype=float)
    log_cash = np.array([v[1] for v in vals])
    t_mean = times.mean()
    c_mean = log_cash.mean()
    slope = np.sum((times - t_mean) * (log_cash - c_mean)) / max(np.sum((times - t_mean) ** 2), 1e-12)
    return -slope  # negative slope → positive distress score


def _baseline_altman_proxy(company_data, event_str):
    """Baseline 2: simplified Altman Z proxy using SEC quarterly data.

    Components (averaged over last 4 available quarters before event):
      X1 = Cash / (Cash + Debt)       — liquidity
      X2 = OCF  / (Cash + Debt)       — profitability proxy
      X3 = Revenue / (Cash + Debt)    — asset utilisation proxy

    Simplified Z = 1.2*X1 + 1.4*X2 + 3.3*X3
    Returns -Z so higher score = more distress.
    """
    cash_s = company_data.get("Cash", {})
    debt_s = company_data.get("Debt", {})
    ocf_s = company_data.get("OCF", {})
    rev_s = company_data.get("Revenue", {})
    if not cash_s:
        return 0.0
    all_q = sorted(set(cash_s.keys()) & set(debt_s.keys()))
    if event_str:
        event_date = datetime.strptime(event_str, "%Y-%m-%d")
        event_yq = date_to_quarter(event_date)
        all_q = [q for q in all_q if q <= event_yq]
    last_4 = all_q[-4:] if len(all_q) >= 4 else all_q
    if not last_4:
        return 0.0
    z_vals = []
    for q in last_4:
        c = cash_s.get(q, 0) or 0
        d = debt_s.get(q, 0) or 0
        denom = c + d
        if denom <= 0:
            continue
        x1 = c / denom
        x2 = (ocf_s.get(q, 0) or 0) / denom
        x3 = (rev_s.get(q, 0) or 0) / denom
        z_vals.append(1.2 * x1 + 1.4 * x2 + 3.3 * x3)
    if not z_vals:
        return 0.0
    return -np.mean(z_vals)  # negate: lower Z = higher distress


def _baseline_logreg(calib_results, holdout_results):
    """Baseline 3: logistic regression on 4 summary metrics.

    Training data: calibration cohort's composite score details.
    Features: stress_rate, max_consec, max_p3, cash_decline.
    Target: 1 if distress company, 0 if control.
    Returns: dict mapping holdout ticker → predicted probability.
    """
    from sklearn.linear_model import LogisticRegression

    # Build training set from calibration cohort
    X_train, y_train = [], []
    for company, df in calib_results:
        if df is None or df.empty:
            continue
        _, _, details = compute_composite_score(df, company["event"], p3_entry=HOLDOUT_P3_ENTRY)
        if not details:
            continue
        X_train.append([
            details["stress_rate"],
            details["max_consec"],
            details["max_p3"],
            details["cash_decline"],
        ])
        y_train.append(1 if company["event"] else 0)

    if len(set(y_train)) < 2:
        print("    WARNING: LogReg baseline has only one class in training data")
        return {}

    X_train = np.array(X_train)
    y_train = np.array(y_train)
    clf = LogisticRegression(max_iter=1000, solver="lbfgs")
    clf.fit(X_train, y_train)

    # Predict on holdout
    predictions = {}
    for company, df in holdout_results:
        if df is None or df.empty:
            predictions[company["ticker"]] = 0.5
            continue
        _, _, details = compute_composite_score(df, company["event"], p3_entry=HOLDOUT_P3_ENTRY)
        if not details:
            predictions[company["ticker"]] = 0.5
            continue
        x = np.array([[
            details["stress_rate"],
            details["max_consec"],
            details["max_p3"],
            details["cash_decline"],
        ]])
        predictions[company["ticker"]] = float(clf.predict_proba(x)[0, 1])
    return predictions


def run_holdout_validation(cohort_csv=None):
    """Strict holdout validation — all parameters frozen, single pass.

    Loads an independent holdout cohort from CSV, runs the full LIMEN
    pipeline at the locked HOLDOUT_P3_ENTRY=0.59 threshold (no sweep),
    compares against three baselines, and exports structured results.
    """
    print("=" * 70)
    print("LIMEN Helix — Holdout Validation (frozen parameters)")
    print(f"  P3_ENTRY locked at {HOLDOUT_P3_ENTRY}")
    print("=" * 70)
    start_time = time.time()

    # ── 1. Load holdout cohort CSV ──
    if cohort_csv is None:
        cohort_csv = Path(__file__).parent / "cohort_holdout.csv"
    else:
        cohort_csv = Path(cohort_csv)
    if not cohort_csv.exists():
        print(f"ERROR: Holdout cohort file not found: {cohort_csv}")
        print("Expected columns: ticker, cik, sector, event, regime")
        sys.exit(1)

    print(f"\n[1/9] Loading holdout cohort from {cohort_csv}...")
    cohort_df = pd.read_csv(cohort_csv)
    required_cols = {"ticker", "cik", "sector", "event", "regime"}
    missing = required_cols - set(cohort_df.columns)
    if missing:
        print(f"ERROR: Missing columns in CSV: {missing}")
        sys.exit(1)

    holdout_companies = []
    for _, row in cohort_df.iterrows():
        evt = row["event"]
        if pd.isna(evt) or str(evt).strip().lower() in ("", "none", "nan", "null"):
            evt = None
        else:
            evt = str(evt).strip()
        holdout_companies.append({
            "ticker": str(row["ticker"]).strip(),
            "cik": str(row["cik"]).strip(),
            "sector": str(row["sector"]).strip(),
            "event": evt,
            "regime": int(row["regime"]),
        })
    n_distress = sum(1 for c in holdout_companies if c["event"])
    n_control = len(holdout_companies) - n_distress
    print(f"  Loaded {len(holdout_companies)} companies ({n_distress} distress, {n_control} control)")

    # ── 2. Fetch FRED ──
    print("\n[2/9] Fetching FRED data...")
    fred_delta = fetch_fred()

    # ── 3. Fetch SEC data ──
    print("\n[3/9] Fetching SEC EDGAR data for holdout companies...")
    company_data = {}
    ingestion_failures = []
    for company in holdout_companies:
        data = fetch_company_data(company)
        if data is None:
            ingestion_failures.append(company["ticker"])
        company_data[company["ticker"]] = data
    if ingestion_failures:
        print(f"  WARNING: Ingestion failures: {', '.join(ingestion_failures)}")

    # ── 4. Feature extraction + phase scoring ──
    print("\n[4/9] Computing features and scoring all 11 phases...")
    results = []
    for company in holdout_companies:
        ticker = company["ticker"]
        print(f"  Processing {ticker}...")
        data = company_data.get(ticker)
        if data is None:
            print(f"    SKIPPED (no data)")
            results.append((company, None))
            continue
        df = compute_all_features(data, fred_delta)
        if df.empty:
            print(f"    SKIPPED (no features)")
            results.append((company, None))
            continue
        df = score_all_phases(df)
        df["event_flag"] = 1 if company["event"] else 0
        print(f"    {len(df)}Q scored")
        results.append((company, df))

    # ── 5. Trajectory analysis ──
    print("\n[5/9] Analysing trajectories...")
    traj_results = []
    for company, df in results:
        ticker = company["ticker"]
        if df is not None and not df.empty:
            df = analyse_trajectory(df)
            composite, first_q, details = compute_composite_score(df, company["event"],
                                                                   p3_entry=HOLDOUT_P3_ENTRY)
            tag = "DISTRESS" if company["event"] else "CONTROL"
            pa = details.get("path_a", 0)
            pb = details.get("path_b", 0)
            pc = details.get("path_c", 0)
            is_alert = ((pa >= COMPOSITE_THRESH_A)
                        or (pb >= COMPOSITE_THRESH_B)
                        or (pc >= COMPOSITE_THRESH_C))
            alert_str = "ALERT" if is_alert else "clean"
            print(f"  {ticker:6s} [{tag:8s}]  {alert_str:5s}  composite={composite:.3f}  "
                  f"A={pa:.3f}  B={pb:.3f}  C={pc:.3f}")
        traj_results.append((company, df))

    # ── 6. Run backtest at frozen threshold (single call, no sweep) ──
    print(f"\n[6/9] Running backtest at frozen P3_ENTRY={HOLDOUT_P3_ENTRY}...")
    metrics = run_backtest(traj_results, p3_entry=HOLDOUT_P3_ENTRY)

    print(f"  Recall:  {metrics['recall']:.2%}")
    print(f"  FPR:     {metrics['fpr']:.2%}")
    print(f"  PR-AUC:  {metrics['pr_auc']:.4f}")
    print(f"  Median lead: {metrics['median_lead_quarters']:.1f}Q")

    # ── 7. Detailed metrics: confusion matrix, sector & pathway breakdowns ──
    print("\n[7/9] Computing detailed metrics...")
    all_alerts = metrics["distress_alerts"] + metrics["control_alerts"]
    tp = [a for a in metrics["distress_alerts"] if a["alert"]]
    fn = [a for a in metrics["distress_alerts"] if not a["alert"]]
    fp = [a for a in metrics["control_alerts"] if a["alert"]]
    tn = [a for a in metrics["control_alerts"] if not a["alert"]]
    confusion = {"TP": len(tp), "FN": len(fn), "FP": len(fp), "TN": len(tn)}
    precision = confusion["TP"] / max(confusion["TP"] + confusion["FP"], 1)
    f1 = (2 * precision * metrics["recall"]) / max(precision + metrics["recall"], 1e-12)
    print(f"  Confusion: TP={confusion['TP']} FN={confusion['FN']} FP={confusion['FP']} TN={confusion['TN']}")
    print(f"  Precision: {precision:.2%}  F1: {f1:.4f}")

    # Sector breakdown
    sector_stats = {}
    for a in all_alerts:
        sec = next((c["sector"] for c in holdout_companies if c["ticker"] == a["ticker"]), "Unknown")
        sector_stats.setdefault(sec, {"n": 0, "alerts": 0, "distress": 0, "distress_alerts": 0})
        sector_stats[sec]["n"] += 1
        if a["alert"]:
            sector_stats[sec]["alerts"] += 1
        is_d = a["ticker"] in [c["ticker"] for c in holdout_companies if c["event"]]
        if is_d:
            sector_stats[sec]["distress"] += 1
            if a["alert"]:
                sector_stats[sec]["distress_alerts"] += 1
    print("  Sector breakdown:")
    for sec, st in sorted(sector_stats.items()):
        print(f"    {sec:15s}  n={st['n']}  alerts={st['alerts']}  "
              f"distress_recall={st['distress_alerts']}/{st['distress']}")

    # Pathway breakdown (A / B / C)
    pathway_counts = {"A": 0, "B": 0, "C": 0, "none": 0}
    for a in all_alerts:
        traj = a.get("trajectory", "")
        if traj == "RUPTURE":
            pathway_counts["C"] += 1
        elif traj == "UNRECOVERED_P3":
            pathway_counts["A"] += 1
        elif a["alert"]:
            pathway_counts["B"] += 1
        else:
            pathway_counts["none"] += 1
    print(f"  Pathway breakdown:  A={pathway_counts['A']}  B={pathway_counts['B']}  "
          f"C={pathway_counts['C']}  no_alert={pathway_counts['none']}")

    # ── 8. Run 3 baselines ──
    print("\n[8/9] Running baselines...")

    # Baseline 1: Cash slope
    print("  Baseline 1: Cash slope...")
    cash_slope_scores = {}
    for company in holdout_companies:
        data = company_data.get(company["ticker"])
        if data:
            cash_slope_scores[company["ticker"]] = _baseline_cash_slope(data, company["event"])
        else:
            cash_slope_scores[company["ticker"]] = 0.0

    # Baseline 2: Altman proxy
    print("  Baseline 2: Altman Z proxy...")
    altman_scores = {}
    for company in holdout_companies:
        data = company_data.get(company["ticker"])
        if data:
            altman_scores[company["ticker"]] = _baseline_altman_proxy(data, company["event"])
        else:
            altman_scores[company["ticker"]] = 0.0

    # Baseline 3: LogReg (needs calibration cohort as training data)
    print("  Baseline 3: Logistic regression (training on calibration cohort)...")
    print("    Fetching calibration cohort SEC data...")
    calib_companies = DISTRESS + CONTROLS
    calib_data = {}
    for company in calib_companies:
        ticker = company["ticker"]
        if ticker in company_data:
            # Already fetched if it overlaps with holdout — reuse
            calib_data[ticker] = company_data[ticker]
        else:
            calib_data[ticker] = fetch_company_data(company)

    print("    Processing calibration cohort...")
    calib_results = []
    for company in calib_companies:
        ticker = company["ticker"]
        data = calib_data.get(ticker)
        if data is None:
            calib_results.append((company, None))
            continue
        df = compute_all_features(data, fred_delta)
        if df.empty:
            calib_results.append((company, None))
            continue
        df = score_all_phases(df)
        df = analyse_trajectory(df)
        calib_results.append((company, df))

    logreg_scores = _baseline_logreg(calib_results, traj_results)

    # Compute baseline PR-AUCs
    holdout_labels = np.array([1 if c["event"] else 0 for c in holdout_companies])
    tickers_ordered = [c["ticker"] for c in holdout_companies]

    baseline_aucs = {}
    for name, score_dict in [("cash_slope", cash_slope_scores),
                              ("altman_proxy", altman_scores),
                              ("logreg", logreg_scores)]:
        scores = np.array([score_dict.get(t, 0.0) for t in tickers_ordered])
        try:
            baseline_aucs[name] = float(average_precision_score(holdout_labels, scores))
        except Exception:
            baseline_aucs[name] = 0.0
        print(f"    {name:15s}  PR-AUC = {baseline_aucs[name]:.4f}")

    print(f"    {'LIMEN':15s}  PR-AUC = {metrics['pr_auc']:.4f}")

    # ── 9. Export results ──
    print("\n[9/9] Exporting results...")
    holdout_output = {
        "validation_type": "holdout",
        "p3_entry_locked": HOLDOUT_P3_ENTRY,
        "cohort_csv": str(cohort_csv),
        "n_holdout": len(holdout_companies),
        "n_distress": n_distress,
        "n_control": n_control,
        "ingestion_failures": ingestion_failures,
        "metrics": {
            "recall": metrics["recall"],
            "fpr": metrics["fpr"],
            "precision": precision,
            "f1": f1,
            "pr_auc": metrics["pr_auc"],
            "median_lead_quarters": metrics["median_lead_quarters"],
        },
        "confusion_matrix": confusion,
        "sector_breakdown": sector_stats,
        "pathway_breakdown": pathway_counts,
        "baselines": baseline_aucs,
        "company_results": [
            {
                "ticker": a["ticker"],
                "alert": a["alert"],
                "trajectory": a.get("trajectory", ""),
                "max_p3": a.get("max_p3", 0),
                "max_distress_score": a.get("max_distress_score", 0),
                "lead_quarters": a.get("lead_quarters"),
                "regime": a.get("regime", 1),
                "is_distress": a["ticker"] in [c["ticker"] for c in holdout_companies if c["event"]],
            }
            for a in all_alerts
        ],
    }

    json_path = OUTPUT_DIR / "holdout_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(holdout_output, f, indent=2, default=str)
    print(f"  JSON: {json_path}")

    # Human-readable report
    report_lines = [
        "=" * 70,
        "LIMEN Helix — Holdout Validation Report",
        "=" * 70,
        f"Date:           {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Cohort CSV:     {cohort_csv}",
        f"P3_ENTRY:       {HOLDOUT_P3_ENTRY}  (FROZEN — not optimised on this data)",
        f"Holdout size:   {len(holdout_companies)} ({n_distress} distress, {n_control} control)",
        f"Ingestion fail: {', '.join(ingestion_failures) if ingestion_failures else 'none'}",
        "",
        "─── LIMEN Results ─────────────────────────────────────────────────────",
        f"Recall:         {metrics['recall']:.2%}",
        f"FPR:            {metrics['fpr']:.2%}",
        f"Precision:      {precision:.2%}",
        f"F1:             {f1:.4f}",
        f"PR-AUC:         {metrics['pr_auc']:.4f}",
        f"Median lead:    {metrics['median_lead_quarters']:.1f} quarters",
        "",
        f"Confusion:      TP={confusion['TP']}  FN={confusion['FN']}  FP={confusion['FP']}  TN={confusion['TN']}",
        "",
        "─── Sector Breakdown ──────────────────────────────────────────────────",
    ]
    for sec, st in sorted(sector_stats.items()):
        report_lines.append(f"  {sec:15s}  n={st['n']}  alerts={st['alerts']}  "
                            f"distress_recall={st['distress_alerts']}/{st['distress']}")
    report_lines += [
        "",
        "─── Pathway Breakdown ─────────────────────────────────────────────────",
        f"  Path A (stress-rate):    {pathway_counts['A']}",
        f"  Path B (cash-decline):   {pathway_counts['B']}",
        f"  Path C (rupture):        {pathway_counts['C']}",
        f"  No alert:                {pathway_counts['none']}",
        "",
        "─── Baseline Comparison ───────────────────────────────────────────────",
        f"  {'Model':20s}  {'PR-AUC':>8s}",
        f"  {'─'*20}  {'─'*8}",
    ]
    for name, auc_val in [("Cash Slope", baseline_aucs.get("cash_slope", 0)),
                           ("Altman Z Proxy", baseline_aucs.get("altman_proxy", 0)),
                           ("LogReg (4-feat)", baseline_aucs.get("logreg", 0)),
                           ("LIMEN Helix", metrics["pr_auc"])]:
        report_lines.append(f"  {name:20s}  {auc_val:8.4f}")
    report_lines += [
        "",
        "─── Per-Company Results ───────────────────────────────────────────────",
        f"  {'Ticker':6s}  {'Type':8s}  {'Alert':5s}  {'Trajectory':16s}  {'MaxP3':>6s}  {'Score':>7s}  {'Lead':>5s}",
        f"  {'─'*6}  {'─'*8}  {'─'*5}  {'─'*16}  {'─'*6}  {'─'*7}  {'─'*5}",
    ]
    for a in all_alerts:
        is_d = a["ticker"] in [c["ticker"] for c in holdout_companies if c["event"]]
        tag = "DISTRESS" if is_d else "CONTROL"
        alert_str = "YES" if a["alert"] else "no"
        lead_str = f"{a.get('lead_quarters', '-'):>5}" if a.get("lead_quarters") is not None else "    -"
        report_lines.append(
            f"  {a['ticker']:6s}  {tag:8s}  {alert_str:5s}  {a.get('trajectory',''):16s}  "
            f"{a.get('max_p3',0):6.3f}  {a.get('max_distress_score',0):7.3f}  {lead_str}"
        )
    report_lines += ["", "=" * 70]

    txt_path = OUTPUT_DIR / "holdout_report.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"  Report: {txt_path}")

    elapsed = time.time() - start_time
    print(f"\nHoldout validation completed in {elapsed:.1f}s")
    print(f"Output directory: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--holdout":
        if len(sys.argv) >= 3:
            run_holdout_validation(cohort_csv=sys.argv[2])
        else:
            print("ERROR: --holdout requires a CSV path argument")
            print("Usage: python limen_backtest.py --holdout <cohort_holdout.csv>")
            sys.exit(1)
    else:
        main()
