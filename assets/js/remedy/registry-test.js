/**
 * Registry Test Suite
 * Run: node assets/js/remedy/registry-test.js
 */
var Schema = require('../schema/fractal-report-schema.js');
global.LIMENFractalSchema = Schema;
var Registry = require('./limen-remedy-registry.js');
var fs = require('fs');

var pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  PASS:', name); }
  else { fail++; console.log('  FAIL:', name); }
}

// ═══ TEST 1: Core API ═══
console.log('=== TEST 1: Core API exists ===');
assert('registerTreatment', typeof Registry.registerTreatment === 'function');
assert('registerDiagnosis', typeof Registry.registerDiagnosis === 'function');
assert('getTreatmentsForDiagnosis', typeof Registry.getTreatmentsForDiagnosis === 'function');
assert('getTreatmentsForDomain', typeof Registry.getTreatmentsForDomain === 'function');
assert('getTreatmentsForCircuit', typeof Registry.getTreatmentsForCircuit === 'function');
assert('getStepsForTreatment', typeof Registry.getStepsForTreatment === 'function');
assert('harvestFromPortal', typeof Registry.harvestFromPortal === 'function');
assert('buildResolverRegistry', typeof Registry.buildResolverRegistry === 'function');
assert('prioritize', typeof Registry.prioritize === 'function');
assert('dump', typeof Registry.dump === 'function');
assert('dumpRemedyRegistry global', typeof global.dumpRemedyRegistry === 'function');

// ═══ TEST 2: Manual registration ═══
console.log('\n=== TEST 2: Manual registration ===');
Registry.clear();
var txId = Registry.registerTreatment({
  id: 'tx-test-1', title: 'Test Treatment', type: 'strategy',
  rationale: 'Testing', scaleTags: ['global'], timeTags: ['immediate'],
  steps: [{ id: 's1', action: 'Do thing', sequence: 1, targetLevel: 'domain', expectedEffect: 'Good', dependencies: [] }],
  confidence: 0.8, evidence: { sources: ['Test'], method: 'test', grade: 'B+' }
}, { diagnosisId: 'dx-1', domainId: 'energy', circuits: ['Insula', 'dlPFC'] });
assert('registerTreatment returns id', txId === 'tx-test-1');
assert('getTreatmentsForDiagnosis', Registry.getTreatmentsForDiagnosis('dx-1').length === 1);
assert('getTreatmentsForDomain', Registry.getTreatmentsForDomain('energy').length === 1);
assert('getTreatmentsForCircuit Insula', Registry.getTreatmentsForCircuit('Insula').length === 1);
assert('getTreatmentsForCircuit dlPFC', Registry.getTreatmentsForCircuit('dlPFC').length === 1);
assert('getStepsForTreatment', Registry.getStepsForTreatment('tx-test-1').length === 1);

// ═══ TEST 3: Diagnosis registration ═══
console.log('\n=== TEST 3: Diagnosis registration ===');
Registry.clear();
var dxId = Registry.registerDiagnosis({
  id: 'dx-oil', title: 'Oil Disruption', description: 'Supply disruption',
  severity: 'critical',
  indicators: [{ id: 'i1', label: 'Spare capacity', value: 1.2, threshold: 2.0, direction: 'falling' }],
  circuits: [{ nodeId: 'Insula', dir: 'Hyper-active' }, { nodeId: 'ACC', dir: 'Altered' }],
  treatments: [{
    id: 'tx-spr', title: 'SPR Release', type: 'regulatory',
    rationale: 'Bridge supply gap', scaleTags: ['global'], timeTags: ['immediate'],
    steps: [{ id: 'tx-spr-s1', action: 'Convene IEA', sequence: 1, targetLevel: 'civilization', expectedEffect: 'Assessment', dependencies: [] }],
    evidence: { sources: ['IEA'], method: 'historical', grade: 'B+' }, confidence: 0.7
  }]
}, { domainId: 'energy', portalId: 'energy_oil_gas' });
assert('diagnosis registered', dxId === 'dx-oil');
assert('treatment indexed via diagnosis', Registry.getTreatmentsForDiagnosis('dx-oil').length === 1);
assert('treatment indexed via domain', Registry.getTreatmentsForDomain('energy').length === 1);
assert('treatment indexed via circuit', Registry.getTreatmentsForCircuit('Insula').length === 1);
assert('treatment indexed via portal', Registry.getTreatmentsForPortal('energy_oil_gas').length === 1);
assert('diagnosis query', Registry.getDiagnosis('dx-oil').title === 'Oil Disruption');
assert('diagnoses for domain', Registry.getDiagnosesForDomain('energy').length === 1);
assert('diagnoses for circuit', Registry.getDiagnosesForCircuit('Insula').length === 1);

// ═══ TEST 4: Portal harvesting ═══
console.log('\n=== TEST 4: Portal harvesting (defense_special_ops) ===');
Registry.clear();
var raw = JSON.parse(fs.readFileSync('assets/data/domains/defense_special_ops.json', 'utf8'));
var count = Registry.harvestFromPortal(raw);
assert('harvested treatments > 0', count > 0);
console.log('  harvested:', count, 'treatments');
var st = Registry.stats();
assert('diagnoses registered', st.diagnoses > 0);
assert('treatments registered > 0', st.treatments > 0);
assert('steps registered', st.steps > 0);
assert('circuits indexed', st.indexKeys.byCircuit > 0);
assert('portal cached', st.scannedPortals === 1);

// Re-harvest same portal — should be cached
var count2 = Registry.harvestFromPortal(raw);
assert('cache prevents re-scan', count2 === 0);

// ═══ TEST 5: Cross-domain propagation ═══
console.log('\n=== TEST 5: Cross-domain propagation ===');
var circuitTx = Registry.getTreatmentsOnCircuitActivation('PI');
assert('circuit activation returns treatments', circuitTx.length > 0);

var domainTx = Registry.getTreatmentsOnDomainStress('security', 0.8);
assert('domain stress returns treatments', domainTx.length > 0);

// ═══ TEST 6: Indicator matching ═══
console.log('\n=== TEST 6: Indicator matching ===');
Registry.clear();
Registry.registerDiagnosis({
  id: 'dx-ind', title: 'Test', description: 'Test',
  severity: 'high',
  indicators: [{ id: 'oil_spare', label: 'Spare Cap', value: 1.2, threshold: 2.0, direction: 'falling' }],
  treatments: [{
    id: 'tx-ind', title: 'Fix', type: 'strategy', rationale: 'Fix it',
    scaleTags: ['local'], timeTags: ['immediate'],
    steps: [{ id: 'tx-ind-s1', action: 'Act', sequence: 1, targetLevel: 'domain', expectedEffect: 'E', dependencies: [] }]
  }]
}, { domainId: 'energy' });
var indTx = Registry.getTreatmentsOnIndicatorMatch({ oil_spare: 1.0 });
assert('indicator match returns treatments', indTx.length === 1);
var noMatch = Registry.getTreatmentsOnIndicatorMatch({ oil_spare: 5.0 });
assert('indicator no-match returns empty', noMatch.length === 0);

// ═══ TEST 7: Priority ordering ═══
console.log('\n=== TEST 7: Priority ordering ===');
Registry.clear();
var raw2 = JSON.parse(fs.readFileSync('assets/data/domains/defense_special_ops.json', 'utf8'));
Registry.harvestFromPortal(raw2);
var allTx = Registry.getTreatmentsForDomain('security');
var sorted = Registry.prioritize(allTx, { domainStress: { security: 0.85 } });
assert('prioritize returns same count', sorted.length === allTx.length);
// Determinism
var sorted2 = Registry.prioritize(allTx, { domainStress: { security: 0.85 } });
var sameOrder = true;
for (var i = 0; i < sorted.length; i++) {
  if (sorted[i].id !== sorted2[i].id) { sameOrder = false; break; }
}
assert('priority ordering is deterministic', sameOrder);

// ═══ TEST 8: Resolver bridge ═══
console.log('\n=== TEST 8: Resolver bridge ===');
var reg = Registry.buildResolverRegistry();
assert('registry has remedies', reg.remedies.length > 0);
assert('registry has index', reg.index !== null);
assert('index.byScale exists', !!reg.index.byScale);
assert('index.byPattern exists', !!reg.index.byPattern);
assert('index.byNode exists', !!reg.index.byNode);
assert('index.byDomain exists', !!reg.index.byDomain);
assert('index.byPortal exists', !!reg.index.byPortal);
assert('index.byType exists', !!reg.index.byType);
assert('index.byEvidence exists', !!reg.index.byEvidence);
assert('global.LIMENRemedyRegistry populated', global.LIMENRemedyRegistry === reg);
assert('remedyCount matches', reg.remedyCount === reg.remedies.length);
console.log('  remedyCount:', reg.remedyCount);

// Check remedy shape
var rem = reg.remedies[0];
assert('remedy.id is string', typeof rem.id === 'string');
assert('remedy.state is ACTIVE', rem.state === 'ACTIVE');
assert('remedy.scale is string', typeof rem.scale === 'string');
assert('remedy.linkedNodes is array', Array.isArray(rem.linkedNodes));
assert('remedy.addressesPatterns is array', Array.isArray(rem.addressesPatterns));
assert('remedy.confidence is number', typeof rem.confidence === 'number');
assert('remedy.mechanism is string', typeof rem.mechanism === 'string');
assert('remedy.scalePayload is object', typeof rem.scalePayload === 'object');
assert('remedy.confidenceDetail is object', typeof rem.confidenceDetail === 'object');
assert('remedy.evidenceType exists', typeof rem.evidenceType === 'string');

// ═══ TEST 9: Schema validation ═══
console.log('\n=== TEST 9: Schema validation of registered treatments ===');
var secTx = Registry.getTreatmentsForDomain('security');
var validCount = 0, invalidCount = 0;
for (var vi = 0; vi < Math.min(secTx.length, 10); vi++) {
  var vr = Schema.validateTreatment(secTx[vi]);
  if (vr.valid) validCount++;
  else { invalidCount++; console.log('    invalid:', vr.errors[0].path, vr.errors[0].message); }
}
assert('treatments validate (' + validCount + '/' + (validCount + invalidCount) + ')', invalidCount === 0);

// ═══ TEST 10: Batch harvest ═══
console.log('\n=== TEST 10: Batch harvest ===');
Registry.clear();
var files = ['legal_defense.json', 'defense_special_ops.json'];
var jsons = files.map(function(f) { return JSON.parse(fs.readFileSync('assets/data/domains/' + f, 'utf8')); });
var batchCount = Registry.harvestBatch(jsons);
assert('batch harvest > 0', batchCount > 0);
assert('2 portals scanned', Registry.stats().scannedPortals === 2);
console.log('  batch total:', batchCount);

// ═══ TEST 11: Debug dump ═══
console.log('\n=== TEST 11: Debug dump ===');
var dumpOutput = Registry.dump();
assert('dump returns string', typeof dumpOutput === 'string');
assert('dump includes DOMAINS', dumpOutput.indexOf('DOMAINS') !== -1);
assert('dump includes DIAGNOSES', dumpOutput.indexOf('DIAGNOSES') !== -1);
assert('dump includes TREATMENTS', dumpOutput.indexOf('TREATMENTS') !== -1);
assert('dump includes STEPS', dumpOutput.indexOf('STEPS') !== -1);
assert('dump includes INDEXES', dumpOutput.indexOf('INDEXES') !== -1);
assert('dump includes SCANNED PORTALS', dumpOutput.indexOf('SCANNED PORTALS') !== -1);

// ═══ TEST 12: Invalid data rejected ═══
console.log('\n=== TEST 12: Validation rejects invalid data ===');
Registry.clear();
var badTx = Registry.registerTreatment({ id: '', title: '' });
assert('empty id rejected', badTx === null);
var badDx = Registry.registerDiagnosis({ id: '' });
assert('empty diagnosis rejected', badDx === null);
var badStep = Registry.registerStep({});
assert('empty step rejected', badStep === null);

// ═══ RESULTS ═══
console.log('\n========================================');
console.log(pass + '/' + (pass + fail) + ' tests PASS');
if (fail > 0) console.log(fail + ' FAILED');
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
