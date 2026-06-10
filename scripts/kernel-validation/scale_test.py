#!/usr/bin/env python3
"""
scale_test.py — FCA-calibration pressure test at scale (~500 companies).

The False Claims Act gate requires we know the kernel's FALSE-FLAG RATE across a
broad universe, not a curated cohort. Runs the FCA-calibrated distress call:
  - SOLVENCY  (Altman Z''<1.1, market-veto'd)        — balance-sheet, always valid
  - LIQUIDITY (burning + runway<4q + current<1.05)   — always valid
  - TRAJECTORY/masking (composite>=1.1) — ONLY when IN the transition-SNR envelope
    (revenue contracting); ABSTAINS out-of-envelope (the COST/PEP calibration fix)

Universe = top ~500 by the SEC company-tickers file + the known-bankruptcy cohort
embedded (scored at event). Reports: distress-flag rate, abstain rate, the flagged
list (for spot-check), and recall on the embedded bankruptcies.
"""
import sys, os, json, urllib.request, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import altman, liquidity, marketcap, snr_envelope, fca_gate  # noqa: E402
from pit_trajectory import clean_df   # noqa: E402

MVE_VETO = 1.2

# known bankruptcies (label=1) embedded in the universe, scored at event
KNOWN_DISTRESS = [
    ("BBBY", "0000886158", "2023-04-23"), ("JCP", "0001166126", "2020-05-15"),
    ("CHK", "0000895126", "2020-06-28"), ("SHLDQ", "0001310067", "2018-10-15"),
    ("PIR", "0000278130", "2020-02-17"), ("WLL", "0001255474", "2020-04-01"),
    ("REV", "0000887921", "2022-06-15"), ("YELL", "0000716006", "2023-08-06"),
    ("HTZ", "0001657853", "2020-05-22"), ("ENDP", "0001593034", "2022-08-16"),
    ("AVYA", "0001418100", "2023-02-14"), ("RAD", "0000084129", "2023-10-15"),
    ("FSR", "0001720990", "2024-06-17"), ("SPWR", "0000867773", "2024-08-05"),
    ("BIG", "0000768835", "2024-09-09"), ("PRTY", "0001592058", "2023-01-17"),
]


def market_ok(facts, ticker, cutoff):
    _, ratio = marketcap.mve_to_liabilities(facts, ticker, cutoff)
    return ratio is not None and ratio > MVE_VETO


def assess(facts, ticker, cutoff, cik=None):
    """FCA-calibrated distress call. Returns (flag, tier, in_env, snr).
    FCA scope gate FIRST: financials (Altman invalid) -> EXCLUDED, never flagged."""
    if cik is not None:
        sc, _, _ = fca_gate.scope(cik)
        if sc == "exclude":
            return False, "excluded-financial", False, None
    snr, _ = snr_envelope.transition_snr(facts, cutoff)
    in_env = snr is not None and snr >= snr_envelope.ABSTAIN_SNR
    z = altman.z_from_facts(facts, cutoff)
    zval = None if z.get("error") else z["Z"]
    mok = None
    # solvency (balance-sheet, always valid; market-veto'd)
    if zval is not None and zval < 1.1:
        mok = market_ok(facts, ticker, cutoff)
        if not mok:
            return True, "solvency", in_env, snr
    # liquidity (always valid)
    liq = liquidity.liquidity(facts, cutoff)
    if (liq.get("burning") and liq.get("runway_q") is not None and liq["runway_q"] < 4
            and liq.get("current_ratio") is not None and liq["current_ratio"] < 1.05):
        return True, "liquidity", in_env, snr
    # trajectory/masking — ONLY if in the SNR envelope
    if in_env:
        dfc = clean_df(facts, cutoff)
        if dfc is not None:
            try:
                c, _, _ = lb.compute_composite_score(dfc, cutoff, lb.HOLDOUT_P3_ENTRY)
            except Exception:
                c = 0.0
            if c >= 1.1:
                if mok is None:
                    mok = market_ok(facts, ticker, cutoff)
                if not mok:
                    return True, "trajectory", in_env, snr
    return False, "clear", in_env, snr


def universe(n=500):
    url = "https://www.sec.gov/files/company_tickers.json"
    req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    out = []
    for k in sorted(d.keys(), key=lambda x: int(x))[:n]:
        e = d[k]
        out.append((e["ticker"], str(e["cik_str"]).zfill(10)))
    return out


def main():
    uni = universe(500)
    known = {t: (cik, ev) for (t, cik, ev) in KNOWN_DISTRESS}
    rows = []
    flagged, abstained, processed, excluded = [], 0, 0, 0
    print("FCA-calibration scale test — %d-company universe + %d known bankruptcies\n" % (len(uni), len(known)))
    for (t, cik) in uni:
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            continue
        flag, tier, in_env, snr = assess(facts, t, None, cik)
        if tier == "excluded-financial":
            excluded += 1
            continue
        processed += 1
        if not in_env:
            abstained += 1
        if flag:
            flagged.append((t, tier))
        rows.append({"t": t, "flag": flag, "tier": tier, "in_env": in_env})
        time.sleep(0.05)
    # recall on known bankruptcies (scored at event)
    caught = 0
    bk_results = []
    for (t, (cik, ev)) in known.items():
        facts = lb.fetch_sec_facts(cik)
        if not facts:
            continue
        flag, tier, in_env, snr = assess(facts, t, ev, cik)
        if flag:
            caught += 1
        bk_results.append((t, flag, tier))
        time.sleep(0.05)

    print("=== UNIVERSE CALIBRATION (n=%d in-scope; %d financials EXCLUDED) ===" % (processed, excluded))
    fr = len(flagged) / processed if processed else 0
    print("  distress-flagged: %d/%d = %.1f%%   (base rate of corporate distress ~5-15%%)" % (
        len(flagged), processed, fr * 100))
    print("  abstained (out of SNR envelope): %d/%d = %.1f%%" % (abstained, processed, abstained / processed * 100 if processed else 0))
    from collections import Counter
    tc = Counter(tier for (_, tier) in flagged)
    print("  flag tiers: %s" % dict(tc))
    print("\n  FLAGGED (spot-check for false positives):")
    print("   ", ", ".join("%s(%s)" % (t, tier[:3]) for (t, tier) in flagged[:60]))
    print("\n=== RECALL on known bankruptcies (scored at event) ===")
    print("  caught %d/%d = %.0f%%" % (caught, len(bk_results), caught / len(bk_results) * 100 if bk_results else 0))
    print("  misses:", [t for (t, f, _) in bk_results if not f])


if __name__ == "__main__":
    main()
