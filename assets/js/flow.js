/**
 * assets/js/flow.js — /flow. The system as a top-down flow chart you drill into.
 *
 * THE SHAPE IS NOT MINE
 * It is the operator's, drawn on paper: sources across the top, then portals,
 * then domains, then data, then brain, then business at the foot. Several
 * parallel chains rather than one, cross-links where they really cross, and a
 * return path down the side. Three earlier attempts drew this system as a wiring
 * canvas, as left-to-right lanes, and as a grid of status tiles. All three were
 * answering a question nobody asked. This one follows the drawing.
 *
 * EVERY BOX OPENS
 * A box is not a label, it is a door. Click one and the chart RE-ROOTS: that box
 * becomes the subject and its own contents become the layers. Click again and it
 * re-roots deeper. The breadcrumb climbs back out. So you are always looking at
 * the same kind of picture — a flow, top to bottom — just further in.
 *
 * That is the difference between this and a diagram. A diagram has to fit
 * everything on one surface, which is why the wiring sheet ended up with 506
 * conductors and no figure. This shows one layer at a time and lets you go down,
 * so no view ever has to carry more than about thirty boxes.
 *
 * WHAT IS DERIVED AND WHAT IS MEASURED
 *   derived    scripts/build-flow-graph.js reads the feeds, portals and lanes
 *              straight out of the source. Counts here are never estimates.
 *   measured   job runs and store freshness come from /api/harness, domain
 *              stress from /api/domain-snapshot, and the loop hops are probed
 *              per domain ON REQUEST — one resolver read scans thousands of
 *              rows, so twenty of them on page load is a bandwidth bill.
 *   neither    is drawn hollow and says "not measured". Nothing defaults green.
 */
(function () {
  'use strict';

  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  var key = '', flow = null, board = null, snapshot = null, scheduled = {};
  var laneIx = {}, feedIx = {}, regionIx = {};
  var probes = {};
  var path = [];                    // the drill path; [] is the whole system

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ago(ms) {
    if (ms == null) return 'never';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 90) return s + 's ago';
    if (s < 5400) return Math.round(s / 60) + 'm ago';
    if (s < 172800) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }
  function nsOf(k) {
    var p = String(k || '').split(':');
    if (!p[0]) return null;
    return (p[0] === 'limen' && p.length > 1) ? 'limen:' + p[1] : p[0];
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function init() {
    wireGate(); wireChrome();
    var stored = '';
    try { stored = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {}
    if (stored) {
      key = stored;
      start(function (ok, msg) {
        if (ok) return;
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) {}
        key = ''; gate(true);
        $('ge').textContent = msg || 'stored key no longer works';
      });
    } else gate(true);
  }
  function gate(show) { $('gate').classList.toggle('hide', !show); }

  function wireGate() {
    var go = function () {
      var v = ($('gk').value || '').trim();
      if (!v) return;
      key = v; $('ge').textContent = 'checking…';
      start(function (ok, msg) {
        if (ok) { try { sessionStorage.setItem(KEY_STORE, key); } catch (e) {} }
        else $('ge').textContent = msg || 'rejected';
      });
    };
    $('gb').addEventListener('click', go);
    $('gk').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function jget(u) {
    return fetch(u, { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  function start(cb) {
    fetch('/api/harness?key=' + encodeURIComponent(key) + '&flow=1', { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        if (!r.j || !r.j.ok) { if (cb) cb(false, (r.j && (r.j.error || r.j.fix)) || ('http ' + r.s)); return; }
        flow = r.j.flow; scheduled = r.j.scheduled || {};
        (flow.feeds || []).forEach(function (f) { feedIx[f.key] = f; });
        (flow.lanes || []).forEach(function (l) { laneIx[l.id] = l; });
        ((flow.system || {}).regions || []).forEach(function (x) { regionIx[x.id] = x; });
        gate(false); document.body.classList.add('opened');
        jget('/api/domain-snapshot').then(function (s) { snapshot = s; render(); });
        loadBoard(); setInterval(loadBoard, POLL_MS);
        render();
        if (cb) cb(true);
      })
      .catch(function (e) { if (cb) cb(false, 'network: ' + e.message); });
  }

  function loadBoard() {
    jget('/api/harness?key=' + encodeURIComponent(key) + '&limit=120').then(function (j) {
      if (j && j.ok) { board = j; render(); }
    });
  }

  // ── state ─────────────────────────────────────────────────────────────────
  // Five words. The gap between the last two is the point: "never observed" is
  // not "broken", and neither of them is green.
  var LABEL = { ok: 'working', warn: 'degraded', bad: 'not working',
                none: 'never observed', unknown: 'not measured' };

  function laneState(l) {
    var d = snapshot && snapshot.domains ? snapshot.domains[l.runtimeKey] : null;
    if (!snapshot) return { s: 'unknown', why: 'snapshot not loaded' };
    if (!d) return { s: 'none', why: 'no entry under "' + l.runtimeKey + '"' };
    if (typeof d.stress !== 'number') return { s: 'bad', why: 'no stress scalar' };
    var m = (l.mix || {}).measure || 0;
    if (!m) return { s: 'warn', why: 'stress ' + d.stress.toFixed(2) + ' · NO measurement feed' };
    if (m / l.feedCount < 1 / 3) return { s: 'warn', why: 'stress ' + d.stress.toFixed(2) + ' · only ' + m + ' of ' + l.feedCount + ' measure' };
    if (d.stress >= 0.995) return { s: 'warn', why: 'pinned at the ceiling' };
    return { s: 'ok', why: 'stress ' + d.stress.toFixed(2) + ' · ' + m + ' of ' + l.feedCount + ' measure' };
  }

  function regionState(r) {
    var byFile = (flow.system || {}).storesByFile || {};
    var ns = {};
    r.pins.forEach(function (p) {
      var s = byFile[p.file];
      if (s) s.w.forEach(function (x) { var n = nsOf(x.k); if (n) ns[n] = 1; });
    });
    var names = Object.keys(ns);
    if (!names.length) return { s: 'none', why: r.files + ' files · writes no readable store' };
    if (!board) return { s: 'unknown', why: names.length + ' namespaces · not measured yet' };
    var t = (board.stores && board.stores.touched) || {};
    var seen = names.filter(function (n) { return t[n]; });
    if (!seen.length) return { s: 'none', why: names.length + ' namespaces, none ever written' };
    var newest = Math.max.apply(null, seen.map(function (n) { return t[n]; }));
    return { s: (Date.now() - newest < 26 * 3600000) ? 'ok' : 'warn',
             why: seen.length + '/' + names.length + ' written · newest ' + ago(newest) };
  }

  function storeState(prefix) {
    if (!board) return { s: 'unknown', why: 'not measured yet' };
    var t = (board.stores && board.stores.touched) || {};
    var n = nsOf(prefix);
    if (!t[n]) return { s: 'none', why: n + ' has never reported a write' };
    return { s: Date.now() - t[n] < 26 * 3600000 ? 'ok' : 'warn', why: 'written ' + ago(t[n]) };
  }

  // ── the views ─────────────────────────────────────────────────────────────
  /**
   * A view is { title, sub, layers[] }, and a layer is { name, note, boxes[] }.
   * A box with `go` is a door to a deeper view. That is the whole model — the
   * renderer never needs to know what it is drawing.
   */
  function view() {
    if (!path.length) return systemView();
    var head = path[0];
    if (head === 'sources') return path[1] ? feedKindView(path[1]) : sourcesView();
    if (head === 'feed') return feedView(path[1]);
    if (head === 'domains') return domainsView();
    if (head === 'domain') return domainView(path[1]);
    if (head === 'portals') return portalsView();
    if (head === 'data') return dataView();
    if (head === 'store') return storeView(path[1]);
    if (head === 'brain') return regionsView('brain');
    if (head === 'business') return regionsView('business');
    if (head === 'region') return regionView(path[1]);
    if (head === 'file') return fileView(path.slice(1).join('/'));
    return systemView();
  }

  /** Layer 1-6, exactly the stack on the paper. */
  function systemView() {
    var c = flow.counts, bc = c.byClass || {};
    var blind = flow.lanes.filter(function (l) { return !((l.mix || {}).measure); });
    var thin = flow.lanes.filter(function (l) {
      var m = (l.mix || {}).measure || 0; return m && m / l.feedCount < 1 / 3;
    });

    return {
      title: 'The whole system',
      sub: 'Six layers, top to bottom. Every box opens.',
      layers: [
        { name: 'Sources', note: c.feeds + ' feeds, by what kind of evidence each one is',
          boxes: [
            { label: 'Measurements', n: bc.measure || 0, sub: 'an API returning a number',
              s: 'ok', go: ['sources', 'measure'] },
            { label: 'Registries', n: bc.registry || 0, sub: 'a count of filings',
              s: 'ok', go: ['sources', 'registry'] },
            { label: 'News searches', n: bc.search || 0, sub: 'an article count, not an event count',
              s: 'warn', go: ['sources', 'search'] },
            { label: 'Unresolved', n: bc.unknown || 0, sub: 'no static URL in the fetcher',
              s: 'none', go: ['sources', 'unknown'] }
          ] },
        { name: 'Portals', note: 'filled by their own feeds, joined to a domain by domainId',
          boxes: [
            { label: 'Company portals', n: c.portalsTotal, sub: c.portalsWithFeeds + ' carry a feed source',
              s: 'ok', go: ['portals'] },
            { label: 'Portal pages', n: c.portalPages, sub: 'render surfaces on disk',
              s: 'ok', go: ['portals'] }
          ] },
        { name: 'Domains', note: c.lanes + ' desks. Stress crosses between them.',
          boxes: [
            { label: 'Well measured', n: c.lanes - blind.length - thin.length,
              sub: 'a third or more of feeds measure', s: 'ok', go: ['domains'] },
            { label: 'Thinly measured', n: thin.length,
              sub: thin.map(function (l) { return l.id; }).slice(0, 3).join(', ') + (thin.length > 3 ? '…' : ''),
              s: 'warn', go: ['domains'] },
            { label: 'No measurement', n: blind.length,
              sub: blind.map(function (l) { return l.id; }).join(', ') || 'none',
              s: blind.length ? 'bad' : 'ok', go: ['domains'] }
          ] },
        { name: 'Data', note: 'what the domains leave behind',
          boxes: (flow.stages || []).map(function (st) {
            var ss = storeState(st.store);
            return { label: st.label, sub: st.store, s: ss.s, why: ss.why, go: ['store', st.id] };
          }) },
        { name: 'Brain', note: 'what reads that data back',
          boxes: ['COGNIT', 'STRESS', 'RETURN'].filter(function (id) { return regionIx[id]; })
            .map(function (id) {
              var r = regionIx[id], st = regionState(r);
              return { label: r.label, n: r.files, sub: r.sub, s: st.s, why: st.why, go: ['region', id] };
            }) },
        { name: 'Business', note: 'where it goes when it leaves the brain',
          boxes: ['OPPTY', 'REVENUE', 'PUBLISH', 'OPS'].filter(function (id) { return regionIx[id]; })
            .map(function (id) {
              var r = regionIx[id], st = regionState(r);
              return { label: r.label, n: r.files, sub: r.sub, s: st.s, why: st.why, go: ['region', id] };
            }) }
      ]
    };
  }

  var KIND_NAME = { measure: 'Measurements', registry: 'Registries',
                    search: 'News searches', unknown: 'Unresolved' };
  var KIND_WHY = {
    measure: 'An API returning a number. The value moves when the measured thing moves.',
    registry: 'federalregister.gov — a count of filings by one agency. Institutional, but a volume proxy rather than a measurement.',
    search: 'news.google.com/rss/search — a keyword query against a news aggregator. It transduces an ARTICLE COUNT, so it moves when coverage moves, which is not the same as the world moving.',
    unknown: 'No static URL in the fetcher, so the host could not be read out of the source. Reported rather than guessed.'
  };

  function sourcesView() {
    var bc = flow.counts.byClass || {};
    return { title: 'Sources', sub: flow.counts.feeds + ' feeds', layers: [
      { name: 'By kind', note: 'what each feed actually transduces',
        boxes: Object.keys(KIND_NAME).map(function (k) {
          return { label: KIND_NAME[k], n: bc[k] || 0, sub: KIND_WHY[k].slice(0, 60) + '…',
                   s: k === 'search' ? 'warn' : k === 'unknown' ? 'none' : 'ok', go: ['sources', k] };
        }) }
    ] };
  }

  function feedKindView(kind) {
    var fs = flow.feeds.filter(function (f) { return f.cls === kind; });
    var byHost = {};
    fs.forEach(function (f) { (byHost[f.host || '—'] = byHost[f.host || '—'] || []).push(f); });
    return {
      title: KIND_NAME[kind] || kind,
      sub: fs.length + ' feeds',
      note: KIND_WHY[kind],
      layers: [
        { name: 'By host', note: Object.keys(byHost).length + ' distinct hosts',
          boxes: Object.keys(byHost).sort(function (a, b) { return byHost[b].length - byHost[a].length; })
            .map(function (h) {
              return { label: h, n: byHost[h].length, sub: 'feeds', s: kind === 'search' ? 'warn' : 'ok',
                       list: byHost[h].map(function (f) {
                         return { label: f.label, sub: f.domains.join(', '), go: ['feed', f.key] };
                       }) };
            }) }
      ]
    };
  }

  function feedView(k) {
    var f = feedIx[k];
    if (!f) return systemView();
    return {
      title: f.label, sub: f.key, note: KIND_WHY[f.cls],
      layers: [
        { name: 'How it is fetched', boxes: [
          { label: 'host', sub: f.host || 'not statically resolvable', s: f.host ? 'ok' : 'none' },
          { label: 'fetcher', sub: (f.fetcher || '—') + '()' },
          f.via ? { label: 'delegates to', sub: f.via + '()' } : null,
          f.reuseOf ? { label: 're-read of', sub: f.reuseOf } : null
        ].filter(Boolean) },
        { name: 'Feeds these domains', note: f.domains.length + ' lane' + (f.domains.length === 1 ? '' : 's'),
          boxes: f.domains.map(function (d) {
            var l = laneIx[d], st = l ? laneState(l) : { s: 'unknown' };
            return { label: d, sub: (st.why || ''), s: st.s, go: ['domain', d] };
          }) }
      ]
    };
  }

  function domainsView() {
    return { title: 'Domains', sub: flow.lanes.length + ' desks', layers: [
      { name: 'All domains', note: 'ordered worst first',
        boxes: flow.lanes.map(function (l) {
          var st = laneState(l);
          return { label: l.id, n: l.feedCount, sub: st.why, s: st.s, go: ['domain', l.id] };
        }).sort(function (a, b) {
          var R = { bad: 0, warn: 1, none: 2, unknown: 3, ok: 4 };
          return R[a.s] - R[b.s] || a.label.localeCompare(b.label);
        }) }
    ] };
  }

  /** One domain, as its own six-layer chain. The drawing, one level in. */
  function domainView(id) {
    var l = laneIx[id];
    if (!l) return systemView();
    var st = laneState(l);
    var d = snapshot && snapshot.domains ? snapshot.domains[l.runtimeKey] : null;
    var mix = l.mix || {};
    var pr = probes[id];

    var layers = [
      { name: 'Sources', note: l.feedCount + ' feeds into this domain',
        boxes: ['measure', 'registry', 'search', 'unknown'].filter(function (k) { return mix[k]; })
          .map(function (k) {
            return { label: KIND_NAME[k], n: mix[k], sub: KIND_WHY[k].slice(0, 54) + '…',
                     s: k === 'search' ? 'warn' : k === 'unknown' ? 'none' : 'ok',
                     list: l.feeds.filter(function (f) { return (feedIx[f.key] || {}).cls === k; })
                       .map(function (f) {
                         return { label: f.label, sub: (feedIx[f.key] || {}).host || '', go: ['feed', f.key] };
                       }) };
          }) },
      { name: 'Portals', note: 'attached to this domain by domainId',
        boxes: [
          { label: 'Company portals', n: l.portals.companies || 0,
            sub: (l.portals.withFeeds || 0) + ' carry their own feed source',
            s: l.portals.companies ? 'ok' : 'none' },
          { label: 'Portal pages', n: l.portals.pages || 0,
            sub: l.portals.pages ? 'on disk' : 'none exist — every other lane has 111 to 202',
            s: l.portals.pages ? 'ok' : 'bad' }
        ] },
      { name: 'Domain', note: 'the desk itself',
        boxes: [
          { label: id, sub: st.why, s: st.s,
            n: d && typeof d.stress === 'number' ? d.stress.toFixed(2) : null },
          l.runtimeKey !== l.id
            ? { label: 'stored as', sub: l.runtimeKey + ' — not "' + l.id + '"', s: 'warn' }
            : null
        ].filter(Boolean) },
      { name: 'Data', note: 'what this domain leaves behind',
        boxes: (flow.stages || []).map(function (s) {
          var ss = storeState(s.store);
          return { label: s.label, sub: s.store + l.runtimeKey, s: ss.s, why: ss.why };
        }) }
    ];

    // The loop, measured on request. Nothing here is coloured from a schedule.
    if (!pr) {
      layers.push({ name: 'Brain', note: 'the nine hops from sensing to having learned',
        boxes: [{ label: 'Not probed', sub: 'open to measure this domain', s: 'unknown',
                  act: 'probe/' + id }] });
    } else if (pr.loading) {
      layers.push({ name: 'Brain', boxes: [{ label: 'probing…', s: 'unknown' }] });
    } else {
      layers.push({ name: 'Brain', note: 'measured just now, against live endpoints',
        boxes: pr.hops.map(function (h) {
          return { label: h.name, sub: h.evidence,
                   s: h.verdict === 'closed' ? 'ok' : h.verdict === 'struct' ? 'none' : 'bad' };
        }) });
    }

    layers.push({ name: 'Business', note: 'handlers named for this domain',
      boxes: l.handlers.length
        ? l.handlers.map(function (f) {
            return { label: f.replace('handlers/', ''),
                     sub: scheduled[f] ? scheduled[f].schedule : 'on no schedule',
                     s: scheduled[f] ? 'ok' : 'none', go: ['file', f] };
          })
        : [{ label: 'none', sub: 'no handler carries this domain’s name', s: 'none' }] });

    return { title: id, sub: l.label, layers: layers };
  }

  function portalsView() {
    return { title: 'Portals', sub: flow.counts.portalsTotal + ' company portals · ' +
             flow.counts.portalPages + ' pages', layers: [
      { name: 'By domain', note: 'a portal joins a domain by its domainId',
        boxes: flow.lanes.map(function (l) {
          return { label: l.id, n: l.portals.companies || 0,
                   sub: (l.portals.pages || 0) + ' pages',
                   s: l.portals.pages ? 'ok' : 'bad', go: ['domain', l.id] };
        }).sort(function (a, b) { return b.n - a.n; }) }
    ] };
  }

  function dataView() {
    return { title: 'Data', sub: 'the stores the loop runs on', layers: [
      { name: 'Stores', boxes: (flow.stages || []).map(function (s) {
        var ss = storeState(s.store);
        return { label: s.label, sub: s.store, s: ss.s, why: ss.why, go: ['store', s.id] };
      }) }
    ] };
  }

  function storeView(id) {
    var st = null;
    (flow.stages || []).forEach(function (s) { if (s.id === id) st = s; });
    if (!st) return systemView();
    var ss = storeState(st.store);
    return { title: st.label, sub: st.store, note: st.sub, layers: [
      { name: 'Freshness', boxes: [{ label: nsOf(st.store), sub: ss.why, s: ss.s }] },
      { name: 'Written by', note: st.writers.length ? '' : 'the scanner found no writer — a key built at runtime will not show here',
        boxes: st.writers.length
          ? st.writers.map(function (w) { return { label: w.replace('handlers/', '').replace('lib/', ''), sub: w, s: 'ok', go: ['file', w] }; })
          : [{ label: 'no static writer', sub: 'may still be written by a runtime-built key', s: 'unknown' }] },
      { name: 'Read by', boxes: st.readers.length
          ? st.readers.map(function (r) { return { label: r.replace('handlers/', '').replace('lib/', ''), sub: r, s: 'ok', go: ['file', r] }; })
          : [{ label: 'nothing reads this', s: 'bad' }] }
    ] };
  }

  var GROUPS = { brain: ['COGNIT', 'STRESS', 'RETURN'], business: ['OPPTY', 'REVENUE', 'PUBLISH', 'OPS'] };
  function regionsView(g) {
    return { title: g === 'brain' ? 'Brain' : 'Business', layers: [
      { name: 'Subsystems', boxes: GROUPS[g].filter(function (id) { return regionIx[id]; })
        .map(function (id) {
          var r = regionIx[id], st = regionState(r);
          return { label: r.label, n: r.files, sub: st.why, s: st.s, go: ['region', id] };
        }) }
    ] };
  }

  function regionView(id) {
    var r = regionIx[id];
    if (!r) return systemView();
    var st = regionState(r);
    var flows = (flow.system || {}).flows || [];
    var outs = flows.filter(function (f) { return f.from === id; });
    var ins = flows.filter(function (f) { return f.to === id; });
    var layers = [];
    if (ins.length) layers.push({ name: 'Receives from', boxes: ins.map(function (f) {
      return { label: (regionIx[f.from] || {}).label || f.from, n: f.count,
               sub: f.stores.slice(0, 2).join(', '), s: 'ok', go: ['region', f.from] };
    }) });
    layers.push({ name: 'Files', note: r.files + ' files · ' + r.writes + 'w/' + r.reads + 'r',
      boxes: r.pins.slice().sort(function (a, b) { return (b.w + b.r) - (a.w + a.r); })
        .map(function (p) {
          return { label: p.name, sub: (p.w ? p.w + 'w' : '') + (p.w && p.r ? '/' : '') + (p.r ? p.r + 'r' : '') || 'no store calls',
                   s: scheduled[p.file] ? 'ok' : null, go: ['file', p.file] };
        }) });
    if (outs.length) layers.push({ name: 'Sends to', boxes: outs.map(function (f) {
      return { label: (regionIx[f.to] || {}).label || f.to, n: f.count,
               sub: f.stores.slice(0, 2).join(', '), s: 'ok', go: ['region', f.to] };
    }) });
    return { title: r.label, sub: r.sub + ' · ' + st.why, layers: layers };
  }

  function fileView(id) {
    var pin = null, reg = null;
    ((flow.system || {}).regions || []).forEach(function (r) {
      r.pins.forEach(function (p) { if (p.file === id) { pin = p; reg = r; } });
    });
    if (!pin) return { title: id, sub: 'not in the scanned set', layers: [] };
    var s = ((flow.system || {}).storesByFile || {})[id] || { w: [], r: [] };
    var sch = scheduled[id];
    var layers = [{ name: 'What it is', boxes: [
      { label: 'subsystem', sub: reg.label, go: ['region', reg.id] },
      { label: 'schedule', sub: sch ? sch.schedule + ' · ' + sch.source : 'none — runs only when called',
        s: sch ? 'ok' : null }
    ] }];
    layers.push({ name: 'Writes', boxes: s.w.length
      ? s.w.map(function (x) {
          return { label: x.k + (x.dyn ? ' *' : ''), sub: x.n ? 'read by ' + x.n : 'nothing reads this',
                   s: x.n ? 'ok' : 'warn' };
        })
      : [{ label: 'writes nothing', s: null }] });
    layers.push({ name: 'Reads', boxes: s.r.length
      ? s.r.map(function (x) {
          return { label: x.k + (x.dyn ? ' *' : ''), sub: x.n ? 'written by ' + x.n : 'nothing writes this',
                   s: x.n ? 'ok' : 'bad' };
        })
      : [{ label: 'reads nothing', s: null }] });
    if (pin.hosts && pin.hosts.length) {
      layers.push({ name: 'Reaches out to', boxes: pin.hosts.map(function (h) {
        return { label: h, sub: 'external host' };
      }) });
    }
    return { title: pin.name, sub: id, layers: layers };
  }

  // ── render ────────────────────────────────────────────────────────────────
  function render() {
    if (!flow) return;
    var v = view();
    $('crumbs').innerHTML = crumbHtml();
    $('vtitle').textContent = v.title;
    $('vsub').textContent = v.sub || '';
    $('vnote').innerHTML = v.note ? esc(v.note) : '';
    $('vnote').style.display = v.note ? '' : 'none';

    var host = $('stack');
    host.innerHTML = '';
    (v.layers || []).forEach(function (L, i) {
      if (!L.boxes || !L.boxes.length) return;
      if (i > 0) {
        var arr = document.createElement('div');
        arr.className = 'flowarrow';
        arr.innerHTML = '<span></span>';
        host.appendChild(arr);
      }
      var sec = document.createElement('section');
      sec.className = 'layer';
      var h = '<div class="lhead"><span class="lname">' + esc(L.name) + '</span>' +
              (L.note ? '<span class="lnote">' + esc(L.note) + '</span>' : '') + '</div>';
      h += '<div class="row">';
      L.boxes.forEach(function (b, bi) {
        var cls = 'box' + (b.s ? ' s-' + b.s : '') + ((b.go || b.act || b.list) ? ' door' : '');
        h += '<' + ((b.go || b.act || b.list) ? 'button' : 'div') + ' class="' + cls + '"' +
             (b.go ? ' data-go="' + esc(b.go.join('/')) + '"' : '') +
             (b.act ? ' data-act="' + esc(b.act) + '"' : '') +
             (b.list ? ' data-list="' + i + '_' + bi + '"' : '') + '>';
        h += '<span class="blab">' + esc(b.label) + '</span>';
        if (b.n != null) h += '<span class="bn">' + esc(b.n) + '</span>';
        if (b.sub) h += '<span class="bsub">' + esc(b.sub) + '</span>';
        if (b.why && b.why !== b.sub) h += '<span class="bwhy">' + esc(b.why) + '</span>';
        if (b.s) h += '<span class="bstate">' + esc(LABEL[b.s]) + '</span>';
        h += '</' + ((b.go || b.act || b.list) ? 'button' : 'div') + '>';
      });
      h += '</div>';
      // A box holding a list opens it underneath, in place, rather than
      // navigating away — one more layer without losing where you are.
      L.boxes.forEach(function (b, bi) {
        if (!b.list) return;
        h += '<div class="sublist" id="sl_' + i + '_' + bi + '"><div class="row">';
        b.list.forEach(function (x) {
          h += '<button class="box mini door"' + (x.go ? ' data-go="' + esc(x.go.join('/')) + '"' : '') + '>' +
               '<span class="blab">' + esc(x.label) + '</span>' +
               (x.sub ? '<span class="bsub">' + esc(x.sub) + '</span>' : '') + '</button>';
        });
        h += '</div></div>';
      });
      sec.innerHTML = h;
      host.appendChild(sec);
    });

    Array.prototype.forEach.call(host.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { path = b.getAttribute('data-go').split('/'); render(); window.scrollTo(0, 0); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () { act(b.getAttribute('data-act')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-list]'), function (b) {
      b.addEventListener('click', function () {
        var el = $('sl_' + b.getAttribute('data-list'));
        if (el) { el.classList.toggle('open'); b.classList.toggle('open'); }
      });
    });
  }

  function crumbHtml() {
    var out = '<button class="crumb" data-n="0">whole system</button>';
    var acc = [];
    path.forEach(function (p, i) {
      acc.push(p);
      var label = p;
      if (acc[0] === 'domain' && i === 1) label = p;
      if (acc[0] === 'feed' && i === 1) label = (feedIx[p] || {}).label || p;
      if (acc[0] === 'file' && i >= 1) label = p.split('/').pop();
      if (i === 0) label = { sources: 'sources', domains: 'domains', domain: 'domain',
        feed: 'feed', portals: 'portals', data: 'data', store: 'store', brain: 'brain',
        business: 'business', region: 'subsystem', file: 'file' }[p] || p;
      out += '<span class="carr">›</span><button class="crumb" data-n="' + (i + 1) + '">' + esc(label) + '</button>';
    });
    return out;
  }

  function act(a) {
    if (a.indexOf('probe/') === 0) return probeLane(a.slice(6));
  }

  /**
   * One domain at a time, on request. Probed by runtimeKey: the recorder writes
   * feedhist:<key> from the snapshot's own keys, so science lives under
   * "research", medicine under "health", trade under "supplyChain".
   */
  function probeLane(id) {
    var l = laneIx[id];
    if (!l || (probes[id] && probes[id].loading)) return;
    probes[id] = { loading: true }; render();
    var d = encodeURIComponent(l.runtimeKey);
    Promise.all([
      jget('/api/feed-resolve?domain=' + d + '&detail=1'),
      jget('/api/brain-weights?domain=' + d),
      jget('/api/feed-consolidate?domain=' + d)
    ]).then(function (r) {
      var st = { loading: false, resolve: r[0], weights: r[1], consolidation: r[2] };
      st.hops = HOPS.map(function (h) {
        var o; try { o = h.probe(st); } catch (e) { o = { verdict: 'unknown', evidence: 'probe failed: ' + e.message }; }
        return { name: h.name, verdict: o.verdict, evidence: o.evidence };
      });
      probes[id] = st; render();
    });
  }

  var HOPS = [
    { name: 'RECORD', probe: function (d) { var n = d.resolve && d.resolve.recorderRows;
      return n > 0 ? { verdict: 'closed', evidence: n + ' recorded rows' } : { verdict: 'open', evidence: 'no recorded rows' }; } },
    { name: 'FORECAST', probe: function (d) { var n = d.resolve && d.resolve.storedForecasts;
      return n > 0 ? { verdict: 'closed', evidence: n + ' forecasts stored' } : { verdict: 'open', evidence: 'no forecasts stored' }; } },
    { name: 'GRADE', probe: function (d) { var n = d.resolve && d.resolve.resolvedCount;
      return n > 0 ? { verdict: 'closed', evidence: n + ' resolved forward-only' } : { verdict: 'open', evidence: 'nothing has aged past the horizon' }; } },
    { name: 'REWARD', probe: function (d) {
      var r = d.resolve;
      if (!r || typeof r.externalHitRate !== 'number') return { verdict: 'open', evidence: 'nothing has resolved yet' };
      var dir = r.directional || {}, skill = r.skill;
      if (typeof skill !== 'number') return { verdict: 'unknown', evidence: 'no baseline to compare against' };
      if (!dir.n) return { verdict: 'inverted', evidence: 'every call was "stable" — the hit rate of ' +
        r.externalHitRate + ' is the abstention rate. This series does not move.' };
      if (skill <= 0) return { verdict: 'inverted', evidence: 'skill ' + skill + ' — the calls are backwards, not merely noisy' };
      return { verdict: 'closed', evidence: 'skill +' + skill + ', sign accuracy ' + dir.signAccuracy }; } },
    { name: 'UPDATE', probe: function () { return { verdict: 'struct',
      evidence: 'NO CODE PATH — the only consumer of the hit rate is browser code' }; } },
    { name: 'PERSIST', probe: function (d) { var s = d.weights && d.weights.snapshot;
      return s ? { verdict: 'closed', evidence: 'snapshot stored' } : { verdict: 'open', evidence: 'brainwts is empty' }; } },
    { name: 'RELOAD', probe: function () { return { verdict: 'struct',
      evidence: 'NO CODE PATH — deriveForecast is a fixed fit with no parameters' }; } },
    { name: 'CONSOLIDATE', probe: function (d) { var r = d.consolidation && d.consolidation.report;
      return r ? { verdict: 'closed', evidence: 'proposal ' + r.status } : { verdict: 'open', evidence: 'feed-consolidate is on no schedule' }; } },
    { name: 'PRIOR', probe: function (d) { var r = d.consolidation && d.consolidation.report;
      if (!r) return { verdict: 'open', evidence: 'nothing upstream to apply' };
      return r.applied ? { verdict: 'closed', evidence: 'applied' } : { verdict: 'open', evidence: 'propose-only until a human applies it' }; } }
  ];

  function wireChrome() {
    $('crumbs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.crumb') : null;
      if (!b) return;
      path = path.slice(0, parseInt(b.getAttribute('data-n'), 10));
      render(); window.scrollTo(0, 0);
    });
    $('up').addEventListener('click', function () {
      if (path.length) { path.pop(); render(); window.scrollTo(0, 0); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && path.length) { path.pop(); render(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
