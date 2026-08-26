#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/research-paper-developmental-status.js');
var Developmental = require('../lib/research-paper-developmental-authority.js');

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader: function (name, value) { this.headers[name] = value; },
    end: function (body) { this.body = JSON.parse(body); }
  };
}
async function invoke(handler, method) {
  var res = response();
  await handler({ method: method, url: '/api/research-paper-developmental-status' }, res);
  return res;
}
function record(domain) {
  var identity = Developmental.OWNERS[domain];
  return {
    schemaVersion: Developmental.SCHEMA,
    receiptId: 'secret-receipt',
    productDomain: domain,
    ownerDomain: identity.ownerDomain,
    contractId: identity.contractId,
    lane: identity.lane,
    budgetId: identity.budgetId,
    selectionId: 'secret-selection',
    sourceIdentity: { kind: 'secret', value: 'secret-source' },
    productMotorReceiptId: 'secret-motor',
    status: 'ARTIFACT_PERSISTED',
    claimedAt: '2026-08-25T20:00:00.000Z',
    resolvedAt: '2026-08-25T20:00:10.000Z',
    providerCalled: true,
    outputId: 'eo_' + domain + '_1',
    budgetDebitEstimateUsd: 0.30,
    artifactGenerationOnly: true,
    publicationAuthorized: false,
    saleAuthorized: false,
    externalPublication: false,
    paperOnly: true,
    liveMoney: false
  };
}

(async function () {
  var reads = 0, writes = 0;
  var values = new Map();
  values.set(Developmental.slotKey('science'), record('science'));
  var store = {
    assertDurable: function () { return true; },
    get: async function (key) { reads++; return values.get(key) || null; },
    set: async function () { writes++; }
  };
  var handler = Handler.createHandler({ store: store });
  var res = await invoke(handler, 'GET');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.domains.length, 2);
  assert.equal(res.body.domains[0].productDomain, 'science');
  assert.equal(res.body.domains[0].status, 'ARTIFACT_PERSISTED');
  assert.equal(res.body.domains[0].viewerUrl, 'https://limenhelix.com/helix-artifact?id=eo_science_1');
  assert.equal(res.body.domains[0].publicationAuthorized, false);
  assert.equal(res.body.domains[0].externalPublication, false);
  assert.equal(res.body.domains[1].productDomain, 'medicine');
  assert.equal(res.body.domains[1].status, 'NOT_CLAIMED');
  assert.equal(reads, 2);
  assert.equal(writes, 0);
  ['receiptId', 'selectionId', 'sourceIdentity', 'productMotorReceiptId', 'contractId', 'budgetId'].forEach(function (name) {
    assert.equal(Object.prototype.hasOwnProperty.call(res.body.domains[0], name), false);
  });

  var post = await invoke(handler, 'POST');
  assert.equal(post.statusCode, 405);
  assert.equal(reads, 2);
  assert.equal(writes, 0);

  values.set(Developmental.slotKey('science'), Object.assign(record('science'), { publicationAuthorized: true }));
  var malformed = await invoke(handler, 'GET');
  assert.equal(malformed.statusCode, 503);
  assert.equal(malformed.body.error, 'research-paper-developmental-status-unavailable');
  assert.equal(writes, 0);

  var unavailable = Handler.createHandler({
    store: { assertDurable: function () { throw new Error('Redis unavailable'); } }
  });
  var failed = await invoke(unavailable, 'GET');
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.liveMoney, false);

  console.log('research developmental status: public sanitized read-only Science/Medicine audit passed');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
