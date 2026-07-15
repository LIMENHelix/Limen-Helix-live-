// ═══════════════════════════════════════════════════════════════════
// limen-workspace.js — the GLOBAL WORKSPACE: 20 domains -> one system-level mind.
//
// Each domain already reaches its own bounded decision (limen-decision.js). This binds
// them: it broadcasts every domain's state+decision into one shared space, runs a
// SALIENCE COMPETITION so only the most urgent few win the "spotlight" (Global Workspace
// Theory's limited-capacity broadcast), and from the winners produces a single
// SYSTEM-LEVEL self-report, conscience, and decision. The connectome acts as one whole
// instead of twenty separate brains.
//
// HONESTY (hard, non-negotiable):
//   - This is a FUNCTIONAL model of the architecture consciousness theories describe
//     (global broadcast + self-model + a conscience that can override). It produces
//     consciousness-LIKE behavior (unified self-report, salience competition, global veto).
//     It is NOT a claim of subjective experience. interpretive:true, validated:false, always.
//   - The SYSTEM CONSCIENCE is the overriding faculty (the "safe" you asked for): if the
//     spotlight carries a vetoed domain, or the system would act mostly on low-confidence /
//     fallback signals, the whole connectome restrains. It aggregates and elevates the
//     per-domain conscience to the system level.
//   - The system boundedAction is NEVER autonomous external. Only:
//     abstain | monitor | recommend | open-human-gate. Spend/publish/contact/deploy stay
//     behind the human gate, for the system exactly as for a single domain.
//
// Pure deterministic math, no network, no AI. Dual export.
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d === undefined ? 0 : d); }

  var SPOTLIGHT = 4;   // limited-capacity broadcast: only the top few reach the global workspace

  // domainsObj = window.LIMENDomains (keyed by domain). Reads each slot's .decision + signals.
  function synthesize(domainsObj) {
    domainsObj = domainsObj || {};
    var rows = [];
    for (var k in domainsObj) {
      if (!domainsObj.hasOwnProperty(k)) continue;
      var d = domainsObj[k]; if (!d || typeof d !== 'object') continue;
      var dec = d.decision;
      if (!dec || !dec.posture) continue;                       // only domains that have decided
      var stress = num(d.brainStress);
      var conf = (typeof d.brainConfidence === 'number' && isFinite(d.brainConfidence)) ? d.brainConfidence : 0.5;
      var post = dec.posture;
      // salience = how loudly this domain competes for the global spotlight
      var w = post === 'escalate' ? 1.6 : post === 'act' ? 1.15 : post === 'monitor' ? 0.7 : post === 'abstain' ? 0.5 : 0.6;
      var salience = stress * (0.3 + 0.7 * conf) * w;
      rows.push({
        domain: dec.domain || k, stress: stress, conf: conf, posture: post,
        choice: dec.choice || null, cautioned: !!dec.cautioned, src: dec.phaseSource || 'fallback',
        action: dec.boundedAction || 'monitor', salience: salience
      });
    }
    if (!rows.length) return { ready: false, model: MODEL };

    rows.sort(function (a, b) { return b.salience - a.salience; });
    var broadcast = rows.slice(0, SPOTLIGHT);                   // what is "in mind" right now
    var escalating = rows.filter(function (r) { return r.posture === 'escalate'; });
    var acting = rows.filter(function (r) { return r.posture === 'act' || r.posture === 'escalate'; });
    var cautionedInSpot = broadcast.filter(function (r) { return r.cautioned; });
    var fallbackActing = acting.filter(function (r) { return r.src !== 'kernel'; });

    // ── SYSTEM CONSCIENCE (the overriding faculty) ──
    var reasons = [];
    // A cautioned domain flags ITS OWN signal as unproven and is MONITORING (recommending nothing).
    // That is a note, not a restraint: the system does not go dark just because a signal is unproven.
    if (cautionedInSpot.length) reasons.push(cautionedInSpot.length + ' domain(s) in the spotlight flag their own signal as unproven (monitoring, recommending nothing)');
    // The one genuine restraint: most domains that WANT TO ACT are doing so off interpretive/fallback phase.
    var restrain = !!(acting.length && fallbackActing.length / acting.length > 0.6);
    if (restrain) reasons.push('most acting domains are on interpretive/fallback phase, not the validated kernel');
    var conscienceState = restrain ? 'restrictive' : (cautionedInSpot.length ? 'cautious' : 'permissive');

    // ── SYSTEM DECISION (bounded, conscience-gated) ──
    var focus = broadcast[0] || null;
    var posture, action;
    if (conscienceState === 'restrictive') {
      posture = 'restrain'; action = 'recommend';               // capped: the system will not open a gate off distrusted/low-confidence signal
      reasons.unshift('system conscience restrains: recommend only, no gate');
    } else if (escalating.length) {
      posture = 'escalate'; action = 'open-human-gate';
    } else if (acting.length) {
      posture = 'act'; action = 'recommend';
    } else {
      posture = 'hold'; action = 'monitor';
    }

    var famCount = { escalate: escalating.length, act: acting.length - escalating.length,
      hold: rows.filter(function (r) { return r.posture === 'hold'; }).length,
      cautioned: rows.filter(function (r) { return r.cautioned; }).length,
      abstain: rows.filter(function (r) { return r.posture === 'abstain'; }).length };

    var spotNames = broadcast.map(function (r) { return r.domain; }).join(', ');
    var selfReport = 'Connectome: ' + rows.length + ' domains deciding; '
      + escalating.length + ' escalating, ' + famCount.hold + ' holding, ' + famCount.cautioned + ' flagging their signal unproven. '
      + 'Attention on ' + spotNames + '. Conscience ' + conscienceState
      + (reasons.length ? ' (' + reasons[0] + ')' : '') + '.';

    return {
      ready: true,
      systemStress: broadcast.reduce(function (a, r) { return a + r.stress; }, 0) / broadcast.length,
      posture: posture,                                         // restrain | escalate | act | hold
      boundedAction: action,                                    // abstain | monitor | recommend | open-human-gate
      focus: focus ? { domain: focus.domain, choice: focus.choice, posture: focus.posture } : null,
      broadcast: broadcast.map(function (r) { return { domain: r.domain, posture: r.posture, salience: Math.round(r.salience * 100) / 100, choice: r.choice }; }),
      conscience: { state: conscienceState, reasons: reasons },
      counts: famCount,
      selfReport: selfReport,
      interpretive: true, validated: false, model: MODEL
    };
  }

  var MODEL = 'functional global-workspace model (GWT-style broadcast + system conscience); NOT a claim of subjective experience';
  var API = { synthesize: synthesize, SPOTLIGHT: SPOTLIGHT, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENWorkspace = API;
})(typeof window !== 'undefined' ? window : this);
