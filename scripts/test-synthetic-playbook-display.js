/**
 * scripts/test-synthetic-playbook-display.js — synthetic scaffold can never
 * render FULL playbook authority. Run: node scripts/test-synthetic-playbook-display.js
 *
 * Review finding (PR #386): digest-built treatments are 100% synthetic yet the
 * console displayed them without a badge and could classify the playbook FULL
 * with EV: A. The classifier now gates on t.synthetic.
 *
 *   T1  synthetic-only playbook -> CANDIDATE (never FULL), badge names scaffold
 *   T2  mixed synthetic + verified -> CANDIDATE (never FULL)
 *   T3  no synthetic, evidence present -> FULL (gate does not over-fire)
 *   T4  badge renderer emits the scaffold badge text for T1's authority
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
global.requestAnimationFrame = function () {};   // never boot
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
assert('console brain seam exposed', !!(dcb && dcb.classifyPanelAuthority));

var brain = { cycleInterval: 30000 };
function stateWith(treatments) {
  return { status: 'RUNNING', updated: Date.now(), treatments: treatments };
}
var SYN = { label: 'Deploy X Assessment Protocol', evidence: 'A', synthetic: true, diagnosisId: 'D1' };
var REAL = { label: 'Circuit Breaker Protocol', evidence: 'A', diagnosisId: 'D1' };

console.log('T1: synthetic-only -> CANDIDATE, never FULL');
var a1 = dcb.classifyPanelAuthority('playbook', brain, stateWith([SYN, SYN]), {});
assert('level is CANDIDATE', a1.level === 'CANDIDATE', a1.level);
assert('level is not FULL', a1.level !== 'FULL');
assert('badge names synthetic scaffold', /SYNTHETIC/i.test(a1.badge || ''), a1.badge);

console.log('T2: mixed synthetic + verified -> CANDIDATE, never FULL');
var a2 = dcb.classifyPanelAuthority('playbook', brain, stateWith([SYN, REAL]), {});
assert('level is CANDIDATE', a2.level === 'CANDIDATE', a2.level);
assert('level is not FULL', a2.level !== 'FULL');

console.log('T3: no synthetic, evidence present -> FULL (no over-fire)');
var a3 = dcb.classifyPanelAuthority('playbook', brain, stateWith([REAL, REAL]), {});
assert('level is FULL', a3.level === 'FULL', a3.level + ' :: ' + a3.badge);

console.log('T4: badge renderer surfaces the scaffold badge');
var badgeHtml = dcb.renderPanelAuthorityBadge(a1);
assert('badge html non-empty and names scaffold', /SYNTHETIC/i.test(badgeHtml));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
