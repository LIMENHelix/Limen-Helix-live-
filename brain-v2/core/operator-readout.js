/**
 * brain-v2/core/operator-readout.js — bounded public projection of a brain-v2 cycle.
 *
 * The kernel keeps richer internal objects. This projection carries only what an operator
 * needs to understand the current domain read: measured state, evidence coverage, findings,
 * abstentions and declared-relationship evidence. Raw values, source identities, packets,
 * memory records and executable predicates never cross this boundary.
 */
'use strict';

var VERSION = 1;

function finite(v) {
  return (typeof v === 'number' && isFinite(v)) ? v : null;
}

function text(v) {
  return (typeof v === 'string' && v) ? v : null;
}

function array(v) {
  return Array.isArray(v) ? v : [];
}

function stateProjection(state) {
  state = state || {};
  return {
    abstained: !!state.abstained,
    why: text(state.why),
    departure: finite(state.departure),
    confidence: finite(state.confidence),
    totalPrecision: finite(state.totalPrecision)
  };
}

function sensorProjection(sensor) {
  sensor = sensor || {};
  var departure = sensor.departure || {};
  return {
    key: text(sensor.key),
    state: text(sensor.state),
    liveness: text(sensor.liveness),
    fusable: !!sensor.fusable,
    why: text(sensor.why),
    departure: sensor.departure ? {
      z: finite(departure.z),
      n: finite(departure.n)
    } : null
  };
}

function findingProjection(finding) {
  finding = finding || {};
  return {
    id: text(finding.id),
    active: finding.active === true,
    triggeredBy: array(finding.triggeredBy).filter(function (x) { return typeof x === 'string'; }),
    basis: text(finding.basis)
  };
}

function candidateProjection(candidate) {
  candidate = candidate || {};
  return {
    id: text(candidate.id),
    active: false,
    triggerSource: text(candidate.triggerSource),
    why: text(candidate.why)
  };
}

function dysregulationProjection(dys) {
  dys = dys || {};
  return {
    detected: !!dys.detected,
    departure: finite(dys.departure),
    drivers: array(dys.drivers).map(function (driver) {
      driver = driver || {};
      return { key: text(driver.key), z: finite(driver.z), n: finite(driver.n) };
    }),
    basis: text(dys.basis),
    why: text(dys.why)
  };
}

function divergenceProjection(divergence) {
  divergence = divergence || {};
  return {
    pairs: finite(divergence.pairs),
    comparable: finite(divergence.comparable),
    detected: !!divergence.detected,
    why: text(divergence.why),
    divergences: array(divergence.divergences),
    skipped: array(divergence.skipped),
    lifecycle: divergence.lifecycle || null,
    outcomes: divergence.outcomes || null
  };
}

function fromCycle(cycle) {
  if (!cycle || typeof cycle !== 'object') return null;
  return {
    schemaVersion: VERSION,
    authority: 'brain-v2',
    domain: text(cycle.domain),
    cycleAt: finite(cycle.cycleAt),
    cycle: finite(cycle.cycle),
    state: stateProjection(cycle.state),
    dysregulation: dysregulationProjection(cycle.dysregulation),
    sensors: array(cycle.sensors).map(sensorProjection),
    findings: array(cycle.findings).map(findingProjection),
    candidates: array(cycle.candidates).map(candidateProjection),
    blind: array(cycle.blind).map(function (blind) {
      blind = blind || {};
      return {
        what: text(blind.what),
        state: text(blind.state),
        liveness: text(blind.liveness),
        why: text(blind.why)
      };
    }),
    divergence: divergenceProjection(cycle.divergence)
  };
}

function publicReport(report) {
  if (!report || typeof report !== 'object') return null;
  return {
    ok: report.ok === true,
    authority: 'brain-v2',
    runtime: text(report.runtime),
    domain: text(report.domain),
    product: text(report.product),
    startedAt: finite(report.startedAt),
    finishedAt: finite(report.finishedAt),
    rowsAvailable: finite(report.rowsAvailable),
    rowsApplied: finite(report.rowsApplied),
    ticks: finite(report.ticks),
    restored: report.restored === true,
    abstentions: array(report.abstentions),
    provenance: report.provenance || null,
    state: report.operatorRead || null,
    predictions: report.predictions || null,
    calibration: report.calibration || null,
    relationships: report.relationshipEvidence || null,
    domainFunction: report.domainFunction || null,
    error: text(report.error)
  };
}

module.exports = {
  VERSION: VERSION,
  fromCycle: fromCycle,
  publicReport: publicReport
};
