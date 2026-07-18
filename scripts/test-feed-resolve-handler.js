/**
 * scripts/test-feed-resolve-handler.js — the resolver handler contract with mock req/res
 * (run: node scripts/test-feed-resolve-handler.js). Local lib/limen-db falls back to its
 * in-memory store, so this proves the CONTRACT (token gate, store, resolve round-trip).
 *
 *   T1  POST without token → 401 (fail-closed; BRAIN_WEIGHTS_TOKEN reused)
 *   T2  POST with token stores a forecast; bad shape → 400
 *   T3  GET resolves the stored forecast against seeded recorder rows → externalHitRate
 *   T4  bad domain → 400
 */
process.env.BRAIN_WEIGHTS_TOKEN = 'tkn';
var db = require('../lib/limen-db.js');
var handler = require('../handlers/feed-resolve.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

function call(method, url, body, headers) {
  return new Promise(function (resolve) {
    var req = { method: method, url: url, headers: headers || {}, body: body, on: function () {} };
    var res = { statusCode: 200, _h: {}, setHeader: function (k, v) { this._h[k] = v; }, end: function (p) { var j = null; try { j = JSON.parse(p); } catch (e) {} resolve({ status: this.statusCode, json: j }); } };
    handler(req, res);
  });
}

(async function () {
  console.log('T1: fail-closed token gate');
  var r1 = await call('POST', '/api/feed-resolve', { domain: 'energy', forecast: { direction: 'rising', currentStress: 0.5 } });
  assert('no token → 401', r1.status === 401);

  console.log('T2: authorized store + validation');
  // seed recorder realized rows so the forecast can resolve (a realized higher value ~6h out)
  var now = Date.now();
  await db.lpush('feedhist:energy', { t: now - 6 * 3600 * 1000 + 1000, s: 0.8 });   // ~6h after the forecast's madeAt≈now-... (see below)
  var r2 = await call('POST', '/api/feed-resolve', { domain: 'energy', forecast: { direction: 'rising', currentStress: 0.5 } }, { 'x-brain-token': 'tkn' });
  assert('authorized POST stores', r2.status === 200 && r2.json.ok === true, JSON.stringify(r2.json));
  var rBad = await call('POST', '/api/feed-resolve', { domain: 'energy', forecast: { direction: 'sideways', currentStress: 0.5 } }, { 'x-brain-token': 'tkn' });
  assert('bad direction → 400', rBad.status === 400);

  console.log('T3: GET resolves against the recorder');
  // Build a clean, deterministic scenario directly in the store (forecast made in the past, realized 6h later).
  var t0 = now - 20 * 3600 * 1000;
  await db.del('forecasthist:energytest'); await db.del('feedhist:energytest');
  await db.lpush('forecasthist:energytest', { madeAt: t0, direction: 'rising', currentStress: 0.4 });
  await db.lpush('feedhist:energytest', { t: t0 + 6 * 3600 * 1000, s: 0.7 });
  var r3 = await call('GET', '/api/feed-resolve?domain=energytest');
  assert('GET ok, 1 resolved, hitRate 1', r3.status === 200 && r3.json.resolvedCount === 1 && r3.json.externalHitRate === 1, JSON.stringify(r3.json));

  console.log('T4: validation');
  var r4 = await call('GET', '/api/feed-resolve?domain=..%2Fx');
  assert('bad domain → 400', r4.status === 400);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
