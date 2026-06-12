#!/usr/bin/env python3
"""
Render the EMERGENT STRUCTURE from universe_structure.json as a LIMEN-styled orbital
attractor map (pure SVG): P6 = central order-basin; every other phase is an excursion
out-and-back, sized by dwell, linked by transition frequency. Replaces the timeline
bars -> shows the design the grammar creates, not 30 separate rows.
"""
import json, os, math

HERE = os.path.dirname(__file__)
D = json.load(open(os.path.join(HERE, "universe_structure.json")))
dwell, current, trans, N = D["dwell"], D["current"], D["trans"], D["n"]

CX, CY, R = 500, 372, 250
CAT = {"P6": "up", "P2": "up", "P8": "up", "P5": "up",
       "P3": "down", "P3d": "down", "P3p": "down", "P4": "scaf",
       "P1": "evt", "P7": "evt", "P0": "null"}
COL = {"up": "#7fb069", "down": "#c25b56", "scaf": "#c9a94e", "evt": "#6a8caf", "null": "#7d7a70"}
NAME = {"P6": "ORDER", "P2": "RHYTHM", "P8": "CONSCIENCE", "P3d": "DECLINE",
        "P3": "FRACTURE", "P3p": "FRACTURE·profit", "P4": "SCAFFOLD", "P1": "DISTINCTION",
        "P7": "FORK"}
# screen angle measured clockwise from north
ANG = {"P2": 0, "P3d": 45, "P3": 90, "P3p": 135, "P4": 180, "P7": 225, "P1": 270, "P8": 315}

pos = {"P6": (CX, CY)}
for p, a in ANG.items():
    th = math.radians(a)
    pos[p] = (CX + R * math.sin(th), CY - R * math.cos(th))


def rad(p):
    return math.sqrt(dwell.get(p, 1)) * 1.62 + 8


edges = ""
for e in sorted(trans, key=lambda x: x["w"]):
    a, b, w = e["from"], e["to"], e["w"]
    if w < 6 or a not in pos or b not in pos:
        continue
    (x1, y1), (x2, y2) = pos[a], pos[b]
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    # bow the curve away from center so the two directions separate
    dx, dy = mx - CX, my - CY
    nrm = math.hypot(dx, dy) or 1
    bow = 26 if a < b else -26
    cx2, cy2 = mx + dx / nrm * bow - (y2 - y1) * 0.06, my + dy / nrm * bow + (x2 - x1) * 0.06
    op = min(0.16 + w / 90, 0.7)
    wd = max(w * 0.26, 1.1)
    edges += '<path d="M%.0f %.0f Q%.0f %.0f %.0f %.0f" stroke="%s" stroke-width="%.1f" fill="none" opacity="%.2f"/>\n' % (
        x1, y1, cx2, cy2, x2, y2, COL[CAT[b]], wd, op)

nodes = ""
for p, (x, y) in pos.items():
    r = rad(p)
    c = COL[CAT[p]]
    cur = current.get(p, 0)
    nodes += '<circle cx="%.0f" cy="%.0f" r="%.1f" fill="%s" fill-opacity="0.18" stroke="%s" stroke-width="1.5"/>\n' % (x, y, r, c, c)
    big = p == "P6"
    nodes += '<text x="%.0f" y="%.0f" text-anchor="middle" fill="%s" font-size="%d" font-weight="600" letter-spacing="1">%s</text>\n' % (
        x, y - (4 if big else 2), c, 20 if big else 13, p)
    nodes += '<text x="%.0f" y="%.0f" text-anchor="middle" fill="%s" font-size="%d" opacity="0.62" letter-spacing="1">%s</text>\n' % (
        x, y + (15 if big else 12), "#e8e3d9", 10 if big else 8, NAME.get(p, ""))
    if cur:
        nodes += '<text x="%.0f" y="%.0f" text-anchor="middle" fill="#c9a94e" font-size="9" opacity="0.85">%d now</text>\n' % (
            x, y + r + 11, cur)

top = sorted(trans, key=lambda x: -x["w"])[:6]
flowtxt = " · ".join("%s→%s %d" % (e["from"], e["to"], e["w"]) for e in top)

html = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIMEN HELIX · STRUCTURE</title><style>
:root{--bg:#050810;--ink:#e8e3d9;--gold:rgba(201,169,78,1);--gold5:rgba(201,169,78,.5);--line:rgba(201,169,78,.14)}
*{box-sizing:border-box}html,body{background:var(--bg);color:var(--ink);font-family:ui-monospace,Menlo,Consolas,monospace;margin:0;line-height:1.5}
.wrap{max-width:1040px;margin:0 auto;padding:30px 20px 70px}
h1{font-size:19px;letter-spacing:3px;color:var(--gold);margin:0 0 4px}
.sub{color:var(--gold5);font-size:12px;letter-spacing:1px;margin-bottom:10px}
.card{border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:10px 0;font-size:12px;color:var(--gold5)}
.card b{color:var(--ink)}
svg{display:block;margin:6px auto;max-width:100%}
.lg{font-size:11px;color:var(--gold5);display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:6px}
.dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
</style></head><body><div class="wrap">
<h1>LIMEN HELIX — THE STRUCTURE IT CREATES</h1>
<div class="sub">{N} large-caps, NOT hand-picked for their arcs · absolute mode (no sector groups) · phase dwell + transition flow</div>
<div class="card"><b>The design.</b> The grammar does not run as a one-way ladder P0→P10. For mature companies it is an
<b>attractor</b>: <b>P6 / ORDER</b> is the basin (node area = time spent there), and every other phase is an <b>excursion out and back</b> —
decline (P3d), acquisition (P1), deleverage (P8) orbit order and return to it. The breathing is real: <b>P6↔P3d</b> and <b>P6↔P1</b>
are the heaviest two-way flows. <b>Caveat (named, not hidden):</b> this sample is large-cap survivors, so P6-dominance is partly
selection — the linear ladder is what <i>young or dying</i> companies traverse; survivors orbit. Top flows: {FLOW}.</div>
<svg viewBox="0 0 1000 720" xmlns="http://www.w3.org/2000/svg">
<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="rgba(201,169,78,.10)" stroke-dasharray="3 6"/>
{EDGES}
{NODES}
</svg>
<div class="lg">
<span><span class="dot" style="background:#7fb069"></span>order · rhythm · conscience (up)</span>
<span><span class="dot" style="background:#c25b56"></span>fracture · decline (down)</span>
<span><span class="dot" style="background:#c9a94e"></span>scaffold</span>
<span><span class="dot" style="background:#6a8caf"></span>distinction · fork (event)</span>
</div>
<div class="sub" style="text-align:center;margin-top:14px">Node area = quarters spent · edge weight = transitions across {N} companies · &ldquo;N now&rdquo; = where each ends today. Identifies &amp; explains; does not forecast.</div>
</div></body></html>"""
html = html.replace("{N}", str(N)).replace("{FLOW}", flowtxt).replace("{CX}", str(CX)).replace("{CY}", str(CY)).replace("{R}", str(R)).replace("{EDGES}", edges).replace("{NODES}", nodes)
open(os.path.join(HERE, "..", "..", "structure.html"), "w", encoding="utf-8").write(html)
print("wrote structure.html")
