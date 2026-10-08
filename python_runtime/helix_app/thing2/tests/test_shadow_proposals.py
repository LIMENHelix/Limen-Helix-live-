"""
test_shadow_proposals.py — tests for the SHADOW-ONLY P4/P6 proposals
(checkpoint §25 recovered work; approved as dead code 2026-10-08 §27).

Synthetic behavior-pinning only — not company validation. These tests guard
the two gating properties: missing evidence is never zero, and no shadow
function emits a phase verdict.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evidence import (  # noqa: E402
    MEASURED_ZERO,
    MISSING,
    UNSUPPORTED,
    measured,
    missing,
)
import shadow_proposals as sp  # noqa: E402


def series(values, start_year=2019, start_q=1):
    out = {}
    y, n = start_year, start_q
    for v in values:
        out["%dQ%d" % (y, n)] = missing() if v is None else measured(v)
        n += 1
        if n > 4:
            n, y = 1, y + 1
    return out


def flat_rev(n=16, v=100.0):
    return series([v] * n)


class TestP4ValenceContract(unittest.TestCase):
    def test_scaffold_now_both_fields_visible(self):
        ocf = series([-50.0] * 16)
        cff = series([100.0] * 16)
        r = sp.p4_valence_contract(ocf, cff, "2022Q4")
        self.assertEqual(r["instantaneous_valence"], "SCAFFOLDING_NOW")
        self.assertEqual(r["cumulative_cost"].kind, "MEASURED")
        self.assertEqual(r["cumulative_cost"].value, 16 * 100.0)

    def test_no_current_scaffold_keeps_history(self):
        # history of outside financing, but current TTM not a plug
        ocf = series([100.0] * 12 + [-50.0] * 4)
        cff = series([100.0] * 12 + [10.0] * 4)
        r = sp.p4_valence_contract(ocf, cff, "2022Q4")
        # current TTM: OCF>0 -> not a scaffold NOW
        self.assertEqual(r["instantaneous_valence"], "NO_CURRENT_SCAFFOLD")
        # cumulative cost still records the prior support (the "Peace" reading)
        self.assertEqual(r["cumulative_cost"].value,
                         sum([100.0] * 12 + [10.0] * 4))

    def test_missing_cff_window_is_missing_not_zero(self):
        ocf = series([100.0] * 16)
        cff = series([100.0] * 12 + [None] * 4)
        r = sp.p4_valence_contract(ocf, cff, "2022Q4")
        self.assertEqual(r["cumulative_cost"].kind, MISSING)

    def test_measured_zero_cff_is_real(self):
        ocf = series([100.0] * 16)
        cff = series([0.0] * 16)
        r = sp.p4_valence_contract(ocf, cff, "2022Q4")
        self.assertEqual(r["cumulative_cost"].kind, MEASURED_ZERO)
        self.assertEqual(r["cumulative_cost"].value, 0.0)
        self.assertEqual(r["instantaneous_valence"], "NO_CURRENT_SCAFFOLD")

    def test_valence_none_when_ttm_not_computable(self):
        ocf = series([None] * 16)
        cff = series([100.0] * 16)
        r = sp.p4_valence_contract(ocf, cff, "2022Q4")
        self.assertIsNone(r["instantaneous_valence"])


class TestP6CapitalReturn(unittest.TestCase):
    def test_measured_window_counts_hits(self):
        div = series([5.0] * 16)
        rep = series([0.0] * 16)
        r = sp.p6_capital_return_line(div, rep, "2022Q4")
        self.assertEqual(r["ttm_dividends"].value, 20.0)
        self.assertEqual(r["ttm_repurchases"].kind, MEASURED_ZERO)
        self.assertTrue(r["returned_in_window"].is_measured)
        self.assertEqual(r["returned_in_window"].value, 16.0)

    def test_none_series_is_unsupported_not_missing(self):
        r = sp.p6_capital_return_line(None, series([1.0] * 16), "2022Q4")
        self.assertEqual(r["returned_in_window"].kind, UNSUPPORTED)

    def test_gap_in_window_is_missing(self):
        div = series([5.0] * 12 + [None] * 4)
        r = sp.p6_capital_return_line(div, series([0.0] * 16), "2022Q4")
        self.assertEqual(r["returned_in_window"].kind, MISSING)


class TestP6Readiness(unittest.TestCase):
    def test_all_components_measured(self):
        div = series([5.0] * 16)
        cr = sp.p6_capital_return_line(div, series([0.0] * 16), "2022Q4")
        r = sp.p6_readiness(measured(2.0), flat_rev(), cr)
        self.assertTrue(r["all_components_measured"])
        self.assertTrue(r["solvency_component"]["solvent"])
        self.assertTrue(r["rhythm_component"]["measurable"])
        self.assertEqual(r["capital_return_component"]["quarters_with_return"], 16.0)

    def test_missing_solvency_blocks_readiness(self):
        div = series([5.0] * 16)
        cr = sp.p6_capital_return_line(div, series([0.0] * 16), "2022Q4")
        r = sp.p6_readiness(missing("no facts"), flat_rev(), cr)
        self.assertFalse(r["all_components_measured"])
        self.assertFalse(r["solvency_component"]["measured"])
        self.assertIsNone(r["solvency_component"]["solvent"])

    def test_readiness_reports_never_a_phase_verdict(self):
        r = sp.p6_readiness(measured(2.0), flat_rev(), {
            "returned_in_window": measured(3.0)})
        self.assertNotIn("phase", r)
        self.assertNotIn("status", r)


if __name__ == "__main__":
    unittest.main()
