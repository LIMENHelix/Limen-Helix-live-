"""Thing 0 qualification formula.

Thing 0 decides whether a company's identity, sector, history, and required SEC
series qualify it for Thing 1. This module deliberately has no Thing 1 input:
qualification must be established before Thing 1 runs, not inferred from a
Thing 1 result. The qualification rules and eligibility boundaries here are the
existing Thing 0 rules; this module does not add or broaden eligibility.

Sector rules are NOT reconciled here. Two released consumers classify "financial"
differently:

  * the sectioned report treats every SIC 6000-6999 filer as financial;
  * the flat scorer treats only SIC 6000 and 6020-6099 as deposit-funded banks.

Each caller passes its own rule id so the response can show which rule was
applied and whether the other released rule would have disagreed. No caller is
silently switched to the other rule.
"""

from __future__ import annotations

REQUIRED_SERIES = ("Revenue", "OCF", "Cash", "Debt")

# ── Sector rules (existing, deliberately not reconciled) ───────────────────
SECTOR_RULE_SECTIONED_REPORT = "sectioned_report_sic_6000_6999"
SECTOR_RULE_FLAT_SCORER = "flat_scorer_depository_bank_sic_6000_or_6020_6099"

SECTOR_RULES = {
    SECTOR_RULE_SECTIONED_REPORT: {
        "id": SECTOR_RULE_SECTIONED_REPORT,
        "consumer": "POST /api/helix/helix-report/score",
        "financial_sic": "6000-6999",
    },
    SECTOR_RULE_FLAT_SCORER: {
        "id": SECTOR_RULE_FLAT_SCORER,
        "consumer": "POST /api/limen/score",
        "financial_sic": "6000 or 6020-6099",
    },
}


def is_financial_sectioned_report(sic: int) -> bool:
    """Sectioned-report bank/sector gate: every SIC 6000-6999 is financial."""
    try:
        return 6000 <= int(sic) <= 6999
    except (TypeError, ValueError):
        return False


def is_financial_depository_bank(sic: int) -> bool:
    """Flat-scorer bank gate: SIC 6000 or 6020-6099 only.

    Brokers (6211), insurers (6311), real estate (6512) and REITs (6798) are
    outside this narrow deposit-funded gate and are scored as non-financial.
    """
    try:
        value = int(sic)
    except (TypeError, ValueError):
        return False
    return bool(value and (value == 6000 or 6020 <= value <= 6099))


def sector_is_known(sic) -> bool:
    """True only for a real SEC SIC code.

    `_fetch_sic` returns 0 when the submissions lookup fails. Zero and None are
    UNKNOWN, not a non-financial classification: the sector gate could not run.
    """
    try:
        return int(sic) > 0
    except (TypeError, ValueError):
        return False


def sector_provenance(
    rule_id: str,
    sic: int,
    is_financial: bool,
    sector_known: bool | None = None,
) -> dict:
    """Record the applied sector rule and whether the other rule disagrees.

    This is provenance, not a new qualification rule. `reconciled` stays False
    because the owner-directed packet forbids silently merging the two rules.
    """
    rule = SECTOR_RULES.get(rule_id) or {"id": rule_id, "consumer": None}
    try:
        sic_value = int(sic)
    except (TypeError, ValueError):
        sic_value = 0
    if sector_known is None:
        sector_known = sector_is_known(sic_value)
    alternate_id = (
        SECTOR_RULE_FLAT_SCORER
        if rule_id == SECTOR_RULE_SECTIONED_REPORT
        else SECTOR_RULE_SECTIONED_REPORT
    )
    if alternate_id == SECTOR_RULE_FLAT_SCORER:
        alternate_financial = is_financial_depository_bank(sic_value)
    else:
        alternate_financial = is_financial_sectioned_report(sic_value)
    return {
        "id": rule.get("id"),
        "consumer": rule.get("consumer"),
        "financial_sic": rule.get("financial_sic"),
        "sic": sic_value,
        "sector_known": bool(sector_known),
        "classified_financial": bool(is_financial),
        "alternate_rule_id": alternate_id,
        "alternate_classified_financial": bool(alternate_financial),
        "agrees_with_alternate_rule": bool(alternate_financial) == bool(is_financial),
        "reconciled": False,
    }


def required_presence(company_data: dict) -> dict:
    """Presence of each required series, using the released Thing 0 inputs."""
    data = company_data or {}
    return {key: bool(data.get(key)) for key in REQUIRED_SERIES}


def common_history_quarters(company_data: dict) -> int:
    """Count quarter IDs shared by ALL required series.

    Coverage is the intersection, not the minimum series length: four series
    that each carry eight entries but no common quarter have zero aligned
    history and cannot satisfy the eight-quarter floor.
    """
    data = company_data or {}
    quarter_sets = []
    for key in REQUIRED_SERIES:
        series = data.get(key) or {}
        try:
            quarter_sets.append(set(series.keys()))
        except Exception:
            quarter_sets.append(set())
    if not quarter_sets:
        return 0
    return len(set.intersection(*quarter_sets))


def from_company_data(
    company_data: dict,
    is_financial: bool,
    facts_present: bool,
    sic: int = 0,
    sector_rule_id: str | None = None,
    sector_known: bool | None = None,
) -> dict:
    """Qualification from extracted company series, preserving the released rules."""
    required = required_presence(company_data)
    present_count = sum(1 for value in required.values() if value)
    history_quarters = common_history_quarters(company_data)
    if sector_known is None:
        sector_known = sector_is_known(sic)
    provenance = (
        sector_provenance(sector_rule_id, sic, is_financial, sector_known=sector_known)
        if sector_rule_id
        else None
    )
    result = qualify(
        is_financial=is_financial,
        facts_present=facts_present,
        present_count=present_count,
        required_count=len(required),
        history_quarters=history_quarters,
        sector_rule=provenance,
        sector_known=sector_known,
    )
    result["history_quarters"] = history_quarters
    result["required_input_presence"] = required
    result["required_inputs_present"] = present_count
    result["required_inputs_total"] = len(required)
    return result


def qualify(
    is_financial: bool,
    facts_present: bool,
    present_count: int,
    required_count: int,
    history_quarters: int,
    sector_rule: dict | None = None,
    sector_known: bool = True,
) -> dict:
    """Return the Thing 0 qualification for a company.

    Inputs are company-level facts only. There is no validated_signal,
    fingerprint, alert or other Thing 1 parameter. `sector_known=False` means
    the SIC lookup failed: the sector gate could not run, so the company is
    partially qualified and Thing 1 is not permitted. Unknown is not permission.
    """
    reasons: list[str] = []

    if is_financial:
        qualification = "not_qualified"
        reasons.append("financial_institution_requires_regime_2_adapter")
    elif not facts_present or present_count == 0:
        qualification = "not_qualified"
        reasons.append("sec_company_facts_or_required_series_unavailable")
    elif not sector_known:
        qualification = "partially_qualified"
        reasons.append("sector_lookup_unavailable")
        if present_count < required_count:
            reasons.append("one_or_more_required_series_incomplete")
        if history_quarters < 8:
            reasons.append("quarterly_history_below_full_envelope")
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

    result = {
        "qualification_status": qualification,
        "thing1_execution_status": execution_status,
        "permits_thing1_use": permits,
        "sector_known": bool(sector_known),
        "history_requirement": (
            "met" if history_quarters >= 8
            else "partial" if history_quarters >= 4
            else "not_met"
        ),
        "reasons": reasons,
    }
    if sector_rule is not None:
        result["sector_rule"] = sector_rule
    return result
