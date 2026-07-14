// ═══════════════════════════════════════════════════════════════════
// limen-decision.js — the honest DECISION layer for the domain brains.
//
// Every domain already SENSES (stress), self-models (six cognition layers:
// immune / awareness / conscience / intuition / simulation), tracks PHASE
// (thing2 kernel), and RANKS opportunities. What was missing is the step that
// INTEGRATES those real signals into one explicit decision. This does that.
//
// It invents nothing: every input is a signal the brain already computed and
// the adapter already forwarded onto window.LIMENDomains[domain]. The output
// is a deterministic function of real state.
//
// HARD HONESTY RULES (why this is a decision and not theatre):
//   1. The CONSCIENCE veto overrides everything. If the domain's conscience is
//      restrictive (overclaim / insufficient source / harm risk), the decision
//      is ABSTAIN — no action is chosen off a signal the domain itself distrusts.
//   2. Low confidence, or a phase from the fallback (not the validated kernel),
//      caps the action at RECOMMEND. It never escalates to a gate or an actuation.
//   3. boundedAction is NEVER autonomous external action. It is one of:
//      abstain | monitor | recommend | open-human-gate. Spending, publishing,
//      contacting, and deploying stay behind the human gate, always.
//
// Pure deterministic math, no network, no AI. Dual export: window.LIMENDecision
// (browser) + module.exports (node tests).
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';
  function num(x, dflt) { var n = Number(x); return isFinite(n) ? n : (dflt === undefined ? 0 : dflt); }
  function s(x) { return String(x == null ? '' : x); }

  function situation(stress, phase, traj, immune) {
    var parts = ['stress ' + Math.round(num(stress) * 100) + '/100'];
    if (phase) parts.push('phase ' + s(phase).toUpperCase());
    if (traj) parts.push(s(traj).replace(/_/g, ' ').toLowerCase());
    if (immune && immune !== 'clear') parts.push('immune ' + immune);
    return parts.join(', ');
  }

  // d = window.LIMENDomains[domain] (adapter output). All fields optional/guarded.
  function decide(d) {
    d = d || {};
    var stress = num(d.brainStress);
    var phase = d.brainKernelPhase || d.brainPhase || null;
    var traj = d.brainKernelTrajectory || d.brainTrajectory || null;
    var src = d.brainPhaseSource === 'thing2-kernel' ? 'kernel' : 'fallback';
    var conf = (typeof d.brainConfidence === 'number' && isFinite(d.brainConfidence)) ? d.brainConfidence : null;

    var cog = d.brainCognition || {};
    var immune = (cog.immune && cog.immune.immuneState) || cog.immuneState || null;
    var conscience = (cog.conscience && (cog.conscience.conscienceState || cog.conscience.conscienceDecision)) || cog.conscienceState || null;

    var opps = Array.isArray(d.brainOpportunities) ? d.brainOpportunities : [];
    var top = opps[0] || null;
    var topTitle = top ? (top.title || top.biz || top.business || top.name || null) : null;

    var breaking = /^p(1|3|7|9)\b/.test(s(phase));         // BREAKING family
    var badTraj = /DIVERG|UNRECOV/i.test(s(traj));
    var goodTraj = /RECOVER|STABLE/i.test(s(traj));
    var vetoed = conscience === 'restrictive';
    var lowConf = (conf != null && conf < 0.4) || src === 'fallback';

    var posture, action = 'monitor', choice = null, why = [];

    if (vetoed) {
      posture = 'abstain'; action = 'abstain';
      why.push('conscience veto: the domain distrusts its own signal (overclaim / insufficient source)');
    } else if (immune === 'alert' || (stress >= 0.68 && breaking && badTraj)) {
      posture = 'escalate';
      why.push(immune === 'alert' ? 'immune alert' : 'high stress in a breaking phase on an adverse trajectory');
    } else if (stress < 0.5 && goodTraj) {
      posture = 'hold';
      why.push('low stress, stable or recovering trajectory');
    } else if (top) {
      posture = 'act';
      why.push('an actionable opportunity is available');
    } else {
      posture = 'monitor';
      why.push('no clear opportunity; watch');
    }

    if (posture === 'act' || posture === 'escalate') {
      choice = topTitle;
      if (lowConf) { action = 'recommend'; why.push('confidence low or phase from fallback (interpretive): recommend only, do not escalate'); }
      else { action = 'open-human-gate'; why.push('surface the chosen action to the operator gate; a human decides to spend/publish/act'); }
    }

    return {
      domain: d.brainDomainId || null,
      situation: situation(stress, phase, traj, immune),
      posture: posture,                 // abstain | hold | monitor | act | escalate
      choice: choice,                   // the chosen opportunity title, or null
      confidence: conf,
      phaseSource: src,                 // kernel | fallback
      vetoed: vetoed,
      rationale: why,
      boundedAction: action,            // abstain | monitor | recommend | open-human-gate — NEVER autonomous external
      interpretive: true, validated: false
    };
  }

  var API = { decide: decide, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENDecision = API;
})(typeof window !== 'undefined' ? window : this);
