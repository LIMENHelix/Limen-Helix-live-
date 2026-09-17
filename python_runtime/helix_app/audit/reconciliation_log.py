"""
Reconciliation + pattern log for /api/helix-report/score.

One log entry per request. Append-only. Designed for grep-driven analysis:
  grep '"cik": "0000320193"'  reconciliation_log.jsonl       # one CIK timeline
  grep 't1=alert|t2=p4'       reconciliation_log.jsonl       # divergence pattern
  grep '"agree": false'       reconciliation_log.jsonl       # all disagreements
  grep 'fingerprint_state":"mismatch"' reconciliation_log.jsonl  # any kernel hash drift

Privacy:
  - logs labels and bucket names only
  - no raw phase scores, no narrative_safe text, no companyData
  - no formulas, no weights, no thresholds, no kernel source
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

LOG_VERSION = "1"

# Display-grade buckets for the renderer-visible phase scores. These cuts are
# the same the renderer would use to color a bar; they are NOT kernel
# thresholds and do not leak any decision boundary.
_PHASE_SCORE_CUTS = (0.30, 0.60)
_PHASE_BUCKETS = ("low", "medium", "high")

# Reconciliation summary templates — log the template id, not the prose.
# The id is short, finite, and stable for analysis. Keep these strings
# byte-identical to the ones produced by api/main.py:_build_reconciliation.
_TEMPLATE_IDS = {
    "Validated distress scorer fired alert; long-arc tracker shows distress-side posture. Both signals indicate distress.":
        "t1_alert_t2_distress_agree",
    "Validated distress scorer fired alert; long-arc tracker does not show distress-side posture. Thing 1 has primacy. Investigate the divergence; do not dismiss the validated alert.":
        "t1_alert_t2_stable_diverge",
    "No validated distress alert. Long-arc tracker shows interpretive distress-side posture; this is unvalidated and does not by itself authorize distress action.":
        "t1_no_alert_t2_distress_diverge",
    "No validated distress alert; long-arc tracker shows stable-side posture. Both signals consistent.":
        "t1_no_alert_t2_stable_agree",
    "Validated distress scorer ran. Long-arc tracker not available for reconciliation.":
        "t1_ran_t2_unavailable",
    # Thing 1 unavailable branches (Phases 1-3 default state)
    "Validated bank scorer not yet available. Long-arc tracker posture is interpretive only and is not a validated distress assessment.":
        "t1_bank_adapter_required",
    "Insufficient quarterly history for the validated distress scorer. Long-arc tracker may be interpretive but has reduced reliability.":
        "t1_insufficient_data",
    "Validated distress scorer has been modified since validation; refusing to score. Long-arc tracker is interpretive only and cannot substitute for validated assessment.":
        "t1_unvalidated_after_modification",
    "Validated distress scorer unavailable. Long-arc tracker is interpretive only and cannot substitute for validated assessment.":
        "t1_unavailable_generic",
}

# Path resolution. Best-effort; serverless filesystems (Vercel) are
# ephemeral, but on local dev / VMs the file persists. stdout is the
# durable channel.
_HERE = os.path.dirname(os.path.abspath(__file__))
_LOG_PATH = os.environ.get("LIMEN_RECONCILIATION_LOG_PATH",
                            os.path.join(_HERE, "reconciliation_log.jsonl"))


def bucket_phase_score(score: Any) -> str:
    """Map a phase score to {low, medium, high}. Renderer-grade buckets."""
    try:
        v = float(score)
    except (TypeError, ValueError):
        return "low"
    if v < _PHASE_SCORE_CUTS[0]:
        return _PHASE_BUCKETS[0]
    if v < _PHASE_SCORE_CUTS[1]:
        return _PHASE_BUCKETS[1]
    return _PHASE_BUCKETS[2]


def _summary_template_id(summary: str | None) -> str:
    if not summary:
        return "unknown"
    return _TEMPLATE_IDS.get(summary, "freeform_or_unmapped")


def _t1_unsupported_categories(reasons: list[str] | None) -> list[str]:
    """Coarse-bucket unsupported reasons into stable category labels."""
    out: list[str] = []
    for r in reasons or []:
        rl = r.lower()
        if "limen_backtest.py is not deployed" in rl or "not present" in rl:
            out.append("limen_backtest_not_deployed")
        elif "validation_lock" in rl or "lock has not been signed" in rl:
            out.append("validation_lock_not_signed")
        elif "fingerprint_mismatch" in rl or "modified since validation" in rl:
            out.append("fingerprint_mismatch")
        elif "phase 4 has not landed" in rl or "thing1_runtime_not_wired" in rl:
            out.append("thing1_runtime_not_wired")
        elif "bank_adapter_required" in rl or "regime 2" in rl:
            out.append("bank_adapter_required")
        elif "extraction_error" in rl or "edgar fetch failed" in rl:
            out.append("extraction_error")
        elif "minimum 5" in rl or "insufficient" in rl:
            out.append("insufficient_data")
        else:
            out.append("other")
    return out


def cross_kernel_signature(
    t1: dict,
    t2: dict,
    latest_quarter: str | None,
    is_financial: bool,
) -> str:
    """One-line, grep-friendly summary of what each kernel said.

    Examples:
      "t1=unavailable|t2=p4|q=2025Q4|fin=false"
      "t1=alert|t2=p7a|q=2024Q1|fin=false"
      "t1=bank_adapter_required|t2=p3|q=2025Q4|fin=true"
    """
    if t1.get("alert") is True:
        t1_token = "alert"
    elif t1.get("alert") is False:
        t1_token = "no_alert"
    else:
        t1_token = (t1.get("validation_status") or "unknown")

    t2_token = t2.get("dominant_phase") or "none"
    if not t2.get("available"):
        t2_token = "none"

    return (
        f"t1={t1_token}"
        f"|t2={t2_token}"
        f"|q={latest_quarter or 'none'}"
        f"|fin={'true' if is_financial else 'false'}"
    )


def build_log_entry(
    *,
    request_id: str,
    started_unix: float,
    finished_unix: float,
    request_body: dict,
    packet: dict,
    t1_runtime_ms: int,
    t2_runtime_ms: int,
    forbidden_filtered_t1: int,
    forbidden_filtered_t2: int,
) -> dict:
    """Build the structured log entry. Pure function; safe to unit-test."""
    t1 = packet.get("validated_signal") or {}
    t2 = packet.get("phase_tracker_signal") or {}
    rec = packet.get("reconciliation") or {}

    # Phase score bucket map (low/medium/high), no raw numerics.
    pscores = t2.get("phase_scores") or {}
    bucketed = {pid: bucket_phase_score(pscores.get(pid, 0.0)) for pid in pscores}

    # State summary buckets only — never numerics.
    ss = t2.get("state_summary") or {}
    state_buckets = {
        "C_t_present": bool(ss.get("C_t_present")),
        "C_t_bucket": ss.get("C_t_bucket"),
        "H_length_quarters": ss.get("H_length_quarters"),
        "hysteresis_active": ss.get("hysteresis_active"),
        "runway_classification": ss.get("runway_classification"),
    }

    fp = t1.get("fingerprint_status") or {}

    return {
        "log_version": LOG_VERSION,
        "request_id": request_id,
        "ts_unix": int(finished_unix),
        "ts_iso": _iso_utc(finished_unix),

        "request": {
            "cik": packet.get("cik") or request_body.get("cik"),
            "entity_name": packet.get("entity_name"),
            "is_financial": bool(packet.get("is_financial")),
            "sic_code": packet.get("sic_code"),
            "source_surface": request_body.get("source_surface"),
            "requested_report_type": request_body.get("requested_report_type"),
            "ticker": request_body.get("ticker"),
            "domain": request_body.get("domain"),
            "lane": request_body.get("lane"),
            "source_opportunity_id": request_body.get("source_opportunity_id"),
        },

        "history": {
            "latest_quarter": packet.get("latest_quarter"),
            "history_quarters": packet.get("history_quarters"),
            "history_sufficiency": packet.get("history_sufficiency"),
            "confidence_status": packet.get("confidence_status"),
        },

        "thing1": {
            "kernel_id": t1.get("kernel_id"),
            "kernel_version": t1.get("kernel_version"),
            "validation_status": t1.get("validation_status"),
            "fingerprint_state": fp.get("state"),
            "fingerprint_present": fp.get("kernel_sha256") is not None,
            "lock_present": fp.get("lock_sha256") is not None,
            "available": bool(t1.get("available")),
            "alert": t1.get("alert"),
            "first_alert_quarter": t1.get("first_alert_quarter"),
            "distress_band": t1.get("distress_band"),
            "recovered": t1.get("recovered"),
            "unsupported_categories": _t1_unsupported_categories(t1.get("unsupported_reasons")),
            "narrative_count": len(t1.get("narrative_safe") or []),
            "runtime_ms": int(t1_runtime_ms),
        },

        "thing2": {
            "kernel_id": t2.get("kernel_id"),
            "kernel_version": t2.get("kernel_version"),
            "validation_status": t2.get("validation_status"),
            "available": bool(t2.get("available")),
            "interpretive_only": True,                # invariant
            "dominant_phase": t2.get("dominant_phase"),
            "phase_state_label": t2.get("phase_state_label"),
            "phase_score_buckets": bucketed,
            "state_summary": state_buckets,
            "narrative_count": len(t2.get("narrative_safe") or []),
            "runtime_ms": int(t2_runtime_ms),
        },

        "reconciliation": {
            "primacy": "thing1",                      # invariant
            "agree": rec.get("agree"),
            "action_authority": rec.get("action_authority"),
            "summary_template": _summary_template_id(rec.get("summary")),
        },

        "filtering": {
            "forbidden_phrases_filtered_thing1": int(forbidden_filtered_t1),
            "forbidden_phrases_filtered_thing2": int(forbidden_filtered_t2),
        },

        "warnings_count": len(packet.get("warnings") or []),

        "timing": {
            "total_ms": int(round((finished_unix - started_unix) * 1000)),
            "t1_ms": int(t1_runtime_ms),
            "t2_ms": int(t2_runtime_ms),
        },

        # Grep-friendly one-line signature for pattern analysis.
        "pattern_signature": cross_kernel_signature(
            t1=t1, t2=t2,
            latest_quarter=packet.get("latest_quarter"),
            is_financial=bool(packet.get("is_financial")),
        ),
    }


def _iso_utc(unix_seconds: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).isoformat()


def emit(entry: dict) -> None:
    """Stdout JSON line + best-effort append to local jsonl file.

    Stdout is the durable channel on Vercel (captured via log drains).
    The local file is for development environments and any deployment
    where the filesystem is writeable.
    """
    line = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    # Stdout — durable on managed runtimes.
    try:
        print("[reconciliation_log] " + line, flush=True)
    except Exception:
        pass
    # Local file — best effort; ignore filesystem errors.
    try:
        with open(_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        # If the filesystem is read-only (e.g., Vercel), do not raise.
        # stdout already captured the entry.
        sys.stderr.write(f"[reconciliation_log] local write failed (path={_LOG_PATH})\n")
