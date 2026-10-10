#!/usr/bin/env python3
"""board_cik_adjudication.py — operator rule (2026-10-09):
row-error -> adopt SEC frame; delisted-but-correct -> keep + mark delisted;
duplicates -> dedupe; successor/holdco (thin frame-entity history) -> operator
list. Unresolved rows read UNKNOWN — ENTITY UNRESOLVED in the Thing 2 channel.

Writes assets/data/board-cik-resolution.json and updates
assets/data/command-board-thing2-readings.json in place (v1.1).
"""
import json
import sys
import time
import os
import glob
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
for p in (str(REPO), str(REPO / "python_runtime"),
          str(REPO / "python_runtime" / "helix_app" / "thing1"),
          str(REPO / "python_runtime" / "helix_app" / "thing2"), str(HERE)):
    sys.path.insert(0, p)

import requests  # noqa: E402
import limen_app  # noqa: E402,F401
import financial_phase_map as fpm  # noqa: E402
import sec_adapter  # noqa: E402

UA = {"User-Agent": "limenhelix@gmail.com"}
CUTOFF = "2026-10-09"
CACHE = HERE / "board_cache"
CACHE.mkdir(exist_ok=True)
UNRESOLVED = "UNKNOWN — ENTITY UNRESOLVED"


def fetch(cik10, tag):
    dest = CACHE / ("frame_%s_%s.json" % (tag, cik10))
    if dest.exists() and dest.stat().st_size > 100:
        return dest
    for a in range(3):
        try:
            time.sleep(0.15)
            r = requests.get("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json" % cik10,
                             headers=UA, timeout=60)
            if r.status_code == 200:
                dest.write_bytes(r.content)
                return dest
            time.sleep(2 ** a)
        except Exception:
            time.sleep(2 ** a)
    return None


def history_quarters(facts):
    gaap = (facts or {}).get("facts", {}).get("us-gaap", {})
    node = gaap.get("Revenue") or gaap.get("Revenues") or gaap.get("SalesRevenueNet")
    if not node:
        return 0
    qs = set()
    for e in (node.get("units", {}).get("USD") or []):
        end = e.get("end", "")
        if e.get("form") in ("10-Q", "10-K") and len(end) == 10:
            y, m = int(end[:4]), int(end[5:7])
            qs.add((y, (m - 1) // 3 + 1))
    return len(qs)


def main():
    frame = json.loads((HERE / "shadow_cache_frame_audit" / "company_tickers.json").read_text(encoding="utf-8"))
    tick2cik = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in frame.values()}
    board = json.loads((REPO / "assets" / "data" / "command-board-data.json").read_text(encoding="utf-8"))
    rows = board["companies"]
    rd_path = REPO / "assets" / "data" / "command-board-thing2-readings.json"
    rd = json.loads(rd_path.read_text(encoding="utf-8"))
    readings = rd["readings"]

    res = {"fixes": [], "delisted": [], "duplicates": [], "operator_list": [], "unresolved": []}

    # duplicate tickers
    by_t = {}
    for r in rows:
        by_t.setdefault((r.get("t") or "").upper(), []).append(r)
    keep = {}
    for t, rs in by_t.items():
        if len(rs) <= 1 or not t:
            for r in rs:
                keep[str(r.get("c")).lstrip("0") or "0"] = r
            continue
        best = None
        for r in rs:
            key = str(r.get("c")).lstrip("0") or "0"
            agrees = tick2cik.get(t) == str(r.get("c")).zfill(10)
            if best is None or (agrees and not best[1]):
                best = (r, agrees, key)
        for r in rs:
            key = str(r.get("c")).lstrip("0") or "0"
            if r is best[0]:
                keep[key] = r
            else:
                res["duplicates"].append({"ticker": t, "dropped_cik": key,
                                          "kept_cik": best[2]})
                if key in readings:
                    readings[key]["title"] = UNRESOLVED
                    readings[key]["entity_status"] = "duplicate_row_dropped"

    # 1:1 rows
    for key, r in keep.items():
        t = (r.get("t") or "").upper()
        c_row = str(r.get("c") or "").zfill(10)
        fc = tick2cik.get(t)
        if fc == c_row:
            continue
        if fc:
            f = fetch(fc, t)
            if not f:
                res["unresolved"].append({"ticker": t, "cik": c_row, "why": "frame facts unavailable"})
                if key in readings:
                    readings[key]["title"] = UNRESOLVED
                    readings[key]["entity_status"] = "unresolved"
                continue
            facts = json.loads(Path(f).read_text(encoding="utf-8"))
            hq = history_quarters(facts)
            if hq < 8:
                res["operator_list"].append({"ticker": t, "row_cik": c_row, "frame_cik": fc,
                                             "frame_history_quarters": hq,
                                             "why": "frame entity thin — successor/holdco candidate"})
                if key in readings:
                    readings[key]["title"] = UNRESOLVED
                    readings[key]["entity_status"] = "successor_candidate_pending_operator"
            else:
                v = sec_adapter.evaluate_company(facts, CUTOFF)
                new_key = fc.lstrip("0") or "0"
                readings.pop(key, None)
                readings[new_key] = {
                    "ticker": t, "phase": v.phase, "status": v.status, "mode": v.mode,
                    "reason": v.reason,
                    "title": ("P%s · %s" % (v.phase[1], {"p0": "Source", "p2": "Rhythm",
                                     "p4": "Scaffolding", "p5": "Endurance"}[v.phase]))
                    if v.phase in ("p0", "p2", "p4", "p5") else v.status,
                    "entity_status": "cik_fixed_from_frame",
                    "prior_cik": c_row}
                res["fixes"].append({"ticker": t, "from": c_row, "to": fc})
        else:
            cached = list(CACHE.glob("facts_%s_%s.json" % (t.replace("/", "-"), c_row)))
            if cached or (key in readings and readings[key].get("status") != "ERROR"):
                readings[key]["entity_status"] = "delisted_kept"
                res["delisted"].append({"ticker": t, "cik": c_row})
            else:
                res["unresolved"].append({"ticker": t, "cik": c_row, "why": "no frame entry, no cached facts"})
                if key in readings:
                    readings[key]["title"] = UNRESOLVED
                    readings[key]["entity_status"] = "unresolved"

    rd["_meta"]["formula_version"] = fpm.FORMULA_VERSION
    rd["_meta"]["entity_resolution"] = {k: len(v) for k, v in res.items()}
    rd_path.write_text(json.dumps(rd, indent=0, default=str))
    (REPO / "assets" / "data" / "board-cik-resolution.json").write_text(
        json.dumps({"cutoff": CUTOFF, "rule": "operator 2026-10-09", **res}, indent=1))
    print(json.dumps({k: len(v) for k, v in res.items()}))
    print("operator_list:")
    for x in res["operator_list"]:
        print("  %-7s row=%s frame=%s hq=%d" % (x["ticker"], x["row_cik"], x["frame_cik"], x["frame_history_quarters"]))


if __name__ == "__main__":
    main()
