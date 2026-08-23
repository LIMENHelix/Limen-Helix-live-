#!/usr/bin/env node
'use strict';

/*
 * Job 4 bridge contract test. No network, provider call, storage write, or UI.
 * It feeds one evidence-bearing synthetic slot for each canonical domain through
 * the real browser transforms and records which active lane can accept it.
 * Domains with no active research/investment affinity are explicit abstentions;
 * they are not forced into an unrelated lane.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./_taxonomy-pilot/lib.cjs');

const ROOT = path.join(__dirname, '..');
const A = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const DOMAINS = [
  'economy','energy','environment','health','technology','research','supplyChain',
  'governance','infrastructure','agriculture','industry','education','communication',
  'culture','defense','religion','population','law','finance','intelligence'
];
const INVESTMENT = new Set(['finance','economy','technology','energy','infrastructure']);
const RESEARCH = new Set(['research','health','medicine','science','education','population','environment']);

function loadWithCapture(ctx, file, names) {
  let src = A(file);
  const marker = ';try{window.__cap=window.__cap||{};' + names.map((n) =>
    'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}';
  const idx = src.lastIndexOf('})()');
  if (idx < 0) throw new Error(file + ': IIFE close not found');
  src = src.slice(0, idx) + marker + src.slice(idx);
  vm.runInContext(src, ctx, { filename: file });
}

function slotFor(domain) {
  return {
    brainStress: 0.61,
    brainConfidence: 0.78,
    brainUpdatedAt: Date.now(),
    brainStatus: 'active',
    brainPhase: 'p3',
    brainPhaseLabel: 'p3',
    brainDiagnoses: [{ id: 'DX_' + domain.toUpperCase(), label: domain + ' test diagnosis', active: true, relevance: 0.9, summary: 'synthetic bridge fixture' }],
    brainTreatments: [{ id: 'TX_' + domain.toUpperCase(), label: domain + ' test treatment', status: 'candidate' }],
    brainOpportunities: [{ id: 'OPP_' + domain.toUpperCase(), label: domain + ' test opportunity' }],
    brainDirectives: [{ id: 'DIR_' + domain.toUpperCase(), label: domain + ' test directive' }],
    brainFeeds: [{ name: domain + ' feed', live: true }],
    brainSourcesLive: 1,
    brainSourcesTotal: 1,
    sources: [{ name: domain + ' feed', live: true, updated: Date.now() }],
    stress: 0.61,
    confidence: 0.78,
    activity: 0.4,
    updated: Date.now(),
    cadence: 'live'
  };
}

const ctx = L.makeContext({ seed: 17 });
ctx.window.__cap = {};
ctx.window.LIMENDomains = {};
loadWithCapture(ctx, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
loadWithCapture(ctx, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
loadWithCapture(ctx, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), ctx, { filename: 'artifact-packet-builder.js' });

const cap = ctx.window.__cap;
const APB = ctx.window.LIMENArtifactPacketBuilder;
const rows = [];
for (const domain of DOMAINS) {
  // slotFor models the already-emitted domain-brain adapter slot. The bridge
  // under test begins at this shared slot; _buildPayload is covered by F0/F1.
  const payload = slotFor(domain);
  ctx.window.LIMENDomains = { [domain]: payload };
  const packet = cap._buildPacket(domain);
  const lane = INVESTMENT.has(domain) ? 'investments' : RESEARCH.has(domain) ? 'research-papers' : null;
  if (!lane) {
    rows.push({ domain, packetVersion: packet && packet.schemaVersion, packetEvidence: packet && packet.activeDiagnoses && packet.activeDiagnoses[0] && packet.activeDiagnoses[0].id, lane: null, status: 'ABSTAIN_NO_ACTIVE_LANE_AFFINITY' });
    continue;
  }
  const opp = { id: 'BRIDGE_' + domain, domains: [domain], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6, rationale: 'bridge fixture', summary: 'bridge fixture', type: 'diagnosis', provenance: 'bridge-test' };
  const handoff = cap._packetForLane(lane, opp, { [domain]: packet });
  const artifact = APB.buildFromHandoffPacket(handoff, {});
  const diagnosisId = 'DX_' + domain.toUpperCase();
  const treatmentId = 'TX_' + domain.toUpperCase();
  const handoffKeepsEvidence = !!(handoff && handoff.schemaVersion === 'civilization-handoff/1.0' &&
    handoff.sourceDiagnoses.some((d) => d.id === diagnosisId) && handoff.sourceTreatments.some((t) => t.treatment && t.treatment.id === treatmentId));
  const artifactKeepsHandoff = !!(artifact && artifact.packetSchemaVersion === 'D3-A3.v3' && artifact.raw && artifact.raw.handoffPacket && artifact.raw.handoffPacket.opportunityId === handoff.opportunityId);
  rows.push({ domain, packetVersion: packet && packet.schemaVersion, handoffVersion: handoff && handoff.schemaVersion, artifactVersion: artifact && artifact.packetSchemaVersion, lane, handoffKeepsEvidence, artifactKeepsHandoff, status: handoffKeepsEvidence && artifactKeepsHandoff ? 'PASS' : 'FAIL' });
}

const routed = rows.filter((r) => r.lane);
const failed = rows.filter((r) => r.status === 'FAIL');
const abstained = rows.filter((r) => !r.lane);
console.log(JSON.stringify({ readOnly: true, domains: rows.length, routed: routed.length, abstained: abstained.length, failed: failed.length, rows }, null, 2));
if (failed.length || rows.length !== 20 || routed.some((r) => r.status !== 'PASS')) process.exitCode = 1;
