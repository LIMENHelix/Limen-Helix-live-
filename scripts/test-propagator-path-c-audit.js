#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const ROOT = path.join(__dirname, '..');
  const { sense } = await import('./sense/organ-propagator.mjs');
  const result = sense();
  const finding = result.attention.find((item) => /path-C/.test(item.issue));

  assert.ok(finding, 'path-C over-cap finding must remain visible');
  assert.strictEqual(finding.count, 8, 'current portal-backed path-C over-cap count');
  assert.match(finding.issue, /input cap \(cap remains enforced\)/, 'finding must state propagation is bounded');
  assert.doesNotMatch(finding.issue, /unbounded propagator|propagator output \(unbounded/i);

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
