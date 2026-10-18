#!/usr/bin/env python3
"""Thing 0 connection tests for THING0-CONNECT-1.

Covers:
  * the released qualification formula from extracted company series;
  * explicit, unreconciled sector-rule provenance;
  * the flat scorer qualifying BEFORE any Thing 1 computation and refusing
    without running the kernel.

RUN: python scripts/test_thing0_connect.py
"""

from __future__ import annotations

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
        print("  FAIL: " + name + " — " + str(exc)[:300])


def series(n=8):
    return {(2020, i): float(i) for i in range(1, n + 1)}


def full_data(n=8):
    return {key: series(n) for key in thing0.REQUIRED_SERIES}


def main():
    print("thing0 connection")

    check("qualified from all required series and common history", lambda: _assert(
        thing0.from_company_data(full_data(), is_financial=False, facts_present=True),
        "qualified", True))

    check("partial when one required series is short", lambda: _assert(
        thing0.from_company_data(
            {**full_data(), "OCF": series(3)},
            is_financial=False, facts_present=True),
        "partially_qualified", False))

    check("partial when common history is below 8", lambda: _assert(
        thing0.from_company_data(full_data(7), is_financial=False, facts_present=True),
        "partially_qualified", False))

    check("not qualified with no facts", lambda: _assert(
        thing0.from_company_data({}, is_financial=False, facts_present=False),
        "not_qualified", False))

    check("history counts aligned quarter IDs, not minimum lengths", _common_history)

    check("flat rule: only 6000 and 6020-6099 are deposit-funded banks", _flat_rule)

    check("sectioned rule: every SIC 6000-6999 is financial", _sectioned_rule)

    check("sector disagreement is exposed, not reconciled", _sector_disagreement)

    check("flat scorer qualifies before Thing 1 and refuses without the kernel",
          _flat_scorer_refusal)

    check("flat scorer exposes the 6211 sector disagreement on a qualified run",
          _flat_scorer_sector_conflict)

    print("")
    if FAILURES:
        print(f"{FAILURES} failure(s)")
        return 1
    print("thing0 connection: all checks passed")
    return 0


def _assert(result, status, permits):
    assert result["qualification_status"] == status, result
    assert result["permits_thing1_use"] is permits, result


def _common_history():
    # Eight aligned quarters qualify.
    aligned = {key: series(8) for key in thing0.REQUIRED_SERIES}
    assert thing0.common_history_quarters(aligned) == 8, aligned
    result = thing0.from_company_data(
        aligned, is_financial=False, facts_present=True)
    assert result["history_quarters"] == 8, result
    assert result["qualification_status"] == "qualified", result

    # Eight entries per series but zero shared quarters: no aligned history.
    disjoint = {}
    for index, key in enumerate(thing0.REQUIRED_SERIES):
        disjoint[key] = {(2000 + index * 10, q): float(q) for q in range(1, 9)}
    assert thing0.common_history_quarters(disjoint) == 0, disjoint
    result = thing0.from_company_data(
        disjoint, is_financial=False, facts_present=True)
    assert result["history_quarters"] == 0, result
    assert result["permits_thing1_use"] is False, result
    assert result["qualification_status"] == "partially_qualified", result

    # Fewer than eight shared quarters: below the floor.
    shared = {key: series(7) for key in thing0.REQUIRED_SERIES}
    assert thing0.common_history_quarters(shared) == 7, shared
    result = thing0.from_company_data(
        shared, is_financial=False, facts_present=True)
    assert result["permits_thing1_use"] is False, result

    # One long series must not mask partial overlap in another.
    partial = {
        "Revenue": series(12),
        "OCF": series(8),
        "Cash": series(9),
        "Debt": series(10),
    }
    assert thing0.common_history_quarters(partial) == 8, partial
    result = thing0.from_company_data(
        partial, is_financial=False, facts_present=True)
    assert result["history_quarters"] == 8, result
    assert result["qualification_status"] == "qualified", result


def _flat_rule():
    assert thing0.is_financial_depository_bank(6000) is True
    assert thing0.is_financial_depository_bank(6020) is True
    assert thing0.is_financial_depository_bank(6099) is True
    for sic in (6019, 6100, 6211, 6311, 6512, 6798, 6999, 0, None, "bad"):
        assert thing0.is_financial_depository_bank(sic) is False, sic


def _sectioned_rule():
    for sic in (6000, 6019, 6020, 6099, 6211, 6311, 6512, 6798, 6999):
        assert thing0.is_financial_sectioned_report(sic) is True, sic
    for sic in (5999, 7000, 0, None, "bad"):
        assert thing0.is_financial_sectioned_report(sic) is False, sic


def _sector_disagreement():
    for sic in (6211, 6311, 6512, 6798):
        provenance = thing0.sector_provenance(
            thing0.SECTOR_RULE_FLAT_SCORER, sic, is_financial=False)
        assert provenance["agrees_with_alternate_rule"] is False, provenance
        assert provenance["alternate_classified_financial"] is True, provenance
        assert provenance["reconciled"] is False, provenance
    for sic in (6000, 6020, 6099, 2911, 7000):
        flat = thing0.is_financial_depository_bank(sic)
        provenance = thing0.sector_provenance(
            thing0.SECTOR_RULE_FLAT_SCORER, sic, is_financial=flat)
        assert provenance["agrees_with_alternate_rule"] is True, provenance


def _flat_scorer_refusal():
    try:
        import pandas  # noqa: F401
        from python_runtime import limen_app
    except Exception as exc:  # noqa: BLE001
        print("  SKIP: flat scorer integration (dependencies unavailable: "
              + type(exc).__name__ + ")")
        return

    state = _patch_flat_scorer(limen_app, sic=6000)
    try:
        response = limen_app.score(limen_app.ScoreRequest(cik="0000000001"))
        assert response["validation_status"] == "not_permitted_by_thing0", response
        assert response["thing0_eligibility"]["permits_thing1_use"] is False, response
        assert response["thing0_eligibility"]["reasons"] == [
            "financial_institution_requires_regime_2_adapter"], response
        assert state["kernel_calls"] == 0, "kernel ran for a Thing 0 refusal"
        assert response["alert"] is False and response["alert_authorized"] is False, response
        assert response["dominant_phase"] is None, response
        assert response["input_presence"]["revenue_quarters"] == 8, response
    finally:
        _restore_flat_scorer(limen_app, state)


def _flat_scorer_sector_conflict():
    try:
        import pandas  # noqa: F401
        from python_runtime import limen_app
    except Exception as exc:  # noqa: BLE001
        print("  SKIP: flat scorer integration (dependencies unavailable: "
              + type(exc).__name__ + ")")
        return

    state = _patch_flat_scorer(limen_app, sic=6211)
    try:
        response = limen_app.score(limen_app.ScoreRequest(cik="0000000001"))
        eligible = response["thing0_eligibility"]
        assert eligible["permits_thing1_use"] is True, response
        assert eligible["thing1_execution_status"] == "executed", response
        rule = eligible["sector_rule"]
        assert rule["id"] == thing0.SECTOR_RULE_FLAT_SCORER, rule
        assert rule["classified_financial"] is False, rule
        assert rule["alternate_rule_id"] == thing0.SECTOR_RULE_SECTIONED_REPORT, rule
        assert rule["alternate_classified_financial"] is True, rule
        assert rule["agrees_with_alternate_rule"] is False, rule
        assert rule["reconciled"] is False, rule
        assert state["kernel_calls"] == 1, "kernel must run once when Thing 0 permits"
    finally:
        _restore_flat_scorer(limen_app, state)


def _patch_flat_scorer(limen_app, sic):
    import pandas as pd

    def eight():
        return {(2020, i): float(i) for i in range(1, 9)}

    facts = {key: eight() for key in ("Revenue", "OCF", "Cash", "DebtCurrent")}
    facts["DebtLong"] = {}
    facts["entityName"] = "Fixture"

    rows = []
    for _ in range(8):
        row = {
            "quarter": (2026, 3), "p3": 0.1, "recovered": False,
            "stress_accum": 0.2, "var_Revenue": 0.0, "slope_Revenue": 0.0,
            "slope_OCF": 0.0, "Cash": 1.0, "Debt": 1.0, "runway": 4.0,
        }
        for phase in ("p0", "p1", "p2", "p3", "p4", "p5", "p6",
                      "p7", "p7a", "p7b", "p8", "p9", "p10"):
            row[phase] = 0.0
        rows.append(row)
    frame = pd.DataFrame(rows)

    saved = {
        "api_key": limen_app._fred.api_key,
        "fetch_sec_facts": limen_app.lbt.fetch_sec_facts,
        "fetch_sic": limen_app._fetch_sic,
        "extract": limen_app.lbt.extract_quarterly_series,
        "fingerprint": limen_app._thing1.fingerprint_status,
        "fetch_fred": limen_app._fetch_fred_quiet,
        "features": limen_app.lbt.compute_all_features,
        "phases": limen_app.lbt.score_all_phases,
        "trajectory": limen_app.lbt.analyse_trajectory,
        "composite": limen_app.lbt.compute_composite_score,
    }
    state = {"saved": saved, "kernel_calls": 0}

    limen_app._fred.api_key = lambda: "fixture"
    limen_app.lbt.fetch_sec_facts = lambda cik: dict(facts)
    limen_app._fetch_sic = lambda cik: sic
    limen_app.lbt.extract_quarterly_series = (
        lambda data, tags, name, is_flow=False: dict(data.get(name, {})))
    limen_app._thing1.fingerprint_status = lambda: {
        "state": "match", "validation_evidence_present": True,
        "kernel_sha256": "fixture", "lock_sha256": "fixture",
    }
    limen_app._fetch_fred_quiet = lambda: {"ok": True, "delta": {}}

    def features(data, fred_delta):
        state["kernel_calls"] += 1
        return frame.copy()

    limen_app.lbt.compute_all_features = features
    limen_app.lbt.score_all_phases = lambda df: df
    limen_app.lbt.analyse_trajectory = lambda df: df
    limen_app.lbt.compute_composite_score = (
        lambda df, event_str=None, p3_entry=0: (
            0.1, None, {"path_a": 0.0, "path_b": 0.0, "path_c": 0.0}))
    return state


def _restore_flat_scorer(limen_app, state):
    saved = state["saved"]
    limen_app._fred.api_key = saved["api_key"]
    limen_app.lbt.fetch_sec_facts = saved["fetch_sec_facts"]
    limen_app._fetch_sic = saved["fetch_sic"]
    limen_app.lbt.extract_quarterly_series = saved["extract"]
    limen_app._thing1.fingerprint_status = saved["fingerprint"]
    limen_app._fetch_fred_quiet = saved["fetch_fred"]
    limen_app.lbt.compute_all_features = saved["features"]
    limen_app.lbt.score_all_phases = saved["phases"]
    limen_app.lbt.analyse_trajectory = saved["trajectory"]
    limen_app.lbt.compute_composite_score = saved["composite"]


if __name__ == "__main__":
    sys.exit(main())
