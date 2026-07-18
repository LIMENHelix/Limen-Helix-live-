/**
 * scripts/test-worker-phase-grounding.js — dry-run the server worker's phase-
 * grounding pass in isolation (run: node scripts/test-worker-phase-grounding.js).
 *
 * Reproduces the exact block added to handlers/limen-worker-snapshot.js against a
 * mock domainSummary + domainJoin, proving:
 *   T1  a domain with grounded divergent node evidence gets its snapshot phase
 *       corrected (heuristic p5 -> grounded p8) + canonical label + node-grounded source
 *   T2  stressRanked stays consistent with the grounded phase
 *   T3  a domain with thin evidence ABSTAINS: heuristic phase preserved, marked ungrounded
 *   T4  a domain with no companies abstains (never fabricates)
 *   T5  phaseGroundingStats counts grounded + divergent correctly
 *   T6  invalid-token ('ERROR') scored nodes excluded from evidence
 */
var phasePercept = require('../lib/phase-percept.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function scored(p, n) { var a = []; for (var i = 0; i < n; i++) a.push({ phase: p, scored: true }); return a; }

// mock the two structures the worker has at grounding time
var domainSummary = {
  energy:   { phase: 'p5', phaseLabel: 'ENDURANCE' },   // high stress heuristic
  finance:  { phase: 'p2', phaseLabel: 'RHYTHM' },      // will get divergent evidence
  culture:  { phase: 'p2', phaseLabel: 'RHYTHM' },      // no scored nodes -> abstain
  law:      { phase: 'p3', phaseLabel: 'INSTABILITY' }  // ERROR-token nodes only -> abstain
};
var domainJoin = {
  energy:  { companies: scored('p8', 7).concat(scored('p0', 2)).concat(scored('p3', 2)).concat(scored('p4', 2)).concat(scored('p10', 2)).concat(scored('p1', 1)).concat([{ phase: 'p0', scored: false }, { phase: 'p0', scored: false }]) },
  finance: { companies: scored('p7a', 6) },
  culture: { companies: [{ phase: 'p9', scored: false }, { phase: 'p9', scored: false }] },
  law:     { companies: [{ phase: 'ERROR', scored: true }, { phase: 'ERROR', scored: true }, { phase: 'UNKNOWN', scored: true }] }
};
var stressRanked = [
  { domain: 'energy', phase: 'p5' }, { domain: 'finance', phase: 'p2' },
  { domain: 'culture', phase: 'p2' }, { domain: 'law', phase: 'p3' }
];

// ── the exact grounding pass from the worker ──
var groundedCount = 0, divergentCount = 0;
for (var pk in domainSummary) {
  if (!domainSummary.hasOwnProperty(pk)) continue;
  var dsum = domainSummary[pk];
  var joinRow = domainJoin[pk];
  var pcpt = phasePercept.computePercept({ phase: dsum.phase, source: 'stress-heuristic' }, (joinRow && joinRow.companies) || []);
  dsum.phasePrior = pcpt.prior.phase;
  dsum.phaseGrounded = pcpt.grounded;
  dsum.phasePrecision = pcpt.precision;
  dsum.phaseDivergent = pcpt.divergent;
  dsum.phaseEvidence = { scored: pcpt.evidence.scored, coverage: pcpt.evidence.coverage };
  if (pcpt.grounded) {
    groundedCount++;
    if (pcpt.divergent) divergentCount++;
    dsum.phase = pcpt.groundedPhase;
    dsum.phaseLabel = phasePercept.labelFor(pcpt.groundedPhase) || dsum.phaseLabel;
    dsum.phaseSource = 'node-grounded';
    for (var sri = 0; sri < stressRanked.length; sri++) { if (stressRanked[sri].domain === pk) { stressRanked[sri].phase = pcpt.groundedPhase; break; } }
  } else {
    dsum.phaseSource = 'stress-heuristic';
  }
}
var phaseGroundingStats = { grounded: groundedCount, divergent: divergentCount, total: Object.keys(domainSummary).length };

// ── assertions ──
console.log('T1: energy heuristic p5 -> grounded p8');
assert('energy phase corrected to p8', domainSummary.energy.phase === 'p8', domainSummary.energy.phase);
assert('energy label = PIVOT', domainSummary.energy.phaseLabel === 'PIVOT', domainSummary.energy.phaseLabel);
assert('energy source = node-grounded', domainSummary.energy.phaseSource === 'node-grounded');
assert('energy prior preserved (p5)', domainSummary.energy.phasePrior === 'p5' && domainSummary.energy.phaseDivergent === true);

console.log('T2: stressRanked consistent with grounded phase');
assert('stressRanked energy = p8', stressRanked.find(function (x) { return x.domain === 'energy'; }).phase === 'p8');
assert('finance divergent to p7a in stressRanked', stressRanked.find(function (x) { return x.domain === 'finance'; }).phase === 'p7a');

console.log('T3: culture (no scored nodes) abstains');
assert('culture phase held at heuristic p2', domainSummary.culture.phase === 'p2');
assert('culture marked ungrounded, heuristic source', domainSummary.culture.phaseGrounded === false && domainSummary.culture.phaseSource === 'stress-heuristic');

console.log('T4: law (ERROR-token nodes only) abstains, not fabricated');
assert('law phase held at heuristic p3', domainSummary.law.phase === 'p3');
assert('law evidence.scored = 0 (ERROR excluded)', domainSummary.law.phaseEvidence.scored === 0);

console.log('T5: grounding stats');
assert('2 grounded (energy, finance)', phaseGroundingStats.grounded === 2, JSON.stringify(phaseGroundingStats));
assert('2 divergent (energy, finance)', phaseGroundingStats.divergent === 2);
assert('4 total', phaseGroundingStats.total === 4);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
