"""Safe runtime adapter for the validated scorer's FRED macro input.

The validated kernel is byte-locked and therefore remains untouched.  This
adapter reproduces only its external FEDFUNDS acquisition/quarterly-delta step,
using the deployment secret and never logging a request URL or exception text.
"""

from datetime import datetime


FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"


def _quarter(value):
    return value.year, (value.month - 1) // 3 + 1


def fetch_fred_delta(request_get, api_key, emit=print):
    """Return quarterly FEDFUNDS deltas; fail safely without exposing secrets."""
    if not api_key:
        emit("[limen] FRED FEDFUNDS unavailable: FRED_API_KEY missing")
        return {}

    params = {
        "series_id": "FEDFUNDS",
        "api_key": api_key,
        "file_type": "json",
        "observation_start": "2014-01-01",
    }
    try:
        response = request_get(FRED_OBSERVATIONS_URL, params=params, timeout=30)
    except Exception:
        emit("[limen] FRED FEDFUNDS unavailable: network error")
        return {}

    status = getattr(response, "status_code", None)
    if not isinstance(status, int) or status < 200 or status >= 300:
        safe_status = status if isinstance(status, int) else "unknown"
        emit("[limen] FRED FEDFUNDS unavailable: HTTP %s" % safe_status)
        return {}

    try:
        payload = response.json()
        observations = payload.get("observations", []) if isinstance(payload, dict) else []
    except Exception:
        emit("[limen] FRED FEDFUNDS unavailable: invalid JSON")
        return {}

    monthly = {}
    for observation in observations:
        try:
            recorded_at = datetime.strptime(observation["date"], "%Y-%m-%d")
            monthly[recorded_at] = float(observation["value"])
        except (KeyError, TypeError, ValueError):
            continue

    quarterly = {}
    for recorded_at in sorted(monthly):
        quarterly.setdefault(_quarter(recorded_at), []).append(monthly[recorded_at])
    quarterly_means = {
        period: sum(values) / len(values)
        for period, values in quarterly.items()
        if values
    }
    periods = sorted(quarterly_means)
    delta = {
        periods[index]: quarterly_means[periods[index]] - quarterly_means[periods[index - 1]]
        for index in range(1, len(periods))
    }
    emit("[limen] FRED FEDFUNDS: %d quarterly deltas" % len(delta))
    return delta
