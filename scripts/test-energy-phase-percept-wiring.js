/**
 * scripts/test-energy-phase-percept-wiring.js — dry-run the phase percept
 * through the REAL energy-brain wiring against page stubs
 * (run: node scripts/test-energy-phase-percept-wiring.js).
 *
 *   T1  _computeEnergyPhasePercept runs and reads the prior from
 *       energyPhaseDynamics.myPhase (not the stress heuristic)
 *   T2  scored nodes on state.companies GROUND the percept; ungrounded when absent
 *   T3  grounded evidence that disagrees with the prior sets wouldChange + logs a divergence
 *   T4  the percept never writes state.phase / state.phaseLabel (shadow discipline)
 */
var fs = require('fs');
var path = require('path');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var win = { location: { pathname: '/', search: '' }, LIMENDomainBrains: { register: function () {} }, addEventListener: function () {} };
global.window = win;
function BaseStub(cfg) {
  this.config = cfg || {};
  this.state = { stress: 0.6, phase: 'p2', phaseLabel: 'RHYTHM', diagnoses: [], opportunities: [], companies: [], memory: { stressHistory: [] }, confidence: 0.8 };
  this._externalSignals = [];
}
BaseStub.prototype.init = function () {}; BaseStub.prototype.start = function () {};
BaseStub.prototype.getExternalPressure = function () { return 0.1; };
win.LIMENDomainBrainBase = BaseStub;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };

function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/limen-phase-percept.js');
assert('phase-percept module attached to window', !!win.LIMENPHASE);

var loaded = true, err = null;
try { loadScript('assets/js/domain-brains/energy-brain.js'); } catch (e) { loaded = false; err = e; }
assert('energy-brain.js loads + self-instantiates', loaded && !!win.LIMENEnergyBrain, err && (err.message + '\n' + (err.stack || '').split('\n').slice(0, 4).join('\n')));
if (!loaded || !win.LIMENEnergyBrain) { console.error('cannot continue'); process.exit(1); }
var brain = win.LIMENEnergyBrain;

// T1 + T2a — ungrounded when no scored nodes; prior read from energyPhaseDynamics
console.log('T1/T2a: prior source + ungrounded with no evidence');
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM';
brain.state.energyPhaseDynamics = { myPhase: 'p3', phaseSource: 'thing2-kernel' };
brain.state.companies = [{ name: 'A', phase: 'p3', scored: false }, { name: 'B', phase: 'p3', scored: false }];
var p1 = brain._computeEnergyPhasePercept();
assert('percept produced, shadow mode', !!p1 && p1.mode === 'shadow');
assert('prior taken from energyPhaseDynamics.myPhase (p3), not stress heuristic (p2)', p1.prior.phase === 'p3' && p1.prior.source === 'thing2-kernel', JSON.stringify(p1.prior));
assert('no scored nodes ⇒ ungrounded, holds prior', p1.grounded === false && p1.groundedPhase === 'p3');

// T2b — scored nodes ground it
console.log('T2b: scored nodes ground the percept');
brain.state.companies = [
  { name: 'A', phase: 'p3', scored: true }, { name: 'B', phase: 'p3', scored: true },
  { name: 'C', phase: 'p3', scored: true }, { name: 'D', phase: 'p3', scored: true }
];
var p2 = brain._computeEnergyPhasePercept();
assert('grounded on scored evidence', p2.grounded === true && p2.evidence.scored === 4);
assert('grounded phase = p3, aligned with prior', p2.groundedPhase === 'p3' && p2.divergent === false);

// T3 — divergent evidence
console.log('T3: grounded evidence disagreeing with prior');
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM';
brain.state.energyPhaseDynamics = { myPhase: 'p2', phaseSource: 'fallback' };
brain.state.companies = [
  { name: 'A', phase: 'p7a', scored: true }, { name: 'B', phase: 'p7a', scored: true },
  { name: 'C', phase: 'p7a', scored: true }, { name: 'D', phase: 'p7a', scored: true },
  { name: 'E', phase: 'p7a', scored: true }
];
var p3 = brain._computeEnergyPhasePercept();
assert('winner flips to node evidence (p7a)', p3.groundedPhase === 'p7a', p3.groundedPhase);
assert('divergent flagged + prediction error > 0', p3.divergent === true && p3.predictionError.magnitude > 0);
assert('wouldChange vs live phase (p2)', p3.wouldChange === true && p3.livePhase === 'p2');
assert('divergence logged', Array.isArray(p3.divergenceLog) && p3.divergenceLog.length >= 1);

// T4 — the percept FUNCTION itself never writes s.phase (arming is the caller's job)
console.log('T4: percept function is pure (does not arm on its own)');
assert('direct percept call left state.phase untouched (p2)', brain.state.phase === 'p2');

// T5 — ARMING via phase dynamics: grounded divergent evidence sets the live phase
console.log('T5: _computeEnergyPhaseDynamics ARMS the grounded phase');
brain._kernelPhase = null;                       // no Thing2 adapter in stub ⇒ prior = s.phase
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM'; brain.state.phaseSource = 'fallback';
brain._phaseHistory = [];
brain.state.companies = [
  { name: 'A', phase: 'p7a', scored: true }, { name: 'B', phase: 'p7a', scored: true },
  { name: 'C', phase: 'p7a', scored: true }, { name: 'D', phase: 'p7a', scored: true },
  { name: 'E', phase: 'p7a', scored: true }
];
var pd = brain._computeEnergyPhaseDynamics();
assert('authoritative phase = node-grounded p7a', pd.myPhase === 'p7a', pd.myPhase);
assert('prior preserved separately (p2)', pd.priorPhase === 'p2' && pd.grounded === true);
assert('phaseSource = node-grounded', pd.phaseSource === 'node-grounded');
assert('LIVE state.phase ARMED to p7a', brain.state.phase === 'p7a', brain.state.phase);
assert('state.phaseLabel = TERMINAL (canonical)', brain.state.phaseLabel === 'TERMINAL', brain.state.phaseLabel);
assert('router/transition ran on the grounded phase (hist records p7a)', brain._phaseHistory[brain._phaseHistory.length - 1].phase === 'p7a');

// T6 — REVERSIBILITY: flag off ⇒ reverts to the prior-only heuristic, no arming
console.log('T6: _actuation.phasePercept=false reverts to prior-only');
brain._actuation.phasePercept = false;
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM';
var pdOff = brain._computeEnergyPhaseDynamics();
assert('authoritative phase falls back to the kernel/heuristic prior (p2)', pdOff.myPhase === 'p2', pdOff.myPhase);
assert('grounded still reported for transparency', pdOff.grounded === true);
assert('state.phase NOT armed (stays p2)', brain.state.phase === 'p2');
brain._actuation.phasePercept = true;            // restore

// T7 — thin evidence ⇒ abstain: no scored nodes, phase dynamics holds the prior
console.log('T7: no scored nodes ⇒ phase dynamics holds the prior (no fabrication)');
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM';
brain.state.companies = [{ name: 'X', phase: 'p9', scored: false }, { name: 'Y', phase: 'p9', scored: false }];
var pdThin = brain._computeEnergyPhaseDynamics();
assert('ungrounded ⇒ authoritative = prior (p2)', pdThin.myPhase === 'p2' && pdThin.grounded === false);
assert('state.phase held at prior, not fabricated to p9', brain.state.phase === 'p2');

// T8 — the LAST HOP: grounding fields reach getEnergyStateSummary (what the AI payload reads)
console.log('T8: getEnergyStateSummary exposes the grounding fields for the AI');
brain.state.phase = 'p2'; brain.state.phaseLabel = 'RHYTHM';
brain.state.companies = [
  { name: 'A', phase: 'p7a', scored: true }, { name: 'B', phase: 'p7a', scored: true },
  { name: 'C', phase: 'p7a', scored: true }, { name: 'D', phase: 'p7a', scored: true }, { name: 'E', phase: 'p7a', scored: true }
];
brain._computeEnergyPhaseDynamics();               // grounds + arms to p7a, divergent from p2
var sum = brain.getEnergyStateSummary();
assert('summary.phaseGrounded true', sum.phaseGrounded === true, JSON.stringify({ g: sum.phaseGrounded, d: sum.phaseDivergent, p: sum.phasePrior }));
assert('summary.phaseDivergent true (grounded p7a vs heuristic p2)', sum.phaseDivergent === true);
assert('summary.phasePrior = p2 (the stress heuristic the AI names alongside the grounded phase)', sum.phasePrior === 'p2');
assert('summary.phaseSource = node-grounded', sum.phaseSource === 'node-grounded');
assert('summary.phase = the grounded p7a', sum.phase === 'p7a');

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
