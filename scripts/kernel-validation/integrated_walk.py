#!/usr/bin/env python3
"""
INTEGRATED WALK — the solution: per-line episodes + CROSS-LINE arbitration over time
= a company's full phase walk. Resolves the AAPL/MSFT lesson (a single line's episode
isn't the phase; leverage+order=strategic, leverage+burn=scaffold).

Precompute quarterly lines (revenue, gross-margin, total-debt, OCF, CFF), then at
each quarter read the line-states and arbitrate one phase using cross-line rules,
then segment into EPISODES = the walk. Validate coherence on known arcs (no forcing).
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import phase_signals as ps             # noqa: E402
from flows import decumulate          # noqa: E402
from prove_p8 import _bal              # noqa: E402

OCF_T = ["NetCashProvidedByUsedInOperatingActivities",
         "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF_T = ["NetCashProvidedByUsedInFinancingActivities",
         "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]


def _q_debt(facts):
    gaap = facts.get("facts", {}).get("us-gaap", {})
    lt = _bal(gaap, "LongTermDebtNoncurrent", None) or _bal(gaap, "LongTermDebt", None)
    st = _bal(gaap, "LongTermDebtCurrent", None) or _bal(gaap, "DebtCurrent", None)
    ends = sorted(set(lt) | set(st))
    d = {}
    for e in ends:
        ym = (int(e[:4]), (int(e[5:7]) - 1) // 3 + 1)
        d[ym] = lt.get(e, 0) + st.get(e, 0)
    return d


def _q_assets(facts):
    node = facts.get("facts", {}).get("us-gaap", {}).get("Assets")
    d = {}
    if node:
        by_end = {}
        for e in node.get("units", {}).get("USD", []):
            end, val, filed = e.get("end"), e.get("val"), e.get("filed")
            if not end or val is None or val <= 0:
                continue
            if end not in by_end or (filed and filed > by_end[end][0]):
                by_end[end] = (filed, val)
        for end, (f, v) in by_end.items():
            d[(int(end[:4]), (int(end[5:7]) - 1) // 3 + 1)] = v
    return d


def build(facts):
    rev = decumulate(facts, lb.TAG_MAP["Revenue"])
    ocf = decumulate(facts, OCF_T)
    cff = decumulate(facts, CFF_T)
    debt = _q_debt(facts)
    assets = _q_assets(facts)
    cdict = ps._cost_dict(facts)
    qs = sorted(set(rev) & set(ocf) & set(cff))
    rows = {}
    for q in qs:
        rows[q] = {"rev": rev.get(q), "ocf": ocf.get(q), "cff": cff.get(q),
                   "debt": debt.get(q), "cost": (cdict or {}).get(q), "assets": assets.get(q)}
    return sorted(rows), rows


def arbitrate(qs, rows, i):
    """one phase at quarter qs[i] from cross-line states (rolling)."""
    if i < 8:
        return None
    q = qs[i]
    rv = [rows[qs[j]]["rev"] for j in range(i - 7, i + 1) if rows[qs[j]]["rev"]]
    if len(rv) < 6 or rv[-1] is None or rv[-5] is None or rv[-5] == 0:
        return None
    g = (rv[-1] - rv[-5]) / abs(rv[-5])                       # YoY growth
    ocf_ttm = sum(rows[qs[j]]["ocf"] or 0 for j in range(i - 3, i + 1))
    cff_ttm = sum(rows[qs[j]]["cff"] or 0 for j in range(i - 3, i + 1))
    # margin trend (gross), if cost available
    mt = 0.0
    costs = [rows[qs[j]]["cost"] for j in range(i - 7, i + 1)]
    revs = [rows[qs[j]]["rev"] for j in range(i - 7, i + 1)]
    gm = [(revs[k] - costs[k]) / revs[k] for k in range(len(costs))
          if costs[k] and revs[k] and revs[k] > 0 and -0.5 <= (revs[k] - costs[k]) / revs[k] <= 0.95]
    if len(gm) >= 6:
        mt = float(np.mean(gm[-3:]) - np.mean(gm[:3]))
    # debt change vs 4q ago
    dch = None
    d_now, d_then = rows[q]["debt"], rows[qs[i - 4]]["debt"]
    if d_now and d_then and d_then > 0:
        dch = (d_now - d_then) / d_then

    burn = ocf_ttm < 0
    take_in = cff_ttm > 0 and cff_ttm > 0.5 * abs(ocf_ttm)
    delever = dch is not None and dch < -0.12
    lever = dch is not None and dch > 0.12

    # cross-line arbitration (priority)
    if burn and (take_in or lever):
        return "P4-scaffold"
    if g < -0.05 and mt < -0.02:
        return "P3-fracture"
    if g < -0.04:
        return "coherent-decline"
    if delever and not burn:
        return "P8-self-correct"
    if g > 0.055 and not burn:
        return "P6-order"
    if not burn and lever:
        return "P6-strategic-lever"     # leverage WHILE healthy = strategic (AAPL/MSFT)
    if not burn:
        return "P2/P5-stable"
    return "transition"


def persist(phases, min_dwell=3):
    """Semi-Markov residency: collapse runs shorter than min_dwell quarters into the
    surrounding phase, so a real episode must DWELL (the book's residency layer).
    Removes single-quarter noise without over-smoothing the major arcs."""
    idx = [i for i, p in enumerate(phases) if p is not None]
    if not idx:
        return phases
    seq = [phases[i] for i in idx]
    # build runs
    runs = []
    for p in seq:
        if runs and runs[-1][0] == p:
            runs[-1][1] += 1
        else:
            runs.append([p, 1])
    # iteratively absorb short runs into the longer adjacent neighbor
    changed = True
    while changed and len(runs) > 1:
        changed = False
        for k in range(len(runs)):
            if runs[k][1] < min_dwell:
                left = runs[k - 1] if k > 0 else None
                right = runs[k + 1] if k < len(runs) - 1 else None
                tgt = max([r for r in (left, right) if r], key=lambda r: r[1])
                tgt[1] += runs[k][1]
                runs.pop(k)
                # re-merge same-label adjacents
                m = []
                for p, ln in runs:
                    if m and m[-1][0] == p:
                        m[-1][1] += ln
                    else:
                        m.append([p, ln])
                runs = m
                changed = True
                break
    # expand back
    flat = []
    for p, ln in runs:
        flat += [p] * ln
    out = list(phases)
    for pos, i in enumerate(idx):
        out[i] = flat[pos] if pos < len(flat) else out[i]
    return out


def episodes(qs, phases):
    eps = []
    for q, p in zip(qs, phases):
        if p is None:
            continue
        if eps and eps[-1][2] == p:
            eps[-1] = (eps[-1][0], q, p)
        else:
            eps.append((q, q, p))
    return eps


def fmt(ym):
    return "%dQ%d" % ym


PANEL = [("OXY", "0000797468", "lever/delever + ops"),
         ("INTC", "0000050863", "order->fracture"),
         ("TSLA", "0001318605", "scaffold->endurance->order"),
         ("AAPL", "0000320193", "strategic lever while order")]


def main():
    import time
    for (t, cik, note) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        qs, rows = build(facts)
        phases = persist([arbitrate(qs, rows, i) for i in range(len(qs))])
        eps = [e for e in episodes(qs, phases) if not (e[0] == e[1] and e[2] == "transition")]
        print("\n%s  (%s)" % (t, note))
        for (s, e, p) in eps:
            if s == e:
                print("  %s        %s" % (fmt(s), p))
            else:
                print("  %s-%s  %s" % (fmt(s), fmt(e), p))
        time.sleep(0.2)
    print("\n  Full phase WALK per company (cross-line arbitrated, episode-segmented).")


if __name__ == "__main__":
    main()
