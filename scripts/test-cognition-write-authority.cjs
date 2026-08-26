'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const adapter = fs.readFileSync(path.join(root, 'assets/js/domain-brain-adapter.js'), 'utf8');
const harness = fs.readFileSync(path.join(root, 'scripts/run-brain-cognition.cjs'), 'utf8');
const handler = fs.readFileSync(path.join(root, 'handlers/brain-cognition.js'), 'utf8');

assert.equal(adapter.includes("fetch('/api/brain-cognition'"), false,
  'the public browser adapter must not write authoritative server cognition');
assert.equal(adapter.includes('x-brain-token'), false,
  'a public browser bundle must not carry a server cognition credential');
assert.equal(adapter.includes('limen-brain-209913'), false,
  'the retired cognition credential must not remain in the browser bundle');

assert.match(harness, /const TOKEN = process\.env\.BRAIN_COGNITION_TOKEN \|\| '';/,
  'the privileged harness may receive its credential only from the environment');
assert.match(harness, /if \(!TOKEN\) throw new Error\('BRAIN_COGNITION_TOKEN is required;/,
  'the privileged harness must fail closed before contacting production');
assert.equal(harness.includes('limen-brain-209913'), false,
  'the privileged harness must not contain a committed credential fallback');

assert.match(handler, /if \(!TOKEN \|\| tok !== TOKEN\)/,
  'the server cognition write boundary must remain token-gated and fail closed');

console.log('cognition write authority: public browser writes removed; privileged paths fail closed');
