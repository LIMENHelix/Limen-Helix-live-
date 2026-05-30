/**
 * execution-approval-authority.js — Global Audit/Approval Control
 *
 * Standardizes approval workflow state for all claims.
 * Simulates operator/auditor/approver roles through workflow state.
 *
 * Exposes: window.LIMENExecution.phase4.approval
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  var AUDIT_CHECKLIST = {
    grant: ['Entity eligible per NOFO', 'SAM.gov registration current', 'Budget allowable under 2 CFR §200.400-475', 'Narrative matches NOFO requirements', 'No prohibited costs', 'Conflict of interest disclosed'],
    patent: ['Prior art search completed', 'Gap confirmed — not already claimed', 'Solution within domain diagnosis', 'Provisional filed with USPTO', 'Attorney engaged', 'Priority date documented'],
    loan: ['Loan type matches domain need', 'Entity creditworthy/eligible', 'Use of proceeds aligns with program', 'Financials accurate and complete', 'Collateral identified', 'No prohibited fund uses'],
    investment: ['Kernel phase confirmed', 'Domain diagnosis supports thesis', 'Position size within risk parameters', 'No insider information (SEC 10b-5)', 'Stop-loss set before entry', 'Trade logged with thesis'],
    business: ['Entity formation complete', 'Funding secured or in progress', 'Operating model documented', 'Compliance requirements identified', 'First 90-day plan exists', 'Reviewer approved launch readiness'],
    portal: ['Portal product matches domain', 'Pricing within approved tiers', 'Customer eligible', 'Helix Report data kernel-validated', 'Revenue recorded correctly']
  };

  function getChecklistForType(type) { return AUDIT_CHECKLIST[type] || AUDIT_CHECKLIST.grant; }

  function canApprove(claim) {
    return claim.status === 'in_review' || claim.status === 'submitted';
  }

  function approveClaim(claimId, approverNotes) {
    var ledger = window.LIMENClaimLedger;
    if (!ledger) return null;
    var claim = ledger.getClaimById(claimId);
    if (!claim || !canApprove(claim)) return null;
    claim.auditStatus = 'approved';
    claim.approverDecision = 'approved';
    claim.approverNotes = approverNotes || '';
    claim.approvedAt = Date.now();
    ledger.updateStatus(claimId, 'approved', approverNotes);
    return claim;
  }

  function rejectClaim(claimId, reason) {
    var ledger = window.LIMENClaimLedger;
    if (!ledger) return null;
    var claim = ledger.getClaimById(claimId);
    if (!claim || !canApprove(claim)) return null;
    if (!reason) return null; // Rejection requires reason
    claim.auditStatus = 'rejected';
    claim.approverDecision = 'rejected';
    claim.approverNotes = reason;
    claim.rejectedAt = Date.now();
    ledger.updateStatus(claimId, 'rejected', reason);
    return claim;
  }

  window.LIMENExecution.phase4.approval = {
    getChecklistForType: getChecklistForType,
    canApprove: canApprove,
    approveClaim: approveClaim,
    rejectClaim: rejectClaim,
    AUDIT_CHECKLIST: AUDIT_CHECKLIST
  };
})();
