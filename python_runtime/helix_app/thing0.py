"""Thing 0 qualification formula.

Thing 0 decides whether a company's identity, sector, history, and required SEC
series qualify it for Thing 1. This module deliberately has no Thing 1 input:
qualification must be established before Thing 1 runs, not inferred from a
Thing 1 result. The qualification rules and eligibility boundaries here are the
existing Thing 0 rules; this module does not add or broaden eligibility.
"""

from __future__ import annotations


def qualify(
    is_financial: bool,
    facts_present: bool,
    present_count: int,
    required_count: int,
    history_quarters: int,
) -> dict:
    """Return the Thing 0 qualification for a company.

    Inputs are company-level facts only. There is no validated_signal,
    fingerprint, alert or other Thing 1 parameter.
    """
    reasons: list[str] = []

    if is_financial:
        qualification = "not_qualified"
        reasons.append("financial_institution_requires_regime_2_adapter")
    elif not facts_present or present_count == 0:
        qualification = "not_qualified"
        reasons.append("sec_company_facts_or_required_series_unavailable")
    elif present_count == required_count and history_quarters >= 8:
        qualification = "qualified"
        reasons.append("non_financial_required_series_and_history_present")
    else:
        qualification = "partially_qualified"
        if present_count < required_count:
            reasons.append("one_or_more_required_series_incomplete")
        if history_quarters < 8:
            reasons.append("quarterly_history_below_full_envelope")

    permits = qualification == "qualified"
    if permits:
        execution_status = "ready"
    elif qualification == "partially_qualified":
        execution_status = "blocked_by_company_data"
    else:
        execution_status = "not_applicable"

    return {
        "qualification_status": qualification,
        "thing1_execution_status": execution_status,
        "permits_thing1_use": permits,
        "history_requirement": (
            "met" if history_quarters >= 8
            else "partial" if history_quarters >= 4
            else "not_met"
        ),
        "reasons": reasons,
    }
