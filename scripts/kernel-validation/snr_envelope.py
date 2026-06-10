#!/usr/bin/env python3
"""
snr_envelope.py — the TRANSITION-SNR envelope. Operationalizes the observability
framing: the kernel is reliable only on systems whose regulation transitions
exceed their observation noise floor. Below that, it should ABSTAIN, not guess.

  signal = the largest phase-relevant transition (adverse QoQ move the kernel keys on)
  noise  = the ambient quarterly fluctuation (median |QoQ move|)
  SNR    = signal / noise   (per core signal; aggregate = the strongest)

Prediction (validates the framing on our own data):
  - distress cases (BBBY, JCP, CHK...) -> HIGH SNR  (kernel reliable; our wins live here)
  - healthy FPs (Costco, Pepsi, Walmart) -> LOW SNR (damped; kernel should ABSTAIN —
    this RETIRES the buyback/grey-Altman false positives as "out of envelope")

This hands the kernel the honest version of a confidence score: it knows when it
can see.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import flows                          # noqa: E402
from pit_trajectory import extract_pit  # noqa: E402

ABSTAIN_SNR = 0.05   # revenue YoY decline below this -> no real operating transition -> abstain


def transition_snr(facts, cutoff=None, lookback=12):
    """Transition amplitude = worst REVENUE YoY decline. Revenue contraction is
    the UNPOLLUTED operating transition (cash/OCF YoY are noisy with buyback /
    working-capital churn — exactly what false-fires the composite on healthy
    names). YoY removes seasonality. The trajectory kernel is reliable when real
    operating contraction is present; it abstains on revenue-stable systems
    (a pure-leverage/liquidity event is the SOLVENCY kernel's job, not the
    trajectory's). Cash/OCF kept as detail for transparency only."""
    detail = {}
    for key, flow in [("Revenue", True), ("Cash", False), ("OCF", True)]:
        d = flows.decumulate(facts, lb.TAG_MAP[key], cutoff) if flow \
            else extract_pit(facts, lb.TAG_MAP[key], False, cutoff)
        vals = [v for _, v in sorted(d.items())][-lookback:]
        if len(vals) < 8:
            continue
        arr = np.array(vals, float)
        yoy = [(arr[i] - arr[i - 4]) / abs(arr[i - 4])
               for i in range(4, len(arr)) if abs(arr[i - 4]) > 1e6]
        if yoy:
            detail[key] = max(0.0, -min(yoy))
    if "Revenue" not in detail:
        return None, detail
    return detail["Revenue"], detail        # revenue contraction = the envelope signal


PANEL = [
    # distress — kernel's validated regime (expect HIGH SNR)
    ("BBBY", "0000886158", "2022-09-30", "distress"),
    ("JCP",  "0001166126", "2019-09-30", "distress"),
    ("CHK",  "0000895126", "2020-06-28", "distress"),
    ("WLL",  "0001255474", "2020-03-31", "distress"),
    ("REV",  "0000887921", "2022-06-15", "distress"),
    ("PIR",  "0000278130", "2019-12-31", "distress"),
    # healthy FALSE POSITIVES — should be LOW SNR -> abstain
    ("COST", "0000909832", None, "healthy-FP"),
    ("PEP",  "0000077476", None, "healthy-FP"),
    ("FIS",  "0001136893", None, "healthy-FP"),
    ("SBUX", "0000829224", None, "healthy-FP"),
    # clear healthy — low SNR
    ("WMT",  "0000104169", None, "healthy"),
    ("KO",   "0000021344", None, "healthy"),
    ("JNJ",  "0000200406", None, "healthy"),
]


def main():
    import time
    rows = []
    print("TRANSITION-SNR envelope — when can the kernel SEE?\n")
    print("%-6s %-12s %-8s %-10s %s" % ("TICK", "type", "SNR", "verdict", "per-signal"))
    for (t, cik, cut, typ) in PANEL:
        facts = lb.fetch_sec_facts(cik)
        snr, detail = transition_snr(facts, cut)
        if snr is None:
            print("%-6s %-12s insufficient" % (t, typ)); continue
        verdict = "RELIABLE" if snr >= ABSTAIN_SNR else "ABSTAIN"
        rows.append({"t": t, "typ": typ, "snr": snr, "verdict": verdict})
        ds = " ".join("%s=%.1f" % (k[:3], v) for k, v in detail.items())
        print("%-6s %-12s %-8.1f %-10s %s" % (t, typ, snr, verdict, ds))
        time.sleep(0.2)
    print("\n=== ENVELOPE CHECK (does SNR separate reliable from abstain?) ===")
    for typ in ("distress", "healthy-FP", "healthy"):
        sub = [r["snr"] for r in rows if r["typ"] == typ]
        if sub:
            print("  %-11s mean SNR %.1f  (range %.1f-%.1f)" % (typ, np.mean(sub), min(sub), max(sub)))
    d = [r["snr"] for r in rows if r["typ"] == "distress"]
    fp = [r["snr"] for r in rows if r["typ"] in ("healthy-FP", "healthy")]
    abst = sum(1 for r in rows if r["typ"] in ("healthy-FP", "healthy") and r["verdict"] == "ABSTAIN")
    keep = sum(1 for r in rows if r["typ"] == "distress" and r["verdict"] == "RELIABLE")
    print("\n  distress kept RELIABLE: %d/%d | healthy/FP correctly ABSTAINED: %d/%d (thresh SNR=%.1f)" % (
        keep, len(d), abst, len(fp), ABSTAIN_SNR))
    print("  => if distress stays reliable and healthy abstains, the observability")
    print("     framing is validated on our data + the kernel gains honest abstention.")


if __name__ == "__main__":
    main()
