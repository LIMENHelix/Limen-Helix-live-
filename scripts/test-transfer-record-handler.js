/**
 * scripts/test-transfer-record-handler.js — the transfer-ledger endpoint contract.
 * Run: node scripts/test-transfer-record-handler.js  (in-memory limen-db)
 *
 *   T1  POST without token ⇒ 401 fail-closed
 *   T2  POST a receipt ⇒ builds packet, gates, records; returns ref + disposition
 *   T3  invalid packet ⇒ 400
 *   T4  POST an outcome ⇒ recorded; GET uplift reflects it (observational)
 *   T5  GET verify ⇒ the transfer chain is intact; nothing was applied
 */
process.env.BRAIN_WEIGHTS_TOKEN = 'test-token';   // set BEFORE requiring the handler
var handler = require('../handlers/transfer-record');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

function call(method, url, body, headers) {
  return new Promise(function (resolve) {
    var res = { setHeader: function () {}, statusCode: 200, end: function (b) { resolve({ status: res.statusCode, json: JSON.parse(b || '{}') }); } };
    handler({ method: method, url: url, headers: headers || {}, body: body }, res);
  });
}

(async function () {
  console.log('T1: POST without token ⇒ 401');
  var noTok = await call('POST', '/api/transfer-record', { packet: { sourceDomain: 'energy', targetDomain: 'finance', canonicalId: 'X' } });
  assert('401 unauthorized', noTok.status === 401);

  console.log('T2: POST a receipt with token');
  var body = {
    token: 'test-token',
    packet: { sourceDomain: 'energy', targetDomain: 'finance', canonicalId: 'GRID_STRESS', relationType: 'grid-connection', sourceConfidence: 0.8, calibrationState: 'calibrated', madeAt: 1000 },
    target: { spatialOverlap: 0.9, temporalOverlap: 1, ontologyRelated: true },
    influence: { changed: true, fields: ['attention'] }
  };
  var rec = await call('POST', '/api/transfer-record', body);
  assert('receipt recorded', rec.json.ok && rec.json.recorded === 'receipt', JSON.stringify(rec.json));
  assert('disposition accepted + ref returned', rec.json.disposition === 'accepted' && typeof rec.json.ref === 'string');
  assert('applied nothing', rec.json.appliedAnything === false);

  console.log('T3: invalid packet ⇒ 400');
  var bad = await call('POST', '/api/transfer-record', { token: 'test-token', packet: { sourceDomain: 'energy' } });
  assert('400 invalid packet', bad.status === 400 && /invalid packet/.test(bad.json.error));

  console.log('T4: POST an outcome ⇒ uplift reflects it');
  await call('POST', '/api/transfer-record', { token: 'test-token', outcome: { target: 'finance', ref: rec.json.ref, verdict: 'improved', delta: 0.05 } });
  var up = await call('GET', '/api/transfer-record?target=finance&uplift=1');
  assert('uplift readout present', up.json.ok && up.json.uplift && up.json.uplift.withOutcome >= 1, JSON.stringify(up.json.uplift));
  assert('uplift is observational (insufficient-data below min, never "works")', /OBSERVATIONAL/.test(up.json.uplift.note));

  console.log('T5: GET verify ⇒ chain intact');
  var v = await call('GET', '/api/transfer-record?target=finance&verify=1');
  assert('transfer chain verifies', v.json.ok && v.json.verify && v.json.verify.ok === true, JSON.stringify(v.json.verify));

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
