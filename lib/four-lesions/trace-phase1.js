/**
 * lib/four-lesions/trace-phase1.js — Phase 0 Minimal audit buffer.
 *
 * The four-lesion build's Phase 0: the MINIMUM measurement infrastructure that
 * lets Phase 1 (the finance motor loop) prove it actually COMPUTED rather than
 * merely got labeled. Three event types only, nothing more (the spec's
 * over-built FractalMonitor / Checkpoint system is explicitly deferred).
 *
 * Each event carries a validator() that runs IMMEDIATELY on log, so a cosmetic
 * event (named but not computed) is caught the moment it is emitted, not later.
 * didCompute(type) is true only if at least one event of that type exists AND
 * every one of them validated. That is the "computed vs named" distinction the
 * whole build rests on.
 *
 * Pure: no network, no Date dependence beyond a caller-supplied timestamp. Node
 * module (the Phase 1 POC harness requires it); no browser path needed.
 */

'use strict';

var PHASE1_EVENT_TYPES = ['action-selected', 'action-executed', 'weight-updated'];

function TraceBufferPhase1(domain) {
  if (!(this instanceof TraceBufferPhase1)) return new TraceBufferPhase1(domain);
  this.domain = String(domain || 'unknown');
  this.entries = [];
  this.validatorFailures = [];
}

// event: { type, value, validator:fn, validatorReason?, precedent?, timestamp? }
// Returns the boolean validation result (also stored on the entry).
TraceBufferPhase1.prototype.log = function (event) {
  if (!event || PHASE1_EVENT_TYPES.indexOf(event.type) === -1) {
    throw new Error('Invalid Phase 1 event type: ' + (event && event.type) +
      ' (must be one of ' + PHASE1_EVENT_TYPES.join(', ') + ')');
  }
  if (typeof event.validator !== 'function') {
    throw new Error('Phase 1 event missing validator(): ' + event.type);
  }
  // Run the validator NOW so a non-computed event is caught immediately.
  var isValid = false;
  try { isValid = event.validator() === true; }
  catch (e) { isValid = false; event.validatorReason = 'validator threw: ' + e.message; }

  if (!isValid) {
    this.validatorFailures.push({
      type: event.type,
      timestamp: event.timestamp || 0,
      reason: event.validatorReason || 'unknown'
    });
  }

  this.entries.push({
    type: event.type,
    domain: this.domain,
    value: event.value,
    timestamp: event.timestamp || 0,
    precedent: event.precedent || null,
    validated: isValid
  });
  return isValid;
};

// Did this mechanism actually compute? (present AND every occurrence validated)
TraceBufferPhase1.prototype.didCompute = function (type) {
  var events = this.entries.filter(function (e) { return e.type === type; });
  if (events.length === 0) return false;
  return events.every(function (e) { return e.validated === true; });
};

TraceBufferPhase1.prototype.getEvents = function (type) {
  return this.entries.filter(function (e) { return e.type === type; });
};

TraceBufferPhase1.prototype.getFailures = function () {
  return this.validatorFailures.slice();
};

// Audit report: which of the three mechanisms computed, and did all of them.
TraceBufferPhase1.prototype.audit = function () {
  var actionSelected = this.didCompute('action-selected');
  var actionExecuted = this.didCompute('action-executed');
  var weightUpdated = this.didCompute('weight-updated');
  return {
    domain: this.domain,
    actionSelected: actionSelected,
    actionExecuted: actionExecuted,
    weightUpdated: weightUpdated,
    allPass: actionSelected && actionExecuted && weightUpdated,
    counts: {
      actionSelected: this.getEvents('action-selected').length,
      actionExecuted: this.getEvents('action-executed').length,
      weightUpdated: this.getEvents('weight-updated').length
    },
    totalEvents: this.entries.length,
    failures: this.getFailures()
  };
};

module.exports = { TraceBufferPhase1: TraceBufferPhase1, PHASE1_EVENT_TYPES: PHASE1_EVENT_TYPES };
