'use strict';

/**
 * Route test for handlers/commission-subscriber-lane.js: the server-side
 * one-shot commissioning entry point. Asserts fail-closed auth, the consent
 * attestation requirement, the missing-address 503, dry-run vs live delegation,
 * and — the security pin — that the commissioning ADDRESS never appears in any
 * response shape, while the run delegate always receives the env address.
 */
var assert = require('node:assert/strict');
var Handler = require('../handlers/commission-subscriber-lane.js');

var ADDRESS = 'ops-canary@limenhelix.example';
var ENV = {
  ADMIN_MASTER: 'master-CANARY',
  INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL: ADDRESS
};

function req(method, key, body) {
  return {
    method: method,
    url: '/api/commission-subscriber-lane' + (key ? '?key=' + key : ''),
    headers: {},
    body: body
  };
}

function res() {
  return {
    statusCode: 0, bodyText: '',
    setHeader: function () {},
    end: function (t) { this.bodyText = t || ''; },
    json: function () { return JSON.parse(this.bodyText); }
  };
}

function gateOk() {
  return {
    reqKey: function (r) { return new URL(r.url, 'http://x').searchParams.get('key') || ''; },
    isMaster: function (k) { return k === ENV.ADMIN_MASTER; },
    deny: function (r) { r.statusCode = 403; r.end(JSON.stringify({ ok: false, error: 'Admin-only endpoint. Sign in.' })); }
  };
}

async function call(handler, request) {
  var response = res();
  await handler(request, response);
  return response;
}

(async function () {
  // 1. GET refused.
  var h = Handler.createHandler({ env: ENV, gate: gateOk(), run: async function () { throw new Error('must not run'); } });
  var r = await call(h, req('GET', ENV.ADMIN_MASTER, {}));
  assert.equal(r.statusCode, 405);

  // 2. No key / wrong key → 403, run never invoked.
  r = await call(h, req('POST', null, { consent: true }));
  assert.equal(r.statusCode, 403);
  r = await call(h, req('POST', 'wrong', { consent: true }));
  assert.equal(r.statusCode, 403);

  // 3. Master key without consent attestation → 400 refusal, no provider.
  r = await call(h, req('POST', ENV.ADMIN_MASTER, {}));
  assert.equal(r.statusCode, 400);
  assert.equal(r.json().reason, 'COMMISSIONING_CONTEST_ATTESTATION_REQUIRED');
  assert.equal(r.json().providerCalled, false);

  // 4. Address not configured → 503 naming the env var, address flag false.
  var hNoAddr = Handler.createHandler({ env: { ADMIN_MASTER: ENV.ADMIN_MASTER }, gate: gateOk(), run: async function () { throw new Error('must not run'); } });
  r = await call(hNoAddr, req('POST', ENV.ADMIN_MASTER, { consent: true }));
  assert.equal(r.statusCode, 503);
  assert.equal(r.json().addressConfigured, false);

  // 5. Live delegation: run receives the ENV address + consent + live:true;
  //    the response proves the address is redacted.
  var seen = null;
  var hLive = Handler.createHandler({
    env: ENV, gate: gateOk(),
    run: async function (options) {
      seen = options;
      return { ok: true, status: 'VERIFIED', mode: 'live', address: options.address,
        projection: { verified: 19, total: 19 }, providerSendAttempted: true, liveMoney: false };
    }
  });
  r = await call(hLive, req('POST', ENV.ADMIN_MASTER, { consent: true }));
  assert.equal(r.statusCode, 200);
  assert.equal(seen.address, ADDRESS, 'delegate gets the server-side env address');
  assert.equal(seen.live, true);
  assert.equal(seen.consent, true);
  var body = r.json();
  assert.equal(body.ok, true);
  assert.equal(body.addressConfigured, true);
  assert.equal(body.address, undefined, 'address never in the response');
  assert.ok(r.bodyText.indexOf(ADDRESS) === -1, 'address string nowhere in the raw response');

  // 6. Dry-run delegation: live:false, in-memory store, same redaction.
  seen = null;
  r = await call(hLive, req('POST', ENV.ADMIN_MASTER, { consent: true, dryRun: true }));
  assert.equal(r.statusCode, 200);
  assert.equal(seen.live, false);
  assert.ok(r.bodyText.indexOf(ADDRESS) === -1);

  // 7. Thrown preflight refusal: structured report returned, provider never called,
  //    address still redacted even if the error report carried it.
  var hRefused = Handler.createHandler({
    env: ENV, gate: gateOk(),
    run: async function () {
      var e = new Error('COMMISSIONING_SPEND_ABOVE_CAPABILITY_BOUND');
      e.report = { ok: false, status: 'REFUSED', reason: e.message, address: ADDRESS, providerCalled: false, liveMoney: false };
      throw e;
    }
  });
  r = await call(hRefused, req('POST', ENV.ADMIN_MASTER, { consent: true }));
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().ok, false);
  assert.equal(r.json().reason, 'COMMISSIONING_SPEND_ABOVE_CAPABILITY_BOUND');
  assert.equal(r.json().providerCalled, false);
  assert.ok(r.bodyText.indexOf(ADDRESS) === -1, 'address redacted even from error reports');

  // 8. Unstructured throw → clean refusal, no internals leaked.
  var hBoom = Handler.createHandler({
    env: ENV, gate: gateOk(),
    run: async function () { throw new Error('kaboom ' + ADDRESS); }
  });
  r = await call(hBoom, req('POST', ENV.ADMIN_MASTER, { consent: true }));
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().ok, false);
  assert.ok(r.bodyText.indexOf(ADDRESS) === -1);

  console.log('commission-subscriber-lane route: fail-closed auth, consent attestation, env-side address, total redaction: PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
