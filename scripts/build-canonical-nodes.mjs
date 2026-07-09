#!/usr/bin/env node
/**
 * build-canonical-nodes.mjs — the ONE source of truth for what a node IS.
 *
 * Reads the canonical 123-node id set (brain-node-domains.json) and classifies
 * every id from the LIMEN Connectome Node Regulatory Reference + the 10-agent
 * node-business audit backbone:
 *   - class:  real | tract | molecule | glia | composite | construct | effector | ambiguous
 *   - motif:  M1..M12 for the ~real control nodes whose isomorphism is established (else null)
 *   - remapTo: for NON-nodes, where the function actually belongs (edge | parameter | view |
 *              infrastructure | state | effector | confirm) + a specific target where known
 *
 * Writes assets/data/canonical-nodes.json. Deterministic, no LLM. This is layer-2 of the
 * "treat the connectome" fix: node-guard.js reads it to REFUSE binding a business/efferent to a
 * non-node, and the portal-derivation layer reads it to compute dx/tx from (feed x motif).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'data', 'brain-node-domains.json');
const OUT = path.join(ROOT, 'assets', 'data', 'canonical-nodes.json');

// ── NON-NODES (cannot carry a business/efferent as an entity) ─────────────────
const NON = {
  tract:      { remapTo: 'edge',           note: 'a connection between nodes (white-matter tract); model as an edge / reporting line',
                members: { CC:'', FORN:'', UNC:'' } },
  molecule:   { remapTo: 'parameter',      note: 'a modulator/transmitter; model as an edge sign or gain parameter, not a unit',
                members: { GABA_GLU:'EI (edge sign + gain)', BDNF:'plasticity/investment param', TrkB:'BDNF-receptor param', OPIOID:'modulator (source PAG/ARC)', OXY:'HYPO efferent modulator (trust capital)' } },
  glia:       { remapTo: 'infrastructure', note: 'non-neuronal support/immune/barrier; infrastructure, not a directed unit',
                members: { ASTRO:'metabolic/support infra', MICRO:'immune-surveillance infra', BBB:'boundary infra' } },
  composite:  { remapTo: 'view',           note: 'a read-only computed network view; not an edge endpoint or a firm',
                members: { DMN:'aggregate view', DMNMTL:'DMN subsystem view', SN:'AI+dACC', FPN:'control-network view', FPC:'control-network view', ECN:'= FPN (dedupe)', DAN:'attention view', VAN:'attention view', CON:'cingulo-opercular view', LANG:'Broca+Wernicke+AG view', STRI:'CAUD+PUT+NAcc', HPA:'HYPO→PIT→ADR loop', GBA:'gut-brain axis view' } },
  construct:  { remapTo: 'state',          note: 'a state/parameter/emergent property, not a regulated node',
                members: { EI:'excitation/inhibition balance param (motif M9)', OSC:'oscillation state (motif M12)', EMP:'multi-region computed view', DISS:'Phase-7 state (no efferent)' } },
  effector:   { remapTo: 'effector',       note: 'peripheral effector organ/output; weak as a business-unit node',
                members: { ADR:'', PIN:'', CARD:'', SNS:'', LAR:'' } },
  ambiguous:  { remapTo: 'confirm',        note: 'abbreviation not confidently resolvable; confirm from source before any binding',
                members: { VIA:'', CMZ:'cingulate motor zone?', SDH:'spinal dorsal horn?', MI:'mid-insula?', ENDO:'endocannabinoid/endocrine?', ARC:'arcuate nucleus vs fasciculus?', IC:'inferior colliculus vs internal capsule?' } },
};

// ── REAL CONTROL NODES with an ESTABLISHED motif (audit backbone + crosswalk) ─
// Only motifs the audit/crosswalk confirmed. Every other real node = class:real, motif:null.
const CONTROL = {
  LC:   { motif:'M2',  role:'broadcast / alerting',        fail:'gain stuck high=thrash / low=missed' },
  RAPHE:{ motif:'M2',  role:'serotonin broadcast',         fail:'mood/patience gain mis-set' },
  NBM:  { motif:'M2',  role:'cholinergic broadcast',       fail:'attention/plasticity gain mis-set' },
  THAL: { motif:'M4',  role:'gating relay / routing',      fail:'stuck-open=flood / stuck-closed=starvation' },
  MDT:  { motif:'M4',  role:'PFC relay gate',              fail:'flood / freeze' },
  GP:   { motif:'M4',  role:'basal-ganglia output gate',   fail:'flood / lock (bradykinetic freeze)' },
  PULV: { motif:'M4',  role:'attentional gate',            fail:'overload / neglect' },
  vmPFC:{ motif:'M1',  role:'top-down inhibitory brake',   fail:'over-grip=flatness / brake-fail=rogue' },
  vlPFC:{ motif:'M1',  role:'response-inhibition / stop',  fail:'over-suppress / disinhibited' },
  STN:  { motif:'M1',  role:'hyperdirect brake / hold',    fail:'over-brake=paralysis / no-brake=runaway' },
  HYPO: { motif:'M3',  role:'homeostatic set-point',       fail:'severed=runaway / delayed=oscillation' },
  HIPP: { motif:'M3',  role:'HPA feedback + memory index', fail:'feedback-fail=runaway / intrusive-recall' },
  dACC: { motif:'M6',  role:'conflict/error monitor',      fail:'priors-too-strong / noise-chase' },
  OFC:  { motif:'M6',  role:'outcome valuation / update',  fail:'confabulation / over-react' },
  CBLM: { motif:'M6',  role:'forward-model error-correct', fail:'model-drift / over-correct' },
  NEOCER:{motif:'M6',  role:'cognitive forward model',     fail:'model-drift / over-correct' },
  AI:   { motif:'M10', role:'interoceptive salience',      fail:'flying-blind / metric-obsession' },
  NTS:  { motif:'M10', role:'visceral afferent hub',       fail:'no internal-state sense / hyper-signal' },
  PI:   { motif:'M10', role:'primary interoception',       fail:'alexithymia / somatic hypervigilance' },
  PBN:  { motif:'M10', role:'interoceptive/alarm relay',   fail:'blunted / over-alarm' },
  CeA:  { motif:'M7',  role:'phasic fear output',          fail:'hair-trigger=false-alarm / blunted' },
  BNST: { motif:'M7',  role:'sustained threat monitor',    fail:'tonic-stuck=burnout / under-vigilant' },
  BLA:  { motif:'M7',  role:'threat learning/acquisition', fail:'over-fear=PTSD / fearless' },
  HAB:  { motif:'M8',  role:'anti-reward brake',           fail:'too-strong=anhedonia / too-weak=sunk-cost' },
  PAG:  { motif:'M8',  role:'defensive kill/lockdown',     fail:'over-freeze / no-stop' },
  NAcc: { motif:'M11', role:'incentive/reward drive',      fail:'over-pursuit=bubble / avolition' },
  VTA:  { motif:'M11', role:'dopamine reward source',      fail:'mania/addiction / anhedonia' },
  SCN:  { motif:'M12', role:'circadian pacemaker',         fail:'desync / over-rigid cadence' },
};

const idIndex = {};
for (const [cls, spec] of Object.entries(NON)) for (const [m, target] of Object.entries(spec.members)) idIndex[m] = { class: cls, remapTo: spec.remapTo, remapTarget: target || null, note: spec.note };

const nodeIds = Object.keys(JSON.parse(fs.readFileSync(SRC, 'utf8'))).filter(k => k[0] !== '_');
const out = { _meta: { source: 'brain-node-domains.json + Connectome Node Regulatory Reference + 10-agent audit backbone', built: 'deterministic', total: nodeIds.length }, nodes: {} };
let real = 0, control = 0, non = 0;
for (const id of nodeIds) {
  if (idIndex[id]) { out.nodes[id] = { class: idIndex[id].class, canBindBusiness: false, motif: null, remapTo: idIndex[id].remapTo, remapTarget: idIndex[id].remapTarget, note: idIndex[id].note }; non++; }
  else if (CONTROL[id]) { out.nodes[id] = { class: 'real', canBindBusiness: true, motif: CONTROL[id].motif, role: CONTROL[id].role, failureModes: CONTROL[id].fail }; real++; control++; }
  else { out.nodes[id] = { class: 'real', canBindBusiness: true, motif: null, role: null }; real++; }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${nodeIds.length} nodes  (real ${real} [${control} with a control-motif], non-node ${non})`);
