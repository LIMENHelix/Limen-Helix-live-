"""
sec_adapter.py — SEC companyfacts -> financial_phase_map inputs (release 1).

Contract (SHADOW_PREREGISTRATION v1.1 §8.3, adapted to decision 9.14(c)):
- as_of = latest quarter with a Revenue observation on or before the cutoff
- extraction = the research point-in-time de-cumulation (flows.decumulate,
  filed <= cutoff) — the SAME extraction the validated research kernels use,
  because D23 showed the extraction frame dominates outcomes
- research sentinels ("no flows", "no df", "err") become MISSING — never
  False, never 0
- Altman errors become MISSING solvency — never "solvent" (ledger D13)

Import coupling (disclosed): reuses research extraction code in
scripts/kernel-validation and TAG_MAP from the locked Thing 1 module,
read-only. No Thing 0 / Thing 1 / phase_engine SCORING code is called here.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", ".."))
_THING1 = os.path.join(_REPO_ROOT, "python_runtime", "helix_app", "thing1")
_KVAL = os.path.join(_REPO_ROOT, "scripts", "kernel-validation")
for _p in (_THING1, _KVAL):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import limen_backtest as lb          # noqa: E402  (read-only: TAG_MAP, date helpers)
import flows                         # noqa: E402  (research extraction)
import altman                        # noqa: E402  (research solvency)
from prove_p2 import COST_TAGS       # noqa: E402

from evidence import measured, missing, Availability  # noqa: E402


def _q_label(yq):
    return "%dQ%d" % (yq[0], yq[1])


def _to_avail(decumulated, note):
    """{(year,q): val} -> {'yQq': Availability}; empty -> {} (caller maps to MISSING)."""
    out = {}
    for yq in sorted(decumulated):
        out[_q_label(yq)] = measured(decumulated[yq])
    return out


def build_inputs(facts, cutoff):
    """Build financial_phase_map.evaluate() inputs from SEC companyfacts.

    facts: parsed companyfacts JSON (dict). cutoff: 'YYYY-MM-DD' string.
    Returns a dict:
      revenue/ocf/cff/cost: {'yQq': Availability} (measured quarters only)
      solvency_z: Availability (MEASURED Z'' or MISSING with the Altman error)
      end_quarter: as_of quarter label
      provenance: extraction counts + as_of rule
    """
    rev_d = flows.decumulate(facts, lb.TAG_MAP["Revenue"], cutoff)
    ocf_d = flows.decumulate(facts, lb.TAG_MAP["OCF"], cutoff)
    cff_d = flows.decumulate(facts, flows.CFF_TAGS, cutoff)
    cost_d = flows.decumulate(facts, COST_TAGS, cutoff)

    revenue = _to_avail(rev_d, "revenue")
    ocf = _to_avail(ocf_d, "ocf")
    cff = _to_avail(cff_d, "cff")
    cost = _to_avail(cost_d, "cost")

    if revenue:
        as_of_yq = max(rev_d)
        end_quarter = _q_label(as_of_yq)
        # align every series to the as_of quarter (PIT: nothing past as_of)
        for series in (revenue, ocf, cff, cost):
            for label in list(series):
                y, n = label.split("Q")
                if (int(y), int(n)) > as_of_yq:
                    del series[label]
    else:
        end_quarter = None

    z = altman.z_from_facts(facts, cutoff)
    if isinstance(z, dict) and z.get("error"):
        solvency_z = missing("altman: %s" % z["error"])
    elif isinstance(z, dict) and z.get("Z") is not None:
        solvency_z = measured(z["Z"])
    else:
        solvency_z = missing("altman: no result")

    return {
        "revenue": revenue,
        "ocf": ocf,
        "cff": cff,
        "cost": cost,
        "solvency_z": solvency_z,
        "end_quarter": end_quarter,
        "provenance": {
            "as_of_rule": "latest measured revenue quarter on or before cutoff",
            "cutoff": cutoff,
            "quarters": {"revenue": len(rev_d), "ocf": len(ocf_d),
                         "cff": len(cff_d), "cost": len(cost_d)},
            "extraction": "scripts/kernel-validation/flows.decumulate (point-in-time, filed<=cutoff)",
        },
    }


def evaluate_company(facts, cutoff, formula_version=None):
    """Convenience: adapter + decision layer in one call."""
    import financial_phase_map as fpm
    inputs = build_inputs(facts, cutoff)
    kwargs = {}
    if formula_version:
        kwargs["formula_version"] = formula_version
    return fpm.evaluate(
        inputs["revenue"], inputs["ocf"], inputs["cff"],
        inputs["solvency_z"], cost=inputs["cost"] or None,
        end_quarter=inputs["end_quarter"], **kwargs)
