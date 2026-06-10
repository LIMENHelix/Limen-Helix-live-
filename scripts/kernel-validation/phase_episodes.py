#!/usr/bin/env python3
"""
PHASE EPISODES — the solution shape: phases are EPISODES in the trajectory, not
snapshots (P8 proof: OXY rotated P4->P8->stable->P4->P8; a snapshot blurs them).
Scan a line's value series over time, classify each quarter's local state, and
segment into EPISODES (runs) -> the WAS-layer walk.

Starts with the CAPITAL/debt line (clearest rotation): debt rising = P4-leverage,
falling = P8-deleverage, flat = stable. Generalizes to any line.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps             # noqa: E402
from prove_p8 import _bal              # noqa: E402


def debt_history(facts, cutoff=None):
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    lt = _bal(gaap, "LongTermDebtNoncurrent", cutoff) or _bal(gaap, "LongTermDebt", cutoff)
    st = _bal(gaap, "LongTermDebtCurrent", cutoff) or _bal(gaap, "DebtCurrent", cutoff)
    ends = sorted(set(lt) | set(st))
    raw = [(e, lt.get(e, 0) + st.get(e, 0)) for e in ends]
    raw = [(e, v) for e, v in raw if v is not None]
    if len(raw) < 8:
        return [], []
    dates = [e for e, _ in raw]
    vals = ps._clean_interp([v for _, v in raw])   # fix $0 / artifact quarters
    return dates, vals


def state_walk(vals, up=0.12, down=-0.12, lag=4):
    """per-quarter state vs `lag` quarters prior."""
    out = []
    for i in range(len(vals)):
        if i < lag or vals[i - lag] <= 0:
            out.append("?")
            continue
        chg = (vals[i] - vals[i - lag]) / vals[i - lag]
        out.append("up" if chg > up else ("down" if chg < down else "flat"))
    return out


def episodes(dates, states, label_map):
    """merge consecutive same-states into labelled episodes (start,end,label)."""
    eps = []
    for d, s in zip(dates, states):
        if s == "?":
            continue
        lab = label_map[s]
        if eps and eps[-1][2] == lab:
            eps[-1] = (eps[-1][0], d, lab)
        else:
            eps.append((d, d, lab))
    return eps


CAP_LABELS = {"up": "P4-leverage", "down": "P8-deleverage", "flat": "stable"}

PANEL = [
    ("OXY",  "0000797468"), ("DAL", "0000027904"), ("WBD", "0001437107"),
    ("T", "0000732717"), ("AAPL", "0000320193"), ("MSFT", "0000789019"),
]


def main():
    import time
    for (t, cik) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        dates, vals = debt_history(facts)
        if not dates:
            print("\n%s: insufficient debt history" % t); continue
        st = state_walk(vals)
        eps = [e for e in episodes(dates, st, CAP_LABELS) if e[2] != "stable" or True]
        print("\n%s capital-line walk:" % t)
        for (s, e, lab) in eps:
            if lab == "stable" and s == e:
                continue
            print("  %s -> %s  %s" % (s, e, lab))
        time.sleep(0.2)
    print("\n  Each company's CAPITAL line is a WALK of episodes (P4 lever / P8 delever / stable).")
    print("  OXY should show the double rotation: P4(Anadarko)->P8->stable->P4(CrownRock)->P8.")


if __name__ == "__main__":
    main()
