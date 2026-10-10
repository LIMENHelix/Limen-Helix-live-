"""
test_fpm_bridge.py — acceptance tests for the Stage 1 dead-code seam.

Runnable with any Python 3.9+:  python -m unittest discover -s tests
from python_runtime/helix_app/thing2/, or directly:
  python -m unittest tests.test_fpm_bridge

The bridge is NOT WIRED anywhere; these tests pin its contract so the
Stage 3 cutover cannot drift silently.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import financial_phase_map as fpm  # noqa: E402
from evidence import UNKNOWN_INSUFFICIENT_HISTORY  # noqa: E402
from fpm_bridge import build_fpm_section  # noqa: E402


def series(values, start_year=2019, start_q=1):
    """values: list of numbers or None -> {quarter: value|None} (plain)."""
    out = {}
    y, n = start_year, start_q
    for v in values:
        out["%dQ%d" % (y, n)] = v
        n += 1
        if n > 4:
            n, y = 1, y + 1
    return out


FLAT_REV = series([100.0] * 16)          # 2019Q1..2022Q4, zero seasonal amplitude
POS_OCF = series([10.0] * 16)
SMALL_CFF = series([2.0] * 16)
NEG_OCF = series([-10.0] * 16)
PLUG_CFF = series([10.0] * 16)


class TestBridgeDefinitionalPhases(unittest.TestCase):
    def test_flat_solvent_reads_p0_source(self):
        s = build_fpm_section(revenue=FLAT_REV, ocf=POS_OCF, cff=SMALL_CFF,
                              solvency_z=2.0)
        self.assertEqual(s["dominant_phase"], "p0")
        self.assertEqual(s["phase_title"], "P0 Source")
        self.assertEqual(s["phase_mode"], "GENUINE_BASELINE")
        self.assertEqual(s["unsupported_reasons"], [])
        self.assertFalse(s["reading"]["is_unknown"] if "is_unknown" in s["reading"]
                         else s["reading"]["status"] in
                         (UNKNOWN_INSUFFICIENT_HISTORY,))

    def test_scaffold_fires_p4(self):
        s = build_fpm_section(revenue=FLAT_REV, ocf=NEG_OCF, cff=PLUG_CFF,
                              solvency_z=0.5)
        self.assertEqual(s["dominant_phase"], "p4")
        self.assertEqual(s["phase_title"], "P4 Scaffolding")
        self.assertEqual(s["phase_mode"], "SCAFFOLDING")

    def test_missing_cff_blocks_flow_phases(self):
        # Missing never reads healthy: no CFF -> P4/P5 unevaluable -> UNKNOWN.
        s = build_fpm_section(revenue=FLAT_REV, ocf=POS_OCF, cff=None,
                              solvency_z=2.0)
        self.assertIsNone(s["dominant_phase"])
        self.assertEqual(s["phase_title"], "UNKNOWN")
        self.assertEqual(s["reading"]["status"], UNKNOWN_INSUFFICIENT_HISTORY)


class TestBridgeUnknownSemantics(unittest.TestCase):
    def test_unknown_never_promotes(self):
        s = build_fpm_section(revenue=series([100.0] * 5), ocf=POS_OCF,
                              cff=SMALL_CFF, solvency_z=2.0)
        self.assertIsNone(s["dominant_phase"])
        self.assertEqual(s["phase_title"], "UNKNOWN")
        self.assertIsNone(s["phase_state_label"])
        self.assertEqual(len(s["unsupported_reasons"]), 1)

    def test_interior_gap_is_unknown(self):
        rev = series([100.0] * 16)
        rev["2020Q2"] = None
        s = build_fpm_section(revenue=rev, ocf=POS_OCF, cff=SMALL_CFF,
                              solvency_z=2.0)
        self.assertIsNone(s["dominant_phase"])
        self.assertEqual(s["reading"]["status"], UNKNOWN_INSUFFICIENT_HISTORY)
        self.assertIn("2020Q2", s["unsupported_reasons"][0])


class TestBridgeStandingRules(unittest.TestCase):
    def test_no_alert_no_validation(self):
        for s in (
            build_fpm_section(revenue=FLAT_REV, ocf=POS_OCF, cff=SMALL_CFF, solvency_z=2.0),
            build_fpm_section(revenue=FLAT_REV, ocf=NEG_OCF, cff=PLUG_CFF, solvency_z=0.5),
            build_fpm_section(revenue=series([100.0] * 5), ocf=POS_OCF, cff=SMALL_CFF, solvency_z=2.0),
        ):
            self.assertNotIn("alert", s)
            self.assertNotEqual(s["validation_status"], "validated")
            self.assertTrue(s["interpretive_only"])
            self.assertEqual(s["verification_status"], "not_run")
            self.assertEqual(s["kernel_version"], fpm.FORMULA_VERSION)
            self.assertEqual(s["kernel_id"], "financial_phase_map.py")
            self.assertIn(s["dominant_phase"], (None, "p0", "p2", "p4", "p5"))

    def test_no_synthetic_score_vector(self):
        s = build_fpm_section(revenue=FLAT_REV, ocf=POS_OCF, cff=SMALL_CFF,
                              solvency_z=2.0)
        self.assertEqual(s["phase_scores"], {})


if __name__ == "__main__":
    unittest.main()
