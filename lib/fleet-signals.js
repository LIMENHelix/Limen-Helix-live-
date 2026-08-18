/**
 * lib/fleet-signals.js — adapt persisted brain-v2 cycles for the operator fleet.
 *
 * brain-v2 is the only domain-brain authority on this path. The adapter reads the
 * same confined cycle records as /api/domain-brain and preserves their meanings:
 * signed fused departure, confidence, dysregulation, findings, blindness,
 * relationships, predictions and calibration. It does not translate them into the
 * retired browser brain's stress, phase, immune or conscience vocabulary.
 *
 * Business opportunities remain a separate input. Their rank is never evidence for
 * a brain finding, and a brain finding never manufactures an opportunity.
 */
'use strict';

var db = require('./limen-db');
var STORE = require('./brain-shadow-store');
var READOUT = require('../brain-v2/core/operator-readout.js');
var REGISTRY = require('../brain-v2/bind/registry.js');
var FLEET = require('./operator-fleet');

function finite(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function opportunityMap(snapshot) {
  var out = {};
  var rows = snapshot && Array.isArray(snapshot.opportunities)
    ? snapshot.opportunities
    : [];
  rows.forEach(function (row) {
    if (!row || !row.domain) return;
    (out[row.domain] = out[row.domain] || []).push({
      title: row.title,
      rank: row.rank,
      urgency: row.urgency
    });
  });
  Object.keys(out).forEach(function (domain) {
    out[domain].sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
  });
  return out;
}

function adaptCycle(operator, report, opportunities) {
  var bounded = report ? READOUT.publicReport(report) : null;
  var read = bounded && bounded.state;
  var fused = read && read.state;
  var findings = read && Array.isArray(read.findings) ? read.findings : [];
  var blind = read && Array.isArray(read.blind) ? read.blind : [];
  var dysregulation = read && read.dysregulation ? read.dysregulation : null;
  var ready = !!(fused && fused.abstained !== true && finite(fused.departure) !== null);

  return {
    brainDomainId: operator.id,
    brainAuthority: 'brain-v2',
    brainV2Ready: ready,
    brainDeparture: fused ? finite(fused.departure) : null,
    brainConfidence: fused ? finite(fused.confidence) : null,
    brainDysregulation: dysregulation,
    brainFindings: findings,
    brainBlind: blind,
    brainPredictions: bounded ? bounded.predictions : null,
    brainCalibration: bounded ? bounded.calibration : null,
    brainRelationships: bounded ? bounded.relationships : null,
    brainDomainFunction: bounded ? bounded.domainFunction : null,
    brainProvenance: bounded ? bounded.provenance : null,
    brainCycleAt: read ? finite(read.cycleAt) : null,
    brainV2: bounded,
    brainOpportunities: opportunities || []
  };
}

async function loadStates(options) {
  options = options || {};
  var readCycle = options.readCycle || STORE.readCycle;
  var getSnapshot = options.getSnapshot || function () { return db.get('opportunities_snapshot'); };

  var oppSnapshot = null;
  try { oppSnapshot = await getSnapshot(); } catch (e) {}
  var opps = opportunityMap(oppSnapshot);
  var states = {};
  var errors = [];
  var readyCount = 0;

  for (var i = 0; i < FLEET.DOMAINS.length; i++) {
    var operator = FLEET.DOMAINS[i];
    var descriptor = REGISTRY.descriptorFor(operator.id) ||
      REGISTRY.descriptorFor(operator.runtimeKey);
    var report = null;
    if (!descriptor) {
      errors.push({ domain: operator.id, error: 'no brain-v2 descriptor' });
    } else {
      try {
        report = await readCycle(descriptor.snapshot);
      } catch (error) {
        errors.push({
          domain: operator.id,
          error: (error && error.message) || String(error)
        });
      }
    }

    var domainOpps = opps[operator.runtimeKey] || opps[operator.id] || [];
    var state = adaptCycle(operator, report, domainOpps);
    if (state.brainV2Ready) readyCount++;
    states[operator.id] = state;
  }

  return {
    states: states,
    meta: {
      authority: 'brain-v2',
      cycleStore: STORE.PREFIX,
      installedCount: FLEET.DOMAINS.length,
      readyCount: readyCount,
      domainsWithSignal: readyCount,
      opportunitySnapshotAt: oppSnapshot ? oppSnapshot.generatedAt : null,
      opportunityBackend: db.getBackend(),
      errors: errors
    }
  };
}

module.exports = {
  loadStates: loadStates,
  adaptCycle: adaptCycle,
  _opportunityMap: opportunityMap
};
