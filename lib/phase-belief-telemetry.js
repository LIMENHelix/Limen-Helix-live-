'use strict';

/**
 * Project the phase estimator result into the public worker snapshot.
 *
 * This module is deliberately telemetry-only. It does not estimate, normalize,
 * or promote anything; it exposes the estimator's existing abstention reason
 * and channel precision without leaking its correlation memory.
 */
function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boundedText(value, limit) {
  if (typeof value !== 'string') return null;
  return value.slice(0, limit || 240);
}

function degradationView(degraded) {
  if (!degraded || typeof degraded !== 'object') return null;
  return {
    reason: boundedText(degraded.reason, 240),
    untransformedChannels: typeof degraded.untransformedChannels === 'boolean'
      ? degraded.untransformedChannels
      : null,
    selfConsistencyPrecision: typeof degraded.selfConsistencyPrecision === 'boolean'
      ? degraded.selfConsistencyPrecision
      : null,
    uninformativeChannels: Number.isInteger(degraded.uninformativeChannels)
      ? degraded.uninformativeChannels
      : null
  };
}

function channelView(channels) {
  if (!Array.isArray(channels)) return null;
  return channels.slice(0, 64).map(function (channel) {
    return {
      key: boundedText(channel && channel.key, 80),
      precision: finiteOrNull(channel && channel.precision),
      informative: !!(channel && channel.informative),
      fromHint: !!(channel && channel.fromHint)
    };
  }).filter(function (channel) { return channel.key !== null; });
}

function precisionDiagnosticView(diagnostic) {
  if (!diagnostic || diagnostic.diagnosticOnly !== true) return null;
  return {
    diagnosticOnly: true,
    floor: finiteOrNull(diagnostic.floor),
    totalPrecision: finiteOrNull(diagnostic.totalPrecision),
    channels: channelView(diagnostic.channels)
  };
}

function build(est, precisionDiagnostic) {
  est = est && typeof est === 'object' ? est : {};
  var degraded = degradationView(est.degraded);
  var grounded = est.grounded === true;

  return {
    grounded: grounded,
    phaseMAP: Number.isInteger(est.phaseMAP) ? est.phaseMAP : null,
    confidence: finiteOrNull(est.confidence),
    stuck: finiteOrNull(est.stuck),
    belief: Array.isArray(est.belief)
      ? est.belief.map(function (x) { return Math.round(x * 1000) / 1000; })
      : [],
    reason: grounded ? null : (degraded && degraded.reason) || 'estimator abstained without a reason',
    degraded: degraded,
    channels: channelView(est.channels),
    precisionDiagnostic: grounded ? null : precisionDiagnosticView(precisionDiagnostic)
  };
}

module.exports = { build: build };
