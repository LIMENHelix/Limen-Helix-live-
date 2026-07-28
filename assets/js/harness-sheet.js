/**
 * assets/js/harness-sheet.js — the wiring harness sheet.
 *
 * WHAT THIS DRAWS
 * A terminal-block wiring diagram of the server side of this repo, in the same
 * grammar as a low-voltage loom drawing: numbered terminal strips, conductors
 * that leave a pin as a comb, bundle into a channel, and fan back out onto a
 * numbered pin at the far end.
 *
 * EVERY CONDUCTOR IS DERIVED, NONE IS DRAWN BY HAND
 * The graph comes from scripts/build-harness-graph.js, which parses all 253
 * server files and reads conductors out of the source: a require, or a store
 * that one file writes and another reads. Nothing on this sheet is asserted.
 * Where the scanner could not resolve a key statically it is reported as an
 * unresolved count on the pin, not guessed into a wire, because a guessed
 * conductor is indistinguishable from a fabricated one once it is drawn.
 *
 * MOTION IS EVIDENCE, NOT DECORATION
 * A pulse is one recorded run from lib/heartbeat's spike log. There is no idle
 * animation, no ambient drift, no "activity" that is really a sine wave. If the
 * ledger is empty the sheet is still. That is the same rule the ring view was
 * built on and it is the one thing worth keeping from it: a lively picture with
 * no events behind it is a fabricated signal wearing a nice coat.
 *
 * WHY MODULE CONDUCTORS DEFAULT OFF
 * 355 of the 504 conductors are requires. They are real, but they describe the
 * code skeleton rather than the data path, and at full density they bury the
 * 133 conductors that actually carry information between subsystems. They are a
 * toggle, not a deletion.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  // ── sheet geometry, in sheet units ────────────────────────────────────────
  var BW = 250;          // block width
  var HDR = 32;          // block header height
  var ROW = 17;          // one pin row
  var PAD = 7;
  var COL_GAP = 220;     // channel width between columns: where bundles run
  var BLK_GAP = 34;
  var STUB = 16;         // the comb: horizontal run off the pin before it curves
  var LANE = 2.6;        // vertical separation between parallel wires in a bundle

  /**
   * Column order IS the argument the sheet makes: left to right is the path a
   * signal takes. World in, ingest, the scheduled spine, the twenty domains,
   * sense and cognition, the money path, the outward motors, world out. The
   * shared library sits as a bus along the bottom because it is required from
   * every column and drawing it inline would put a block in the middle of every
   * channel.
   */
  var COLUMNS = [
    ['WORLDIN'],
    ['INGEST', 'RETURN'],
    ['WORKER', 'PLAT'],
    ['DOMAIN'],
    ['STRESS', 'COGNIT', 'SCORE', 'BODY'],
    ['OPPTY', 'REVENUE', 'HOME'],
    ['PUBLISH', 'AI', 'OPS'],
    ['WORLDOUT']
  ];
  var BOTTOM_BUS = ['LIB', 'UNFILED'];

  var C = {
    data: '#5fb3a1', module: '#4a5364', world: '#d6a95e', dead: '#8a5f5f',
    ink: '#d8d3c9', dim: '#7d786f', faint: '#4e4b46',
    gold: '#c9a94e', goldGhost: 'rgba(201,169,78,0.16)',
    blockFill: 'rgba(255,255,255,0.014)', blockLine: 'rgba(255,255,255,0.10)'
  };

  // ── state ─────────────────────────────────────────────────────────────────
  var svg, gGrid, gWire, gBlock, gPulse, gTop;
  var key = '', graph = null, scheduled = {};
  var board = null, seenSpike = {}, seenTouch = null;
  var blocks = [], pinIndex = {}, conductors = [];
  var view = { x: 0, y: 0, w: 1000, h: 1000 };
  var extent = { w: 0, h: 0 };
  var show = { data: true, module: false, world: true };
  var selected = null, findTerm = '';
  var pulses = [];
  var PULSE_CAP = 140;

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
      x: x, y: y, fill: o.fill || C.ink, 'font-size': o.size || 9,
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
    // One soft bloom, reused by every travelling pulse. A filter per pulse would
    // cost a compositing layer each and the sheet would stutter at 60fps.
    defs.innerHTML =
      '<filter id="glow" x="-320%" y="-320%" width="740%" height="740%">' +
      '<feGaussianBlur stdDeviation="2.4" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<filter id="softglow" x="-120%" y="-120%" width="340%" height="340%">' +
      '<feGaussianBlur stdDeviation="1.1"/></filter>';
    svg.appendChild(defs);
    gGrid = el('g'); gWire = el('g'); gBlock = el('g'); gPulse = el('g'); gTop = el('g');
    [gGrid, gWire, gBlock, gPulse, gTop].forEach(function (g) { svg.appendChild(g); });

    wireGate();
    wireControls();
    wirePanZoom();

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

    window.addEventListener('resize', function () { if (graph) { fitViewport(); apply(); } });
    requestAnimationFrame(tick);
  }

  function gate(showIt) {
    document.getElementById('gate').classList.toggle('hide', !showIt);
  }
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
        build();
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

  // ── layout ────────────────────────────────────────────────────────────────
  /**
   * Synthetic world blocks. The scanner records `file -> world:host` for every
   * external fetch, but a fetch is not statically directional: the same call
   * shape pulls a feed in and pushes a post out. So the side is decided by the
   * CALLER's region, and the inspector says so rather than implying the sheet
   * knows something it does not.
   */
  var INBOUND_REGIONS = { INGEST: 1, DOMAIN: 1, WORKER: 1, OPPTY: 1, SCORE: 1, STRESS: 1 };

  function synthesizeWorld() {
    var inHosts = {}, outHosts = {};
    var regionOfFile = {};
    graph.blocks.forEach(function (b) {
      b.pins.forEach(function (p) { regionOfFile[p.file] = b.region; });
    });
    graph.conductors.forEach(function (c) {
      if (c.kind !== 'world') return;
      var host = c.to.replace(/^world:/, '');
      var bucket = INBOUND_REGIONS[regionOfFile[c.from]] ? inHosts : outHosts;
      (bucket[host] = bucket[host] || []).push(c.from);
    });
    function mk(id, label, sub, map) {
      var names = Object.keys(map).sort();
      if (!names.length) return null;
      return {
        id: id, region: id, label: label, sub: sub, synthetic: true,
        pins: names.map(function (h, i) {
          return { n: i + 1, file: 'world:' + h, name: h, r: 0, w: 0, unresolved: 0, hosts: [], callers: map[h] };
        })
      };
    }
    var a = mk('WORLDIN', 'World in', 'external sources', inHosts);
    var b = mk('WORLDOUT', 'World out', 'external targets', outHosts);
    return [a, b].filter(Boolean);
  }

  function blockHeight(b) { return HDR + b.pins.length * ROW + PAD; }

  function build() {
    blocks = graph.blocks.slice().concat(synthesizeWorld());

    var byRegion = {};
    blocks.forEach(function (b) { (byRegion[b.region] = byRegion[b.region] || []).push(b); });

    // Place the main grid.
    var placed = [], x = 0, maxColH = 0;
    COLUMNS.forEach(function (regions, ci) {
      var colBlocks = [];
      regions.forEach(function (rg) { (byRegion[rg] || []).forEach(function (b) { colBlocks.push(b); }); });
      if (!colBlocks.length) { x += BW + COL_GAP; return; }
      var y = 0;
      colBlocks.forEach(function (b) {
        b.x = x; b.y = y; b.col = ci; b.h = blockHeight(b);
        y += b.h + BLK_GAP;
        placed.push(b);
      });
      if (y > maxColH) maxColH = y;
      x += BW + COL_GAP;
    });

    // Centre each column vertically so the sheet reads as a loom rather than a
    // set of columns all hanging off the top edge.
    var colX = {};
    placed.forEach(function (b) { colX[b.x] = (colX[b.x] || 0); });
    Object.keys(colX).forEach(function (cx) {
      var inCol = placed.filter(function (b) { return String(b.x) === cx; });
      var h = inCol.reduce(function (a, b) { return a + b.h + BLK_GAP; }, 0) - BLK_GAP;
      var off = (maxColH - h) / 2;
      inCol.forEach(function (b) { b.y += off; });
    });

    // The shared-library bus, laid along the bottom under everything. It gets its
    // own column index so every wire onto the bus ropes into one channel instead
    // of fanning individually across the whole sheet.
    var busY = maxColH + 70, bx = 0, busH = 0;
    BOTTOM_BUS.forEach(function (rg) {
      (byRegion[rg] || []).forEach(function (b) {
        b.x = bx; b.y = busY; b.col = -1; b.h = blockHeight(b);
        if (b.h > busH) busH = b.h;
        bx += BW + 46;
        placed.push(b);
      });
    });

    blocks = placed;
    pinIndex = {};
    blocks.forEach(function (b) {
      b.pins.forEach(function (p, i) {
        p.block = b;
        p.cy = b.y + HDR + i * ROW + ROW / 2;
        p.lx = b.x; p.rx = b.x + BW;
        pinIndex[p.file] = p;
      });
    });

    extent.w = Math.max(COLUMNS.length * (BW + COL_GAP), bx) + 40;
    extent.h = busY + busH + 60;

    buildConductors();
    drawGrid();
    drawBlocks();
    drawConductors();
    fitAll();
    renderStat();
  }

  // ── conductors ────────────────────────────────────────────────────────────
  function buildConductors() {
    // A conductor whose ends the scanner could not both place has nothing to
    // connect. Rather than dropping it silently it is counted and reported in
    // the header, so "504 conductors" never quietly becomes 480 on screen.
    var dropped = 0;
    conductors = graph.conductors.map(function (c) {
      var a = pinIndex[c.from], b = pinIndex[c.to];
      if (!a || !b) { dropped++; return null; }
      return { c: c, a: a, b: b, kind: c.kind };
    }).filter(Boolean);
    conductors.dropped = dropped;

    /**
     * BUNDLING IS THE WHOLE LOOK.
     *
     * Bundling by block PAIR does not work: most pairs carry one or two wires,
     * so nothing ropes together and the sheet reads as 500 unrelated curves.
     * A loom drawing bundles by ROUTE. Everything travelling from column i to
     * column j takes the same channel, ropes together through it, and fans out
     * at the far end. So the bundle key is the column pair, and the channel is a
     * band of lanes at the midpoint of the run that every member is forced
     * through with a horizontal tangent.
     */
    var bundles = {};
    conductors.forEach(function (w) {
      var ca = w.a.block.col, cb = w.b.block.col;
      var k = ca + '>' + cb;
      (bundles[k] = bundles[k] || []).push(w);
    });

    Object.keys(bundles).forEach(function (k) {
      var arr = bundles[k];
      // Order the rope by where each wire is going, not where it came from, so
      // the strands do not cross each other inside the bundle.
      arr.sort(function (p, q) { return (p.b.cy - q.b.cy) || (p.a.cy - q.a.cy); });

      var ax = 0, ay = 0, bx = 0, by = 0;
      arr.forEach(function (w) { ax += w.a.rx; ay += w.a.cy; bx += w.b.lx; by += w.b.cy; });
      var n = arr.length;
      var band = {
        x: (ax / n + bx / n) / 2,
        y: (ay / n + by / n) / 2,
        n: n
      };
      arr.forEach(function (w, i) {
        w.lane = i - (n - 1) / 2;
        w.band = band;
        w.bundleSize = n;
      });
    });
  }

  /**
   * One conductor path. Leaves the pin as a straight comb stub, sweeps through
   * the channel between the two blocks, and arrives horizontally on the far pin.
   * Same-column and backward runs exit the same side they enter and bow out
   * around the block, which is what a loom drawing does when a wire has to come
   * back on itself.
   */
  function pathFor(w) {
    var a = w.a, b = w.b;
    var forward = b.block.x > a.block.x;
    var same = b.block.x === a.block.x;

    var sx, tx, sdir, tdir;
    if (forward) { sx = a.rx; tx = b.lx; sdir = 1; tdir = -1; }
    else if (same) { sx = a.rx; tx = b.rx; sdir = 1; tdir = 1; }
    else { sx = a.lx; tx = b.rx; sdir = -1; tdir = 1; }

    var sy = a.cy, ty = b.cy;
    var s1 = sx + sdir * STUB, t1 = tx + tdir * STUB;
    var lane = (w.lane || 0) * LANE;

    // A wire that never leaves its own column has no channel to join; bow it
    // out to the right so it reads as a local loop rather than a stray.
    if (same) {
      var bow = 80 + Math.abs(w.lane || 0) * 6;
      return 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) +
             'L' + s1.toFixed(1) + ',' + sy.toFixed(1) +
             'C' + (s1 + bow).toFixed(1) + ',' + sy.toFixed(1) +
             ' ' + (t1 + bow).toFixed(1) + ',' + ty.toFixed(1) +
             ' ' + t1.toFixed(1) + ',' + ty.toFixed(1) +
             'L' + tx.toFixed(1) + ',' + ty.toFixed(1);
    }

    // Through the channel. The waypoint carries a horizontal tangent on both
    // sides, which is what makes neighbouring wires lie parallel through the
    // band instead of merely crossing near each other.
    var band = w.band || { x: (s1 + t1) / 2, y: (sy + ty) / 2 };
    var wx = band.x, wy = band.y + lane;
    var d1 = (wx - s1), d2 = (t1 - wx);

    return 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) +
           'L' + s1.toFixed(1) + ',' + sy.toFixed(1) +
           'C' + (s1 + d1 * 0.55).toFixed(1) + ',' + sy.toFixed(1) +
           ' ' + (wx - d1 * 0.45).toFixed(1) + ',' + wy.toFixed(1) +
           ' ' + wx.toFixed(1) + ',' + wy.toFixed(1) +
           'C' + (wx + d2 * 0.45).toFixed(1) + ',' + wy.toFixed(1) +
           ' ' + (t1 - d2 * 0.55).toFixed(1) + ',' + ty.toFixed(1) +
           ' ' + t1.toFixed(1) + ',' + ty.toFixed(1) +
           'L' + tx.toFixed(1) + ',' + ty.toFixed(1);
  }

  function colorOf(w) {
    if (w.kind === 'data') return C.data;
    if (w.kind === 'world') return C.world;
    return C.module;
  }
  /** Gauge. A store with many consumers is a heavier conductor, same as a feeder. */
  function widthOf(w) {
    if (w.kind === 'module') return 0.5;
    if (w.kind === 'world') return 0.9;
    return w.bundleSize > 6 ? 1.5 : 1.0;
  }

  function drawConductors() {
    clear(gWire);
    conductors.forEach(function (w) {
      var p = el('path', {
        d: pathFor(w), fill: 'none',
        stroke: colorOf(w), 'stroke-width': widthOf(w),
        'stroke-linecap': 'round',
        opacity: w.kind === 'module' ? 0.30 : (w.kind === 'world' ? 0.5 : 0.46),
        'pointer-events': 'none'
      });
      w.el = p;
      w.len = 0;   // measured lazily on first pulse; getTotalLength forces layout
      gWire.appendChild(p);
    });
    applyFilters();
  }

  function applyFilters() {
    conductors.forEach(function (w) {
      var on = show[w.kind];
      var hi = false, lo = false;
      if (selected) {
        hi = (w.a.file === selected || w.b.file === selected);
        lo = !hi;
      }
      if (!on) { w.el.style.display = 'none'; return; }
      w.el.style.display = '';
      w.el.setAttribute('opacity',
        hi ? 0.95 : (lo ? 0.05 : (w.kind === 'module' ? 0.30 : (w.kind === 'world' ? 0.5 : 0.46))));
      w.el.setAttribute('stroke-width', hi ? widthOf(w) + 1.1 : widthOf(w));
    });
  }

  // ── blocks ────────────────────────────────────────────────────────────────
  function drawGrid() {
    clear(gGrid);
    // A drafting graticule. Deliberately faint: it gives the sheet a scale to be
    // read against without competing with a single conductor.
    var step = 120;
    for (var x = 0; x < extent.w; x += step) {
      gGrid.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: extent.h,
        stroke: 'rgba(255,255,255,0.016)', 'stroke-width': 1 }));
    }
    for (var y = 0; y < extent.h; y += step) {
      gGrid.appendChild(el('line', { x1: 0, y1: y, x2: extent.w, y2: y,
        stroke: 'rgba(255,255,255,0.016)', 'stroke-width': 1 }));
    }
  }

  function drawBlocks() {
    clear(gBlock);
    blocks.forEach(function (b) {
      var g = el('g');

      g.appendChild(el('rect', {
        x: b.x, y: b.y, width: BW, height: b.h, rx: 2,
        fill: C.blockFill, stroke: C.blockLine, 'stroke-width': 1
      }));
      g.appendChild(el('rect', {
        x: b.x, y: b.y, width: BW, height: HDR, rx: 2,
        fill: 'rgba(201,169,78,0.05)', stroke: 'none'
      }));
      g.appendChild(el('line', {
        x1: b.x, y1: b.y + HDR, x2: b.x + BW, y2: b.y + HDR,
        stroke: C.goldGhost, 'stroke-width': 1
      }));

      g.appendChild(text(b.x + 8, b.y + 13, b.id, { size: 8, fill: C.gold, ls: 1.6, weight: 600 }));
      g.appendChild(text(b.x + 8, b.y + 25, b.label, { size: 9.5, fill: C.ink, weight: 500 }));
      g.appendChild(text(b.x + BW - 8, b.y + 25, b.sub, { size: 7.5, fill: C.faint, anchor: 'end' }));

      b.pins.forEach(function (p, i) {
        var y = b.y + HDR + i * ROW;
        var cy = y + ROW / 2;

        if (i % 2 === 1) {
          g.appendChild(el('rect', { x: b.x + 1, y: y, width: BW - 2, height: ROW,
            fill: 'rgba(255,255,255,0.012)' }));
        }

        // pin number gutter
        g.appendChild(text(b.x + 15, cy + 3, String(p.n), { size: 7.5, fill: C.faint, anchor: 'end' }));
        g.appendChild(el('line', { x1: b.x + 20, y1: y, x2: b.x + 20, y2: y + ROW,
          stroke: 'rgba(255,255,255,0.05)', 'stroke-width': 1 }));

        var sched = scheduled[p.file];
        var nameCol = sched ? C.gold : (p.w && !p.r ? '#c3b48e' : C.ink);
        var label = p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name;
        g.appendChild(text(b.x + 25, cy + 3, label, { size: 8.5, fill: nameCol }));

        // r/w census on the right of the row
        if (p.w || p.r) {
          g.appendChild(text(b.x + BW - 6, cy + 3,
            (p.w ? p.w + 'w' : '') + (p.w && p.r ? '/' : '') + (p.r ? p.r + 'r' : ''),
            { size: 7, fill: C.faint, anchor: 'end' }));
        }
        if (p.unresolved) {
          // An unresolved key is a wire this sheet knows exists and cannot place.
          g.appendChild(el('circle', { cx: b.x + BW - 3, cy: cy - 4, r: 1.5, fill: C.world, opacity: 0.8 }));
        }

        // terminal pads, both edges
        [b.x, b.x + BW].forEach(function (px) {
          g.appendChild(el('rect', { x: px - 2, y: cy - 2, width: 4, height: 4,
            fill: '#11141a', stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 0.7 }));
        });

        // hit target
        var hit = el('rect', { x: b.x, y: y, width: BW, height: ROW, fill: 'transparent',
          style: 'cursor:pointer' });
        hit.addEventListener('click', function (ev) { ev.stopPropagation(); select(p.file); });
        g.appendChild(hit);
        p.rowEl = g;
      });

      gBlock.appendChild(g);
    });
  }

  // ── pulses ────────────────────────────────────────────────────────────────
  /**
   * A spike is one recorded run of one scheduled job. It fires a traveller down
   * every conductor leaving that job's pin. Nothing else creates a pulse.
   */
  function ingestSpikes(p) {
    (p.spikes || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (sp) {
      var sig = sp.at + '|' + sp.job;
      if (seenSpike[sig]) return;
      seenSpike[sig] = 1;
      fire('handlers/' + sp.job + '.js', sp.ok === false);
    });
    ingestFreshness(p);
  }

  /**
   * The second source of motion: a store that changed since the last poll fires
   * every conductor that carries it.
   *
   * The first poll only establishes a baseline. Firing on it would light the
   * whole sheet at load with writes that may be hours old, which would read as
   * "everything is busy right now" and be false.
   */
  function ingestFreshness(p) {
    var t = (p.stores && p.stores.touched) || {};
    var first = (seenTouch === null);
    if (first) { seenTouch = {}; }
    Object.keys(t).forEach(function (ns) {
      var prev = seenTouch[ns];
      seenTouch[ns] = t[ns];
      if (first || prev === undefined || t[ns] <= prev) return;
      fireStore(ns);
    });
  }

  /** Namespace of a store key, matching lib/db-touch.namespaceOf exactly. */
  function nsOf(key) {
    var parts = String(key || '').split(':');
    if (!parts[0]) return null;
    if (parts[0] === 'limen' && parts.length > 1) return 'limen:' + parts[1];
    return parts[0];
  }

  function fireStore(ns) {
    conductors.forEach(function (w) {
      if (w.kind !== 'data' || !w.c.via) return;
      if (nsOf(w.c.via) !== ns) return;
      launch(w, false);
    });
  }

  function fire(file, failed) {
    conductors.forEach(function (w) {
      if (w.a.file !== file) return;
      launch(w, failed);
    });
  }

  /**
   * Launches are queued and spread over SPREAD_MS rather than all firing on the
   * poll tick.
   *
   * This is presentation, not invention, and the distinction matters. The events
   * are real and the COUNT is exact: every queued pulse is one recorded run or
   * one observed store change, and none is added, dropped or repeated. What the
   * spread changes is only the instant we render an event we learned about in a
   * batch. Firing all of them on the 15s boundary made the sheet flash and then
   * sit dead, which misreports steady traffic as periodic bursts.
   */
  var SPREAD_MS = 1800;
  var queue = [];

  function launch(w, failed) {
    if (!show[w.kind]) return;
    queue.push({ w: w, failed: failed, at: performance.now() + Math.random() * SPREAD_MS });
  }

  function emit(q) {
    var w = q.w;
    if (!show[w.kind]) return;
    if (pulses.length >= PULSE_CAP) return;
    if (!w.len) { try { w.len = w.el.getTotalLength(); } catch (e) { w.len = 0; } }
    if (!w.len) return;
    var dot = el('circle', {
      r: q.failed ? 2.2 : 1.9, fill: q.failed ? '#d97070' : '#eaf6f1',
      filter: 'url(#glow)', 'pointer-events': 'none'
    });
    gPulse.appendChild(dot);
    pulses.push({ w: w, el: dot, t: 0, speed: 0.55 + Math.min(0.5, 260 / w.len) });
  }

  var last = 0;
  function tick(ts) {
    var dt = last ? Math.min(64, ts - last) : 16;
    last = ts;

    for (var q = queue.length - 1; q >= 0; q--) {
      if (queue[q].at > ts) continue;
      emit(queue[q]);
      queue.splice(q, 1);
    }

    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += (dt / 1000) * p.speed;
      if (p.t >= 1) { gPulse.removeChild(p.el); pulses.splice(i, 1); continue; }
      var pt;
      try { pt = p.w.el.getPointAtLength(p.t * p.w.len); } catch (e) { pt = null; }
      if (!pt) { gPulse.removeChild(p.el); pulses.splice(i, 1); continue; }
      p.el.setAttribute('cx', pt.x);
      p.el.setAttribute('cy', pt.y);
      p.el.setAttribute('opacity', p.t < 0.08 ? p.t / 0.08 : (p.t > 0.9 ? (1 - p.t) / 0.1 : 1));
    }
    requestAnimationFrame(tick);
  }

  // ── pan / zoom ────────────────────────────────────────────────────────────
  function apply() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); }

  function fitViewport() {
    var st = document.getElementById('stage');
    view.h = view.w * (st.clientHeight / st.clientWidth);
  }
  function fitAll() {
    var st = document.getElementById('stage');
    var ar = st.clientWidth / st.clientHeight;
    var pad = 60;
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
      var dx = (e.clientX - sx) * k, dy = (e.clientY - sy) * k;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
      view.x = vx - dx; view.y = vy - dy;
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
      var nw = Math.max(320, Math.min(extent.w * 2.4, view.w * k));
      var nh = nw * (view.h / view.w);
      view.x = px - nw * fx; view.y = py - nh * fy;
      view.w = nw; view.h = nh;
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
        b.classList.toggle('on', show[k]);
        b.className = 'tog' + (show[k] ? ' on ' + cls : '');
        applyFilters(); renderStat();
      });
    }
    tog('tD', 'data', 'd'); tog('tM', 'module', 'm'); tog('tW', 'world', 'w');
    document.getElementById('tFit').addEventListener('click', fitAll);
    document.getElementById('inspX').addEventListener('click', deselect);

    var f = document.getElementById('find');
    f.addEventListener('input', function () {
      findTerm = f.value.trim().toLowerCase();
      highlightFind();
    });
    f.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !findTerm) return;
      for (var id in pinIndex) {
        if (id.toLowerCase().indexOf(findTerm) !== -1) { focusPin(id); break; }
      }
    });
  }

  function highlightFind() {
    blocks.forEach(function (b) {
      b.pins.forEach(function (p) {
        if (!p.rowEl) return;
      });
    });
    // Cheap: dim non-matching conductors only when a term is present.
    if (!findTerm) { applyFilters(); return; }
    conductors.forEach(function (w) {
      if (!show[w.kind]) return;
      var hit = w.a.file.toLowerCase().indexOf(findTerm) !== -1 ||
                w.b.file.toLowerCase().indexOf(findTerm) !== -1;
      w.el.setAttribute('opacity', hit ? 0.9 : 0.04);
    });
  }

  function focusPin(file) {
    var p = pinIndex[file];
    if (!p) return;
    var nw = 1400, nh = nw * (view.h / view.w);
    view.w = nw; view.h = nh;
    view.x = p.block.x + BW / 2 - nw / 2;
    view.y = p.cy - nh / 2;
    apply(); select(file);
  }

  // ── inspector ─────────────────────────────────────────────────────────────
  function select(file) { selected = file; applyFilters(); renderInspector(); }
  function deselect() {
    if (!selected) return;
    selected = null; applyFilters(); renderInspector();
  }

  function renderInspector() {
    var box = document.getElementById('insp');
    var body = document.getElementById('inspBody');
    if (!selected) { box.classList.remove('show'); return; }
    var p = pinIndex[selected];
    if (!p) { box.classList.remove('show'); return; }

    var out = conductors.filter(function (w) { return w.a.file === selected; });
    var into = conductors.filter(function (w) { return w.b.file === selected; });
    var sched = scheduled[selected];

    var stores = { w: [], r: [] };
    (graph.stores || []).forEach(function (s) {
      if (s.w.indexOf(selected) !== -1) stores.w.push(s);
      if (s.r.indexOf(selected) !== -1) stores.r.push(s);
    });

    var h = '';
    h += '<h3>' + esc(p.name) + '</h3>';
    h += '<div class="path">' + esc(p.file) + '</div>';
    h += '<div class="row"><span class="k">terminal</span><span class="v">' +
         esc(p.block.id) + ' · pin ' + p.n + '</span></div>';
    h += '<div class="row"><span class="k">panel</span><span class="v">' + esc(p.block.label) + '</span></div>';

    if (sched) {
      h += '<div class="row"><span class="k">scheduled</span><span class="v">' +
           esc(sched.schedule) + '</span></div>';
      h += '<div class="row"><span class="k">source · kind</span><span class="v">' +
           esc(sched.source) + ' · ' + esc(sched.kind) + '</span></div>';
    }
    h += '<div class="row"><span class="k">conductors</span><span class="v">' +
         out.length + ' out · ' + into.length + ' in</span></div>';

    if (p.callers) {
      h += '<h4>Fetched by</h4>';
      p.callers.forEach(function (f) { h += '<div class="line">' + esc(f) + '</div>'; });
      h += '<div class="warn">A fetch is not statically directional. This host sits on ' +
           'the inbound side because its callers are ingest-side files, not because the ' +
           'sheet can prove the direction.</div>';
      body.innerHTML = h; box.classList.add('show'); return;
    }

    h += '<h4>Writes</h4>';
    if (stores.w.length) {
      stores.w.forEach(function (s) {
        h += '<div class="line"><span class="tag w">W</span><span>' + esc(s.key) +
             (s.dynamic ? '<span style="color:#4e4b46">*</span>' : '') +
             ' <span style="color:#4e4b46">· read by ' + s.r.length + '</span></span></div>';
      });
    } else h += '<div class="empty">writes nothing</div>';

    h += '<h4>Reads</h4>';
    if (stores.r.length) {
      stores.r.forEach(function (s) {
        h += '<div class="line"><span class="tag r">R</span><span>' + esc(s.key) +
             (s.dynamic ? '<span style="color:#4e4b46">*</span>' : '') +
             ' <span style="color:#4e4b46">· written by ' + s.w.length + '</span></span></div>';
      });
    } else h += '<div class="empty">reads nothing</div>';

    if (p.hosts && p.hosts.length) {
      h += '<h4>External hosts</h4>';
      p.hosts.forEach(function (host) { h += '<div class="line">' + esc(host) + '</div>'; });
    }

    if (p.unresolved) {
      h += '<div class="warn">' + p.unresolved + ' store call' + (p.unresolved === 1 ? '' : 's') +
           ' in this file build their key entirely at runtime. Those conductors exist and ' +
           'are not drawn, because the scanner will not guess a key it cannot read.</div>';
    }

    var deadW = stores.w.filter(function (s) { return !s.r.length; });
    if (deadW.length) {
      h += '<div class="warn">Writes ' + deadW.length + ' store' + (deadW.length === 1 ? '' : 's') +
           ' that nothing reads: ' + esc(deadW.map(function (s) { return s.key; }).join(', ')) + '</div>';
    }

    body.innerHTML = h;
    box.classList.add('show');
  }

  // ── header stat ───────────────────────────────────────────────────────────
  function renderStat() {
    var shown = conductors.filter(function (w) { return show[w.kind]; }).length;
    var obs = board && board.coverage ? board.coverage.observed : null;
    var dec = board && board.coverage ? board.coverage.declared : null;
    var s = '<b>' + blocks.length + '</b> blocks · <b>' + Object.keys(pinIndex).length +
            '</b> pins · <b>' + shown + '</b>/' + conductors.length + ' conductors';
    if (conductors.dropped) s += ' · <b>' + conductors.dropped + '</b> unplaced';
    if (obs != null) s += ' · <b>' + obs + '</b>/' + dec + ' jobs observed';
    document.getElementById('stat').innerHTML = s;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
