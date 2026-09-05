#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildK3RelationalReading, inspectK3RelationalTopology } from './lib/k3-relational-kernel.mjs';

const relationship = (category, index) => ({
  category,
  entry: {
    name: `${category}-${index}`,
    brainNodeId: `N${index}`,
    neuralRole: `role-${index % 5}`,
    brainNodeRole: 'measured topology',
    confidence: 'medium',
    sourceType: ['industry-report']
  }
});
const categories = ['suppliers', 'customers', 'competitors', 'regulators', 'capitalProviders', 'marketSignals'];
const rows = Array.from({ length: 20 }, (_, index) => relationship(categories[index % categories.length], index));
const portal = { functionalNetwork: Object.fromEntries(categories.map(category => [category, rows.filter(row => row.category === category).map(row => row.entry)])) };
const at = '2026-09-04T12:00:00.000Z';

const inspection = inspectK3RelationalTopology(portal);
assert.equal(inspection.eligible, true);
assert.equal(inspection.metrics.relationshipCount, 20);
const { reading } = buildK3RelationalReading(portal, at);
assert.equal(reading.state, 'RELATIONAL_MAP_OBSERVED');
assert.equal(reading.phase, null);
assert.equal(reading.composite, null);
assert.equal(reading.alert, false);
assert.ok(reading.limitations.includes('NOT_OUTCOME_VALIDATED'));

const weak = structuredClone(portal);
weak.functionalNetwork = { suppliers: weak.functionalNetwork.suppliers };
const weakInspection = inspectK3RelationalTopology(weak);
assert.equal(weakInspection.eligible, false);
assert.ok(weakInspection.failedGates.includes('relationships'));
assert.ok(weakInspection.failedGates.includes('categories'));

const sandbox = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/kernel-reading-helper.js', import.meta.url), 'utf8'), sandbox);
const helperPortal = { kernelReadings: { k1: null, k2: null, k3: reading, primary: 'k3' } };
assert.equal(sandbox.globalThis.LIMENKernelReading.readK3(helperPortal).state, 'RELATIONAL_MAP_OBSERVED');
assert.equal(sandbox.globalThis.LIMENKernelReading.getPrimaryReading(helperPortal).kind, 'k3');
assert.equal(sandbox.globalThis.LIMENKernelReading.getPrimaryReading(helperPortal).phase, null);

const uiSource = fs.readFileSync(new URL('../assets/js/company-portal-ui.js', import.meta.url), 'utf8');
assert.ok(uiSource.includes('Interpretive topology only · not a financial phase · not outcome-validated'));
assert.ok(uiSource.includes('window.LIMENKernelReading.getPrimaryReading(co)'));

console.log('PASS K3 eligibility requires broad, tagged, sourced relational topology');
console.log('PASS K3 emits no financial phase, composite, or alert claim');
console.log('PASS kernel helper resolves a state-only K3 fallback');
console.log('PASS company portal labels K3 without presenting it as financial health');
