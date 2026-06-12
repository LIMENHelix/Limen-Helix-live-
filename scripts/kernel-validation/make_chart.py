#!/usr/bin/env python3
"""Generate walks-30.html (LIMEN-styled timeline chart) from run30b_results.json."""
import json, os

HERE = os.path.dirname(__file__)
data = json.load(open(os.path.join(HERE, "run30b_results.json")))

NOTE = {
    "MRNA": "COVID vaccine boom→bust", "ENPH": "solar boom→bust",
    "MDLZ": "2012 Kraft split (P7)", "NCLH": "COVID debt-scaffold",
    "SNAP": "2022 crash", "RBLX": "post-IPO losses", "MCHP": "2024 downturn",
    "NEM": "Goldcorp + Newcrest acq", "LIN": "Praxair merger", "SHW": "Valspar acq",
    "VFC": "decline + Supreme sale", "CMI": "2023 emissions charge",
    "BKNG": "COVID → recovery", "AMAT": "semi-cap cycle", "LRCX": "semi-cap cycle",
    "MDT": "COVID + growth", "SYK": "COVID + acquisitions", "ISRG": "COVID + growth",
    "DOW": "chemical cycle", "FANG": "oil + Endeavor acq", "DRI": "COVID + Ruth's Chris",
    "ITW": "steady compounder", "REGN": "Eylea/Dupixent growth", "VRTX": "CF franchise growth",
    "DXCM": "growth + early losses", "PANW": "growth, profit blips", "CRWD": "hypergrowth",
    "STZ": "writedowns/slowdown", "CTVA": "post-spin (short data)",
}


def qnum(q):
    y, qq = q.split("Q")
    return int(y) + (int(qq) - 1) / 4.0


def cat(p):
    if "OUTgrow" in p or p.startswith("P6") or "P5" in p or "self-correct" in p or "P2/P5" in p:
        return "up"
    if "fracture" in p or "decline" in p or "headwind" in p or "rebasing" in p:
        return "down"
    if "scaffold" in p:
        return "scaf"
    if "acquisition" in p or "separation" in p or "spinoff" in p or "structural" in p or p.startswith("P1") or p.startswith("P7"):
        return "evt"
    return "oth"


COL = {"up": "#7fb069", "down": "#c25b56", "scaf": "#c9a94e", "evt": "#6a8caf", "oth": "#555"}
AX0, AX1 = 2011.0, 2026.5
rows = []
for d in sorted(data, key=lambda x: x["t"]):
    segs = ""
    for s, e, p in d["eps"]:
        if "Q" not in s:
            continue
        a, b = qnum(s), qnum(e) + 0.25
        left = (a - AX0) / (AX1 - AX0) * 100
        w = max((b - a) / (AX1 - AX0) * 100, 0.7)
        segs += '<span class="seg" style="left:%.2f%%;width:%.2f%%;background:%s" title="%s  %s–%s"></span>' % (left, w, COL[cat(p)], p, s, e)
    note = NOTE.get(d["t"], "")
    rows.append('<div class="r"><span class="tk">%s</span><span class="sc">%s</span><div class="bar">%s</div><span class="nt">%s</span></div>' % (d["t"], d["sector"], segs, note))

ticks = "".join('<span style="left:%.2f%%">%d</span>' % ((y - AX0) / (AX1 - AX0) * 100, y) for y in range(2012, 2027, 2))

html = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIMEN HELIX · 30 WALKS</title><style>
:root{--bg:#050810;--ink:#e8e3d9;--gold:rgba(201,169,78,1);--gold5:rgba(201,169,78,.5);--line:rgba(201,169,78,.14)}
*{box-sizing:border-box}html,body{background:var(--bg);color:var(--ink);font-family:ui-monospace,Menlo,Consolas,monospace;margin:0;line-height:1.4}
.wrap{max-width:1180px;margin:0 auto;padding:30px 20px 70px}
h1{font-size:19px;letter-spacing:3px;color:var(--gold);margin:0 0 4px}
.sub{color:var(--gold5);font-size:12px;letter-spacing:1px;margin-bottom:8px}
.verdict{border:1px solid var(--line);border-radius:7px;padding:12px 15px;margin:14px 0 8px;font-size:12px;color:var(--gold5)}
.verdict b{color:var(--ink)}
.axis{position:relative;height:16px;margin:18px 0 4px 230px}.axis span{position:absolute;font-size:10px;color:var(--gold5);transform:translateX(-50%)}
.r{display:flex;align-items:center;gap:0;height:22px;border-bottom:1px solid rgba(255,255,255,.03)}
.tk{width:54px;font-size:12px;color:var(--gold);flex:none}
.sc{width:90px;font-size:10px;color:var(--gold5);flex:none}
.bar{position:relative;flex:1;height:13px;background:rgba(255,255,255,.025);border-radius:3px;margin:0 10px}
.seg{position:absolute;top:0;height:13px;border-radius:2px;opacity:.92}
.nt{width:170px;font-size:10px;color:rgba(106,140,175,.95);flex:none;white-space:nowrap;overflow:hidden}
.lg{margin-top:18px;font-size:11px;color:var(--gold5);display:flex;gap:16px;flex-wrap:wrap}
.dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
</style></head><body><div class="wrap">
<h1>LIMEN HELIX — 30 WALKS (fresh validation)</h1>
<div class="sub">30 companies never used in building the engine · per-line, sector-relative, over time, with 8-K events · 2026-06</div>
<div class="verdict"><b>Result:</b> 24/30 matched documented history on a held-out set (Wilson 95% CI 62–91%) — <b>retrospective, not yet pre-registered</b>; it certifies today's core changes (smoothed growth + category-aware persistence) as description, not forecast. The engine SURFACED real arcs it had no way to know: <b>MRNA</b> COVID boom→bust, <b>ENPH</b> solar boom→bust, <b>MDLZ</b> the 2012 Kraft split, <b>NCLH</b> COVID debt-scaffold, <b>NEM</b> Goldcorp+Newcrest, <b>LIN</b> Praxair merger, <b>VFC</b> Supreme sale. Each bar is a company's phase WALK over time — it identifies &amp; explains; it does not forecast.</div>
<div class="axis">__TICKS__</div>
__ROWS__
<div class="lg">
<span><span class="dot" style="background:#7fb069"></span>building / coordinated / renewing</span>
<span><span class="dot" style="background:#c9a94e"></span>scaffolded (external capital)</span>
<span><span class="dot" style="background:#c25b56"></span>fracture / decline</span>
<span><span class="dot" style="background:#6a8caf"></span>event (acquisition / spinoff / branch)</span>
</div>
<div class="sub" style="margin-top:16px">Hover any segment for the phase + dates. Identifies &amp; explains; does not forecast.</div>
</div></body></html>"""
html = html.replace("__TICKS__", ticks).replace("__ROWS__", "\n".join(rows))
open(os.path.join(HERE, "..", "..", "walks-30.html"), "w", encoding="utf-8").write(html)
print("wrote walks-30.html (%d companies)" % len(data))
