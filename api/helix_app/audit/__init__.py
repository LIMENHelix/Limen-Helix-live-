"""
api/audit — server-side audit + observatory logging for the Helix bridge.

Records every reconciliation decision made by /api/helix-report/score,
including each kernel's individual output, so the operator can analyze
patterns over time:
  - what Thing 1 (validated distress scorer) flags vs misses
  - what Thing 2 (long-arc phase tracker) surfaces
  - where the two kernels agree and where they diverge
  - drift over time on a per-CIK basis

Logs OUTCOMES, not formulas. The audit log never contains raw phase
scores, narrative text, companyData, kernel weights, or thresholds.
Phase scores are bucketed into low / medium / high using display-grade
cuts (0 / 0.3 / 0.6 / 1.0) — these are presentation buckets, not kernel
constants, and the same buckets are visible to anyone who can read the
public renderer.

The browser never sees the audit log. It is server-side only, written
to stdout (Vercel captures via log drains) and best-effort appended to
a local jsonl file when the filesystem is writeable.
"""

from .reconciliation_log import (
    LOG_VERSION,
    build_log_entry,
    bucket_phase_score,
    cross_kernel_signature,
    emit,
)

__all__ = [
    "LOG_VERSION",
    "build_log_entry",
    "bucket_phase_score",
    "cross_kernel_signature",
    "emit",
]
