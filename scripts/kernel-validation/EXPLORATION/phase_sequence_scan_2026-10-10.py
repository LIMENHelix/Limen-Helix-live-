#!/usr/bin/env python3
"""
EXPLORATION — phase-sequence scan (operator task, 2026-10-10).

EXPLORATION MODE (standing rule, THING2_REPLACEMENT_PLAN.md): observations
only. No labels, no caveats, no pass bars. Nothing here is a claim.

Runs the phase reader (fpm-r2) as a POINT-IN-TIME WALK over every cached
entity: for each revenue quarter, the reader sees only what was filed by
that quarter's end. Logs:

  - which phase sequences occur (run-length encoded verdict walks)
  - whether the same compressed sequence appears at company, sector, and
    domain level (sector = coarse grouping of the board's 20 domains)

Instrument choices (observations about the instrument, not claims):
- walk capped at the last 40 revenue quarters per entity
- solvency (Altman Z'') recomputed at each quarter's cutoff
- domain/sector walks = plurality verdict across member entities each
  quarter (UNKNOWN_* votes included)
Cache-only, no network.
"""
import json
import math
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
KVAL = HERE.parent
REPO = KVAL.parent.parent
for p in (str(REPO / "python_runtime" / "helix_app" / "thing2"),
          str(KVAL),
          str(REPO / "python_runtime" / "helix_app" / "thing1")):
    if p not in sys.path:
        sys.path.insert(0, p)

import financial_phase_map as fpm  # noqa: E402
import altman  # noqa: E402
from evidence import measured  # noqa: E402

CACHE = KVAL / "board_cache"
RUN_CUTOFF = "2026-10-09"
WALK_CAP_QTRS = 40
OUT_JSON = HERE / "phase_sequence_scan_2026-10-10.json"

REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax",
                "InterestAndDividendIncomeOperating", "InterestIncomeExpenseNet",
                "NoninterestIncome"]
OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
CFF_TAGS = ["NetCashProvidedByUsedInFinancingActivities",
            "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"]
COST_TAGS = ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold",
             "CostsAndExpenses", "OperatingExpenses"]

SECTOR_OF_DOMAIN = {
    "medicine": "bio_science", "science": "bio_science", "agriculture": "bio_science",
    "technology": "tech_info", "communication": "tech_info", "intelligence": "tech_info",
    "governance": "civic_social", "law": "civic_social", "education": "civic_social",
    "religion": "civic_social", "population": "civic_social", "culture": "civic_social",
    "industry": "industrial", "energy": "industrial", "infrastructure": "industrial",
    "defense": "industrial", "trade": "industrial",
    "finance": "markets", "economy": "markets", "environment": "markets",
}


def q_label(yq):
    return "%dQ%d" % yq


def q_end_iso(yq):
    y, q = yq
    return "%04d-%02d-%02d" % (y, q * 3, {1: 31, 2: 30, 3: 30, 4: 31}[q])


class PITExtractor:
    """Point-in-time de-cumulation over pre-parsed tag entries (memoized dates)."""

    def __init__(self, facts):
        self.gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
        self._dt = {}

    def _parse(self, s):
        d = self._dt.get(s)
        if d is None:
            d = datetime.strptime(s, "%Y-%m-%d")
            self._dt[s] = d
        return d

    def decumulate(self, tags, cutoff):
        periods = {}
        for tag in tags:
            node = self.gaap.get(tag.split("/")[-1])
            if not node:
                continue
            for e in node.get("units", {}).get("USD") or []:
                start, end, filed, val = e.get("start"), e.get("end"), e.get("filed"), e.get("val")
                if not (start and end and val is not None and filed):
                    continue
                if cutoff and (end > cutoff or filed > cutoff):
                    continue
                days = (self._parse(end) - self._parse(start)).days
                if not (75 <= days <= 400):
                    continue
                key = (start, end)
                if key not in periods or filed > periods[key][0]:
                    periods[key] = (filed, val)
        groups = defaultdict(list)
        for (start, end), (filed, val) in periods.items():
            groups[start].append((end, val))
        discrete = {}
        for start, lst in groups.items():
            lst.sort()
            prev_val, prev_end = 0.0, start
            for (end, val) in lst:
                inc = (self._parse(end) - self._parse(prev_end)).days
                if 60 <= inc <= 120:
                    d = self._parse(end)
                    discrete[(d.year, (d.month - 1) // 3 + 1)] = val - prev_val
                prev_val, prev_end = val, end
        return discrete


def load_board_map():
    board = json.loads((REPO / "assets" / "data" / "command-board-data.json").read_text())
    m = {}
    for r in board["companies"]:
        cik = str(r.get("c") or "").lstrip("0") or "0"
        if cik not in m:  # first occurrence wins (duplicates dropped later anyway)
            m[cik] = {"ticker": r.get("t"), "domain": r.get("d")}
    return m


def to_avail(dec):
    return {q_label(yq): measured(v) for yq, v in dec.items()}


def walk_company(facts):
    ex = PITExtractor(facts)
    full_rev = ex.decumulate(REVENUE_TAGS, RUN_CUTOFF)
    if not full_rev:
        return None
    quarters = sorted(full_rev)[-WALK_CAP_QTRS:]
    seq = []
    for yq in quarters:
        # Availability convention: a quarter's filing is public by the END of
        # the FOLLOWING quarter (10-Q ~40d, 10-K ~60-90d). Reading quarter q
        # "as of q's end" is impossible — the filing does not exist yet — so
        # the walk's reading for q uses cutoff = end of q+1.
        ny, nq = (yq[0], yq[1] + 1) if yq[1] < 4 else (yq[0] + 1, 1)
        cutoff = q_end_iso((ny, nq))
        rev = ex.decumulate(REVENUE_TAGS, cutoff)
        ocf = ex.decumulate(OCF_TAGS, cutoff)
        cff = ex.decumulate(CFF_TAGS, cutoff)
        cost = ex.decumulate(COST_TAGS, cutoff)
        for m in (ocf, cff, cost):
            for q in list(m):
                if q > yq:
                    del m[q]
        z = altman.z_from_facts(facts, cutoff)
        solv = measured(z["Z"]) if (isinstance(z, dict) and z.get("Z") is not None) else None
        v = fpm.evaluate(
            revenue=to_avail(rev), ocf=to_avail(ocf), cff=to_avail(cff),
            solvency_z=solv if solv is not None else __import__("evidence").missing("no z"),
            cost=to_avail(cost) or None, end_quarter=q_label(yq))
        seq.append(v.status)
    return {"quarters": [q_label(q) for q in quarters], "seq": seq}


def rle(seq):
    out = []
    for s in seq:
        if out and out[-1][0] == s:
            out[-1][1] += 1
        else:
            out.append([s, 1])
    return [tuple(x) for x in out]


def compressed_pattern(seq):
    """RLE without counts — the shape of the sequence."""
    out = []
    for s in seq:
        if not out or out[-1] != s:
            out.append(s)
    return tuple(out)


def majority_walk(sequences):
    """Plurality verdict per position across member sequences (UNKNOWN included)."""
    n = max((len(s) for s in sequences), default=0)
    walk = []
    for i in range(n):
        votes = Counter(s[i] for s in sequences if i < len(s))
        walk.append(votes.most_common(1)[0][0] if votes else None)
    return walk


def main():
    board = load_board_map()
    files = sorted(CACHE.glob("facts_*.json"))
    companies = []
    for f in files:
        parts = f.stem.split("_")
        cik = parts[-1].lstrip("0") or "0"
        meta = board.get(cik, {"ticker": parts[1], "domain": "unmapped"})
        try:
            facts = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        w = walk_company(facts)
        if not w:
            continue
        domain = meta["domain"] or "unmapped"
        companies.append({
            "cik": cik, "ticker": meta["ticker"], "domain": domain,
            "sector": SECTOR_OF_DOMAIN.get(domain, "unmapped"),
            "quarters": w["quarters"], "seq": w["seq"],
            "rle": [list(x) for x in rle(w["seq"])],
            "pattern": list(compressed_pattern(w["seq"])),
        })
    print("entities walked: %d" % len(companies))

    # pattern tables
    pat_companies = defaultdict(list)
    for c in companies:
        pat_companies[tuple(c["pattern"])].append(c["ticker"])
    print("\ndistinct compressed patterns: %d" % len(pat_companies))
    for pat, ticks in sorted(pat_companies.items(), key=lambda kv: -len(kv[1]))[:15]:
        print("  %-55s x%d  e.g. %s" % (" -> ".join(pat), len(ticks), ", ".join(ticks[:4])))

    # level walks
    levels = {}
    for lvl in ("domain", "sector"):
        groups = defaultdict(list)
        for c in companies:
            groups[c[lvl]].append(c["seq"])
        levels[lvl] = {}
        for name, seqs in sorted(groups.items()):
            w = majority_walk(seqs)
            levels[lvl][name] = {"walk": w, "rle": [list(x) for x in rle(w)],
                                 "pattern": list(compressed_pattern(w)), "n": len(seqs)}

    print("\ndomain-level walks:")
    for name, d in levels["domain"].items():
        print("  %-14s n=%-3d %s" % (name, d["n"], " -> ".join(d["pattern"])))
    print("\nsector-level walks:")
    for name, d in levels["sector"].items():
        print("  %-14s n=%-3d %s" % (name, d["n"], " -> ".join(d["pattern"])))

    # cross-level recurrence: pattern appears at company level AND level walk
    print("\npatterns present at all three levels (company set + its domain walk + its sector walk):")
    n3 = 0
    for pat, ticks in sorted(pat_companies.items(), key=lambda kv: -len(kv[1])):
        pset = set(pat)
        doms = {c["domain"] for c in companies if c["ticker"] in set(ticks)}
        secs = {c["sector"] for c in companies if c["ticker"] in set(ticks)}
        dom_hit = any(tuple(levels["domain"][d]["pattern"]) == pat for d in doms if d in levels["domain"])
        sec_hit = any(tuple(levels["sector"][s]["pattern"]) == pat for s in secs if s in levels["sector"])
        if dom_hit or sec_hit:
            n3 += 1
            print("  %-50s companies=%-3d domain_walk=%s sector_walk=%s" % (
                " -> ".join(pat), len(ticks), dom_hit, sec_hit))
    print("total patterns with a level-walk match: %d" % n3)

    OUT_JSON.write_text(json.dumps({
        "_meta": {"mode": "EXPLORATION — observations only, no claims",
                  "reader": "fpm-r2 walk, point-in-time per quarter",
                  "run_cutoff": RUN_CUTOFF, "walk_cap_qtrs": WALK_CAP_QTRS,
                  "n_entities": len(companies)},
        "companies": companies,
        "patterns": [{"pattern": list(k), "n": len(v), "tickers": v}
                     for k, v in sorted(pat_companies.items(), key=lambda kv: -len(kv[1]))],
        "levels": levels}, indent=1))
    print("\njson: %s" % OUT_JSON)


if __name__ == "__main__":
    main()
