"""FRED configuration and the bounded FEDFUNDS fetch used by Thing 1.

The API key is environment-only (FRED_API_KEY). Missing configuration raises a
named failure before any transport call; there is no embedded fallback. The
transport is injected so production uses requests and tests use a fake. Error
results never include the URL or the key.
"""

from __future__ import annotations

import os
from datetime import datetime

try:  # Preserve the original numpy mean when the production runtime provides it.
    import numpy as _np
except Exception:  # noqa: BLE001
    _np = None

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


def _quarter(dt):
    return (dt.year, (dt.month - 1) // 3 + 1)


def _mean(values):
    if _np is not None:
        return _np.mean(values)
    return sum(values) / len(values)


def _delta_from_observations(observations):
    monthly = {}
    for observation in observations or []:
        try:
            dt = datetime.strptime(observation["date"], "%Y-%m-%d")
            monthly[dt] = float(observation["value"])
        except (KeyError, TypeError, ValueError):
            continue
    if not monthly:
        return {}

    quarterly = {}
    for dt in sorted(monthly):
        quarterly.setdefault(_quarter(dt), []).append(monthly[dt])
    means = {quarter: _mean(values) for quarter, values in quarterly.items()}
    ordered = sorted(means)
    return {
        ordered[index]: means[ordered[index]] - means[ordered[index - 1]]
        for index in range(1, len(ordered))
    }


def fetch_quiet(transport, env=None, timeout=30):
    """Fetch FEDFUNDS through the injected transport.

    Returns:
      {"ok": False, "reason": "fred-not-configured", "provider_called": False}
      {"ok": False, "reason": "fred-unavailable",   "provider_called": True}
      {"ok": True,  "reason": None, "provider_called": True, "delta": {...}}
    """
    try:
        params = fedfunds_params(env)
    except FredNotConfigured as exc:
        return {"ok": False, "reason": str(exc), "provider_called": False}

    try:
        response = transport(FRED_URL, params=params, timeout=timeout)
        response.raise_for_status()
        observations = response.json().get("observations", [])
    except Exception:
        # Deliberately do not include the exception text: provider errors can
        # embed the request URL, which carries the API key.
        return {"ok": False, "reason": "fred-unavailable", "provider_called": True}

    delta = _delta_from_observations(observations)
    if not delta:
        return {"ok": False, "reason": "fred-unavailable", "provider_called": True}
    return {"ok": True, "reason": None, "provider_called": True, "delta": delta}
