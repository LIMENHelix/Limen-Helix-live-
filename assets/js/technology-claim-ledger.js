/**
 * technology-claim-ledger.js — Technology Domain Claim Ledger (Local Only)
 * Namespace: window.LIMENTechnology.economy.claims
 */
(function () {
  'use strict';

  window.LIMENTechnology = window.LIMENTechnology || {};
  window.LIMENTechnology.economy = window.LIMENTechnology.economy || {};

  var STORE_KEY = 'LIMEN_TECHNOLOGY_CLAIMS';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } }
  function saveAll(records) { try { localStorage.setItem(STORE_KEY, JSON.stringify(records)); } catch (e) {} }

  function createClaimRecord(opportunity) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) if (all[i].opportunityId === opportunity.id) return all[i];

    var comp = window.LIMENTechnology.economy.compensation;
    var type = (opportunity.type || 'grant').toLowerCase();
    var estimatedValue = opportunity.estimatedValue || _defaultValue(type);
    var est = comp ? comp.estimate(estimatedValue, type) : { operatorBasePayout: 0, platformRetained: estimatedValue };

    var record = {
      id: 'claim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      opportunityId: opportunity.id,
      title: opportunity.title || '',
      type: type,
      claimedAt: Date.now(),
      status: 'claimed',
      estimatedValue: estimatedValue,
      estimatedOperatorPayout: est.operatorBasePayout,
      estimatedPlatformValue: est.platformRetained,
      operatorAccepted: true,
      notes: '',
      outcomeValue: null,
      payoutEstimateFinal: null
    };

    all.push(record);
    saveAll(all);
    try { window.dispatchEvent(new CustomEvent('limen:technology-claim-update')); } catch (e) {}
    return record;
  }

  function getAllClaims() { return loadAll(); }
  function getClaimById(id) { var all = loadAll(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function getClaimByOppId(oppId) { var all = loadAll(); for (var i = 0; i < all.length; i++) if (all[i].opportunityId === oppId) return all[i]; return null; }

  function updateClaimStatus(id, status) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].status = status;
        all[i].lastUpdated = Date.now();
        saveAll(all);
        try { window.dispatchEvent(new CustomEvent('limen:technology-claim-update')); } catch (e) {}
        return all[i];
      }
    }
    return null;
  }

  function updateClaimOutcome(id, outcomeValue, notes) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].outcomeValue = outcomeValue;
        all[i].notes = notes || '';
        all[i].lastUpdated = Date.now();
        all[i].payoutEstimateFinal = computeFinalPayoutInternal(all[i]);
        saveAll(all);
        try { window.dispatchEvent(new CustomEvent('limen:technology-claim-update')); } catch (e) {}
        return all[i];
      }
    }
    return null;
  }

  function computeFinalPayoutInternal(record) {
    if (!record) return 0;
    var comp = window.LIMENTechnology.economy.compensation;
    if (record.outcomeValue != null && record.outcomeValue > 0 && comp) {
      var model = comp.getForType(record.type);
      return Math.round(record.outcomeValue * model.operatorSuccessPct);
    }
    return record.estimatedOperatorPayout || 0;
  }
  function computeFinalPayout(id) { return computeFinalPayoutInternal(getClaimById(id)); }

  function getSummary() {
    var all = loadAll();
    var summary = { total: all.length, claimed: 0, in_review: 0, submitted: 0, approved: 0, rejected: 0, closed: 0, estimatedPayoutTotal: 0 };
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (summary[r.status] !== undefined) summary[r.status]++;
      summary.estimatedPayoutTotal += (r.payoutEstimateFinal != null ? r.payoutEstimateFinal : (r.estimatedOperatorPayout || 0));
    }
    return summary;
  }

  function _defaultValue(type) {
    var defaults = { grant: 75000, patent: 25000, loan: 100000, investment: 10000, invest: 10000, portal: 12000, curriculum: 30000, build: 40000 };
    return defaults[type] || 25000;
  }

  window.LIMENTechnology.economy.claims = {
    createClaimRecord: createClaimRecord,
    getAllClaims: getAllClaims,
    getClaimById: getClaimById,
    getClaimByOppId: getClaimByOppId,
    updateClaimStatus: updateClaimStatus,
    updateClaimOutcome: updateClaimOutcome,
    computeFinalPayout: computeFinalPayout,
    getSummary: getSummary,
    STORE_KEY: STORE_KEY
  };
  console.log('[TechnologyClaimLedger] Loaded');
})();
