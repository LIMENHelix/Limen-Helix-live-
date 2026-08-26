'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Adapter = require('../assets/js/agriculture-telemetry-adapter.js');

const agriculture = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/domains/p2_agri.json'), 'utf8'));
const drought = agriculture.issues.find(issue => issue.id === 'DROUGHT');
assert.ok(drought, 'p2_agri must contain the DROUGHT diagnosis');

const droughtNodes = new Set((drought._authored || drought.circuits || []).map(row => row.nodeId));
const expectedTriggers = new Set(agriculture.activations
  .filter(row => droughtNodes.has(row.brainNodeId))
  .flatMap(row => row.diagnosticTriggers || []));
assert.ok(expectedTriggers.size > 0, 'DROUGHT circuit must reach p2_agri activation triggers');

const overlay = Adapter.fromPulse({
  agriculture,
  brainState: {
    _activeConditions: ['water_stress'],
    diagnoses: agriculture.issues.map(issue => ({ id: issue.id, active: issue.id === 'DROUGHT' }))
  },
  pulseState: { timestamp: 1234 },
  history: []
});

assert.ok(overlay.activeTriggers.includes('water_stress'), 'raw local condition remains observable');
assert.ok(overlay.activeTriggers.includes('DROUGHT'), 'active local diagnosis remains observable');
for (const trigger of expectedTriggers) {
  assert.ok(overlay.activeTriggers.includes(trigger), 'p2_agri circuit trigger must expand directly: ' + trigger);
}
assert.ok(overlay._bound.includes('activeDiagnosis->p2_agri.circuit->diagnosticTriggers'));
assert.ok(!Object.hasOwn(overlay._unbound, 'activeTriggers->diagnosticTriggers match'));

const adapterSource = fs.readFileSync(path.join(__dirname, '../assets/js/agriculture-telemetry-adapter.js'), 'utf8');
assert.doesNotMatch(adapterSource, /agriculture-condition-trigger-aliases\.json/, 'Agriculture must not fetch a duplicate alias dataset');

console.log('agriculture telemetry: local diagnoses expand directly through p2_agri JSON; no duplicate alias artifact');
