/**
 * scripts/test-digest-window-fill.js — deep-digest window must fill cap regardless
 * of represented depth count, and per-depth cursors must give full bucket coverage.
 * Run: node scripts/test-digest-window-fill.js
 *
 *   W1  2-depth digest (the 19 non-finance domains today) fills cap 12 — the
 *       fixed pass bound used to truncate at 2 passes × 2 depths = 6
 *   W2  per-depth cursors: over enough cycles EVERY L2 entry surfaces (was 60%
 *       with the coupled cursor)
 *   W3  determinism retained
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
global.fetch = function () { return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } }); };
win.fetch = global.fetch;

eval(fs.readFileSync(path.join(ROOT, 'assets/js/domain-brains/domain-brain-base.js'), 'utf8'));
var proto = win.LIMENDomainBrainBase.prototype;
assert('base loaded', !!proto && typeof proto._applyDeepDigest === 'function');

function makeEntries(depth, n, prefix) {
  var out = [];
  for (var i = 0; i < n; i++) out.push({ id: prefix + '_' + i, label: prefix + ' diagnosis ' + i, depth: depth, circuits: ['THAL'], tx: [] });
  return out;
}
function makeBrain(diagnoses, nEvidence) {
  var b = Object.create(proto);
  b.domainId = 'finance';
  b.groundedOnly = true;
  b.state = { diagnoses: [], treatments: [], stress: 0.5 };
  b._activeConditions = [];
  for (var i = 0; i < nEvidence; i++) b._activeConditions.push('cond_' + i);
  b._deepDigest = { diagnoses: diagnoses };
  return b;
}
function windowOnce(b) {
  b.state.diagnoses = []; b.state.treatments = [];   // simulate cycle boundary
  proto._applyDeepDigest.call(b);
  return b.state.diagnoses.filter(function (d) { return d.source === 'deep-digest'; });
}

console.log('W1: 2-depth digest fills cap 12 (was truncated at 6)');
var d2 = makeEntries(2, 30, 'L2').concat(makeEntries(3, 30, 'L3'));
var b1 = makeBrain(d2, 12);
var w1 = windowOnce(b1);
assert('12 diagnoses selected', w1.length === 12, 'got ' + w1.length);
var h1 = {}; w1.forEach(function (d) { h1[d.depth] = (h1[d.depth] || 0) + 1; });
assert('both depths represented', h1[2] > 0 && h1[3] > 0, JSON.stringify(h1));

console.log('W2: per-depth cursors give full bucket coverage');
var digest5 = makeEntries(2, 30, 'L2').concat(makeEntries(3, 50, 'L3'))
  .concat(makeEntries(4, 40, 'L4')).concat(makeEntries(5, 35, 'L5')).concat(makeEntries(6, 25, 'L6'));
var b2 = makeBrain(digest5, 3);
var seenL2 = {}, seenDepths = {};
for (var c = 0; c < 60; c++) {
  var w = windowOnce(b2);
  w.forEach(function (d) { if (d.depth === 2) seenL2[d.id] = true; seenDepths[d.depth] = true; });
}
var l2cov = Object.keys(seenL2).length;
console.log('    L2 coverage after 60 cycles: ' + l2cov + '/30');
assert('ALL 30 L2 entries surfaced (was 18/30 with coupled cursor)', l2cov === 30, l2cov + '/30');
assert('all 5 depths reached', Object.keys(seenDepths).length === 5, JSON.stringify(Object.keys(seenDepths)));

console.log('W3: determinism retained');
var b3 = makeBrain(digest5, 3);
var s1 = [], s2 = [];
for (var c2 = 0; c2 < 5; c2++) { s1.push(windowOnce(b2).map(function (d) { return d.id; }).join(',')); }
// NOTE: b2 has now advanced 65 cycles; fresh instance for the comparison
var b4 = makeBrain(digest5, 3);
var pre1 = [], pre2 = [];
for (var c3 = 0; c3 < 5; c3++) pre1.push(windowOnce(b4).map(function (d) { return d.id; }).join(','));
var b5 = makeBrain(digest5, 3);
for (var c4 = 0; c4 < 5; c4++) pre2.push(windowOnce(b5).map(function (d) { return d.id; }).join(','));
assert('fresh instances produce identical windows', JSON.stringify(pre1) === JSON.stringify(pre2));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
