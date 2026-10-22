#!/usr/bin/env node
'use strict';

/**
 * test-kernel-watchlist-authority.js — stale watchlists must not surface claims.
 *
 * The committed watchlist is produced from command-board-eligible.json, which
 * currently has zero validated Thing One rows. Its producer stamps an authority
 * contract and the source feed hash. The browser consumer refuses any artifact
 * without the contract, so a pre-gate watchlist cannot keep publishing
 * validated, bankruptcy-watch or investment-primed names.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const consumer = fs.readFileSync(
  path.join(ROOT, 'assets', 'js', 'ui', 'console-clarity.js'), 'utf8');

const start = consumer.indexOf('function _watchlistAuthorityOk');
const end = consumer.indexOf('// ── end _watchlistAuthorityOk ──', start);
assert.ok(start !== -1 && end > start, 'watchlist authority predicate not found');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(consumer.slice(start, end) +
  '\nthis._watchlistAuthorityOk = _watchlistAuthorityOk;', sandbox);

const ok = sandbox._watchlistAuthorityOk;
assert.strictEqual(typeof ok, 'function', 'predicate did not load');

// Contract checks.
assert.strictEqual(ok({ authority: {
  contract: 'thing1-validated-v1',
  kernelId: 'limen_backtest.py',
  source: 'assets/data/command-board-eligible.json'
} }), true, 'current authority was rejected');
assert.strictEqual(ok(null), false, 'missing artifact was accepted');
assert.strictEqual(ok({}), false, 'artifact without authority was accepted');
assert.strictEqual(ok({ authority: { contract: 'legacy', kernelId: 'limen_backtest.py',
  source: 'assets/data/command-board-eligible.json' } }), false,
'wrong contract was accepted');
assert.strictEqual(ok({ authority: { contract: 'thing1-validated-v1', kernelId: 'phase_engine.py',
  source: 'assets/data/command-board-eligible.json' } }), false,
'wrong kernel was accepted');
assert.strictEqual(ok({ authority: { contract: 'thing1-validated-v1', kernelId: 'limen_backtest.py',
  source: 'assets/data/command-board-data.json' } }), false,
'wrong source feed was accepted');

// A stale pre-gate artifact with claims is refused.
const staleClaims = {
  generatedAt: '2026-09-01T00:00:00.000Z',
  counts: { validatedEnvelope: 301, bankruptcyWatch: 34, investmentPrimed: 3 },
  bankruptcyWatch: [{ ticker: 'OLD' }],
  investmentPrimed: [{ ticker: 'OLD2' }]
};
assert.strictEqual(ok(staleClaims), false, 'stale pre-gate claims were accepted');

// The committed artifact carries the current contract and no claims.
const watchlistPath = path.join(ROOT, 'assets', 'data', 'kernel-watchlist.json');
const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
assert.strictEqual(ok(watchlist), true, 'committed watchlist lacks the authority contract');
assert.strictEqual(watchlist.counts.validatedEnvelope, 0,
  'watchlist still claims a validated envelope');
assert.deepStrictEqual(watchlist.bankruptcyWatch, [],
  'watchlist still publishes bankruptcy watches');
assert.deepStrictEqual(watchlist.investmentPrimed, [],
  'watchlist still publishes investment-primed names');
assert.strictEqual(watchlist.counts.surface, 0, 'watchlist still surfaces rows');

const eligiblePath = path.join(ROOT, 'assets', 'data', 'command-board-eligible.json');
const eligibleHash = crypto.createHash('sha256')
  .update(fs.readFileSync(eligiblePath)).digest('hex');
assert.strictEqual(watchlist.authority.sourceSha256, eligibleHash,
  'watchlist source hash does not match the committed eligible feed');

// ── Version-skew fixtures: protected identity is required ─────────────────
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-watchlist-'));
try {
  const base = {
    n: 'Issuer', t: 'GOOD', c: '42', s: 'good', d: 'trade',
    sic: '3714', p: 'p7', co: 0.5, a: true, tr: 'RUPTURE'
  };
  const fixture = {
    _generated: 'fixture',
    companies: [
      Object.assign({}, base, { kid: 'limen_backtest.py', vs: 'validated' }),
      Object.assign({}, base, { n: 'Missing id', t: 'MISS', c: '43', vs: 'validated' }),
      Object.assign({}, base, { n: 'Blank id', t: 'BLNK', c: '44', kid: '   ', vs: 'validated' }),
      Object.assign({}, base, { n: 'Wrong id', t: 'WRNG', c: '45', kid: 'phase_engine.py', vs: 'validated' }),
      Object.assign({}, base, { n: 'Unvalidated', t: 'UNVL', c: '46', kid: 'limen_backtest.py', vs: 'unvalidated_after_modification' })
    ]
  };
  const input = path.join(dir, 'eligible.json');
  const output = path.join(dir, 'watchlist.json');
  fs.writeFileSync(input, JSON.stringify(fixture));
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-kernel-watchlist.mjs')], {
    env: Object.assign({}, process.env, {
      KERNEL_WATCHLIST_INPUT: input,
      KERNEL_WATCHLIST_OUT: output
    }),
    encoding: 'utf8'
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
  const built = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.strictEqual(built.counts.universe, 5);
  assert.strictEqual(built.counts.validatedEnvelope, 1,
    'a validated row without the protected scorer identity counted');
  assert.deepStrictEqual(built.bankruptcyWatch.map((r) => r.ticker), ['GOOD'],
    'watchlist surfaced an identity-less validated row');
  assert.deepStrictEqual(built.investmentPrimed, []);
  assert.strictEqual(built.authority.kernelId, 'limen_backtest.py');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('kernel watchlist authority: 0 validated, 0 bankruptcy, 0 primed, source hash current, version-skew rejected');
