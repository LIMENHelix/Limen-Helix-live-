#!/usr/bin/env python3
"""
PATTERN-BREAK ANALYSIS (operator): track each company's pattern; when it HOLDS it's
the stable baseline; when it BREAKS, find WHAT HAPPENED. Two payoffs:
 (1) validates patterns are REAL -- a break with no identifiable cause = red flag
 (2) builds the causal/antecedent library (break-type <- cause), the honest path to
     prediction without next-phase whack-a-mole.

For each break (phase transition), attribute the driver by diffing the per-quarter
line-states across the break: revenue (grow/flat/decline/fracture), margin
(expand/stable/compress), capital (scaffold/return/delever/lever), relative
(outgrow/in-line/lag), and any 8-K event.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402
import events as ev                   # noqa: E402
import run30                          # noqa: E402


def line_states(qs, rows, i, secmed):
    """per-quarter line states (for cause attribution)."""
    if i < 8:
        return None
    q = qs[i]
    qp = (q[0] - 1, q[1])
    rev_now = rows[q]["rev"]
    rev_prior = rows[qp]["rev"] if qp in rows else None
    if not rev_now or not rev_prior or rev_prior <= 0:
        return None
    g = (rev_now - rev_prior) / rev_prior
    g_rel = g - secmed.get(q, 0.0)
    ocf = sum(rows[qs[j]]["ocf"] or 0 for j in range(i - 3, i + 1))
    cff = sum(rows[qs[j]]["cff"] or 0 for j in range(i - 3, i + 1))
    costs = [rows[qs[j]]["cost"] for j in range(i - 7, i + 1)]
    revs = [rows[qs[j]]["rev"] for j in range(i - 7, i + 1)]
    gm = [(revs[k] - costs[k]) / revs[k] for k in range(len(costs))
          if costs[k] and revs[k] and revs[k] > 0 and -0.5 <= (revs[k] - costs[k]) / revs[k] <= 0.95]
    mt = float(np.mean(gm[-3:]) - np.mean(gm[:3])) if len(gm) >= 6 else 0.0
    d_now = rows[q]["debt"]
    d_then = rows[qp]["debt"] if qp in rows else None
    dch = (d_now - d_then) / d_then if d_now and d_then and d_then > 0 else 0.0
    return {
        "rev": "decline" if g < -0.04 else ("grow" if g > 0.055 else "flat"),
        "rel": "outgrow" if g_rel > 0.05 else ("lag" if g_rel < -0.05 else "in-line"),
        "margin": "compress" if mt < -0.03 else ("expand" if mt > 0.03 else "stable"),
        "capital": ("scaffold" if (ocf < 0 and cff > 0.5 * abs(ocf)) else
                    ("delever" if dch < -0.12 else ("lever" if dch > 0.12 else
                     ("return" if cff < 0 else "neutral")))),
    }


def attribute(prev, cur, q, evq):
    """what changed across the break."""
    if q in evq:
        return ["8-K structural event"]
    if prev is None or cur is None:
        return ["(insufficient data)"]
    drivers = [k for k in ("rev", "margin", "capital", "rel") if prev[k] != cur[k]]
    return ["%s: %s->%s" % (k, prev[k], cur[k]) for k in drivers] or ["(no line changed -- RED FLAG)"]


def main():
    import time
    secmeds = {}
    for sec in set(s for _, _, s in run30.TARGETS):
        secmeds[sec] = pw.sector_median_growth_from(run30.SECTORS[sec])
    PICK = ["INTC", "EL", "BA", "NFLX", "DLTR", "FCX", "UPS", "KR"]
    cik = {t: c for t, c, s in run30.TARGETS}
    sec = {t: s for t, c, s in run30.TARGETS}
    # add INTC (semis) manually since it's not in run30 targets
    extra = {"INTC": ("0000050863", "semis")}
    pw_sec = {**{t: sec.get(t) for t in PICK}, "INTC": "semis"}
    cik = {**cik, "INTC": "0000050863"}
    if "semis" not in secmeds:
        secmeds["semis"] = pw.sector_median_growth_from(pw.SECTOR_PEERS["semis"])
    n_breaks = n_caused = 0
    for t in PICK:
        s = pw_sec[t]
        facts = lb.fetch_sec_facts(cik[t])
        qs, rows = iw.build(facts)
        base = iw.persist([pw.arbitrate_rel(qs, rows, i, secmeds[s]) for i in range(len(qs))])
        evq = ev.event_quarters(cik[t])
        over = ev.overlay(qs, base, rows, evq)
        eps = [e for e in iw.episodes(qs, over) if not (e[0] == e[1] and e[2] == "transition")]
        print("\n%s [%s] — breaks and causes:" % (t, s))
        for k in range(1, len(eps)):
            bq = eps[k][0]
            i = qs.index(bq)
            cause = attribute(line_states(qs, rows, i - 1, secmeds[s]),
                              line_states(qs, rows, i, secmeds[s]), bq, evq)
            n_breaks += 1
            if "RED FLAG" not in cause[0] and "insufficient" not in cause[0]:
                n_caused += 1
            print("  %s  %s -> %s   <= %s" % (iw.fmt(bq), eps[k - 1][2], eps[k][2], "; ".join(cause)))
        time.sleep(0.1)
    print("\n=== breaks with an identifiable cause: %d/%d ===" % (n_caused, n_breaks))
    print("  (a break with NO line-change/event = noise; a caused break = real pattern shift)")


if __name__ == "__main__":
    main()
