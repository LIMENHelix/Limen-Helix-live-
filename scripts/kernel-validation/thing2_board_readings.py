#!/usr/bin/env python3
"""thing2_board_readings.py — Thing 2 phase-reading channel for the Command Board.

ADDS a Thing 2 channel; does NOT replace Thing 1 (operator instruction
2026-10-09). Output: assets/data/command-board-thing2-readings.json keyed by
normalized CIK. Thing 2 output is interpretive — never "validated", zero
alert authority. Labels are FROZEN registry titles for released phases
(P0 Source, P2 Rhythm, P4 Scaffolding, P5 Endurance); everything else renders
as UNKNOWN with its reason code. Retires alternate names on this surface.

Cache-first (board_cache/), SEC identity limenhelix@gmail.com, <=10 req/s.
Resume-safe: re-running skips CIKs already in the output artifact.
"""
import json
import sys
import time
import hashlib
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
for p in (str(REPO), str(REPO / "python_runtime"),
          str(REPO / "python_runtime" / "helix_app" / "thing1"),
          str(REPO / "python_runtime" / "helix_app" / "thing2"), str(HERE)):
    sys.path.insert(0, p)

import requests  # noqa: E402
import limen_app  # noqa: E402,F401  (stubs mpl/sklearn)
import sec_adapter  # noqa: E402

CUTOFF = datetime.now().strftime("%Y-%m-%d")
UA = {"User-Agent": "limenhelix@gmail.com", "Accept-Encoding": "gzip, deflate"}
CACHE = HERE / "board_cache"
CACHE.mkdir(exist_ok=True)
OUT = REPO / "assets" / "data" / "command-board-thing2-readings.json"

# Frozen registry titles (operator 2026-10-09). No alternates on this surface.
T2_TITLES = {"p0": "Source", "p2": "Rhythm", "p4": "Scaffolding", "p5": "Endurance"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_facts(ticker, cik):
    c10 = str(cik).zfill(10)
    dest = CACHE / ("facts_%s_%s.json" % (ticker.replace("/", "-"), c10))
    if dest.exists() and dest.stat().st_size > 100:
        return dest
    for a in range(4):
        try:
            time.sleep(0.15)
            r = requests.get("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json" % c10,
                             headers=UA, timeout=60)
            if r.status_code == 200:
                dest.write_bytes(r.content)
                return dest
            time.sleep(2 ** a)
        except Exception:
            time.sleep(2 ** a)
    return None


def main():
    board = json.loads((REPO / "assets" / "data" / "command-board-data.json").read_text(encoding="utf-8"))
    rows = board["companies"]
    readings = {}
    if OUT.exists():
        try:
            readings = json.loads(OUT.read_text(encoding="utf-8")).get("readings", {})
        except Exception:
            readings = {}
    done = set(readings.keys())
    todo = []
    seen = set()
    for r in rows:
        key = str(r.get("c") or "").lstrip("0") or "0"
        if key in seen or key in done:
            continue
        seen.add(key)
        todo.append((r.get("t") or "X", key))
    print("rows=%d already=%d todo=%d cutoff=%s" % (len(rows), len(done), len(todo), CUTOFF), flush=True)

    n = 0
    for t, cik in todo:
        f = fetch_facts(t, cik)
        rec = {"ticker": t}
        if not f:
            rec.update(status="ERROR", title="UNKNOWN (data unavailable)", phase=None, mode=None)
        else:
            try:
                facts = json.loads(Path(f).read_text(encoding="utf-8"))
                v = sec_adapter.evaluate_company(facts, CUTOFF)
                rec["status"] = v.status
                rec["phase"] = v.phase
                rec["mode"] = v.mode
                rec["reason"] = v.reason
                if v.phase in T2_TITLES:
                    rec["title"] = "P%s · %s" % (v.phase[1], T2_TITLES[v.phase])
                elif v.status == "UNKNOWN_INSUFFICIENT_HISTORY":
                    rec["title"] = "UNKNOWN — INSUFFICIENT HISTORY"
                elif v.status == "UNKNOWN_ABSTAINED":
                    rec["title"] = "UNKNOWN — ABSTAINED (9.14c)"
                elif v.status == "UNKNOWN_NOT_BUILT":
                    rec["title"] = "UNKNOWN — NOT BUILT"
                else:
                    rec["title"] = v.status
            except Exception as e:
                rec.update(status="ERROR", title="UNKNOWN (scoring error)", phase=None,
                           mode=None, error=repr(e)[:150])
        readings[cik] = rec
        n += 1
        if n % 20 == 0:
            OUT.write_text(json.dumps({"_meta": {
                "source": "Thing 2 Financial Phase Map (interpretive; never validated; zero alert authority)",
                "formula_version": getattr(sec_adapter, "FORMULA_VERSION", "unknown"),
                "cutoff": CUTOFF, "frozen_titles": T2_TITLES,
                "n": len(readings)}, "readings": readings}, indent=0))
            print("progress %d/%d" % (n, len(todo)), flush=True)

    manifest = {p.name: sha256(p) for p in sorted(CACHE.glob("*.json"))}
    (CACHE / "manifest.json").write_text(json.dumps(manifest, indent=1))
    OUT.write_text(json.dumps({"_meta": {
        "source": "Thing 2 Financial Phase Map (interpretive; never validated; zero alert authority)",
        "formula_version": getattr(sec_adapter, "FORMULA_VERSION", "unknown"),
        "cutoff": CUTOFF, "frozen_titles": T2_TITLES,
        "n": len(readings)}, "readings": readings}, indent=0))
    from collections import Counter
    print("DONE n=%d" % len(readings))
    print(Counter(r.get("title", "?").split(" — ")[0] for r in readings.values()))


if __name__ == "__main__":
    main()
