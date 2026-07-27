/**
 * assets/js/main-brain.js — the render layer for /main-brain.
 *
 * THREE REGISTERS, THREE DIFFERENT QUESTIONS
 *
 *   I  THE HARNESS — what ran. Reads /api/harness, which keeps `declared` (the
 *      schedule) and `observed` (the spike log) as separate objects. This file
 *      keeps them separate too. A job with a schedule and no beats is drawn as a
 *      hollow node on a dashed line, because that is what it is. There is no
 *      idle animation and no ambient pulse anywhere in this file: every moving
 *      thing on screen is one recorded run. If the ledger is empty the diagram
 *      stays dark, because a lively picture with no events behind it would be a
 *      fabricated signal wearing a nice coat.
 *
 *   II THE LOOP — what it learned. Nine hops from sensing to having learned.
 *      Each hop is MEASURED on load against a live endpoint, not asserted from a
 *      constant in this file, so the picture tracks the system rather than
 *      tracking my opinion of the system on the day I wrote it. Two of the nine
 *      cannot be measured at all: no code path exists to probe, so they are
 *      drawn `structural` and say so. Guessing them green would be the exact
 *      failure this register exists to catch.
 *
 *   III THE FIELD — what it senses. Twenty domains, the stress scalar each one
 *      actually stores, and the degeneracies that scalar can have (pinned to a
 *      constant, clamped at a cap, saturated at the ceiling, simulated). Probes
 *      are per-domain on click and never batched: one resolver read scans a few
 *      thousand Redis rows, and firing twenty on every page load is a bandwidth
 *      bill rather than a dashboard.
 *
 * AUTHORITY, DRAWN HONESTLY
 * The operator can shut four valves out of eighteen jobs, pause AI spend at
 * runtime, and pause social posting. That is the whole list. The veto arc is
 * drawn spanning only the efferent side because inward jobs have no valve by
 * design: a switch that can silently turn off your own senses is a liability,
 * not a safety feature. Drawing a valve where none exists would tell the
 * operator they can reach something they cannot.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  var svg, gRing, gWire, gNode, gFlow, gLabel;
  var lsvg;
  var board = null, key = '', live = true;
  var seenSpike = {}, packets = [];
  var selected = null;
  var layout = null;
  var snapshot = null;            // /api/domain-snapshot
  var loopDomain = 'energy';
  var loopState = null, loopSel = null;
  var probes = {};                // per-domain field probe results

  var C = {
    live: '#8fcbb6', starve: '#d6a95e', dead: '#8a6060',
    fail: '#d97070', never: '#5a5750', veto: '#c25b5b',
    wire: '#3a3f4a', wireLit: '#6f7a8c', text: '#d8d3c9', dim: '#7d786f',
    gold: '#c9a94e', goldGhost: 'rgba(201,169,78,0.2)'
  };

  /**
   * Where each role sits on the ring. Degrees, clockwise from east, screen
   * coordinates (y down), so 90 is the bottom of the circle and 270 the top.
   *
   * The arrangement is the argument: afferent roles occupy the left half,
   * efferent roles the right half, regulation across the top holding set-points
   * over both. Reading the picture left to right is reading signal becoming
   * action, which is the only reason to lay it out radially instead of as a list.
   */
  var ARCS = {
    relay:      { a0: 148, a1: 212, label: 'RELAY',      sub: 'thalamus · signal in',      side: 'L' },
    return:     { a0: 222, a1: 252, label: 'RETURN',     sub: 'reafference · consequence', side: 'L' },
    regulation: { a0: 258, a1: 302, label: 'REGULATION', sub: 'hypothalamus · set-points', side: 'T' },
    proposal:   { a0: 310, a1: 348, label: 'PROPOSAL',   sub: 'dlPFC · decides',           side: 'R' },
    motor:      { a0: 336, a1: 384, label: 'MOTOR',      sub: 'acts on the world',         side: 'R' }
  };
  var ROLE_ORDER = ['relay', 'return', 'regulation', 'proposal', 'motor'];

  // Geometry, recomputed on resize.
  var G = { cx: 0, cy: 0, R: 0, coreR: 0, valveR: 0, worldR: 0, w: 0, h: 0 };

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    return e;
  }
  function clear(g) { while (g && g.firstChild) g.removeChild(g.firstChild); }
  function rad(d) { return d * Math.PI / 180; }
  function px(cx, cy, r, deg) { return { x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) }; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function text(x, y, str, o) {
    o = o || {};
    var t = el('text', {
      x: x, y: y, fill: o.fill || C.text,
      'font-size': (o.size || 11), 'font-weight': o.weight || 400,
      'letter-spacing': o.ls != null ? o.ls : 0,
      'text-anchor': o.anchor || 'start',
      'font-family': "'IBM Plex Mono',ui-monospace,monospace",
      opacity: o.opacity != null ? o.opacity : 1
    });
    t.textContent = str;
    return t;
  }

  // ── boot ───────────────────────────────────────────────────────────────
  function init() {
    svg = document.getElementById('svg');
    lsvg = document.getElementById('lsvg');
    gRing = el('g'); gWire = el('g'); gNode = el('g'); gFlow = el('g'); gLabel = el('g');
    [gRing, gWire, gNode, gFlow, gLabel].forEach(function (g) { svg.appendChild(g); });

    var btn = document.getElementById('btnLive');
    btn.classList.add('on');
    btn.addEventListener('click', function () {
      live = !live;
      btn.classList.toggle('on', live);
      btn.textContent = live ? 'live' : 'paused';
    });

    // Three ways out of the inspector, because one is never enough.
    svg.addEventListener('click', deselect);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') deselect(); });

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

    window.addEventListener('resize', function () { if (board) render(); if (loopState) renderLoop(); });
    setInterval(function () { if (live && key) load(); }, POLL_MS);
    requestAnimationFrame(tick);
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
    if (!show) {
      document.body.classList.add('opened');
      // The open registers only need loading once the gate is passed.
      loadSnapshot();
      probeLoop(loopDomain);
    }
  }

  // ── data: the harness ──────────────────────────────────────────────────
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
      if (!byJob[sp.job]) return;
      packets.push({
        job: sp.job, born: performance.now(),
        ok: sp.ok !== false,
        vetoed: !!(sp.note && sp.note.indexOf('vetoed') === 0)
      });
    });
    var ks = Object.keys(seenSpike);
    if (ks.length > 4000) ks.slice(0, 2000).forEach(function (k) { delete seenSpike[k]; });
  }

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

  // ── layout: the ring ───────────────────────────────────────────────────
  function computeLayout() {
    var wrap = document.getElementById('harnesswrap');
    var w = wrap.clientWidth || 1200, h = wrap.clientHeight || 660;
    G.w = w; G.h = h;
    G.cx = w / 2; G.cy = h / 2;
    G.R = Math.max(120, Math.min(w * 0.28, h * 0.40));
    G.coreR = Math.max(38, G.R * 0.20);
    G.valveR = G.R * 0.62;
    G.worldR = G.R + Math.min(150, w * 0.13);

    var nodes = [];
    ROLE_ORDER.forEach(function (role) {
      var arc = ARCS[role];
      var jobs = (board.jobs || []).filter(function (j) { return j.declared.role === role; });
      var n = jobs.length;
      jobs.forEach(function (j, i) {
        // Spread inside the arc, with a half-step inset so a single job sits at
        // the arc's midpoint rather than on its edge.
        var t = n === 1 ? 0.5 : (i + 0.5) / n;
        var deg = arc.a0 + (arc.a1 - arc.a0) * t;
        var p = px(G.cx, G.cy, G.R, deg);
        nodes.push({ job: j, role: role, deg: deg, x: p.x, y: p.y, arc: arc });
      });
    });
    return { nodes: nodes };
  }

  // ── render: register I ─────────────────────────────────────────────────
  function render() {
    layout = computeLayout();
    svg.setAttribute('viewBox', '0 0 ' + G.w + ' ' + G.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    [gRing, gWire, gNode, gFlow, gLabel].forEach(clear);

    var observed = board.coverage.observed;
    document.getElementById('dark').classList.toggle('show', observed === 0);

    renderControls();
    renderHarnessStat();
    drawArcs();
    drawCore();
    drawValveArc();
    drawSpokes();
    drawNodes();
    renderInspector();
  }

  function renderHarnessStat() {
    var c = board.coverage;
    var vs = (board.jobs || []).filter(function (j) { return j.valve && j.valve.open === false; }).length;
    document.getElementById('hstat').innerHTML =
      '<b>' + c.observed + '</b> of <b>' + c.declared + '</b> jobs observed to run' +
      (c.neverObserved ? ' &middot; <span class="bad">' + c.neverObserved + ' never observed</span>' : '') +
      '<br>' + (vs ? '<span class="bad">' + vs + ' valve' + (vs > 1 ? 's' : '') + ' shut</span>' : '4 valves, all open');
  }

  /** The role arcs, drawn as the band each group of jobs sits on. */
  function drawArcs() {
    ROLE_ORDER.forEach(function (role) {
      var a = ARCS[role];
      var p0 = px(G.cx, G.cy, G.R, a.a0), p1 = px(G.cx, G.cy, G.R, a.a1);
      var big = (a.a1 - a.a0) > 180 ? 1 : 0;
      gRing.appendChild(el('path', {
        d: 'M' + p0.x + ',' + p0.y + ' A' + G.R + ',' + G.R + ' 0 ' + big + ' 1 ' + p1.x + ',' + p1.y,
        fill: 'none', stroke: C.goldGhost, 'stroke-width': 1
      }));
      // Role label, pushed outside the ring on the arc's midline.
      var mid = (a.a0 + a.a1) / 2;
      var lp = px(G.cx, G.cy, G.worldR + 16, mid);
      var anchor = Math.cos(rad(mid)) < -0.25 ? 'end' : (Math.cos(rad(mid)) > 0.25 ? 'start' : 'middle');
      gLabel.appendChild(text(lp.x, lp.y, a.label, { size: 10.5, fill: C.gold, ls: 2.6, anchor: anchor, weight: 500 }));
      gLabel.appendChild(text(lp.x, lp.y + 13, a.sub, { size: 9.5, fill: C.dim, ls: 0.4, anchor: anchor }));
    });
  }

  /**
   * The core. This is the operator's seat, and the label says what the operator
   * can actually do from it rather than implying general command.
   */
  function drawCore() {
    gNode.appendChild(el('circle', { cx: G.cx, cy: G.cy, r: G.coreR,
      fill: 'rgba(201,169,78,0.05)', stroke: C.goldGhost, 'stroke-width': 1 }));
    gLabel.appendChild(text(G.cx, G.cy - 4, 'OPERATOR', { size: 10, fill: C.gold, ls: 2.4, anchor: 'middle', weight: 500 }));
    gLabel.appendChild(text(G.cx, G.cy + 10, 'observe · veto', { size: 9, fill: C.dim, anchor: 'middle' }));
  }

  /**
   * The veto arc. It spans the efferent side ONLY, because that is the only side
   * with valves. Each outward job gets a valve glyph on its own spoke: hollow
   * when open, filled and barred when shut.
   */
  function drawValveArc() {
    var motor = ARCS.motor;
    var p0 = px(G.cx, G.cy, G.valveR, motor.a0 - 6), p1 = px(G.cx, G.cy, G.valveR, motor.a1 + 6);
    gRing.appendChild(el('path', {
      d: 'M' + p0.x + ',' + p0.y + ' A' + G.valveR + ',' + G.valveR + ' 0 0 1 ' + p1.x + ',' + p1.y,
      fill: 'none', stroke: 'rgba(194,91,91,0.32)', 'stroke-width': 1, 'stroke-dasharray': '2 4'
    }));
    var lp = px(G.cx, G.cy, G.valveR - 16, (motor.a0 + motor.a1) / 2);
    gLabel.appendChild(text(lp.x, lp.y, 'VETO', { size: 9.5, fill: C.veto, ls: 2.4, anchor: 'middle', weight: 500 }));
  }

  /** One spoke per job, core to node, plus the world stub beyond the node. */
  function drawSpokes() {
    layout.nodes.forEach(function (nd) {
      var s = stateOf(nd.job), on = s !== 'never';
      var inner = px(G.cx, G.cy, G.coreR + 2, nd.deg);
      var outer = px(G.cx, G.cy, G.R - 9, nd.deg);
      gWire.appendChild(el('line', {
        x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
        stroke: on ? C.wireLit : C.wire, 'stroke-width': on ? 1.5 : 1,
        'stroke-dasharray': on ? null : '3 6'
      }));
      // Beyond the node: the world. Afferent stubs come in from it, efferent
      // stubs go out to it. Same line, opposite meaning, so the arrowhead is
      // the only thing that distinguishes them.
      var w0 = px(G.cx, G.cy, G.R + 9, nd.deg);
      var w1 = px(G.cx, G.cy, G.worldR, nd.deg);
      var efferent = nd.role === 'motor';
      gWire.appendChild(el('line', {
        x1: efferent ? w0.x : w1.x, y1: efferent ? w0.y : w1.y,
        x2: efferent ? w1.x : w0.x, y2: efferent ? w1.y : w0.y,
        stroke: on ? C.wireLit : C.wire, 'stroke-width': on ? 1.3 : 1,
        'stroke-dasharray': on ? null : '3 6', opacity: 0.72
      }));

      if (efferent) {
        var v = nd.job.valve || { open: true };
        var vp = px(G.cx, G.cy, G.valveR, nd.deg);
        drawValveGlyph(vp.x, vp.y, nd.deg, v.open !== false);
      }
      nd.inner = inner; nd.outer = outer; nd.w1 = w1;
    });
  }

  /** The standard two-triangle valve glyph, oriented along its spoke. */
  function drawValveGlyph(x, y, deg, open) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ') rotate(' + deg + ')' });
    var col = open ? 'rgba(143,203,182,0.75)' : C.veto;
    g.appendChild(el('path', { d: 'M-7,-6 L0,0 L-7,6 Z', fill: open ? 'none' : col, stroke: col, 'stroke-width': 1.2 }));
    g.appendChild(el('path', { d: 'M7,-6 L0,0 L7,6 Z', fill: open ? 'none' : col, stroke: col, 'stroke-width': 1.2 }));
    if (!open) g.appendChild(el('line', { x1: 0, y1: -9, x2: 0, y2: 9, stroke: col, 'stroke-width': 2 }));
    gNode.appendChild(g);
  }

  function drawNodes() {
    layout.nodes.forEach(function (nd) {
      var s = stateOf(nd.job), col = colorOf(s), never = s === 'never';
      var c = el('circle', {
        cx: nd.x, cy: nd.y, r: 7,
        fill: never ? 'none' : col, stroke: never ? C.never : col,
        'stroke-width': never ? 1.2 : 0, cursor: 'pointer'
      });
      c.addEventListener('click', function (ev) { ev.stopPropagation(); select(nd.job.job); });
      gNode.appendChild(c);
      if (selected === nd.job.job) {
        gNode.appendChild(el('circle', { cx: nd.x, cy: nd.y, r: 12, fill: 'none',
          stroke: C.gold, 'stroke-width': 1 }));
      }
      // A coin on the one job that costs money.
      if (nd.job.cost && nd.job.cost.cost === 'paid') {
        gNode.appendChild(el('circle', { cx: nd.x + 10, cy: nd.y - 9, r: 3.4,
          fill: 'none', stroke: C.starve, 'stroke-width': 1.1 }));
      }
      // Label just outside the node, on whichever side keeps it off the ring.
      var lp = px(G.cx, G.cy, G.R + 17, nd.deg);
      var cosd = Math.cos(rad(nd.deg));
      var anchor = cosd < -0.2 ? 'end' : (cosd > 0.2 ? 'start' : 'middle');
      var t = text(lp.x, lp.y + 3.5, nd.job.job, {
        size: 10, fill: never ? C.never : C.text, anchor: anchor,
        opacity: never ? 0.72 : 1
      });
      t.setAttribute('cursor', 'pointer');
      t.addEventListener('click', function (ev) { ev.stopPropagation(); select(nd.job.job); });
      gLabel.appendChild(t);
    });
  }

  // ── the spike animation ────────────────────────────────────────────────
  // Every packet is one recorded run. There is no generator here: if `packets`
  // is empty nothing moves, which is the entire point of the register.
  var TRAVEL = 1500;
  function tick(now) {
    if (gFlow && layout) {
      clear(gFlow);
      var keep = [];
      for (var i = 0; i < packets.length; i++) {
        var p = packets[i];
        var age = now - p.born;
        if (age > TRAVEL) continue;
        keep.push(p);
        var nd = null;
        for (var k = 0; k < layout.nodes.length; k++) {
          if (layout.nodes[k].job.job === p.job) { nd = layout.nodes[k]; break; }
        }
        if (!nd) continue;
        var f = age / TRAVEL;
        var efferent = nd.role === 'motor';
        // Afferent travels world → node → core. Efferent travels core → valve →
        // world, and a vetoed run stops dead at the valve, which is the only
        // honest way to draw a cancelled action.
        var r0, r1;
        if (efferent) { r0 = G.coreR; r1 = p.vetoed ? G.valveR : G.worldR; }
        else { r0 = G.worldR; r1 = G.coreR; }
        var r = r0 + (r1 - r0) * f;
        var pt = px(G.cx, G.cy, r, nd.deg);
        var col = p.vetoed ? C.veto : (p.ok ? C.live : C.fail);
        var fade = p.vetoed && f > 0.82 ? (1 - (f - 0.82) / 0.18) : (1 - f * 0.35);
        gFlow.appendChild(el('circle', { cx: pt.x, cy: pt.y, r: 2.6, fill: col, opacity: Math.max(0, fade) }));
      }
      packets = keep;
    }
    requestAnimationFrame(tick);
  }

  // ── controls ───────────────────────────────────────────────────────────
  function renderControls() {
    var box = document.getElementById('controls');
    box.innerHTML = '';
    var ai = board.ai || {}, soc = board.social || {};

    // AI spend. Two boundaries, kept apart: the env var needs Vercel and a
    // redeploy, the runtime pause is instant. Collapsing them into one on/off
    // would tell the operator they can reach something they cannot.
    var aiCtl = document.createElement('div');
    aiCtl.className = 'ctl';
    var aiCls = !ai.envEnabled ? 'blocked' : (ai.runtimePaused ? 'off' : 'live');
    var aiTxt = !ai.envEnabled ? 'blocked at env' : (ai.runtimePaused ? 'paused' : 'live');
    aiCtl.innerHTML = '<span class="lab">AI spend</span><span class="val ' + aiCls + '">' + aiTxt + '</span>';
    var aiBtn = document.createElement('button');
    aiBtn.className = ai.runtimePaused ? 'go' : 'stop';
    aiBtn.textContent = ai.runtimePaused ? 'resume' : 'pause';
    aiBtn.addEventListener('click', function () { act('ai=' + (ai.runtimePaused ? 'resume' : 'pause')); });
    aiCtl.appendChild(aiBtn);
    if (ai.needsVercel) {
      var why = document.createElement('span');
      why.className = 'why'; why.textContent = ai.needsVercel;
      aiCtl.appendChild(why);
    }
    box.appendChild(aiCtl);

    // The one paid job that ignores the kill switch. Named, because a panel that
    // said "AI is off" while this ran would be lying.
    (ai.ungatedPaidJobs || []).forEach(function (jb) {
      var c = document.createElement('div');
      c.className = 'ctl paid';
      c.innerHTML = '<span class="coin">&#164;</span><span class="lab">' + esc(jb) + '</span>' +
        '<span class="why">paid, and does not consult the kill switch</span>';
      box.appendChild(c);
    });

    var sCtl = document.createElement('div');
    sCtl.className = 'ctl';
    sCtl.innerHTML = '<span class="lab">Social posting</span>' +
      '<span class="val ' + (soc.paused ? 'off' : 'live') + '">' + (soc.paused ? 'paused' : 'live') + '</span>';
    var sBtn = document.createElement('button');
    sBtn.className = soc.paused ? 'go' : 'stop';
    sBtn.textContent = soc.paused ? 'resume' : 'pause';
    sBtn.addEventListener('click', function () { act('social=' + (soc.paused ? 'resume' : 'pause')); });
    sCtl.appendChild(sBtn);
    box.appendChild(sCtl);
  }

  function act(qs) {
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&' + qs, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function () { load(); })
      .catch(function () {});
  }

  // ── inspector ──────────────────────────────────────────────────────────
  function select(job) { selected = job; render(); }
  function deselect() { if (selected) { selected = null; render(); } }

  function renderInspector() {
    var box = document.getElementById('insp');
    if (!selected) { box.classList.remove('show'); box.innerHTML = ''; return; }
    var j = null;
    (board.jobs || []).forEach(function (x) { if (x.job === selected) j = x; });
    if (!j) { box.classList.remove('show'); return; }

    var s = stateOf(j), role = (board.roles || {})[j.declared.role] || {};
    var stateWord = { live: 'running to schedule', starve: 'late', dead: 'not running',
                      fail: 'last run failed', never: 'never observed' }[s];

    var h = '<button class="x" title="close">&times;</button>';
    h += '<h3>' + esc(j.job) + '</h3>';
    h += '<div class="role">' + esc(role.label || j.declared.role) +
         (role.structure ? ' &middot; ' + esc(role.structure) : '') + '</div>';
    h += '<div class="st" style="color:' + colorOf(s) + '">' + stateWord + '</div>';

    h += row('declared', j.declared.schedule);
    h += row('source', j.declared.source);
    h += row('path', j.declared.path);
    if (j.observed.neverObserved) {
      h += '<div class="row"><span class="k">observed</span><span class="v never">no run ever recorded</span></div>';
    } else {
      h += row('last run', new Date(j.observed.at).toLocaleString());
      h += row('outcome', j.observed.ok ? 'ok' : 'failed', !j.observed.ok);
      if (j.observed.ms != null) h += row('took', j.observed.ms + ' ms');
      if (j.observed.overdue) h += row('overdue', 'yes', true);
      if (j.observed.note) h += row('note', j.observed.note, !j.observed.ok);
    }
    h += row('cost', j.cost.cost === 'paid'
      ? (j.cost.provider || 'paid') + (j.cost.model ? ' · ' + j.cost.model : '')
      : 'free', j.cost.cost === 'paid');
    if (j.cost.killSwitch === false) {
      h += '<div class="note" style="color:' + C.starve + '">' + esc(j.cost.note || '') + '</div>';
    }
    if (j.declared.note) h += '<div class="note">' + esc(j.declared.note) + '</div>';

    if (j.declared.kind === 'outward') {
      var v = j.valve || { open: true };
      h += '<div class="valve"><div class="lbl">Veto</div>';
      h += '<button class="sw ' + (v.open === false ? 'shut' : 'open') + '" id="valveBtn">' +
           (v.open === false ? 'open the valve' : 'shut the valve') + '</button>';
      h += '<div class="vstate">' + (v.open === false
        ? 'Shut' + (v.at ? ' ' + new Date(v.at).toLocaleString() : '') + '. The handler does not run; the ' +
          'attempt is still recorded so the silence is visible.'
        : 'Open. This job acts on the world on its schedule.') + '</div></div>';
    } else {
      h += '<div class="note">Inward job: computes and stores, so it has no valve. ' +
           'A switch that can silently turn off your own senses is a liability, not a safety feature.</div>';
    }

    box.innerHTML = h;
    box.classList.add('show');
    box.querySelector('.x').addEventListener('click', deselect);
    var vb = document.getElementById('valveBtn');
    if (vb) {
      var open = !(j.valve && j.valve.open === false);
      vb.addEventListener('click', function () {
        act('valve=' + encodeURIComponent(j.job) + '&open=' + (open ? '0' : '1'));
      });
    }
  }

  function row(k, v, bad) {
    return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v' +
      (bad ? ' bad' : '') + '">' + esc(v) + '</span></div>';
  }

  // ═══ REGISTER II — THE LOOP ═══════════════════════════════════════════
  /**
   * The nine hops, and how each one is established.
   *
   * `probe` returns { verdict, evidence }. Verdicts:
   *   closed   — measured, and the signal gets through
   *   open     — measured, and it does not
   *   inverted — measured, gets through, and teaches the opposite of the truth
   *   struct   — NOT measurable: no code path exists to carry this signal, so
   *              there is nothing to probe. Reported as a structural absence
   *              rather than dressed up as a failed measurement.
   */
  var HOPS = [
    { id: 'record', name: 'RECORD', what: 'feed-record stores the realized feed value',
      probe: function (d) {
        var n = d.resolve && d.resolve.recorderRows;
        return n > 0 ? { verdict: 'closed', evidence: n + ' recorded rows in feedhist' }
                     : { verdict: 'open', evidence: 'no recorded rows for this domain' };
      } },
    { id: 'forecast', name: 'FORECAST', what: 'feed-resolve derives and stores a direction call',
      probe: function (d) {
        var n = d.resolve && d.resolve.storedForecasts;
        return n > 0 ? { verdict: 'closed', evidence: n + ' forecasts stored' }
                     : { verdict: 'open', evidence: 'no forecasts stored' };
      } },
    { id: 'grade', name: 'GRADE', what: 'the resolver scores those calls against what happened',
      probe: function (d) {
        var n = d.resolve && d.resolve.resolvedCount;
        return n > 0 ? { verdict: 'closed', evidence: n + ' resolved forward-only' }
                     : { verdict: 'open', evidence: 'nothing has aged past the horizon yet' };
      } },
    { id: 'reward', name: 'REWARD', what: 'the score becomes a usable teaching signal',
      // Reads SKILL, not the hit rate. The resolver now reports what a forecaster
      // that never calls a direction would have scored on the same rows, so this
      // hop can tell competence from abstention instead of inferring it from
      // per-forecast detail. A hit rate of 1.0 on a constant series is abstention.
      probe: function (d) {
        var r = d.resolve;
        if (!r || typeof r.externalHitRate !== 'number') {
          return { verdict: 'open', evidence: 'hit rate abstains (null): nothing has resolved yet' };
        }
        var dir = r.directional || {};
        var hit = r.externalHitRate, base = r.alwaysStableRate, skill = r.skill;
        if (typeof skill !== 'number') {
          return { verdict: 'unknown', evidence: 'hit rate ' + hit + ', but no baseline reported to compare it against' };
        }
        if (!dir.n) {
          return { verdict: 'inverted',
            evidence: 'every one of ' + r.resolvedCount + ' calls was "stable", so the hit rate of ' + hit +
                      ' is the abstention rate. This series does not move: there is nothing here to learn from.' };
        }
        if (skill <= 0) {
          return { verdict: 'inverted',
            evidence: 'hit rate ' + hit + ' against an always-stable baseline of ' + base + ', so skill is ' +
                      skill + '. ' + dir.hits + '/' + dir.n + ' directional calls credited, sign accuracy ' +
                      dir.signAccuracy + '. Below 0.5 means the calls are backwards, not merely noisy.' };
        }
        return { verdict: 'closed',
          evidence: 'skill +' + skill + ' (hit ' + hit + ' vs baseline ' + base + '), ' +
                    dir.hits + '/' + dir.n + ' directional calls credited, sign accuracy ' + dir.signAccuracy };
      } },
    { id: 'update', name: 'UPDATE', what: 'the teaching signal changes a weight', structural: true,
      probe: function () {
        return { verdict: 'struct',
          evidence: 'Not probeable: the only consumer of the hit rate is browser code ' +
                    '(domain-brain-base.js, energy-brain.js). No server path carries it to a weight, ' +
                    'so there is no endpoint that could answer this.' };
      } },
    { id: 'persist', name: 'PERSIST', what: 'the changed weight survives the tab closing',
      probe: function (d) {
        var s = d.weights && d.weights.snapshot;
        return s ? { verdict: 'closed', evidence: 'snapshot stored' + (s.storedAt ? ' ' + new Date(s.storedAt).toLocaleString() : '') }
                 : { verdict: 'open', evidence: 'brainwts is empty for this domain: nothing has ever been stored' };
      } },
    { id: 'reload', name: 'RELOAD', what: 'the next forecast uses the learned weight', structural: true,
      probe: function () {
        return { verdict: 'struct',
          evidence: 'Not probeable: the graded forecaster is feed-resolver.deriveForecast, a fixed ' +
                    'least-squares fit with no parameters. It has nothing a weight could change. ' +
                    'The thing being graded and the thing being trained are different objects.' };
      } },
    { id: 'consolidate', name: 'CONSOLIDATE', what: 'the offline pass reviews calibration and drift',
      probe: function (d) {
        var r = d.consolidation && d.consolidation.report;
        return r ? { verdict: 'closed', evidence: 'proposal ' + r.status + ', ' +
                       (r.recommendations || []).length + ' recommendation(s)' }
                 : { verdict: 'open', evidence: 'no proposal has ever been generated: feed-consolidate is on no schedule' };
      } },
    { id: 'prior', name: 'PRIOR', what: 'consolidation moves the next cycle\'s prior',
      probe: function (d) {
        var r = d.consolidation && d.consolidation.report;
        if (!r) return { verdict: 'open', evidence: 'nothing upstream to apply' };
        return r.applied ? { verdict: 'closed', evidence: 'applied' }
                         : { verdict: 'open', evidence: 'proposal exists but is propose-only until a human applies it' };
      } }
  ];

  function probeLoop(domain) {
    loopDomain = domain;
    loopState = { domain: domain, loading: true };
    renderLoop();
    Promise.all([
      jget('/api/feed-resolve?domain=' + encodeURIComponent(domain) + '&detail=1'),
      jget('/api/brain-weights?domain=' + encodeURIComponent(domain)),
      jget('/api/feed-consolidate?domain=' + encodeURIComponent(domain))
    ]).then(function (r) {
      loopState = { domain: domain, loading: false, resolve: r[0], weights: r[1], consolidation: r[2] };
      loopState.hops = HOPS.map(function (h) {
        var out;
        try { out = h.probe(loopState); }
        catch (e) { out = { verdict: 'unknown', evidence: 'probe failed: ' + e.message }; }
        return { id: h.id, name: h.name, what: h.what, structural: !!h.structural,
                 verdict: out.verdict, evidence: out.evidence };
      });
      renderLoop();
    });
  }

  function jget(u) {
    return fetch(u, { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  var VCOL = { closed: C.live, open: C.fail, inverted: C.veto, struct: C.starve, unknown: C.never };

  function renderLoop() {
    var host = document.getElementById('loopsvg');
    var side = document.getElementById('loopside');
    var w = host.clientWidth || 560, h = host.clientHeight || 520;
    clear(lsvg);
    lsvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    if (!loopState || loopState.loading || !loopState.hops) {
      side.innerHTML = '<div style="color:' + C.dim + ';padding:14px 0">probing ' + esc(loopDomain) + '…</div>';
      return;
    }

    var hops = loopState.hops;
    var cx = w / 2, cy = h / 2, R = Math.min(w * 0.34, h * 0.36);
    var n = hops.length;

    // Edges first, so nodes sit on top. Edge i carries hop i's verdict: it is
    // the hop that either passes the signal along or does not.
    hops.forEach(function (hp, i) {
      var a0 = -90 + (360 / n) * i, a1 = -90 + (360 / n) * (i + 1);
      var col = VCOL[hp.verdict] || C.never;
      var passes = hp.verdict === 'closed';
      if (passes) {
        var p0 = px(cx, cy, R, a0), p1 = px(cx, cy, R, a1);
        lsvg.appendChild(el('path', {
          d: 'M' + p0.x + ',' + p0.y + ' A' + R + ',' + R + ' 0 0 1 ' + p1.x + ',' + p1.y,
          fill: 'none', stroke: col, 'stroke-width': 2.4, opacity: 0.9
        }));
      } else {
        // A broken hop is drawn broken: the arc stops short of the next node and
        // the gap is the finding. Nothing else on this page says "open" as
        // plainly as a ring you can see through.
        var g0 = a0 + (a1 - a0) * 0.10, g1 = a0 + (a1 - a0) * 0.36;
        var g2 = a0 + (a1 - a0) * 0.64, g3 = a0 + (a1 - a0) * 0.90;
        [[g0, g1], [g2, g3]].forEach(function (seg) {
          var q0 = px(cx, cy, R, seg[0]), q1 = px(cx, cy, R, seg[1]);
          lsvg.appendChild(el('path', {
            d: 'M' + q0.x + ',' + q0.y + ' A' + R + ',' + R + ' 0 0 1 ' + q1.x + ',' + q1.y,
            fill: 'none', stroke: col, 'stroke-width': hp.verdict === 'struct' ? 1.4 : 2,
            'stroke-dasharray': hp.verdict === 'struct' ? '3 5' : null, opacity: 0.85
          }));
        });
        var mid = (a1 + a0) / 2;
        var mp = px(cx, cy, R, mid);
        if (hp.verdict === 'inverted') {
          // An inverted hop is not a gap, it is a signal pointing the wrong way.
          var t0 = px(cx, cy, R, mid + 7), t1 = px(cx, cy, R, mid - 7);
          lsvg.appendChild(el('path', {
            d: 'M' + t0.x + ',' + t0.y + ' L' + mp.x + ',' + mp.y + ' L' + t1.x + ',' + t1.y,
            fill: 'none', stroke: col, 'stroke-width': 2
          }));
        } else {
          lsvg.appendChild(el('circle', { cx: mp.x, cy: mp.y, r: 2.6, fill: 'none',
            stroke: col, 'stroke-width': 1, opacity: 0.7 }));
        }
      }
    });

    hops.forEach(function (hp, i) {
      var a = -90 + (360 / n) * i;
      var p = px(cx, cy, R, a);
      var col = VCOL[hp.verdict] || C.never;
      var sel = loopSel === hp.id;
      var c = el('circle', { cx: p.x, cy: p.y, r: sel ? 7.5 : 5.5,
        fill: hp.verdict === 'closed' ? col : '#0a0b0e', stroke: col, 'stroke-width': 1.8, cursor: 'pointer' });
      c.addEventListener('click', function () { loopSel = hp.id; renderLoop(); });
      lsvg.appendChild(c);
      var lp = px(cx, cy, R + 24, a);
      var cosd = Math.cos(rad(a));
      var anchor = cosd < -0.25 ? 'end' : (cosd > 0.25 ? 'start' : 'middle');
      lsvg.appendChild(text(lp.x, lp.y + 3.5, hp.name, {
        size: 10, ls: 1.6, anchor: anchor, fill: sel ? C.gold : (hp.verdict === 'closed' ? C.text : col)
      }));
    });

    var openN = hops.filter(function (x) { return x.verdict !== 'closed'; }).length;
    lsvg.appendChild(text(cx, cy - 8, String(openN), { size: 30, weight: 300, anchor: 'middle',
      fill: openN ? C.fail : C.live }));
    lsvg.appendChild(text(cx, cy + 10, 'of ' + n + ' hops', { size: 9.5, ls: 1.6, anchor: 'middle', fill: C.dim }));
    lsvg.appendChild(text(cx, cy + 24, openN ? 'do not carry' : 'all carry', { size: 9.5, ls: 1.6, anchor: 'middle', fill: C.dim }));

    document.getElementById('lstat').innerHTML =
      'domain <b>' + esc(loopState.domain) + '</b><br>' +
      (openN ? '<span class="bad">' + openN + ' of ' + n + ' hops open</span>' : 'closed end to end');

    // Side list.
    var doms = ['energy', 'finance', 'economy', 'law', 'technology', 'governance', 'culture', 'education', 'defense'];
    var sel = '<div style="padding:6px 0 12px"><span style="color:' + C.dim + ';font-size:0.7rem;letter-spacing:2px;text-transform:uppercase">probe domain</span> ';
    doms.forEach(function (d) {
      sel += '<button class="pill' + (d === loopState.domain ? ' on' : '') + '" data-dom="' + d + '" style="margin:3px 3px 0 0">' + d + '</button>';
    });
    sel += '</div>';

    var list = '';
    hops.forEach(function (hp) {
      var col = VCOL[hp.verdict] || C.never;
      var vcls = hp.verdict === 'closed' ? 'closed' : hp.verdict === 'inverted' ? 'inverted'
        : hp.verdict === 'struct' ? 'struct' : hp.verdict === 'unknown' ? 'unknown' : 'open';
      var vlabel = hp.verdict === 'struct' ? 'structural' : hp.verdict;
      list += '<div class="hop' + (loopSel === hp.id ? ' sel' : '') + '" data-hop="' + hp.id + '">' +
        '<span class="dot" style="background:' + (hp.verdict === 'closed' ? col : 'transparent') +
        ';border:1.5px solid ' + col + '"></span>' +
        '<span class="nm"><b>' + esc(hp.name) + '</b> ' +
        '<span style="color:' + C.dim + '">' + esc(hp.what) + '</span>' +
        '<span class="ev">' + esc(hp.evidence) + '</span></span>' +
        '<span class="vd ' + vcls + '">' + esc(vlabel) + '</span></div>';
    });

    side.innerHTML = sel + list;
    Array.prototype.forEach.call(side.querySelectorAll('button[data-dom]'), function (b) {
      b.addEventListener('click', function () { probeLoop(b.getAttribute('data-dom')); });
    });
    Array.prototype.forEach.call(side.querySelectorAll('.hop'), function (rowEl) {
      rowEl.addEventListener('click', function () { loopSel = rowEl.getAttribute('data-hop'); renderLoop(); });
    });
  }

  // ═══ REGISTER III — THE FIELD ═════════════════════════════════════════
  function loadSnapshot() {
    jget('/api/domain-snapshot').then(function (j) {
      snapshot = j; renderField();
    });
  }

  /**
   * The degeneracies a stress scalar can have. Each is read off the snapshot
   * itself rather than hardcoded, so a domain that gets fixed stops being
   * flagged without anyone editing this file.
   */
  function flagsFor(name, d) {
    var out = [];
    var sigs = (d.signals || []).map(String);
    if (sigs.some(function (s) { return s.indexOf('simulated') >= 0; })) {
      out.push({ cls: 'sim', label: 'simulated', why: 'This domain has no live sources. Its stress is a sine wave of the clock (domain-snapshot.js:1627), and the recorder stores it with no filter.' });
    }
    if (sigs.some(function (s) { return s.indexOf('CAPPED') >= 0; })) {
      out.push({ cls: 'capped', label: 'capped', why: 'Every stress driver is a cross-domain reused feed, so the domain has no signal of its own and is clamped to 0.3. The event layer then adds on top of the clamp, which is why the displayed value can exceed it.' });
    }
    if (sigs.some(function (s) { return s.indexOf('LOW_SIGNAL') >= 0; })) {
      out.push({ cls: 'capped', label: 'low signal', why: 'Fewer than 2 real feeds. Stress is clamped and confidence reduced.' });
    }
    if (typeof d.stress === 'number' && d.stress >= 0.995) {
      out.push({ cls: 'sat', label: 'saturated', why: 'Pinned at the ceiling. A scalar at its maximum has no headroom left to represent "worse", which is exactly when it would matter.' });
    }
    var p = probes[name];
    if (p && p.flat) {
      out.push({ cls: 'const', label: 'constant', why: 'Every recorded row carries the same value. The feeds move; this scalar does not. It cannot teach anything because it never varies.' });
    }
    if (p && p.hit === 1) {
      out.push({ cls: 'const', label: 'hit rate 1.0', why: 'Perfect forecast accuracy is not competence here. A constant series makes "stable" trivially correct on every call.' });
    }
    if (!out.length && p) out.push({ cls: 'real', label: 'varying', why: 'The recorded series actually moves.' });
    if (!p) out.push({ cls: 'idle', label: 'not probed', why: '' });
    return out;
  }

  function renderField() {
    var host = document.getElementById('field');
    if (!snapshot || !snapshot.domains) { host.innerHTML = ''; return; }
    var names = Object.keys(snapshot.domains).sort();
    host.innerHTML = '';
    var probed = 0, flagged = 0;

    names.forEach(function (nm) {
      var d = snapshot.domains[nm] || {};
      var fl = flagsFor(nm, d);
      var p = probes[nm];
      if (p) probed++;
      if (fl.some(function (f) { return f.cls === 'const' || f.cls === 'sim' || f.cls === 'sat'; })) flagged++;

      var cell = document.createElement('div');
      cell.className = 'cell' + (p && p.loading ? ' probing' : '');
      var sv = (typeof d.stress === 'number') ? d.stress.toFixed(2) : '—';
      var col = typeof d.stress !== 'number' ? C.never
        : d.stress >= 0.8 ? C.fail : d.stress >= 0.55 ? C.starve : C.live;

      var html = '<div class="dn">' + esc(nm) + '</div>' +
        '<div class="sv" style="color:' + col + '">' + sv + '</div>' +
        '<div class="meta">' + esc(d.status || '—') +
        (typeof d.confidence === 'number' ? ' &middot; conf ' + d.confidence : '') +
        (d.stressSource ? '<br>' + esc(d.stressSource) : '') + '</div>';

      if (p && p.rows && p.rows.length > 1) html += sparkline(p.rows, col);
      if (p && !p.loading) {
        html += '<div class="meta">' + p.n + ' rows' +
          (p.hit != null ? ' &middot; hit ' + p.hit : '') +
          (p.resolved != null ? ' &middot; ' + p.resolved + ' graded' : '') + '</div>';
      }
      html += '<div>';
      fl.forEach(function (f) { html += '<span class="flag ' + f.cls + '" title="' + esc(f.why) + '">' + esc(f.label) + '</span>'; });
      html += '</div>';

      cell.innerHTML = html;
      cell.addEventListener('click', function () { probeDomain(nm); });
      host.appendChild(cell);
    });

    document.getElementById('fstat').innerHTML =
      '<b>' + names.length + '</b> domains &middot; <b>' + probed + '</b> probed' +
      (flagged ? '<br><span class="bad">' + flagged + ' reporting a degenerate scalar</span>' : '');
  }

  /** One domain's recorded history, on demand. Two calls, never batched. */
  function probeDomain(name) {
    if (probes[name] && probes[name].loading) return;
    probes[name] = { loading: true };
    renderField();
    Promise.all([
      jget('/api/feed-record?read=' + encodeURIComponent(name) + '&n=72'),
      jget('/api/feed-resolve?domain=' + encodeURIComponent(name))
    ]).then(function (r) {
      var rows = (r[0] && r[0].rows) || [];
      var series = rows.filter(function (x) { return x && typeof x.s === 'number'; })
        .sort(function (a, b) { return a.t - b.t; }).map(function (x) { return x.s; });
      var uniq = {}; series.forEach(function (v) { uniq[v] = 1; });
      probes[name] = {
        loading: false, rows: series, n: series.length,
        flat: series.length > 3 && Object.keys(uniq).length === 1,
        hit: r[1] && typeof r[1].externalHitRate === 'number' ? r[1].externalHitRate : null,
        resolved: r[1] ? r[1].resolvedCount : null
      };
      renderField();
    });
  }

  function sparkline(series, col) {
    var w = 180, h = 26, n = series.length;
    var lo = Math.min.apply(null, series), hi = Math.max.apply(null, series);
    var span = (hi - lo) || 1;
    var pts = series.map(function (v, i) {
      var x = (i / (n - 1)) * w;
      var y = h - 2 - ((v - lo) / span) * (h - 4);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    // A flat series is drawn flat and centred rather than rescaled to fill the
    // box: stretching zero variance into a lively line is the visual version of
    // fabricating a signal.
    var flat = hi === lo;
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polyline points="' + (flat ? '0,' + (h / 2) + ' ' + w + ',' + (h / 2) : pts) + '" fill="none" stroke="' +
      (flat ? C.veto : col) + '" stroke-width="1.4" opacity="' + (flat ? 0.8 : 0.9) + '"/></svg>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
