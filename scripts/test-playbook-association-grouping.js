/**
 * scripts/test-playbook-association-grouping.js — playbook filters and groups by
 * the FULL diagnosis association set. Run: node scripts/test-playbook-association-grouping.js
 *
 * Defect: dedupe preserves complete diagnosisIds, but the console filtered and
 * grouped solely by the singular primary diagnosisId — shared treatments
 * disappeared from their other applicable diagnoses.
 *
 *   G1  shared treatment renders under EVERY active associated diagnosis; entity counted once
 *   G2  reordering active diagnoses changes neither memberships nor totals
 *   G3  treatment whose PRIMARY diagnosis is inactive but which is associated to an
 *       active one stays visible (grouped under the active one)
 *   G4  singular diagnosisId fallback still works
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var store = {};
var win = {
  location: { pathname: '/domain-console', search: '?domain=finance' },
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
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  createElement: function () {
    return {
      style: {},
      _kids: [],
      appendChild: function (k) { this._kids.push(k); },
      set textContent(v) { this._text = v; },
      get textContent() { return this._text; },
      get innerHTML() { return this._kids.map(function (k) { return String(k); }).join(''); }
    };
  },
  createTextNode: function (s) { return String(s); },
  head: { appendChild: function () {} },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; }
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
assert('helpers exposed', !!(dcb && dcb.filterTreatmentsForActiveDx && dcb.groupTreatmentsByDx));

var SHARED = { label: 'Shared Circuit Breaker', evidence: 'A', synthetic: false, diagnosisId: 'B', diagnosisIds: ['A', 'B'] };
var ONLY_A = { label: 'A-only Treatment', evidence: 'A', synthetic: false, diagnosisId: 'A' };
var TX = [SHARED, ONLY_A];

console.log('G1: shared treatment renders under every active association; entity counted once');
var activeAB = { A: true, B: true };
var filtered = dcb.filterTreatmentsForActiveDx(TX, activeAB);
var groups = dcb.groupTreatmentsByDx(filtered, activeAB);
assert('entity total is 2 (unique, not per-group)', filtered.length === 2, 'got ' + filtered.length);
assert('group A contains both treatments', (groups.A || []).length === 2, JSON.stringify((groups.A || []).length));
assert('group B contains the shared treatment', (groups.B || []).length === 1 && groups.B[0] === SHARED);
assert('group render-sum (3) exceeds entity total (2) only via membership', (groups.A.length + groups.B.length) === 3);

console.log('G2: reordering active diagnoses changes neither memberships nor totals');
function membership(g) {
  var m = {};
  Object.keys(g).sort().forEach(function (k) { m[k] = g[k].map(function (t) { return t.label; }).sort().join('+'); });
  return JSON.stringify(m);
}
var groupsAB = dcb.groupTreatmentsByDx(dcb.filterTreatmentsForActiveDx(TX, { A: true, B: true }), { A: true, B: true });
var groupsBA = dcb.groupTreatmentsByDx(dcb.filterTreatmentsForActiveDx(TX, { B: true, A: true }), { B: true, A: true });
assert('memberships identical under reorder', membership(groupsAB) === membership(groupsBA));
assert('totals identical under reorder', Object.keys(groupsAB).length === Object.keys(groupsBA).length);

console.log('G3: primary-inactive but active-associated treatment stays visible');
var PRIMARY_INACTIVE = { label: 'Hosted by C', evidence: 'A', synthetic: false, diagnosisId: 'C', diagnosisIds: ['C', 'A'] };
var f3 = dcb.filterTreatmentsForActiveDx([PRIMARY_INACTIVE], { A: true });
var g3 = dcb.groupTreatmentsByDx(f3, { A: true });
assert('visible via association (was: vanished with primary-inactive)', f3.length === 1);
assert('grouped under the active association', (g3.A || []).length === 1 && !g3.C, JSON.stringify(Object.keys(g3)));

console.log('G4: singular diagnosisId fallback');
var f4 = dcb.filterTreatmentsForActiveDx([ONLY_A], { A: true });
var g4 = dcb.groupTreatmentsByDx(f4, { A: true });
assert('singular-id treatment still filters and groups', f4.length === 1 && (g4.A || []).length === 1);
var f4b = dcb.filterTreatmentsForActiveDx([ONLY_A], { B: true });
assert('and still hides when its only dx is inactive', f4b.length === 0);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
