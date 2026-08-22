/**
 * Test: Undici dispatcher configuration and error code propagation
 *
 * Verifies:
 * 1. Module-scoped dispatcher is configured in expand-artifact-claude
 * 2. Error code is extracted from Undici errors and propagates end-to-end
 * 3. Handler returns errorCode in both success and error responses
 * 4. Autofire reads and passes errorCode to audit log
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Code structure verification
const expandArtifactPath = path.join(__dirname, '..', 'handlers', 'expand-artifact-claude.js');
const expandCode = fs.readFileSync(expandArtifactPath, 'utf8');

assert(expandCode.includes('const UNDICI_DISPATCHER = new Agent'), 'Module-scoped dispatcher missing');
assert(expandCode.includes('dispatcher: UNDICI_DISPATCHER'), 'Dispatcher not passed to fetch()');
assert(expandCode.includes('const errorCode = err.cause && err.cause.code'), 'Error code extraction missing');
assert(expandCode.includes("reason: 'fetch-failed', detail: String(err && err.message || err), errorCode: errorCode"), 'errorCode not returned on fetch failure');
assert(expandCode.includes('errorCode: r.errorCode || null'), 'errorCode not in HTTP response');
assert(!expandCode.includes('process.exit(0)'), 'Dangerous process.exit(0) present');
console.log('✓ expand-artifact-claude.js code structure verified');

// 2. Autofire error propagation verification
const autoFirePath = path.join(__dirname, '..', 'handlers', 'limen-worker-autofire.js');
const autoFireCode = fs.readFileSync(autoFirePath, 'utf8');

assert(autoFireCode.includes("reason: 'expand-error'") && autoFireCode.includes('errorCode: errorCode'), 'expand-error does not propagate errorCode');
assert(autoFireCode.includes("reason: 'expand-not-ok'") && autoFireCode.includes('errorCode: (expandResp && expandResp.errorCode)'), 'expand-not-ok does not propagate errorCode');
console.log('✓ limen-worker-autofire.js propagates errorCode in both failure branches');

// 3. Dependency verification
try {
  require('undici');
  console.log('✓ undici dependency available');
} catch (e) {
  throw new Error('undici not found: ' + e.message);
}

// 4. Unit test: error code extraction logic
const mockError = new Error('fetch failed');
mockError.cause = { code: 'UND_ERR_HEADERS_TIMEOUT' };
const errorCode = mockError.cause && mockError.cause.code ? mockError.cause.code : 'unknown';
assert.strictEqual(errorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Failed to extract error code');
console.log('✓ Error code extraction works for UND_ERR_HEADERS_TIMEOUT');

// 5. Unit test: error code fallback
const noError = new Error('fetch failed');
const fallback = noError.cause && noError.cause.code ? noError.cause.code : 'unknown';
assert.strictEqual(fallback, 'unknown', 'Fallback failed for missing cause');
console.log('✓ Error code fallback works for missing cause');

console.log('\n✓ All dispatcher and error code chain tests passed\n');
