'use strict';

var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var realFetch = global.fetch;
var realKey = process.env.BLS_API_KEY;
var calls = 0;
var bodies = [];

function response(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}

function successBody() {
  // Deliberately not requested-domain order: adapters must bind by publisher seriesID.
  return { status: 'REQUEST_SUCCEEDED', Results: { series: [
    { seriesID: 'PCUOMFG--OMFG--', data: [{ year: '2026', period: 'M07', value: '143.5' }] },
    { seriesID: 'CES0000000001', data: [{ year: '2026', period: 'M07', value: '159500' }] },
    { seriesID: 'PCU484121484121', data: [{ year: '2026', period: 'M07', value: '132.4' }] }
  ] } };
}

(async function () {
  try {
    process.env.BLS_API_KEY = 'test-secret-registration-key';
    H._resetBLSRequestState();
    global.fetch = function (url, opts) {
      calls++;
      bodies.push(JSON.parse(opts.body));
      assert.equal(url, 'https://api.bls.gov/publicAPI/v2/timeseries/data/');
      return Promise.resolve(response(successBody()));
    };

    var readings = await Promise.all([
      H._fetchBLS(),
      H._fetchBLSFreight(),
      H._fetchBLSManufacturing()
    ]);

    assert.equal(calls, 1, 'three domain adapters must share one BLS request');
    assert.deepEqual(bodies[0].seriesid, [
      'CES0000000001',
      'PCU484121484121',
      'PCUOMFG--OMFG--'
    ]);
    assert.equal(bodies[0].registrationkey, 'test-secret-registration-key');
    assert.equal(readings[0].value, 159500);
    assert.equal(readings[1].value, 132.4);
    assert.equal(readings[2].value, 143.5);
    assert.equal(readings[0].sourceUpdatedAt, '2026-M07');
    assert.equal(readings[1].sourceUpdatedAt, '2026-M07');
    assert.equal(readings[2].sourceUpdatedAt,
      'bls-series:PCUOMFG--OMFG--|year:2026|period:M07');

    await H._fetchBLS();
    assert.equal(calls, 1, 'successful BLS batch must be reused from the warm cache');

    H._resetBLSRequestState();
    calls = 0;
    global.fetch = function () {
      calls++;
      return Promise.resolve(response({
        status: 'REQUEST_FAILED',
        message: ['Daily threshold reached for test-secret-registration-key']
      }));
    };
    assert.equal(await H._fetchBLS(), null);
    assert.equal(await H._fetchBLS(), null);
    assert.equal(calls, 2, 'failed BLS responses must not be cached');
    assert.equal(H._redactBLSMessage(
      'Daily threshold reached for test-secret-registration-key'),
      'Daily threshold reached for [redacted]');

    console.log('BLS batch resilience: 17/17 passed');
  } finally {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.BLS_API_KEY;
    else process.env.BLS_API_KEY = realKey;
    H._resetBLSRequestState();
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
