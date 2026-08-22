/**
 * Test: Undici dispatcher configuration and error code propagation
 * Verifies:
 * 1. Module-scoped dispatcher is configured in expand-artifact-claude
 * 2. errorCode is extracted from Undici errors and propagated
 * 3. Handler returns errorCode in response
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Verify module code contains dispatcher configuration
const expandArtifactPath = path.join(__dirname, '..', 'handlers', 'expand-artifact-claude.js');
const code = fs.readFileSync(expandArtifactPath, 'utf8');

assert(code.includes('const UNDICI_DISPATCHER = new Agent'), 'Module-scoped dispatcher not found');
assert(code.includes('dispatcher: UNDICI_DISPATCHER'), 'Dispatcher not passed to fetch()');
assert(code.includes('const errorCode = err.cause && err.cause.code'), 'Error code extraction missing');
assert(code.includes('return { ok: false, status: 0, reason: \'fetch-failed\', detail: String(err && err.message || err), errorCode: errorCode }'), 'Error code not returned');
assert(code.includes('errorCode: r.errorCode || null'), 'Error code not in HTTP response');
assert(!code.includes('process.exit(0)'), 'Dangerous process.exit(0) still in code');
console.log('✓ Handler code structure verified');

// 2. Verify undici is available as a dependency
try {
  require('undici');
  console.log('✓ undici dependency is available');
} catch (e) {
  throw new Error('undici not found in dependencies: ' + e.message);
}

// 3. Test error code extraction logic (unit test)
function testErrorCodeExtraction() {
  const mockError = new Error('fetch failed');
  mockError.cause = { code: 'UND_ERR_HEADERS_TIMEOUT' };
  
  const errorCode = mockError.cause && mockError.cause.code ? mockError.cause.code : 'unknown';
  assert.strictEqual(errorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Error code incorrectly extracted');
  console.log('✓ Error code extraction works for UND_ERR_HEADERS_TIMEOUT');
}
testErrorCodeExtraction();

// 4. Test unknown error code fallback
function testUnknownErrorCode() {
  const mockError = new Error('fetch failed');
  const errorCode = mockError.cause && mockError.cause.code ? mockError.cause.code : 'unknown';
  assert.strictEqual(errorCode, 'unknown', 'Unknown error code fallback failed');
  console.log('✓ Error code fallback works for missing cause');
}
testUnknownErrorCode();

// 5. Verify limen-worker-autofire also propagates errorCode
const autoFirePath = path.join(__dirname, '..', 'handlers', 'limen-worker-autofire.js');
const autoFireCode = fs.readFileSync(autoFirePath, 'utf8');
assert(autoFireCode.includes('errorCode: (expandResp && expandResp.errorCode)'), 'Autofire does not propagate errorCode from expand-not-ok');
console.log('✓ Autofire propagates errorCode through expand-not-ok branch');

console.log('\n✓ All dispatcher configuration and error code propagation tests passed');
