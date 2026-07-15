/**
 * api/fleet — the operator fleet, live.
 *
 * GET /api/fleet            -> 20 named operators + master Kai, decided off the
 *                              latest server signals (console_snapshot + per-domain
 *                              cognition + opportunities_snapshot). Deterministic, free.
 * GET /api/fleet?journal=1  -> also append this run to each operator's journal so
 *                              they compound over time (opt-in; casual reads don't write).
 *
 * No paid AI on this path. Every output is interpretive:true / validated:false and
 * bounded to abstain|monitor|recommend|open-human-gate. Nothing here spends, sends,
 * publishes, or deploys. The gated "deliberate" (paid) pass lives in operator-fleet.js
 * and is invoked separately, behind the kill switch + budget.
 */
'use strict';

var FLEET = require('../lib/operator-fleet');
var signals = require('../lib/fleet-signals');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  try {
    var loaded = await signals.loadStates();
    var run = FLEET.runFleet(loaded.states, new Date().toISOString());

    var doJournal = /[?&]journal=1\b/.test(req.url || '');
    if (doJournal) { try { await FLEET.journal(run); } catch (e) { doJournal = false; } }

    // Master (Kai) language read — opt-in (?master=1), and paid, so it is gated by the
    // kill switch + budget inside masterDeliberate. Returns disabled:true (never throws)
    // until the operator opens the budget. The free system synthesis is always present below.
    var masterRead = null;
    if (/[?&]master=1\b/.test(req.url || '')) {
      try { masterRead = await FLEET.masterDeliberate(run); } catch (e) { masterRead = { ok: false, error: String(e && e.message || e) }; }
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      ranAt: run.ranAt,
      meta: loaded.meta,
      master: run.master,
      masterDeliberation: masterRead,
      system: run.system,
      operators: run.operators.map(function (op) {
        return {
          name: op.name, domain: op.domain, label: op.label,
          hasLiveSignal: op.hasLiveSignal, salience: op.salience,
          posture: op.decision.posture, boundedAction: op.decision.boundedAction,
          choice: op.decision.choice, situation: op.decision.situation,
          rationale: op.decision.rationale, vetoed: op.decision.vetoed,
          cautioned: op.decision.cautioned
        };
      }),
      journaled: doJournal,
      interpretive: true, validated: false
    }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
