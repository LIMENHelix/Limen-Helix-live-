#!/usr/bin/env python3
"""
PROVE P8 — Conscience / Reflective Feedback (book verbiage).

Book I P8 = the system OBSERVES and CORRECTS itself: R(R); "feedback-informed
modulation that alters recursive behavior in real time"; "the error (untruth) is
detected and signals are sent to correct it" -- a negative-feedback correction phase.

Translation: ACTIVE SELF-CORRECTION = deleveraging / paying down debt to repair the
balance sheet after a stressed or levered period. Distinct from:
  - P6 (order): returns capital via BUYBACKS (shareholder reward), debt ~stable
  - P4 (scaffold): TAKING ON debt
  - P5 (endurance): self-funding, debt ~stable
P8 = debt actively DECLINING (the system fixing itself). Was-dependent (follows a
levered/stressed period).
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402


def _bal(gaap, tag, cutoff):
    node = gaap.get(tag)
    if not node:
        return {}
    by_end = {}
    for e in node.get("units", {}).get("USD", []):
        end, val, filed = e.get("end"), e.get("val"), e.get("filed")
        if not end or val is None:
            continue
        if cutoff and end > cutoff:
            continue
        if end not in by_end or (filed and filed > by_end[end][0]):
            by_end[end] = (filed, val)
    return {e: v for e, (f, v) in by_end.items()}


def debt_trajectory(facts, cutoff=None, n=16):
    """early-half vs late-half average total debt (long+short)."""
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    lt = _bal(gaap, "LongTermDebtNoncurrent", cutoff) or _bal(gaap, "LongTermDebt", cutoff)
    st = _bal(gaap, "LongTermDebtCurrent", cutoff) or _bal(gaap, "DebtCurrent", cutoff)
    ends = sorted(set(lt) | set(st))
    series = [(e, lt.get(e, 0) + st.get(e, 0)) for e in ends]
    series = [(e, v) for e, v in series if v > 0][-n:]
    if len(series) < 8:
        return None
    vals = [v for _, v in series]
    h = len(vals) // 2
    early, late = float(np.mean(vals[:h])), float(np.mean(vals[h:]))
    return (late - early) / early if early > 0 else None


PANEL = [
    # VERIFIED active DELEVERAGING / self-correction (P8) -- levered then paid down
    ("OXY",  "0000797468", "P8-deleverage"),   # levered for Anadarko 2019 -> paid down 2021-23
    ("DAL",  "0000027904", "P8-deleverage"),   # levered in COVID 2020 -> deleveraging
    ("WBD",  "0001437107", "P8-deleverage"),   # $40B+ for 2022 merger -> deleveraging
    ("T",    "0000732717", "P8-deleverage"),   # post-WarnerMedia spin deleveraging
    # NOT P8 -- returns capital via BUYBACKS, debt routine (P6 order)
    ("AAPL", "0000320193", "P6-buyback"),
    ("MSFT", "0000789019", "P6-buyback"),
    # NOT P8 -- re-levered for new acquisitions (NOT self-correction)
    ("CVS",  "0000064803", "re-lever"),
    # NOT P8 -- TAKING ON debt (P4 scaffold)
    ("RIVN", "0001874178", "P4-scaffold"),
]


def main():
    import time
    rows = []
    print("PROVE P8 — debt actively DECLINING (the system repairing itself)?\n")
    print("%-6s %-15s %-12s %-9s %s" % ("TICK", "expected", "debt_chg", "P8_det", ""))
    for (t, cik, exp) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        dc = debt_trajectory(facts)
        if dc is None:
            rows.append({"t": t, "exp": exp, "ok": None}); print("%-6s %-15s no debt data" % (t, exp)); continue
        p8 = dc < -0.15            # debt down >15% = active deleveraging
        should = exp == "P8-deleverage"
        ok = (p8 == should)
        rows.append({"t": t, "exp": exp, "p8": p8, "ok": ok})
        print("%-6s %-15s %-+12.0f%% %-9s %s" % (
            t, exp, dc * 100, "DELEVER" if p8 else "  .  ", "OK" if ok else "MISS"))
        time.sleep(0.2)
    scored = [r for r in rows if r["ok"] is not None]
    ok = sum(1 for r in scored if r["ok"])
    print("\n=== P8 proof: active deleveraging == self-correction? ===")
    print("  agreement %d/%d = %.2f" % (ok, len(scored), ok / len(scored) if scored else 0))
    print("  false P8:", [r["t"] for r in scored if r.get("p8") and not r["ok"]])
    print("  missed:", [r["t"] for r in scored if not r.get("p8") and not r["ok"]])


if __name__ == "__main__":
    main()
