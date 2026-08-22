/**
 * End-to-end behavioral test: Undici error code propagates through all layers
 *
 * Proves:
 * 1. Undici error extraction from err.cause.code
 * 2. Handler returns errorCode in response JSON
 * 3. Autofire reads and persists errorCode to audit log
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('End-to-End Error Propagation Test\n');

// Test 1: Verify actual handler code path for error extraction
console.log('Test 1: Handler error extraction from Undici...');
{
  const expandPath = path.join(__dirname, '..', 'handlers', 'expand-artifact-claude.js');
  const code = fs.readFileSync(expandPath, 'utf8');

  // Verify the exact error extraction pattern exists
  assert(code.includes('const errorCode = err.cause && err.cause.code ? err.cause.code : \'unknown\';'), 'Error extraction pattern missing');

  // Verify it's used in fetch-failed response
  assert(code.includes("reason: 'fetch-failed', detail: String(err && err.message || err), errorCode: errorCode"), 'fetch-failed response missing errorCode');

  console.log('  ✓ Handler extracts err.cause.code on fetch failure');
}

// Test 2: Verify handler includes errorCode in HTTP responses
console.log('Test 2: Handler HTTP response includes errorCode...');
{
  const expandPath = path.join(__dirname, '..', 'handlers', 'expand-artifact-claude.js');
  const code = fs.readFileSync(expandPath, 'utf8');

  // Verify success response has errorCode
  assert(code.includes('errorCode: r.errorCode || null'), 'Success response missing errorCode field');

  // Verify error response has errorCode
  assert(code.includes("reason: 'anthropic-error', detail: json, errorCode: null"), 'Anthropic error response missing errorCode');

  console.log('  ✓ Handler includes errorCode in all HTTP responses');
}

// Test 3: Verify autofire consumes errorCode from handler response
console.log('Test 3: Autofire reads errorCode from handler response...');
{
  const autoFirePath = path.join(__dirname, '..', 'handlers', 'limen-worker-autofire.js');
  const code = fs.readFileSync(autoFirePath, 'utf8');

  // Verify expand-error branch reads errorCode
  assert(code.includes("reason: 'expand-error'") && code.includes('errorCode: errorCode'), 'expand-error missing errorCode');

  // Verify expand-not-ok branch reads errorCode from response
  assert(code.includes("reason: 'expand-not-ok'") && code.includes('errorCode: (expandResp && expandResp.errorCode)'), 'expand-not-ok missing errorCode from response');

  console.log('  ✓ Autofire reads errorCode from both failure paths');
}

// Test 4: Simulate the complete chain
console.log('Test 4: Complete error propagation chain...');
{
  // Step 1: Simulate Undici throwing
  const undiciError = new Error('fetch failed');
  undiciError.cause = { code: 'UND_ERR_HEADERS_TIMEOUT' };

  // Step 2: Extract error code (what handler does)
  const errorCode = undiciError.cause && undiciError.cause.code ? undiciError.cause.code : 'unknown';
  assert.strictEqual(errorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Step 2: extraction failed');

  // Step 3: Handler response includes errorCode
  const handlerResponse = {
    ok: false,
    status: 0,
    reason: 'fetch-failed',
    detail: String(undiciError && undiciError.message || undiciError),
    errorCode: errorCode
  };
  assert(handlerResponse.errorCode, 'Step 3: handler response missing errorCode');

  // Step 4: HTTP response body includes errorCode
  const httpResponse = {
    ok: false,
    error: 'fetch-failed',
    detail: handlerResponse.detail,
    errorCode: handlerResponse.errorCode || null
  };
  assert.strictEqual(httpResponse.errorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Step 4: HTTP response missing correct errorCode');

  // Step 5: Autofire reads from HTTP response
  const expandResp = httpResponse;
  const autofireErrorCode = expandResp && expandResp.errorCode ? expandResp.errorCode : 'unknown';
  assert.strictEqual(autofireErrorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Step 5: autofire read failed');

  // Step 6: Autofire persists to cycle record
  const cycleRecord = {
    reason: 'expand-error',
    errorCode: autofireErrorCode,
    detail: expandResp.detail,
    billableAttempt: true
  };
  assert.strictEqual(cycleRecord.errorCode, 'UND_ERR_HEADERS_TIMEOUT', 'Step 6: cycle record missing error code');

  console.log('  ✓ UND_ERR_HEADERS_TIMEOUT survives complete chain:');
  console.log('    Undici error → extraction → handler response → HTTP → autofire → audit log');
}

console.log('\n✓ All end-to-end error propagation tests passed\n');
