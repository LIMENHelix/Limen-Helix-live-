/**
 * assets/js/brain-view.js — the harness schematic.
 *
 * THE ONE INVARIANT
 * The only input to this renderer is a list of timestamped events from
 * /api/harness. Nothing animates that a recorded event did not cause. There is
 * no ambient motion and no code path here that can invent a run. An empty
 * ledger draws an unlit diagram and says so, because a busy-looking picture
 * with nothing behind it would be manufactured signal.
 *
 * WHY SVG AND NOT CANVAS
 * This is an engineering drawing, not a texture. Text has to stay crisp at any
 * zoom, every box has to be a real hit-testable object, and lines have to meet
 * their terminals exactly. Canvas gives none of that for free.
 *
 * ROUTING: TRUNK AND BREAKOUT
 * Stages are wired as a harness, not as a mesh. Each stage feeds one vertical
 * trunk; the trunk fans out to the next stage. Eleven sources into four targets
 * is fifteen short stubs and one trunk, not forty-four crossing lines.
 *
 * DECLARED vs OBSERVED
 *   dashed line, hollow box  = declared. It exists in the code. Nothing recorded.
 *   solid line, filled box   = observed. A real beat was recorded.
 * Never blended, because "a pipe exists here" and "something flows through it"
 * are different claims.
 *
 * DECAY IS SELF-CALIBRATING
 * Each job carries expectedGapMs from its own cron line. Live inside that gap,
 * starving to 3x, dead past it. A five-minute job and a weekly job are judged
 * on their own clocks, so no threshold was chosen to look good.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  var svg, gWire, gTrunk, gBox, gFlow, gLabel;
  var board = null, key = '', live = true;
  var seenSpike = {}, edgeCount = {}, packets = [];
  var selected = null;
  var layout = null;

  // Left to right. The veto is not a column: it is a bank of valves clamped
  // onto the lines leaving PROPOSAL, which is where the authority actually sits.
  var COLUMNS = [
    { role: 'relay',      title: 'RELAY',      sub: 'thalamus · signal in' },
    { role: 'regulation', title: 'REGULATION', sub: 'hypothalamus · set-points' },
    { role: 'proposal',   title: 'PROPOSAL',   sub: 'dlPFC · decides' },
    { role: 'motor',      title: 'MOTOR',      sub: 'acts on the world' }
  ];

  var COL_W = 208, BOX_H = 30, BOX_GAP = 7, HEAD_H = 40, COL_GAP = 132;
  var PAD_X = 46, PAD_Y = 74, BUS_DROP = 74;

  var C = {
    live: '#8fcbb6', starve: '#d6a95e', dead: '#8a6060',
    fail: '#d97070', never: '#5a5750', veto: '#c25b5b',
    wire: '#3a3f4a', wireLit: '#6f7a8c', text: '#d8d3c9', dim: '#7d786f',
    gold: '#c9a94e'
  };

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    return e;
  }
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }

  // ── boot ─────────────────────────────────────────────────────────────
  function init() {
    svg = document.getElementById('svg');
    gWire = el('g'); gTrunk = el('g'); gBox = el('g'); gFlow = el('g'); gLabel = el('g');
    [gWire, gTrunk, gBox, gFlow, gLabel].forEach(function (g) { svg.appendChild(g); });

    defs();
    document.getElementById('btnLive').addEventListener('click', function () {
      live = !live;
      var b = document.getElementById('btnLive');
      b.classList.toggle('on', live); b.textContent = live ? 'live' : 'paused';
    });
    document.getElementById('btnLive').classList.add('on');

    // Dismissing the inspector. Three ways out, because one is never enough:
    // click the diagram background, press Escape, or hit the close control.
    // Box clicks stopPropagation, so this only fires on empty space.
    svg.addEventListener('click', deselect);
    document.getElementById('wrap').addEventListener('click', function (ev) {
      if (ev.target.id === 'wrap') deselect();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') deselect();
    });

    wireGate();
    var stored = '';
    try { stored = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {}
    if (stored) {
      key = stored; openGate(false);
      load(function (ok, msg) {
        if (ok) return;
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) {}
        key = ''; openGate(true);
        document.getElementById('ge').textContent = msg || 'stored key no longer works';
      });
    } else openGate(true);

    window.addEventListener('resize', function () { if (board) render(); });
    setInterval(function () { if (live && key) load(); }, POLL_MS);
    requestAnimationFrame(tick);
  }

  function defs() {
    var d = el('defs');
    ['wire', 'lit'].forEach(function (kind) {
      var m = el('marker', { id: 'arw-' + kind, viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
      m.appendChild(el('path', { d: 'M0,1 L9,5 L0,9 z', fill: kind === 'lit' ? C.wireLit : C.wire }));
      d.appendChild(m);
    });
    svg.appendChild(d);
  }

  function wireGate() {
    var go = function () {
      var v = (document.getElementById('gk').value || '').trim();
      if (!v) return;
      key = v; document.getElementById('ge').textContent = 'checking…';
      load(function (ok, msg) {
        if (ok) { try { sessionStorage.setItem(KEY_STORE, key); } catch (e) {} openGate(false); }
        else document.getElementById('ge').textContent = msg || 'rejected';
      });
    };
    document.getElementById('gb').addEventListener('click', go);
    document.getElementById('gk').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }
  function openGate(show) {
    document.getElementById('gate').classList.toggle('hide', !show);
    if (!show) document.body.classList.add('opened');
  }

  // ── data ─────────────────────────────────────────────────────────────
  function load(cb) {
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&limit=120', { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        if (r.s === 401) { if (cb) cb(false, (r.j && r.j.error) || 'key rejected'); return; }
        if (r.s === 503) { if (cb) cb(false, (r.j && r.j.error) || 'not configured'); return; }
        if (!r.j || !r.j.ok) { if (cb) cb(false, (r.j && r.j.error) || 'error'); return; }
        ingest(r.j); render();
        if (cb) cb(true);
      })
      .catch(function (e) { if (cb) cb(false, 'network: ' + e.message); });
  }

  function ingest(p) {
    board = p;
    var byJob = {};
    (p.jobs || []).forEach(function (j) { byJob[j.job] = j; });
    (p.spikes || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (sp) {
      var sig = sp.at + '|' + sp.job;
      if (seenSpike[sig]) return;
      seenSpike[sig] = 1;
      var meta = byJob[sp.job];
      if (!meta) return;
      var vetoed = !!(sp.note && sp.note.indexOf('vetoed') === 0);
      edgeCount[sp.job] = (edgeCount[sp.job] || 0) + 1;
      packets.push({ job: sp.job, born: performance.now(), ok: sp.ok !== false, vetoed: vetoed });
    });
    var ks = Object.keys(seenSpike);
    if (ks.length > 4000) ks.slice(0, 2000).forEach(function (k) { delete seenSpike[k]; });
  }

  // ── state ────────────────────────────────────────────────────────────
  function stateOf(j) {
    if (j.observed.neverObserved) return 'never';
    if (j.observed.ok === false) return 'fail';
    var gap = j.declared.expectedGapMs, since = Date.now() - j.observed.at;
    if (!gap) return 'live';
    if (since <= gap) return 'live';
    if (since <= gap * 3) return 'starve';
    return 'dead';
  }
  function colorOf(s) { return C[s] || C.dim; }

  function jobsIn(role) {
    return (board.jobs || []).filter(function (j) { return j.declared.role === role; });
  }

  // ── layout ───────────────────────────────────────────────────────────
  function computeLayout() {
    var cols = COLUMNS.map(function (c, i) {
      var jobs = jobsIn(c.role);
      return { role: c.role, title: c.title, sub: c.sub, jobs: jobs,
               x: PAD_X + i * (COL_W + COL_GAP),
               h: HEAD_H + jobs.length * (BOX_H + BOX_GAP) };
    });
    var maxH = Math.max.apply(null, cols.map(function (c) { return c.h; }));
    cols.forEach(function (c) {
      c.y = PAD_Y + (maxH - c.h) / 2;
      c.boxes = c.jobs.map(function (j, k) {
        return { job: j, x: c.x, y: c.y + HEAD_H + k * (BOX_H + BOX_GAP), w: COL_W, h: BOX_H };
      });
    });
    var ret = jobsIn('return');
    var lastCol = cols[cols.length - 1];
    var busY = PAD_Y + maxH + BUS_DROP;
    return {
      cols: cols, maxH: maxH, busY: busY, ret: ret, retBoxes: [],
      width: lastCol.x + COL_W + PAD_X + 128,
      height: busY + 108
    };
  }

  // ── render ───────────────────────────────────────────────────────────
  function render() {
    layout = computeLayout();
    var L = layout;
    svg.setAttribute('viewBox', '0 0 ' + L.width + ' ' + L.height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    [gWire, gTrunk, gBox, gFlow, gLabel].forEach(clear);

    var observed = board.coverage.observed;
    document.getElementById('dark').classList.toggle('show', observed === 0);

    renderControls();
    for (var i = 0; i < L.cols.length - 1; i++) drawTrunk(L.cols[i], L.cols[i + 1], i);
    drawReturnBus(L);
    L.cols.forEach(drawColumn);
    drawWorld(L);
    renderInspector();
  }

  /**
   * One vertical trunk per stage boundary. Every box in the left stage stubs
   * into it, and it fans out to every box in the right stage. This is what
   * makes it a harness rather than a mesh, and it is why eleven sources feeding
   * four targets stays readable.
   */
  function drawTrunk(a, b, idx) {
    var tx = a.x + COL_W + COL_GAP / 2;
    var lit = a.boxes.some(function (bx) { return stateOf(bx.job) !== 'never'; });

    var ys = a.boxes.map(function (bx) { return bx.y + bx.h / 2; })
      .concat(b.boxes.map(function (bx) { return bx.y + bx.h / 2; }));
    if (!ys.length) return;
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);

    gTrunk.appendChild(el('line', { x1: tx, y1: y0, x2: tx, y2: y1,
      stroke: lit ? C.wireLit : C.wire, 'stroke-width': lit ? 2 : 1,
      'stroke-dasharray': lit ? null : '3 6' }));

    a.boxes.forEach(function (bx) {
      var s = stateOf(bx.job), on = s !== 'never';
      var y = bx.y + bx.h / 2;
      var p = 'M' + (bx.x + bx.w) + ',' + y + ' H' + tx;
      var path = el('path', { d: p, fill: 'none',
        stroke: on ? C.wireLit : C.wire, 'stroke-width': on ? 1.6 : 1,
        'stroke-dasharray': on ? null : '3 6' });
      gWire.appendChild(path);
      bx.outPath = p + ' V' + (b.boxes.length ? b.boxes[0].y + b.boxes[0].h / 2 : y);
    });

    b.boxes.forEach(function (bx) {
      var y = bx.y + bx.h / 2;
      var upstreamLit = a.boxes.some(function (s) { return stateOf(s.job) !== 'never'; });
      gWire.appendChild(el('path', { d: 'M' + tx + ',' + y + ' H' + bx.x, fill: 'none',
        stroke: upstreamLit ? C.wireLit : C.wire, 'stroke-width': upstreamLit ? 1.6 : 1,
        'stroke-dasharray': upstreamLit ? null : '3 6',
        'marker-end': 'url(#arw-' + (upstreamLit ? 'lit' : 'wire') + ')' }));
    });

    // The valve bank clamps onto the trunk feeding MOTOR. Drawn as real inline
    // valve symbols on the line, because that is what they are.
    if (b.role === 'motor') drawValveBank(tx, y0, y1, b);
  }

  /**
   * Valves sit ON the line, downstream of PROPOSAL and upstream of MOTOR, in a
   * bank of their own. Each is the standard two-triangle valve glyph: open ones
   * outlined, shut ones filled and barred. The bank is labelled as a separate
   * structure because the thing that can cancel an action is not the thing that
   * proposes it, and a diagram that put them in one box would say otherwise.
   */
  function drawValveBank(tx, y0, y1, motorCol) {
    var bx = tx + 30;
    var shut = motorCol.boxes.filter(function (b) { return b.job.valve && b.job.valve.open === false; });

    gLabel.appendChild(text(bx, y0 - 26, 'VETO', { size: 10.5, fill: C.veto, weight: 500, anchor: 'middle', ls: 2.4 }));
    gLabel.appendChild(text(bx, y0 - 14, shut.length ? shut.length + ' shut' : 'all open',
      { size: 9.5, fill: shut.length ? C.veto : C.dim, anchor: 'middle' }));

    motorCol.boxes.forEach(function (b) {
      if (!b.job.valve) return;
      var y = b.y + b.h / 2;
      var isShut = b.job.valve.open === false;
      var col = isShut ? C.veto : C.dim;
      var g = el('g', { class: 'valve', style: 'cursor:pointer' });
      // Two triangles meeting at a point: the P&ID valve.
      g.appendChild(el('path', { d: 'M' + (bx - 9) + ',' + (y - 7) + ' L' + bx + ',' + y + ' L' + (bx - 9) + ',' + (y + 7) + ' Z',
        fill: isShut ? C.veto : 'none', stroke: col, 'stroke-width': 1.4 }));
      g.appendChild(el('path', { d: 'M' + (bx + 9) + ',' + (y - 7) + ' L' + bx + ',' + y + ' L' + (bx + 9) + ',' + (y + 7) + ' Z',
        fill: isShut ? C.veto : 'none', stroke: col, 'stroke-width': 1.4 }));
      if (isShut) {
        g.appendChild(el('line', { x1: bx, y1: y - 13, x2: bx, y2: y + 13, stroke: C.veto, 'stroke-width': 2.6 }));
      }
      g.addEventListener('click', function (ev) { ev.stopPropagation(); selected = b.job; renderInspector(); });
      gBox.appendChild(g);
      b.valveX = bx;
    });
  }

  function drawColumn(c) {
    gLabel.appendChild(text(c.x, c.y + 12, c.title, { size: 11.5, fill: C.gold, weight: 500, ls: 2.6 }));
    gLabel.appendChild(text(c.x, c.y + 26, c.sub, { size: 9.5, fill: C.dim }));

    c.boxes.forEach(function (b) {
      var j = b.job, s = stateOf(j), col = colorOf(s), never = s === 'never';
      var shut = j.valve && j.valve.open === false;
      var g = el('g', { style: 'cursor:pointer' });

      g.appendChild(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 2,
        fill: never ? 'none' : 'rgba(255,255,255,0.032)',
        stroke: shut ? C.veto : (never ? C.never : 'rgba(255,255,255,0.13)'),
        'stroke-width': shut ? 1.6 : 1,
        'stroke-dasharray': never ? '4 4' : null }));

      // Status LED. Hollow when never observed: present in the drawing, not alive.
      g.appendChild(el('rect', { x: b.x + 9, y: b.y + b.h / 2 - 4, width: 8, height: 8, rx: 1,
        fill: never ? 'none' : col, stroke: never ? C.never : 'none', 'stroke-width': 1 }));

      var paid = j.cost && j.cost.cost === 'paid';
      g.appendChild(text(b.x + 25, b.y + b.h / 2 + 3.6, j.job,
        { size: 11, fill: never ? C.dim : (paid ? C.starve : C.text) }));

      // A currency mark on anything that costs money, so shutting a valve tells
      // you whether you just stopped spend or just stopped a free deterministic job.
      if (paid) {
        g.appendChild(text(b.x + b.w - 9, b.y + 11, '$',
          { size: 11, fill: C.starve, weight: 500, anchor: 'end' }));
        if (j.cost.killSwitch === false) {
          // Ungated paid work gets its own outline: a cap is not a switch.
          g.appendChild(el('rect', { x: b.x - 2.5, y: b.y - 2.5, width: b.w + 5, height: b.h + 5, rx: 3,
            fill: 'none', stroke: C.starve, 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: 0.75 }));
        }
      }

      var right = never ? 'never' : shortAgo(j.observed.sinceMs);
      g.appendChild(text(b.x + b.w - 9, b.y + b.h / 2 + 3.6, right,
        { size: 9.5, fill: s === 'fail' ? C.fail : C.dim, anchor: 'end' }));

      g.addEventListener('click', function (ev) { ev.stopPropagation(); selected = j; renderInspector(); });
      gBox.appendChild(g);
      b.cx = b.x + b.w; b.cy = b.y + b.h / 2;
    });
  }

  /** The consequence path: MOTOR acts, the world answers, RETURN grades it and
   *  feeds RELAY. Drawn dashed where nothing has been recorded on it, so the
   *  diagram cannot claim a closed loop the system has not actually closed. */
  function drawReturnBus(L) {
    var first = L.cols[0], last = L.cols[L.cols.length - 1];
    var lit = L.ret.some(function (j) { return !j.observed.neverObserved; });
    var stroke = lit ? C.wireLit : C.wire;
    var y = L.busY;
    var x0 = first.x + COL_W / 2, x1 = last.x + COL_W / 2;

    gWire.appendChild(el('path', {
      d: 'M' + x1 + ',' + (last.y + last.h + 6) + ' V' + y + ' H' + x0 + ' V' + (first.y + first.h + 6),
      fill: 'none', stroke: stroke, 'stroke-width': lit ? 1.8 : 1,
      'stroke-dasharray': lit ? null : '4 7', 'marker-end': 'url(#arw-' + (lit ? 'lit' : 'wire') + ')' }));

    gLabel.appendChild(text((x0 + x1) / 2, y - 12, 'RETURN · reafference',
      { size: 10.5, fill: lit ? C.gold : C.dim, weight: 500, anchor: 'middle', ls: 2 }));

    var bw = 178, gap = 18;
    var total = L.ret.length * bw + (L.ret.length - 1) * gap;
    var sx = (x0 + x1) / 2 - total / 2;
    L.ret.forEach(function (j, i) {
      var bx = sx + i * (bw + gap), by = y + 12;
      var s = stateOf(j), never = s === 'never';
      var g = el('g', { style: 'cursor:pointer' });
      g.appendChild(el('rect', { x: bx, y: by, width: bw, height: BOX_H, rx: 2,
        fill: never ? 'none' : 'rgba(255,255,255,0.032)',
        stroke: never ? C.never : 'rgba(255,255,255,0.13)',
        'stroke-dasharray': never ? '4 4' : null }));
      g.appendChild(el('rect', { x: bx + 9, y: by + BOX_H / 2 - 4, width: 8, height: 8, rx: 1,
        fill: never ? 'none' : colorOf(s), stroke: never ? C.never : 'none' }));
      g.appendChild(text(bx + 25, by + BOX_H / 2 + 3.6, j.job, { size: 11, fill: never ? C.dim : C.text }));
      g.appendChild(text(bx + bw - 9, by + BOX_H / 2 + 3.6, never ? 'never' : shortAgo(j.observed.sinceMs),
        { size: 9.5, fill: C.dim, anchor: 'end' }));
      g.addEventListener('click', function (ev) { ev.stopPropagation(); selected = j; renderInspector(); });
      gBox.appendChild(g);
      // Registered so beats from the return stage animate too. Without this
      // feed-record and feed-resolve would fire and show nothing, making the
      // one loop that closes look like the one that never runs.
      L.retBoxes.push({ job: j, cx: bx + bw, cy: by + BOX_H / 2, endX: bx + bw + 54 });
    });
  }

  function drawWorld(L) {
    var last = L.cols[L.cols.length - 1];
    var x = last.x + COL_W + 62, y = last.y + last.h / 2;
    gLabel.appendChild(text(x, y - 6, 'THE WORLD', { size: 10.5, fill: C.dim, weight: 500, anchor: 'middle', ls: 2.2 }));
    gLabel.appendChild(text(x, y + 8, 'posts · email · mail', { size: 9.5, fill: C.dim, anchor: 'middle' }));
    last.boxes.forEach(function (b) {
      var shut = b.job.valve && b.job.valve.open === false;
      gWire.appendChild(el('path', { d: 'M' + (b.x + b.w) + ',' + b.cy + ' H' + (x - 52), fill: 'none',
        stroke: shut ? C.veto : C.wire, 'stroke-width': 1.2,
        'stroke-dasharray': shut ? '2 4' : null,
        'marker-end': 'url(#arw-wire)' }));
    });
  }

  function text(x, y, s, o) {
    o = o || {};
    var t = el('text', { x: x, y: y, 'font-family': '"IBM Plex Mono",ui-monospace,monospace',
      'font-size': (o.size || 11), 'font-weight': o.weight || 400, fill: o.fill || C.text,
      'text-anchor': o.anchor || 'start', 'letter-spacing': o.ls || 0 });
    t.appendChild(document.createTextNode(s));
    return t;
  }

  function shortAgo(ms) {
    if (ms == null) return '—';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  }

  // ── flow packets: one per recorded beat, and only that ───────────────
  function tick() {
    if (layout) {
      clear(gFlow);
      var now = performance.now(), DUR = 1400;
      for (var i = packets.length - 1; i >= 0; i--) {
        var p = packets[i];
        var age = now - p.born;
        if (age > DUR) { packets.splice(i, 1); continue; }
        var box = findBox(p.job);
        if (!box) { packets.splice(i, 1); continue; }
        var t = age / DUR;
        // A vetoed run travelled as far as the valve and stopped there. Drawing
        // it reaching MOTOR would show an action that did not happen.
        var stopAt = p.vetoed && box.valveX ? 0.55 : 1;
        var tt = Math.min(t, stopAt);
        var x = box.cx + (nextX(box) - box.cx) * tt;
        var fade = t > 0.82 ? (1 - t) / 0.18 : 1;
        gFlow.appendChild(el('rect', { x: x - 3, y: box.cy - 3, width: 6, height: 6, rx: 1,
          fill: p.vetoed ? C.veto : (p.ok ? '#fff6e0' : C.fail), opacity: Math.max(0, fade) }));
      }
    }
    requestAnimationFrame(tick);
  }
  function findBox(job) {
    if (!layout) return null;
    for (var i = 0; i < layout.cols.length; i++) {
      var b = layout.cols[i].boxes.filter(function (x) { return x.job.job === job; })[0];
      if (b) { b._col = i; return b; }
    }
    var r = (layout.retBoxes || []).filter(function (x) { return x.job.job === job; })[0];
    if (r) { r._col = -1; return r; }
    return null;
  }
  function nextX(box) {
    if (box._col === -1) return box.endX;          // return-bus box
    var c = layout.cols[box._col];
    if (box._col >= layout.cols.length - 1) return c.x + COL_W + 40;
    return c.x + COL_W + COL_GAP / 2;
  }

  // ── inspector ────────────────────────────────────────────────────────
  function renderInspector() {
    var elx = document.getElementById('insp');
    if (!selected || !board) { elx.classList.remove('show'); return; }
    var j = (board.jobs || []).filter(function (x) { return x.job === selected.job; })[0] || selected;
    selected = j;
    var d = j.declared, o = j.observed, s = stateOf(j);
    var rm = (board.roles && board.roles[d.role]) || {};
    var STATE = { live: 'running to schedule', starve: 'late', dead: 'not running',
                  fail: 'failing', never: 'never observed' };
    var h = '<button class="x" id="ix" title="close (Esc)">×</button>';
    h += '<h3>' + j.job + '</h3>';
    h += '<div class="role">' + (rm.label || d.role) + ' · ' + (rm.structure || '') + '</div>';
    h += '<div class="st" style="color:' + colorOf(s) + '">' + (STATE[s] || s) + '</div>';
    h += row('schedule', d.schedule);
    h += row('defined in', d.source === 'vercel' ? 'vercel.json' : d.path);
    h += o.neverObserved
      ? '<div class="row"><span class="k">last run</span><span class="v never">never</span></div>'
      : row('last run', longAgo(o.sinceMs), o.ok === false);
    if (!o.neverObserved && o.ms != null) h += row('took', o.ms + ' ms');
    if (o.note) h += row('note', o.note, o.ok === false);

    // Money, stated before the valve button, because it is what makes shutting
    // that valve consequential.
    var money = j.cost || { cost: 'free' };
    if (money.cost === 'paid') {
      h += row('cost', 'PAID — ' + (money.provider || 'unknown provider'), true);
      if (money.model) h += row('model', money.model);
      h += row('kill switch', money.killSwitch === false ? 'NOT CHECKED' : 'respected', money.killSwitch === false);
      if (money.note) h += '<div class="note">' + money.note + '</div>';
    } else {
      h += row('cost', 'free — deterministic');
    }
    if (d.note) h += '<div class="note">' + d.note + '</div>';
    if (j.valve) {
      var shut = j.valve.open === false;
      h += '<div class="valve"><div class="lbl">Valve</div>'
        + '<button class="sw ' + (shut ? 'shut' : 'open') + '" id="vbtn">'
        + (shut ? 'OPEN THIS VALVE' : 'SHUT THIS VALVE') + '</button>'
        + '<div class="vstate">' + (shut
          ? 'Shut. The job still runs and still reports. It does not act.'
          : 'Open. This job acts on the world on its schedule.') + '</div></div>';
    }
    elx.innerHTML = h;
    elx.classList.add('show');
    var x = document.getElementById('ix');
    if (x) x.addEventListener('click', deselect);
    var b = document.getElementById('vbtn');
    if (b) b.addEventListener('click', function () { flip(j); });
  }

  function deselect() {
    selected = null;
    document.getElementById('insp').classList.remove('show');
  }

  /**
   * The control bar.
   *
   * The AI control deliberately shows TWO facts, not one. `LIMEN_AI_ENABLED` is
   * an environment variable that no request can change, and the runtime pause is
   * a Redis flag that flips instantly. Collapsing them into a single "AI: on/off"
   * would tell the operator they can reach something they cannot, and the first
   * time they hit the button and nothing happened they would stop trusting the
   * whole panel. So when the env boundary is shut, the button is disabled and the
   * page says plainly what has to happen in Vercel instead.
   */
  function renderControls() {
    var host = document.getElementById('controls');
    if (!board) { host.innerHTML = ''; return; }
    var ai = board.ai || {}, soc = board.social || {};
    var h = '';

    // ── AI spend ──────────────────────────────────────────────────────
    var aiCls = ai.spending ? 'live' : (ai.envEnabled ? 'off' : 'blocked');
    var aiTxt = ai.spending ? 'SPENDING' : (ai.reason || 'off').replace(/-/g, ' ').toUpperCase();
    h += '<div class="ctl"><span class="lab">AI spend</span>'
       + '<span class="val ' + aiCls + '">' + aiTxt + '</span>';
    if (ai.envEnabled) {
      h += ai.runtimePaused
        ? '<button class="go" id="aiGo">RESUME</button>'
        : '<button class="stop" id="aiStop">PAUSE</button>';
    } else {
      h += '<button class="stop" disabled title="needs a Vercel change">PAUSE</button>'
         + '<span class="why">' + (ai.needsVercel || '') + '</span>';
    }
    h += '</div>';

    // ── social posting ────────────────────────────────────────────────
    var sp = soc.paused === true, unread = soc.unreadable;
    h += '<div class="ctl"><span class="lab">Posting</span>'
       + '<span class="val ' + (unread ? 'blocked' : (sp ? 'off' : 'live')) + '">'
       + (unread ? 'UNREADABLE' : (sp ? 'PAUSED' : 'LIVE')) + '</span>'
       + (sp ? '<button class="go" id="socGo">RESUME</button>'
             : '<button class="stop" id="socStop">PAUSE</button>')
       + '</div>';

    // ── what costs money ──────────────────────────────────────────────
    var paid = (board.jobs || []).filter(function (j) { return j.cost && j.cost.cost === 'paid'; });
    var ungated = paid.filter(function (j) { return j.cost.killSwitch === false; });
    h += '<div class="ctl paid"><span class="coin">$</span><span class="lab">Paid jobs</span>'
       + '<span class="val">' + paid.length + ' of ' + (board.jobs || []).length + '</span>'
       + (paid.length ? '<span class="val" style="color:var(--dim)">' + paid.map(function (j) { return j.job; }).join(', ') + '</span>' : '')
       + (ungated.length ? '<span class="why">' + ungated.length + ' bypasses the kill switch</span>' : '')
       + '</div>';

    host.innerHTML = h;
    bind('aiStop', function () { post('&ai=pause'); });
    bind('aiGo', function () { post('&ai=resume'); });
    bind('socStop', function () { post('&social=pause'); });
    bind('socGo', function () { post('&social=resume'); });
  }
  function bind(id, fn) { var e = document.getElementById(id); if (e) e.addEventListener('click', fn); }
  function post(qs) {
    fetch('/api/harness?key=' + encodeURIComponent(key) + qs, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () {});
  }
  function row(k, v, bad) {
    return '<div class="row"><span class="k">' + k + '</span><span class="v' + (bad ? ' bad' : '') + '">' + v + '</span></div>';
  }
  function longAgo(ms) {
    if (ms == null) return '—';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' seconds ago';
    if (s < 3600) return Math.round(s / 60) + ' minutes ago';
    if (s < 86400) return Math.round(s / 3600) + ' hours ago';
    return Math.round(s / 86400) + ' days ago';
  }
  function flip(j) {
    var wantOpen = j.valve.open === false;
    var b = document.getElementById('vbtn');
    if (b) { b.disabled = true; b.textContent = '…'; }
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&valve=' + encodeURIComponent(j.job)
      + '&open=' + (wantOpen ? '1' : '0') + '&reason=' + encodeURIComponent('set from the harness view'),
      { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () { if (b) { b.disabled = false; b.textContent = 'failed, retry'; } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
