/**
 * scripts/test-synthetic-playbook-display.js — provenance-based playbook authority.
 * Run: node scripts/test-synthetic-playbook-display.js
 *
 * Verified status requires an AFFIRMATIVE machine-checkable classification
 * (synthetic === false). Unknown provenance (flag absent) is UNVERIFIED.
 * Authority is classified on the exact filtered array the panel renders.
 *
 *   T1  synthetic-only -> CANDIDATE (never FULL), badge names scaffold
 *   T2  mixed synthetic + verified -> CANDIDATE, PROVENANCE breakdown
 *   T3  all affirmatively verified (synthetic === false) -> FULL
 *   T4  badge renderer emits the badge text
 *   T5  unknown-provenance only -> CANDIDATE, badge names unverified
 *   T6  invisible (inactive-dx) synthetic does not downgrade the rendered set;
 *       badge counts equal the rendered (ctx) counts
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
assert('console brain seam exposed', !!(dcb && dcb.classifyPanelAuthority));

var brain = { cycleInterval: 30000 };
function stateWith(treatments) {
  return { status: 'RUNNING', updated: Date.now(), treatments: treatments };
}
var SYN = { label: 'Deploy X Assessment Protocol', evidence: 'A', synthetic: true, diagnosisId: 'D1' };
var VER = { label: 'Circuit Breaker Protocol', evidence: 'A', synthetic: false, diagnosisId: 'D1' };
var UNK = { label: 'Unclassified Resolver Treatment', evidence: 'A', diagnosisId: 'D1' };

console.log('T1: synthetic-only -> CANDIDATE, never FULL');
var a1 = dcb.classifyPanelAuthority('playbook', brain, stateWith([SYN, SYN]), {});
assert('level is CANDIDATE', a1.level === 'CANDIDATE', a1.level);
assert('level is not FULL', a1.level !== 'FULL');
assert('badge names synthetic scaffold', /SYNTHETIC/i.test(a1.badge || ''), a1.badge);

console.log('T2: mixed synthetic + verified -> CANDIDATE, PROVENANCE breakdown');
var a2 = dcb.classifyPanelAuthority('playbook', brain, stateWith([SYN, VER]), {});
assert('level is CANDIDATE, not FULL', a2.level === 'CANDIDATE' && a2.level !== 'FULL', a2.level);
assert('badge breaks down provenance', /PROVENANCE/i.test(a2.badge || '') && /1 scaffold/.test(a2.badge) && /1 verified/.test(a2.badge), a2.badge);

console.log('T3: all affirmatively verified -> FULL');
var a3 = dcb.classifyPanelAuthority('playbook', brain, stateWith([VER, VER]), {});
assert('level is FULL', a3.level === 'FULL', a3.level + ' :: ' + a3.badge);

console.log('T4: badge renderer surfaces the badge');
assert('badge html names scaffold', /SYNTHETIC/i.test(dcb.renderPanelAuthorityBadge(a1)));

console.log('T5: unknown provenance -> CANDIDATE, names unverified (never silently verified)');
var a5 = dcb.classifyPanelAuthority('playbook', brain, stateWith([UNK, UNK]), {});
assert('level is CANDIDATE, not FULL', a5.level === 'CANDIDATE' && a5.level !== 'FULL', a5.level);
assert('badge names unverified', /unverified/i.test(a5.badge || ''), a5.badge);

console.log('T6: authority classifies the rendered set (ctx.treatments), not invisible state entries');
// state.treatments carries scaffold from an INACTIVE diagnosis (invisible after
// filtering); the rendered set (ctx.treatments) is all verified -> must be FULL,
// and badge counts must equal rendered counts.
var invisibleSyn = { label: 'Deploy Inactive Assessment', evidence: 'A', synthetic: true, diagnosisId: 'INACTIVE_DX' };
var a6 = dcb.classifyPanelAuthority('playbook', brain,
  stateWith([VER, VER, invisibleSyn]),
  { treatments: [VER, VER] });
assert('level is FULL when rendered set is all verified', a6.level === 'FULL', a6.level + ' :: ' + a6.badge);
var a6b = dcb.classifyPanelAuthority('playbook', brain,
  stateWith([VER, VER, invisibleSyn]), {});   // no ctx -> falls back to unfiltered state
assert('unfiltered fallback sees the scaffold (not FULL)', a6b.level !== 'FULL', a6b.level);

console.log('T7: empty rendered set -> NO_CONTENT (not a malformed provenance badge)');
// All diagnoses deactivated by validation; stale treatments linger in state,
// but the rendered (filtered) set is empty.
var a7 = dcb.classifyPanelAuthority('playbook', brain,
  stateWith([SYN, VER]),
  { treatments: [] });
assert('level is NO_CONTENT', a7.level === 'NO_CONTENT', a7.level + ' :: ' + a7.badge);
assert('no badge emitted', !a7.badge, a7.badge);
assert('badge renderer emits nothing for NO_CONTENT', dcb.renderPanelAuthorityBadge(a7) === '');

console.log('T8: empty + unmapped -> NO_CONTENT, not ONTOLOGY COVERAGE INCOMPLETE');
var a8 = dcb.classifyPanelAuthority('playbook', brain,
  stateWith([SYN, VER]),
  { treatments: [], unmappedConditionCount: 4 });
assert('level is NO_CONTENT (ordering fixed)', a8.level === 'NO_CONTENT', a8.level + ' :: ' + a8.badge);
assert('no ontology badge on empty set', !a8.badge, a8.badge);
// control: NON-empty set with unmapped conditions still gets the ontology downgrade
var a8b = dcb.classifyPanelAuthority('playbook', brain,
  stateWith([VER, VER]),
  { treatments: [VER, VER], unmappedConditionCount: 4 });
assert('non-empty + unmapped still yields ONTOLOGY downgrade', /ONTOLOGY/.test(a8b.badge || ''), a8b.badge);

console.log('T9: untagged records fall back to machine-checkable classification (all-domain rule)');
// communication-style resolver treatment: no synthetic flag, but cite + steps
// (hasDepth) and a non-mad-lib label => verified-eligible, not permanent downgrade
var DEEP_UNTAGGED = { label: 'Circuit Breaker Coordination Protocol', evidence: 'A', hasDepth: true, diagnosisId: 'D1', cite: 'Authored study (2024), section 3', steps: ['Record the circuit breaker state before resetting it.'] };
var a9 = dcb.classifyPanelAuthority('playbook', brain, stateWith([DEEP_UNTAGGED, DEEP_UNTAGGED]), {});
assert('untagged records with source evidence can render FULL', a9.level === 'FULL', a9.level + ' :: ' + a9.badge);
assert('classifier: actual citation and steps -> 0', dcb.classifyProvenance(DEEP_UNTAGGED) === 0);
assert('classifier: hasDepth without source evidence -> 2', dcb.classifyProvenance({ label: DEEP_UNTAGGED.label, hasDepth: true }) === 2);
// untagged mad-lib label => scaffold (never verified by omission)
var MADLIB_UNTAGGED = { label: 'Deploy Circuit Assessment Protocol', evidence: 'A', hasDepth: true, diagnosisId: 'D1' };
var a9b = dcb.classifyPanelAuthority('playbook', brain, stateWith([MADLIB_UNTAGGED]), {});
assert('untagged mad-lib -> CANDIDATE, not FULL', a9b.level === 'CANDIDATE' && a9b.level !== 'FULL', a9b.level);
assert('classifier: mad-lib label -> 1', dcb.classifyProvenance(MADLIB_UNTAGGED) === 1);
// untagged, no provenance fields => unknown
assert('classifier: no-provenance -> 2', dcb.classifyProvenance(UNK) === 2);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
