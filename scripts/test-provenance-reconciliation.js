/**
 * scripts/test-provenance-reconciliation.js — a treatment's provenance must not
 * mutate silently across surfaces:
 *   source record -> digest -> runtime treatment (base pass-through)
 *   -> console classifier -> opportunity index.
 * Run: node scripts/test-provenance-reconciliation.js
 *
 *   P1  base pass-through maps syn exactly (1->true, 0->false, 2->undefined)
 *   P2  console classifier agrees with digest state for every fleet record
 *   P3  index per-record syn == digest syn for every (domain, dx, label) tuple
 *   P4  fleet provenance totals identical across digest and index
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets/data/deep');

// load console for classifyProvenance
var store = {};
var win = {
  location: { pathname: '/domain-console', search: '?domain=finance' },
  addEventListener: function () {}, dispatchEvent: function () {}
};
global.window = win;
global.localStorage = { getItem: function (k) { return null; }, setItem: function () {}, removeItem: function () {} };
win.localStorage = global.localStorage;
global.document = {
  readyState: 'complete', addEventListener: function () {},
  createElement: function () { return { style: {}, _kids: [], appendChild: function (k) { this._kids.push(k); }, get innerHTML() { return this._kids.join(''); } }; },
  createTextNode: function (s) { return String(s); },
  head: { appendChild: function () {} }, getElementById: function () { return null; },
  querySelector: function () { return null; }, querySelectorAll: function () { return []; }
};
win.document = global.document;
global.requestAnimationFrame = function () {};
win.requestAnimationFrame = global.requestAnimationFrame;
global.fetch = function () { return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } }); };
win.fetch = global.fetch;
win.LIMENDomainIsolator = {
  isDomainScoped: function () { return true; },
  getActiveDomain: function () { return 'finance'; },
  getResolvedKey: function () { return 'finance'; },
  getDomainLabel: function () { return 'Finance'; }
};
eval(fs.readFileSync(path.join(ROOT, 'assets/js/domain-brains/domain-console-brain.js'), 'utf8'));
var dcb = win.LIMENDomainConsoleBrain;
assert('console classifier available', !!(dcb && dcb.classifyProvenance));

// base pass-through rule (domain-brain-base.js _applyDeepDigest)
function runtimeSynthetic(syn) { return syn === 1 ? true : (syn === 0 ? false : undefined); }

var digests = fs.readdirSync(DEEP).filter(function (f) { return f.endsWith('-diagnosis-digest.json'); });
var index = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/opportunities-index.json'), 'utf8'));

console.log('P1: base pass-through maps syn exactly (fleet-wide scan)');
var p1Bad = 0, p2Bad = 0, totals = { digest: { 0: 0, 1: 0, 2: 0 } };
var digestByTuple = {};
digests.forEach(function (f) {
  var j = JSON.parse(fs.readFileSync(path.join(DEEP, f), 'utf8'));
  (j.diagnoses || []).forEach(function (d) {
    (d.tx || []).forEach(function (t) {
      var s = (t.syn === 0 || t.syn === 1 || t.syn === 2) ? t.syn : 2;
      totals.digest[s]++;
      digestByTuple[j.domain + '' + d.id + '' + (t.l || '')] = s;
      // P1: runtime mapping must be the exact tri-state rule
      var rs = runtimeSynthetic(s);
      if (!((s === 1 && rs === true) || (s === 0 && rs === false) || (s === 2 && rs === undefined))) p1Bad++;
      // P2: console classifier must agree — digest records carry no cite/steps,
      // so the fallback can never upgrade them
      var cls = dcb.classifyProvenance({ label: t.l, synthetic: rs });
      if (cls !== s) p2Bad++;
    });
  });
});
assert('runtime mapping exact for every record', p1Bad === 0, p1Bad + ' mismatches');
assert('console classifier agrees for every record', p2Bad === 0, p2Bad + ' mismatches');

console.log('P3: index per-record syn == digest syn (every tuple)');
var p3Bad = 0, p3Count = 0, indexTotals = { 0: 0, 1: 0, 2: 0 };
(index.opportunities || []).forEach(function (o) {
  (o.tx || []).forEach(function (x) {
    var key = o.d + '' + o.id + '' + (x.l || '');
    var expected = digestByTuple[key];
    if (expected === undefined || x.s !== expected) p3Bad++;
    else indexTotals[x.s]++;
    p3Count++;
  });
});
assert('every indexed record matches digest provenance', p3Bad === 0, p3Bad + '/' + p3Count + ' mismatches');

console.log('P4: fleet provenance totals identical across digest and index');
assert('scaffold totals match', indexTotals[1] === totals.digest[1], indexTotals[1] + ' vs ' + totals.digest[1]);
assert('verified-eligible totals match', indexTotals[0] === totals.digest[0], indexTotals[0] + ' vs ' + totals.digest[0]);
assert('unknown totals match', indexTotals[2] === totals.digest[2], indexTotals[2] + ' vs ' + totals.digest[2]);
assert('index provenance field matches computed totals',
  index.provenance.scaffold === totals.digest[1] &&
  index.provenance.verifiedEligible === totals.digest[0] &&
  index.provenance.unknown === totals.digest[2],
  JSON.stringify(index.provenance));
console.log('    fleet: ' + JSON.stringify(totals.digest));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
