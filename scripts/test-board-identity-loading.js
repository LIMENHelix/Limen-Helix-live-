#!/usr/bin/env node
'use strict';

/**
 * test-board-identity-loading.js — delayed manifest completion and displayed-row
 * association.
 *
 * A manifest that settles after the Board render must refresh every currently
 * rendered expansion, including unopened ones, without using a page-local index
 * against global DATA. Detached rows are never refreshed.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'kernel-comparison.js'), 'utf8');
const audit = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'audit', 'board-route-identity-mismatches.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'companies-manifest.json'), 'utf8'));

const normStart = src.indexOf('function _normCik');
const normEnd = src.indexOf('\n', normStart) + 1;
const guardStart = src.indexOf('var QUARANTINED_SLUGS');
const guardEnd = src.indexOf('var TERMINAL_PHASES', guardStart);
assert.ok(normStart !== -1 && guardStart !== -1 && guardEnd > guardStart,
  'route guard helpers not found');

let currentRoot = null;
const sandbox = {
  document: { getElementById: (id) => (id === 'tableBody' ? currentRoot : null) },
  /* The module-load IIFE settles immediately in this VM; provide a no-op builder
     before executing it. The test replaces this with its own stub afterwards. */
  _buildExpandContent: () => ''
};
vm.createContext(sandbox);
vm.runInContext(src.slice(normStart, normEnd) + '\n' + src.slice(guardStart, guardEnd) +
  '\nthis._routeStatus = _routeStatus;' +
  '\nthis._settlePortalIdentity = _settlePortalIdentity;' +
  '\nthis._refreshRenderedRouteControls = _refreshRenderedRouteControls;' +
  '\nthis._portalIdentityState = _portalIdentityState;', sandbox);
sandbox._buildExpandContent = (d) => 'CONTENT:' + d.t;

function portalMapForAudit() {
  const map = {};
  for (const row of audit.rows) {
    map[row.boardSlug] = { cik: row.portalCik, ticker: row.portalTicker };
  }
  return map;
}
function setReady() {
  sandbox._portalIdentity = portalMapForAudit();
  sandbox._portalIdentityState = 'ready';
}

// ── Initial render before the manifest: routes withheld ───────────────────
// The module-load IIFE settles immediately in this VM; simulate the pending state.
sandbox._portalIdentityState = 'loading';
assert.strictEqual(sandbox._routeStatus({ c: '1467373', t: 'ACN', s: 'accenture' }), 'loading',
  'a pending manifest did not withhold the route');

// ── Manifest succeeds: coherent routes become usable; mismatches stay blocked ─
setReady();
assert.strictEqual(sandbox._routeStatus({ c: '1467373', t: 'ACN', s: 'accenture' }), 'ok');
assert.strictEqual(sandbox._routeStatus({ c: '42', t: 'CTRL', s: 'nonexistent' }), 'mismatch');
assert.strictEqual(sandbox._routeStatus({ c: '999', t: 'ACN', s: 'accenture' }), 'mismatch',
  'a ticker-only match authorized a route');
assert.strictEqual(sandbox._routeStatus({ c: '91142', t: 'AOS', s: 'saia' }), 'quarantined');

// ── Manifest failure: routes remain blocked ───────────────────────────────
sandbox._portalIdentityState = 'error';
assert.strictEqual(sandbox._routeStatus({ c: '1467373', t: 'ACN', s: 'accenture' }), 'unavailable',
  'a failed manifest unblocked a route');
setReady();

// ── Every audited mismatch remains blocked ────────────────────────────────
assert.strictEqual(audit.counts.mismatches, 58);
for (const row of audit.rows) {
  const status = sandbox._routeStatus({
    c: row.boardCik, t: row.boardTicker, s: row.boardSlug
  });
  assert.notStrictEqual(status, 'ok',
    'audited mismatch was authorized: ' + row.boardTicker + ' -> ' + row.boardSlug);
}

// ── Displayed-record association ──────────────────────────────────────────
function identityOf(row) {
  return {
    cik: String(row.c).replace(/^0+/, ''),
    ticker: row.t ? String(row.t).toUpperCase() : null,
    name: row.n || null
  };
}
function fakeRow(row, opts) {
  opts = opts || {};
  const td = { innerHTML: opts.initial || '' };
  const tr = {
    __boardRow: opts.dropRow ? undefined : row,
    __boardIdentity: opts.identity || identityOf(row),
    className: opts.open ? 'expand-row open' : 'expand-row',
    td,
    querySelector: (sel) => (sel === 'td' ? td : null)
  };
  return tr;
}
function fakeRoot(rows) {
  return { querySelectorAll: (sel) => (sel === 'tr.expand-row' ? rows : []) };
}

const rows = [
  { c: '0000000042', t: 'CTRL', n: 'Control', s: 'control' },
  { c: '0000000043', t: 'OTHER', n: 'Other', s: 'other' }
];
const rebuild = (d) => 'CONTENT:' + d.t;

// All rendered rows refresh, open or not; open class is untouched.
{
  const open = fakeRow(rows[0], { open: true });
  const closed = fakeRow(rows[1]);
  const root = fakeRoot([open, closed]);
  currentRoot = root;
  const n = sandbox._refreshRenderedRouteControls(root, rebuild);
  assert.strictEqual(n, 2);
  assert.strictEqual(open.td.innerHTML, 'CONTENT:CTRL');
  assert.strictEqual(closed.td.innerHTML, 'CONTENT:OTHER');
  assert.strictEqual(open.className, 'expand-row open', 'the open row was closed');
}

// Sorted / filtered / page-two displayed order: each row keeps its own record.
{
  const shuffled = [fakeRow(rows[1]), fakeRow(rows[0])];
  const root = fakeRoot(shuffled);
  sandbox._refreshRenderedRouteControls(root, rebuild);
  assert.strictEqual(shuffled[0].td.innerHTML, 'CONTENT:OTHER');
  assert.strictEqual(shuffled[1].td.innerHTML, 'CONTENT:CTRL');
}

// Missing or mismatched association: withheld, never substituted.
{
  const missing = fakeRow(rows[0], { dropRow: true, initial: 'SENTINEL' });
  const mismatched = fakeRow(rows[0], {
    initial: 'SENTINEL', identity: { cik: '999', ticker: 'WRONG', name: 'Wrong' }
  });
  const root = fakeRoot([missing, mismatched]);
  const n = sandbox._refreshRenderedRouteControls(root, rebuild);
  assert.strictEqual(n, 0);
  for (const row of [missing, mismatched]) {
    assert.ok(row.td.innerHTML.includes('IDENTITY CHECK UNAVAILABLE'),
      'a corrupt association did not withhold its routes');
    assert.ok(!row.td.innerHTML.includes('CONTENT:'),
      'a corrupt association selected another record');
  }
}

// A detached previous render is not updated; only the current root is.
{
  const oldRow = fakeRow(rows[0], { initial: 'OLD' });
  const oldRoot = fakeRoot([oldRow]);
  const newRow = fakeRow(rows[1], { initial: 'NEW' });
  const newRoot = fakeRoot([newRow]);
  currentRoot = newRoot;
  sandbox._refreshRenderedRouteControls(newRoot, rebuild);
  assert.strictEqual(oldRow.td.innerHTML, 'OLD', 'a detached DOM record was updated');
  assert.strictEqual(newRow.td.innerHTML, 'CONTENT:OTHER');
}

// Terminal settle refreshes every current expansion and records the state.
{
  const a = fakeRow(rows[0], { open: true });
  const b = fakeRow(rows[1]);
  currentRoot = fakeRoot([a, b]);
  sandbox._settlePortalIdentity('ready');
  assert.strictEqual(a.td.innerHTML, 'CONTENT:CTRL');
  assert.strictEqual(b.td.innerHTML, 'CONTENT:OTHER');
  assert.strictEqual(a.className, 'expand-row open', 'terminal refresh closed the open row');
  assert.strictEqual(sandbox._portalIdentityState, 'ready');

  sandbox._settlePortalIdentity('error');
  assert.strictEqual(sandbox._portalIdentityState, 'error');
}

// The refresh path never uses global DATA or the page-local index.
const refreshSrc = src.slice(src.indexOf('function _refreshRenderedRouteControls'),
  src.indexOf('function _settlePortalIdentity'));
assert.ok(!/DATA\s*\[/.test(refreshSrc), 'refresh addresses global DATA by index');
assert.ok(!/_expandedIdx/.test(refreshSrc), 'refresh uses the page-local index');
assert.ok(refreshSrc.includes('__boardRow'), 'refresh does not use the displayed record');
assert.ok(src.includes("_settlePortalIdentity('ready')"), 'manifest success does not settle');
assert.ok(src.includes("_settlePortalIdentity('error')"), 'manifest failure does not settle');
assert.ok(manifest.index && Object.keys(manifest.index).length > 0, 'manifest unavailable');
assert.ok(src.includes("routeState === 'no-route' || routeState === 'ok'"),
  'the expansion builder does not gate links on the route state');
assert.ok(src.includes('company-portal.html?company='),
  'the portal link is missing from the expansion builder');

console.log('board identity loading: delayed manifest refreshes all displayed routes; 58 mismatches stay blocked; no page-local index identity');
