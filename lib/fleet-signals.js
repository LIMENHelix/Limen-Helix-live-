// ═══════════════════════════════════════════════════════════════════
// fleet-signals.js — feed the operator fleet real server-side signals.
//
// Maps the two live server stores into the brain* state shape that
// limen-decision.decide reads (the same shape the browser adapter builds):
//   - console_snapshot            -> stress, confidence, PROVISIONAL phase (per runtimeKey)
//   - limen:brain:cognition:<id>  -> immune + conscience state (the veto inputs)
//   - opportunities_snapshot      -> per-domain ranked opportunities
//
// HONESTY: the server phase is provisional (the snapshot worker says so — it
// suppresses phases that need viability/recovery inputs it lacks). So phaseSource
// is 'server-provisional', which limen-decision treats as fallback: every
// server-derived act/escalate caps at RECOMMEND and never opens a human gate off a
// non-validated phase. Missing signal for a domain is left ABSENT, not faked, so
// that operator honestly reports "no live signal".
// ═══════════════════════════════════════════════════════════════════
'use strict';

var db = require('./limen-db');
var FLEET = require('./operator-fleet');

async function loadStates() {
  var states = {};
  var consoleSnap = null, oppSnap = null;
  try { consoleSnap = await db.get('console_snapshot'); } catch (e) {}
  try { oppSnap = await db.get('opportunities_snapshot'); } catch (e) {}
  var cdomains = (consoleSnap && consoleSnap.domains) || {};
  var opps = (oppSnap && Array.isArray(oppSnap.opportunities)) ? oppSnap.opportunities : [];

  for (var i = 0; i < FLEET.DOMAINS.length; i++) {
    var d = FLEET.DOMAINS[i];
    // console_snapshot is keyed by runtimeKey (health/research/supplyChain); cognition by id.
    var cs = cdomains[d.runtimeKey] || cdomains[d.id] || null;
    var cog = null;
    try { var rec = await db.get('brain:cognition:' + d.id); cog = (rec && rec.c) ? rec.c : null; } catch (e) {}

    var domainOpps = opps
      .filter(function (o) { return o.domain === d.runtimeKey || o.domain === d.id; })
      .sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); })
      .map(function (o) { return { title: o.title, rank: o.rank, urgency: o.urgency }; });

    if (!cs && !cog && !domainOpps.length) continue;   // honest: no live signal -> operator absent this run

    states[d.id] = {
      brainDomainId: d.id,
      brainStress: (cog && typeof cog.stress === 'number') ? cog.stress : (cs ? cs.stress : null),
      brainPhase: cs ? (cs.phase || cs.phaseLabel) : (cog ? cog.phase : null),
      brainPhaseSource: 'server-provisional',   // NOT thing2-kernel: decide() reads this as fallback -> caps at recommend
      brainConfidence: cs ? cs.confidence : null,
      brainCognition: cog || null,              // compact cognition: immune.immuneState + conscience.conscienceState
      brainOpportunities: domainOpps
    };
  }

  return {
    states: states,
    meta: {
      consoleAt: consoleSnap ? consoleSnap.generatedAt : null,
      oppAt: oppSnap ? oppSnap.generatedAt : null,
      backend: db.getBackend(),
      domainsWithSignal: Object.keys(states).length
    }
  };
}

module.exports = { loadStates: loadStates };
