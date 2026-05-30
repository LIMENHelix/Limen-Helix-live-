"""
api/thing2 — Long-Arc Recursive Phase Tracker (Thing 2)

Server-side, Python implementation of the v4 patent recursive phase pipeline.
Self-described as a "Faithful port of business-data.js 11-Phase Pipeline" with
v4 patent extras (P3 probabilistic-OR, p7a/p7b first-class phases, runway
gate, chronic-stress override, recency-weighted dominant phase, recovery-streak
gate).

THIS IS NOT THING 1. Thing 2 cannot:
  - emit `validation_status: "validated"`
  - emit `alert: true` / `ALERT FIRED`
  - authorize "validated financial distress" or any terminal/intervention
    language

Thing 2's output is interpretive phase posture only. It is rendered with
neutral phase-state labels (p3 → "elevated-variance state", not
"instability"). The renderer must mark the Thing 2 section UNVALIDATED.

The ONLY public entry points exposed to the bridge:
  - run_pipeline(company_data, fred_delta=None)
  - get_dominant_phase(latest_row)
  - build_company_data(facts_json, is_financial=False)
  - LIMEN, ALL_PHASES, PHASE_META  (display-only constants)

All math lives in phase_engine.py. Do not modify it.
"""

from .phase_engine import (
    ALL_PHASES,
    LIMEN,
    PHASE_META,
    KERNEL_VERSION,
    CONSTANTS_HASH,
    build_company_data,
    get_dominant_phase,
    run_pipeline,
)

KERNEL_ID = "phase_engine.py"
KERNEL_RUNTIME = "python-vercel"

__all__ = [
    "ALL_PHASES",
    "LIMEN",
    "PHASE_META",
    "KERNEL_ID",
    "KERNEL_RUNTIME",
    "KERNEL_VERSION",
    "CONSTANTS_HASH",
    "build_company_data",
    "get_dominant_phase",
    "run_pipeline",
]
