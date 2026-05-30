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

CURRENT STATUS: real `limen_backtest.py` has NOT been imported. The stub
below returns `available=False, validation_status="unavailable"` for every
CIK. Phase 4 imports the real file and flips the lock.

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

    # ── state == "match": real Thing 1 is present and locked ─────
    # Phase 4 will replace this branch with the real call into limen_backtest.
    # For Phases 1-3 the stub still returns unavailable so no validated alert
    # can ever be emitted before the real file is dropped in.
    base["validation_status"] = "unavailable"
    base["narrative_safe"].append(
        "Validated distress scorer is present and lock-verified, but the "
        "Phase 4 runtime wiring has not yet been added. Server returns "
        "unavailable until Phase 4 imports the validated entry points."
    )
    base["unsupported_reasons"].append(
        "thing1_runtime_not_wired: Phase 4 has not landed."
    )
    return base
