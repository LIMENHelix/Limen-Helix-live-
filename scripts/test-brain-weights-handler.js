/**
 * scripts/test-brain-weights-handler.js — dry-run the Phase 0 persistence
 * handler with mock req/res (run: node scripts/test-brain-weights-handler.js).
 * Locally lib/limen-db falls back to its in-memory store (no Redis env), so
 * this proves the handler CONTRACT (gating, validation, round-trip); the
 * Redis leg is the same lib the recorder already proved live in prod.
 *
 *   T1  POST without token → 401 (fail closed; BRAIN_WEIGHTS_TOKEN unset)
 *   T2  POST with token → stored; GET returns the same snapshot (round-trip)
 *   T3  GET history returns the appended row
 *   T4  bad domain → 400; missing layers → 400; oversized → 413
 */
process.env.BRAIN_WEIGHTS_TOKEN = 'test-token-123';   // set BEFORE require (module reads it at load)
var handler = require('../handlers/brain-weights.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function call(method, url, body, headers) {
  return new Promise(function (resolve) {
    var req = { method: method, url: url, headers: headers || {}, body: body !== undefined ? body : undefined,
      on: function () {} };
    var res = {
      statusCode: 200, _headers: {},
      setHeader: function (k, v) { this._headers[k] = v; },
      end: function (payload) { var j = null; try { j = JSON.parse(payload); } catch (e) {} resolve({ status: this.statusCode, json: j }); }
    };
    handler(req, res);
  });
}

var SNAP = { version: 1, mode: 'shadow', isReward: false, creditSource: 'call-consistency',
  layers: { K5_pe: { name: 'K5', w: [0.4, 0.18, 0.22, 0.15, 0.05], seed: [0.35, 0.2, 0.25, 0.15, 0.05], updates: 3 } } };

(async function () {
  console.log('T1: fail-closed token gate');
  var r1 = await call('POST', '/api/brain-weights', { domain: 'energy', snapshot: SNAP });
  assert('POST without token → 401', r1.status === 401, JSON.stringify(r1));
  var r1b = await call('POST', '/api/brain-weights', { domain: 'energy', snapshot: SNAP }, { 'x-brain-token': 'wrong' });
  assert('POST with wrong token → 401', r1b.status === 401);

  console.log('T2: authorized round-trip (simulated-restart reload path)');
  var r2 = await call('POST', '/api/brain-weights', { domain: 'energy', snapshot: SNAP }, { 'x-brain-token': 'test-token-123' });
  assert('authorized POST stores', r2.status === 200 && r2.json.ok === true, JSON.stringify(r2.json));
  var r3 = await call('GET', '/api/brain-weights?domain=energy');
  assert('GET returns the stored snapshot', r3.status === 200 && r3.json.snapshot &&
    String(r3.json.snapshot.layers.K5_pe.w) === String(SNAP.layers.K5_pe.w), JSON.stringify(r3.json && r3.json.snapshot && r3.json.snapshot.layers));
  assert('honest labels survive storage', r3.json.snapshot.mode === 'shadow' && r3.json.snapshot.isReward === false);

  console.log('T3: history append');
  var r4 = await call('GET', '/api/brain-weights?domain=energy&history=5');
  assert('history has the row', r4.status === 200 && r4.json.count >= 1, JSON.stringify(r4.json && r4.json.count));

  console.log('T4: validation');
  var r5 = await call('GET', '/api/brain-weights?domain=..%2Fetc');
  assert('bad domain → 400', r5.status === 400);
  var r6 = await call('POST', '/api/brain-weights', { domain: 'energy', snapshot: { nope: 1 } }, { 'x-brain-token': 'test-token-123' });
  assert('snapshot without layers → 400', r6.status === 400);
  var big = { layers: { x: { w: new Array(40000).fill(0.123456789) } } };
  var r7 = await call('POST', '/api/brain-weights', { domain: 'energy', snapshot: big }, { 'x-brain-token': 'test-token-123' });
  assert('oversized snapshot → 413', r7.status === 413, 'status=' + r7.status);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
