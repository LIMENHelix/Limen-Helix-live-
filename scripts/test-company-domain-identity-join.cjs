'use strict';

const assert = require('assert');
const path = require('path');
const { loadDefault, canonicalDomain, normalizeCik, buildJoin } = require('../lib/company-domain-identity-join.js');

const root = path.resolve(__dirname, '..');
const join = loadDefault(root);
let passed = 0;
function ok(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log('PASS', name);
}

ok('domain aliases are explicit', canonicalDomain('health') === 'medicine' && canonicalDomain('supplyChain') === 'trade');
ok('CIK normalization preserves identity while removing padding', normalizeCik('0000019617') === '19617');
ok('join has unique company keys', new Set(join.rows.map((r) => r.companyKey)).size === join.rows.length);
ok('join reports the three source families', join.sourcePrecedence.length === 3);
ok('Citigroup joins registry, identity, and command board', (() => {
  const r = join.rows.find((x) => x.slug === 'citigroup');
  return r && r.cik === '831001' && r.sources.includes('companyRegistry') && r.sources.includes('identityFile') && r.sources.includes('commandBoard') && r.status === 'joined' && r.canonicalDomains.includes('finance');
})());
ok('command-board alias normalizes supplyChain to trade', (() => {
  const r = join.rows.find((x) => x.slug === 'amazon_logistics' || x.ticker === 'AMZN');
  return !r || r.canonicalDomains.includes('trade');
})());
ok('missing registry identity remains visible as a status', join.rows.some((r) => r.slug === 'shift4_payments' && r.status === 'registry_missing_identity' && r.issues.includes('identity_slug_differs')));
ok('expanded identity-only corpus remains separate', join.rows.some((r) => r.status === 'expanded_identity_only'));
ok('a row without CIK is explicitly flagged', join.rows.some((r) => r.issues.includes('no_cik')));

const fixture = buildJoin({
  companyRegistry: {
    bySlug: { acme: '0001' },
    byCik: { '0001': { slug: 'acme', name: 'Acme', ticker: 'ACM', domain: 'health' } }
  },
  identityFiles: { acme: { type: 'company', slug: 'acme', name: 'Acme', ticker: 'ACM', cik: '1', domainId: 'medicine' } },
  commandBoard: [{ s: 'acme', n: 'Acme', t: 'ACM', c: '1', d: 'medicine' }]
});
ok('alias-equivalent source domains do not conflict', fixture.rows[0].status === 'joined' && fixture.summary.rows === 1);

console.log(`${passed}/${passed} passed`);
