'use strict';

var assert = require('node:assert/strict');
var Digest = require('../lib/digest.js');
var Contracts = require('../lib/domain-commercial-contracts.js');

function store(value) {
  return {
    assertDurable: function () {},
    get: async function (key) { return key === Contracts.get('culture').artifactStateKey ? value : null; }
  };
}

(async function () {
  var now = Date.now();
  var artifact = {
    schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'dca_digest',
    status: 'ARTIFACT_PREPARED', productDomain: 'culture', ownerDomain: 'culture',
    subject: 'Culture signal brief', body: 'Current source-linked Culture artifact.',
    contentHash: 'sha256-culture-artifact', freshnessExpiresAt: now + 60000,
    externalEffectAuthorized: false
  };
  assert.equal((await Digest.latestCommercialArtifact('culture', store(artifact), now)).artifactId, 'dca_digest');
  var built = await Digest.buildFor({ domain: 'culture', offer: 'p2', active: true }, { store: store(artifact), now: now });
  assert.match(built.body, /Current source-linked Culture artifact/);
  assert.equal(built.key, artifact.contentHash);
  assert.equal(built.personal, false);
  assert.equal(await Digest.latestCommercialArtifact('culture', store(Object.assign({}, artifact,
    { freshnessExpiresAt: now })), now), null);
  assert.equal(await Digest.latestCommercialArtifact('culture', store(Object.assign({}, artifact,
    { productDomain: 'finance' })), now), null);
  console.log('domain commercial digest: exact-domain fresh artifact feeds paid domain-wide fulfillment PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
