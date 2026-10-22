#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const ROOT = path.join(__dirname, '..');
  const { sense, countPathCOverCap } = await import('./sense/organ-propagator.mjs');
  const result = sense();

  /* The committed feed intentionally preserves null path/composite values when
     Thing One is not validated. Path-C over-cap evidence is therefore absent,
     not silently qualified. */
  assert.strictEqual(result.metrics.pathCCount, 0,
    'migrated feed must not report path-C over-cap rows');
  assert.ok(!result.attention.some((item) => /path-C/.test(item.issue)),
    'migrated feed must not emit a path-C over-cap finding');

  /* Positive control: the production formula must still count a portal-backed
     Path-C row whose raw stress exceeds the cap. No old scores are restored. */
  const manifestIndex = { fixture: { cik: '728535' } };
  const fixtureRows = [
    { c: '728535', t: 'JBHT', path: 'C', co: 10, a: false },
    { c: '728535', t: 'JBHT', path: 'C', co: 5, a: false },
    { c: '728535', t: 'JBHT', path: 'C', co: 3, a: false },
    { c: '999999', t: 'OTHER', path: 'C', co: 99, a: false },
    { c: '728535', t: 'JBHT', path: 'B', co: 99, a: false },
    { c: '728535', t: 'JBHT', path: 'C', co: 3, a: true }
  ];
  assert.strictEqual(countPathCOverCap(fixtureRows, manifestIndex, 5, 2), 2,
    'production path-C formula must count only portal-backed over-cap rows');

  const propagatorSource = fs.readFileSync(
    path.join(ROOT, 'scripts', 'sense', 'organ-propagator.mjs'), 'utf8');
  const pathCFinding = propagatorSource.match(
    /\{[^}]*issue: '([^']*path-C[^']*)'[^}]*action: '([^']*)'[^}]*\}/);
  assert.ok(pathCFinding, 'path-C finding construction not found');
  assert.match(pathCFinding[1], /cap remains enforced/,
    'finding must state the input cap remains enforced');
  assert.doesNotMatch(pathCFinding[1], /unbounded/i,
    'finding must not describe propagator output as unbounded');
  assert.match(pathCFinding[2], /bounded at intrinsicPropagationCap/,
    'finding must state propagation is bounded at the cap');
  assert.doesNotMatch(pathCFinding[2], /unbounded/i,
    'finding action must not describe propagator output as unbounded');

  const refs = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'operator-references.json'), 'utf8'));
  const hunt = refs.companies.find((row) => String(row.cik).replace(/^0+/, '') === '728535');
  assert.deepStrictEqual(
    { ticker: hunt?.ticker, name: hunt?.name },
    { ticker: 'JBHT', name: 'J.B. Hunt' },
    'CIK 728535 must not inherit adjacent XPO identity'
  );

  const cb = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'command-board-data.json'), 'utf8'));
  const cbHunt = cb.companies.find((row) => String(row.c).replace(/^0+/, '') === '728535');
  assert.deepStrictEqual(
    { ticker: cbHunt?.t, name: cbHunt?.n, slug: cbHunt?.s },
    { ticker: 'JBHT', name: 'J.B. Hunt', slug: 'jb_hunt' }
  );

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-opref-boundary-'));
  try {
    fs.mkdirSync(path.join(fixtureRoot, 'assets', 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, 'trade-opportunities.html'),
      "<script>var rows=[{ticker:'XPO',name:'XPO'},{ticker:'JBHT',name:'J.B. Hunt',cik:'728535'}];</script>"
    );
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'extract-operator-ciks.js')], {
      env: { ...process.env, OPERATOR_REFS_ROOT: fixtureRoot },
      stdio: 'pipe'
    });
    const fixtureRefs = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'assets', 'data', 'operator-references.json'), 'utf8'));
    assert.deepStrictEqual(
      fixtureRefs.companies.map((row) => ({ ticker: row.ticker, name: row.name, cik: row.cik })),
      [{ ticker: 'JBHT', name: 'J.B. Hunt', cik: '728535' }],
      'extractor must not pair XPO identity with the following object CIK'
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  console.log('propagator path-C audit: 7/7 assertions passed');
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
