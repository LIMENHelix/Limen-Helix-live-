/**
 * assets/js/harness-sheet.js — the system flow chart.
 *
 * WHAT CHANGED AND WHY
 * The first version drew all 254 files as pins on one 3,800-unit sheet. Every
 * conductor was correct and none of it was readable: fitting that sheet to a
 * browser window scales 8px labels down to about 4px. Completeness at the cost
 * of legibility is not a diagram, it is a wall.
 *
 * So the sheet is now a flow chart of SIXTEEN boxes, one per subsystem, joined
 * by 48 aggregate conductors instead of 506 individual ones. Each box states how
 * many files it holds and how much traffic it carries. Click one and it opens in
 * place: its files become individual pins, and every conductor touching it
 * splits from the aggregate into the real per-file wires. Close it and they
 * collapse back.
 *
 * NOTHING ABOUT THE UNDERLYING GRAPH CHANGED. The same derived data from
 * scripts/build-harness-graph.js drives both levels: an aggregate edge is a
 * count of real conductors, never an estimate, and opening a box shows exactly
 * the wires that count was made of.
 *
 * MOTION IS STILL EVIDENCE
 * A pulse is one recorded job run or one observed store change. It travels
 * whichever edge is currently drawn, aggregate or detailed. There is no idle
 * animation: if nothing has run and no store has changed, the chart is still.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  // ── geometry, in sheet units ──────────────────────────────────────────────
  var BW = 320;          // collapsed box width
  var BH = 120;          // collapsed box height
  var HDR = 46;          // header band inside an opened box
  var ROW = 19;          // one file row when opened
  var PADB = 10;
  var COL_GAP = 150;
  var BLK_GAP = 46;
  var PIN_COL = 210;     // width of one file column inside an opened box
  var MAX_ROWS = 22;     // rows before an opened box grows a second file column

  /**
   * Columns are the flow, left to right: world in, the scheduled spine, the
   * twenty domains and what senses them, the money path, the outward motors,
   * world out. The shared library sits on its own band because every column
   * requires it.
   *
   * FIVE columns, not eight. Eight made the chart 3,400 units wide against 670
   * tall, and fitting a 5:1 sheet into a 1.6:1 window letterboxes it into a thin
   * unreadable strip. Stacking more per column keeps the aspect near the shape
   * of a screen, which is what makes the titles legible without zooming.
   */
  var COLUMNS = [
    ['WORLDIN', 'INGEST', 'RETURN'],
    ['WORKER', 'PLAT', 'BODY'],
    ['DOMAIN', 'STRESS', 'COGNIT', 'SCORE'],
    ['OPPTY', 'REVENUE', 'HOME', 'OPS'],
    ['PUBLISH', 'AI', 'WORLDOUT']
  ];
  var BOTTOM_BUS = ['LIB', 'UNFILED'];

  var C = {
    data: '#5fb3a1', module: '#4a5364', world: '#d6a95e', dead: '#8a5f5f',
    ink: '#d8d3c9', dim: '#8b857b', faint: '#5a564f',
    gold: '#c9a94e', goldGhost: 'rgba(201,169,78,0.18)'
  };

  // ── state ─────────────────────────────────────────────────────────────────
  var svg, gGrid, gWire, gBox, gPulse;
  var key = '', graph = null, scheduled = {};
  var board = null, seenSpike = {}, seenTouch = null;
  var regions = [], regionOf = {}, pinIndex = {};
  var edges = [], edgeOfConductor = {};
  var conductors = [];
  var open = {};                       // regionId -> true when opened
  var view = { x: 0, y: 0, w: 1000, h: 1000 };
  var extent = { w: 0, h: 0 };
  var show = { data: true, module: false, world: true };
  var selected = null, findTerm = '';
  var pulses = [], queue = [];
  var PULSE_CAP = 140, SPREAD_MS = 1800;

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    return e;
  }
  function clear(g) { while (g && g.firstChild) g.removeChild(g.firstChild); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function text(x, y, str, o) {
    o = o || {};
    var t = el('text', {
      x: x, y: y, fill: o.fill || C.ink, 'font-size': o.size || 13,
      'font-weight': o.weight || 400, 'letter-spacing': o.ls != null ? o.ls : 0,
      'text-anchor': o.anchor || 'start', 'font-family': "'IBM Plex Mono',ui-monospace,monospace",
      opacity: o.opacity != null ? o.opacity : 1, 'pointer-events': 'none'
    });
    t.textContent = str;
    return t;
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function init() {
    svg = document.getElementById('sheet');
    var defs = el('defs');
    defs.innerHTML =
      '<filter id="glow" x="-320%" y="-320%" width="740%" height="740%">' +
      '<feGaussianBlur stdDeviation="2.6" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>';
    svg.appendChild(defs);
    gGrid = el('g'); gWire = el('g'); gBox = el('g'); gPulse = el('g');
    [gGrid, gWire, gBox, gPulse].forEach(function (g) { svg.appendChild(g); });

    wireGate(); wireControls(); wirePanZoom();

    var stored = '';
    try { stored = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {}
    if (stored) {
      key = stored;
      start(function (ok, msg) {
        if (ok) return;
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) {}
        key = ''; gate(true);
        document.getElementById('ge').textContent = msg || 'stored key no longer works';
      });
    } else gate(true);

    window.addEventListener('resize', function () { if (graph) { view.h = view.w * ratio(); apply(); } });
    requestAnimationFrame(tick);
  }

  function gate(showIt) { document.getElementById('gate').classList.toggle('hide', !showIt); }

  function wireGate() {
    var go = function () {
      var v = (document.getElementById('gk').value || '').trim();
      if (!v) return;
      key = v;
      document.getElementById('ge').textContent = 'checking…';
      start(function (ok, msg) {
        if (ok) { try { sessionStorage.setItem(KEY_STORE, key); } catch (e) {} }
        else document.getElementById('ge').textContent = msg || 'rejected';
      });
    };
    document.getElementById('gb').addEventListener('click', go);
    document.getElementById('gk').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function start(cb) {
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&graph=1', { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        if (!r.j || !r.j.ok) { if (cb) cb(false, (r.j && (r.j.error || r.j.fix)) || ('http ' + r.s)); return; }
        graph = r.j.graph; scheduled = r.j.scheduled || {};
        gate(false);
        document.getElementById('load').classList.add('hide');
        model(); rebuild(); fitAll();
        loadBoard();
        setInterval(loadBoard, POLL_MS);
        if (cb) cb(true);
      })
      .catch(function (e) { if (cb) cb(false, 'network: ' + e.message); });
  }

  function loadBoard() {
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&limit=120', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { board = j; ingestSpikes(j); renderStat(); } })
      .catch(function () {});
  }

  // ── model ─────────────────────────────────────────────────────────────────
  /**
   * Collapse the derived blocks into one box per region. DOMAIN-A..D become one
   * DOMAIN box holding 66 files; the split into lettered blocks existed only so
   * pin numbers stayed readable on the old sheet and carries no meaning here.
   *
   * The world boxes are synthesised from the external fetches. A fetch is not
   * statically directional, so the side is decided by the CALLER's region and
   * the inspector says so rather than implying the graph knows.
   */
  var INBOUND = { INGEST: 1, DOMAIN: 1, WORKER: 1, OPPTY: 1, SCORE: 1, STRESS: 1 };

  function model() {
    var meta = {};
    (graph.regions || []).forEach(function (r) { meta[r.id] = r; });

    var byId = {};
    graph.blocks.forEach(function (b) {
      var r = byId[b.region];
      if (!r) {
        r = byId[b.region] = {
          id: b.region, label: (meta[b.region] || {}).label || b.region,
          sub: (meta[b.region] || {}).sub || '', files: []
        };
      }
      b.pins.forEach(function (p) {
        r.files.push(p);
        regionOf[p.file] = b.region;
        pinIndex[p.file] = p;
      });
    });

    // World terminals.
    var inH = {}, outH = {};
    graph.conductors.forEach(function (c) {
      if (c.kind !== 'world') return;
      var host = c.to.replace(/^world:/, '');
      (INBOUND[regionOf[c.from]] ? inH : outH)[host] =
        ((INBOUND[regionOf[c.from]] ? inH : outH)[host] || []).concat([c.from]);
    });
    [['WORLDIN', 'World in', 'external sources', inH],
     ['WORLDOUT', 'World out', 'external targets', outH]].forEach(function (spec) {
      var names = Object.keys(spec[3]).sort();
      if (!names.length) return;
      var r = { id: spec[0], label: spec[1], sub: spec[2], synthetic: true, files: [] };
      names.forEach(function (h) {
        var p = { file: 'world:' + h, name: h, r: 0, w: 0, unresolved: 0, hosts: [], callers: spec[3][h] };
        r.files.push(p); regionOf[p.file] = spec[0]; pinIndex[p.file] = p;
      });
      byId[spec[0]] = r;
    });

    // Sort files inside a box by traffic, so opening one puts the busy pins first.
    Object.keys(byId).forEach(function (id) {
      byId[id].files.sort(function (a, b) {
        return (b.r + b.w) - (a.r + a.w) || a.name.localeCompare(b.name);
      });
    });

    regions = byId;

    conductors = graph.conductors.map(function (c, i) {
      var a = regionOf[c.from], b = regionOf[c.to];
      if (!a || !b) return null;
      return { i: i, c: c, from: c.from, to: c.to, ra: a, rb: b, kind: c.kind };
    }).filter(Boolean);

    // Internal traffic is reported as a number on the box rather than a wire
    // looping back on itself, which tells you the same thing and draws nothing.
    Object.keys(regions).forEach(function (id) { regions[id].internal = 0; });
    conductors.forEach(function (w) { if (w.ra === w.rb) regions[w.ra].internal++; });
  }

  // ── layout ────────────────────────────────────────────────────────────────
  function boxSize(r) {
    if (!open[r.id]) return { w: BW, h: BH };
    var n = r.files.length;
    var cols = Math.max(1, Math.ceil(n / MAX_ROWS));
    var rows = Math.ceil(n / cols);
    return { w: Math.max(BW, cols * PIN_COL + 20), h: HDR + rows * ROW + PADB, cols: cols, rows: rows };
  }

  function layout() {
    // Left margin: internal wires bow up to ~115 units off the left edge of a
    // box, and column 0 sits at the sheet origin. Without this they would be
    // clipped at negative x the moment the first box is opened.
    var LEFT = 140;
    var placed = [], x = LEFT, maxH = 0;
    COLUMNS.forEach(function (ids, ci) {
      var col = ids.map(function (id) { return regions[id]; }).filter(Boolean);
      if (!col.length) { x += BW + COL_GAP; return; }
      var widest = BW, y = 0;
      col.forEach(function (r) {
        var s = boxSize(r);
        r.x = x; r.y = y; r.w = s.w; r.h = s.h; r.cols = s.cols; r.col = ci;
        if (s.w > widest) widest = s.w;
        y += s.h + BLK_GAP;
        placed.push(r);
      });
      if (y > maxH) maxH = y;
      x += widest + COL_GAP;
    });

    // Centre each column so the chart reads as a flow rather than a set of
    // ragged stacks hanging off the top edge.
    var cols = {};
    placed.forEach(function (r) { (cols[r.col] = cols[r.col] || []).push(r); });
    Object.keys(cols).forEach(function (ci) {
      var arr = cols[ci];
      var h = arr.reduce(function (a, r) { return a + r.h + BLK_GAP; }, 0) - BLK_GAP;
      var off = (maxH - h) / 2;
      arr.forEach(function (r) { r.y += off; });
    });

    var busY = maxH + 70, bx = LEFT, busH = 0;
    BOTTOM_BUS.forEach(function (id) {
      var r = regions[id];
      if (!r) return;
      var s = boxSize(r);
      r.x = bx; r.y = busY; r.w = s.w; r.h = s.h; r.cols = s.cols; r.col = -1;
      if (s.h > busH) busH = s.h;
      bx += s.w + 60;
      placed.push(r);
    });

    // Pin coordinates inside opened boxes.
    placed.forEach(function (r) {
      if (!open[r.id]) { r.files.forEach(function (p) { p.cy = null; p.px = null; }); return; }
      var rows = Math.ceil(r.files.length / r.cols);
      r.files.forEach(function (p, i) {
        var c = Math.floor(i / rows), row = i % rows;
        p.px = r.x + 10 + c * PIN_COL;
        p.cy = r.y + HDR + row * ROW + ROW / 2;
      });
    });

    extent.w = Math.max(x, bx) + 40;
    extent.h = busY + busH + 60;
    return placed;
  }

  // ── edges ─────────────────────────────────────────────────────────────────
  /**
   * An edge is what is currently drawable between two things.
   *
   * Both boxes closed  -> ONE aggregate edge carrying every conductor between
   *                       those regions, labelled with the exact count.
   * Either box open    -> one edge per conductor, anchored on the real file row
   *                       at the open end and on the box edge at the closed one.
   *
   * The aggregate is a count of real conductors, never a summary or an estimate,
   * so opening a box can only ever show you the wires that count was made of.
   */
  function buildEdges() {
    edges = []; edgeOfConductor = {};
    var agg = {};

    conductors.forEach(function (w) {
      if (w.ra === w.rb) {
        // Internal traffic is a number on a closed box. Opening the box IS the
        // request to see it, so those conductors become real wires bowed out
        // along the left edge, joining the two file rows they actually connect.
        // Revenue alone holds 58 of these; leaving them as a number would show
        // ten files with nothing between them.
        if (!open[w.ra]) return;
        var ie = { members: [w], kind: w.kind, detail: true, internal: true,
                   ra: w.ra, rb: w.rb, count: 1 };
        edges.push(ie); edgeOfConductor[w.i] = ie;
        return;
      }
      var detailed = open[w.ra] || open[w.rb];
      if (detailed) {
        var e = { members: [w], kind: w.kind, detail: true, ra: w.ra, rb: w.rb, count: 1 };
        edges.push(e); edgeOfConductor[w.i] = e;
        return;
      }
      var k = w.ra + '>' + w.rb + '|' + w.kind;
      if (!agg[k]) {
        agg[k] = { members: [], kind: w.kind, detail: false, ra: w.ra, rb: w.rb, count: 0 };
        edges.push(agg[k]);
      }
      agg[k].members.push(w); agg[k].count++;
      edgeOfConductor[w.i] = agg[k];
    });

    // Lanes, so parallel edges between the same pair do not overprint.
    var lanes = {};
    edges.forEach(function (e) {
      var k = e.ra + '>' + e.rb;
      (lanes[k] = lanes[k] || []).push(e);
    });
    Object.keys(lanes).forEach(function (k) {
      var arr = lanes[k];
      arr.sort(function (a, b) { return anchorY(a, 'b') - anchorY(b, 'b'); });
      arr.forEach(function (e, i) { e.lane = i - (arr.length - 1) / 2; e.laneN = arr.length; });
    });
  }

  function anchorY(e, end) {
    var w = e.members[0];
    var id = end === 'a' ? e.ra : e.rb;
    var file = end === 'a' ? w.from : w.to;
    var r = regions[id];
    if (open[id] && pinIndex[file] && pinIndex[file].cy != null) return pinIndex[file].cy;
    return r.y + r.h / 2;
  }

  function anchor(e, end) {
    var w = e.members[0];
    if (e.internal) {
      var r0 = regions[e.ra];
      var p0 = pinIndex[end === 'a' ? w.from : w.to];
      return { x: r0.x, y: (p0 && p0.cy != null) ? p0.cy : r0.y + r0.h / 2, dir: -1 };
    }
    var id = end === 'a' ? e.ra : e.rb;
    var otherId = end === 'a' ? e.rb : e.ra;
    var r = regions[id], o = regions[otherId];
    var file = end === 'a' ? w.from : w.to;
    var toRight = o.x + o.w / 2 >= r.x + r.w / 2;
    var y = anchorY(e, end);
    if (open[id] && pinIndex[file] && pinIndex[file].cy != null) {
      return { x: toRight ? r.x + r.w : r.x, y: y, dir: toRight ? 1 : -1 };
    }
    return { x: toRight ? r.x + r.w : r.x, y: y, dir: toRight ? 1 : -1 };
  }

  function pathOf(e) {
    var a = anchor(e, 'a'), b = anchor(e, 'b');

    // Internal wire: a bow off the left edge joining two rows of the same box.
    // Depth scales with the row distance so short hops stay tight against the
    // box and long ones clear the rows in between.
    if (e.internal) {
      var bow = 24 + Math.min(90, Math.abs(a.y - b.y) * 0.42) + Math.abs(e.lane || 0) * 1.6;
      return 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) +
             'C' + (a.x - bow).toFixed(1) + ',' + a.y.toFixed(1) +
             ' ' + (b.x - bow).toFixed(1) + ',' + b.y.toFixed(1) +
             ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1);
    }

    var lane = (e.lane || 0) * (e.detail ? 3 : 7);
    var s1 = a.x + a.dir * 18, t1 = b.x + b.dir * 18;
    var mx = (s1 + t1) / 2, my = (a.y + b.y) / 2 + lane;
    var d1 = mx - s1, d2 = t1 - mx;
    return 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) +
           'L' + s1.toFixed(1) + ',' + a.y.toFixed(1) +
           'C' + (s1 + d1 * 0.55).toFixed(1) + ',' + a.y.toFixed(1) +
           ' ' + (mx - d1 * 0.45).toFixed(1) + ',' + my.toFixed(1) +
           ' ' + mx.toFixed(1) + ',' + my.toFixed(1) +
           'C' + (mx + d2 * 0.45).toFixed(1) + ',' + my.toFixed(1) +
           ' ' + (t1 - d2 * 0.55).toFixed(1) + ',' + b.y.toFixed(1) +
           ' ' + t1.toFixed(1) + ',' + b.y.toFixed(1) +
           'L' + b.x.toFixed(1) + ',' + b.y.toFixed(1);
  }

  function colorOf(k) { return k === 'data' ? C.data : (k === 'world' ? C.world : C.module); }
  function widthOf(e) {
    if (e.internal) return e.kind === 'module' ? 0.5 : 0.9;
    if (e.detail) return e.kind === 'module' ? 0.7 : 1.2;
    var n = e.count;
    return Math.min(9, 1.4 + Math.log(n + 1) * 1.7);
  }

  // ── draw ──────────────────────────────────────────────────────────────────
  function rebuild() {
    var placed = layout();
    buildEdges();
    drawGrid();
    drawEdges();
    drawBoxes(placed);
    applyFilters();
    renderStat();
  }

  function drawGrid() {
    clear(gGrid);
    var step = 150;
    for (var x = 0; x < extent.w; x += step)
      gGrid.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: extent.h, stroke: 'rgba(255,255,255,0.015)', 'stroke-width': 1 }));
    for (var y = 0; y < extent.h; y += step)
      gGrid.appendChild(el('line', { x1: 0, y1: y, x2: extent.w, y2: y, stroke: 'rgba(255,255,255,0.015)', 'stroke-width': 1 }));
  }

  function drawEdges() {
    clear(gWire);
    edges.forEach(function (e) {
      var p = el('path', {
        d: pathOf(e), fill: 'none', stroke: colorOf(e.kind),
        'stroke-width': widthOf(e), 'stroke-linecap': 'round',
        opacity: e.kind === 'module' ? 0.26 : 0.42, 'pointer-events': 'none'
      });
      e.el = p; e.len = 0;
      gWire.appendChild(p);

      // Aggregate edges carry their exact conductor count. A detail edge does
      // not: it is already one wire and a "1" on every strand is noise.
      if (!e.detail && e.count > 1 && e.kind !== 'module') {
        var a = anchor(e, 'a'), b = anchor(e, 'b');
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (e.lane || 0) * 7;
        var lab = text(mx, my - 5, String(e.count), {
          size: 12, fill: colorOf(e.kind), anchor: 'middle', weight: 500, opacity: 0.85
        });
        e.label = lab;
        gWire.appendChild(lab);
      }
    });
  }

  function drawBoxes(placed) {
    clear(gBox);
    placed.forEach(function (r) {
      var g = el('g');
      var isOpen = !!open[r.id];

      // Opaque, not tinted. A translucent box lets conductors run visibly
      // underneath the text, and a wire crossing a filename is unreadable.
      g.appendChild(el('rect', {
        x: r.x, y: r.y, width: r.w, height: r.h, rx: 3,
        fill: isOpen ? '#0d0f14' : '#0b0d11',
        stroke: isOpen ? 'rgba(201,169,78,0.42)' : 'rgba(255,255,255,0.15)',
        'stroke-width': isOpen ? 1.4 : 1
      }));
      g.appendChild(el('rect', {
        x: r.x, y: r.y, width: r.w, height: isOpen ? HDR : BH, rx: 3,
        fill: 'rgba(201,169,78,0.055)', stroke: 'none'
      }));

      g.appendChild(text(r.x + 14, r.y + 27, r.label, { size: 21, fill: C.gold, weight: 500 }));
      g.appendChild(text(r.x + r.w - 14, r.y + 27, (isOpen ? '−' : '+'), {
        size: 22, fill: C.dim, anchor: 'end', weight: 500
      }));

      if (!isOpen) {
        g.appendChild(text(r.x + 14, r.y + 47, r.sub, { size: 12.5, fill: C.dim }));
        var line = r.files.length + (r.files.length === 1 ? ' file' : ' files');
        if (r.internal) line += '   ↺ ' + r.internal + ' internal';
        g.appendChild(text(r.x + 14, r.y + 70, line, { size: 12.5, fill: C.faint }));

        var sched = r.files.filter(function (p) { return scheduled[p.file]; }).length;
        var unres = r.files.reduce(function (a, p) { return a + (p.unresolved || 0); }, 0);
        var tail = [];
        if (sched) tail.push(sched + ' scheduled');
        if (unres) tail.push(unres + ' unresolved');
        if (tail.length) g.appendChild(text(r.x + 14, r.y + 89, tail.join('   '), { size: 12, fill: C.world, opacity: 0.75 }));
        g.appendChild(text(r.x + r.w - 14, r.y + 89, 'open', { size: 11, fill: C.faint, anchor: 'end', ls: 1.4 }));
      } else {
        g.appendChild(text(r.x + 14, r.y + 41, r.files.length + ' files' +
          (r.internal ? '   ↺ ' + r.internal + ' internal' : ''), { size: 12, fill: C.dim }));

        r.files.forEach(function (p) {
          var isSched = !!scheduled[p.file];
          var nm = p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name;
          g.appendChild(text(p.px + 6, p.cy + 4, nm, {
            size: 12.5, fill: isSched ? C.gold : (selected === p.file ? '#ffffff' : C.ink)
          }));
          if (p.w || p.r) {
            g.appendChild(text(p.px + PIN_COL - 16, p.cy + 4,
              (p.w ? p.w + 'w' : '') + (p.w && p.r ? '/' : '') + (p.r ? p.r + 'r' : ''),
              { size: 10.5, fill: C.faint, anchor: 'end' }));
          }
          var hit = el('rect', { x: p.px, y: p.cy - ROW / 2, width: PIN_COL - 6, height: ROW,
            fill: 'transparent', style: 'cursor:pointer' });
          hit.addEventListener('click', function (ev) { ev.stopPropagation(); select(p.file); });
          g.appendChild(hit);
        });
      }

      // The header is the open/close control. Rows inside handle their own
      // clicks, so opening never fights with inspecting.
      var head = el('rect', { x: r.x, y: r.y, width: r.w, height: isOpen ? HDR : BH,
        fill: 'transparent', style: 'cursor:pointer' });
      head.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(r.id); });
      g.appendChild(head);

      gBox.appendChild(g);
    });
  }

  function toggle(id) {
    open[id] = !open[id];
    if (!open[id] && selected && regionOf[selected] === id) selected = null;
    rebuild();
    renderInspector();
  }

  function applyFilters() {
    edges.forEach(function (e) {
      var on = show[e.kind];
      if (!on) {
        e.el.style.display = 'none';
        if (e.label) e.label.style.display = 'none';
        return;
      }
      e.el.style.display = '';
      if (e.label) e.label.style.display = '';

      var hi = false, lo = false;
      if (selected) {
        hi = e.members.some(function (m) { return m.from === selected || m.to === selected; });
        lo = !hi;
      } else if (findTerm) {
        hi = e.members.some(function (m) {
          return m.from.toLowerCase().indexOf(findTerm) !== -1 || m.to.toLowerCase().indexOf(findTerm) !== -1;
        });
        lo = !hi;
      }
      var base = e.kind === 'module' ? 0.26 : 0.42;
      e.el.setAttribute('opacity', hi ? 0.95 : (lo ? 0.05 : base));
      e.el.setAttribute('stroke-width', hi ? widthOf(e) + 1.4 : widthOf(e));
      if (e.label) e.label.setAttribute('opacity', lo ? 0.06 : 0.85);
    });
  }

  // ── pulses ────────────────────────────────────────────────────────────────
  function ingestSpikes(p) {
    (p.spikes || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (sp) {
      var sig = sp.at + '|' + sp.job;
      if (seenSpike[sig]) return;
      seenSpike[sig] = 1;
      fireFile('handlers/' + sp.job + '.js', sp.ok === false);
    });
    ingestFreshness(p);
  }

  /**
   * The first poll only sets a baseline. Firing on it would light the whole
   * chart at load with writes that may be hours old, which reads as "everything
   * is busy right now" and is false.
   */
  function ingestFreshness(p) {
    var t = (p.stores && p.stores.touched) || {};
    var first = (seenTouch === null);
    if (first) seenTouch = {};
    Object.keys(t).forEach(function (ns) {
      var prev = seenTouch[ns];
      seenTouch[ns] = t[ns];
      if (first || prev === undefined || t[ns] <= prev) return;
      fireStore(ns);
    });
  }

  /** Matches lib/db-touch.namespaceOf exactly. */
  function nsOf(k) {
    var parts = String(k || '').split(':');
    if (!parts[0]) return null;
    return (parts[0] === 'limen' && parts.length > 1) ? 'limen:' + parts[1] : parts[0];
  }

  function fireFile(file, failed) {
    conductors.forEach(function (w) { if (w.from === file) launch(w, failed); });
  }
  function fireStore(ns) {
    conductors.forEach(function (w) {
      if (w.kind !== 'data' || !w.c.via) return;
      if (nsOf(w.c.via) !== ns) return;
      launch(w, false);
    });
  }

  /**
   * Spread over SPREAD_MS. Presentation, not invention: the count is exact and
   * every queued pulse is one real event. Firing a whole poll's worth on the
   * 15s boundary made the chart flash and then sit dead, which misreports
   * steady traffic as periodic bursts.
   */
  function launch(w, failed) {
    var e = edgeOfConductor[w.i];
    if (!e || !show[e.kind]) return;
    queue.push({ e: e, failed: failed, at: performance.now() + Math.random() * SPREAD_MS });
  }

  function emit(q) {
    var e = q.e;
    if (!show[e.kind] || pulses.length >= PULSE_CAP) return;
    if (!e.len) { try { e.len = e.el.getTotalLength(); } catch (x) { e.len = 0; } }
    if (!e.len) return;
    var dot = el('circle', {
      r: q.failed ? 2.8 : 2.4, fill: q.failed ? '#d97070' : '#eaf6f1',
      filter: 'url(#glow)', 'pointer-events': 'none'
    });
    gPulse.appendChild(dot);
    pulses.push({ e: e, el: dot, t: 0, speed: 0.5 + Math.min(0.5, 300 / e.len) });
  }

  var last = 0;
  function tick(ts) {
    var dt = last ? Math.min(64, ts - last) : 16;
    last = ts;
    for (var q = queue.length - 1; q >= 0; q--) {
      if (queue[q].at > ts) continue;
      emit(queue[q]); queue.splice(q, 1);
    }
    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += (dt / 1000) * p.speed;
      var pt = null;
      if (p.t < 1 && p.e.el.isConnected) { try { pt = p.e.el.getPointAtLength(p.t * p.e.len); } catch (x) {} }
      if (!pt) { if (p.el.parentNode) gPulse.removeChild(p.el); pulses.splice(i, 1); continue; }
      p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      p.el.setAttribute('opacity', p.t < 0.08 ? p.t / 0.08 : (p.t > 0.9 ? (1 - p.t) / 0.1 : 1));
    }
    requestAnimationFrame(tick);
  }

  // ── pan / zoom ────────────────────────────────────────────────────────────
  function ratio() {
    var st = document.getElementById('stage');
    return st.clientHeight / st.clientWidth;
  }
  function apply() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); }

  function fitAll() {
    var st = document.getElementById('stage');
    var ar = st.clientWidth / st.clientHeight, pad = 50;
    var w = extent.w + pad * 2, h = extent.h + pad * 2;
    if (w / h > ar) { view.w = w; view.h = w / ar; }
    else { view.h = h; view.w = h * ar; }
    view.x = -pad - (view.w - w) / 2;
    view.y = -pad - (view.h - h) / 2;
    apply();
  }

  function wirePanZoom() {
    var st = document.getElementById('stage');
    var dragging = false, sx = 0, sy = 0, vx = 0, vy = 0, moved = false;
    st.addEventListener('mousedown', function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; vx = view.x; vy = view.y;
      st.classList.add('drag');
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var k = view.w / st.clientWidth;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
      view.x = vx - (e.clientX - sx) * k; view.y = vy - (e.clientY - sy) * k;
      apply();
    });
    window.addEventListener('mouseup', function () {
      if (dragging && !moved) deselect();
      dragging = false; st.classList.remove('drag');
    });
    st.addEventListener('wheel', function (e) {
      e.preventDefault();
      var k = Math.exp(e.deltaY * 0.0012);
      var r = st.getBoundingClientRect();
      var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      var px = view.x + view.w * fx, py = view.y + view.h * fy;
      var nw = Math.max(300, Math.min(extent.w * 2.4, view.w * k));
      var nh = nw * (view.h / view.w);
      view.x = px - nw * fx; view.y = py - nh * fy; view.w = nw; view.h = nh;
      apply();
    }, { passive: false });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') deselect(); });
  }

  // ── controls ──────────────────────────────────────────────────────────────
  function wireControls() {
    function tog(id, k, cls) {
      var b = document.getElementById(id);
      b.addEventListener('click', function () {
        show[k] = !show[k];
        b.className = 'tog' + (show[k] ? ' on ' + cls : '');
        applyFilters(); renderStat();
      });
    }
    tog('tD', 'data', 'd'); tog('tM', 'module', 'm'); tog('tW', 'world', 'w');
    document.getElementById('tFit').addEventListener('click', fitAll);
    document.getElementById('inspX').addEventListener('click', deselect);

    var all = document.getElementById('tAll');
    if (all) all.addEventListener('click', function () {
      var anyOpen = Object.keys(regions).some(function (id) { return open[id]; });
      Object.keys(regions).forEach(function (id) { open[id] = !anyOpen; });
      all.textContent = anyOpen ? 'open all' : 'close all';
      rebuild(); fitAll();
    });

    var f = document.getElementById('find');
    f.addEventListener('input', function () { findTerm = f.value.trim().toLowerCase(); applyFilters(); });
    f.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !findTerm) return;
      var hit = Object.keys(pinIndex).filter(function (id) {
        return id.toLowerCase().indexOf(findTerm) !== -1;
      })[0];
      if (!hit) return;
      var rid = regionOf[hit];
      if (!open[rid]) { open[rid] = true; rebuild(); }
      focusRegion(rid); select(hit);
    });
  }

  function focusRegion(id) {
    var r = regions[id];
    if (!r) return;
    var nw = Math.max(900, r.w * 2.4);
    view.w = nw; view.h = nw * ratio();
    view.x = r.x + r.w / 2 - view.w / 2;
    view.y = r.y + r.h / 2 - view.h / 2;
    apply();
  }

  // ── inspector ─────────────────────────────────────────────────────────────
  function select(file) { selected = file; rebuild(); renderInspector(); }
  function deselect() { if (!selected) return; selected = null; rebuild(); renderInspector(); }

  function renderInspector() {
    var box = document.getElementById('insp'), body = document.getElementById('inspBody');
    if (!selected || !pinIndex[selected]) { box.classList.remove('show'); return; }
    var p = pinIndex[selected];
    var outC = conductors.filter(function (w) { return w.from === selected; });
    var inC = conductors.filter(function (w) { return w.to === selected; });
    var sched = scheduled[selected];

    var sw = [], sr = [];
    (graph.stores || []).forEach(function (s) {
      if (s.w.indexOf(selected) !== -1) sw.push(s);
      if (s.r.indexOf(selected) !== -1) sr.push(s);
    });

    var h = '<h3>' + esc(p.name) + '</h3><div class="path">' + esc(p.file) + '</div>';
    h += '<div class="row"><span class="k">box</span><span class="v">' +
         esc((regions[regionOf[selected]] || {}).label || '') + '</span></div>';
    if (sched) {
      h += '<div class="row"><span class="k">scheduled</span><span class="v">' + esc(sched.schedule) + '</span></div>';
      h += '<div class="row"><span class="k">source · kind</span><span class="v">' +
           esc(sched.source) + ' · ' + esc(sched.kind) + '</span></div>';
    }
    h += '<div class="row"><span class="k">conductors</span><span class="v">' +
         outC.length + ' out · ' + inC.length + ' in</span></div>';

    if (p.callers) {
      h += '<h4>Fetched by</h4>';
      p.callers.forEach(function (f) { h += '<div class="line">' + esc(f) + '</div>'; });
      h += '<div class="warn">A fetch is not statically directional. This host sits on this ' +
           'side because its callers are ingest-side files, not because the graph can prove ' +
           'the direction.</div>';
      body.innerHTML = h; box.classList.add('show'); return;
    }

    h += '<h4>Writes</h4>';
    if (sw.length) sw.forEach(function (s) {
      h += '<div class="line"><span class="tag w">W</span><span>' + esc(s.key) +
           (s.dynamic ? '<span style="color:#4e4b46">*</span>' : '') +
           ' <span style="color:#4e4b46">· read by ' + s.r.length + '</span></span></div>';
    }); else h += '<div class="empty">writes nothing</div>';

    h += '<h4>Reads</h4>';
    if (sr.length) sr.forEach(function (s) {
      h += '<div class="line"><span class="tag r">R</span><span>' + esc(s.key) +
           (s.dynamic ? '<span style="color:#4e4b46">*</span>' : '') +
           ' <span style="color:#4e4b46">· written by ' + s.w.length + '</span></span></div>';
    }); else h += '<div class="empty">reads nothing</div>';

    if (p.hosts && p.hosts.length) {
      h += '<h4>External hosts</h4>';
      p.hosts.forEach(function (x) { h += '<div class="line">' + esc(x) + '</div>'; });
    }
    if (p.unresolved) {
      h += '<div class="warn">' + p.unresolved + ' store call' + (p.unresolved === 1 ? '' : 's') +
           ' in this file build their key entirely at runtime. Those conductors exist and are ' +
           'not drawn, because the scanner will not guess a key it cannot read.</div>';
    }
    var dead = sw.filter(function (s) { return !s.r.length; });
    if (dead.length) {
      h += '<div class="warn">Writes ' + dead.length + ' store' + (dead.length === 1 ? '' : 's') +
           ' that nothing reads: ' + esc(dead.map(function (s) { return s.key; }).join(', ')) + '</div>';
    }
    body.innerHTML = h; box.classList.add('show');
  }

  /**
   * The count has to distinguish three things or it misleads: conductors drawn
   * as wires, conductors that live INSIDE one box (reported on the box as
   * "internal", never drawn), and conductors hidden by a filter. Showing
   * "58/506" implied 448 were missing when most were simply internal.
   */
  function renderStat() {
    var drawn = edges.filter(function (e) { return show[e.kind]; })
                     .reduce(function (a, e) { return a + e.count; }, 0);
    // Only conductors inside a CLOSED box are undrawn. Opening the box turns
    // them into wires, so they move from this count into "drawn".
    var internal = conductors.filter(function (w) { return w.ra === w.rb && !open[w.ra]; }).length;
    var nOpen = Object.keys(regions).filter(function (id) { return open[id]; }).length;
    var s = '<b>' + Object.keys(regions).length + '</b> boxes · <b>' +
            Object.keys(pinIndex).length + '</b> files · <b>' + drawn + '</b> drawn';
    if (internal) s += ' · <b>' + internal + '</b> internal';
    var hidden = conductors.length - internal - drawn;
    if (hidden > 0) s += ' · <b>' + hidden + '</b> filtered';
    if (nOpen) s += ' · <b>' + nOpen + '</b> open';
    if (board && board.coverage) s += ' · <b>' + board.coverage.observed + '</b>/' + board.coverage.declared + ' jobs observed';
    document.getElementById('stat').innerHTML = s;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
