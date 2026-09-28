#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const digest = JSON.parse(fs.readFileSync('assets/data/deep/finance-diagnosis-digest.json', 'utf8'));
const index = JSON.parse(fs.readFileSync('assets/data/opportunities-index.json', 'utf8'));

const digestTuples = new Set();
for (const d of digest.diagnoses || []) {
  for (const t of d.tx || []) {
    const identity = t && (t.l || t.label || t.t);
    if (identity) digestTuples.add(['finance', d.id, identity].join('\u0000'));
  }
}

const indexedTuples = new Set();
const indexedSyn = [];
for (const o of index.opportunities || []) {
  if (o.d !== 'finance') continue;
  for (const x of o.tx || []) {
    const identity = x && (x.l || x);
    indexedTuples.add(['finance', o.id, identity].join('\u0000'));
    indexedSyn.push(x.s);
  }
}

assert.equal(digestTuples.size, 1080, 'finance digest must carry 1,080 selected treatment identities');
assert.equal(indexedTuples.size, digestTuples.size, 'opportunity index must expose every selected finance treatment identity');
for (const tuple of digestTuples) assert(indexedTuples.has(tuple), 'missing indexed tuple: ' + tuple.replace(/\u0000/g, ' | '));

// Per-record provenance must survive the index (review: bare labels made
// scaffold indistinguishable from verified-eligible)
assert.ok(indexedSyn.every(s => s === 0 || s === 1 || s === 2), 'every indexed record carries a syn state');
const digestSyn = [];
for (const d of digest.diagnoses || []) for (const t of d.tx || []) digestSyn.push(t.syn);
const count = a => a.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});
assert.deepEqual(count(indexedSyn), count(digestSyn), 'index provenance counts must match the digest exactly');

console.log('finance opportunity identity coverage: ' + indexedTuples.size + '/' + digestTuples.size + ' reachable: PASS');
