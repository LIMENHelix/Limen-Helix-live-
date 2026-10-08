#!/usr/bin/env python3
"""
shadow_prereg_v13.py — Shadow run for SHADOW_PREREGISTRATION v1.3 (signed 2026-10-07).

Tracks:
  (i)  release config: financial_phase_map via sec_adapter (P3 -> UNKNOWN)
  (b)  computation exactly as defined in 9.14(b): Thing 1 alert AND in-envelope
  (c3) event-shapedness: no detection on RECOVERED hard negatives
  (c4) earliness, REPORT-ONLY: same pipeline at cutoff = filing - 2 quarters

Faithfulness notes (run record, per prereg §8.4):
- SEC identity: limenhelix@gmail.com (declared; never the placeholder).
- All raw SEC JSON cached under shadow_cache/ with SHA-256 manifest.
- Thing 1 pipeline replicates python_runtime/limen_app.py score() with PIT data
  (quarters <= cutoff). The locked file limen_backtest.py is never modified.
- STALENESS ANCHOR SHIM: assess_envelope's §4.2 gate calls datetime.now();
  for historical cutoffs "now" is anchored at the cutoff via a runtime module
  attribute swap (limen_app.datetime), the same class of runtime patching as
  the pre-registered harness's fetcher swaps. No file is modified.
- Verdicts: k = correct calls; Wilson via held_out_test.wilson; PASS = LB>=0.60
  both sides + criteria hold; FAIL = UB < 0.60 either side; else UNDERPOWERED.
  FAIL/UNDERPOWERED keep P3 = UNKNOWN_ABSTAINED. Accuracy reported, not a gate.
"""

import json
import hashlib
import os
import sys
import time
import random
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(REPO))                       # python_runtime.* namespace pkgs
sys.path.insert(0, str(REPO / "python_runtime"))    # limen_app (top-level module)
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing1"))
sys.path.insert(0, str(REPO / "python_runtime" / "helix_app" / "thing2"))
sys.path.insert(0, str(HERE))                       # held_out_test, pit_trajectory

CACHE = HERE / "shadow_cache"
CACHE.mkdir(exist_ok=True)
UA = {"User-Agent": "limenhelix@gmail.com", "Accept-Encoding": "gzip, deflate"}

# frozen-ticker names from held_out_test.py's own comments (SEC search keys);
# EXACT conformed names only — generic substrings match wrong entities
# (learned in-run: "EXPRESS" matched FROZEN FOOD EXPRESS INDUSTRIES).
DELISTED_NAMES = {
    "WLL": ["WHITING PETROLEUM"],
    "DO":  ["DIAMOND OFFSHORE DRILLING"],
    "FTR": ["FRONTIER COMMUNICATIONS CORP", "FRONTIER COMMUNICATIONS CORPORATION"],
    "MNK": ["MALLINCKRODT"],
    "YELL": ["YELLOW CORP", "YELLOW CORPORATION"],
    "TUEM": ["TUESDAY MORNING"],
    "EXPR": ["EXPRESS, INC", "EXPRESS INC", "EXP OLDCO"],
}

import requests  # noqa: E402

import limen_app  # noqa: E402  (stubs matplotlib/sklearn, imports locked kernel)
import limen_backtest as lb  # noqa: E402
from held_out_test import wilson  # noqa: E402
import sec_adapter  # noqa: E402

# --- frozen cohorts (held_out_test.py, pre-registered 2026-06-12) ---
BANKRUPT = [  # (ticker, PIT cutoff BEFORE filing, outcome)
    ("HTZ", "2020-03-31"), ("VAL", "2020-06-30"), ("WLL", "2020-03-31"),
    ("DO",  "2020-03-31"), ("FTR", "2020-03-31"), ("MNK", "2020-06-30"),
    ("YELL", "2023-06-30"), ("TUEM", "2022-12-31"), ("EXPR", "2023-12-31"),
]
HEALTHY = ["LMT", "GD", "NOC", "UNP", "CSX", "NSC", "ADP", "PAYX", "WM"]
HARD_NEG = ["CAR", "M", "XOM", "SCHW", "CCL", "AAL", "NCLH", "RCL", "UAL"]
TODAY = "2026-10-07"

REPO_RECORDED_CIKS = {c["ticker"]: c["cik"] for c in lb.DISTRESS + lb.CONTROLS}


# ---------------------------------------------------------------- fetch/cache
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
            time.sleep(0.15)
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code == 200:
                dest.write_bytes(r.content)
                return dest
            time.sleep(2 ** a)
        except Exception:
            time.sleep(2 ** a)
    return None


def resolve_ciks(tickers):
    tf = fetch("https://www.sec.gov/files/company_tickers.json", CACHE / "company_tickers.json")
    m = {}
    if tf:
        for v in json.loads(tf.read_text()).values():
            m[v["ticker"].upper()] = str(v["cik_str"]).zfill(10)
    # frozen-ticker names from held_out_test.py's own comments (SEC search keys)
    DELISTED_NAMES = {
        "WLL": "Whiting Petroleum", "DO": "Diamond Offshore Drilling",
        "FTR": "Frontier Communications", "MNK": "Mallinckrodt",
        "YELL": "Yellow Corporation", "TUEM": "Tuesday Morning",
        "EXPR": "Express",
    }
    out = {}
    source = {}
    for t in tickers:
        if t in REPO_RECORDED_CIKS:
            # calibration-cohort entities (faithful to "the calibration controls
            # at current readings"); ticker files may map the ticker to a
            # reorganized successor with thin history (observed: XOM)
            out[t] = REPO_RECORDED_CIKS[t]
            source[t] = "repo limen_backtest cohort"
        elif t in m:
            out[t] = m[t]
            source[t] = "company_tickers.json"
        elif t in DELISTED_NAMES:
            c = resolve_delisted(t)
            if c:
                out[t] = c
                source[t] = "sec efts search: ticker %s" % t
    resolve_ciks.sources = source
    return out


def resolve_delisted(ticker):
    """SEC EDGAR full-text search (efts), validated against EXACT conformed names.

    Acceptance: a hit passes only if one of the frozen conformed names appears
    in its SEC display_names, or the delisted ticker+'Q' does (TUEMQ pattern).
    Among passing hits, prefer the period_ending nearest the frozen-cutoff
    cluster (2020-2023). No unvalidated top hits are used.
    """
    names = [n.upper() for n in DELISTED_NAMES.get(ticker, [])]
    queries = ['"%s"' % n for n in DELISTED_NAMES.get(ticker, [])]
    queries.append('"%s"' % ticker)
    validated = []
    for q in queries:
        cache = CACHE / ("efts_%s_%s.json" % (ticker, abs(hash(q)) % 9999))
        try:
            if cache.exists():
                data = json.loads(cache.read_text())
            else:
                time.sleep(0.15)
                from urllib.parse import quote
                url = "https://efts.sec.gov/LATEST/search-index?q=%s&dateRange=all" % quote(q)
                r = requests.get(url, headers=UA, timeout=30)
                if r.status_code != 200:
                    continue
                cache.write_bytes(r.content)
                data = r.json()
            for h in data.get("hits", {}).get("hits", []):
                src = h.get("_source", {})
                dns = [d.upper() for d in (src.get("display_names") or [])]
                ok = any(n in d for n in names for d in dns)
                ok = ok or any((ticker + "Q") in d for d in dns)
                if not ok:
                    continue
                ciks = src.get("ciks") or []
                if not ciks:
                    continue
                try:
                    pe = int(str(src.get("period_ending", "2021"))[:4])
                except Exception:
                    pe = 2021
                validated.append((abs(pe - 2021), str(ciks[0]).zfill(10),
                                  (src.get("display_names") or [""])[0]))
        except Exception:
            continue
    if validated:
        validated.sort()
        return validated[0][1]
    return None


def load_company(ticker, cik):
    c10 = cik.zfill(10)
    f = fetch("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json" % c10,
              CACHE / ("facts_%s_%s.json" % (ticker, c10)))
    s = fetch("https://data.sec.gov/submissions/CIK%s.json" % c10,
              CACHE / ("subs_%s_%s.json" % (ticker, c10)))
    facts = json.loads(f.read_text()) if f else None
    sic = 0
    if s:
        try:
            raw = json.loads(s.read_text()).get("sic")
            sic = int(raw) if raw not in (None, "") else 0
        except Exception:
            sic = 0
    return facts, sic


# ------------------------------------------------------- Thing 1 PIT scoring
class _AnchoredDT(datetime):
    _anchor = None

    @classmethod
    def now(cls, tz=None):
        return cls.strptime(cls._anchor, "%Y-%m-%d") if cls._anchor else datetime.now(tz)


def _cut_yq(cutoff):
    d = datetime.strptime(cutoff, "%Y-%m-%d")
    return (d.year, (d.month - 1) // 3 + 1)


def _minus_quarters(cutoff, n):
    y, q = _cut_yq(cutoff)
    q -= n
    while q < 1:
        q += 4
        y -= 1
    m = q * 3
    day = {3: 31, 6: 30, 9: 30, 12: 31}[m]
    return "%04d-%02d-%02d" % (y, m, day)


def t1_detection(facts, sic, cutoff):
    """Replicates limen_app.score() PIT at cutoff. Returns dict."""
    data = {
        "Revenue": lb.extract_quarterly_series(facts, lb.TAG_MAP["Revenue"], "Revenue", True),
        "OCF": lb.extract_quarterly_series(facts, lb.TAG_MAP["OCF"], "OCF", True),
        "Cash": lb.extract_quarterly_series(facts, lb.TAG_MAP["Cash"], "Cash", False),
    }
    dc = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtCurrent"], "DC", False)
    dl = lb.extract_quarterly_series(facts, lb.TAG_MAP["DebtLong"], "DL", False)
    all_q = sorted(set(list(dc.keys()) + list(dl.keys())))
    data["Debt"] = {q: dc.get(q, 0) + dl.get(q, 0) for q in all_q}

    cyq = _cut_yq(cutoff)
    pit = {m: {q: v for q, v in s.items() if q <= cyq} for m, s in data.items()}
    dc_p = {q: v for q, v in dc.items() if q <= cyq}
    dl_p = {q: v for q, v in dl.items() if q <= cyq}
    presence = {
        "revenue_quarters": len(pit["Revenue"]), "ocf_quarters": len(pit["OCF"]),
        "cash_quarters": len(pit["Cash"]), "debt_quarters": len(pit["Debt"]),
        "dc_coverage_quarters": len(dc_p), "dl_coverage_quarters": len(dl_p),
        "dc_coverage_in_window": sum(1 for q in dc_p if q[0] >= 2015),
        "dl_coverage_in_window": sum(1 for q in dl_p if q[0] >= 2015),
    }
    df = lb.compute_all_features(pit, {})
    if df is None or df.empty:
        return {"error": "no quarterly data"}
    df = lb.score_all_phases(df)
    df = lb.analyse_trajectory(df)
    composite, first_q, det = lb.compute_composite_score(df, event_str=cutoff, p3_entry=limen_app.P3_ENTRY_FROZEN)
    pa, pb, pc = (float(det.get(k, 0)) for k in ("path_a", "path_b", "path_c"))
    alert = (pa >= limen_app.THRESH_A) or (pb >= limen_app.THRESH_B) or (pc >= limen_app.THRESH_C)

    # assess_envelope imports datetime LOCALLY (limen_app.py:163), so the
    # anchor is injected via sys.modules for the duration of the call —
    # the locked kernel and every file on disk stay untouched.
    import types as _types
    real_dt_module = sys.modules.get("datetime")
    shim = _types.ModuleType("datetime")
    shim.datetime = _AnchoredDT
    shim.date = real_dt_module.date if real_dt_module else None
    _AnchoredDT._anchor = cutoff
    sys.modules["datetime"] = shim
    try:
        env = limen_app.assess_envelope(df, presence, sic, path_c=pc)
    finally:
        if real_dt_module is not None:
            sys.modules["datetime"] = real_dt_module
        _AnchoredDT._anchor = None

    return {
        "alert": bool(alert), "in_envelope": bool(env["in_envelope"]),
        "envelope_status": env["status"], "composite": composite,
        "paths": {"a": pa, "b": pb, "c": pc},
        "detection": bool(alert and env["in_envelope"]),
        "quarters": len(df),
    }


def fpm_reading(facts, cutoff):
    v = sec_adapter.evaluate_company(facts, cutoff)
    return {"status": v.status, "phase": v.phase, "mode": v.mode, "reason": v.reason}


# ---------------------------------------------------------------------- main
def main():
    print("=" * 68)
    print("SHADOW RUN — prereg v1.3 (signed 2026-10-07)")
    print("=" * 68)
    tickers = [t for t, _ in BANKRUPT] + HEALTHY + HARD_NEG
    ciks = resolve_ciks(tickers)
    missing = [t for t in tickers if t not in ciks]
    if missing:
        print("UNRESOLVED CIKs (skipped, reported): %s" % ",".join(missing))

    companies = {}
    for grp, ts in (("bankrupt", [t for t, _ in BANKRUPT]),
                    ("healthy", HEALTHY), ("hard_neg", HARD_NEG)):
        for t in ts:
            if t not in ciks:
                continue
            facts, sic = load_company(t, ciks[t])
            companies[t] = {"group": grp, "cik": ciks[t], "sic": sic, "facts": facts}
            print("loaded %-5s group=%-9s sic=%s facts=%s" %
                  (t, grp, sic, "ok" if facts else "NONE"))

    cutoffs = {t: c for t, c in BANKRUPT}
    results = []
    for t, co in companies.items():
        if co["facts"] is None:
            results.append({"ticker": t, "group": co["group"], "error": "no facts"})
            continue
        cutoff = cutoffs.get(t, TODAY)
        t1 = t1_detection(co["facts"], co["sic"], cutoff)
        fpm = fpm_reading(co["facts"], cutoff)
        rec = {"ticker": t, "group": co["group"], "cutoff": cutoff,
               "t1": t1, "fpm": fpm}
        if co["group"] == "bankrupt":
            rec["c4_cutoff"] = _minus_quarters(cutoff, 2)
            rec["c4"] = t1_detection(co["facts"], co["sic"], rec["c4_cutoff"])
        results.append(rec)
        det = t1.get("detection")
        print("%-5s %-9s cutoff=%s detection=%s envelope=%s alert=%s fpm=%s" %
              (t, co["group"], cutoff, det, t1.get("envelope_status"),
               t1.get("alert"), fpm["status"]))

    # ---- verdicts ----
    def dets(group):
        return [r["t1"]["detection"] for r in results
                if r.get("group") == group and "t1" in r and "detection" in r["t1"]]

    bk, hn = dets("bankrupt"), dets("healthy")
    k_sens = sum(1 for d in bk if d)
    k_spec = sum(1 for d in hn if not d)   # correct calls = rejections
    s_lo, s_hi = wilson(k_sens, len(bk))[1], wilson(k_sens, len(bk))[2]
    p_lo, p_hi = wilson(k_spec, len(hn))[1], wilson(k_spec, len(hn))[2]

    def verdict(lo, hi):
        if lo >= 0.60:
            return "PASS"
        if hi < 0.60:
            return "FAIL"
        return "UNDERPOWERED"

    c3 = dets("hard_neg")
    c4 = [r["c4"]["detection"] for r in results if r.get("c4") and "detection" in r["c4"]]

    out = {
        "config": {"prereg": "v1.3", "signed": "2026-10-07", "p3_entry": 0.59,
                   "thresh": {"A": 1.1, "B": 1.5, "C": 1.5},
                   "identity": "limenhelix@gmail.com",
                   "staleness": "anchored at cutoff via runtime limen_app.datetime shim",
                   "unresolved_ciks": missing},
        "sensitivity": {"n": len(bk), "k": k_sens, "wilson_lb": s_lo, "wilson_ub": s_hi,
                        "verdict": verdict(s_lo, s_hi)},
        "specificity": {"n": len(hn), "k": k_spec, "wilson_lb": p_lo, "wilson_ub": p_hi,
                        "verdict": verdict(p_lo, p_hi)},
        "criterion3_hard_negatives": {"n": len(c3), "detections": sum(1 for d in c3 if d)},
        "criterion4_earliness_REPORT_ONLY": {"n": len(c4), "k": sum(1 for d in c4 if d),
                                             "wilson": list(wilson(sum(1 for d in c4 if d), len(c4)))},
        "companies": results,
    }
    op = HERE / "shadow_prereg_v13_results.json"
    op.write_text(json.dumps(out, indent=2, default=str))
    manifest = {p.name: sha256(p) for p in sorted(CACHE.glob("*.json"))}
    (CACHE / "manifest.json").write_text(json.dumps(manifest, indent=1))

    print("\n" + "=" * 68)
    print("SENSITIVITY  n=%d k=%d  Wilson[%.3f, %.3f] -> %s" % (len(bk), k_sens, s_lo, s_hi, verdict(s_lo, s_hi)))
    print("SPECIFICITY  n=%d k=%d  Wilson[%.3f, %.3f] -> %s" % (len(hn), k_spec, p_lo, p_hi, verdict(p_lo, p_hi)))
    print("CRITERION 3  hard negatives with detection: %d/%d" % (sum(1 for d in c3 if d), len(c3)))
    print("CRITERION 4  (report only) detections at filing-2q: %d/%d" % (sum(1 for d in c4 if d), len(c4)))
    print("results: %s" % op)
    print("manifest: %s" % (CACHE / "manifest.json"))


if __name__ == "__main__":
    main()
