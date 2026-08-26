'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const Inventory = require('../lib/civilization-control-inventory.js');
const Cadences = require('../lib/civilization-cadence-manifest.js');
const VercelCrons = require('../vercel.json').crons;

const snap = Inventory.snapshot({});
assert.deepEqual(Cadences, VercelCrons, 'runtime cadence manifest must match vercel.json exactly');
assert.equal(snap.summary.runtimeMotorValves, 21, '20 local trunks plus one global emergency valve');
assert.equal(snap.summary.cadencePumps, 47, 'every declared Vercel cadence is visible');
assert.equal(snap.summary.automaticConditionTriggers, 385);
assert.equal(snap.summary.diagnosisGates, 111);
assert.deepEqual(snap.summary.missingDomainTriggerMaps, [], 'all 20 grounded trigger pathways are inventoried');
assert.equal(snap.summary.brainBlocksPerDomain, 18);
assert.equal(snap.summary.brainBlockInstances, 360);
assert.equal(snap.summary.phasesPerDomain, 11);
assert.equal(snap.summary.phaseInstances, 220);
assert.ok(snap.envControls.length > 70, 'the inventory is materially wider than 20 trunk valves');
assert.ok(snap.envControls.every(x => x.valuesExposed === false && !Object.hasOwn(x, 'value')), 'control values and secrets never leave the server');
assert.ok(snap.envControls.every(x => x.source && x.destination), 'every deployment control exposes its control path');
assert.ok(snap.triggersByDomain.every(x => x.pathway && x.pathway.includes(x.domain + ' brain')), 'every trigger map exposes its neural path');

// Agriculture stays in its existing local brain + p2_agri JSON rather than
// duplicating the large anatomy into a second alias artifact. Derive the counts
// here so the lightweight production inventory cannot drift from those sources.
const agriculture = snap.triggersByDomain.find(x => x.domain === 'agriculture');
const agricultureBrain = fs.readFileSync(path.join(__dirname, '../assets/js/domain-brains/agriculture-brain.js'), 'utf8');
const indexMatch = agricultureBrain.match(/this\.diagnosisIndex\s*=\s*(\{[\s\S]*?\n\s*\});/);
assert.ok(indexMatch, 'Agriculture diagnosis index must remain discoverable');
const diagnosisIndex = vm.runInNewContext('(' + indexMatch[1] + ')');
const emitted = new Set(Array.from(agricultureBrain.matchAll(/(?:this\._activeConditions\.push|_add)\(\s*['"]([^'"]+)['"]\s*\)/g), x => x[1]));
const emittedIndexed = new Set(Object.values(diagnosisIndex).flat().filter(code => emitted.has(code)));
const p2Agri = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/domains/p2_agri.json'), 'utf8'));
assert.equal(agriculture.portalIdentity, 'p2_agri');
assert.equal(agriculture.conditionCount, emittedIndexed.size);
assert.equal(agriculture.diagnosisCount, p2Agri.issues.length);
assert.deepEqual(Object.keys(diagnosisIndex).sort(), p2Agri.issues.map(x => x.id).sort(), 'local diagnosis index and p2_agri issues must stay aligned');
assert.match(agriculture.source, /assets\/data\/domains\/p2_agri\.json/);

// Source-level coverage guard: a newly introduced operational env gate or bound
// cannot silently remain absent from the Valve Room inventory.
const root = path.resolve(__dirname, '..');
const files = cp.execFileSync('git', ['ls-files', '*.js', '*.cjs'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean)
  .filter(f => !/(^|\/)(?:test|tests|fixtures)(?:\/|-)/i.test(f) && !/^scripts\/test-/i.test(f));
const found = new Set();
const patterns = [
  /(?:process\.env|\benv)\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /\benv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /switchName\s*:\s*['"]([A-Z][A-Z0-9_]*)['"]/g
];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match; (match = pattern.exec(source));) found.add(match[1]);
  }
}
function operational(name) {
  return /(?:ENABLED|DISABLED|AUTONOMY|_CAP|_BUDGET|_LIMIT|MAX_|MIN_|TOKENS_PER_TICK|RECOVERY|RESERVE|OPERATION_COST|THRESHOLD|CADENCE|INTERVAL|_TTL)/.test(name) &&
    !/(?:ADMIN|SECRET|PASSWORD|_KEY$|_TOKEN$|MODEL$)/.test(name);
}
const registered = new Set(snap.envControls.map(x => x.name));
const missing = Array.from(found).filter(operational).filter(name => !registered.has(name)).sort();
assert.deepEqual(missing, [], 'operational controls missing from inventory: ' + missing.join(', '));

console.log('civilization control inventory: 21 runtime valves, all env controls, 47 cadences, 385 triggers, 111 diagnoses, B0-B17 and P0-P10 visible');
