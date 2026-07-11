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

// The DEFENSIBLE motif->business-function layer (the docs' spine). Each real node
// inherits its motif's business function, isomorphism tier, and FRACTAL WEIGHT
// (true ONLY for M6/M8/M11 per the fractal triage). This is what the business /
// opportunity / research generators should read instead of guessing node->company.
const XW = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'motif-crosswalk.json'), 'utf8')).motifs;
function motifMeta(m) { const x = m && XW[m]; return { tier: x ? x.tier : null, fractalWeight: !!(x && x.fractalWeight), businessFunction: x ? x.businessFunction : null }; }

// ── NON-NODES (cannot carry a business/efferent as an entity) ─────────────────
const NON = {
  tract:      { remapTo: 'edge',           note: 'a connection between nodes (white-matter tract); model as an edge / reporting line',
                members: { CC:'', FORN:'', UNC:'' } },
  molecule:   { remapTo: 'parameter',      note: 'a modulator/transmitter; model as an edge sign or gain parameter, not a unit',
                members: { GABA_GLU:'EI (edge sign + gain)', BDNF:'plasticity/investment param', TrkB:'BDNF-receptor param', OPIOID:'modulator (source PAG/ARC)', OXY:'HYPO efferent modulator (trust capital)' } },
  glia:       { remapTo: 'infrastructure', note: 'non-neuronal support/immune/barrier; infrastructure, not a directed unit',
                members: { ASTRO:'metabolic/support infra', MICRO:'immune-surveillance infra', BBB:'boundary infra' } },
  composite:  { remapTo: 'view',           note: 'a read-only computed network view; not an edge endpoint or a firm',
                members: { DMN:'aggregate view', DMNMTL:'DMN subsystem view', SN:'AI+dACC', FPN:'control-network view', FPC:'control-network view', ECN:'= FPN (dedupe)', DAN:'attention view', VAN:'attention view', CON:'cingulo-opercular view', LANG:'Broca+Wernicke+AG view', STRI:'CAUD+PUT+NAcc', HPA:'HYPO→PIT→ADR loop', GBA:'gut-brain axis view', SMN:'somatomotor network = M1/S1/S2/SMA/PMC (audit: resting-state network, not a region)', VV:'ventral visual stream = V1/V4V5/FG/PPA/EBA (audit: what-pathway, not a region)' } },
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
  RAPHE:{ motif:'M2',  role:'serotonin broadcast',         fail:'gain stuck high=rigid over-damping / low=impulsive volatility' },
  NBM:  { motif:'M2',  role:'cholinergic broadcast',       fail:'gain stuck high=hyper-focus on noise / low=inattention, no consolidation' },
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
  // Thalamic sensory/memory relays — same gating motif (M4) as THAL/MDT/GP/PULV.
  LGN:  { motif:'M4',  role:'lateral geniculate — visual thalamic relay',  fail:'flood/overload / starvation, homonymous-field-loss' },
  MGN:  { motif:'M4',  role:'medial geniculate — auditory thalamic relay', fail:'flood/overload / starvation, deafness' },
  ANT:  { motif:'M4',  role:'anterior thalamus — memory relay (Papez)',    fail:'flood/interference / amnesic gating' },
  // Cerebellar forward-model — same error-correction motif (M6) as CBLM/NEOCER.
  VERM: { motif:'M6',  role:'cerebellar vermis — affective-postural forward model', fail:'over-correction/anxiety / postural-affective instability' },
  // Brainstem arousal broadcast — same neuromodulatory gain motif (M2) as LC/RAPHE/NBM.
  PPN:  { motif:'M2',  role:'pedunculopontine — cholinergic arousal & locomotion', fail:'hyperarousal/REM-intrusion / gait-freeze, hypoarousal' },
  RF:   { motif:'M2',  role:'reticular formation — global arousal broadcast',       fail:'hyperarousal/agitation / stupor, coma' },
};

// REAL PROCESSING/ASSOCIATION nodes — genuine brain regions that are NOT control-
// law archetypes, so motif stays null (forcing a control motif here would repeat
// the category error). Each still gets a role + hyper/hypo failure grammar so
// EVERY portal derives a sharp reading, not a generic one. Grammar is functional
// (what over-/under-activation of THIS region does), not a control-motif claim.
const PROCESSING = {
  dlPFC:     { role:'dorsolateral PFC — executive working-memory / cognitive control', fail:'rigidity/rumination-lock / executive-lapse, distractible' },
  mPFC:      { role:'medial PFC — self-referential value integration (DMN core)',       fail:'self-focus/rumination / disengaged, apathetic' },
  rPFC:      { role:'frontopolar PFC — metacognition & prospective control',            fail:'overplanning/analysis-paralysis / no-foresight, myopic' },
  MFC:       { role:'medial frontal — action-value monitoring',                         fail:'over-deliberation / action apathy' },
  PMC:       { role:'premotor — motor planning & preparation',                          fail:'over-preparation/jitter / inertia, slow initiation' },
  SMA:       { role:'supplementary motor — self-initiated action sequencing',           fail:'compulsive sequencing / akinesia, initiation failure' },
  M1:        { role:'primary motor cortex — motor output',                              fail:'hyperkinesia/spasticity / weakness, paresis' },
  FEF:       { role:'frontal eye fields — attentional gaze control',                    fail:'over-fixation / neglect, scattered gaze' },
  BROCA:     { role:"Broca's area — expressive language production",                     fail:'pressured/over-production / expressive block, aphasia' },
  WERN:      { role:"Wernicke's area — receptive language comprehension",                fail:'over-interpretation / receptive aphasia' },
  AG:        { role:'angular gyrus — semantic/conceptual integration',                  fail:'over-association / semantic fragmentation' },
  PCC:       { role:'posterior cingulate — DMN internal-focus hub',                     fail:'rumination/internal-loop / dissociation from self' },
  PRECUNEUS: { role:'precuneus — self-imagery / DMN integration',                       fail:'self-referential loop / dissociation' },
  RSC:       { role:'retrosplenial — spatial memory & navigation',                      fail:'over-contextualization / topographical disorientation' },
  CING:      { role:'mid-cingulate (MCC) — action-outcome & effort integration',        fail:'over-effort/conflict-monitoring / effort-apathy, error-blind' },
  ACC:       { role:'anterior cingulate — conflict/effort monitor',                     fail:'hypervigilant conflict / error-blind, low-effort' },
  rACC:      { role:'rostral ACC — affective appraisal & regulation',                   fail:'emotional over-monitoring / blunted appraisal' },
  sgACC:     { role:'subgenual ACC — mood / negative-affect hub',                       fail:'depressive lock/anhedonic drive / affective flattening' },
  TPJ:       { role:'temporoparietal junction — social attribution & reorienting',      fail:'over-attribution/paranoia / mindblindness' },
  STS:       { role:'superior temporal sulcus — social perception',                     fail:'over-reading social cues / social-cue blindness' },
  TPOLE:     { role:'temporal pole — semantic-social knowledge hub',                    fail:'over-generalized semantics / semantic dementia' },
  IPS:       { role:'intraparietal sulcus — spatial attention & magnitude',             fail:'over attention-shift / hemineglect' },
  IPL:       { role:'inferior parietal — multimodal integration',                       fail:'sensory over-binding / integration deficit' },
  SPL:       { role:'superior parietal — spatial orienting & body-schema',              fail:'spatial hypervigilance / spatial disorientation' },
  S1:        { role:'primary somatosensory processing',                                 fail:'hypersensitivity/pain-amplification / numbness, sensory loss' },
  S2:        { role:'secondary somatosensory integration',                              fail:'sensory hypervigilance / tactile agnosia' },
  V1:        { role:'primary visual processing',                                        fail:'visual overload / input starvation, blindsight' },
  V4V5:      { role:'visual V4/V5 — color & motion',                                    fail:'motion overload / feature agnosia' },
  A1:        { role:'primary auditory processing',                                      fail:'auditory overload/hyperacusis / cortical-deafness, auditory-agnosia' },
  FG:        { role:'fusiform gyrus — face/object recognition',                         fail:'pareidolia/over-recognition / agnosia, prosopagnosia' },
  PPA:       { role:'parahippocampal place area — scene/context recognition',           fail:'context over-binding / context blindness' },
  EBA:       { role:'extrastriate body area — body-form perception',                    fail:'body hypervigilance / body agnosia' },
  SC:        { role:'superior colliculus — orienting & saccades',                       fail:'distractible orienting / orienting failure' },
  VEST:      { role:'vestibular nuclei — balance & spatial orientation',                fail:'vertigo/motion hypersensitivity / imbalance, disorientation' },
  CLAUST:    { role:'claustrum — cross-cortical salience binding',                      fail:'sensory over-binding / fragmented consciousness' },
  OLF:       { role:'olfactory-limbic processing',                                      fail:'phantosmia/hyperosmia / anosmia' },
  EC:        { role:'entorhinal — hippocampal memory gateway',                          fail:'memory flooding/interference / encoding failure' },
  PRC:       { role:'perirhinal — object recognition memory',                           fail:'false familiarity / recognition-memory loss' },
  MAMM:      { role:'mammillary bodies — memory circuit (Papez)',                       fail:'memory-interference/intrusion / amnesia, confabulation (Korsakoff)' },
  SEPT:      { role:'septal nuclei — theta rhythm / social reward',                     fail:'over-arousal / blunted bonding' },
  CAUD:      { role:'caudate — goal-directed action selection',                         fail:'compulsion/OCD loop / apathy, bradyphrenia' },
  PUT:       { role:'putamen — sensorimotor habit selection',                           fail:'compulsive habit/dyskinesia / bradykinesia' },
  VP:        { role:'ventral pallidum — reward/hedonic output',                         fail:'compulsive pursuit / anhedonia, blunted' },
  SNIG:      { role:'substantia nigra — dopamine / motor gating',                       fail:'dyskinesia/impulsivity / parkinsonian rigidity' },
  PIT:       { role:'pituitary — endocrine output (HPA/HPG axis)',                      fail:'hormonal overdrive / hormonal insufficiency' },
  DV:        { role:'dorsal motor vagus — parasympathetic output',                      fail:'dorsal-vagal shutdown/collapse / sympathetic unopposed' },
  ENS:       { role:'enteric nervous system — gut autonomic regulation',                fail:'gut hypermotility/IBS / gut hypomotility, atony' },
};

// Composite → its REAL member nodes. A composite can't carry a business/diagnosis
// itself (it's a view), but when an issue is wired ONLY to composites the reading
// would vanish; the derivation falls back to the composite's real members so the
// function still lands on a real node. Deterministic, from the anatomy.
const COMPOSITE_COMPONENTS = {
  DMN:['mPFC','PCC','PRECUNEUS'], DMNMTL:['HIPP','mPFC'], SN:['AI','dACC'],
  FPN:['dlPFC','IPS'], FPC:['dlPFC','IPS'], ECN:['dlPFC'], DAN:['FEF','IPS'],
  VAN:['TPJ'], CON:['dACC','AI'], LANG:['BROCA','WERN','AG'], STRI:['CAUD','PUT','NAcc'],
  HPA:['HYPO','PIT'], GBA:['ENS','NTS'], SMN:['M1','S1'], VV:['FG','V4V5']
};

const idIndex = {};
for (const [cls, spec] of Object.entries(NON)) for (const [m, target] of Object.entries(spec.members)) idIndex[m] = { class: cls, remapTo: spec.remapTo, remapTarget: target || null, note: spec.note };

const nodeIds = Object.keys(JSON.parse(fs.readFileSync(SRC, 'utf8'))).filter(k => k[0] !== '_');
const out = { _meta: { source: 'brain-node-domains.json + Connectome Node Regulatory Reference + 10-agent audit backbone', built: 'deterministic', total: nodeIds.length }, nodes: {} };
let real = 0, control = 0, non = 0, processing = 0, ungrammared = 0;
for (const id of nodeIds) {
  if (idIndex[id]) { out.nodes[id] = { class: idIndex[id].class, canBindBusiness: false, motif: null, remapTo: idIndex[id].remapTo, remapTarget: idIndex[id].remapTarget, note: idIndex[id].note }; if (COMPOSITE_COMPONENTS[id]) out.nodes[id].components = COMPOSITE_COMPONENTS[id].filter(c => CONTROL[c] || PROCESSING[c]); non++; }
  else if (CONTROL[id]) { const xw = motifMeta(CONTROL[id].motif); out.nodes[id] = { class: 'real', canBindBusiness: true, motif: CONTROL[id].motif, tier: xw.tier, fractalWeight: xw.fractalWeight, businessFunction: xw.businessFunction, role: CONTROL[id].role, failureModes: CONTROL[id].fail }; real++; control++; }
  else if (PROCESSING[id]) { out.nodes[id] = { class: 'real', canBindBusiness: true, motif: null, tier: null, fractalWeight: false, businessFunction: null, role: PROCESSING[id].role, failureModes: PROCESSING[id].fail }; real++; processing++; }
  else { out.nodes[id] = { class: 'real', canBindBusiness: true, motif: null, tier: null, fractalWeight: false, businessFunction: null, role: null }; real++; ungrammared++; }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${nodeIds.length} nodes  (real ${real} [${control} control-motif + ${processing} processing-grammar + ${ungrammared} still ungrammared], non-node ${non})`);
