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
/* The horizon and model come from production rather than being restated here.
   Both were hard-coded at their old values (6h, trend-following) and the fixtures
   silently stopped matching the handler when production changed. */
var R = require('../lib/feed-resolver.js');

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
  /* The forecast has to be older than the PRODUCTION horizon, and the realized
     row has to sit AT that horizon. This was pinned at 6h and silently stopped
     resolving when production moved to 24h: the handler answered "no forecasts
     have aged past the horizon yet" and the assertion read as a failure of the
     resolver rather than of the fixture. Reading the constant keeps them tied. */
  var HZ = R.DEFAULT_HORIZON_MS;
  var t0 = now - (HZ + 4 * 3600 * 1000);          // comfortably past one horizon
  await db.del('forecasthist:energytest'); await db.del('feedhist:energytest');
  await db.lpush('forecasthist:energytest', { madeAt: t0, direction: 'rising', currentStress: 0.4, model: R.FORECAST_MODEL });
  await db.lpush('feedhist:energytest', { t: t0 + HZ, s: 0.7 });
  var r3 = await call('GET', '/api/feed-resolve?domain=energytest');
  assert('GET ok, 1 resolved, hitRate 1', r3.status === 200 && r3.json.resolvedCount === 1 && r3.json.externalHitRate === 1, JSON.stringify(r3.json));

  console.log('T4: validation');
  var r4 = await call('GET', '/api/feed-resolve?domain=..%2Fx');
  assert('bad domain → 400', r4.status === 400);

  console.log('T5: EMIT cron derives + stores a server-side forecast (tab-independent, no token)');
  await db.del('forecasthist:energyemit'); await db.del('feedhist:energyemit');
  await db.set('feedhist:index', ['energyemit']);
  var base = now - 40 * 3600 * 1000;
  for (var i = 0; i < 12; i++) await db.lpush('feedhist:energyemit', { t: base + i * 3600 * 1000, s: 0.3 + i * 0.03 });  // a climbing series
  var e1 = await call('GET', '/api/feed-resolve?emit=1');   // no token — cron path
  assert('emit stored 1 forecast', e1.status === 200 && e1.json.emitted === 1 && e1.json.domains[0] === 'energyemit', JSON.stringify(e1.json));
  var stored = await db.lrange('forecasthist:energyemit', 0, 0);
  assert('stored forecast is server-cron', stored[0] && stored[0].src === 'server-cron', JSON.stringify(stored[0]));
  assert('and carries the production model stamp', stored[0] && stored[0].model === R.FORECAST_MODEL, JSON.stringify(stored[0] && stored[0].model));
  /* MEAN REVERSION: a climbing series is projected back toward its window mean,
     so the emitted call is 'falling'. This asserted 'rising' under the old
     trend-following model, which scored 0.271 directional accuracy in held-out
     testing, i.e. reliably backwards. */
  assert('a climbing series emits a reverting call', stored[0] && stored[0].direction === 'falling', JSON.stringify(stored[0] && stored[0].direction));
  var e2 = await call('GET', '/api/feed-resolve?emit=1');   // same hour ⇒ idempotent skip
  assert('emit idempotent per hour', e2.json.emitted === 0 && e2.json.skipped >= 1);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
