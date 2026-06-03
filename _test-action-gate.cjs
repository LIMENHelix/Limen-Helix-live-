// Test harness for action-selection-gate.js (the dark basal-ganglia gate) and the
// dead arbiter decision-engine.decide(). Treats both as new code. Run: node _test-action-gate.cjs
const assert = require('assert');
const path = require('path');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '  -> ' + (e && e.message)); } }

// ── Browser stubs ───────────────────────────────────────────────────────
const emitted = [];
global.window = {
  _l: {},
  addEventListener: function (type, fn) { (this._l[type] = this._l[type] || []).push(fn); },
  dispatchEvent: function (e) { emitted.push(e); return true; },
  CustomEvent: function (type, opts) { this.type = type; this.detail = opts && opts.detail; }
};
global.window.CustomEvent = global.window.CustomEvent; // ensure on window
global.CustomEvent = global.window.CustomEvent;
global.document = { readyState: 'complete', addEventListener: function () {} };

// ── Load the real modules into the stubbed context ───────────────────────
require(path.join(__dirname, 'assets/js/master-brain/decision-engine.js')); // attaches window.LIMENMasterBrain.decide
const gate = require(path.join(__dirname, 'assets/js/action-selection-gate.js'));

console.log('decision-engine.decide():');
t('decide is a function', function () { assert.strictEqual(typeof global.window.LIMENMasterBrain.decide, 'function'); });
t('decide() with no OIB returns [] (graceful prod state)', function () {
  var r = global.window.LIMENMasterBrain.decide();
  assert(Array.isArray(r) && r.length === 0);
});
t('decide() never throws the executionAllowed invariant on empty input', function () {
  // invariant is structural (throws only if a built decision has executionAllowed!==false);
  // empty-OIB path builds none, so this must simply return [] without throwing.
  global.window.LIMENMasterBrain.decide({ oib: null });
});

console.log('action-selection-gate — selection logic:');
t('single candidate from next-best-action wins', function () {
  global.window.LIMENExecution = { phase10: { nextAction: function () { return { id: 'A', title: 'Action A', _boostedScore: 0.8 }; } } };
  var sel = gate.select();
  assert(sel.winner && sel.winner.action.id === 'A', 'winner should be A');
  assert(sel.suppressed.length === 0);
});
t('highest score wins, rest suppressed', function () {
  global.window.LIMENExecution.decisionSynthesis = { buckets: { executeNow: [{ id: 'B', title: 'B', score: 0.9 }] } };
  var sel = gate.select();
  assert(sel.candidateCount === 2, 'two candidates, got ' + sel.candidateCount);
  assert(sel.winner.action.id === 'B', 'B(0.9) should beat A(0.8)');
  assert(sel.suppressed.length === 1 && sel.suppressed[0].action.id === 'A');
});
t('K3 veto: a DISPUTED higher-score candidate cannot win', function () {
  global.window.LIMENExecution.decisionSynthesis.buckets.executeNow = [{ id: 'D', title: 'Disputed', score: 0.99, epistemicState: 'DISPUTED' }];
  var sel = gate.select();
  assert(sel.vetoed === 1, 'disputed should be vetoed, vetoed=' + sel.vetoed);
  assert(sel.winner.action.id === 'A', 'clean A(0.8) wins over vetoed D(0.99)');
});

console.log('action-selection-gate — DARK safety + ARMED behavior:');
t('DARK (flag off): run() emits NOTHING and writes NOTHING', function () {
  emitted.length = 0;
  var wrote = null;
  global.window.LIMENExecution.phase9 = { decisionMemory: { recordDecisionEvent: function (p) { wrote = p; } } };
  delete global.window.LIMEN_ENABLE_ACTION_GATE;
  gate.run('test-dark');
  assert(emitted.length === 0, 'dark must emit nothing, emitted ' + emitted.length);
  assert(wrote === null, 'dark must write nothing');
});
t('DARK still records observation on getState()', function () {
  var st = gate.getState();
  assert(st.lastSelection && st.lastSelection.enabled === false, 'should record a dark observation');
  assert(st.lastSelection.winner && st.lastSelection.winner.source === 'next-best-action');
});
t('ARMED (flag on): emits limen:action-selected with executionAllowed:false', function () {
  emitted.length = 0;
  var wrote = null;
  global.window.LIMENExecution.phase9 = { decisionMemory: { recordDecisionEvent: function (p) { wrote = p; } } };
  global.window.LIMEN_ENABLE_ACTION_GATE = true;
  gate.run('test-armed');
  assert(emitted.length === 1, 'armed should emit exactly one event, got ' + emitted.length);
  assert(emitted[0].type === 'limen:action-selected');
  assert(emitted[0].detail.executionAllowed === false, 'must never auto-allow execution');
  assert(wrote && wrote.kind === 'action-selected' && wrote.executionAllowed === false, 'must record with executionAllowed:false');
});
t('ARMED winner is the non-vetoed top candidate', function () {
  assert(emitted[0].detail.winner.action.id === 'A');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
