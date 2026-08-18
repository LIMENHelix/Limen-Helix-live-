// ═══════════════════════════════════════════════════════════════════
// fleet-decision.js — brain-v2-native operator decisions + synthesis.
//
// The fleet consumes brain-v2's declared outputs directly. It does not recreate
// a second diagnosis engine and does not translate signed departure into the
// retired browser brain's stress/phase/immune/conscience vocabulary.
// ═══════════════════════════════════════════════════════════════════
'use strict';

function finite(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}
function list(value) { return Array.isArray(value) ? value : []; }
function label(value) { return String(value == null ? '' : value); }

function situation(input) {
  var parts = [];
  if (!input.ready) return 'brain-v2 has no measured fused state yet';
  parts.push('fused departure ' + (input.departure >= 0 ? '+' : '') +
    input.departure.toFixed(2) + 'σ');
  if (input.confidence !== null) {
    parts.push('confidence ' + Math.round(input.confidence * 100) + '%');
  }
  parts.push(input.active.length + ' active finding' +
    (input.active.length === 1 ? '' : 's'));
  if (input.blind.length) {
    parts.push(input.blind.length + ' blind channel' +
      (input.blind.length === 1 ? '' : 's'));
  }
  return parts.join(', ');
}

function decide(domain) {
  domain = domain || {};
  var ready = domain.brainV2Ready === true;
  var departure = finite(domain.brainDeparture);
  var confidence = finite(domain.brainConfidence);
  var dysregulation = domain.brainDysregulation || {};
  var findings = list(domain.brainFindings);
  var active = findings.filter(function (finding) {
    return finding && finding.active === true;
  });
  var blind = list(domain.brainBlind);
  var opportunities = list(domain.brainOpportunities);
  var top = opportunities[0] || null;
  var topTitle = top &&
    (top.title || top.biz || top.business || top.name || null);

  var posture = 'monitor';
  var action = 'monitor';
  var choice = null;
  var rationale = [];
  var cautioned = false;

  if (!ready || departure === null) {
    rationale.push('no measured brain-v2 fused state; do not infer one from legacy telemetry or an opportunity list');
  } else if (dysregulation.detected === true || active.length) {
    posture = 'escalate';
    choice = active.length
      ? 'Review ' + active.map(function (finding) { return finding.id; }).filter(Boolean).join(', ')
      : 'Review measured dysregulation';
    if (confidence !== null && confidence >= 0.4) {
      action = 'open-human-gate';
      rationale.push('brain-v2 emitted measured dysregulation or an active declared finding');
    } else {
      action = 'recommend';
      cautioned = true;
      rationale.push('brain-v2 emitted measured concern, but confidence is below the existing 0.40 human-gate policy');
    }
  } else if (top) {
    posture = 'act';
    action = 'recommend';
    choice = topTitle;
    rationale.push('a separately sourced business opportunity is available; recommend it without treating it as brain evidence');
  } else {
    posture = 'hold';
    action = 'monitor';
    rationale.push('brain-v2 emitted a measured state with no active finding or dysregulation');
  }

  if (ready && blind.length) {
    rationale.push(blind.length + ' declared channel' +
      (blind.length === 1 ? ' is' : 's are') +
      ' blind; this limits coverage but does not manufacture a veto');
  }

  return {
    domain: domain.brainDomainId || null,
    situation: situation({
      ready: ready && departure !== null,
      departure: departure,
      confidence: confidence,
      active: active,
      blind: blind
    }),
    posture: posture,
    choice: choice,
    confidence: confidence,
    phaseSource: 'brain-v2',
    evidenceAuthority: 'brain-v2',
    vetoed: false,
    cautioned: cautioned,
    rationale: rationale,
    boundedAction: action,
    interpretive: true,
    validated: false
  };
}

var SPOTLIGHT = 4;
var MODEL = 'brain-v2 evidence broadcast + bounded operator policy; not a second diagnosis engine';

function salienceFor(state, decision) {
  if (!state || state.brainV2Ready !== true) return 0;
  var departure = finite(state.brainDeparture);
  if (departure === null) return 0;
  var confidence = finite(state.brainConfidence);
  if (confidence === null) confidence = 0.5;
  var weight = decision.posture === 'escalate' ? 1.6 :
    decision.posture === 'act' ? 1.15 :
    decision.posture === 'hold' ? 0.6 : 0.7;
  return Math.abs(departure) * (0.3 + 0.7 * confidence) * weight;
}

function synthesize(domains) {
  domains = domains || {};
  var rows = [];
  Object.keys(domains).forEach(function (key) {
    var state = domains[key];
    if (!state || !state.decision || state.brainV2Ready !== true) return;
    var departure = finite(state.brainDeparture);
    if (departure === null) return;
    rows.push({
      domain: state.decision.domain || key,
      departure: departure,
      magnitude: Math.abs(departure),
      confidence: finite(state.brainConfidence),
      posture: state.decision.posture,
      choice: state.decision.choice || null,
      cautioned: !!state.decision.cautioned,
      action: state.decision.boundedAction || 'monitor',
      salience: salienceFor(state, state.decision)
    });
  });

  if (!rows.length) return { ready: false, model: MODEL };

  rows.sort(function (a, b) { return b.salience - a.salience; });
  var broadcast = rows.slice(0, SPOTLIGHT);
  var escalating = rows.filter(function (row) {
    return row.posture === 'escalate';
  });
  var acting = rows.filter(function (row) {
    return row.posture === 'act' || row.posture === 'escalate';
  });
  var cautioned = rows.filter(function (row) { return row.cautioned; });

  var posture = 'hold';
  var boundedAction = 'monitor';
  if (escalating.length) {
    posture = 'escalate';
    boundedAction = escalating.some(function (row) {
      return row.action === 'open-human-gate';
    }) ? 'open-human-gate' : 'recommend';
  } else if (acting.length) {
    posture = 'act';
    boundedAction = 'recommend';
  }

  var focus = broadcast[0] || null;
  var counts = {
    escalate: escalating.length,
    act: acting.length - escalating.length,
    hold: rows.filter(function (row) { return row.posture === 'hold'; }).length,
    cautioned: cautioned.length,
    abstain: 0
  };
  var evidencePolicy = {
    state: cautioned.length ? 'cautious' : 'permissive',
    reasons: cautioned.length
      ? [cautioned.length + ' measured concern(s) remain below the human-gate confidence policy']
      : []
  };
  var names = broadcast.map(function (row) { return row.domain; }).join(', ');

  return {
    ready: true,
    systemSignal: broadcast.reduce(function (sum, row) {
      return sum + row.magnitude;
    }, 0) / broadcast.length,
    posture: posture,
    boundedAction: boundedAction,
    focus: focus ? {
      domain: focus.domain,
      choice: focus.choice,
      posture: focus.posture
    } : null,
    broadcast: broadcast.map(function (row) {
      return {
        domain: row.domain,
        posture: row.posture,
        salience: Math.round(row.salience * 100) / 100,
        departure: row.departure,
        choice: row.choice
      };
    }),
    conscience: evidencePolicy,
    evidencePolicy: evidencePolicy,
    counts: counts,
    selfReport: 'Connectome: ' + rows.length +
      ' brain-v2 domains measured; ' + escalating.length +
      ' requesting review, ' + counts.hold + ' holding. Attention on ' +
      names + '.',
    interpretive: true,
    validated: false,
    model: MODEL
  };
}

module.exports = {
  decide: decide,
  synthesize: synthesize,
  salienceFor: salienceFor,
  SPOTLIGHT: SPOTLIGHT,
  MODEL: MODEL
};
