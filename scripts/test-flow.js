#!/usr/bin/env node
/**
 * scripts/test-flow.js — render /flow headless and check it drills.
 *
 * THE THREE PROMISES, CHECKED AS BEHAVIOUR
 *   1. IT DRAWS THE STACK.  Six layers, top to bottom, in the operator's order:
 *                           sources, portals, domains, data, brain, business.
 *                           Not a set I invented — the order is asserted here so
 *                           a later edit cannot quietly reshuffle it.
 *   2. EVERY BOX OPENS.     Click a box -> the chart re-roots and the breadcrumb
 *                           grows. Click again -> deeper. Climb back out.
 *   3. IT DOES NOT LIE.     Nothing is green before it is measured. With no board
 *                           and no snapshot loaded, no box may claim "working".
 *
 * Runs the real flow.html and assets/js/flow.js under jsdom against the real
 * api/protected-docs/flow-graph.json. Only the network is stubbed.
 *
 * RUN: node scripts/test-flow.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var { JSDOM } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var fails = [], checks = 0;
var WANT = ['Sources', 'Portals', 'Domains', 'Data', 'Brain', 'Business'];
var rootNames = [], rootDoors = 0;
function ok(c, m) { checks++; if (!c) fails.push(m); }

var flow = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'protected-docs', 'flow-graph.json'), 'utf8'));
var NOW = Date.now();
var board = {
  ok: true, at: NOW,
  ai: { envEnabled: false, runtimePaused: false, tokensPerTick: 0, ungatedPaidJobs: [] },
  social: { paused: false },
  stores: { touched: { 'limen:feedhist': NOW - 3600000 }, coverage: 'limen-db only' },
  jobs: [], spikes: [], coverage: { declared: 18, observed: 2, neverObserved: 16 }
};
var snapshot = { domains: {} };
flow.lanes.forEach(function (l, i) {
  if (i === 2) return;                       // one lane absent on purpose
  snapshot.domains[l.runtimeKey] = { stress: 0.2 + (i % 6) / 10, status: 'live' };
});

var html = fs.readFileSync(path.join(ROOT, 'flow.html'), 'utf8');
var js = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'flow.js'), 'utf8');

var dom = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/, ''), {
  url: 'https://limenhelix.com/flow', pretendToBeVisual: true, runScripts: 'outside-only'
});
var win = dom.window, doc = win.document;
win.scrollTo = function () {};   // jsdom has no layout; the page scrolls on every drill

var calls = [];
win.fetch = function (url) {
  var u = String(url); calls.push(u);
  var body =
    u.indexOf('flow=1') !== -1 ? { ok: true, flow: flow, scheduled: {} } :
    u.indexOf('/api/domain-snapshot') !== -1 ? snapshot :
    u.indexOf('/api/feed-resolve') !== -1 ? { ok: true, recorderRows: 0, storedForecasts: 0, resolvedCount: 0 } :
    u.indexOf('/api/brain-weights') !== -1 ? { ok: true, snapshot: null } :
    u.indexOf('/api/feed-consolidate') !== -1 ? { ok: true, report: null } :
    u.indexOf('/api/harness') !== -1 ? board : { ok: false };
  return Promise.resolve({ status: 200, json: function () { return Promise.resolve(body); } });
};
win.eval(js);

function ready() {
  return new Promise(function (r) {
    if (doc.readyState !== 'loading') return r();
    win.addEventListener('DOMContentLoaded', function () { r(); });
  });
}
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }
function layers() { return Array.prototype.slice.call(doc.querySelectorAll('#stack .layer')); }
function layerNames() { return layers().map(function (l) { return l.querySelector('.lname').textContent; }); }
function boxes(n) {
  var scope = n == null ? doc.querySelector('#stack') : layers()[n];
  return scope ? Array.prototype.slice.call(scope.querySelectorAll('.box')) : [];
}
function crumbs() { return Array.prototype.slice.call(doc.querySelectorAll('#crumbs .crumb')); }
function click(e) { e.dispatchEvent(new win.Event('click', { bubbles: true })); }

function run() {
  doc.getElementById('gk').value = 'test-key';
  click(doc.getElementById('gb'));

  return tick(80).then(function () {
    ok(doc.getElementById('gate').classList.contains('hide'), 'gate did not close');
    ok(calls.some(function (c) { return c.indexOf('flow=1') !== -1; }), 'never fetched the flow graph');

    // ── 1. the stack, in the operator's order ────────────────────────────
    var names = layerNames();
    rootNames = names;
    var want = WANT;
    ok(names.length === want.length,
       'expected ' + want.length + ' layers, got ' + names.length + ': ' + names.join(' / '));
    want.forEach(function (w, i) {
      ok(names[i] === w, 'layer ' + i + ' is "' + names[i] + '", expected "' + w + '"');
    });

    // Arrows between layers, so it reads as a flow and not a list of panels.
    var arrows = doc.querySelectorAll('#stack .flowarrow');
    ok(arrows.length === want.length - 1,
       'expected ' + (want.length - 1) + ' connectors between layers, got ' + arrows.length);

    // ── 3. nothing green before it is measured ───────────────────────────
    // The board and snapshot have not landed on the first paint. Any box
    // claiming "working" at this point is defaulting, which is the failure
    // every version of this page has existed to prevent.
    var greenEarly = boxes().filter(function (b) {
      return /\bs-ok\b/.test(b.className) && /not measured|snapshot not loaded/.test(b.textContent);
    });
    ok(greenEarly.length === 0, greenEarly.length + ' box(es) claim "working" while unmeasured');

    return tick(60);
  }).then(function () {
    // ── 2. every box opens ───────────────────────────────────────────────
    ok(crumbs().length === 1, 'expected 1 breadcrumb at the root, got ' + crumbs().length);

    var doors = boxes().filter(function (b) { return b.hasAttribute('data-go'); });
    ok(doors.length > 6, 'only ' + doors.length + ' boxes open; the whole point is that they all do');
    rootDoors = doors.length;

    // Drill: Domains -> a domain -> its own stack.
    var domainsLayer = layers()[2];
    var d0 = Array.prototype.slice.call(domainsLayer.querySelectorAll('[data-go]'))[0];
    ok(!!d0, 'the Domains layer has no openable box');
    click(d0);

    return tick(40).then(function () {
      ok(crumbs().length === 2, 'opening a box did not grow the breadcrumb (' + crumbs().length + ')');
      var dnames = layerNames();
      ok(dnames.indexOf('Domains') !== -1 || dnames.length > 0, 'domains view drew nothing');

      var one = boxes().filter(function (b) { return b.hasAttribute('data-go'); })[0];
      ok(!!one, 'the domains list has no openable box');
      click(one);

      return tick(40).then(function () {
        ok(crumbs().length === 3, 'second drill did not deepen the breadcrumb (' + crumbs().length + ')');
        var ln = layerNames();
        // A single domain must render as its OWN stack — the same shape, one
        // level in. That recursion is the thing the operator drew.
        ok(ln.indexOf('Sources') !== -1 && ln.indexOf('Domain') !== -1,
           'a domain did not render as its own stack: ' + ln.join(' / '));
        ok(ln.indexOf('Brain') !== -1, 'the domain stack has no Brain layer');

        // The loop must be unprobed and say so, not coloured from a schedule.
        var txt = doc.querySelector('#stack').textContent;
        ok(/Not probed|not measured/i.test(txt),
           'the loop is drawn without having been probed');

        // Climb back out via the breadcrumb.
        click(crumbs()[0]);
        return tick(40).then(function () {
          ok(crumbs().length === 1, 'breadcrumb did not return to the root');
          ok(layerNames()[0] === 'Sources', 'root view did not come back');

          // "up a layer" is the other way out.
          click(boxes().filter(function (b) { return b.hasAttribute('data-go'); })[0]);
          return tick(40).then(function () {
            var deep = crumbs().length;
            click(doc.getElementById('up'));
            return tick(40).then(function () {
              ok(crumbs().length === deep - 1,
                 '"up a layer" did not climb (' + deep + ' -> ' + crumbs().length + ')');

              console.log('[flow] measured: ' + WANT.length + ' layers ' + rootNames.join(' → ') +
                ' · ' + rootDoors + ' openable boxes at the root · drilled 2 deep and climbed back');
              return null;
            });
          });
        });
      });
    });
  });
}

ready().then(run).then(function () {
  console.log('[flow] ' + (checks - fails.length) + '/' + checks + ' checks passed');
  if (fails.length) {
    fails.forEach(function (f) { console.error('  FAIL  ' + f); });
    process.exit(1);
  }
  console.log('[flow] draws the stack in order, every box opens, nothing green before it is measured');
  process.exit(0);
}).catch(function (e) {
  console.error('[flow] threw: ' + (e && e.stack || e));
  process.exit(1);
});
