/**
 * scripts/test-finance-treatment-merge.js — execution-disparity regression test.
 * Run: node scripts/test-finance-treatment-merge.js
 *
 * Defect: finance's cycle override runs resolveDeepContent() AFTER the base cycle's
 * step 6 (_applyDeepDigest injects deep-digest treatments into state.treatments),
 * and resolveDeepContent replaced state.treatments wholesale (finance-brain.js:805)
 * whenever the resolver returned content — wiping the deep-digest treatments inside
 * the same cycle they were injected.
 *
 *   T1  deep-digest treatment survives a COMPLETE Finance cycle (resolver active)
 *   T2  merge is idempotent: running resolveDeepContent twice adds no duplicates
 *   T3  merge is deterministic: identical id sequence on re-run
 *   +   prints the count funnel: digest carried -> injected -> post-resolver -> playbook
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');

// ── browser shims ──
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

// fetch: serve the two real data files the cycle needs; 404 everything else
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

// resolver stub: simulates production condition — canonical dx active and the
// resolver DID find deep content (the trigger for the old wholesale replace).
// Treatments array is dynamic so the test can craft a cross-path duplicate.
var stubTreatments = [
  { label: 'Resolver Circuit Breaker Protocol', type: 'POLICY', evidence: 'A', description: '', cite: 'resolver-cite-1', steps: ['s1', 's2'], monitoring: null, escalation: null, nodeId: 'THAL', nodeLabel: 'Thalamus', hasDepth: true },
  { label: 'Resolver Liquidity Backstop', type: 'INFRASTRUCTURE', evidence: 'B', description: '', cite: 'resolver-cite-2', steps: ['s1'], monitoring: null, escalation: null, nodeId: 'HYPO', nodeLabel: 'Hypothalamus', hasDepth: true }
];
win.LIMENPortalContentResolver = {
  resolveForBrain: function () {
    return Promise.resolve({
      activeDiagnoses: 1,
      byDiagnosis: {
        MARKET_CRASH: { treatments: stubTreatments }
      }
    });
  }
};

function loadScript(rel) { eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
loadScript('assets/js/domain-brains/finance-brain.js');

var brain = win.LIMENFinanceBrain;
assert('finance brain loaded', !!brain);

// feeds that fire evidence conditions: VIX 45 -> volatility_cascade + market_panic
// (market_panic activates canonical MARKET_CRASH; non-'_' conditions open the
// groundedOnly deep-digest gate with cap = nEvidence)
brain.state.feeds = [
  { name: 'VIX Volatility Index', value: 45, live: true },
  { name: '10Y Treasury Yield', value: 6.1, live: true }
];

// instrumentation: capture state.treatments before/after resolveDeepContent
var preResolve = null, postResolve = null;
var origResolve = brain.resolveDeepContent;
brain.resolveDeepContent = function () {
  preResolve = (brain.state.treatments || []).slice();
  return origResolve.call(brain).then(function () {
    postResolve = (brain.state.treatments || []).slice();
  });
};

function countSrc(list, src) { return list.filter(function (t) { return t.source === src; }).length; }
function playbookFilter(list, diagnoses) {
  var active = {}; diagnoses.forEach(function (d) { if (d.active) active[d.id] = true; });
  return list.filter(function (t) { return t && t.diagnosisId && active[t.diagnosisId]; });
}

(async function () {
  await brain.cycle();   // cycle 1: kicks off the one-time digest load

  // Craft the cross-path duplicate (Codex P2): a resolver treatment carrying the
  // SAME label the digest is about to inject this cycle — the two paths assign
  // different synthetic ids and diagnosisIds, and digest entries omit nodeId,
  // so only semantic reconciliation can merge them.
  var digest0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json'), 'utf8'));
  var l2dx = digest0.diagnoses.filter(function (d) { return d.depth === 2; })[0];
  var dupeLabel = l2dx.tx[0].l;
  stubTreatments.push({
    label: dupeLabel, type: 'POLICY', evidence: 'A', description: '', cite: 'resolver-cite-3',
    steps: ['s1'], monitoring: null, escalation: null, nodeId: 'THAL', nodeLabel: 'Thalamus', hasDepth: true
  });

  await brain.cycle();   // cycle 2: digest applies, then resolveDeepContent runs

  var digestFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json'), 'utf8'));
  var carried = digestFile.diagnoses.reduce(function (s, d) { return s + d.tx.length; }, 0);
  var injected = countSrc(preResolve || [], 'deep-digest');
  var postDigest = countSrc(postResolve || [], 'deep-digest');
  var playbook = playbookFilter(postResolve || [], brain.state.diagnoses || []);

  console.log('\n  FUNNEL');
  console.log('    digest carried (file):        ' + carried);
  console.log('    injected this cycle:          ' + countSrc(preResolve || [], 'deep-digest') + ' deep-digest + ' + countSrc(preResolve || [], 'canonical') + ' canonical = ' + (preResolve || []).length);
  console.log('    post-resolver:                ' + (postResolve || []).length + ' total, of which deep-digest = ' + postDigest);
  console.log('    final playbook (active-dx):   ' + playbook.length + ', of which deep-digest = ' + countSrc(playbook, 'deep-digest'));

  console.log('\nT1: deep-digest treatment survives the complete Finance cycle');
  assert('>=1 deep-digest treatment was injected pre-resolver', injected > 0, 'injected=' + injected);
  assert('>=1 deep-digest treatment exists post-resolver', postDigest > 0, 'postDigest=' + postDigest);
  assert('deep-digest treatment reaches final playbook', countSrc(playbook, 'deep-digest') > 0);
  assert('resolver treatments also present post-resolver', countSrc(postResolve || [], 'canonical_deep') > 0, 'canonical_deep=' + countSrc(postResolve || [], 'canonical_deep'));

  console.log('\nT2: merge idempotence — second resolveDeepContent adds nothing');
  var len1 = (brain.state.treatments || []).length;
  await brain.resolveDeepContent();
  var second = brain.state.treatments || [];
  assert('count unchanged after re-run', second.length === len1, len1 + ' -> ' + second.length);
  var ids = second.map(function (t) { return t.id; });
  assert('no duplicate ids', new Set(ids).size === ids.length, (ids.length - new Set(ids).size) + ' dups');

  console.log('\nT3: merge determinism — identical id sequence on re-run');
  var seq1 = ids.join('|');
  await brain.resolveDeepContent();
  var seq2 = (brain.state.treatments || []).map(function (t) { return t.id; }).join('|');
  assert('id sequence identical', seq1 === seq2);

  console.log('\nT4: cross-path duplicate merges semantically, associations unioned');
  var finalTx = brain.state.treatments || [];
  var dupeHits = finalTx.filter(function (t) { return t.label === dupeLabel; });
  assert('exactly one entity for the cross-path label', dupeHits.length === 1, 'got ' + dupeHits.length);
  var dupeIds = (dupeHits[0] && dupeHits[0].diagnosisIds) || [];
  assert('associations unioned (digest dx + MARKET_CRASH)',
    dupeIds.indexOf(l2dx.id) !== -1 && dupeIds.indexOf('MARKET_CRASH') !== -1, JSON.stringify(dupeIds));
  // count conservation: merged == unique normalized labels across both paths
  var allLabels = {};
  (preResolve || []).concat(stubTreatments.map(function (t) {
    return { label: t.label };
  })).forEach(function (t) {
    if (t) allLabels[String(t.label || '').toLowerCase().replace(/\s+/g, ' ').trim()] = true;
  });
  assert('merged count == semantic-unique count across paths',
    finalTx.length === Object.keys(allLabels).length,
    finalTx.length + ' vs ' + Object.keys(allLabels).length);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
