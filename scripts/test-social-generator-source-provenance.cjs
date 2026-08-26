#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var toolPath = require.resolve('../lib/tool-fetch.js');
var generatorPath = require.resolve('../lib/social-generator.js');

var body = { ok: true, spentPerDollar: 1.25, interestShareOfReceipts: 0.17 };
require.cache[toolPath] = { id: toolPath, filename: toolPath, loaded: true, exports: {
  getJSON: async function (url) {
    assert.equal(url, 'https://limenhelix.com/api/economy-tools');
    return { status: 200, body: JSON.parse(JSON.stringify(body)) };
  }
} };
delete require.cache[generatorPath];
var Generator = require(generatorPath);

(async function () {
  var post = await Generator.generate({ domain: 'economy' });
  assert.equal(post.domain, 'economy');
  assert.equal(post.sourceIdentity.kind, 'limen-live-tool-response');
  assert.equal(post.sourceIdentity.subjectDomain, 'economy');
  assert.equal(post.sourceIdentity.value, 'https://limenhelix.com/api/economy-tools');
  assert.equal(post.sourceIdentity.responseHash,
    crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  assert(Number.isFinite(Date.parse(post.sourceIdentity.retrievedAt)));
  assert(post.text.includes('https://limenhelix.com/economy'));
  console.log('social generator provenance: exact live endpoint, response hash, subject identity, retrieval time, and verification link passed');
})().catch(function (error) { console.error(error); process.exit(1); });
