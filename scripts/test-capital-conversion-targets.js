#!/usr/bin/env node
'use strict';

/**
 * test-capital-conversion-targets.js — capital targets require an authoritative
 * watchlist. An empty authoritative watchlist means no targets; every other
 * state withholds the claim. There is no provenance-free fallback.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'ui', 'console-clarity.js'), 'utf8');

const start = src.indexOf('var _CAP_BOARD_ALIAS');
const end = src.indexOf('// ── end _capTargetsFromState ──', start);
assert.ok(start !== -1 && end > start, 'capital target selector not found');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src.slice(start, end) +
  '\nthis._capTargetsFromState = _capTargetsFromState;', sandbox);
const select = sandbox._capTargetsFromState;
const eq = (actual, expected, message) => assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);

const populated = {
  trade: [{ ticker: 'XPO' }, { ticker: 'JBHT' }],
  medicine: [{ ticker: 'ALKS' }]
};

// Authoritative populated.
eq(select('ready', populated, 'trade', 5).map((x) => x.ticker),
  ['XPO', 'JBHT'], 'authoritative populated targets were not returned');
eq(select('ready', populated, 'medicine', 1).map((x) => x.ticker),
  ['ALKS'], 'domain slice was not applied');

// Domain alias.
eq(select('ready', populated, 'supplyChain', 5).map((x) => x.ticker),
  ['XPO', 'JBHT'], 'supplyChain did not alias to trade');

// Authoritative empty: no targets, no fallback.
eq(select('ready', {}, 'trade', 5), [],
  'authoritative empty watchlist produced targets');
eq(select('ready', { trade: [] }, 'trade', 5), [],
  'authoritative empty domain produced targets');

// Every non-authoritative state withholds the claim, even with a populated map.
for (const state of ['idle', 'loading', 'stale', 'error', undefined]) {
  eq(select(state, populated, 'trade', 5), [],
    'non-authoritative state produced targets: ' + String(state));
}

// The selector and its caller do not mention brainCompanies.
const fnStart = src.indexOf('function _capTargetsForDomain');
const fnEnd = src.indexOf('\n  function ', fnStart + 10);
assert.ok(fnStart !== -1 && fnEnd > fnStart, '_capTargetsForDomain not found');
assert.ok(!/brainCompanies/.test(src.slice(fnStart, fnEnd)),
  'capital targets still fall back to brainCompanies');
assert.ok(!/brainCompanies/.test(src.slice(start, end)),
  'capital target selector references brainCompanies');

// The committed artifact is authoritative and empty, so no domain has targets.
const watchlist = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'data', 'kernel-watchlist.json'), 'utf8'));
assert.strictEqual(watchlist.authority.contract, 'thing1-validated-v1');
assert.strictEqual(watchlist.counts.surface, 0, 'committed watchlist still surfaces rows');
for (const domain of ['trade', 'medicine', 'energy', 'finance', 'supplyChain']) {
  eq(select('ready', {}, domain, 6), [],
    'committed empty watchlist produced a target in ' + domain);
}

console.log('capital conversion targets: authoritative empty yields 0; all non-authoritative states yield 0; populated control works');
