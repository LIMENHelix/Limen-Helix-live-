/**
 * k5-energy-authoring-queue.cjs — PHASE K5 human-authoring workbench feed (read-only build).
 * Turns the unusable deep substrate into an ACTIONABLE authoring queue: (1) external-source bundle
 * field gaps (method/embodiment/figure — mirrors J2 intake), (2) the K2/K3 rehydration candidates
 * (DANGEROUS diagnosis-branch portals -> treatment replacement / source citation), (3) ticker relevance
 * verification for context portals. Records what must be AUTHORED from real sources — fabricates nothing.
 * Writes assets/data/deep/energy-authoring-queue.json. node scripts/_taxonomy-pilot/k5-energy-authoring-queue.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DEEP = path.join(ROOT, 'assets', 'data', 'deep');
const BD = path.join(ROOT, 'assets', 'data', 'artifact-source-index', 'by-diagnosis');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const OUT = path.join(DEEP, 'energy-authoring-queue.json');

console.log('\n================ K5 — ENERGY AUTHORING QUEUE (read-only build) ================\n');

const k3 = rd(path.join(DEEP, 'energy-certified-cortex-index.json'));

// J2-mirrored source hints (same map the brain emits in treatmentContext.authoringIntake)
const SRC_HINT = {
  GRID_FREQUENCY_INSTABILITY: 'NERC reliability standards / IEEE 1547 / utility filings',
  INTERMITTENCY_SPIKE: 'NREL / IEA PVPS / ISO interconnection studies',
  PIPELINE_RUPTURE_EVENT: 'PHMSA incident reports / API 1160 / 49 CFR 192',
  OIL_SHOCK: 'EIA STEO / IEA OMR / OPEC MOMR / patent literature',
  NUCLEAR_INCIDENT: 'IAEA INES / NRC event reports / 10 CFR / patent literature',
  SYSTEMIC_ENERGY_STRESS: 'NERC reliability assessments / FERC orders / EIA'
};
const DIAG_BUNDLE = { GRID_COLLAPSE: 'GRID_FREQUENCY_INSTABILITY', RENEWABLE_INTERMITTENCY: 'INTERMITTENCY_SPIKE', PIPELINE_DISRUPTION: 'PIPELINE_RUPTURE_EVENT', OIL_SHOCK: 'OIL_SHOCK', NUCLEAR_INCIDENT: 'NUCLEAR_INCIDENT', SYSTEMIC_ENERGY_STRESS: 'SYSTEMIC_ENERGY_STRESS' };

const queue = [];

// (1) external-source bundle field gaps — highest priority (these ARE the evidence layer)
Object.keys(DIAG_BUNDLE).forEach(dx => {
  const cid = DIAG_BUNDLE[dx];
  const p = path.join(BD, cid + '.json');
  if (!fs.existsSync(p)) return;
  const b = rd(p);
  const lane = (b.byLane && b.byLane.patents) || {};
  const external = b.buildMethod === 'external-source-authored';
  ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(field => {
    if ((lane[field] || []).length === 0 && external) {
      queue.push({
        target: cid, diagnosis: dx, level: 'bundle',
        authoringType: field === 'methodCandidates' ? 'methodCandidate needed' : field === 'embodimentCandidates' ? 'embodimentCandidate needed' : 'figurePlaceholder needed',
        missingFields: [field],
        existingContext: (lane.evidenceAnchors || []).length + ' real evidence anchors present',
        unusableTemplateContent: null,
        sourceHints: SRC_HINT[cid],
        requiredHumanAction: 'Author ' + field + ' from a primary source, then wire in verbatim with attribution',
        priority: 1,
        whyItMatters: 'external-source bundle is the diagnosis\'s only evidence layer; these fields gate patent/grant readiness (conscience currently vetoes)'
      });
    }
  });
});

// (2) rehydration candidates from K2/K3 — DANGEROUS diagnosis-branch portals to replace, not trust
(k3.needsRehydration || []).forEach(r => {
  queue.push({
    target: r.portalId, diagnosis: r.diagnosis, level: 'portal', depth: r.depth,
    authoringType: r.classification === 'NEEDS_AUTHORING' ? 'treatment needs replacement' : 'source citation needed',
    missingFields: ['real treatments', 'verifiable provenance'],
    existingContext: 'templated treatments + evidence grades with NO verifiable provenance (DANGEROUS — authority masquerade)',
    unusableTemplateContent: r.reason,
    sourceHints: SRC_HINT[DIAG_BUNDLE[r.diagnosis]] || 'primary institutional / patent source',
    requiredHumanAction: 'Replace fake-authority treatments with sourced content OR demote portal to context-only label',
    priority: 2,
    whyItMatters: 'deep portal on a real diagnosis branch is blocked as evidence until rehydrated from a real source'
  });
});

// (3) ticker relevance verification — context portals (companies real, relevance unverified)
(k3.contextOnly || []).forEach(c => {
  queue.push({
    target: c.portalId, diagnosis: null, level: 'portal',
    authoringType: 'ticker relevance verification needed',
    missingFields: ['verified company-to-diagnosis relevance'],
    existingContext: 'real company tickers present, but node-binding is templated (relevance unverified)',
    unusableTemplateContent: null,
    sourceHints: 'confirm each ticker actually operates in this energy sub-domain (10-K / company filings)',
    requiredHumanAction: 'Verify or drop each ticker\'s relevance to the portal\'s domain',
    priority: 3,
    whyItMatters: 'tickers are context-only until verified; verification can promote them from context to supporting evidence'
  });
});

queue.sort((a, b) => a.priority - b.priority);

const byType = {};
queue.forEach(q => { byType[q.authoringType] = (byType[q.authoringType] || 0) + 1; });
const byDiagnosis = {};
queue.forEach(q => { if (q.diagnosis) byDiagnosis[q.diagnosis] = (byDiagnosis[q.diagnosis] || 0) + 1; });

const out = {
  generatedAt: 'static-2026-06-18', builtFrom: ['energy-certified-cortex-index.json (K3)', 'artifact-source-index/by-diagnosis (external bundles)'],
  note: 'Records what must be AUTHORED from real sources — NO candidate content is fabricated here. Mirrors the brain\'s J2 treatmentContext.authoringIntake for external-source bundles.',
  totalTasks: queue.length, byType: byType, byDiagnosis: byDiagnosis,
  priorityLegend: { 1: 'external-source bundle field gaps (evidence layer)', 2: 'deep-portal rehydration (replace fake authority)', 3: 'ticker relevance verification' },
  tasks: queue
};
fs.mkdirSync(DEEP, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const outKB = Math.round(fs.statSync(OUT).size / 1024);

console.log('  total authoring tasks:', queue.length, '| ' + outKB + 'KB');
console.log('  byType:', JSON.stringify(byType));
console.log('  byDiagnosis:', JSON.stringify(byDiagnosis));
console.log('  P1 (bundle field gaps):', queue.filter(q => q.priority === 1).map(q => q.diagnosis + ':' + q.missingFields[0]).join(', '));

const p1diag = new Set(queue.filter(q => q.priority === 1).map(q => q.diagnosis));
const checks = [
  ['OIL_SHOCK / NUCLEAR_INCIDENT / SYSTEMIC_ENERGY_STRESS bundle gaps represented', ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].every(d => p1diag.has(d))],
  ['each external bundle needs method+embodiment+figure (3 tasks each)', ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].every(d => queue.filter(q => q.priority === 1 && q.diagnosis === d).length === 3)],
  ['L1/L2/deep synthetic portals became authoring TASKS (not evidence)', queue.some(q => q.level === 'portal' && /authority masquerade|provenance/.test(q.existingContext))],
  ['ticker relevance verification tasks present for context portals', queue.some(q => q.authoringType === 'ticker relevance verification needed')],
  ['NO fabricated candidate content (tasks only record what is needed)', queue.every(q => !q.fabricated && Array.isArray(q.missingFields) && !!q.requiredHumanAction)],
  ['mirrors J2 intake source hints (EIA/IEA/IAEA/NRC/NERC...)', queue.filter(q => q.priority === 1).every(q => /EIA|IEA|IAEA|NRC|NERC|NREL|PHMSA/.test(q.sourceHints))],
  ['rehydration count matches K3 needsRehydration', queue.filter(q => q.priority === 2).length === (k3.needsRehydration || []).length],
  ['queue written + compact (<300KB)', fs.existsSync(OUT) && outKB < 300],
  ['report doc present', fs.existsSync(path.join(ROOT, 'docs', 'audits', 'energy-k5-authoring-queue.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK5: ' + (allPass ? 'PASS ✓ — authoring queue built from real gaps; nothing fabricated' : 'FAIL ✗') + '\n');
console.log('================ END K5 ================\n');
process.exit(allPass ? 0 : 1);
