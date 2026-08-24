#!/usr/bin/env node
'use strict';

/* Static continuity audit. It identifies field-loss boundaries; it does not
 * claim that homology is validated and it never runs a provider or lane. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const includes = (f, s) => read(f).includes(s);

const packet = read('lib/civilization-server-packet.js');
const caseRecord = read('lib/civilization-case-record.js');
const consumer = read('lib/master-brain-consumer.js');
const refresh = read('handlers/brain-cognition-refresh.js');
const generator = read('lib/engine-output-generator.js');

const packetTruthFields = ['stressScore', 'phase', 'phaseLabel', 'activeDiagnoses', 'treatments', 'opportunities', 'directives'];
const packetPreserves = {
  stress: includes('lib/civilization-server-packet.js', 'stressScore: finite(truth.stressScore'),
  phase: includes('lib/civilization-server-packet.js', 'phase: truth.phase'),
  activeDiagnoses: includes('lib/civilization-server-packet.js', 'activeDiagnoses: clone(arr(truth.activeDiagnoses'),
  opportunities: includes('lib/civilization-server-packet.js', 'opportunities: clone(arr(truth.opportunities'),
  companyContext: /companies\s*:/.test(packet),
  brainNodeContext: /brainNode|brainNodes|functionalNetwork/.test(packet),
  dysregulationContext: /dysregulation|regulatedVariable/.test(packet),
  recoveryContext: /recovery|recoveryEvidence/.test(packet)
};

const caseCoverage = {
  neurologyToBusiness: caseRecord.includes('neurology_to_business_homology: false'),
  businessToNeurology: caseRecord.includes('business_to_neurology_homology: false'),
  kernelDynamics: caseRecord.includes('kernel_dynamics: false'),
  p0P10: caseRecord.includes('p0_p10_proof_and_effects: false'),
  checklistMissing: caseRecord.includes("{ item: 'homology and P0-P10 mappings', status: 'MISSING' }")
};

const outputBridges = {
  generatorReadsPhase: /_kernelPhase\(portal\)/.test(generator),
  generatorReadsBridgePattern: generator.includes('bridgeReadings') && generator.includes('patternId'),
  generatorEmitsInvestment: generator.includes("lane: 'investment'"),
  generatorEmitsResearch: generator.includes("lane: 'research'"),
  masterScoresPhase: consumer.includes('_phaseSeverity') && consumer.includes('phaseSeverity'),
  masterReadsBrainNode: /brainNode|functionalNetwork/.test(consumer),
  masterReadsDysregulation: /dysregulation|regulatedVariable/.test(consumer),
  masterReadsRecovery: /recovery/.test(consumer)
};

const refreshBoundary = {
  buildsServerPacket: refresh.includes('serverPacket.fromBrainState'),
  financeOnlySemanticEvidence: refresh.includes("dom === 'finance'") && refresh.includes('semanticEvidence'),
  passesHomologyContext: /homologyContext|brainNodes|functionalNetwork|companies\s*:/.test(refresh),
  passesCompanyContext: /companies\s*:/.test(refresh)
};

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'static field-continuity audit; no provider, broker, Redis write, runtime trigger, or deployment',
  packetTruthFields,
  packetPreserves,
  caseCoverage,
  outputBridges,
  refreshBoundary,
  findings: [
    packetPreserves.companyContext ? null : 'server packet drops company context',
    packetPreserves.brainNodeContext ? null : 'server packet drops brain-node / functional-network context',
    packetPreserves.dysregulationContext ? null : 'server packet drops regulated/dysregulated context',
    packetPreserves.recoveryContext ? null : 'server packet drops explicit recovery context',
    caseCoverage.checklistMissing ? 'case record marks all four homology mappings MISSING by construction' : null,
    outputBridges.generatorReadsBridgePattern ? null : 'engine generator does not read bridge-pattern context',
    outputBridges.masterReadsBrainNode ? null : 'master lane scoring does not read brain-node mapping',
    outputBridges.masterReadsDysregulation ? null : 'master lane scoring does not read regulated/dysregulated state',
    outputBridges.masterReadsRecovery ? null : 'master lane scoring does not read recovery state',
    refreshBoundary.financeOnlySemanticEvidence ? 'server refresh adds semantic evidence only for Finance' : null,
    refreshBoundary.passesHomologyContext ? null : 'brain-cognition-refresh does not pass homology context into server packets'
  ].filter(Boolean)
};
console.log(JSON.stringify(out, null, 2));
