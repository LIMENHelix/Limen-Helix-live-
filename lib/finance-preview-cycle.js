'use strict';

/** Compose source readiness with the strict Finance manager runner. */

var Readiness = require('./finance-preview-readiness.js');
var Universe = require('./finance-candidate-universe.js');
var Runner = require('./finance-manager-runner.js');

var SCHEMA = 'finance-preview-cycle/1.0';

async function run(input, options) {
  input = input || {};
  options = options || {};
  var readiness = Readiness.build(input);
  var base = {
    schemaVersion: SCHEMA,
    status: 'ABSTAINED',
    readiness: readiness,
    providerCalled: false,
    brokerTouched: false,
    candidate: null,
    manager: null
  };
  if (readiness.status !== 'READY_FOR_MANAGER_REVIEW') {
    base.reason = 'finance_preview_inputs_not_ready';
    return base;
  }
  if (typeof options.provider !== 'function') {
    base.reason = 'preview_provider_not_supplied';
    return base;
  }
  var selected = await Runner.run({ candidateUniverse: readiness.universe }, { provider: options.provider });
  base.manager = selected;
  base.providerCalled = selected.providerCalled === true;
  if (!selected.ok) {
    base.reason = selected.reason || 'finance_manager_abstained';
    return base;
  }
  base.status = selected.candidate && selected.candidate.status || 'ABSTAINED';
  base.candidate = selected.candidate || null;
  base.selectedCompany = selected.selectedCompany || null;
  return base;
}

module.exports = { SCHEMA: SCHEMA, run: run, managerContext: Universe.managerContext };
