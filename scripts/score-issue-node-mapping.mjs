#!/usr/bin/env node
/**
 * score-issue-node-mapping.mjs — grade every authored issue's node-set against
 * the isomorphism crosswalk, so node CHOICE can be corrected at scale WITHOUT
 * blind-guessing. Offline analysis only; writes a report, changes no live data.
 *
 * For each issue it:
 *   1. tokenizes the issue (label + summary),
 *   2. scores every REAL node by how well its function (registry role +
 *      failureModes + a curated business-anchor vocabulary distilled from
 *      LIMEN_Connectome_Energy_Domain_Mapping.md) matches the issue,
 *   3. compares the issue's CURRENT node-set to the best-matching nodes,
 *   4. emits: nodes to ADD (high-relevance, missing), DROP (non-node or zero-
 *      relevance), and a mismatch score. Ranked worst-first for operator review.
 *
 * The ADD/DROP list is a SUGGESTION for human approval, never auto-applied.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANON = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'canonical-nodes.json'), 'utf8')).nodes;
const FULL = 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
const DOMAINS = fs.existsSync(FULL) ? FULL : path.join(ROOT, 'assets', 'data', 'domains');
const OUT = path.join(ROOT, 'scripts', 'reports');
const TOP_ADD = 3;          // how many additions to suggest per issue
const REL_MIN = 2;          // min relevance for a node to be a candidate
const REPORT_TOP = 60;      // worst-N printed to console

// ── Business/domain anchor vocabulary per node (distilled from the crosswalk +
//    the audited failure grammar). This is the expert mapping, encoded once and
//    reviewable — NOT a per-issue guess. Control nodes carry the load; processing
//    nodes lean on their registry role.
const ANCHORS = {
  // reward / capital drive
  NAcc:['reward','incentive','pursuit','bubble','demand','appetite','craving','speculation','hype','boom','want','greed'],
  VTA:['reward','motivation','drive','incentive','appetite','mania','addiction','anhedonia','investment','dopamine'],
  GP:['capital','credit','lending','loan','spend','treasury','budget','covenant','rating','funding','liquidity','allocation','release','hold','gate','solvency'],
  // gating / routing / throughput
  THAL:['gate','route','relay','filter','access','throughput','flow','channel','bottleneck','distribution','supply','routing','capacity','overload','congestion'],
  MDT:['relay','filter','escalation','routing'], PULV:['attention','filter','escalation','overload'],
  LGN:['data','pipeline','feed','gate','ingest'], MGN:['signal','alarm','routing'], ANT:['memory','relay','history'],
  // executive / inhibitory control
  dlPFC:['executive','planning','coordination','management','operations','strategy','workload'],
  vmPFC:['risk','veto','value','ethics','governance','legal','oversight','liability'],
  vlPFC:['compliance','control','inhibit','restraint','suppress','conduct'],
  STN:['emergency','shutdown','halt','stop','brake','freeze','moratorium','hold','kill'],
  OFC:['valuation','pricing','value','outcome','update','reward-value','worth'],
  // threat / distrust / anti-reward
  BLA:['threat','risk','fear','pattern','trigger','alarm','exposure'],
  CeA:['crisis','panic','acute','emergency','response','alarm','shock'],
  BNST:['chronic','sustained','worry','distrust','uncertainty','anxiety','scrutiny','vigilance','tension','erosion'],
  HAB:['refuse','withhold','avoid','sunk-cost','aversion','disengage','anhedonia','withdrawal','abandon','stop'],
  PAG:['lockdown','freeze','defensive','shutdown','kill','halt','paralysis'],
  // homeostasis / interoception / memory
  HYPO:['supply','demand','balance','homeostasis','resource','setpoint','stability','regulation','shortage','surplus'],
  HIPP:['memory','record','history','precedent','recall','knowledge','feedback','institutional'],
  AI:['audit','salience','sense','internal','metric','monitor','blind','interoception','feel'],
  NTS:['visceral','signal','monitor','sensor','aggregate','feed'], PI:['sensation','signal','somatic'], PBN:['alarm','relay','pain'],
  // error / quality / forward-model
  dACC:['conflict','error','monitor','quality','performance','tradeoff','effort','kpi','degradation','defect'],
  CBLM:['error','correction','timing','drift','model','quality','calibration','forecast','degradation'],
  VERM:['correction','stability','safety','posture'], NEOCER:['sequencing','timing','forecast','model'],
  // arousal / broadcast / rhythm
  LC:['arousal','alert','broadcast','alarm','cascade','panic','contagion','spread'],
  RAPHE:['mood','patience','morale','sentiment'], NBM:['attention','learning','focus'],
  RF:['arousal','activation','readiness','watch'], PPN:['readiness','initiation','mobilize'],
  NAccWatch:[], SCN:['cadence','schedule','cycle','timing','clock','rhythm']
};

// ── tokenizer
const STOP = new Set('the and for with from into this that system systems failure assessment diagnostics core operations management capacity overload quality degradation strategic planning alignment infrastructure development human capital coordination primary secondary tertiary node standards governance monitoring risk profiling crisis gap issue domain sub subportal'.split(' '));
function toks(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length >= 4 && !STOP.has(t));
}
// per-node keyword set = anchors ∪ role tokens ∪ failureMode tokens
const NODE_KW = {};
for (const id in CANON) {
  const r = CANON[id];
  if (!r.canBindBusiness) continue;
  const kw = new Set(ANCHORS[id] || []);
  toks(r.role).forEach(t => kw.add(t));
  toks(r.failureModes).forEach(t => kw.add(t));
  NODE_KW[id] = kw;
}
function relevance(issueToks, id) {
  const kw = NODE_KW[id]; if (!kw) return 0;
  let s = 0; const seen = {};
  for (const t of issueToks) {
    if (seen[t]) continue;
    // exact or containment match against node keywords
    for (const k of kw) { if (t === k || t.indexOf(k) !== -1 || k.indexOf(t) !== -1) { s++; seen[t] = 1; break; } }
  }
  return s;
}

function realNode(id) { return CANON[id] && CANON[id].canBindBusiness; }

// Generic failure TYPE (auto-stamped suffix) → the motif node its mechanism
// implies. These ~9.7k issues don't need per-issue correction; they need one
// sensible default per type. Named issues (no suffix) are scored individually.
const TYPE_DEFAULT = {
  'System Failure':      { nodes: ['STN', 'vmPFC', 'THAL'], why: 'brake-failure + risk-veto + gating collapse' },
  'Capacity Overload':   { nodes: ['THAL', 'HYPO'],         why: 'M4 gate stuck-open=flood + homeostat overrun' },
  'Quality Degradation': { nodes: ['dACC', 'CBLM'],         why: 'M6 error/quality-monitor drift' },
  'Governance Gap':      { nodes: ['vmPFC', 'vlPFC'],       why: 'oversight / inhibitory-control failure' },
  'Coordination Breakdown': { nodes: ['THAL', 'dACC'],      why: 'routing + conflict-monitor' }
};
const GENERIC_SUFFIXES = Object.keys(TYPE_DEFAULT);
function genericType(label) {
  for (const s of GENERIC_SUFFIXES) if (label.endsWith(s)) return s;
  return null;
}

// ── scan issues (L1-L3 tier carries the authored issues), dedup by label
const files = fs.readdirSync(DOMAINS).filter(f => f.endsWith('.json') && f.slice(0, -5).split('_').length <= 3);
const seenLabel = new Set();
const scored = [];
let total = 0;
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(DOMAINS, f), 'utf8')); } catch { continue; }
  for (const iss of (j.issues || [])) {
    const label = (iss.label || '').trim();
    if (!label || seenLabel.has(label.toLowerCase())) continue;
    seenLabel.add(label.toLowerCase());
    total++;
    const gtype = genericType(label);
    const it = toks(label + ' ' + (iss.summary || ''));
    const current = (iss.circuits || []).map(c => c.nodeId).filter(Boolean);
    const curReal = current.filter(realNode);
    const curNon = current.filter(id => CANON[id] && !realNode(id));
    // rank all real nodes by relevance
    const ranked = Object.keys(NODE_KW).map(id => ({ id, rel: relevance(it, id) }))
      .filter(x => x.rel >= REL_MIN).sort((a, b) => b.rel - a.rel);
    const curRelById = {}; curReal.forEach(id => curRelById[id] = relevance(it, id));
    const bestCurRel = curReal.length ? Math.max(...curReal.map(id => curRelById[id])) : 0;
    // suggested additions = top-ranked not already present
    const add = ranked.filter(x => current.indexOf(x.id) === -1).slice(0, TOP_ADD);
    // suggested drops = non-nodes + real nodes with zero relevance
    const drop = curNon.map(id => ({ id, why: CANON[id].class + '→' + CANON[id].remapTo }))
      .concat(curReal.filter(id => curRelById[id] === 0).map(id => ({ id, why: 'no functional match' })));
    // mismatch score: how much better the best missing node is than the current best,
    // plus a penalty for non-node bindings and for zero-relevance real nodes.
    const bestMissing = add.length ? add[0].rel : 0;
    const mismatch = Math.max(0, bestMissing - bestCurRel) * 2 + curNon.length + curReal.filter(id => curRelById[id] === 0).length;
    scored.push({ label, gtype, file: f.slice(0, -5), current, curReal, curNon, bestCurRel,
      add: add.map(x => x.id + '(' + x.rel + ')'), drop: drop.map(d => d.id + '[' + d.why + ']'), mismatch });
  }
}
scored.sort((a, b) => b.mismatch - a.mismatch);
const named = scored.filter(s => !s.gtype);
const generic = scored.filter(s => s.gtype);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'issue-node-scores.json'),
  JSON.stringify({ total, named: named.length, generic: generic.length, typeDefaults: TYPE_DEFAULT, generatedFrom: DOMAINS, namedScored: named, genericScored: generic }, null, 2));

// ── summary
console.log('scored ' + total + ' unique issue templates\n');
console.log('SPLIT:');
console.log('  ' + generic.length + ' generic type-stamps  → fix by TYPE DEFAULT (a few decisions, not per-issue):');
const byType = {};
generic.forEach(s => byType[s.gtype] = (byType[s.gtype] || 0) + 1);
for (const t of Object.keys(TYPE_DEFAULT)) if (byType[t]) console.log('      ' + String(byType[t]).padStart(5) + '  "' + t + '"  → ' + TYPE_DEFAULT[t].nodes.join('+') + '  (' + TYPE_DEFAULT[t].why + ')');
console.log('  ' + named.length + ' NAMED diagnoses      → review individually (Credit-Freeze class):');
const namedNoReal = named.filter(s => s.curReal.length === 0).length;
const namedBig = named.filter(s => s.mismatch >= 4).length;
console.log('      of which ' + namedNoReal + ' have no real node, ' + namedBig + ' high-mismatch (>=4)');
console.log('\n  report: scripts/reports/issue-node-scores.json\n');
console.log('WORST ' + Math.min(REPORT_TOP, named.length) + ' NAMED diagnoses (mismatch | issue | current → add / drop):');
for (const s of named.slice(0, REPORT_TOP)) {
  console.log('  [' + String(s.mismatch).padStart(2) + '] ' + s.label + '  (' + (s.current.join(',') || 'none') + ')');
  if (s.add.length) console.log('        + ' + s.add.join(', ') + (s.drop.length ? '   − ' + s.drop.map(d => d.split('[')[0]).join(',') : ''));
}
