#!/usr/bin/env python3
"""
mode_validate.py — validate the WAS-layer regulation-mode triad at scale.

The sharpest test: the SAME companies at DIFFERENT times must resolve to
DIFFERENT modes — COVID cruises/airlines = SCAFFOLDING at the 2021 trough (on
raised capital) and ENDURANCE now (recovered on own cash). Plus baseline
(never-distressed) and masking (P3 while solvent, pre-bankruptcy) cohorts.

Tests was.regulation_mode against labeled (company, cutoff, expected_mode).
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import was                            # noqa: E402

COHORT = [
    # BASELINE — healthy, never distressed (current)
    ("WMT",  "0000104169", None, "GENUINE-BASELINE"),
    ("KO",   "0000021344", None, "GENUINE-BASELINE"),
    ("PG",   "0000080424", None, "GENUINE-BASELINE"),
    ("JNJ",  "0000200406", None, "GENUINE-BASELINE"),
    ("COST", "0000909832", None, "GENUINE-BASELINE"),
    ("PEP",  "0000077476", None, "GENUINE-BASELINE"),
    # SCAFFOLDING — COVID survivors scored DURING the trough (on raised capital)
    ("CCL",  "0000815097", "2021-06-30", "SCAFFOLDING"),
    ("AAL",  "0000006201", "2021-03-31", "SCAFFOLDING"),
    ("NCLH", "0001513761", "2021-06-30", "SCAFFOLDING"),
    ("RCL",  "0000884887", "2021-06-30", "SCAFFOLDING"),
    ("UAL",  "0000100517", "2021-03-31", "SCAFFOLDING"),
    # ENDURANCE — the SAME survivors scored NOW (recovered on own cash)
    ("CCL",  "0000815097", None, "ENDURANCE"),
    ("AAL",  "0000006201", None, "ENDURANCE"),
    ("NCLH", "0001513761", None, "ENDURANCE"),
    ("RCL",  "0000884887", None, "ENDURANCE"),
    ("UAL",  "0000100517", None, "ENDURANCE"),
    # MASKING — pre-bankruptcy, P3 firing while presenting solvent
    ("BBBY", "0000886158", "2022-09-30", "MASKING"),
    ("JCP",  "0001166126", "2019-12-31", "MASKING"),
    ("PIR",  "0000278130", "2019-09-30", "MASKING"),
    ("PRTY", "0001592058", "2022-09-30", "MASKING"),
]

# masking resolves as MASKING or OVERT-DISTRESS (both = P3 active); accept either for the distress label
DISTRESS_OK = {"MASKING", "OVERT-DISTRESS"}


def main():
    rows = []
    print("WAS-layer regulation-mode validation\n")
    print("%-6s %-11s %-12s %-16s %s" % ("TICK", "cutoff", "expected", "got", ""))
    for (t, cik, cut, exp) in COHORT:
        facts = lb.fetch_sec_facts(cik)
        mode, walk, f = was.regulation_mode(facts, cut)
        ok = (mode == exp) or (exp == "MASKING" and mode in DISTRESS_OK)
        rows.append({"t": t, "exp": exp, "got": mode, "ok": ok})
        print("%-6s %-11s %-12s %-16s %s" % (t, str(cut or "current"), exp, mode, "OK" if ok else "MISS"))
        time.sleep(0.2)
    acc = sum(1 for r in rows if r["ok"]) / len(rows) if rows else 0
    print("\n=== WAS-layer triad ===")
    print("  accuracy %d/%d = %.2f" % (sum(1 for r in rows if r["ok"]), len(rows), acc))
    for exp in ("GENUINE-BASELINE", "SCAFFOLDING", "ENDURANCE", "MASKING"):
        sub = [r for r in rows if r["exp"] == exp]
        hit = sum(1 for r in sub if r["ok"])
        print("  %-12s %d/%d" % (exp, hit, len(sub)))
    print("\n  Temporal test (same co, different time): SCAFFOLDING@2021 vs ENDURANCE@now")
    for t in ("CCL", "AAL", "NCLH", "RCL", "UAL"):
        sc = next((r for r in rows if r["t"] == t and r["exp"] == "SCAFFOLDING"), None)
        en = next((r for r in rows if r["t"] == t and r["exp"] == "ENDURANCE"), None)
        if sc and en:
            print("    %-6s 2021:%-12s now:%-12s %s" % (
                t, sc["got"], en["got"], "DISTINCT" if sc["got"] != en["got"] else "same"))


if __name__ == "__main__":
    main()
