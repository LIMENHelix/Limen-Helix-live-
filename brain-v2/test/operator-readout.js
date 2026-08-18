/**
 * brain-v2/test/operator-readout.js — brain-v2 is the console authority without leaking
 * kernel packets or restarting the legacy browser brains.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var READOUT = require('../core/operator-readout.js');

var tests = 0, failures = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else {
    failures++;
    console.error('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

console.log('');
console.log('=== BRAIN V2 OPERATOR READOUT ===');

var cycle = {
  domain: 'energy',
  cycleAt: 1234,
  cycle: 8,
  state: { departure: 1.25, confidence: 0.82, totalPrecision: 4.2 },
  sensors: [{
    key: 'crude', state: 'live', liveness: 'fresh', fusable: true,
    value: 99, sourceIdentity: 'secret-source-id',
    departure: { z: 2.1, n: 12 }
  }],
  dysregulation: {
    detected: true, departure: 1.25,
    drivers: [{ key: 'crude', z: 2.1, n: 12 }],
    basis: 'declared test'
  },
  findings: [{ id: 'OIL_SHOCK', active: true, triggeredBy: ['crude'], basis: 'predicate' }],
  candidates: [{ id: 'GRID_COLLAPSE', active: false, triggerSource: 'unevaluated', why: 'requires grid' }],
  blind: [{ what: 'grid', state: 'absent', liveness: 'missing', why: 'no reading' }],
  divergence: { pairs: 1, comparable: 1, detected: false, why: 'within band', divergences: [], skipped: [] }
};

var read = READOUT.fromCycle(cycle);
assert('OR1 identifies brain-v2 as the authority', read.authority === 'brain-v2');
assert('OR2 preserves the measured fused departure', read.state.departure === 1.25);
assert('OR3 preserves confidence separately from departure', read.state.confidence === 0.82);
assert('OR4 carries finding identity and trigger channels',
  read.findings[0].id === 'OIL_SHOCK' && read.findings[0].triggeredBy[0] === 'crude');
assert('OR5 carries unevaluated findings as candidates rather than false negatives',
  read.candidates[0].triggerSource === 'unevaluated');
assert('OR6 carries blind-channel reasons', read.blind[0].why === 'no reading');
assert('OR7 carries declared relationship measurement', read.divergence.comparable === 1);
assert('OR8 raw sensor values do not cross the projection', read.sensors[0].value === undefined);
assert('OR9 source identities do not cross the projection', read.sensors[0].sourceIdentity === undefined);
assert('OR10 the projection is JSON round-trip stable',
  JSON.stringify(JSON.parse(JSON.stringify(read))) === JSON.stringify(read));

var projected = READOUT.publicReport({
  ok: true, runtime: 'brain-v2-shadow/0.1.0', domain: 'energy', product: 'energy',
  startedAt: 1000, finishedAt: 2000, rowsAvailable: 9, rowsApplied: 1, ticks: 1,
  restored: true, abstentions: [], provenance: { channelsRead: 2 },
  operatorRead: read, predictions: { open: 2, resolved: 3 },
  calibration: { status: 'MEASURED' }, relationshipEvidence: [],
  domainFunction: { ticksObserved: 1 }
});
assert('OR11 the public report uses the bounded state', projected.state === read);
assert('OR12 predictions and calibration remain separate facts',
  projected.predictions.resolved === 3 && projected.calibration.status === 'MEASURED');
assert('OR13 missing cycle input stays explicitly null', READOUT.fromCycle(null) === null);
assert('OR14 missing report input stays explicitly null', READOUT.publicReport(null) === null);

var root = path.join(__dirname, '..', '..');
function source(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
var loop = source('brain-v2/kernel/loop.js');
var runtime = source('lib/brain-shadow-runtime.js');
var handler = source('handlers/domain-brain.js');
var route = source('api/[...route].js');
var consoleHtml = source('domain-console.html');
var consoleV2 = source('assets/js/domain-brains/domain-console-v2.js');
var vitals = source('vitals.html');

assert('OR15 every completed tick creates the bounded readout',
  /OPREAD\.fromCycle\(cycle\)/.test(loop));
assert('OR16 the runtime persists the latest tick readout',
  /report\.operatorRead = tickReport\.operatorRead/.test(runtime));
assert('OR17 an idle cycle carries the previous measured readout',
  /priorCycle && priorCycle\.operatorRead/.test(runtime));
assert('OR18 the public handler reads stored cycles and never runs the brain',
  /STORE\.readCycle/.test(handler) && !/runDomain|runDomains|writeCycle|writeState/.test(handler));
assert('OR19 the endpoint is GET-only', /GET only/.test(handler));
assert('OR20 the Hono route exposes domain-brain', /'domain-brain': require\('\.\.\/handlers\/domain-brain'\)/.test(route));
assert('OR21 the domain console starts the v2 renderer',
  /domain-console-v2\.js/.test(consoleHtml));
assert('OR22 the domain console no longer dynamically starts a legacy domain brain',
  !/domain-brains\/'\+domain\+'-brain\.js/.test(consoleHtml) && !/_neuroChain/.test(consoleHtml));
assert('OR23 the renderer reads only the brain-v2 endpoint',
  /\/api\/domain-brain\?domain=/.test(consoleV2) && !/brain-cognition|domain-snapshot/.test(consoleV2));
assert('OR24 Vitals reads brain-v2 rather than the legacy cognition feed',
  /\/api\/domain-brain\?cb=/.test(vitals) && !/\/api\/brain-cognition/.test(vitals));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
if (failures) process.exit(1);
