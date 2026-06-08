"""
api/limen.py — Top-level Vercel Python function exposing the validated
LIMEN three-path composite distress kernel.

Imports the locked validated source (api/helix_app/thing1/limen_backtest.py,
sha256 3ce4a652…82d20) without modifying it. Heavy validation-only deps
(matplotlib + sklearn) are stubbed at sys.modules to avoid lambda bloat.
Path.mkdir is patched to tolerate Vercel's read-only filesystem at
/var/task. The locked file is unchanged on disk.

Routes:
  GET  /api/limen/health   liveness probe
  POST /api/limen/score    validated three-path distress alert for a CIK
"""

import os
import sys
from pathlib import Path


# ─── 1. Stub validation-only deps before importing the locked kernel ───
class _Stub:
    def __init__(self, *a, **k): pass
    def __getattr__(self, name): return _Stub()
    def __call__(self, *a, **k): return _Stub()
    def __iter__(self): return iter([])

for _name in (
    "matplotlib", "matplotlib.pyplot", "matplotlib.dates",
    "sklearn", "sklearn.metrics",
):
    sys.modules.setdefault(_name, _Stub())


# ─── 2. Tolerate Vercel's read-only filesystem at /var/task ───
_orig_mkdir = Path.mkdir
def _safe_mkdir(self, *a, **k):
    try:
        return _orig_mkdir(self, *a, **k)
    except (PermissionError, OSError):
        return None
Path.mkdir = _safe_mkdir


# ─── 3. Add the locked kernel directory to sys.path and import ───
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, "helix_app", "thing1"))

import limen_backtest as lbt  # noqa: E402

Path.mkdir = _orig_mkdir  # restore for any downstream user code


# ─── 4. FastAPI app — literal declaration so Vercel auto-detects ───
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

app = FastAPI(title="LIMEN Validated Distress Scorer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

P3_ENTRY_FROZEN = 0.59
THRESH_A = 1.1
THRESH_B = 1.5
THRESH_C = 1.5

# ─── Operating Envelope (v1.0.1) — objective gates ───────────────────
# Per the LIMEN Phase Kernel Operating Envelope Statement v1.0.1, the
# "validated" verdict is legitimate ONLY inside a narrow envelope. This
# endpoint previously stamped validation_status="validated" on EVERY CIK,
# including out-of-envelope companies (banks, stale filers, thin-history).
# We enforce the objective, in-document conditions here. The §4.5 sector
# SIC->sector map (ENVELOPE_SECTOR_MAP) is a trade-secret artifact not
# present in this repo; we therefore enforce the unambiguous bank gate
# (Regime 2 adapter not built) and emit regime_context per §4.6, which
# v1.0.1 made informational (a non-cohort filer renders as
# regime_context="extrapolated" and KEEPS validated branding if §4.1-§4.4
# pass — see §6.1). We do NOT invent a sector map.
MIN_HISTORY_QUARTERS = 8      # §4.1
MAX_STALE_QUARTERS = 2        # §4.2
START_YEAR_FLOOR = 2015       # §4.3
INGESTION_COVERAGE_MIN = 0.5  # §4.4

import requests as _rq  # noqa: E402


def _fetch_sic(cik: str) -> int:
    """Best-effort SIC fetch from SEC submissions. 0 if unavailable."""
    try:
        c = str(cik).lstrip("0").zfill(10)
        url = f"https://data.sec.gov/submissions/CIK{c}.json"
        r = _rq.get(url, headers=getattr(lbt, "SEC_HEADERS", {"User-Agent": "limenhelix@gmail.com"}), timeout=15)
        r.raise_for_status()
        sic = r.json().get("sic")
        return int(sic) if sic not in (None, "") else 0
    except Exception:
        return 0


def _quarters_between(q_latest, now_year, now_q):
    """Quarters from latest filed quarter to current quarter."""
    try:
        return (now_year - int(q_latest[0])) * 4 + (now_q - int(q_latest[1]))
    except Exception:
        return None


def assess_envelope(df, input_presence, sic):
    """Return the Operating-Envelope verdict for this run.

    status is the value placed in validation_status. in_envelope=False means
    render INTERPRETIVE_ONLY (§6.2): the alert may still be shown but must
    carry the out-of-envelope disclaimer and must NOT be aggregated into
    any performance claim (§7.3).
    """
    from datetime import datetime
    # Deposit-funded bank gate (§4.5 / Regime 2). NARROW depository range only:
    # SIC 6000 (bank holding) + 6020-6099 (commercial/savings banks). The scope
    # doc explicitly validates real estate (WE, SIC 6512) and REITs (SLG, 6798)
    # as Regime 1 — they are NOT banks and must not short-circuit. Brokers
    # (6211) and insurers (6311) are likewise not deposit-funded banks.
    is_financial = bool(sic and (sic == 6000 or 6020 <= sic <= 6099))

    # §4.5 bank gate — Regime 2 (deposit-funded) adapter not built.
    if is_financial:
        return {
            "in_envelope": False, "status": "bank_adapter_required",
            "status_code": "OUT_OF_SECTOR", "regime_context": "2_reserved",
            "is_financial": True, "sic_code": sic,
            "disclaimer": ("INTERPRETIVE ONLY — SIC %d is a financial institution. "
                           "The validated kernel has no Regime 2 (bank / deposit-funded) "
                           "adapter; this is not a validated distress assessment." % sic),
        }

    history_q = int(len(df)) if df is not None else 0
    # §4.1 history sufficiency
    if history_q < MIN_HISTORY_QUARTERS:
        return {"in_envelope": False, "status": "insufficient_history",
                "status_code": "INSUFFICIENT_HISTORY", "regime_context": "extrapolated",
                "is_financial": False, "sic_code": sic,
                "disclaimer": ("INTERPRETIVE ONLY — only %d quarters of history; the "
                               "validated envelope requires >= %d." % (history_q, MIN_HISTORY_QUARTERS))}

    # §4.3 pre-floor is enforced INTERNALLY by the kernel (it zeroes the
    # accumulator before START_YEAR=2015), so a healthy filer's DataFrame
    # legitimately contains pre-2015 context rows. PRE_FLOOR as a separate
    # gate would mis-fire on every long-history company; genuinely ancient
    # data (latest filing before ~2015) is caught by §4.2 STALE below.

    # §4.2 recency / staleness
    try:
        latest_q = df.iloc[-1]["quarter"]
        now = datetime.now()
        now_q = (now.month - 1) // 3 + 1
        stale = _quarters_between(latest_q, now.year, now_q)
        if stale is not None and stale > MAX_STALE_QUARTERS:
            return {"in_envelope": False, "status": "stale",
                    "status_code": "STALE", "regime_context": "extrapolated",
                    "is_financial": False, "sic_code": sic,
                    "disclaimer": ("INTERPRETIVE ONLY — latest filing is %d quarters old "
                                   "(envelope requires <= %d); not a current validated assessment." % (stale, MAX_STALE_QUARTERS))}
    except Exception:
        pass

    # §4.4 ingestion suspect — debt concept-coverage symmetry WITHIN the
    # scored window (>= 2015). Falls back to total coverage if windowed
    # counts are absent.
    dc = input_presence.get("dc_coverage_in_window", input_presence.get("dc_coverage_quarters", 0))
    dl = input_presence.get("dl_coverage_in_window", input_presence.get("dl_coverage_quarters", 0))
    mx = max(dc, dl)
    if mx > 0 and (min(dc, dl) / mx) < INGESTION_COVERAGE_MIN:
        return {"in_envelope": False, "status": "ingestion_suspect",
                "status_code": "INGESTION_SUSPECT", "regime_context": "extrapolated",
                "is_financial": False, "sic_code": sic,
                "disclaimer": ("INTERPRETIVE ONLY — debt concept coverage is asymmetric "
                               "(DC=%d, DL=%d quarters); Path C may be inflated by ingestion artifacts." % (dc, dl))}

    # In envelope (§4.1-§4.4 satisfied; §4.5 sector is extrapolated/informational per §4.6)
    return {"in_envelope": True, "status": "validated",
            "status_code": None, "regime_context": "extrapolated",
            "is_financial": False, "sic_code": sic, "disclaimer": None}


class ScoreRequest(BaseModel):
    cik: str


@app.get("/api/limen/health")
def health():
    return {
        "status": "ok",
        "kernel_id": "limen_backtest.py",
        "validation_status": "validated",
    }


@app.post("/api/limen/score")
def score(req: ScoreRequest):
    cik = req.cik.lstrip("0").zfill(10) if req.cik else ""
    if not cik:
        raise HTTPException(400, "CIK required")

    facts = lbt.fetch_sec_facts(cik)
    if facts is None:
        raise HTTPException(502, "SEC EDGAR fetch failed")

    sic = _fetch_sic(cik)

    # Build companyData via the locked kernel's validated extraction logic
    data = {
        "Revenue": lbt.extract_quarterly_series(facts, lbt.TAG_MAP["Revenue"], "Revenue", is_flow=True),
        "OCF": lbt.extract_quarterly_series(facts, lbt.TAG_MAP["OCF"], "OCF", is_flow=True),
        "Cash": lbt.extract_quarterly_series(facts, lbt.TAG_MAP["Cash"], "Cash", is_flow=False),
    }
    dc = lbt.extract_quarterly_series(facts, lbt.TAG_MAP["DebtCurrent"], "DebtCurrent", is_flow=False)
    dl = lbt.extract_quarterly_series(facts, lbt.TAG_MAP["DebtLong"], "DebtLong", is_flow=False)
    all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}

    # Input presence — actual extracted-quarter counts per series, BEFORE
    # rolling features. Surfaces the truth-ledger contract (was missing,
    # caused HON to display 0Q on every series despite 69Q of real data).
    # If any of these is 0, the company has gaps in its SEC EDGAR XBRL
    # tagging for that concept and the kernel ran with that series empty.
    #
    # dc_coverage_quarters / dl_coverage_quarters surface the kernel-picked
    # concept's per-bucket coverage. When the bucket-coverage ratio is
    # < 0.5 (e.g., DL fell back to a sparse legacy concept while DC kept
    # full coverage), the kernel computes Debt = DC + 0 (or 0 + DL) for
    # the affected quarters, producing artificial QoQ jumps that inflate
    # Path C rupture scores. Used by the renderer's envelope gate per
    # Operating Envelope Statement §4.4 (INGESTION_SUSPECT).
    input_presence = {
        "revenue_quarters": len(data["Revenue"]),
        "ocf_quarters":     len(data["OCF"]),
        "cash_quarters":    len(data["Cash"]),
        "debt_quarters":    len(data["Debt"]),
        "dc_coverage_quarters": len(dc),
        "dl_coverage_quarters": len(dl),
        # §4.4 coverage is measured WITHIN THE SCORED WINDOW (>= START_YEAR
        # 2015), per the Operating Envelope. Pre-2015 quarters carry tag
        # differences that don't affect the scored result, so total-coverage
        # asymmetry would spuriously flag healthy long-history filers.
        "dc_coverage_in_window": sum(1 for q in dc if q[0] >= START_YEAR_FLOOR),
        "dl_coverage_in_window": sum(1 for q in dl if q[0] >= START_YEAR_FLOOR),
        # legacy aliases — keep emitting under prior names so the existing
        # renderer panel doesn't break in transit
        "debt_current_quarters": len(dc),
        "debt_long_quarters":    len(dl),
    }

    # FRED delta — best-effort (proceed with empty dict if unreachable)
    try:
        fred_delta = lbt.fetch_fred()
    except Exception:
        fred_delta = {}

    # Run validated pipeline: features → phases → trajectory → composite
    df = lbt.compute_all_features(data, fred_delta)
    if df is None or df.empty:
        raise HTTPException(404, "No quarterly data available for this CIK")
    df = lbt.score_all_phases(df)
    df = lbt.analyse_trajectory(df)

    # ── Operating Envelope assessment (v1.0.1) ──────────────────────
    # Determines whether this run gets VALIDATED branding or renders
    # INTERPRETIVE_ONLY. Banks, stale filers, thin-history, ingestion-
    # suspect, and pre-2015 windows are out of envelope.
    envelope = assess_envelope(df, input_presence, sic)

    # Three-path composite (P3_ENTRY frozen at 0.59)
    composite, first_alert_q, details = lbt.compute_composite_score(
        df, event_str=None, p3_entry=P3_ENTRY_FROZEN
    )
    path_a = float(details.get("path_a", 0.0))
    path_b = float(details.get("path_b", 0.0))
    path_c = float(details.get("path_c", 0.0))
    alert_a = path_a >= THRESH_A
    alert_b = path_b >= THRESH_B
    alert_c = path_c >= THRESH_C
    alert = bool(alert_a or alert_b or alert_c)

    if alert:
        firing = []
        if alert_a: firing.append("A")
        if alert_b: firing.append("B")
        if alert_c: firing.append("C")
        pathway = "+".join(firing)
    else:
        pathway = None

    latest = df.iloc[-1] if not df.empty else None
    latest_quarter = (
        f"{int(latest['quarter'][0])}Q{int(latest['quarter'][1])}"
        if latest is not None else None
    )

    # Phase scores from latest quarter — produced by score_all_phases as
    # intermediate values for the three-path composite. Display-only;
    # alert authority remains with the three-path composite above.
    phase_scores = {}
    dominant_phase = None
    if latest is not None:
        import math
        best = -1.0
        for p in ('p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
                  'p7', 'p7a', 'p7b', 'p8', 'p9', 'p10'):
            v = latest.get(p)
            if v is None:
                continue
            try:
                fv = float(v)
            except Exception:
                continue
            if math.isnan(fv):
                continue
            phase_scores[p] = fv
            if fv > best:
                best = fv
                dominant_phase = p

    import math
    def _f(v):
        if v is None: return None
        try:
            fv = float(v)
            return None if math.isnan(fv) else fv
        except Exception:
            return None

    # Surface C(t) (stress accumulator) from latest quarter — the kernel's
    # rolling stress accumulation. Used by the S(t) panel.
    stress_accum_latest = _f(latest.get("stress_accum")) if latest is not None else None
    if stress_accum_latest is None:
        stress_accum_latest = 0.0

    # Phase history — per-quarter snapshot for the time-series chart in
    # Helix Report's Signals tab. Each row carries the dominant phase, the
    # stress accumulator value, and the row's composite-stage inputs the
    # renderer needs to plot rhythm (left → right = old → current).
    PHASE_KEYS = ('p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
                  'p7', 'p7a', 'p7b', 'p8', 'p9', 'p10')
    phase_history = []
    if df is not None and not df.empty:
        for _, row in df.iterrows():
            q = row.get("quarter")
            if q is None:
                continue
            try:
                quarter_str = f"{int(q[0])}Q{int(q[1])}"
            except Exception:
                continue
            best = -1.0
            row_dom = None
            row_scores = {}
            for p in PHASE_KEYS:
                fv = _f(row.get(p))
                if fv is None:
                    continue
                row_scores[p] = fv
                if fv > best:
                    best = fv
                    row_dom = p
            phase_history.append({
                "q": quarter_str,
                "dom": row_dom,
                "ct": _f(row.get("stress_accum")) or 0.0,
                "p3": row_scores.get("p3"),
            })

    # Financial state — raw values straight from the validated kernel's
    # extracted/computed columns on the latest quarter. Display-only.
    financial_state = {}
    if latest is not None:
        financial_state = {
            "rev_variance": _f(latest.get("var_Revenue")),
            "rev_slope":    _f(latest.get("slope_Revenue")),
            "ocf_slope":    _f(latest.get("slope_OCF")),
            "cash_latest":  _f(latest.get("Cash")),
            "debt_latest":  _f(latest.get("Debt")),
            "cash_runway_q": _f(latest.get("runway")),
        }

    return {
        "cik": cik,
        "entity_name": facts.get("entityName", ""),
        "alert": alert,
        "first_alert_quarter": (
            f"{first_alert_q[0]}Q{first_alert_q[1]}"
            if first_alert_q else None
        ),
        "pathway": pathway,
        "composite_score": float(composite),
        "path_a_score": path_a,
        "path_b_score": path_b,
        "path_c_score": path_c,
        "path_a_threshold": THRESH_A,
        "path_b_threshold": THRESH_B,
        "path_c_threshold": THRESH_C,
        "alert_a": alert_a,
        "alert_b": alert_b,
        "alert_c": alert_c,
        "kernel_id": "limen_backtest.py",
        "kernel_runtime": "python-vercel",
        "validation_status": envelope["status"],
        "in_envelope": envelope["in_envelope"],
        "envelope_status_code": envelope["status_code"],
        "regime_context": envelope["regime_context"],
        "is_financial": envelope["is_financial"],
        "sic_code": envelope["sic_code"],
        "interpretive_only": (not envelope["in_envelope"]),
        "envelope_disclaimer": envelope["disclaimer"],
        "kernel_sha256_lock": "3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20",
        "latest_quarter": latest_quarter,
        "history_quarters": int(len(df)),
        "stress_rate": float(details.get("stress_rate", 0.0)),
        "max_consec_stressed": int(details.get("max_consec", 0)),
        "cash_decline": float(details.get("cash_decline", 0.0)),
        "rupture_n_quarters": int(details.get("rupture_n_quarters", 0)),
        "stress_accum_latest": stress_accum_latest,
        "financial_state": financial_state,
        "input_presence": input_presence,
        "phase_scores": phase_scores,
        "dominant_phase": dominant_phase,
        "phase_history": phase_history,
    }
