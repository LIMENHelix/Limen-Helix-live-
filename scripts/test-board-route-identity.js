#!/usr/bin/env node
'use strict';

/**
 * test-board-route-identity.js — generic cross-issuer route containment.
 *
 * A Board route is usable only when the normalized Board CIK equals the
 * normalized portal CIK and nonempty tickers do not contradict. The audit
 * artifact records the current mismatches; runtime consumers must fail closed.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../lib/identity-coherence');
const P = require('../lib/limen-stress-propagator');

const ROOT = path.join(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'audit', 'board-route-identity-mismatches.json'), 'utf8'));

// ── The rule ──────────────────────────────────────────────────────────────
const ACN = { board: { cik: '1281761', ticker: 'ACN' }, portal: { cik: '1467373', ticker: 'ACN' } };
const AMAT = { board: { cik: '2488', ticker: 'AMAT' }, portal: { cik: '6951', ticker: 'AMAT' } };
const DUK = { board: { cik: '1004980', ticker: 'DUK' }, portal: { cik: '1326160', ticker: 'DUK' } };
for (const [name, pair] of Object.entries({ ACN, AMAT, DUK })) {
  assert.strictEqual(C.routeCoherent(pair.board, pair.portal), false,
    name + ' mismatch was accepted');
}
assert.strictEqual(C.routeCoherent(
  { cik: '1467373', ticker: 'ACN' }, { cik: '0001467373', ticker: 'ACN' }), true,
  'coherent control was rejected');
assert.strictEqual(C.routeCoherent(
  { cik: '1467373', ticker: 'ACN' }, { cik: '1467373', ticker: 'OTHER' }), false,
  'contradictory ticker was accepted');
assert.strictEqual(C.routeCoherent({ cik: null, ticker: 'ACN' }, { cik: '1467373', ticker: 'ACN' }), false,
  'missing Board CIK was accepted');
assert.strictEqual(C.routeCoherent({ cik: '1467373', ticker: 'ACN' }, { cik: null, ticker: 'ACN' }), false,
  'missing portal CIK was accepted');

// ── Audit artifact ────────────────────────────────────────────────────────
assert.strictEqual(audit.counts.mismatches, 58);
assert.strictEqual(audit.counts.cikMismatch, 37,
  'the reported 37 CIK mismatches are not recorded');
assert.strictEqual(audit.counts.tickerConflict, 11);
assert.strictEqual(audit.counts.missingCik, 10);
assert.ok(audit.sources.operatorReferences > 0, 'source attribution missing');
for (const ticker of ['ACN', 'AMAT', 'DUK']) {
  const row = audit.rows.find((r) => r.boardTicker === ticker);
  assert.ok(row, ticker + ' missing from the audit');
  assert.strictEqual(C.routeCoherent(
    { cik: row.boardCik, ticker: row.boardTicker },
    { cik: row.portalCik, ticker: row.portalTicker }), false);
}

// ── Relationship activation ───────────────────────────────────────────────
function graphWith(edge) {
  const portals = {
    owner: { slug: 'owner', cik: '1', ticker: 'OWN', functionalNetwork: { suppliers: [edge] } },
    target: { slug: 'target', cik: '2', ticker: 'TGT' }
  };
  return P.buildGraph(portals);
}
assert.strictEqual(graphWith({ slug: 'target', cik: '3' }).edges.get('owner').length, 0,
  'incoherent relationship edge survived');
assert.strictEqual(graphWith({ slug: 'target', cik: '2', ticker: 'TGT' }).edges.get('owner').length, 1,
  'coherent relationship edge was dropped');
assert.strictEqual(graphWith({ slug: 'target' }).edges.get('owner').length, 1,
  'slug-only relationship edge was dropped');
assert.strictEqual(graphWith({ slug: 'target', ticker: 'OTHER' }).edges.get('owner').length, 0,
  'ticker-contradictory relationship edge survived');

// ── Browser Board guard ───────────────────────────────────────────────────
const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'kernel-comparison.js'), 'utf8');
const normStart = src.indexOf('function _normCik');
const normEnd = src.indexOf('\n', normStart) + 1;
const guardStart = src.indexOf('var QUARANTINED_SLUGS');
const guardEnd = src.indexOf('var TERMINAL_PHASES', guardStart);
assert.ok(normStart !== -1 && guardStart !== -1 && guardEnd > guardStart,
  'Board route guard not found');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src.slice(normStart, normEnd) + '\n' + src.slice(guardStart, guardEnd)
  + '\nthis._routeCoherent = _routeCoherent;', sandbox);
sandbox._portalIdentityState = 'ready';
sandbox._portalIdentity = {
  accenture: { cik: '0001467373', ticker: 'ACN' },
  applied_materials: { cik: '0000006951', ticker: 'AMAT' },
  duk: { cik: '0001326160', ticker: 'DUK' },
  control: { cik: '0000000042', ticker: 'CTRL' },
  saia: { cik: '0000091142', ticker: 'SAIA' }
};
assert.strictEqual(sandbox._routeCoherent({ c: '1281761', t: 'ACN', s: 'accenture' }), false);
assert.strictEqual(sandbox._routeCoherent({ c: '2488', t: 'AMAT', s: 'applied_materials' }), false);
assert.strictEqual(sandbox._routeCoherent({ c: '1004980', t: 'DUK', s: 'duk' }), false);
assert.strictEqual(sandbox._routeCoherent({ c: '42', t: 'CTRL', s: 'control' }), true,
  'coherent control route was blocked');
assert.strictEqual(sandbox._routeCoherent({ c: '42', t: 'CTRL', s: 'unknown' }), false,
  'unknown portal identity was accepted');
assert.strictEqual(sandbox._routeCoherent({ c: '91142', t: 'AOS', s: 'saia' }), false,
  'quarantined route was accepted');
assert.strictEqual(sandbox._routeStatus({ c: '1281761', t: 'ACN', s: 'accenture' }), 'mismatch');
assert.strictEqual(sandbox._routeStatus({ c: '42', t: 'CTRL', s: 'control' }), 'ok');
assert.strictEqual(sandbox._routeStatus({ c: '91142', t: 'AOS', s: 'saia' }), 'quarantined');
assert.strictEqual(sandbox._routeStatus({ c: '42', t: 'CTRL', s: null }), 'no-route');
sandbox._portalIdentityState = 'loading';
assert.strictEqual(sandbox._routeStatus({ c: '42', t: 'CTRL', s: 'control' }), 'loading',
  'a pending manifest was displayed as a mismatch');
sandbox._portalIdentityState = 'error';
assert.strictEqual(sandbox._routeStatus({ c: '42', t: 'CTRL', s: 'control' }), 'unavailable');
sandbox._portalIdentityState = 'ready';
assert.ok(src.includes('_refreshOpenRouteControls'),
  'open route controls are not refreshed when identities load');

// ── Producer wiring ───────────────────────────────────────────────────────
for (const [file, marker] of [
  ['scripts/score-companies.js', 'resolveCoherentPortal'],
  ['scripts/build-kernel-watchlist.mjs', 'coherentSlug'],
  ['assets/js/company-portal-ui.js', '_identityMismatch'],
  ['assets/js/kernel-comparison.js', '_routeCoherent']
]) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(text.includes(marker), file + ' does not apply the coherence rule');
}

console.log('board route identity: 37 CIK mismatches / 58 total failing routes contained; ACN, AMAT, DUK blocked; coherent control passes');
