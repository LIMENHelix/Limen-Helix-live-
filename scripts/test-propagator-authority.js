#!/usr/bin/env node
'use strict';

/**
 * test-propagator-authority.js — kernel-derived stress requires validated
 * Thing One provenance.
 *
 * The Command Board feed deliberately keeps `co`/`a` on unvalidated rows for
 * diagnostics. Those values must not seed the stress network; only a
 * protected-scorer (`limen_backtest.py`) record with `vs === 'validated'` has
 * authority. Graph topology and non-kernel topology effects are unchanged.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../lib/limen-stress-propagator');

const ROOT = path.join(__dirname, '..');
const T0 = { qualification_status: 'qualified', permits_thing1_use: true };

function portal(slug, cik, functionalNetwork) {
  return { slug, name: slug, cik, functionalNetwork: functionalNetwork || {} };
}

function entry(overrides) {
  return Object.assign({
    c: '42', t: 'ACME', co: 0.9, a: false, vs: 'validated',
    kid: 'limen_backtest.py', t0: T0
  }, overrides);
}

function intrinsicOf(portals, entries) {
  const graph = P.buildGraph(portals);
  return {
    graph,
    map: P.computeIntrinsicStress(graph.nodes, entries, portals)
  };
}

// ── Unvalidated numeric co, alert flag, permitting Thing 0 → zero ──────────
{
  const portals = { acme: portal('acme', '0000000042') };
  const node = intrinsicOf(portals, [
    entry({ vs: 'unvalidated_after_modification', a: true })
  ]).map.get('acme');
  assert.strictEqual(node.intrinsic, 0,
    'unvalidated composite seeded kernel intrinsic stress');
  assert.strictEqual(node.hasKernelData, false,
    'unvalidated composite was treated as kernel data');
}

// ── Missing or malformed vs → zero ─────────────────────────────────────────
for (const vs of [undefined, null, '', 'VALIDATED', 'error', 0]) {
  const node = intrinsicOf({ acme: portal('acme', '42') },
    [entry({ vs })]).map.get('acme');
  assert.strictEqual(node.intrinsic, 0,
    'non-validated vs seeded stress: ' + String(vs));
}

// ── Experimental → zero ───────────────────────────────────────────────────
assert.strictEqual(
  intrinsicOf({ acme: portal('acme', '42') },
    [entry({ vs: 'experimental' })]).map.get('acme').intrinsic,
  0, 'experimental composite seeded stress');

// ── Wrong or missing kid → zero ───────────────────────────────────────────
for (const kid of [undefined, null, 'phase_engine.py', 'limen_backtest']) {
  const node = intrinsicOf({ acme: portal('acme', '42') },
    [entry({ kid })]).map.get('acme');
  assert.strictEqual(node.intrinsic, 0,
    'non-protected scorer seeded stress: ' + String(kid));
}

// ── The full Thing Zero authorization chain is required ───────────────────
const thing0Cases = [
  ['absent', undefined],
  ['malformed string', 'qualified'],
  ['malformed object', {}],
  ['partial', { qualification_status: 'partially_qualified', permits_thing1_use: true }],
  ['not qualified', { qualification_status: 'not_qualified', permits_thing1_use: true }],
  ['missing permit', { qualification_status: 'qualified' }],
  ['permit false', { qualification_status: 'qualified', permits_thing1_use: false }],
  ['contradictory stray permit true', { qualification_status: 'not_qualified', permits_thing1_use: true }],
  ['camelCase stray permit', { qualification_status: 'qualified', permits_thing1_use: false, permitsThing1Use: true }]
];
for (const [label, t0] of thing0Cases) {
  const node = intrinsicOf({ acme: portal('acme', '42') },
    [entry({ t0 })]).map.get('acme');
  assert.strictEqual(node.intrinsic, 0,
    'non-coherent Thing Zero seeded stress: ' + label);
  assert.strictEqual(node.hasKernelData, false,
    'non-coherent Thing Zero counted as kernel data: ' + label);
}

// ── Validated protected-scorer control contributes; alert multiplier holds ─
{
  const quiet = intrinsicOf({ acme: portal('acme', '42') },
    [entry({ co: 0.9, a: false })]).map.get('acme');
  assert.strictEqual(quiet.intrinsic, 0.9,
    'validated composite did not contribute intrinsic stress');
  assert.strictEqual(quiet.hasKernelData, true);

  const alerted = intrinsicOf({ acme: portal('acme', '42') },
    [entry({ co: 0.9, a: true })]).map.get('acme');
  assert.strictEqual(alerted.intrinsic, 0.9 * P.ALERT_MULT,
    'alert multiplier changed for a validated record');
  assert.strictEqual(alerted.alert, true);
}

// ── Graph topology is independent of the authority gate ───────────────────
const chained = {
  seed: portal('seed', '42', { suppliers: [{ slug: 'target', confidence: 'high' }] }),
  target: portal('target', '43')
};
const topology = intrinsicOf(chained, []);
assert.strictEqual(topology.graph.nodes.size, 2, 'graph node count changed');
assert.strictEqual(
  [...topology.graph.edges.values()].reduce((n, a) => n + a.length, 0), 1,
  'graph edge construction changed');

// ── Unvalidated seed does not propagate; validated control does ───────────
{
  const unvalidated = P.runPropagation(chained, [
    entry({ vs: 'unvalidated_after_modification', a: true })
  ]);
  assert.strictEqual(unvalidated.intrinsic.get('seed').intrinsic, 0);
  assert.strictEqual(unvalidated.propagated.get('target').inducedStress, 0,
    'unvalidated seed propagated through the network');

  const validated = P.runPropagation(chained, [entry({ co: 0.9, a: false })]);
  assert.ok(validated.intrinsic.get('seed').intrinsic > 0,
    'validated control did not seed');
  assert.ok(validated.propagated.get('target').inducedStress > 0,
    'validated control did not propagate');
}

// ── Current committed corpus: no validated Thing One rows, so no seeds ────
{
  const dir = path.join(ROOT, 'assets', 'data', 'companies');
  const portals = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (p && p.slug) portals[p.slug] = p;
    } catch (e) { /* skip unreadable portal */ }
  }
  const entries = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'assets', 'data', 'command-board-data.json'), 'utf8')).companies || [];

  const res = P.runPropagation(portals, entries);
  const seeded = [...res.intrinsic.values()].filter((n) => n.intrinsic > 0);
  const pushed = [...res.propagated.values()].filter((n) => n.networkPushed);
  assert.strictEqual(seeded.length, 0,
    'current feed produced kernel-derived intrinsic seeds');
  assert.strictEqual(pushed.length, 0,
    'current feed produced kernel-derived network pushes');
  assert.ok(!res.nodes.has('saia'),
    'quarantined identity record entered the stress graph');

  // Topology survives: the gate removes authority, not edges.
  const edgeCount = [...res.edges.values()].reduce((n, a) => n + a.length, 0);
  const nodeCount = res.nodes.size;
  assert.ok(nodeCount > 0 && edgeCount > 0,
    'authority gate altered graph construction');

  console.log('propagator authority: ' + Object.keys(portals).length +
    ' portals, ' + entries.length + ' feed rows, ' + nodeCount + ' nodes, ' +
    edgeCount + ' edges, 0 kernel seeds, 0 kernel pushes');
}
