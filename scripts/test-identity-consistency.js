#!/usr/bin/env node
'use strict';

/**
 * test-identity-consistency.js — the quarantined SAIA / A. O. Smith identity
 * must be consistent across every surface that can route or activate it:
 * portals, manifest, registry, Board routes, relationships and the stress graph.
 *
 * It does not attempt to repair the mixed record and does not assert uniqueness
 * across the whole corpus (segments and subsidiaries legitimately share a
 * ticker). It asserts that the quarantined identity is either absent or
 * explicitly quarantined on every surface.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Q = require('../lib/identity-quarantine');
const P = require('../lib/limen-stress-propagator');

const ROOT = path.join(__dirname, '..');
const PORTAL_DIR = path.join(ROOT, 'assets', 'data', 'companies');

// ── Authoritative pairs ───────────────────────────────────────────────────
const entry = Q.entryForSlug('saia');
assert.ok(entry, 'SAIA quarantine entry missing');
assert.strictEqual(Q.normalizeCik(entry.authoritativeCik), '1177702',
  'authoritative SAIA CIK changed');
assert.strictEqual(Q.normalizeCik(entry.conflictingCik), '91142',
  'conflicting AOS CIK changed');
assert.strictEqual(Q.isQuarantinedTicker('SAIA'), true);
assert.strictEqual(Q.isQuarantinedTicker('AOS'), false,
  'AOS was quarantined by ticker; only the mixed SAIA record may be');

// ── Portal corpus ─────────────────────────────────────────────────────────
const portals = {};
let quarantinedPortals = 0;
let unquarantinedSaia = 0;
let aosPortals = 0;
for (const f of fs.readdirSync(PORTAL_DIR).filter((x) => x.endsWith('.json'))) {
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, f), 'utf8')); }
  catch (e) { continue; }
  if (!p || !p.slug) continue;
  portals[p.slug] = p;
  if (Q.isQuarantinedPortal(p)) {
    quarantinedPortals++;
    assert.strictEqual(Q.isQuarantinedSlug(p.slug), true,
      'quarantined portal is not the known mixed record');
    continue;
  }
  const ticker = p.ticker ? String(p.ticker).toUpperCase() : null;
  if (ticker === 'SAIA') unquarantinedSaia++;
  if (ticker === 'AOS') {
    aosPortals++;
    assert.strictEqual(Q.normalizeCik(p.cik), '91142',
      'an AOS portal carries a non-AOS CIK');
  }
}
assert.strictEqual(quarantinedPortals, 1,
  'expected exactly the SAIA record to be quarantined');
assert.strictEqual(unquarantinedSaia, 0,
  'an unquarantined SAIA portal is navigable');

// ── Manifest ──────────────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'companies-manifest.json'), 'utf8'));
assert.strictEqual(manifest.slugs.includes('saia'), false,
  'manifest still lists the quarantined slug');
assert.strictEqual(manifest.index.saia, undefined,
  'manifest still indexes the quarantined slug');
assert.strictEqual(manifest.count, manifest.slugs.length);

// ── Registry ──────────────────────────────────────────────────────────────
const registry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'company-registry.json'), 'utf8'));
const regEntry = registry.byCik['0000091142'] || registry.byCik['91142'];
if (regEntry) {
  /* Either retained and explicitly quarantined, or removed by a gated rebuild. */
  assert.strictEqual(regEntry.slug, 'saia');
  assert.strictEqual(Q.isQuarantinedPortal({
    slug: regEntry.slug, ticker: regEntry.ticker, cik: regEntry.cik
  }), true, 'registry entry is not quarantined');
  assert.strictEqual(registry.bySlug.saia, '0000091142');
} else {
  assert.strictEqual(registry.bySlug.saia, undefined,
    'bySlug retains a CIK for a removed quarantined entry');
}
for (const [cik, rec] of Object.entries(registry.byCik)) {
  if (!rec) continue;
  const ticker = rec.ticker ? String(rec.ticker).toUpperCase() : null;
  if (ticker === 'SAIA') {
    assert.strictEqual(Q.isQuarantinedPortal({
      slug: rec.slug, ticker: rec.ticker, cik: rec.cik
    }), true, 'registry pairs SAIA with an unquarantined record at ' + cik);
  }
  if (ticker === 'AOS') {
    assert.strictEqual(Q.normalizeCik(cik), '91142',
      'registry pairs AOS with a non-AOS CIK at ' + cik);
  }
}

// ── Board routes ──────────────────────────────────────────────────────────
const board = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'command-board-data.json'), 'utf8')).companies || [];
const saiaRoutes = board.filter((r) => r.s === 'saia');
const aosRoutes = board.filter((r) => String(r.t || '').toUpperCase() === 'AOS');
assert.ok(saiaRoutes.length > 0, 'board no longer carries the mixed route to test');
for (const r of saiaRoutes.concat(aosRoutes)) {
  assert.strictEqual(Q.boardRouteQuarantined(r), true,
    'board row still routes to the quarantined record: ' + r.t + ' -> ' + r.s);
}
const boardJS = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'kernel-comparison.js'), 'utf8');
assert.ok(boardJS.includes('_identityQuarantined('),
  'Command Board lost its quarantine route guard');
assert.ok(boardJS.includes('IDENTITY QUARANTINE'),
  'Command Board does not label a quarantined route');
const portalUI = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'company-portal-ui.js'), 'utf8');
assert.ok(portalUI.includes('_identityQuarantineMessage('),
  'company portal lost its direct-URL quarantine guard');

// ── Relationships and stress graph activation ─────────────────────────────
let edgeTargets = 0;
let strayCiks = 0;
for (const arr of Object.values(registry.byBrainNode || {})) {
  for (const e of arr || []) {
    if (!e) continue;
    if (!Q.referencesQuarantined(e)) continue;
    edgeTargets++;
    const cik = Q.normalizeCik(e.targetCik);
    if (cik !== '91142' && cik !== '1177702') strayCiks++;
  }
}
assert.ok(edgeTargets > 0,
  'no relationship edges reference the quarantined identity');

/* A quarantined edge whose CIK belongs to another issuer must be dropped, not
   retargeted by the CIK fallback. */
const synthetic = {
  owner: {
    slug: 'owner', cik: '1',
    functionalNetwork: {
      suppliers: [
        { slug: 'saia', cik: '1104659', name: 'Saia Inc.' },
        { name: 'Saia Inc.', cik: '1104659' }
      ]
    }
  },
  target: { slug: 'target', cik: '1104659' }
};
const syntheticGraph = P.buildGraph(synthetic);
assert.strictEqual(syntheticGraph.nodes.has('saia'), false);
assert.strictEqual(syntheticGraph.edges.get('owner').length, 0,
  'quarantined edge was retargeted by a stray CIK');

const graph = P.buildGraph(portals);
assert.strictEqual(graph.nodes.has('saia'), false,
  'quarantined record entered the stress graph');
assert.strictEqual(graph.slugByCik.has('91142'), false,
  'CIK 91142 still resolves to a graph node');
assert.strictEqual(P.computeIntrinsicStress(graph.nodes, board, portals).has('saia'), false,
  'quarantined record received intrinsic stress');

console.log('identity quarantine: 1 portal, 1 manifest entry removed, ' +
  saiaRoutes.length + ' Board route(s) blocked, ' + edgeTargets +
  ' relationship edge(s) neutralised (' + strayCiks + ' carried a stray CIK), graph node absent');
