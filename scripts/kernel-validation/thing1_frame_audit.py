#!/usr/bin/env python3
"""thing1_frame_audit.py — executes THING1_FRAME_AUDIT_PREREG_v1.0 (signed 2026-10-08).

  collect : prereg §3 — seeded draw, submissions (SIC/FYE), facts; cache-first
            into shadow_cache_frame_audit/ with SHA-256 manifest. SEC identity
            limenhelix@gmail.com. <=10 req/s with backoff. Resume-safe.
  analyze : prereg §4-§7 — variables, Tables 1-2, pre-committed readings,
            validation-set dependence check. Writes thing1_frame_audit_results.json
            once (dated suffix if it already exists).

Usage: python thing1_frame_audit.py [collect|analyze|all]   (default: all)
Read-only w.r.t. kernels: Thing 1 locked; no production file is modified.
"""
import glob
import hashlib
import json
import os
import random
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "python_runtime"))
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing1"))
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing2"))
sys.path.insert(0, str(HERE))

import requests  # noqa: E402

import limen_app  # noqa: E402,F401  (stubs mpl/sklearn; imports locked kernel)
import limen_backtest as lb  # noqa: E402
from held_out_test import wilson  # noqa: E402
from flows import decumulate  # noqa: E402
import sec_adapter  # noqa: E402

AUDIT = HERE / "shadow_cache_frame_audit"
AUDIT.mkdir(exist_ok=True)
UA = {"User-Agent": "limenhelix@gmail.com", "Accept-Encoding": "gzip, deflate"}

PREREG = "THING1_FRAME_AUDIT_PREREG_v1.0.md"
SEED = 20261008
TARGET_ACCEPTED = 200
OFFCAL_MIN = 30
EXT_CHUNK = 100
MAX_EXTENSIONS = 3
MAX_ACCEPTED = 500
FIN_SIC = (6000, 6999)
CUTOFF = "2026-10-08"
TODAY = CUTOFF

CHANNELS = ["risk_var_rev", "risk_ac_rev", "risk_slope_rev", "risk_accel_rev",
            "risk_var_ocf", "risk_ac_ocf"]
FORMS = ("10-Q", "10-K", "10-Q/A", "10-K/A")

CALIB = [(c["ticker"], c["cik"]) for c in lb.DISTRESS + lb.CONTROLS]
HOT_B = ["HTZ", "VAL", "WLL", "DO", "FTR", "MNK", "NMRD", "YELL", "TUEM",
         "EXPR", "FRG", "DDS_x"]
HOT_H = ["LMT", "GD", "NOC", "UNP", "CSX", "NSC", "ADP", "PAYX", "WM"]
K3_B = ["FYBR", "WLL", "DNR", "SN", "GYMB", "PIR", "SHLDQ", "BRS", "MCKPQ", "WMPVQ"]
K3_H = ["PG", "KO", "HD", "NEE", "RTX", "JNJ", "MCD", "BRK-B", "UNH", "LMT"]


def log(msg):
    print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), msg), flush=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, dest, tries=4):
    if dest.exists() and dest.stat().st_size > 100:
        return dest
    for a in range(tries):
        try:
            time.sleep(0.15)  # <=10 req/s
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code == 200:
                dest.write_bytes(r.content)
                return dest
            if r.status_code in (403, 429):
                time.sleep(5 * (a + 1))
            else:
                time.sleep(2 ** a)
        except Exception:
            time.sleep(2 ** a)
    return None


# ------------------------------------------------------------------ collect
def collect():
    log("fetching frame file company_tickers.json")
    tf = fetch("https://www.sec.gov/files/company_tickers.json",
               AUDIT / "company_tickers.json")
    if not tf:
        alt = HERE / "shadow_cache" / "company_tickers.json"
        log("FRAME FETCH FAILED — falling back to cached copy %s (protocol deviation, recorded)" % alt)
        tf = alt
    frame = json.loads(Path(tf).read_text(encoding="utf-8"))
    tickers = [(v["ticker"].upper(), str(v["cik_str"]).zfill(10))
               for v in frame.values()]
    seen = set()
    order = []
    for t, c in tickers:
        if c not in seen:
            seen.add(c)
            order.append((t, c))
    random.Random(SEED).shuffle(order)
    log("frame: %d unique CIKs" % len(order))

    accepted = {}
    excluded_fin = []
    failures = []
    drawn = 0
    extensions_used = 0
    idx = 0

    def offcal_count():
        return sum(1 for a in accepted.values() if a.get("fye") and a["fye"] != "1231")

    while idx < len(order):
        chunk_end = min(idx + EXT_CHUNK, len(order))
        while idx < chunk_end:
            t, cik = order[idx]
            idx += 1
            drawn += 1
            if cik in accepted or any(cik == f[1] for f in failures):
                continue
            sf = fetch("https://data.sec.gov/submissions/CIK%s.json" % cik,
                       AUDIT / ("subs_%s_%s.json" % (t.replace("/", "-"), cik)))
            if not sf:
                failures.append((t, cik, "submissions fetch failed"))
                continue
            try:
                sd = json.loads(Path(sf).read_text(encoding="utf-8"))
            except Exception:
                failures.append((t, cik, "submissions parse failed"))
                continue
            try:
                sic = int(sd.get("sic")) if sd.get("sic") not in (None, "") else None
            except Exception:
                sic = None
            fye = (sd.get("fiscalYearEnd") or "").strip()
            if sic is None:
                failures.append((t, cik, "sic unknown"))
                continue
            if FIN_SIC[0] <= sic <= FIN_SIC[1]:
                excluded_fin.append((t, cik, sic))
                continue
            accepted[cik] = {"ticker": t, "cik": cik, "sic": sic, "fye": fye,
                             "name": sd.get("name", "")}
        if len(accepted) >= TARGET_ACCEPTED:
            if offcal_count() >= OFFCAL_MIN or extensions_used >= MAX_EXTENSIONS \
               or len(accepted) >= MAX_ACCEPTED:
                break
            extensions_used += 1
            log("extension %d: accepted=%d off-cal=%d — drawing %d more"
                % (extensions_used, len(accepted), offcal_count(), EXT_CHUNK))
            chunk_end = min(idx + EXT_CHUNK, len(order))
        elif len(accepted) >= MAX_ACCEPTED:
            break

    log("drawn=%d accepted=%d excluded_fin=%d failures=%d off-cal=%d ext=%d"
        % (drawn, len(accepted), len(excluded_fin), len(failures),
           offcal_count(), extensions_used))

    n = 0
    for cik, a in accepted.items():
        ff = fetch("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json" % cik,
                   AUDIT / ("facts_%s_%s.json" % (a["ticker"].replace("/", "-"), cik)))
        if not ff:
            a["facts_error"] = "facts fetch failed"
        n += 1
        if n % 25 == 0:
            log("facts fetched: %d/%d" % (n, len(accepted)))
    manifest = {p.name: sha256(p) for p in sorted(AUDIT.glob("*.json"))}
    (AUDIT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    state = {"seed": SEED, "cutoff": CUTOFF, "prereg": PREREG,
             "drawn": drawn, "accepted": accepted, "excluded_fin": excluded_fin,
             "failures": failures, "extensions_used": extensions_used}
    (AUDIT / "panel_state.json").write_text(json.dumps(state, indent=1))
    log("panel_state.json + manifest.json written; facts errors: %d"
        % sum(1 for a in accepted.values() if "facts_error" in a))


# ------------------------------------------------------------------ analyze
def frame_stats(facts, tags, is_flow):
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    framed = ytd = 0
    accepted = len(lb.extract_quarterly_series(facts, tags, "m", is_flow))
    for tag_path in tags:
        node = us_gaap.get(tag_path.split("/")[-1])
        if not node:
            continue
        units = node.get("units", {})
        ud = units.get("USD") or (list(units.values())[0] if units else None)
        if not ud:
            continue
        for e in ud:
            if e.get("form") not in FORMS:
                continue
            fr = e.get("frame")
            if is_flow:
                if fr and "Q" in fr and "I" not in fr:
                    framed += 1
                else:
                    ytd += 1
            else:
                if fr:
                    framed += 1
                else:
                    ytd += 1
    return {"framed": framed, "ytd": ytd, "accepted": accepted,
            "pattern": bool(accepted >= 4 and ytd > 0)}


def _cut_yq(cutoff):
    d = datetime.strptime(cutoff, "%Y-%m-%d")
    return (d.year, (d.month - 1) // 3 + 1)


def build_df(facts, cutoff, ocf_override=None):
    data = {
        "Revenue": lb.extract_quarterly_series(facts, lb.TAG_MAP["Revenue"], "Revenue", True),
        "OCF": lb.extract_quarterly_series(facts, lb.TAG_MAP["OCF"], "OCF", True),
        "Cash": lb.extract_quarterly_series(facts, lb.TAG_MAP["Cash"], "Cash", False),
    }
    if ocf_override is not None:
        data["OCF"] = dict(ocf_override)
    dc = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtCurrent"], "DC", False)
    dl = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtLong"], "DL", False)
    all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}
    cyq = _cut_yq(cutoff)
    pit = {m: {q: v for q, v in s.items() if q <= cyq} for m, s in data.items()}
    df = lb.compute_all_features(pit, {})
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    return df


def score(df, cutoff):
    composite, first_q, det = lb.compute_composite_score(
        df, event_str=cutoff, p3_entry=limen_app.P3_ENTRY_FROZEN)
    alert = (det.get("path_a", 0) >= lb.COMPOSITE_THRESH_A or
             det.get("path_b", 0) >= lb.COMPOSITE_THRESH_B or
             det.get("path_c", 0) >= lb.COMPOSITE_THRESH_C)
    return det, bool(alert), first_q


def company_record(facts):
    rec = {}
    for m, isf in (("Revenue", True), ("OCF", True), ("Cash", False),
                   ("DebtCurrent", False), ("DebtLong", False)):
        rec[m] = frame_stats(facts, lb.TAG_MAP[m], isf)
    df = build_df(facts, CUTOFF)
    if df is None or df.empty:
        rec["error"] = "no quarterly data"
        return rec
    ev = df[df["quarter"].apply(lambda q: q[0] >= lb.START_YEAR)]
    det, alert, first_q = score(df, CUTOFF)
    rec["eval_rows"] = int(len(ev))
    rec["rev_measured"] = int(ev["Revenue"].notna().sum())
    rec["ocf_measured"] = int(ev["OCF"].notna().sum())
    rec["zero_fill"] = int(ev["OCF"].isna().sum())
    floor = ev[(ev[CHANNELS] == 0.5).all(axis=1)]
    rec["neutral_floor_share"] = round(len(floor) / float(len(ev)), 4) if len(ev) else None
    rec.update({
        "alert": alert, "first_alert_q": first_q,
        "path_a": det.get("path_a"), "path_b": det.get("path_b"),
        "path_c": det.get("path_c"), "stress_rate": det.get("stress_rate"),
        "n_stressed": det.get("n_stressed"), "max_consec": det.get("max_consec"),
        "max_p3": det.get("max_p3"), "sustained_bonus": det.get("sustained_bonus"),
    })
    rec["quarters"] = [
        {"q": "%dQ%d" % (r["quarter"][0], r["quarter"][1]), "p3": float(r["p3"]),
         "ocf_missing": bool(r["OCF"] != r["OCF"]),
         "ch": {c: float(r[c]) for c in CHANNELS}}
        for _, r in ev.iterrows()]
    dec = decumulate(facts, lb.TAG_MAP["OCF"], CUTOFF)
    df2 = build_df(facts, CUTOFF, ocf_override={(y, q): v for (y, q), v in dec.items()})
    if df2 is not None and not df2.empty:
        det2, alert2, _ = score(df2, CUTOFF)
        rec["cf"] = {"alert": alert2, "path_a": det2.get("path_a"),
                     "stress_rate": det2.get("stress_rate")}
    try:
        v = sec_adapter.evaluate_company(facts, CUTOFF)
        rec["thing2"] = {"status": v.status, "phase": v.phase, "mode": v.mode}
    except Exception as e:
        rec["thing2"] = {"error": repr(e)[:120]}
    return rec


def feature_class(rec):
    if rec.get("eval_rows") in (None, 0):
        return "NO_DATA"
    rc = rec["rev_measured"] / float(rec["eval_rows"])
    nf = rec["neutral_floor_share"] or 0.0
    if rc >= 0.8 and nf < 0.2:
        return "REAL"
    if nf >= 0.5:
        return "DEGENERATE"
    return "MIXED"


def table(rows, keyfn, name):
    cells = {}
    for r in rows:
        k, flagged = keyfn(r), bool(r.get("alert"))
        cells.setdefault(k, [0, 0])
        cells[k][flagged] += 1
    print("\n=== %s ===" % name)
    out = {}
    for k in sorted(cells, key=str):
        no, yes = cells[k]
        out[str(k)] = {"not_flagged": no, "flagged": yes}
        print("  %-12s not_flagged=%-4d flagged=%d" % (k, no, yes))
    return out


def readings(rows, keyfn, label):
    pat = [r for r in rows if keyfn(r) is True]
    clean = [r for r in rows if keyfn(r) is False]
    if not pat or not clean or len(pat) < 5 or len(clean) < 5:
        print("\n[%s] READING 3 — too few to tell (pat=%d clean=%d); counts reported, no verdict"
              % (label, len(pat), len(clean)))
        return {"reading": 3, "n_pattern": len(pat), "n_clean": len(clean),
                "flagged_pattern": sum(1 for r in pat if r.get("alert")),
                "flagged_clean": sum(1 for r in clean if r.get("alert"))}
    p1 = sum(1 for r in pat if r.get("alert")) / float(len(pat))
    p0 = sum(1 for r in clean if r.get("alert")) / float(len(clean))
    diff = p1 - p0
    se = (p1 * (1 - p1) / len(pat) + p0 * (1 - p0) / len(clean)) ** 0.5
    lo, hi = diff - 1.96 * se, diff + 1.96 * se
    if lo > 0:
        rd = 2
    elif hi < 0 or abs(diff) < 1e-12:
        rd = 1 if hi >= 0 else 1
    else:
        rd = 1  # CI contains 0 -> "about the same"
    print("\n[%s] flagged rate: pattern=%.3f (n=%d) clean=%.3f (n=%d) diff=%.3f CI[%.3f,%.3f] -> READING %d"
          % (label, p1, len(pat), p0, len(clean), diff, lo, hi, rd))
    return {"reading": rd, "p_pattern": p1, "n_pattern": len(pat),
            "p_clean": p0, "n_clean": len(clean), "diff": diff,
            "ci95": [lo, hi]}


def analyze():
    state = json.loads((AUDIT / "panel_state.json").read_text(encoding="utf-8"))
    rows = []
    for cik, a in state["accepted"].items():
        ff = AUDIT / ("facts_%s_%s.json" % (a["ticker"].replace("/", "-"), cik))
        if not ff.exists():
            continue
        facts = json.loads(Path(ff).read_text(encoding="utf-8"))
        rec = {"ticker": a["ticker"], "cik": cik, "fye": a.get("fye"),
               "sic": a.get("sic"), "name": a.get("name")}
        rec.update(company_record(facts))
        rec["feature_class"] = feature_class(rec)
        rows.append(rec)
    log("analyzed %d companies" % len(rows))

    print("\n############ TABLE 1 — OCF pattern vs flagged ############")
    t1 = table(rows, lambda r: r["OCF"]["pattern"], "TABLE 1 (rows: OCF short-circuit pattern)")
    print("\n############ TABLE 2 — feature class vs flagged ############")
    t2 = table(rows, lambda r: r["feature_class"], "TABLE 2 (rows: feature class)")
    r1 = readings(rows, lambda r: r["OCF"]["pattern"], "Table1")
    r2 = readings(rows, lambda r: r["feature_class"] == "DEGENERATE", "Table2-DEGENERATE")
    r3 = readings(rows, lambda r: r["feature_class"] == "REAL", "Table2-REAL")

    print("\n############ flagged companies — cell math ############")
    for r in rows:
        if r.get("alert"):
            print("  %-6s FYE=%s class=%s | A=%.3f B=%.3f C=%.3f | stress=%.3f (%d/%d) consec=%s maxp3=%.3f bonus=%s | revcov=%.2f ocfcov=%.2f floor=%.2f | cf: %s | t2: %s"
                  % (r["ticker"], r["fye"], r["feature_class"],
                     r["path_a"] or 0, r["path_b"] or 0, r["path_c"] or 0,
                     r["stress_rate"] or 0, r["n_stressed"] or 0, r["eval_rows"] or 0,
                     r["max_consec"], r["max_p3"] or 0, r["sustained_bonus"],
                     (r["rev_measured"] / float(r["eval_rows"])) if r.get("eval_rows") else 0,
                     (r["ocf_measured"] / float(r["eval_rows"])) if r.get("eval_rows") else 0,
                     r["neutral_floor_share"] or 0,
                     r.get("cf"), r.get("thing2")))

    print("\n############ pattern-but-NOT-flagged — why (sample up to 15) ############")
    pnf = [r for r in rows if r["OCF"]["pattern"] and not r.get("alert")]
    for r in pnf[:15]:
        print("  %-6s class=%s A=%.3f stress=%.3f floor=%.2f revcov=%.2f"
              % (r["ticker"], r["feature_class"], r["path_a"] or 0,
                 r["stress_rate"] or 0, r["neutral_floor_share"] or 0,
                 (r["rev_measured"] / float(r["eval_rows"])) if r.get("eval_rows") else 0))
    print("  (pattern-not-flagged total: %d)" % len(pnf))

    # §7 validation-set dependence
    print("\n############ validation-set dependence (§7) ############")
    val = {}
    tick2cik = {}
    frame_f = AUDIT / "company_tickers.json"
    if frame_f.exists():
        for v in json.loads(Path(frame_f).read_text(encoding="utf-8")).values():
            tick2cik[v["ticker"].upper()] = str(v["cik_str"]).zfill(10)
    checks = [("calibration", t, c) for t, c in CALIB]
    for grp, ts in (("heldout_test-bankrupt", HOT_B), ("heldout_test-healthy", HOT_H),
                    ("k3-bankrupt", K3_B), ("k3-healthy", K3_H)):
        for t in ts:
            if grp == "calibration":
                continue
            c = tick2cik.get(t)
            checks.append((grp, t, c))
    seen = set()
    for grp, t, cik in checks:
        if (grp, t) in seen or not cik:
            if not cik:
                val["%s/%s" % (grp, t)] = {"error": "unresolved (not in frame)"}
            continue
        seen.add((grp, t))
        ff = AUDIT / ("facts_%s_%s.json" % (t.replace("/", "-"), cik))
        if not ff.exists():
            f2 = fetch("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json" % cik,
                       AUDIT / ("facts_%s_%s.json" % (t.replace("/", "-"), cik)))
            if not f2:
                val["%s/%s" % (grp, t)] = {"error": "facts fetch failed"}
                continue
        try:
            facts = json.loads(Path(ff).read_text(encoding="utf-8"))
        except Exception:
            val["%s/%s" % (grp, t)] = {"error": "facts parse failed"}
            continue
        rec = {"ticker": t}
        rec.update(company_record(facts))
        rec["feature_class"] = feature_class(rec)
        val["%s/%s" % (grp, t)] = rec
        print("  %-22s %-6s class=%-10s alert=%s A=%s floor=%s cf_alert=%s" %
              (grp, t, rec["feature_class"], rec.get("alert"),
               None if rec.get("path_a") is None else "%.3f" % rec["path_a"],
               rec.get("neutral_floor_share"),
               (rec.get("cf") or {}).get("alert")))
    (AUDIT / "manifest.json").write_text(json.dumps(
        {p.name: sha256(p) for p in sorted(AUDIT.glob("*.json"))}, indent=1))

    out = {"config": {"prereg": PREREG, "seed": SEED, "cutoff": CUTOFF,
                      "signed": "operator 'run it' 2026-10-08",
                      "panel": {k: state[k] for k in
                                ("drawn", "extensions_used", "seed", "cutoff")},
                      "n_analyzed": len(rows)},
           "table1": t1, "table2": t2,
           "readings": {"table1": r1, "table2_degenerate": r2, "table2_real": r3},
           "companies": rows, "validation": val,
           "failures": state["failures"],
           "excluded_fin_count": len(state["excluded_fin"])}
    op = HERE / "thing1_frame_audit_results.json"
    if op.exists():
        op = HERE / ("thing1_frame_audit_results_%s.json"
                     % datetime.now().strftime("%Y%m%dT%H%M%S"))
    op.write_text(json.dumps(out, indent=1, default=str))
    log("results: %s" % op)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in ("collect", "all"):
        collect()
    if mode in ("analyze", "all"):
        analyze()
