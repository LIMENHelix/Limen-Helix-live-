// ═══════════════════════════════════════════════════════════════════
// fleet-decision.js — SERVER mirror of the browser decision + workspace logic.
//
// Vercel functions exclude assets/** from the bundle (vercel.json excludeFiles),
// so lib/ server code cannot require the browser files at runtime. This is a
// verbatim CommonJS copy of the two PURE, deterministic functions the fleet uses:
//   - decide()      <- assets/js/limen-decision.js   (the honest per-domain rules)
//   - synthesize()  <- assets/js/limen-workspace.js  (salience + system conscience)
//
// KEEP IN SYNC with those canonical browser sources. They are pure math with no
// deps, so this copy is safe; if you change the honesty rules there, change them
// here too. Behavior is identical (same inputs -> same outputs), verified by the
// fleet integration tests.
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ─── from limen-decision.js ───
function dNum(x, dflt) { var n = Number(x); return isFinite(n) ? n : (dflt === undefined ? 0 : dflt); }
function dS(x) { return String(x == null ? '' : x); }

function situation(stress, phase, traj, immune) {
  var parts = ['stress ' + Math.round(dNum(stress) * 100) + '/100'];
  if (phase) parts.push('phase ' + dS(phase).toUpperCase());
  if (traj) parts.push(dS(traj).replace(/_/g, ' ').toLowerCase());
  if (immune && immune !== 'clear') parts.push('immune ' + immune);
  return parts.join(', ');
}

function decide(d) {
  d = d || {};
  var stress = dNum(d.brainStress);
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

  var breaking = /^p(1|3|7|9)\b/.test(dS(phase));
  var badTraj = /DIVERG|UNRECOV/i.test(dS(traj));
  var goodTraj = /RECOVER|STABLE/i.test(dS(traj));
  var cautioned = conscience === 'restrictive';   // conscience distrusts its OWN signal (unproven / thin source)
  var lowConf = (conf != null && conf < 0.4) || src === 'fallback';

  var posture, action = 'monitor', choice = null, why = [];

  if (cautioned) {
    // The conscience distrusts its OWN signal (overclaim / insufficient source / thin data). That is
    // UNPROVEN, not harmful, and unproven != inert: every bounded action here is reversible (monitor /
    // recommend, human-gated), so the honest floor is to MONITOR and say so, never go dark. We recommend
    // NOTHING off a distrusted signal (choice stays null), but the operator stays engaged and flags the doubt.
    posture = 'monitor'; action = 'monitor';
    why.push('conscience flags this signal as unproven (overclaim / insufficient source): monitoring only, recommending nothing off a signal the domain distrusts');
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
    posture: posture,
    choice: choice,
    confidence: conf,
    phaseSource: src,
    vetoed: false,          // the fleet has no HARD veto: nothing it does is irreversible (floor = monitor)
    cautioned: cautioned,   // signal flagged unproven -> monitor + say so, never abstain
    rationale: why,
    boundedAction: action,
    interpretive: true, validated: false
  };
}

// ─── from limen-workspace.js ───
function wNum(x, d) { var n = Number(x); return isFinite(n) ? n : (d === undefined ? 0 : d); }
var SPOTLIGHT = 4;
var MODEL = 'functional global-workspace model (GWT-style broadcast + system conscience); NOT a claim of subjective experience';

function synthesize(domainsObj) {
  domainsObj = domainsObj || {};
  var rows = [];
  for (var k in domainsObj) {
    if (!domainsObj.hasOwnProperty(k)) continue;
    var d = domainsObj[k]; if (!d || typeof d !== 'object') continue;
    var dec = d.decision;
    if (!dec || !dec.posture) continue;
    var stress = wNum(d.brainStress);
    var conf = (typeof d.brainConfidence === 'number' && isFinite(d.brainConfidence)) ? d.brainConfidence : 0.5;
    var post = dec.posture;
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
  var broadcast = rows.slice(0, SPOTLIGHT);
  var escalating = rows.filter(function (r) { return r.posture === 'escalate'; });
  var acting = rows.filter(function (r) { return r.posture === 'act' || r.posture === 'escalate'; });
  var cautionedInSpot = broadcast.filter(function (r) { return r.cautioned; });
  var fallbackActing = acting.filter(function (r) { return r.src !== 'kernel'; });

  var reasons = [];
  // A cautioned domain flags ITS OWN signal as unproven and is MONITORING (recommending nothing).
  // That is a note, not a restraint: the system does not go dark just because a signal is unproven.
  if (cautionedInSpot.length) reasons.push(cautionedInSpot.length + ' domain(s) in the spotlight flag their own signal as unproven (monitoring, recommending nothing)');
  // The one genuine restraint: most domains that WANT TO ACT are doing so off interpretive/fallback
  // phase, not the validated kernel. Cap those at recommend so nothing opens a human gate off unproven phase.
  var restrain = !!(acting.length && fallbackActing.length / acting.length > 0.6);
  if (restrain) reasons.push('most acting domains are on interpretive/fallback phase, not the validated kernel');
  var conscienceState = restrain ? 'restrictive' : (cautionedInSpot.length ? 'cautious' : 'permissive');

  var focus = broadcast[0] || null;
  var posture, action;
  if (conscienceState === 'restrictive') {
    posture = 'restrain'; action = 'recommend';
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
    posture: posture,
    boundedAction: action,
    focus: focus ? { domain: focus.domain, choice: focus.choice, posture: focus.posture } : null,
    broadcast: broadcast.map(function (r) { return { domain: r.domain, posture: r.posture, salience: Math.round(r.salience * 100) / 100, choice: r.choice }; }),
    conscience: { state: conscienceState, reasons: reasons },
    counts: famCount,
    selfReport: selfReport,
    interpretive: true, validated: false, model: MODEL
  };
}

module.exports = { decide: decide, synthesize: synthesize, SPOTLIGHT: SPOTLIGHT, MODEL: MODEL };
