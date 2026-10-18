"""FRED configuration for Thing 1.

The API key is environment-only (FRED_API_KEY). Missing configuration raises a
named failure before any transport call; there is no embedded fallback.

The validated input transformation (observation parsing, quarterly grouping and
delta calculation) lives in the fingerprinted `limen_backtest.py` so the
VALIDATION_LOCK digest covers the values that enter `compute_all_features()`.
This module only supplies configuration and the request target.
"""

from __future__ import annotations

import os

FRED_API_KEY_ENV = "FRED_API_KEY"
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"


class FredNotConfigured(RuntimeError):
    """Raised when FRED_API_KEY is absent or blank."""


def api_key(env=None):
    source = env if env is not None else os.environ
    key = str(source.get(FRED_API_KEY_ENV, "")).strip()
    if not key:
        raise FredNotConfigured("fred-not-configured")
    return key


def fedfunds_params(env=None):
    return {
        "series_id": "FEDFUNDS",
        "api_key": api_key(env),
        "file_type": "json",
        "observation_start": "2014-01-01",
    }
