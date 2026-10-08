"""
test_sec_adapter.py — adapter contract tests (synthetic companyfacts).

Run from python_runtime/helix_app/thing2/:
  python -m unittest discover -s tests -v
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evidence import MISSING, UNKNOWN_INSUFFICIENT_HISTORY  # noqa: E402
import sec_adapter  # noqa: E402


def ytd_entry(start, end, filed, val, form="10-Q"):
    return {"start": start, "end": end, "filed": filed, "val": val, "form": form}


def synthetic_facts():
    """FY2024 quarterly YTD flows -> decumulated 100/130/160/150 revenue."""
    rev = [
        ytd_entry("2024-01-01", "2024-03-31", "2024-04-15", 100),
        ytd_entry("2024-01-01", "2024-06-30", "2024-07-15", 230),
        ytd_entry("2024-01-01", "2024-09-30", "2024-10-15", 390),
        ytd_entry("2024-01-01", "2024-12-31", "2025-02-15", 540, form="10-K"),
    ]
    ocf = [
        ytd_entry("2024-01-01", "2024-03-31", "2024-04-15", 10),
        ytd_entry("2024-01-01", "2024-06-30", "2024-07-15", 30),
        ytd_entry("2024-01-01", "2024-09-30", "2024-10-15", 60),
        ytd_entry("2024-01-01", "2024-12-31", "2025-02-15", 80, form="10-K"),
    ]
    cff = [
        ytd_entry("2024-01-01", "2024-03-31", "2024-04-15", 50),
        ytd_entry("2024-01-01", "2024-06-30", "2024-07-15", 90),
        ytd_entry("2024-01-01", "2024-09-30", "2024-10-15", 120),
        ytd_entry("2024-01-01", "2024-12-31", "2025-02-15", 140, form="10-K"),
    ]
    return {"facts": {"us-gaap": {
        "RevenueFromContractWithCustomerExcludingAssessedTax":
            {"units": {"USD": rev}},
        "NetCashProvidedByUsedInOperatingActivities":
            {"units": {"USD": ocf}},
        "NetCashProvidedByUsedInFinancingActivities":
            {"units": {"USD": cff}},
    }}}


class TestAdapter(unittest.TestCase):
    def test_decumulation_full_year(self):
        inp = sec_adapter.build_inputs(synthetic_facts(), "2025-03-01")
        self.assertEqual([inp["revenue"][q].value for q in
                          ("2024Q1", "2024Q2", "2024Q3", "2024Q4")],
                         [100.0, 130.0, 160.0, 150.0])
        self.assertEqual(inp["end_quarter"], "2024Q4")
        self.assertEqual(len(inp["ocf"]), 4)
        self.assertEqual(len(inp["cff"]), 4)

    def test_point_in_time_cutoff(self):
        inp = sec_adapter.build_inputs(synthetic_facts(), "2024-08-01")
        self.assertEqual(sorted(inp["revenue"]), ["2024Q1", "2024Q2"])
        self.assertEqual(inp["end_quarter"], "2024Q2")

    def test_altman_error_is_missing_never_solvent(self):
        inp = sec_adapter.build_inputs(synthetic_facts(), "2025-03-01")
        # no Assets/liability tags -> Altman cannot compute
        self.assertEqual(inp["solvency_z"].kind, MISSING)
        self.assertIn("altman", inp["solvency_z"].note)

    def test_sentinel_empty_facts(self):
        v = sec_adapter.evaluate_company({}, "2025-03-01")
        self.assertEqual(v.status, UNKNOWN_INSUFFICIENT_HISTORY)
        self.assertIsNone(v.phase)

    def test_provenance_counts(self):
        inp = sec_adapter.build_inputs(synthetic_facts(), "2025-03-01")
        self.assertEqual(inp["provenance"]["quarters"]["revenue"], 4)
        self.assertEqual(inp["provenance"]["cutoff"], "2025-03-01")


if __name__ == "__main__":
    unittest.main()
