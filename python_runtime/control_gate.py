"""Deterministic global-control policy for the consolidated Python runtime.

The JavaScript catch-all already applies the staged civilization NUKE before
dispatch.  Vercel rewrites Python routes directly to ``api/python.py``, so they
need the same global stage decision at their own entry point.  This module is
pure policy: storage and HTTP remain in the entry point and are independently
testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


GLOBAL_ID = "global:emergency"
SCHEMA = "civilization-valve-receipt/1.0"
STAGES = (
    "NUKED",
    "DIAGNOSTIC_READ_ONLY",
    "SENSING_ONLY",
    "INTERNAL_COGNITION",
    "SANDBOX_MOTOR",
    "DOMAIN_RECOMMISSION",
    "OPEN",
)

DIAGNOSTIC_PATHS = frozenset(
    {
        "/api/ddgs-search/health",
        "/api/limen/health",
        "/api/helix/health",
        "/api/helix/regression",
    }
)

SENSING_PREFIXES = (
    "/api/ddgs-search/search/text",
    "/api/ddgs-search/extract",
    "/api/helix/edgar/facts/",
    "/api/helix/edgar/extract/",
)

COGNITION_PREFIXES = (
    "/api/limen/score",
    "/api/helix/helix-report/score",
    "/api/helix/score/",
)


@dataclass(frozen=True)
class Decision:
    allowed: bool
    stage: str | None
    route_class: str
    reason: str | None


def route_class(path: str, method: str = "GET") -> str:
    """Classify by authority, defaulting unknown Python work to cognition."""

    normalized = "/" + str(path or "").lstrip("/")
    if normalized in DIAGNOSTIC_PATHS:
        return "diagnostic"
    if any(normalized.startswith(prefix) for prefix in SENSING_PREFIXES):
        return "sensing"
    if any(normalized.startswith(prefix) for prefix in COGNITION_PREFIXES):
        return "cognition"
    # An unclassified route must never gain broader access from omission.
    return "cognition"


def normalize_record(record: Mapping[str, Any] | None) -> str:
    """Return a valid stage; a genuinely absent record matches JS default OPEN."""

    if record is None:
        return "OPEN"
    if (
        record.get("schemaVersion") != SCHEMA
        or record.get("valveId") != GLOBAL_ID
        or record.get("runtimeMode") not in {"OPEN", "CLOSED"}
    ):
        raise ValueError("invalid civilization global control record")
    stage = str(
        record.get("nukeStage")
        or ("OPEN" if record.get("runtimeMode") == "OPEN" else "NUKED")
    ).upper()
    if stage not in STAGES:
        raise ValueError("invalid civilization global control stage")
    if (stage == "OPEN") != (record.get("runtimeMode") == "OPEN"):
        raise ValueError("civilization global control mode/stage mismatch")
    return stage


def authorize(
    path: str,
    method: str,
    record: Mapping[str, Any] | None,
    *,
    control_available: bool = True,
) -> Decision:
    """Apply the staged global ceiling to one Python request."""

    classification = route_class(path, method)
    if classification == "diagnostic":
        return Decision(True, None if not control_available else normalize_record(record), classification, None)
    if not control_available:
        return Decision(False, None, classification, "nuke-control-unavailable-fail-closed")
    try:
        stage = normalize_record(record)
    except (AttributeError, TypeError, ValueError):
        return Decision(False, None, classification, "nuke-control-invalid-fail-closed")

    if stage in {"OPEN", "DOMAIN_RECOMMISSION", "SANDBOX_MOTOR", "INTERNAL_COGNITION"}:
        return Decision(True, stage, classification, None)
    if stage == "SENSING_ONLY" and classification == "sensing":
        return Decision(True, stage, classification, None)
    return Decision(False, stage, classification, "nuke-stage-activity-suppressed")
