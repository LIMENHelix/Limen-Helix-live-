"""
test_financial_phase_map.py — acceptance tests for release 1 (decision 9.14(c)).

Runnable with any Python 3.9+:  python -m unittest discover -s tests
from python_runtime/helix_app/thing2/, or directly:
  python -m unittest tests.test_financial_phase_map

Test numbering follows the acceptance list in the checkpoint (§15/§9-11).
The three binding assertions from the review are T-BIND-1..3.
"""

import inspect
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evidence import (  # noqa: E402
    MEASURED_ZERO,
    UNKNOWN_ABSTAINED,
    UNKNOWN_INSUFFICIENT_HISTORY,
    UNKNOWN_NOT_BUILT,
    measured,
    missing,
)
import financial_phase_map as fpm  # noqa: E402


def series(values, start_year=2019, start_q=1):
    """values: list of numbers or None -> {quarter: Availability}."""
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


class TestEvidenceLayer(unittest.TestCase):
    def test_measured_zero_is_not_missing(self):
        a = measured(0.0)
        self.assertEqual(a.kind, MEASURED_ZERO)
        self.assertTrue(a.is_measured)
        self.assertNotEqual(a.kind, "MISSING")

    def test_ttm_preserves_measured_zero(self):
        s = series([0.0, 0.0, 0.0, 0.0])
        t = fpm._ttm(s, "2019Q4")
        self.assertEqual(t.kind, MEASURED_ZERO)
        self.assertEqual(t.value, 0.0)
        # a measured zero burn does NOT fire P4 (0.0 is not < 0)
        self.assertFalse(fpm._scaffold_fires(0.0, 100.0))

    def test_ttm_missing_never_zero(self):
        s = series([-5.0, None, -5.0, -5.0])
        t = fpm._ttm(s, "2019Q4")
        self.assertFalse(t.is_measured)


class TestAcceptance(unittest.TestCase):
    Z_OK = measured(2.0)   # solvent (Z'' > 1.1)

    # Test 1 — missing operating cash flow: never "self-funding"
    def test_missing_ocf_unknown_not_self_funding(self):
        v = fpm.evaluate(flat_rev(), series([None] * 16), series([5.0] * 16), self.Z_OK)
        self.assertTrue(v.is_unknown)
        self.assertIsNone(v.phase)
        self.assertIsNone(v.mode)
        self.assertEqual(v.status, UNKNOWN_INSUFFICIENT_HISTORY)

    # Test 2 — P4 never asserted without financing evidence
    def test_p4_requires_cff(self):
        v = fpm.evaluate(flat_rev(), series([-100.0] * 16), series([None] * 16), self.Z_OK)
        self.assertNotEqual(v.phase, "p4")
        self.assertTrue(v.is_unknown)

    # P4 scaffolding fires on the documented signature
    def test_p4_scaffold(self):
        v = fpm.evaluate(flat_rev(), series([-100.0] * 16), series([80.0] * 16), self.Z_OK)
        self.assertEqual(v.phase, "p4")
        self.assertEqual(v.mode, "SCAFFOLDING")
        self.assertEqual(v.status, "p4")

    # Test 10 — historical P4 -> P5 transition with cited window
    def test_p5_endurance_with_prior_p4(self):
        ocf = series([-100.0] * 8 + [100.0] * 8)
        cff = series([80.0] * 8 + [20.0] * 8)
        v = fpm.evaluate(flat_rev(), ocf, cff, self.Z_OK)
        self.assertEqual(v.phase, "p5")
        self.assertEqual(v.mode, "ENDURANCE")
        self.assertTrue(v.evidence["ever_p4_in_window"])

    # Test 11 — always-self-funded: NOT P5, not ENDURANCE
    def test_always_self_funded_not_p5(self):
        v = fpm.evaluate(flat_rev(), series([100.0] * 16), series([10.0] * 16), self.Z_OK)
        self.assertNotEqual(v.phase, "p5")
        self.assertNotEqual(v.mode, "ENDURANCE")
        self.assertFalse(v.evidence["ever_p4_in_window"])

    # Test 9 — P2 established rhythm
    def test_p2_seasonal_rhythm(self):
        vals = []
        base = 100.0
        for i in range(16):
            bump = 12.0 if (i % 4 == 3) else 0.0
            vals.append(base + bump)
            base *= 1.01
        rev = series(vals)
        v = fpm.evaluate(rev, series([50.0] * 16), series([5.0] * 16), self.Z_OK)
        self.assertEqual(v.phase, "p2")
        self.assertEqual(v.status, "p2")
        self.assertIsNotNone(v.evidence["temporal_coherence"])

    # Test 7 — P0 positively evidenced
    def test_p0_flat_solvent_sufficient(self):
        v = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16), self.Z_OK)
        self.assertEqual(v.phase, "p0")
        self.assertEqual(v.mode, "GENUINE_BASELINE")

    # Test 8 — flat + insufficient history: UNKNOWN, never P0
    def test_flat_insufficient_history_never_p0(self):
        v = fpm.evaluate(flat_rev(n=6), series([40.0] * 6), series([2.0] * 6), self.Z_OK)
        self.assertEqual(v.status, UNKNOWN_INSUFFICIENT_HISTORY)
        self.assertIsNone(v.phase)

    # Test 15 — an interior gap does not silently shift the window
    def test_interior_gap_reported_not_shifted(self):
        vals = [100.0] * 16
        rev = series(vals)
        rev["2022Q1"] = missing()  # interior gap at quarter 13 of 16
        v = fpm.evaluate(rev, series([40.0] * 16), series([2.0] * 16), self.Z_OK)
        self.assertEqual(v.status, UNKNOWN_INSUFFICIENT_HISTORY)
        self.assertIn("2022Q1", v.evidence["interior_gaps"])
        self.assertIn("gap", v.reason)

    # Solvency error is never solvent (ledger D13 analog)
    def test_solvency_unknown_flat_not_p0(self):
        v = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16), missing("altman no_facts"))
        self.assertEqual(v.status, UNKNOWN_ABSTAINED)
        self.assertIsNone(v.phase)
        self.assertNotEqual(v.mode, "GENUINE_BASELINE")


class TestReasonCodes(unittest.TestCase):
    Z_OK = measured(2.0)

    def test_abstained_set_is_exactly_p3_and_p7_family(self):
        v = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16), self.Z_OK)
        self.assertEqual(set(v.evidence["abstained_phases"]), {"p3", "p7", "p7a", "p7b"})

    def test_not_built_set_is_exactly_p1_p6_p8_p9_p10(self):
        v = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16), self.Z_OK)
        self.assertEqual(set(v.evidence["not_built_phases"]), {"p1", "p6", "p8", "p9", "p10"})

    def test_status_never_abstained_or_built_phase(self):
        v = fpm.evaluate(flat_rev(), series([1.0] * 16), series([1.0] * 16), self.Z_OK)
        self.assertNotIn(v.status, {"p3", "p6", "p7", "p7a", "p7b", "p8", "p9", "p10", "p1"})


class TestBindingAssertions(unittest.TestCase):
    Z_OK = measured(2.0)

    # T-BIND-1 — UNKNOWN never coerced to healthy
    def test_unknown_never_healthy(self):
        cases = [
            fpm.evaluate(flat_rev(), series([None] * 16), series([5.0] * 16), self.Z_OK),
            fpm.evaluate(flat_rev(), series([-100.0] * 16), series([None] * 16), self.Z_OK),
            fpm.evaluate(flat_rev(n=6), series([40.0] * 6), series([2.0] * 6), self.Z_OK),
        ]
        for v in cases:
            self.assertTrue(v.is_unknown)
            self.assertNotIn(v.status, {"p0", "p2", "p4", "p5"})
            self.assertNotIn(v.mode, {"GENUINE_BASELINE", "ENDURANCE", "SCAFFOLDING"})

    # T-BIND-2 — UNKNOWN never lands in P0 or GENUINE_BASELINE, by name
    def test_unknown_never_p0_or_genuine_baseline(self):
        v = fpm.evaluate(flat_rev(n=6), series([40.0] * 6), series([2.0] * 6), self.Z_OK)
        self.assertIsNone(v.phase)                  # never P0
        self.assertIsNot(v.mode, "GENUINE_BASELINE")
        v2 = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16),
                          missing("altman no_facts"))
        self.assertIsNone(v2.phase)
        self.assertIsNot(v2.mode, "GENUINE_BASELINE")

    # T-BIND-3 — three distinct UNKNOWN codes with distinct repair paths
    def test_three_unknown_codes(self):
        insuff = fpm.evaluate(flat_rev(n=6), series([40.0] * 6), series([2.0] * 6), self.Z_OK)
        self.assertEqual(insuff.status, UNKNOWN_INSUFFICIENT_HISTORY)
        flat_no_solv = fpm.evaluate(flat_rev(), series([40.0] * 16), series([2.0] * 16),
                                    missing("err"))
        self.assertEqual(flat_no_solv.status, UNKNOWN_ABSTAINED)
        # rhythm unmeasurable (a measured 0.0 revenue quarter) and no flow
        # signal -> falls through every release-1 detector -> NOT_BUILT
        odd_rev = series([100.0] * 12 + [0.0] + [100.0] * 3)
        nb = fpm.evaluate(odd_rev, series([40.0] * 16), series([2.0] * 16), self.Z_OK)
        self.assertEqual(nb.status, UNKNOWN_NOT_BUILT)
        self.assertIn("not built", nb.reason)


class TestIsolation(unittest.TestCase):
    # No coupling/context/board parameter exists, by construction
    def test_evaluate_signature_has_no_context(self):
        params = list(inspect.signature(fpm.evaluate).parameters.keys())
        banned = ("context", "polyvagal", "board", "domainphase", "ds")
        for p in params:
            self.assertNotIn(p.lower(), banned)
        self.assertEqual(
            params, ["revenue", "ocf", "cff", "solvency_z", "cost",
                     "end_quarter", "formula_version"])

    def test_module_imports_no_thing01_no_phase_engine(self):
        import financial_phase_map
        src_file = financial_phase_map.__file__
        with open(src_file, "r") as fh:
            src = fh.read()
        for banned in ("phase_engine", "thing1", "limen_backtest", "requests"):
            self.assertNotIn(banned, src)


class TestLockOnlyP2(unittest.TestCase):
    # Regression: margin-lock firing with an unmeasurable temporal dyad must
    # not crash the reason string (coh/amp are None on this path).
    Z_OK = measured(2.0)

    def test_lock_only_p2_no_crash(self):
        rev = series([100.0] * 8)  # only 8 quarters -> temporal dyad refuses (<12)
        cost = series([70.0] * 8)  # constant ratio -> cv 0 -> lock = 1.0
        ocf = series([30.0] * 8)
        cff = series([50.0] * 8)  # CFF > OCF: neither P4 nor P5 fires
        v = fpm.evaluate(rev, ocf, cff, self.Z_OK, cost=cost)
        self.assertEqual(v.phase, "p2")
        self.assertIn("margin lock", v.reason)
        self.assertNotIn("%", v.reason)


class TestPinnedConstants(unittest.TestCase):
    # Pinned to the cited research source (prove_p2.py:81-82, LIMEN_FOUR_LAYER.md:67-70)
    def test_constants_match_citations(self):
        self.assertEqual(fpm.TEMPORAL_COH, 0.5)
        self.assertEqual(fpm.TEMPORAL_AMP, 0.03)
        self.assertEqual(fpm.RELATIONAL_LOCK, 0.6)
        self.assertEqual(fpm.P4_CFF_PLUG_RATIO, 0.5)
        self.assertEqual(fpm.Z_SOLVENT, 1.1)
        self.assertEqual(fpm.WAS_WINDOW_QTRS, 16)
        self.assertEqual(fpm.MIN_MEASURED_QTRS, 12)


if __name__ == "__main__":
    unittest.main()
