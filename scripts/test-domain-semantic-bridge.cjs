'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('handlers/brain-cognition-refresh.js', 'utf8');

assert.match(source, /Promise\.all\(DOMAINS\.map\(async function \(domain\)/,
  'every product domain must read its own semantic source window');
assert.match(source, /domainSemantic\[domain\] = await readDomainSemanticEvidence\(domain\)/,
  'semantic evidence must remain keyed to the owning product domain');
assert.match(source, /var _semantic = domainSemantic\[dom\]/,
  'each packet must select the owning domain evidence');
assert.match(source, /_packetExtras\.semanticEvidence = _semantic && _semantic\.observations/,
  'each packet must carry its own source-preserved observations');
assert.doesNotMatch(source, /_packetExtras\.semanticEvidence = financeSemantic\./,
  'the packet bridge must never regress to Finance-only semantic transport');

console.log('all-domain semantic bridge wiring passed');
