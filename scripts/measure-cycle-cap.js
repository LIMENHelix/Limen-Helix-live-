/**
 * scripts/measure-cycle-cap.js — Exp 2 measurement: deep-digest cycle cap 8 -> 12
 * with depth-diverse pick (domain-brain-base.js _applyDeepDigest).
 * Run: node scripts/measure-cycle-cap.js
 *
 * Fires 14 distinct evidence conditions so groundedOnly cap = min(12, nEvidence) = 12,
 * runs the complete Finance cycle twice, and reports the injection funnel + the depth
 * histogram of surfaced deep diagnoses. Checks:
 *   M1  12 deep diagnoses injected (cap reached, was 8)
 *   M2  depth diversity: no single level takes more than ceil(12/2)=6 slots
 *   M3  >1 distinct depth surfaced
 *   M4  injected treatments survive to the playbook (merge regression intact)
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var store = {};
var win = {
  location: { pathname: '/', search: '' },
  LIMENDomainBrains: { register: function () {} },
  addEventListener: function () {},
  dispatchEvent: function () {}
};
global.window = win;
global.localStorage = {
  getItem: function (k) { return store[k] != null ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
win.localStorage = global.localStorage;
global.setInterval = function () { return 0; };
win.setInterval = global.setInterval;
global.document = { createElement: function () { return {}; }, head: { appendChild: function () {} }, addEventListener: function () {} };
win.document = global.document;

global.fetch = function (url) {
  var u = String(url);
  var file = null;
  if (u.indexOf('/assets/data/domains/finance.json') !== -1) file = path.join(ROOT, 'assets/data/domains/finance.json');
  if (u.indexOf('/assets/data/deep/finance-diagnosis-digest.json') !== -1) file = path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json');
  if (file && fs.existsSync(file)) {
    var data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  }
  return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
};
win.fetch = global.fetch;

win.LIMENPortalContentResolver = { resolveForBrain: function () { return Promise.resolve(null); } };

function loadScript(rel) { eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
loadScript('assets/js/domain-brains/finance-brain.js');

var brain = win.LIMENFinanceBrain;
assert('finance brain loaded', !!brain);

// 14 distinct evidence conditions (cap = min(12, 14) = 12). Stubbed at the
// normalizeSignals seam: everything downstream (deriveDiagnoses, digest gate,
// diversity pick, opportunity surfacing) runs for real.
var CONDITIONS = ['volatility_cascade', 'market_panic', 'yield_spike', 'interbank_stress',
  'lending_contraction', 'market_decline', 'bank_failure', 'systemic_risk', 'liquidity_drain',
  'regulatory_action', 'fraud_detected', 'accounting_irregularity', 'macro_shock', 'correlation_breakdown'];
var origNormalize = brain.normalizeSignals;
brain.normalizeSignals = function () {
  return origNormalize.call(brain).then(function () {
    brain._activeConditions = CONDITIONS.slice();
  });
};

var preResolve = null, postResolve = null;
var origResolve = brain.resolveDeepContent;
brain.resolveDeepContent = function () {
  preResolve = (brain.state.treatments || []).slice();
  return origResolve.call(brain).then(function () {
    postResolve = (brain.state.treatments || []).slice();
  });
};

(async function () {
  await brain.cycle();   // loads digest
  await brain.cycle();   // digest applies

  var deepDx = (brain.state.diagnoses || []).filter(function (d) { return d.source === 'deep-digest' && d.active; });
  var hist = {};
  deepDx.forEach(function (d) { var k = String(d.depth || 'x'); hist[k] = (hist[k] || 0) + 1; });
  var injectedTx = (preResolve || []).filter(function (t) { return t.source === 'deep-digest'; }).length;
  var playbookTx = (postResolve || []).filter(function (t) {
    return t.source === 'deep-digest' && deepDx.some(function (d) { return d.id === t.diagnosisId; });
  }).length;

  console.log('\n  FUNNEL (14 evidence conditions, cap 12, digest 180dx x 6tx)');
  console.log('    deep dx injected:      ' + deepDx.length + '  (depths: ' + JSON.stringify(hist) + ')');
  console.log('    treatments injected:   ' + injectedTx);
  console.log('    post-resolver total:   ' + (postResolve || []).length);
  console.log('    deep-digest in playbook: ' + playbookTx);

  var maxDepth = Math.max.apply(null, Object.keys(hist).map(function (k) { return hist[k]; }));
  var minDepth = Math.min.apply(null, Object.keys(hist).map(function (k) { return hist[k]; }));
  var digestFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json'), 'utf8'));
  var digestDepths = {};
  digestFile.diagnoses.forEach(function (d) { digestDepths[String(d.depth)] = true; });
  var missingDepths = Object.keys(digestDepths).filter(function (k) { return !hist[k]; });
  console.log('\nM1: cap 12 reached');
  assert('12 deep diagnoses injected', deepDx.length === 12, 'got ' + deepDx.length);
  console.log('M2: every digest-represented depth is reachable THIS cycle');
  assert('all depths ' + JSON.stringify(Object.keys(digestDepths)) + ' surfaced', missingDepths.length === 0,
    'missing: ' + JSON.stringify(missingDepths));
  console.log('M3: balance across depths');
  assert('max-min <= 1 (round-robin)', maxDepth - minDepth <= 1, maxDepth + '-' + minDepth);
  console.log('M4: conservation into playbook');
  assert('injected == surviving in playbook', injectedTx === playbookTx && injectedTx > 0, injectedTx + ' -> ' + playbookTx);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
