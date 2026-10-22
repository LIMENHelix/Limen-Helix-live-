/**
 * investment-signal-authority.js — the read/surface gate for persisted
 * investment-engine signals.
 *
 * The established effective Thing One authority contract (the same predicate
 * run-investment-engine.js uses before writing) requires current
 * financialHealth.thing1Validation.status === 'validated' and available === true.
 * A persisted signal may be surfaced only when that holds AND the signal's
 * frozen evidence names a validated Thing One run. Missing, malformed or
 * unvalidated provenance withholds the signal; it is never treated as active.
 *
 * Other engines' signals are unrelated and pass through unchanged.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LIMENInvestmentSignalAuthority = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Verify the persisted provenance itself, not only status/available. Legacy
     objects missing the protected identity or canonical Thing Zero fields
     abstain. */
  function portalThing1Authorized(co) {
    var t1 = co && co.financialHealth && co.financialHealth.thing1Validation;
    return !!(t1
      && t1.status === 'validated'
      && t1.available === true
      && t1.effectiveStatus === 'validated'
      && t1.kernelId === 'limen_backtest.py'
      && t1.thing0Qualification === 'qualified'
      && t1.thing0PermitsThing1Use === true);
  }

  function signalFrozenValidated(signal) {
    var ev = signal && signal.evidence;
    if (!ev || typeof ev !== 'object') return false;
    var status = ev.thing1ValidationStatus || ev.validationStatus;
    return status === 'validated';
  }

  function isInvestmentSignal(signal) {
    return !!(signal && signal.engine === 'investment');
  }

  /* Returns active signals (what may be surfaced) and held signals with a
     non-actionable reason. Never mutates the portal or the signal. */
  function partitionOpportunitySignals(co) {
    var sigs = Array.isArray(co && co.opportunitySignals) ? co.opportunitySignals : [];
    var active = [];
    var withheld = [];
    var current = portalThing1Authorized(co);
    for (var i = 0; i < sigs.length; i++) {
      var s = sigs[i];
      if (!isInvestmentSignal(s)) {
        active.push(s);
      } else if (current && signalFrozenValidated(s)) {
        active.push(s);
      } else {
        withheld.push({
          signal: s,
          reason: current ? 'frozen_provenance_not_validated' : 'current_thing1_not_authorized'
        });
      }
    }
    return { active: active, withheld: withheld };
  }

  return {
    portalThing1Authorized: portalThing1Authorized,
    signalFrozenValidated: signalFrozenValidated,
    isInvestmentSignal: isInvestmentSignal,
    partitionOpportunitySignals: partitionOpportunitySignals
  };
});
