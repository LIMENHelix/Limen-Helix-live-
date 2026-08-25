/**
 * scripts/four-lesions/test-persistence-wiring.js
 * Verifies the Phase 1.5 PORT: weight persistence wired into DomainBrainBase, gated
 * to the finance POC allowlist.  (run: node scripts/four-lesions/test-persistence-wiring.js)
 *
 *   T1  finance hydrates on init (GET /api/brain-weights) and PERSISTS on cycle (POST) when a token is set
 *   T2  the persisted body is a valid serialized snapshot (4 layers, honest mode:shadow)
 *   T3  NO token ⇒ compute-only: no POST, persistEnabled=false (honest, not an error)
 *   T4  a NON-allowlisted domain (law) never touches /api/brain-weights (no hydrate, no persist)
 */
var fs = require('fs');
var path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

// ── env shims ──
var lsStore = {};
var localStorageShim = {
  getItem: function (k) { return (k in lsStore) ? lsStore[k] : null; },
  setItem: function (k, v) { lsStore[k] = String(v); },
  removeItem: function (k) { delete lsStore[k]; }
};
var documentShim = { addEventListener: function () {}, visibilityState: 'visible' };
var win = { location: { pathname: '/', search: '' }, addEventListener: function () {}, dispatchEvent: function () {},
  CustomEvent: function () {}, localStorage: localStorageShim, document: documentShim };
global.window = win;
global.localStorage = localStorageShim;
global.document = documentShim;

var fetchCalls = [];
function installFetch() {
  var f = function (url, opts) {
    fetchCalls.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body });
    var u = String(url);
    if (u.indexOf('/api/brain-weights') === 0 && (!opts || (opts.method || 'GET') === 'GET')) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, snapshot: null }); } });   // first run: no snapshot
    }
    if (u.indexOf('/api/brain-weights') === 0) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } });                    // POST stored
    }
    return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } });                              // feed-resolve etc.
  };
  global.fetch = f; win.fetch = f;
}
installFetch();

function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
var Base = win.LIMENDomainBrainBase;
assert('base + modules loaded', !!(Base && win.LIMENPLASTICITY && win.LIMENK4));

function mkBrain(domainId) {
  var b = new Base({ domainId: domainId, label: domainId, snapshotKey: domainId, cycleInterval: 30000 });
  b.state.stress = 0.6;
  b.state.diagnoses = [{ id: 'A', active: true, relevance: 0.6 }];
  b.state.cognition = {
    model: { predictionError: { total: 0.2 } },
    neuro: {
      gainControl: { inhibition: 0.4, outputScale: 0.8 },
      attention: { focus: [{ id: 'A', salience: 0.7 }] },
      slowModel: { expectedStress: 0.5, fastSlowDivergence: 0.1 },
      homeostasis: { baseline: 0.45, adaptiveThreshold: 0.11 },
      outcomeLedger: { hitRate: 0.6, samples: 8, resolvedTotal: 8 }
    }
  };
  b._cycleCount = 200;   // past the resolver throttle + past the persist throttle (GP_PERSIST_EVERY=10)
  return b;
}
function brainWeightsCalls() { return fetchCalls.filter(function (c) { return c.url.indexOf('/api/brain-weights') === 0; }); }

// ── T1/T2 — finance with a token: hydrate on init + persist on cycle ──
console.log('T1/T2: finance persists + hydrates when the operator token is set');
lsStore['limen:brainwts:token'] = 'wiring-token';
fetchCalls = [];
var fin = mkBrain('finance');
var out = fin._computeDomainPlasticity();
var bw = brainWeightsCalls();
var hydrate = bw.filter(function (c) { return c.method === 'GET'; });
var persist = bw.filter(function (c) { return c.method === 'POST'; });
assert('finance issued a hydrate GET on init', hydrate.length === 1, JSON.stringify(bw.map(function (c) { return c.method + ' ' + c.url; })));
assert('finance issued a persist POST on cycle', persist.length === 1);
assert('readout reports persistence enabled (allowlist gate)', out && out.persistence && out.persistence.enabled === true, JSON.stringify(out && out.persistence));
// persistEnabled is set inside the throttled persist, which runs AFTER the readout object is
// built this cycle (same one-cycle lag energy has). Verify it reflects the token on the next cycle.
fin._cycleCount = 215;
var out1b = fin._computeDomainPlasticity();
assert('persistEnabled=true reflected after a persist cycle', out1b && out1b.persistence && out1b.persistence.persistEnabled === true, JSON.stringify(out1b && out1b.persistence));

var body = null; try { body = JSON.parse(persist[0].body); } catch (e) {}
assert('persisted body is {domain, snapshot}', !!(body && body.domain === 'finance' && body.snapshot), JSON.stringify(body && Object.keys(body || {})));
assert('snapshot has all 4 generic layers', !!(body && body.snapshot && body.snapshot.layers &&
  ['K_gain', 'K_attention', 'K_slow', 'K_homeo'].every(function (k) { return !!body.snapshot.layers[k]; })), JSON.stringify(body && body.snapshot && Object.keys(body.snapshot.layers || {})));
assert('snapshot carries honest labels (mode:shadow)', !!(body && body.snapshot && body.snapshot.mode === 'shadow'));

// ── T3 — no token ⇒ compute-only ──
console.log('T3: no token ⇒ compute-only (no POST), honest not an error');
delete lsStore['limen:brainwts:token'];
fetchCalls = [];
var fin2 = mkBrain('finance');
var out2 = fin2._computeDomainPlasticity();
var persist2 = brainWeightsCalls().filter(function (c) { return c.method === 'POST'; });
assert('no persist POST without a token', persist2.length === 0);
assert('readout reports persistEnabled=false (compute-only)', out2 && out2.persistence && out2.persistence.persistEnabled === false, JSON.stringify(out2 && out2.persistence));

// ── T4 — the allowlist GATE still gates. All 20 real domains are now allowlisted
// (energy-parity rollout), so prove the gate with a synthetic id that is NOT in the set. ──
console.log('T4: a non-allowlisted id (synthetic) never touches /api/brain-weights');
lsStore['limen:brainwts:token'] = 'wiring-token';   // even with a token present
fetchCalls = [];
var ghost = mkBrain('notadomain');   // not in GP_PERSIST_DOMAINS
var outGhost = ghost._computeDomainPlasticity();
assert('non-allowlisted id made zero brain-weights calls (no hydrate, no persist)', brainWeightsCalls().length === 0, JSON.stringify(brainWeightsCalls().map(function (c) { return c.method + ' ' + c.url; })));
assert('non-allowlisted id readout reports persistence disabled', outGhost && outGhost.persistence && outGhost.persistence.enabled === false, JSON.stringify(outGhost && outGhost.persistence));

// ── T5 — every real RUNTIME owner is allowlisted, including the three
// canonical/runtime aliases (medicine->health, science->research,
// trade->supplyChain). The gate reads brain.domainId, so testing canonical
// product names would miss the production bug this protects against. ──
console.log('T5: all 20 runtime domain ids hydrate through their own key');
var runtimeDomains = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','health','industry','infrastructure','intelligence','law','population','religion','research','supplyChain','technology'];
for (var di = 0; di < runtimeDomains.length; di++) {
  var runtimeId = runtimeDomains[di];
  if (runtimeId === 'energy') continue; // Energy owns its separate persistence implementation.
  fetchCalls = [];
  var runtimeBrain = mkBrain(runtimeId);
  var runtimeOut = runtimeBrain._computeDomainPlasticity();
  var hydrateCalls = brainWeightsCalls().filter(function (c) { return c.method === 'GET'; });
  assert(runtimeId + ' persistence enabled + hydrate requested',
    !!(runtimeOut && runtimeOut.persistence && runtimeOut.persistence.enabled && hydrateCalls.length === 1 && hydrateCalls[0].url.indexOf('domain=' + encodeURIComponent(runtimeId)) >= 0),
    JSON.stringify({ persistence: runtimeOut && runtimeOut.persistence, calls: hydrateCalls }));
}

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
