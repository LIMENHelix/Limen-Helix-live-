'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.resolve(__dirname, '..', 'finance-preview.html'), 'utf8');

assert.match(page, /id="decision"/,
  'the authenticated Finance page must expose a downstream decision receipt surface');
assert.match(page, /fetch\('\/api\/finance-trade-decision\?packetId='/,
  'the decision surface must read the packet-keyed trade-decision endpoint');
assert.match(page, /fetch\('\/api\/finance-preview', \{method:\s*'POST'/,
  'the existing explicit Preview action remains the only POST on the page');
assert.equal((page.match(/fetch\('\/api\/finance-trade-decision/g) || []).length, 1,
  'the downstream decision endpoint must be called once and read-only');
assert.doesNotMatch(page, /fetch\('\/api\/finance-trade-decision[^\n]*method\s*:/,
  'the downstream decision audit must not specify a mutating method');
assert.match(page, /cannot call a provider, admit a candidate, preview an order, or touch a broker/,
  'the negative scope of the read-only surface must be explicit');

console.log('finance preview decision audit: packet-keyed downstream receipt is read-only');
