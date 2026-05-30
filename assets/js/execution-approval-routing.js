/**
 * execution-approval-routing.js — Approval Routing + Decision Queue
 * Standardizes review routing per execution path.
 * Exposes: window.LIMENExecution.phase6.approvals
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  var ROUTES={grant:'auditor_gate',patent:'prior_art_gate',loan:'financial_gate',investment:'risk_control_gate',business:'launch_readiness_gate',portal:'qualification_gate'};
  function getRoute(claim){return ROUTES[claim.type]||'auditor_gate'}
  function isReady(claim){return claim.status==='submitted'||claim.status==='in_review'}
  function getQueue(){var l=window.LIMENClaimLedger;if(!l)return[];return l.getAllClaims().filter(function(c){return c.status==='submitted'||c.status==='in_review'}).map(function(c){return{claim:c,route:getRoute(c),state:c.status==='submitted'?'awaiting_decision':'ready_for_review'}})}
  function getBlockers(){var l=window.LIMENClaimLedger;if(!l)return[];return l.getAllClaims().filter(function(c){return c.status==='claimed'}).map(function(c){return{claim:c,blocker:'Not yet submitted for review'}})}
  function getAwaiting(){return getQueue().filter(function(q){return q.state==='awaiting_decision'})}
  function getRejected(){var l=window.LIMENClaimLedger;if(!l)return[];return l.getAllClaims().filter(function(c){return c.status==='rejected'})}
  window.LIMENExecution.phase6.approvals={getApprovalQueue:getQueue,getApprovalRouteForClaim:getRoute,getApprovalBlockers:getBlockers,isClaimReadyForApproval:isReady,getClaimsAwaitingDecision:getAwaiting,getRejectedClaimsNeedingAction:getRejected};
})();
