'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const Inventory = require('../lib/civilization-control-inventory.js');
const Cadences = require('../lib/civilization-cadence-manifest.js');
const VercelCrons = require('../vercel.json').crons;

const snap = Inventory.snapshot({});
assert.deepEqual(Cadences, VercelCrons, 'runtime cadence manifest must match vercel.json exactly');
assert.equal(snap.summary.runtimeMotorValves, 21, '20 local trunks plus one global emergency valve');
assert.equal(snap.summary.cadencePumps, 47, 'every declared Vercel cadence is visible');
assert.equal(snap.summary.automaticConditionTriggers, 358);
assert.equal(snap.summary.diagnosisGates, 105);
assert.deepEqual(snap.summary.missingDomainTriggerMaps, ['agriculture'], 'missing trigger anatomy is explicit');
assert.equal(snap.summary.brainBlocksPerDomain, 18);
assert.equal(snap.summary.brainBlockInstances, 360);
assert.equal(snap.summary.phasesPerDomain, 11);
assert.equal(snap.summary.phaseInstances, 220);
assert.ok(snap.envControls.length > 70, 'the inventory is materially wider than 20 trunk valves');
assert.ok(snap.envControls.every(x => x.valuesExposed === false && !Object.hasOwn(x, 'value')), 'control values and secrets never leave the server');
assert.ok(snap.envControls.every(x => x.source && x.destination), 'every deployment control exposes its control path');
assert.ok(snap.triggersByDomain.every(x => x.pathway && x.pathway.includes(x.domain + ' brain')), 'every trigger map exposes its neural path');

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

console.log('civilization control inventory: 21 runtime valves, all env controls, 47 cadences, 358 triggers, 105 diagnoses, B0-B17 and P0-P10 visible');
