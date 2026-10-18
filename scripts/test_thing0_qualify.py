#!/usr/bin/env python3
"""Thing 0 qualification tests for THING0-QUALIFY-1.

Stdlib-only pure tests cover the qualification matrix and the absence of a
Thing 1 input. When the server dependencies are available, a guarded local
integration verifies that `_build_safe_packet` builds Thing 0 first and runs
Thing 1 only when Thing 0 permits it.

RUN: python scripts/test_thing0_qualify.py
"""

from __future__ import annotations

import inspect
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from python_runtime.helix_app import thing0  # noqa: E402

FAILURES = 0


def check(name, fn):
    global FAILURES
    try:
        fn()
        print("  pass: " + name)
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: " + name + " — " + str(exc))


def _qualified(**overrides):
    values = dict(
        is_financial=False,
        facts_present=True,
        present_count=4,
        required_count=4,
        history_quarters=8,
    )
    values.update(overrides)
    return thing0.qualify(**values)


def main():
    print("thing0 qualification")

    check("qualified: all required series and 8 quarters", lambda: _assert(
        _qualified(), "qualified", True, "ready"))

    check("partial: one required series missing", lambda: _assert(
        _qualified(present_count=3), "partially_qualified", False,
        "blocked_by_company_data", "one_or_more_required_series_incomplete"))

    check("partial: history below 8 quarters", lambda: _assert(
        _qualified(history_quarters=7), "partially_qualified", False,
        "blocked_by_company_data", "quarterly_history_below_full_envelope"))

    check("not qualified: financial institution", lambda: _assert(
        _qualified(is_financial=True), "not_qualified", False,
        "not_applicable", "financial_institution_requires_regime_2_adapter"))

    check("not qualified: no company facts", lambda: _assert(
        _qualified(facts_present=False), "not_qualified", False,
        "not_applicable", "sec_company_facts_or_required_series_unavailable"))

    check("not qualified: no required series", lambda: _assert(
        _qualified(present_count=0), "not_qualified", False,
        "not_applicable", "sec_company_facts_or_required_series_unavailable"))

    def no_thing1_input():
        params = inspect.signature(thing0.qualify).parameters
        forbidden = {"validated_signal", "validation_status", "fingerprint_status",
                     "alert", "thing1", "thing1_result"}
        present = forbidden.intersection(params)
        assert not present, "Thing 0 formula must not take Thing 1 inputs: " + str(present)
    check("formula has no Thing 1 input", no_thing1_input)

    def audit_categories():
        from python_runtime.helix_app.audit import reconciliation_log as rlog
        categories = rlog._t1_unsupported_categories([
            "thing0_not_permitted",
            "financial_institution_requires_regime_2_adapter",
            "one_or_more_required_series_incomplete",
            "quarterly_history_below_full_envelope",
            "sec_company_facts_or_required_series_unavailable",
            "extraction_error: SEC EDGAR fetch failed.",
        ])
        assert "thing0_not_permitted" in categories, categories
        assert "bank_adapter_required" in categories, categories
        assert "company_data_incomplete" in categories, categories
        assert "insufficient_data" in categories, categories
        assert "extraction_error" in categories, categories
        assert "other" not in categories, categories
    check("audit categories map Thing 0 refusal reasons", audit_categories)

    _local_packet_integration()

    print("")
    if FAILURES:
        print(f"{FAILURES} failure(s)")
        return 1
    print("thing0 qualification: all checks passed")
    return 0


def _assert(result, status, permits, execution, reason=None):
    assert result["qualification_status"] == status, result
    assert result["permits_thing1_use"] is permits, result
    assert result["thing1_execution_status"] == execution, result
    if reason:
        assert reason in result["reasons"], result


def _local_packet_integration():
    global FAILURES
    try:
        from python_runtime.helix_app import index as helix_index
    except Exception as exc:  # noqa: BLE001
        print("  SKIP: local packet integration (dependencies unavailable: "
              + type(exc).__name__ + ")")
        return

    def series(n):
        return {(2020, i): float(i) for i in range(1, n + 1)}

    rows = [{"quarter": (2020, i)} for i in range(1, 9)]
    full_data = {
        "Revenue": series(8), "OCF": series(8),
        "Cash": series(8), "Debt": series(8),
    }
    partial_data = {"Revenue": series(8)}

    calls = []

    def fake_score(**kwargs):
        calls.append(kwargs)
        return {
            "kernel_id": "limen_backtest.py",
            "kernel_runtime": "python-vercel",
            "kernel_version": None,
            "validation_status": "unavailable",
            "available": False,
            "alert": None,
            "first_alert_quarter": None,
            "distress_band": None,
            "recovered": None,
            "fingerprint_status": {},
            "narrative_safe": [],
            "unsupported_reasons": [],
        }

    old_score = helix_index.thing1_pkg.score_validated
    old_thing2 = helix_index._build_thing2_section
    old_reconciliation = helix_index._build_reconciliation
    old_masking = helix_index._masking_assessment
    helix_index.thing1_pkg.score_validated = fake_score
    helix_index._build_thing2_section = lambda **kwargs: {
        "available": False, "narrative_safe": [], "dominant_phase": None
    }
    helix_index._build_reconciliation = lambda v, t: {
        "primacy": "thing1", "agree": "indeterminate", "summary": "fixture",
        "action_authority": "none", "language_constraints": [],
    }
    helix_index._masking_assessment = lambda v, t: "unassessed"

    def packet(**overrides):
        values = dict(
            cik="0000000001",
            facts={"entityName": "Fixture"},
            sic=0,
            is_financial=False,
            company_data=full_data,
            result={},
            rows=rows,
            requested_report_type="partial_phase_snapshot",
            request_id="fixture",
        )
        values.update(overrides)
        return helix_index._build_safe_packet(**values)

    try:
        calls.clear()
        qualified = packet()
        assert qualified["thing0_eligibility"]["permits_thing1_use"] is True, qualified
        assert len(calls) == 1, "Thing 1 must run when Thing 0 permits it"
        assert qualified["validated_signal"]["validation_status"] == "unavailable", qualified
        # Thing 0 remains qualified even when Thing 1 returns unavailable.
        assert qualified["thing0_eligibility"]["qualification_status"] == "qualified", qualified
        assert qualified["thing0_eligibility"]["thing1_execution_status"] == "unavailable", qualified

        def fake_validated(**kwargs):
            calls.append(kwargs)
            return {
                "kernel_id": "limen_backtest.py",
                "kernel_runtime": "python-vercel",
                "kernel_version": None,
                "validation_status": "validated",
                "available": True,
                "alert": False,
                "first_alert_quarter": None,
                "distress_band": None,
                "recovered": None,
                "fingerprint_status": {},
                "narrative_safe": [],
                "unsupported_reasons": [],
            }

        helix_index.thing1_pkg.score_validated = fake_validated
        calls.clear()
        executed = packet()
        assert executed["thing0_eligibility"]["thing1_execution_status"] == "executed", executed
        assert executed["thing0_eligibility"]["permits_thing1_use"] is True, executed
        helix_index.thing1_pkg.score_validated = fake_score

        calls.clear()
        financial = packet(is_financial=True)
        assert financial["thing0_eligibility"]["permits_thing1_use"] is False, financial
        assert len(calls) == 0, "Thing 1 must not run when Thing 0 rejects a bank"
        assert financial["validated_signal"]["validation_status"] == "not_permitted_by_thing0", financial

        calls.clear()
        partial = packet(company_data=partial_data)
        assert partial["thing0_eligibility"]["permits_thing1_use"] is False, partial
        assert len(calls) == 0, "Thing 1 must not run without all required series"

        calls.clear()
        short_data = {key: series(7) for key in full_data}
        short = packet(company_data=short_data, rows=rows[:7])
        assert short["thing0_eligibility"]["permits_thing1_use"] is False, short
        assert len(calls) == 0, "Thing 1 must not run below the raw history floor"

        calls.clear()
        mixed_data = {
            "Revenue": series(8), "OCF": series(1),
            "Cash": series(1), "Debt": series(1),
        }
        mixed = packet(company_data=mixed_data)
        assert mixed["thing0_eligibility"]["permits_thing1_use"] is False, mixed
        assert mixed["thing0_eligibility"]["history_quarters"] == 1, mixed
        assert len(calls) == 0, "Thing 1 must not run without common coverage"

        import asyncio

        async def fake_facts(cik):
            return {"entityName": "Fixture"}

        async def fake_sic(cik):
            return 0

        def fail_pipeline(*args, **kwargs):
            raise RuntimeError("thing2 failure")

        old_fetch_facts = helix_index._fetch_sec_facts
        old_fetch_sic = helix_index._fetch_sic_code
        old_build = helix_index.build_company_data
        old_pipeline = helix_index.run_pipeline
        old_poly = helix_index._build_polyvagal_context_from_server
        old_audit_build = helix_index._build_audit_entry
        old_audit_emit = helix_index._emit_audit
        calls.clear()
        helix_index._fetch_sec_facts = fake_facts
        helix_index._fetch_sic_code = fake_sic
        helix_index.build_company_data = lambda facts, is_financial=False: full_data
        helix_index.run_pipeline = fail_pipeline
        helix_index._build_polyvagal_context_from_server = lambda cik, sic: None
        helix_index._build_audit_entry = lambda **kwargs: {}
        helix_index._emit_audit = lambda entry: None
        try:
            packet_fail = asyncio.run(
                helix_index._score_safe("0000000001", "partial_phase_snapshot")
            )
            assert packet_fail["thing0_eligibility"]["permits_thing1_use"] is True, packet_fail
            assert len(calls) == 1, "Thing 1 must run when Thing 2 fails after inputs are built"
            assert packet_fail["validated_signal"]["validation_status"] == "unavailable", packet_fail
            print("  pass: local Thing 2 failure does not suppress Thing 1")
        finally:
            helix_index._fetch_sec_facts = old_fetch_facts
            helix_index._fetch_sic_code = old_fetch_sic
            helix_index.build_company_data = old_build
            helix_index.run_pipeline = old_pipeline
            helix_index._build_polyvagal_context_from_server = old_poly
            helix_index._build_audit_entry = old_audit_build
            helix_index._emit_audit = old_audit_emit

        def fail_build(facts, is_financial=False):
            raise TypeError("malformed filed entry")

        old_thing0_inputs = helix_index._thing0_company_data_from_facts
        helix_index._fetch_sec_facts = fake_facts
        helix_index._fetch_sic_code = fake_sic
        helix_index.build_company_data = fail_build
        helix_index._thing0_company_data_from_facts = lambda facts: full_data
        helix_index.run_pipeline = lambda *a, **k: {"rows": []}
        helix_index._build_polyvagal_context_from_server = lambda cik, sic: None
        helix_index._build_audit_entry = lambda **kwargs: {}
        helix_index._emit_audit = lambda entry: None
        calls.clear()
        try:
            packet_build = asyncio.run(
                helix_index._score_safe("0000000001", "partial_phase_snapshot")
            )
            assert packet_build["thing0_eligibility"]["permits_thing1_use"] is True, packet_build
            assert len(calls) == 1, "Thing 1 must run when the Thing 2 input builder fails"
            assert packet_build["validated_signal"]["validation_status"] == "unavailable", packet_build
            print("  pass: local build_company_data failure does not suppress Thing 1")
        finally:
            helix_index._fetch_sec_facts = old_fetch_facts
            helix_index._fetch_sic_code = old_fetch_sic
            helix_index.build_company_data = old_build
            helix_index.run_pipeline = old_pipeline
            helix_index._build_polyvagal_context_from_server = old_poly
            helix_index._build_audit_entry = old_audit_build
            helix_index._emit_audit = old_audit_emit
            helix_index._thing0_company_data_from_facts = old_thing0_inputs

        async def fail_facts(cik):
            raise RuntimeError("SEC down")

        helix_index._fetch_sec_facts = fail_facts
        helix_index._fetch_sic_code = fake_sic
        helix_index.build_company_data = lambda facts, is_financial=False: {}
        helix_index.run_pipeline = lambda *a, **k: {"rows": []}
        helix_index._build_polyvagal_context_from_server = lambda cik, sic: None
        helix_index._build_audit_entry = lambda **kwargs: {}
        helix_index._emit_audit = lambda entry: None
        try:
            packet_extract = asyncio.run(
                helix_index._score_safe("0000000001", "partial_phase_snapshot")
            )
            refusal = packet_extract["validated_signal"]
            assert refusal["validation_status"] == "not_permitted_by_thing0", refusal
            assert "extraction_error: SEC EDGAR fetch failed." in refusal["unsupported_reasons"], refusal
            assert "Unable to retrieve SEC filings for this CIK." in refusal["narrative_safe"], refusal
            print("  pass: SEC extraction failure is preserved in the refusal")
        finally:
            helix_index._fetch_sec_facts = old_fetch_facts
            helix_index._fetch_sic_code = old_fetch_sic
            helix_index.build_company_data = old_build
            helix_index.run_pipeline = old_pipeline
            helix_index._build_polyvagal_context_from_server = old_poly
            helix_index._build_audit_entry = old_audit_build
            helix_index._emit_audit = old_audit_emit

        rec = old_reconciliation(
            {"validation_status": "not_permitted_by_thing0", "alert": None},
            {"available": False},
        )
        assert rec["action_authority"] == "none", rec
        assert "Thing 0" in rec["summary"], rec

        print("  pass: local packet integration (Thing 0 first, Thing 1 gated)")
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: local packet integration — " + str(exc)[:300])
    finally:
        helix_index.thing1_pkg.score_validated = old_score
        helix_index._build_thing2_section = old_thing2
        helix_index._build_reconciliation = old_reconciliation
        helix_index._masking_assessment = old_masking


if __name__ == "__main__":
    sys.exit(main())
