#!/usr/bin/env python3
"""
phase_walk.py — THE decisive test: does the P0-P10 grammar produce COHERENT
trajectories, or is the per-quarter dominant phase argmax-noise?

For known cases, extract the kernel's per-quarter phase scores (p0..p10), print
the dominant-phase sequence over time, and measure "smoothness" = fraction of
quarter-to-quarter steps that stay in the same or an adjacent phase index. A
coherent attractor walk is smooth and (for distress) drifts toward P3/P7; pure
noise jumps randomly across the 11 phases (expected smoothness ~3/11 ≈ 0.27).
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
from pit_trajectory import clean_df   # noqa: E402

PHASES = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]

CASES = [
    ("JCP",  "0001166126", "slow retail decline -> expect drift into p3/p7"),
    ("BBBY", "0000886158", "masking -> low present, p3 internal"),
    ("CHK",  "0000895126", "commodity-cycle solvency fail"),
    ("WMT",  "0000104169", "healthy -> expect stable low phases"),
    ("AAPL", "0000320193", "healthy -> stable"),
    ("REV",  "0000887921", "Revlon leverage fail"),
]


def dominant_seq(df):
    seq = []
    for _, row in df.iterrows():
        vals = [(row.get(p, 0.0) or 0.0) for p in PHASES]
        seq.append(int(max(range(11), key=lambda i: vals[i])))
    return seq


def smoothness(seq):
    if len(seq) < 2:
        return None
    adj = sum(1 for a, b in zip(seq, seq[1:]) if abs(a - b) <= 1)
    return adj / (len(seq) - 1)


def main():
    print("Dominant-phase walk per quarter (coherent attractor vs argmax-noise)\n")
    print("  Random-baseline smoothness ~0.27; coherent walk >> that.\n")
    sm_distress, sm_healthy = [], []
    for (t, cik, note) in CASES:
        facts = lb.fetch_sec_facts(cik)
        df = clean_df(facts, None)
        if df is None or df.empty:
            print("%-6s no data" % t); continue
        seq = dominant_seq(df)
        sm = smoothness(seq)
        walk = "".join(str(p) if p < 10 else "X" for p in seq)  # X = p10
        print("%-6s %s" % (t, note))
        print("       walk: %s   smoothness=%.2f  (n=%d q)" % (walk, sm, len(seq)))
        # phase residency
        from collections import Counter
        res = Counter(seq)
        top = ", ".join("p%d:%d" % (p, n) for p, n in res.most_common(4))
        print("       residency: %s" % top)
        (sm_healthy if t in ("WMT", "AAPL") else sm_distress).append(sm)
        time.sleep(0.2)
    av = lambda x: sum(x) / len(x) if x else 0
    print("\n  mean smoothness — distress %.2f | healthy %.2f | random ~0.27" % (av(sm_distress), av(sm_healthy)))
    print("  Coherent grammar => smoothness >> 0.27 AND distress walks drift to p3/p7.")
    print("  Decoration => smoothness ~0.27, residency scattered, no drift.")


if __name__ == "__main__":
    main()
