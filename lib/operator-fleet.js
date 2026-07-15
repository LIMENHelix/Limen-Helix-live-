// ═══════════════════════════════════════════════════════════════════
// operator-fleet.js — 20 named domain operators + one master orchestrator.
//
// The vision (Dan Martell's Kai/Reese, ported honestly): the connectome is a
// FLEET. Each of the 20 domains has a persistent, self-named operator that
// reaches ONE bounded decision from its live brain state. A master operator
// ("Kai") coordinates them into a single system decision. Capital-light: it
// finds and RANKS opportunities and prepares each to the human gate. It never
// spends, sends, publishes, or acts on its own.
//
// This layer INVENTS NO NEW LOGIC. It reuses:
//   - limen-decision.decide   (the honest per-domain decision rules)
//   - limen-workspace.synthesize (salience competition + system conscience)
// and adds only what was missing: IDENTITY (a self-chosen name per operator),
// a FLEET RUN (all 20 in one triggered pass, ranked), and MEMORY (a journal so
// operators compound). The deterministic path costs $0. The optional AI
// "deliberate" pass routes through ai-orchestrator, which is already double-gated
// by the kill switch + per-tick budget, so it can never spend unattended.
//
// HONESTY: every operator decision is interpretive:true, validated:false. The
// bounded action is only ever abstain | monitor | recommend | open-human-gate.
// Names are self-generated deterministically from the domain identity (stable,
// free) unless the operator upgrades a name via the gated AI path.
// ═══════════════════════════════════════════════════════════════════
'use strict';

var decision = require('../assets/js/limen-decision.js');    // .decide(state)
var workspace = require('../assets/js/limen-workspace.js');   // .synthesize(domainsObj)

// Canonical 20 domains (source of truth: assets/js/domain-registry.js).
// Kept inline so this module runs server-side and via CLI without a browser global.
var DOMAINS = [
  { id: 'governance',     runtimeKey: 'governance',   label: 'Governance' },
  { id: 'economy',        runtimeKey: 'economy',      label: 'Economy' },
  { id: 'infrastructure', runtimeKey: 'infrastructure', label: 'Infrastructure' },
  { id: 'energy',         runtimeKey: 'energy',       label: 'Energy' },
  { id: 'agriculture',    runtimeKey: 'agriculture',  label: 'Agriculture' },
  { id: 'industry',       runtimeKey: 'industry',     label: 'Industry' },
  { id: 'science',        runtimeKey: 'research',     label: 'Science & Research' },
  { id: 'medicine',       runtimeKey: 'health',       label: 'Medicine & Health' },
  { id: 'education',      runtimeKey: 'education',     label: 'Education' },
  { id: 'technology',     runtimeKey: 'technology',   label: 'Technology' },
  { id: 'communication',  runtimeKey: 'communication', label: 'Communication' },
  { id: 'culture',        runtimeKey: 'culture',      label: 'Culture' },
  { id: 'defense',        runtimeKey: 'defense',      label: 'Defense' },
  { id: 'environment',    runtimeKey: 'environment',  label: 'Environment' },
  { id: 'religion',       runtimeKey: 'religion',     label: 'Religion & Symbolic Systems' },
  { id: 'population',     runtimeKey: 'population',    label: 'Population & Demographics' },
  { id: 'trade',          runtimeKey: 'supplyChain',  label: 'Trade & Logistics' },
  { id: 'law',            runtimeKey: 'law',          label: 'Law & Regulation' },
  { id: 'finance',        runtimeKey: 'finance',      label: 'Finance' },
  { id: 'intelligence',   runtimeKey: 'intelligence', label: 'Intelligence & Data' }
];

// Name pool the operators draw from when they self-name. Deterministic pick by
// domain identity keeps the name STABLE across runs (an operator is the same
// "person" every time) without a random seed or a stored file.
var NAME_POOL = [
  'Atlas','Reese','Nova','Vera','Orin','Juno','Cass','Mira','Dex','Wren',
  'Silas','Nadia','Owen','Thea','Rex','Lena','Idris','Petra','Kane','Sol',
  'Bram','Isla','Cyrus','Freya','Lorne','Nyx','Enzo','Suri','Dane','Vale'
];

function hashStr(s) {
  var h = 5381, i = s.length;
  while (i) { h = (h * 33) ^ s.charCodeAt(--i); }
  return h >>> 0;
}

// Deterministic, collision-free assignment over the fixed DOMAINS order so every
// operator gets a distinct, stable name it "chose" for itself.
var _names = null;
function nameFor(domainId) {
  if (!_names) {
    _names = {};
    var used = {};
    for (var i = 0; i < DOMAINS.length; i++) {
      var id = DOMAINS[i].id;
      var idx = hashStr(id) % NAME_POOL.length;
      while (used[idx]) { idx = (idx + 1) % NAME_POOL.length; }
      used[idx] = true;
      _names[id] = NAME_POOL[idx];
    }
  }
  return _names[domainId] || null;
}

// A one-line self-declared mandate. Capital-light framing: find + rank + prepare
// to the gate, never act. Domain label is folded in so each reads as its own.
function mandateFor(label) {
  return 'I watch ' + label + ', diagnose dysregulation honestly, surface the single '
    + 'best capital-light opportunity, and prepare it to the human gate. I never spend, '
    + 'send, or act on my own.';
}

// The operator identity record. `master` is the coordinator ("Kai").
function identity(domainId) {
  var d = null;
  for (var i = 0; i < DOMAINS.length; i++) { if (DOMAINS[i].id === domainId) { d = DOMAINS[i]; break; } }
  if (!d) return null;
  return { domain: d.id, runtimeKey: d.runtimeKey, label: d.label, name: nameFor(d.id), mandate: mandateFor(d.label) };
}

function roster() { return DOMAINS.map(function (d) { return identity(d.id); }); }

var MASTER = {
  name: 'Kai',
  role: 'orchestrator',
  mandate: 'I coordinate the twenty operators, run the salience competition, and speak '
    + 'one system decision. I restrain the whole fleet when the signal is distrusted or '
    + 'interpretive. I open a human gate; I never walk through it.'
};

// Run the whole fleet in one pass. `states` = map of runtimeKey/id -> brain state
// (the same shape limen-decision.decide reads: brainStress, brainKernelPhase, etc.).
// Missing state is honest, not fabricated: that operator decides "monitor, no live
// signal". Pure and free: no network, no AI, no writes.
function runFleet(states, ranAt) {
  states = states || {};
  var domainsObj = {};   // shape limen-workspace.synthesize expects
  var operators = [];

  for (var i = 0; i < DOMAINS.length; i++) {
    var d = DOMAINS[i];
    var st = states[d.id] || states[d.runtimeKey] || {};
    // ensure the decision knows which domain it is even with empty state
    if (!st.brainDomainId) st = Object.assign({ brainDomainId: d.id }, st);
    var dec = decision.decide(st);
    var hasSignal = st.brainStress != null || st.brainKernelPhase != null || (Array.isArray(st.brainOpportunities) && st.brainOpportunities.length);
    var id = identity(d.id);
    operators.push({
      name: id.name, domain: d.id, label: d.label, mandate: id.mandate,
      hasLiveSignal: !!hasSignal, decision: dec
    });
    domainsObj[d.id] = Object.assign({}, st, { decision: dec });
  }

  var system = workspace.synthesize(domainsObj);

  // Rank operators the same way the workspace competes for the spotlight:
  // escalate > act > monitor > abstain, scaled by stress and confidence.
  function salience(op, st) {
    var stress = Number(st.brainStress) || 0;
    var conf = (typeof st.brainConfidence === 'number') ? st.brainConfidence : 0.5;
    var p = op.decision.posture;
    var w = p === 'escalate' ? 1.6 : p === 'act' ? 1.15 : p === 'monitor' ? 0.7 : p === 'abstain' ? 0.5 : 0.6;
    return stress * (0.3 + 0.7 * conf) * w;
  }
  operators.forEach(function (op) { op.salience = Math.round(salience(op, states[op.domain] || states[op.domain] || {}) * 1000) / 1000; });
  operators.sort(function (a, b) { return b.salience - a.salience; });

  return {
    ranAt: ranAt || null,          // caller stamps the time (Date is not called here so this stays pure/testable)
    master: MASTER,
    system: system,
    operators: operators,
    counts: system && system.counts ? system.counts : null,
    interpretive: true, validated: false
  };
}

// Persist a run so operators compound (remember what they decided). Keeps the last
// `keep` entries per operator + a system stream. Uses limen-db (Redis or in-memory
// fallback). This is the ONLY function here that touches storage; runFleet stays pure.
async function journal(runResult, keep) {
  var db = require('./limen-db');
  keep = keep || 50;
  var stamp = runResult.ranAt || null;
  for (var i = 0; i < runResult.operators.length; i++) {
    var op = runResult.operators[i];
    var key = 'fleet:journal:' + op.domain;
    await db.lpush(key, { at: stamp, name: op.name, posture: op.decision.posture, boundedAction: op.decision.boundedAction, choice: op.decision.choice, situation: op.decision.situation });
    await db.ltrim(key, 0, keep - 1);
  }
  await db.lpush('fleet:journal:system', { at: stamp, posture: runResult.system && runResult.system.posture, boundedAction: runResult.system && runResult.system.boundedAction, focus: runResult.system && runResult.system.focus, selfReport: runResult.system && runResult.system.selfReport });
  await db.ltrim('fleet:journal:system', 0, keep - 1);
  return true;
}

async function history(domainId, n) {
  var db = require('./limen-db');
  var key = domainId === 'system' ? 'fleet:journal:system' : 'fleet:journal:' + domainId;
  return db.lrange(key, 0, (n || 10) - 1);
}

// OPTIONAL paid "deliberate" pass: let a named operator think harder with a real
// model (Claude to reason, Grok to retrieve). This is the only path here that can
// spend, and it CANNOT spend unless the operator has already opened the budget:
// ai-orchestrator.call is gated by the kill switch (LIMEN_AI_ENABLED + runtime
// pause) AND the per-tick token/call budget. Still bounded: it returns a written
// recommendation brief, never an action. Off unless explicitly invoked.
async function deliberate(domainId, state, opts) {
  opts = opts || {};
  var orch = require('./ai-orchestrator');
  var id = identity(domainId);
  if (!id) return { ok: false, error: 'unknown domain ' + domainId };
  var dec = decision.decide(Object.assign({ brainDomainId: domainId }, state || {}));
  var system = 'You are ' + id.name + ', the LIMEN Helix operator for ' + id.label + '. '
    + id.mandate + ' You are capital-light: prefer own-nothing, L1 opportunities that fund the next rung. '
    + 'Honesty is non-negotiable: label every claim validated/inferred/speculative, and never invent a '
    + 'result, feed, or live-data state. Your bounded action is only abstain | monitor | recommend | '
    + 'open-human-gate. You never spend, send, publish, or act. End on ONE recommendation and the exact '
    + 'human step required.';
  var prompt = 'Your deterministic decision this pass:\n' + JSON.stringify(dec, null, 2)
    + '\n\nLive state signals:\n' + JSON.stringify(state || {}, null, 2)
    + '\n\nDeliberate: is the bounded action right? Give your single best capital-light move for ' + id.label
    + ' and the one human step to unlock it. Be concise. Lead with the strongest objection to your own move.';
  var r = await orch.call(opts.intent || 'AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: opts.maxTokens || 1200, model: opts.model });
  return { ok: !!r.ok, operator: id.name, domain: domainId, disabled: r.disabled || false, error: r.error || null, deterministic: dec, deliberation: r.text || null, provider: r.provider || null };
}

// MASTER pass: Kai reads the whole ranked board + the deterministic system synthesis
// and speaks ONE master decision. This is the same gated path as deliberate() (routes
// ai-orchestrator, blocked by the kill switch + per-tick budget), so it cannot spend
// unattended. Kai is STILL bounded: it recommends and opens human gates, it never acts.
// The deterministic system decision (runResult.system) is always available for free;
// this only adds Kai's language-layer read on top when the operator opens the budget.
async function masterDeliberate(runResult, opts) {
  opts = opts || {};
  var orch = require('./ai-orchestrator');
  var sys = (runResult && runResult.system) || {};
  var board = ((runResult && runResult.operators) || []).map(function (op) {
    var dec = op.decision || op;
    return { name: op.name, domain: op.domain, posture: dec.posture, action: dec.boundedAction,
      choice: dec.choice, situation: dec.situation, salience: op.salience };
  });
  var system = 'You are Kai, the master operator of LIMEN Helix. Below you are twenty named domain '
    + 'operators, each of which reached one bounded decision from its brain\'s live signals, plus the '
    + 'deterministic system synthesis. You reason ACROSS them for a solo, unfunded operator whose goal '
    + 'is revenue with little or no capital (favor own-nothing, L1 opportunities that fund the next rung). '
    + 'HONESTY is non-negotiable: label claims validated/inferred/speculative, never invent a signal or '
    + 'live-data state, and treat the system conscience as binding — if it is restrictive, you restrain '
    + 'the fleet to recommend-only and say why. You do NOT act, steer, or move capital: your bounded '
    + 'action is only recommend or open-human-gate, and every spend/send/publish/deploy stays behind the '
    + 'human gate. Lead with the strongest objection to your own call. End on ONE focus domain, the single '
    + 'best capital-light move, and the exact human step to unlock it. Plain prose, tight.';
  var prompt = 'Fleet board this pass (ranked, deterministic):\n' + JSON.stringify(board, null, 0).slice(0, 9000)
    + '\n\nSystem synthesis: ' + JSON.stringify({ posture: sys.posture, boundedAction: sys.boundedAction, conscience: sys.conscience, focus: sys.focus, selfReport: sys.selfReport }).slice(0, 1800)
    + '\n\nAs Kai, give your one master decision now.';
  var r = await orch.call(opts.intent || 'AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: opts.maxTokens || 1000, model: opts.model });
  return {
    ok: !!r.ok, master: MASTER.name, disabled: r.disabled || false, error: r.error || null,
    deterministicSystem: { posture: sys.posture, boundedAction: sys.boundedAction, conscience: sys.conscience, focus: sys.focus },
    deliberation: r.text || null, provider: r.provider || null
  };
}

module.exports = {
  DOMAINS: DOMAINS, MASTER: MASTER,
  identity: identity, roster: roster, nameFor: nameFor,
  runFleet: runFleet, journal: journal, history: history,
  deliberate: deliberate, masterDeliberate: masterDeliberate,
  version: 1
};

// ─── CLI: `node lib/operator-fleet.js` prints the fleet board (deterministic, $0) ───
// With no live state wired in, every operator honestly reports "monitor, no live
// signal" — this verifies identity + the run + the system synthesis end to end.
if (require.main === module) {
  var res = runFleet({}, new Date().toISOString());
  var line = '─'.repeat(64);
  console.log(line);
  console.log('LIMEN HELIX OPERATOR FLEET   master: ' + res.master.name + ' (' + res.master.role + ')');
  console.log(line);
  res.operators.forEach(function (op) {
    var pad = (op.name + '        ').slice(0, 8);
    console.log(pad + '  ' + (op.label + '                         ').slice(0, 26)
      + '  ' + (op.decision.posture + '      ').slice(0, 8)
      + '  ' + op.decision.boundedAction
      + (op.hasLiveSignal ? '' : '  (no live signal)'));
  });
  console.log(line);
  if (res.system && res.system.ready) {
    console.log('SYSTEM (' + res.master.name + '): ' + res.system.posture + ' / ' + res.system.boundedAction);
    console.log(res.system.selfReport);
  } else {
    console.log('SYSTEM (' + res.master.name + '): no domain has a live decision yet (feed the brains, then re-run).');
  }
  console.log(line);
  console.log('interpretive:true validated:false  |  no spend, no send, no deploy — every action stops at the human gate.');
}
