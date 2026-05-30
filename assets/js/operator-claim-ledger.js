/**
 * operator-claim-ledger.js — Global Claim Ledger (localStorage)
 *
 * Tracks all claimed opportunities across all domains.
 * Stores status, estimated values, outcomes, and payout calculations.
 *
 * Exposes: window.LIMENClaimLedger
 */
(function () {
  'use strict';

  var STORE_KEY = 'LIMEN_CLAIMS';

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveAll(claims) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(claims)); } catch (e) {}
  }

  function generateId() {
    return 'clm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  function createClaim(opp, domain, estimate) {
    var claims = loadAll();
    // Prevent duplicate
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].opportunityId === (opp.id || opp.title) && claims[i].domain === domain && claims[i].status !== 'closed') {
        return claims[i]; // Already claimed
      }
    }
    var pathType = (opp.path === 'GRANT-ELIGIBLE') ? 'grant' : (opp.path === 'PATENTABLE') ? 'patent' : (opp.path === 'INVESTABLE') ? 'investment' : 'grant';
    if (opp.paths && opp.paths.indexOf('BUSINESS') !== -1) pathType = 'business';

    var claim = {
      id: generateId(),
      opportunityId: opp.id || opp.title,
      title: (opp.title || '').replace(/_/g, ' '),
      domain: domain,
      type: pathType,
      path: opp.path,
      claimedAt: Date.now(),
      status: 'claimed',
      estimatedValue: estimate ? estimate.estimatedValue : 0,
      estimatedOperatorPayout: estimate ? estimate.operatorPayout : 0,
      estimatedPlatformValue: estimate ? estimate.platformRetained : 0,
      operatorAccepted: true,
      notes: '',
      outcomeValue: null,
      payoutFinal: null
    };
    claims.push(claim);
    saveAll(claims);
    return claim;
  }

  function getAllClaims() { return loadAll(); }

  function getClaimsByDomain(domain) {
    return loadAll().filter(function (c) { return c.domain === domain; });
  }

  function getClaimById(id) {
    var claims = loadAll();
    for (var i = 0; i < claims.length; i++) { if (claims[i].id === id) return claims[i]; }
    return null;
  }

  function isOpportunityClaimed(oppId, domain) {
    var claims = loadAll();
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].opportunityId === oppId && claims[i].domain === domain && claims[i].status !== 'closed') return claims[i];
    }
    return null;
  }

  function updateStatus(id, status, notes) {
    var claims = loadAll();
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].id === id) {
        claims[i].status = status;
        if (notes) claims[i].notes = notes;
        claims[i].updatedAt = Date.now();
        saveAll(claims);
        return claims[i];
      }
    }
    return null;
  }

  function recordOutcome(id, outcomeValue, notes) {
    var claims = loadAll();
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].id === id) {
        claims[i].outcomeValue = outcomeValue;
        claims[i].status = 'closed';
        if (notes) claims[i].notes = notes;
        claims[i].closedAt = Date.now();
        // Compute final payout
        var comp = window.LIMENCompensation;
        if (comp && outcomeValue > 0) {
          var model = comp.getModel(claims[i].type);
          claims[i].payoutFinal = Math.round(outcomeValue * (model.operatorSuccessPct || 0.10));
        } else {
          claims[i].payoutFinal = 0;
        }
        saveAll(claims);
        return claims[i];
      }
    }
    return null;
  }

  function getStats(domain) {
    var claims = domain ? getClaimsByDomain(domain) : loadAll();
    var stats = { total: claims.length, claimed: 0, inReview: 0, submitted: 0, approved: 0, rejected: 0, closed: 0, totalEstimatedPayout: 0, totalActualPayout: 0 };
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (c.status === 'claimed') stats.claimed++;
      else if (c.status === 'in_review') stats.inReview++;
      else if (c.status === 'submitted') stats.submitted++;
      else if (c.status === 'approved') stats.approved++;
      else if (c.status === 'rejected') stats.rejected++;
      else if (c.status === 'closed') stats.closed++;
      stats.totalEstimatedPayout += (c.estimatedOperatorPayout || 0);
      stats.totalActualPayout += (c.payoutFinal || 0);
    }
    return stats;
  }

  window.LIMENClaimLedger = {
    createClaim: createClaim,
    getAllClaims: getAllClaims,
    getClaimsByDomain: getClaimsByDomain,
    getClaimById: getClaimById,
    isOpportunityClaimed: isOpportunityClaimed,
    updateStatus: updateStatus,
    recordOutcome: recordOutcome,
    getStats: getStats
  };

  console.log('[ClaimLedger] Global claim ledger loaded — ' + loadAll().length + ' existing claims');
})();
