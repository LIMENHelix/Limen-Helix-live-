/**
 * scripts/test-adapter-diagnosis-ids.js — every brain adapter that rebuilds
 * canonical_deep treatments must propagate the resolver's diagnosisIds
 * association set, or shared treatments render only under their alphabetical
 * host (Codex P2). Run: node scripts/test-adapter-diagnosis-ids.js
 *
 *   A1  every *-brain.js with source:'canonical_deep' also sets diagnosisIds
 *   A2  defense-style shared treatment groups under EVERY active association
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var BRAINS = fs.readdirSync(path.join(ROOT, 'assets/js/domain-brains'))
  .filter(function (f) { return f.endsWith('-brain.js') && f !== 'domain-console-brain.js' && f !== 'domain-brain-base.js'; });

console.log('A1: every canonical_deep adapter propagates diagnosisIds');
var offenders = [];
BRAINS.forEach(function (f) {
  var src = fs.readFileSync(path.join(ROOT, 'assets/js/domain-brains', f), 'utf8');
  if (src.indexOf("source: 'canonical_deep'") === -1) return;
  if (src.indexOf('diagnosisIds: t.diagnosisIds') === -1) offenders.push(f);
});
assert('all canonical_deep adapters carry diagnosisIds (' + BRAINS.length + ' brains scanned)',
  offenders.length === 0, offenders.join(', '));

console.log('A2: console grouping uses the full association set (shared treatment visible everywhere applicable)');
var store = {};
var win = { location: { pathname: '/domain-console', search: '?domain=defense' }, addEventListener: function () {}, dispatchEvent: function () {} };
global.window = win;
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
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
  getActiveDomain: function () { return 'defense'; },
  getResolvedKey: function () { return 'defense'; },
  getDomainLabel: function () { return 'Defense'; }
};
eval(fs.readFileSync(path.join(ROOT, 'assets/js/domain-brains/domain-console-brain.js'), 'utf8'));
var dcb = win.LIMENDomainConsoleBrain;
var shared = { label: 'Shared Defense Treatment', diagnosisId: 'CYBER_ATTACK', diagnosisIds: ['CYBER_ATTACK', 'DATA_BREACH'] };
var groups = dcb.groupTreatmentsByDx([shared], { CYBER_ATTACK: true, DATA_BREACH: true });
assert('shared treatment groups under host', (groups.CYBER_ATTACK || []).length === 1);
assert('shared treatment groups under second association', (groups.DATA_BREACH || []).length === 1);
assert('entity counted once across groups', groups.CYBER_ATTACK[0] === groups.DATA_BREACH[0]);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
