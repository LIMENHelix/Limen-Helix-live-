'use strict';
var assert = require('assert');
var RES = require('../lib/primary-source-resolution.js');

var good = RES.normalizeCrossref(
  { domain: 'science', identifierType: 'DOI', identifier: '10.1234/example', sourceFiles: ['a.json', 'b.json'], portalTargets: ['a', 'b'] },
  { statusCode: 200, payload: { message: { DOI: '10.1234/example', title: ['A study'], publisher: 'Example Press', type: 'journal-article', issued: { 'date-parts': [[2020]] }, URL: 'https://doi.org/10.1234/example' } } },
  '2026-08-23T00:00:00.000Z'
);
assert.strictEqual(good.status, 'RESOLVED_METADATA_ONLY');
assert.strictEqual(good.evidenceEligible, false);
assert.strictEqual(good.consumedByRuntime, false);
assert.strictEqual(good.title, 'A study');
assert.strictEqual(good.registry, 'Crossref');
assert.strictEqual(good.reuseClass, 'REUSED_PORTAL_TEMPLATE_REFERENCE');
assert.strictEqual(good.portalTargets.length, 2);

var bad = RES.normalizeCrossref(
  { domain: 'finance', identifierType: 'DOI', identifier: '10.1234/missing' },
  { statusCode: 404, payload: { message: 'not found' } },
  '2026-08-23T00:00:00.000Z'
);
assert.strictEqual(bad.status, 'UNRESOLVED');
assert.strictEqual(bad.evidenceEligible, false);
assert.strictEqual(bad.consumedByRuntime, false);
assert.strictEqual(bad.httpStatus, 404);

RES.resolveQueue({ tasks: [{ domain: 'science', identifierType: 'DOI', identifier: '10.1234/example', portalTargets: ['one'] }] }, async function () {
  return { statusCode: 200, payload: { message: { DOI: '10.1234/example', title: ['A study'] } } };
}, function () { return '2026-08-23T00:00:00.000Z'; }).then(function (rows) {
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'RESOLVED_METADATA_ONLY');
  console.log('10/10 passed');
}).catch(function (err) { console.error(err.stack || err.message); process.exitCode = 1; });
