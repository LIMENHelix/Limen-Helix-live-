"""Bounded compatibility for the two statsmodels operations the locked kernel uses.

The validated ``limen_backtest.py`` is intentionally immutable.  Its live
scoring path calls only ``statsmodels.api.add_constant``, ``OLS(...).fit()``
and ``statsmodels.tsa.stattools.acf(..., nlags=1, fft=False)``.  Shipping the
whole statsmodels/scipy stack for those operations adds roughly 140 MB to the
function.  This module installs API-compatible implementations backed by the
already-required NumPy package without changing the locked source file.
"""

from __future__ import annotations

import sys
import types

import numpy as np


def add_constant(values):
    """Match statsmodels.add_constant for the kernel's one-dimensional input."""
    array = np.asarray(values)
    if array.ndim != 1:
        raise ValueError("LIMEN statsmodels compatibility accepts one-dimensional input only")
    return np.column_stack((np.ones(array.shape[0], dtype=float), array))


class _FitResult:
    def __init__(self, params):
        self.params = params


class OLS:
    """Minimal ordinary-least-squares surface used by compute_features()."""

    def __init__(self, endog, exog):
        self._endog = np.asarray(endog, dtype=float)
        self._exog = np.asarray(exog, dtype=float)

    def fit(self):
        params, _residuals, _rank, _singular = np.linalg.lstsq(
            self._exog,
            self._endog,
            rcond=None,
        )
        return _FitResult(params)


def acf(values, nlags=1, fft=False):
    """Match statsmodels' default biased autocorrelation for bounded lags."""
    del fft  # The direct calculation is exact for the short kernel windows.
    array = np.asarray(values, dtype=float)
    if array.ndim != 1:
        raise ValueError("LIMEN statsmodels compatibility accepts one-dimensional input only")
    if nlags < 0:
        raise ValueError("nlags must be non-negative")
    centered = array - np.mean(array)
    denominator = float(np.dot(centered, centered))
    result = np.empty(nlags + 1, dtype=float)
    result[0] = 1.0
    if denominator == 0.0:
        result[1:] = np.nan
        return result
    for lag in range(1, nlags + 1):
        result[lag] = float(np.dot(centered[:-lag], centered[lag:]) / denominator)
    return result


def install() -> None:
    """Install the bounded module tree before importing the immutable kernel."""
    if "statsmodels.api" in sys.modules and "statsmodels.tsa.stattools" in sys.modules:
        return

    package = types.ModuleType("statsmodels")
    api = types.ModuleType("statsmodels.api")
    tsa = types.ModuleType("statsmodels.tsa")
    stattools = types.ModuleType("statsmodels.tsa.stattools")

    api.add_constant = add_constant
    api.OLS = OLS
    stattools.acf = acf
    tsa.stattools = stattools
    package.api = api
    package.tsa = tsa

    sys.modules["statsmodels"] = package
    sys.modules["statsmodels.api"] = api
    sys.modules["statsmodels.tsa"] = tsa
    sys.modules["statsmodels.tsa.stattools"] = stattools
