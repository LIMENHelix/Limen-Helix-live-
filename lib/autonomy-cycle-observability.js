'use strict';

/** Secret-safe reason telemetry for scheduled autonomy stages. */

var SCHEMA = 'autonomy-cycle-summary/1.0';
var TOKEN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$/;

function token(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback || null;
  return TOKEN.test(value) ? value : 'noncanonical-value-redacted';
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 1000) / 1000
    : null;
}

function row(value) {
  value = value && typeof value === 'object' ? value : {};
  return {
    domain: token(value.productDomain || value.domain, 'unknown'),
    stage: token(value.stage, null),
    status: token(value.status, 'UNKNOWN'),
    reason: token(value.reason, null),
    selectedProgram: token(value.selectedProgram, null),
    priority: finite(value.priority)
  };
}

function summarize(cycle, result) {
  var rows = Array.isArray(result && result.rows) ? result.rows.map(row) : [];
  var statuses = {}, reasons = {};
  rows.forEach(function (entry) {
    statuses[entry.status] = (statuses[entry.status] || 0) + 1;
    if (entry.reason) reasons[entry.reason] = (reasons[entry.reason] || 0) + 1;
  });
  return {
    schemaVersion: SCHEMA,
    cycle: token(cycle, 'unknown'),
    evaluatedAt: Number(result && result.evaluatedAt) || null,
    ok: !!(result && result.ok),
    statuses: statuses,
    reasons: reasons,
    rows: rows,
    secretBearingFieldsIncluded: false
  };
}

function emit(cycle, result, logger) {
  var summary = summarize(cycle, result);
  var output = logger || console.info;
  output('[autonomy-cycle] ' + JSON.stringify(summary));
  return summary;
}

module.exports = { SCHEMA: SCHEMA, token: token, row: row, summarize: summarize, emit: emit };
