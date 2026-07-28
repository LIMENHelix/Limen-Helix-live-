#!/usr/bin/env node
/**
 * scripts/build-flow-graph.js — derive the ONE flow chart: feeds → portals →
 * domains → where the domains go.
 *
 * WHY THIS EXISTS ALONGSIDE build-harness-graph.js
 * The harness graph answers "which file touches which store". That is the right
 * question for a wiring diagram and the wrong one for a flow chart: 254 files and
 * 506 conductors have no direction a reader can follow, because the file layer is
 * not where the signal flows. The signal flows feed → domain → recorder →
 * resolver → consolidator, and NONE of that is visible in a require graph.
 *
 * So this builds the second half of the picture, on the same rule: every edge is
 * read out of the source, nothing is asserted.
 *
 *   feeds     handlers/domain-snapshot.js. Each domain is built by
 *             buildDomain('<key>', [ src('<label>', byKey('<KEY>')), … ]), so the
 *             feed→domain edge is literally in the call. The host comes from the
 *             fetcher: SOURCE_KEYS[i] binds to element i of the Promise.allSettled
 *             array (the file says so at line 62 and enforces it at line 644), and
 *             element i is a call to fetch<Key>(), whose body holds the URL.
 *   portals   assets/data/companies/*.json — each portal carries domainId and
 *             feedSources[]. Plus the <domain>_*_portal.html pages on disk.
 *   lanes     lib/operator-fleet.js DOMAINS — the canonical 20 and, critically,
 *             the runtimeKey alias (science=research, medicine=health,
 *             trade=supplyChain). Joining on the wrong one silently empties three
 *             lanes.
 *   downstream the per-domain loop stages, taken from the stores the recorder and
 *             resolver actually key by domain in api/protected-docs/harness-graph.json.
 *
 * WHAT IT WILL NOT DO
 * Draw an arrow it cannot source. The per-domain handlers (handlers/energy-markets.js
 * and 65 siblings) write almost nothing: the derived graph finds ONE data conductor
 * out of the whole DOMAIN region. That is a real finding and it is reported as a
 * count, not papered over with a plausible arrow.
 *
 * OUT: api/protected-docs/flow-graph.json   (protected for the same reason the
 *      harness graph is: it names every internal store and host)
 * RUN: node scripts/build-flow-graph.js [--verbose]
 */

'use strict';

var fs = require('fs');
var path = require('path');
var acorn = require('acorn');
var walk = require('acorn-walk');

var ROOT = path.join(__dirname, '..');
var VERBOSE = process.argv.indexOf('--verbose') !== -1;
var OUT = path.join(ROOT, 'api', 'protected-docs', 'flow-graph.json');
var SNAP = path.join(ROOT, 'handlers', 'domain-snapshot.js');

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function litOf(n) {
  if (!n) return undefined;
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && n.quasis.length) return n.quasis[0].value.cooked;
  return undefined;
}

/**
 * A URL argument, reduced to its static head.
 *
 * Half the fetchers in this file build the URL as 'https://host/path?key=' + key
 * or `https://host/${q}`. litOf() alone returns nothing for the first form, which
 * silently drops 60-odd feeds to "host unknown" — and a feed with no host looks
 * unwired rather than merely key-gated. Only the static head is ever used, so a
 * runtime suffix can never invent a host.
 */
function urlHeadOf(n) {
  if (!n) return undefined;
  var direct = litOf(n);
  if (direct !== undefined) return direct;
  if (n.type === 'BinaryExpression' && n.operator === '+') return urlHeadOf(n.left);
  return undefined;
}

// ── the canonical twenty, read from the registry rather than restated ────────
/**
 * lib/operator-fleet.js holds the list AND the runtimeKey alias. Parsing it is
 * one more moving part than hardcoding twenty strings, and it is worth it: the
 * alias is the exact thing that goes stale, and a stale alias produces three
 * empty lanes that look like three dead domains.
 */
function readDomains() {
  var src = fs.readFileSync(path.join(ROOT, 'lib', 'operator-fleet.js'), 'utf8');
  var ast = acorn.parse(src, { ecmaVersion: 'latest' });
  var out = null;
  walk.simple(ast, {
    VariableDeclarator: function (n) {
      if (out || !n.id || n.id.name !== 'DOMAINS' || !n.init || n.init.type !== 'ArrayExpression') return;
      out = n.init.elements.map(function (e) {
        var o = {};
        (e.properties || []).forEach(function (p) {
          var k = p.key && (p.key.name || p.key.value);
          var v = litOf(p.value);
          if (k && v !== undefined) o[k] = v;
        });
        return o;
      }).filter(function (o) { return o.id; });
    }
  });
  if (!out || out.length !== 20) {
    throw new Error('lib/operator-fleet.js DOMAINS did not yield 20 entries (got ' +
      (out ? out.length : 0) + '). Refusing to build a lane set I cannot source.');
  }
  return out;
}

// ── domain-snapshot: keys, fetchers, hosts, and the feed→domain edges ────────
function readSnapshot() {
  var src = fs.readFileSync(SNAP, 'utf8');
  var ast = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });

  var sourceKeys = null;       // ordered, from SOURCE_KEYS
  var fetcherAt = null;        // ordered fetcher fn names, from Promise.allSettled
  var gdelt = [];              // [{ key, fn }]
  var fnHost = {};             // fetcher fn name -> first external host in its body
  var fnUrl = {};
  var fnVia = {};              // fetcher fn name -> shared helper it delegates to
  var byDomain = {};           // runtimeKey -> [{ label, key }]
  var domainOpts = {};

  // SOURCE_KEYS, in order.
  walk.simple(ast, {
    VariableDeclarator: function (n) {
      if (!n.id || n.id.name !== 'SOURCE_KEYS' || !n.init || n.init.type !== 'ArrayExpression') return;
      sourceKeys = n.init.elements.map(litOf).filter(function (v) { return v !== undefined; });
    }
  });

  // The fetcher array. Identified by shape, not by variable name: it is the
  // Promise.allSettled whose elements are all bare fetchX() calls.
  walk.simple(ast, {
    CallExpression: function (n) {
      if (fetcherAt) return;
      var c = n.callee;
      if (c.type !== 'MemberExpression' || c.property.name !== 'allSettled') return;
      var arr = n.arguments[0];
      if (!arr || arr.type !== 'ArrayExpression' || arr.elements.length < 50) return;
      var names = arr.elements.map(function (e) {
        return (e && e.type === 'CallExpression' && e.callee.type === 'Identifier') ? e.callee.name : null;
      });
      if (names.filter(Boolean).length < names.length * 0.9) return;
      fetcherAt = names;
    }
  });

  // The GDELT cluster is keyed by hand (srcMap['gdelt_' + idx]), so read the
  // table rather than inferring it from the allSettled position.
  walk.simple(ast, {
    VariableDeclarator: function (n) {
      if (!n.id || n.id.name !== 'gdeltFns' || !n.init || n.init.type !== 'ArrayExpression') return;
      n.init.elements.forEach(function (e) {
        var o = {};
        (e.properties || []).forEach(function (p) {
          var k = p.key && (p.key.name || p.key.value);
          if (k === 'fn' && p.value.type === 'Identifier') o.fn = p.value.name;
          if (k === 'idx') o.key = litOf(p.value);
        });
        if (o.fn && o.key) gdelt.push(o);
      });
    }
  });

  /**
   * Every fetcher's external URL, in two passes.
   *
   * PASS 1 reads the URL where the function calls out itself: fetch(), or the
   * file's own timedJSON / timedText wrappers.
   *
   * PASS 2 follows delegation ONE hop at a time until nothing new resolves. 149
   * of the 238 feeds do not call out directly — they are one-liners over a shared
   * helper:
   *
   *     async function fetchCPSCRecalls() { return _fetchRSS('CPSC recall OR …', …); }
   *     async function fetchFedRegEPA()   { return _fetchFedRegAgencyAg(…, 'epa'); }
   *
   * Without the hop those feeds report no host, which reads as "unwired" when the
   * truth is the opposite and more interesting: _fetchRSS resolves to
   * news.google.com/rss/search, so those feeds are keyword searches against a news
   * aggregator, not institutional APIs. That distinction is the whole reason to
   * resolve the host at all, so it is followed and then LABELLED.
   */
  var fnDeleg = {};
  function scanFn(name, node) {
    var found = null, delegates = [];

    // The URL is very often assembled into a local first:
    //     var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + …;
    //     var resp = await fetch(url, …);
    // Reading only the call argument sees the bare identifier `url` and gives up,
    // which is how the single busiest host in the system (a news aggregator behind
    // 131 feeds) stays invisible. So locals are resolved first.
    var localUrl = {};
    walk.simple(node, {
      VariableDeclarator: function (v) {
        if (!v.id || v.id.type !== 'Identifier' || !v.init) return;
        var u = urlHeadOf(v.init);
        if (u && /^https?:\/\//.test(u)) localUrl[v.id.name] = u;
      }
    });

    walk.simple(node, {
      CallExpression: function (c) {
        var cn = c.callee.type === 'Identifier' ? c.callee.name : null;
        if (!cn) return;
        if (cn === 'fetch' || /^timed/.test(cn)) {
          if (found) return;
          var arg = c.arguments[0];
          var u = urlHeadOf(arg);
          if (!u && arg && arg.type === 'Identifier') u = localUrl[arg.name];
          if (u && /^https?:\/\//.test(u)) found = u;
          return;
        }
        if (/^_?fetch/.test(cn) && cn !== name && delegates.indexOf(cn) === -1) delegates.push(cn);
      }
    });
    if (found) {
      fnUrl[name] = found;
      fnHost[name] = found.replace(/^https?:\/\//, '').split('/')[0];
    } else if (delegates.length) {
      fnDeleg[name] = delegates;
    }
  }

  walk.simple(ast, {
    FunctionDeclaration: function (fn) {
      if (!fn.id || !/^_?fetch/.test(fn.id.name)) return;
      scanFn(fn.id.name, fn);
    },
    VariableDeclarator: function (n) {
      if (!n.id || n.id.type !== 'Identifier' || !/^_?fetch/.test(n.id.name) || !n.init) return;
      if (n.init.type !== 'FunctionExpression' && n.init.type !== 'ArrowFunctionExpression') return;
      scanFn(n.id.name, n.init);
    }
  });

  // Propagate through delegation. Bounded so a mutual-recursion cycle cannot spin.
  for (var pass = 0; pass < 6; pass++) {
    var moved = 0;
    Object.keys(fnDeleg).forEach(function (name) {
      if (fnUrl[name]) return;
      for (var i = 0; i < fnDeleg[name].length; i++) {
        var t = fnDeleg[name][i];
        if (fnUrl[t]) { fnUrl[name] = fnUrl[t]; fnHost[name] = fnHost[t]; fnVia[name] = t; moved++; return; }
      }
    });
    if (!moved) break;
  }

  // buildDomain('<runtimeKey>', [ src('<label>', byKey('<KEY>')), … ])
  walk.simple(ast, {
    CallExpression: function (n) {
      if (n.callee.type !== 'Identifier' || n.callee.name !== 'buildDomain') return;
      var key = litOf(n.arguments[0]);
      var arr = n.arguments[1];
      if (!key || !arr || arr.type !== 'ArrayExpression') return;
      var list = [];
      arr.elements.forEach(function (e) {
        if (!e || e.type !== 'CallExpression' || e.callee.name !== 'src') return;
        var label = litOf(e.arguments[0]);
        var kn = e.arguments[1];
        var sk = null;
        if (kn && kn.type === 'CallExpression' && kn.callee.name === 'byKey') sk = litOf(kn.arguments[0]);
        if (label) list.push({ label: label, key: sk });
      });
      // The fallback synthesiser at the bottom of the file builds every domain
      // with two null sources. It is a degradation path, not wiring, and folding
      // it in would show every domain carrying two phantom feeds.
      if (!list.length || list.every(function (s) { return !s.key; })) return;
      if (byDomain[key] && byDomain[key].length >= list.length) return;
      byDomain[key] = list;
      // opts (3rd arg) carries the domain's own notes; keep the raw keys only.
      var o = n.arguments[2];
      if (o && o.type === 'ObjectExpression') {
        domainOpts[key] = o.properties.map(function (p) {
          return p.key && (p.key.name || p.key.value);
        }).filter(Boolean);
      }
    }
  });

  return {
    sourceKeys: sourceKeys || [],
    fetcherAt: fetcherAt || [],
    gdelt: gdelt,
    fnHost: fnHost,
    fnUrl: fnUrl,
    fnVia: fnVia,
    byDomain: byDomain,
    domainOpts: domainOpts
  };
}

/**
 * What KIND of evidence a feed is. This is the single most load-bearing label on
 * the chart, and it is derived from the resolved host rather than asserted.
 *
 *   search   news.google.com/rss/search — a keyword query against a news
 *            aggregator. What it transduces is an ARTICLE COUNT, so it moves when
 *            coverage moves, which is not the same as the world moving.
 *   registry federalregister.gov — a count of filings by agency. Institutional,
 *            but still a volume proxy rather than a measurement.
 *   measure  everything else that resolved: an API returning a number (FRED,
 *            EIA, NOAA, openFDA, World Bank).
 *   unknown  no static URL. Reported, never guessed.
 *
 * Drawing all four the same colour is how a chart tells you a domain has fifteen
 * sources when it has two measurements and thirteen news searches.
 */
function classOf(host) {
  if (!host) return 'unknown';
  if (/(^|\.)news\.google\.com$/.test(host)) return 'search';
  if (/(^|\.)federalregister\.gov$/.test(host)) return 'registry';
  return 'measure';
}

// ── portals ─────────────────────────────────────────────────────────────────
/**
 * Two different things are called a portal in this repo and they are NOT the
 * same layer, so they are counted separately and labelled:
 *
 *   company portals  assets/data/companies/*.json — a firm, with a domainId and
 *                    feedSources[] (SEC EDGAR facts, FRED series). These sit
 *                    BETWEEN a feed and a domain: a feed fills them, they roll up.
 *   portal pages     <domain>_<node>_<sub>_portal.html — render surfaces. They
 *                    are downstream of a domain, not upstream, and merging the
 *                    two counts would put 3,284 pages on the inbound side.
 */
function readPortals() {
  var dir = path.join(ROOT, 'assets', 'data', 'companies');
  var byDomain = {}, feedTypes = {}, withFeeds = 0, total = 0, noDomain = 0;
  var seriesByDomain = {};

  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(function (f) {
      if (f.slice(-5) !== '.json') return;
      var p;
      try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return; }
      total++;
      var d = p.domainId || null;
      if (!d) { noDomain++; return; }
      var rec = byDomain[d] = byDomain[d] || { companies: 0, withFeeds: 0, types: {} };
      rec.companies++;
      var fsrc = Array.isArray(p.feedSources) ? p.feedSources : [];
      if (fsrc.length) { withFeeds++; rec.withFeeds++; }
      fsrc.forEach(function (s) {
        var t = s && s.type;
        if (!t) return;
        feedTypes[t] = (feedTypes[t] || 0) + 1;
        rec.types[t] = (rec.types[t] || 0) + 1;
        if (t === 'fred' && Array.isArray(s.seriesIds)) {
          seriesByDomain[d] = seriesByDomain[d] || {};
          s.seriesIds.forEach(function (id) { seriesByDomain[d][id] = 1; });
        }
      });
    });
  }

  // Portal pages, by filename prefix.
  var pages = {};
  fs.readdirSync(ROOT).forEach(function (f) {
    var m = /^([a-z0-9]+)_.*_portal\.html$/i.exec(f);
    if (!m) return;
    pages[m[1]] = (pages[m[1]] || 0) + 1;
  });

  Object.keys(seriesByDomain).forEach(function (d) {
    byDomain[d].fredSeries = Object.keys(seriesByDomain[d]).length;
  });

  return { byDomain: byDomain, feedTypes: feedTypes, total: total, withFeeds: withFeeds,
           noDomain: noDomain, pages: pages };
}

// ── the per-domain downstream, from the store layer ──────────────────────────
/**
 * The five stages a domain's own signal passes through after the domain exists.
 * Each names the store that carries it and the file that writes it, both taken
 * from the derived harness graph, so a stage whose store nobody writes shows up
 * as exactly that rather than as a hopeful arrow.
 */
var STAGES = [
  { id: 'record',      label: 'Record',      sub: 'the realized value is stored',
    store: 'limen:feedhist:',        probe: 'feed-record' },
  { id: 'forecast',    label: 'Forecast',    sub: 'a direction is derived and kept',
    store: 'limen:forecasthist:',    probe: 'feed-resolve' },
  { id: 'grade',       label: 'Grade',       sub: 'the call is scored against what happened',
    store: 'limen:forecasthist:',    probe: 'feed-resolve' },
  { id: 'consolidate', label: 'Consolidate', sub: 'the offline pass reviews calibration',
    store: 'limen:consolidation:report:', probe: 'feed-consolidate' },
  { id: 'weights',     label: 'Weights',     sub: 'the learned weight survives the tab',
    store: 'limen:brainwts:',        probe: 'brain-weights' }
];

function readHarnessGraph() {
  var p = path.join(ROOT, 'api', 'protected-docs', 'harness-graph.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function stageWiring(graph) {
  return STAGES.map(function (s) {
    var st = null;
    if (graph) {
      (graph.stores || []).forEach(function (x) {
        if (x.key === s.store || x.key.indexOf(s.store) === 0) {
          st = st || { key: x.key, w: [], r: [] };
          x.w.forEach(function (f) { if (st.w.indexOf(f) === -1) st.w.push(f); });
          x.r.forEach(function (f) { if (st.r.indexOf(f) === -1) st.r.push(f); });
        }
      });
    }
    return {
      id: s.id, label: s.label, sub: s.sub, store: s.store, probe: s.probe,
      writers: st ? st.w : [], readers: st ? st.r : [],
      // A stage nobody writes is drawn as unwritten. The Loop register has been
      // saying CONSOLIDATE is on no schedule since it was built; this makes the
      // same claim structurally, from the store index rather than from prose.
      written: !!(st && st.w.length)
    };
  });
}

/**
 * The system band: everything that is NOT per-domain. Taken straight from the
 * harness graph's own regions so the two views cannot disagree about what a
 * subsystem is, with the domain region removed because it has its own lanes.
 */
function systemBand(graph) {
  if (!graph) return [];
  var regOf = {}, byRegion = {};
  (graph.blocks || []).forEach(function (b) {
    b.pins.forEach(function (p) {
      regOf[p.file] = b.region;
      (byRegion[b.region] = byRegion[b.region] || []).push(p);
    });
  });
  var meta = {};
  (graph.regions || []).forEach(function (r) { meta[r.id] = r; });

  var flows = {};
  (graph.conductors || []).forEach(function (c) {
    if (c.kind !== 'data') return;
    var a = regOf[c.from], b = regOf[c.to];
    if (!a || !b || a === b) return;
    var k = a + '>' + b;
    flows[k] = flows[k] || { from: a, to: b, count: 0, stores: [] };
    flows[k].count++;
    if (c.via && flows[k].stores.indexOf(c.via) === -1) flows[k].stores.push(c.via);
  });

  /**
   * DOMAIN is in this list even though it has its own twenty lanes upstairs.
   * Three data conductors cross between the two views (latest_ingest and
   * console_snapshot come IN, finance:distress goes OUT), and leaving DOMAIN out
   * of the band drops those three on the floor. A dropped edge in a diagram that
   * claims to show the flow is worse than an ugly one: it reads as "no
   * connection" when the connection is real. The renderer draws it as the
   * boundary between the two registers.
   */
  var order = ['DOMAIN', 'INGEST', 'RETURN', 'STRESS', 'COGNIT', 'SCORE', 'OPPTY', 'REVENUE',
               'PUBLISH', 'AI', 'HOME', 'BODY', 'OPS', 'PLAT', 'WORKER', 'LIB', 'UNFILED'];
  var band = order.filter(function (id) { return byRegion[id]; }).map(function (id) {
    var pins = byRegion[id];
    return {
      id: id,
      lanes: id === 'DOMAIN',
      label: (meta[id] || {}).label || id,
      sub: (meta[id] || {}).sub || '',
      files: pins.length,
      reads: pins.reduce(function (a, p) { return a + (p.r || 0); }, 0),
      writes: pins.reduce(function (a, p) { return a + (p.w || 0); }, 0),
      unresolved: pins.reduce(function (a, p) { return a + (p.unresolved || 0); }, 0),
      pins: pins.map(function (p) {
        return { file: p.file, name: p.name, r: p.r, w: p.w, unresolved: p.unresolved, hosts: p.hosts || [] };
      })
    };
  });

  /**
   * Which store keys each file writes and reads.
   *
   * This is the one thing the retired wiring sheet could show that a region box
   * cannot, and dropping it would be a quiet loss of capability rather than a
   * merge. Inverted from the store index (key -> files) into file -> keys, with
   * the reader/writer counts kept on each key so "writes a store nothing reads"
   * is still answerable from the panel.
   */
  var byFile = {};
  (graph.stores || []).forEach(function (s) {
    s.w.forEach(function (f) {
      (byFile[f] = byFile[f] || { w: [], r: [] }).w.push({ k: s.key, n: s.r.length, dyn: !!s.dynamic });
    });
    s.r.forEach(function (f) {
      (byFile[f] = byFile[f] || { w: [], r: [] }).r.push({ k: s.key, n: s.w.length, dyn: !!s.dynamic });
    });
  });

  return {
    regions: band,
    flows: Object.keys(flows).map(function (k) { return flows[k]; }),
    storesByFile: byFile
  };
}

// ── build ───────────────────────────────────────────────────────────────────
function main() {
  var domains = readDomains();
  var snap = readSnapshot();
  var portals = readPortals();
  var graph = readHarnessGraph();

  if (!snap.sourceKeys.length) throw new Error('SOURCE_KEYS not found in handlers/domain-snapshot.js');
  if (!snap.fetcherAt.length) throw new Error('the fetcher Promise.allSettled array was not found');

  // key -> fetcher fn, by position. The file guarantees this alignment and
  // enforces it at runtime; if the lengths disagree the guarantee is broken and
  // guessing which end drifted would mislabel every feed after the break.
  var keyToFn = {};
  var aligned = Math.min(snap.sourceKeys.length, snap.fetcherAt.length);
  for (var i = 0; i < aligned; i++) keyToFn[snap.sourceKeys[i]] = snap.fetcherAt[i];
  var misaligned = snap.sourceKeys.length !== snap.fetcherAt.length
    ? { keys: snap.sourceKeys.length, fetchers: snap.fetcherAt.length } : null;
  snap.gdelt.forEach(function (g) {
    keyToFn['gdelt_' + g.key.replace(/^gdelt_/, '')] = g.fn;
  });

  // ── feeds ────────────────────────────────────────────────────────────────
  var feeds = {};          // key -> feed record
  var runtimeOf = {};      // runtimeKey -> canonical domain id
  domains.forEach(function (d) { runtimeOf[d.runtimeKey] = d.id; });

  var unknownDomainKeys = [];
  Object.keys(snap.byDomain).forEach(function (rk) {
    var did = runtimeOf[rk];
    if (!did) { unknownDomainKeys.push(rk); return; }
    snap.byDomain[rk].forEach(function (s, idx) {
      if (!s.key) return;
      var f = feeds[s.key];
      if (!f) {
        var fn = keyToFn[s.key] || null;
        // 'CISAKEV_2' is the same fetcher re-read under a second slot. Resolve
        // the base so a reused feed still reports its host instead of blank.
        var base = /_(\d+)$/.test(s.key) ? s.key.replace(/_(\d+)$/, '') : null;
        if (!fn && base) fn = keyToFn[base] || null;
        var host = fn ? (snap.fnHost[fn] || null) : null;
        f = feeds[s.key] = {
          key: s.key, label: s.label, fetcher: fn,
          host: host,
          url: fn ? (snap.fnUrl[fn] || null) : null,
          via: fn ? (snap.fnVia[fn] || null) : null,
          cls: classOf(host),
          reuseOf: base && keyToFn[base] ? base : null,
          domains: [], slots: []
        };
      }
      if (f.domains.indexOf(did) === -1) f.domains.push(did);
      f.slots.push({ domain: did, order: idx, label: s.label });
      // A feed read by two domains under two labels keeps the first; the slot
      // list holds every label it is presented under.
    });
  });

  var feedList = Object.keys(feeds).sort().map(function (k) {
    var f = feeds[k];
    f.shared = f.domains.length > 1;
    return f;
  });

  // ── lanes ────────────────────────────────────────────────────────────────
  var handlersByDomain = {};
  if (graph) {
    (graph.files || []).forEach(function (fl) {
      if (fl.dir !== 'handlers') return;
      domains.forEach(function (d) {
        if (fl.name.indexOf(d.id + '-') === 0) {
          (handlersByDomain[d.id] = handlersByDomain[d.id] || []).push(fl.id);
        }
      });
    });
  }

  var lanes = domains.map(function (d) {
    var srcs = snap.byDomain[d.runtimeKey] || [];
    var mine = srcs.filter(function (s) { return s.key; }).map(function (s, i) {
      return { key: s.key, label: s.label, order: i };
    });
    // Portals are keyed by domainId in the portal files, which use the CANONICAL
    // id for most and the runtimeKey for a few. Both are looked up and merged,
    // and the split is reported rather than silently unioned away.
    var pA = portals.byDomain[d.id] || null;
    var pB = d.runtimeKey !== d.id ? (portals.byDomain[d.runtimeKey] || null) : null;
    var companies = (pA ? pA.companies : 0) + (pB ? pB.companies : 0);
    var types = {};
    [pA, pB].forEach(function (p) {
      if (!p) return;
      Object.keys(p.types || {}).forEach(function (t) { types[t] = (types[t] || 0) + p.types[t]; });
    });
    return {
      id: d.id, runtimeKey: d.runtimeKey, label: d.label,
      feeds: mine,
      feedCount: mine.length,
      sharedFeeds: mine.filter(function (s) { return feeds[s.key] && feeds[s.key].domains.length > 1; }).length,
      // The mix, per lane. A lane whose fifteen feeds are thirteen news searches
      // is a different organ from one with fifteen measurements, and the lane has
      // to say which it is or the count lies about the evidence.
      mix: mine.reduce(function (a, s) {
        var c = (feeds[s.key] || {}).cls || 'unknown';
        a[c] = (a[c] || 0) + 1;
        return a;
      }, {}),
      portals: {
        companies: companies,
        underCanonicalId: pA ? pA.companies : 0,
        underRuntimeKey: pB ? pB.companies : 0,
        withFeeds: (pA ? pA.withFeeds : 0) + (pB ? pB.withFeeds : 0),
        feedTypes: types,
        pages: portals.pages[d.id] || 0
      },
      handlers: (handlersByDomain[d.id] || []).sort(),
      notes: snap.domainOpts[d.runtimeKey] || []
    };
  });

  var band = systemBand(graph);

  var out = {
    generated: null,   // stamped by the endpoint, same rule as harness-graph
    source: {
      feeds: 'handlers/domain-snapshot.js  (buildDomain / src / byKey, hosts from the aligned fetcher array)',
      lanes: 'lib/operator-fleet.js DOMAINS  (canonical id + runtimeKey alias)',
      portals: 'assets/data/companies/*.json domainId + feedSources[], and <domain>_*_portal.html on disk',
      stages: 'api/protected-docs/harness-graph.json store index',
      caveat: 'Every edge here is read out of the source. Where the source carries no ' +
              'edge, none is drawn: see counts.domainRegionDataOut.'
    },
    counts: {
      lanes: lanes.length,
      feeds: feedList.length,
      feedEdges: feedList.reduce(function (a, f) { return a + f.domains.length; }, 0),
      sharedFeeds: feedList.filter(function (f) { return f.shared; }).length,
      feedsWithHost: feedList.filter(function (f) { return !!f.host; }).length,
      feedsWithoutFetcher: feedList.filter(function (f) { return !f.fetcher; }).length,
      byClass: feedList.reduce(function (a, f) { a[f.cls] = (a[f.cls] || 0) + 1; return a; }, {}),
      hosts: Object.keys(feedList.reduce(function (a, f) { if (f.host) a[f.host] = 1; return a; }, {})).length,
      sourceKeysDeclared: snap.sourceKeys.length,
      fetchersDeclared: snap.fetcherAt.length,
      sourceKeysUnused: snap.sourceKeys.filter(function (k) { return !feeds[k]; }).length,
      portalsTotal: portals.total,
      portalsWithFeeds: portals.withFeeds,
      portalPages: Object.keys(portals.pages).reduce(function (a, k) { return a + portals.pages[k]; }, 0),
      // Stated because it is the single most surprising fact in the picture and
      // the reason the lane does not continue as a thick pipe: the per-domain
      // handlers are terminal. They serve the browser and store nothing.
      domainRegionDataOut: graph ? (function () {
        var regOf = {};
        graph.blocks.forEach(function (b) { b.pins.forEach(function (p) { regOf[p.file] = b.region; }); });
        return graph.conductors.filter(function (c) {
          return c.kind === 'data' && regOf[c.from] === 'DOMAIN' && regOf[c.to] !== 'DOMAIN';
        }).length;
      })() : null
    },
    warnings: [].concat(
      misaligned ? ['SOURCE_KEYS (' + misaligned.keys + ') and the fetcher array (' + misaligned.fetchers +
                    ') are different lengths. Feeds past the shorter one carry no host.'] : [],
      unknownDomainKeys.length ? ['buildDomain keys with no canonical domain: ' + unknownDomainKeys.join(', ')] : [],
      portals.noDomain ? [portals.noDomain + ' company portal(s) carry no domainId and sit in no lane.'] : []
    ),
    stages: stageWiring(graph),
    lanes: lanes,
    feeds: feedList,
    portalFeedTypes: portals.feedTypes,
    system: band
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

  console.log('[flow] lanes: ' + out.counts.lanes + ', feeds: ' + out.counts.feeds +
              ' (' + out.counts.feedEdges + ' feed→domain edges, ' + out.counts.sharedFeeds + ' shared)');
  console.log('[flow] hosts resolved: ' + out.counts.feedsWithHost + '/' + out.counts.feeds +
              ' across ' + out.counts.hosts + ' distinct hosts');
  console.log('[flow] by kind: ' + Object.keys(out.counts.byClass).sort().map(function (k) {
    return out.counts.byClass[k] + ' ' + k;
  }).join(', '));
  console.log('[flow] portals: ' + out.counts.portalsTotal + ' company (' + out.counts.portalsWithFeeds +
              ' fed) · ' + out.counts.portalPages + ' portal pages');
  console.log('[flow] SOURCE_KEYS declared ' + out.counts.sourceKeysDeclared + ', unused by any domain: ' +
              out.counts.sourceKeysUnused);
  console.log('[flow] DOMAIN region data conductors out: ' + out.counts.domainRegionDataOut);
  out.warnings.forEach(function (w) { console.warn('[flow] WARNING ' + w); });
  console.log('[flow] wrote ' + rel(OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');

  if (VERBOSE) {
    console.log('\n[flow] lanes by feed count:');
    lanes.slice().sort(function (a, b) { return b.feedCount - a.feedCount; }).forEach(function (l) {
      console.log('  ' + String(l.feedCount).padStart(3) + ' feeds  ' + l.id.padEnd(15) +
        'portals ' + String(l.portals.companies).padStart(4) + '  pages ' + String(l.portals.pages).padStart(4));
    });
    console.log('\n[flow] feeds serving more than one lane:');
    feedList.filter(function (f) { return f.shared; }).forEach(function (f) {
      console.log('  ' + f.key.padEnd(26) + f.domains.join(', '));
    });
  }
}

main();
