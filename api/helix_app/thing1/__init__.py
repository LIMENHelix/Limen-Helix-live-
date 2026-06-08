"""
api/thing1 — Validated Financial Distress Scorer (Thing 1)

This package wraps the real `limen_backtest.py` (validated, frozen, source of
truth). It is the ONLY code path in the system permitted to:
  - emit `validation_status: "validated"`
  - emit `alert: true` / `ALERT FIRED`
  - authorize the phrases `validated financial distress`,
    `M&A advisor`, `Bankruptcy / restructuring attorney`,
    `Chapter 11`, `intervention window closing`,
    `terminal path`, `point of no return`.

CURRENT STATUS: PHASE 4 LANDED (2026-06-08). The validated limen_backtest.py
is deployed, its sha256 matches VALIDATION_LOCK.json, and the match branch
below calls the real kernel: extract series from the server-fetched SEC facts
(mirroring fetch_company_data byte-for-byte, minus the refetch), then
compute_all_features -> score_all_phases -> analyse_trajectory ->
compute_trajectory_alert at the locked HOLDOUT_P3_ENTRY=0.59 operating point.
Plot/report-only imports (matplotlib, sklearn.metrics) are satisfied with
inert shims when absent — they are never executed on the scoring path, and
the locked file is not modified. Any error returns a refusal, never a fake
score.

VALIDATION_LOCK.json holds the bytes-level fingerprint that the deployed
`limen_backtest.py` must match. Mismatch is a hard fail — the stub returns
`validation_status="unvalidated_after_modification"` and refuses to score.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

KERNEL_ID = "limen_backtest.py"
KERNEL_RUNTIME = "python-vercel"

_HERE = os.path.dirname(os.path.abspath(__file__))
_LOCK_PATH = os.path.join(_HERE, "VALIDATION_LOCK.json")
_KERNEL_PATH = os.path.join(_HERE, "limen_backtest.py")


def _read_lock() -> dict:
    try:
        with open(_LOCK_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _file_sha256(path: str) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def fingerprint_status() -> dict:
    """Compute deployed-file fingerprint and compare to lock.

    Returns one of:
      - {"state": "absent",   "kernel_sha256": None, "lock_sha256": <or None>}
        → real limen_backtest.py is not deployed; stub mode.
      - {"state": "match",    "kernel_sha256": "...", "lock_sha256": "..."}
        → fingerprint matches; validated kernel is callable.
      - {"state": "mismatch", "kernel_sha256": "...", "lock_sha256": "..."}
        → fingerprint differs from lock; HARD FAIL. Score path returns
          validation_status="unvalidated_after_modification".
      - {"state": "no_lock",  "kernel_sha256": "...", "lock_sha256": None}
        → file present but no lock entry yet (e.g., import in progress).
          HARD FAIL — refuse to validate.
    """
    lock = _read_lock()
    lock_sha = lock.get("sha256") if isinstance(lock, dict) else None
    kernel_present = os.path.isfile(_KERNEL_PATH)
    if not kernel_present:
        return {"state": "absent", "kernel_sha256": None, "lock_sha256": lock_sha}
    kernel_sha = _file_sha256(_KERNEL_PATH)
    if not lock_sha:
        return {"state": "no_lock", "kernel_sha256": kernel_sha, "lock_sha256": None}
    if kernel_sha == lock_sha:
        return {"state": "match", "kernel_sha256": kernel_sha, "lock_sha256": lock_sha}
    return {"state": "mismatch", "kernel_sha256": kernel_sha, "lock_sha256": lock_sha}


def _ensure_optional_dep_shims() -> list:
    """Satisfy limen_backtest.py's module-level plot/report-only imports.

    The locked kernel imports sklearn.metrics and matplotlib at module level,
    but the validated SCORING path (extract -> features -> phases ->
    trajectory -> composite alert) never executes them: sklearn.metrics is
    used only in run_backtest/write_summary/plot_roc_pr (PR-AUC reporting)
    and matplotlib only in plot_company/plot_roc_pr. Those packages are not
    in api/requirements.txt and would add ~200MB to the function. Since the
    locked file cannot be edited, when they are absent we register inert
    stand-in modules so the import succeeds; any actual call into a shimmed
    symbol raises. numpy / pandas / statsmodels / requests — everything the
    scoring path executes — are real installed dependencies.

    Returns the list of shimmed module names (empty if real packages exist).
    """
    import sys
    import types

    shimmed = []

    def _refuse(*_a, **_k):
        raise RuntimeError(
            "shimmed plot/report dependency called at runtime — the scoring "
            "path must never reach this; refusing rather than fabricating."
        )

    try:
        import sklearn.metrics  # noqa: F401
    except Exception:
        skl = types.ModuleType("sklearn")
        met = types.ModuleType("sklearn.metrics")
        met.average_precision_score = _refuse
        met.precision_recall_curve = _refuse
        met.roc_curve = _refuse
        met.auc = _refuse
        skl.metrics = met
        sys.modules["sklearn"] = skl
        sys.modules["sklearn.metrics"] = met
        shimmed.append("sklearn.metrics")

    try:
        import matplotlib  # noqa: F401
    except Exception:
        mpl = types.ModuleType("matplotlib")
        mpl.use = lambda *a, **k: None
        plt = types.ModuleType("matplotlib.pyplot")
        plt.__getattr__ = lambda name: _refuse  # PEP 562 fallback
        mdates = types.ModuleType("matplotlib.dates")
        mdates.__getattr__ = lambda name: _refuse
        mpl.pyplot = plt
        mpl.dates = mdates
        sys.modules["matplotlib"] = mpl
        sys.modules["matplotlib.pyplot"] = plt
        sys.modules["matplotlib.dates"] = mdates
        shimmed.append("matplotlib")

    return shimmed


def _quarter_str(q) -> str | None:
    """Kernel quarters are (year, q) tuples; serialize as '2023Q1'."""
    try:
        return f"{int(q[0])}Q{int(q[1])}"
    except Exception:
        return str(q) if q is not None else None


def score_validated(
    cik: str,
    sec_facts: dict | None = None,
    fred_delta: dict | None = None,
    is_financial: bool = False,
) -> dict:
    """Run the validated distress scorer for a CIK.

    Inputs:
      cik           — required string of digits.
      sec_facts     — pre-fetched SEC EDGAR facts, or None to indicate caller
                      did not fetch (server should not depend on this).
      fred_delta    — pre-fetched FRED Δ-fedfunds, or None.
      is_financial  — SIC 6000-6999 flag.

    Output (always a dict, never raises):
      Always contains:
        kernel_id, kernel_runtime, kernel_version, validation_status,
        available, alert, first_alert_quarter, distress_band, recovered,
        narrative_safe (list[str]), unsupported_reasons (list[str]),
        fingerprint_status (dict with state + sha256 fields).

    Bank lock:
      If is_financial=True, returns BANK_ADAPTER_REQUIRED regardless of
      lock state. This means the validated scorer's Regime 2 (bank /
      deposit-funded financial institution) calibration has not been
      performed and a bank-specific data adapter has not been built.
    """
    fp = fingerprint_status()

    base = {
        "kernel_id": KERNEL_ID,
        "kernel_runtime": KERNEL_RUNTIME,
        "kernel_version": (fp.get("kernel_sha256") or "")[:12] or None,
        "available": False,
        "alert": None,
        "first_alert_quarter": None,
        "distress_band": None,
        "recovered": None,
        "fingerprint_status": fp,
        "narrative_safe": [],
        "unsupported_reasons": [],
    }

    # ── Bank lock ────────────────────────────────────────────────
    # Banks short-circuit before fingerprint check: even if the validated
    # kernel were present and locked, Regime 2 calibration is missing.
    if is_financial:
        base["validation_status"] = "bank_adapter_required"
        base["narrative_safe"].append(
            "Validated distress scorer cannot run for SIC 6000-6999 entities "
            "because the Regime 2 bank / deposit-funded calibration has not "
            "been performed and a bank-specific data adapter has not been built."
        )
        base["unsupported_reasons"].append(
            "BANK_ADAPTER_REQUIRED: Regime 2 calibration absent."
        )
        return base

    # ── Fingerprint gate ────────────────────────────────────────
    state = fp.get("state")
    if state == "absent":
        base["validation_status"] = "unavailable"
        base["narrative_safe"].append(
            "Validated distress scorer unavailable: limen_backtest.py is not "
            "present in this deployment."
        )
        base["unsupported_reasons"].append("limen_backtest.py is not deployed.")
        return base
    if state == "no_lock":
        base["validation_status"] = "unvalidated_after_modification"
        base["narrative_safe"].append(
            "Validated distress scorer is present but VALIDATION_LOCK.json "
            "does not yet record its fingerprint. Refusing to validate."
        )
        base["unsupported_reasons"].append(
            "VALIDATION_LOCK.json has no sha256 entry; lock has not been signed."
        )
        return base
    if state == "mismatch":
        base["validation_status"] = "unvalidated_after_modification"
        base["narrative_safe"].append(
            "Validated distress scorer fingerprint does not match the lock. "
            "The kernel has been modified since validation. Refusing to score."
        )
        base["unsupported_reasons"].append(
            "fingerprint_mismatch: live limen_backtest.py sha256 != VALIDATION_LOCK.sha256."
        )
        return base

    # ── state == "match": Phase 4 — run the validated kernel ─────
    # The deployed limen_backtest.py hashes to the signed lock. This branch
    # executes the exact validated pipeline. Any failure is a refusal
    # (available=False + reason), never a fabricated score.
    shimmed = _ensure_optional_dep_shims()

    try:
        from . import limen_backtest as _lb
    except Exception as e:
        base["validation_status"] = "kernel_import_failed"
        base["narrative_safe"].append(
            "Validated distress scorer could not be imported in this runtime; "
            "no validated assessment is available."
        )
        base["unsupported_reasons"].append(
            f"kernel_import_failed: {type(e).__name__}: {e}"
        )
        return base

    try:
        facts = sec_facts if sec_facts is not None else _lb.fetch_sec_facts(cik)
        if not facts:
            base["validation_status"] = "insufficient_data"
            base["narrative_safe"].append(
                "No SEC company facts available for this CIK; the validated "
                "scorer requires quarterly XBRL history."
            )
            base["unsupported_reasons"].append("no_sec_facts")
            return base

        # Mirror of the validated fetch_company_data() series extraction
        # (limen_backtest.py lines 294-301), minus the network refetch —
        # the server has already fetched `facts`.
        data = {}
        data["Revenue"] = _lb.extract_quarterly_series(
            facts, _lb.TAG_MAP["Revenue"], "Revenue", is_flow=True)
        data["OCF"] = _lb.extract_quarterly_series(
            facts, _lb.TAG_MAP["OCF"], "OCF", is_flow=True)
        data["Cash"] = _lb.extract_quarterly_series(
            facts, _lb.TAG_MAP["Cash"], "Cash", is_flow=False)
        dc = _lb.extract_quarterly_series(
            facts, _lb.TAG_MAP["DebtCurrent"], "DebtCurrent", is_flow=False)
        dl = _lb.extract_quarterly_series(
            facts, _lb.TAG_MAP["DebtLong"], "DebtLong", is_flow=False)
        all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
        data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}

        if not any(data.values()):
            base["validation_status"] = "insufficient_data"
            base["narrative_safe"].append(
                "SEC facts contained none of the four required quarterly "
                "series (Revenue, OCF, Cash, Debt)."
            )
            base["unsupported_reasons"].append("no_extractable_series")
            return base

        # Validated pipeline, in the validated order. analyse_trajectory must
        # precede the composite (it writes stress_accum). The alert is
        # evaluated at the LOCKED holdout operating point (HOLDOUT_P3_ENTRY
        # = 0.59 — "locked operating point — never sweep in holdout"), the
        # configuration recorded in VALIDATION_LOCK.validation_evidence.
        df = _lb.compute_all_features(data, fred_delta or {})
        if df is None or df.empty:
            base["validation_status"] = "insufficient_data"
            base["narrative_safe"].append(
                "Insufficient quarterly history to compute rolling features "
                "(the validated scorer needs at least 4 consecutive quarters "
                "per series)."
            )
            base["unsupported_reasons"].append("feature_window_empty")
            return base
        df = _lb.score_all_phases(df)
        df = _lb.analyse_trajectory(df)
        alert, first_q, composite = _lb.compute_trajectory_alert(
            df, p3_entry=_lb.HOLDOUT_P3_ENTRY)

        recovered_now = (
            bool(df["recovered"].iloc[-1]) if "recovered" in df.columns and len(df) else None
        )

        # Band: ALERT is the validated classification. Sub-alert gradation is
        # descriptive only (composite vs the lowest alert threshold) and is
        # labeled as such in the narrative.
        min_thresh = min(
            _lb.COMPOSITE_THRESH_A, _lb.COMPOSITE_THRESH_B, _lb.COMPOSITE_THRESH_C)
        if alert:
            band = "ALERT"
        elif composite >= 0.75 * min_thresh:
            band = "ELEVATED"
        elif composite >= 0.40 * min_thresh:
            band = "WATCH"
        else:
            band = "LOW"

        base["available"] = True
        base["validation_status"] = "validated"
        base["alert"] = bool(alert)
        base["first_alert_quarter"] = _quarter_str(first_q)
        base["distress_band"] = band
        base["recovered"] = recovered_now
        base["composite_score"] = round(float(composite), 3)

        base["narrative_safe"].append(
            f"Validated distress scorer ran. Kernel fingerprint "
            f"{(fp.get('kernel_sha256') or '')[:12]} matches VALIDATION_LOCK "
            f"(operating point P3_ENTRY=0.59, locked holdout threshold)."
        )
        if alert:
            base["narrative_safe"].append(
                f"ALERT FIRED — validated financial distress signal. "
                f"First alert quarter: {_quarter_str(first_q)}."
            )
        else:
            base["narrative_safe"].append(
                "No validated distress alert at the locked operating point."
            )
        if recovered_now:
            base["narrative_safe"].append(
                "Most recent quarter shows recovery-phase dominance "
                "(accumulator discharging)."
            )
        if not alert and band in ("ELEVATED", "WATCH"):
            base["narrative_safe"].append(
                f"Band '{band}' is descriptive (composite {composite:.2f} vs "
                f"alert threshold {min_thresh:.2f}) — it is NOT a validated "
                f"distress classification; only ALERT is."
            )
        if not fred_delta:
            base["narrative_safe"].append(
                "FRED macro series not supplied in this runtime; the P9 "
                "macro bias term is inactive for this run."
            )
        base["narrative_safe"].append(
            "Break detector: "
            + ("ruptures" if getattr(_lb, "HAS_RUPTURES", False)
               else "built-in PELT fallback (ruptures not installed)")
            + "."
        )
        if shimmed:
            base["unsupported_reasons"].append(
                "plot_report_deps_shimmed: " + ", ".join(shimmed)
                + " (reporting-only; never on the scoring path)"
            )
        return base

    except Exception as e:
        base["validation_status"] = "scoring_error"
        base["narrative_safe"].append(
            "Validated distress scorer raised an error during scoring; no "
            "validated result is available for this request."
        )
        base["unsupported_reasons"].append(
            f"scoring_error: {type(e).__name__}: {e}"
        )
        return base
