/**
 * execution-policy-config.js — Global Policy Configuration
 *
 * Single source of truth for compensation, gates, regulations,
 * disputes, and workflow rules. Consumed by all execution surfaces.
 *
 * Exposes: window.LIMENExecution.policy
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};

  window.LIMENExecution.policy = {
    version: '1.0.0',
    effectiveDate: '2026-04-01',

    compensation: {
      default: { operatorBasePct: 0.10, operatorSuccessPct: 0.15, platformRetainedPct: 0.85, lossChargebackPct: 0.00, requiresQualifiedOutcome: true },
      byType: {
        grant:      { label: 'Grant Execution', operatorBasePct: 0.10, operatorSuccessPct: 0.15, description: 'Percentage of grant award upon disbursement' },
        patent:     { label: 'Patent Execution', operatorBasePct: 0.08, operatorSuccessPct: 0.12, description: 'Percentage of licensing royalties collected' },
        loan:       { label: 'Loan Execution', operatorBasePct: 0.10, operatorSuccessPct: 0.15, description: 'Percentage of structuring fee upon funding' },
        investment: { label: 'Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10, description: 'Percentage of realized profit on closed positions' },
        business:   { label: 'Business Build', operatorBasePct: 0.20, operatorSuccessPct: 0.25, description: 'Percentage of net operating profit' },
        portal:     { label: 'Portal / SaaS Sale', operatorBasePct: 0.15, operatorSuccessPct: 0.20, description: 'Percentage of annual subscription revenue' }
      },
      notes: [
        'Compensation begins conservatively and can be increased later by policy revision',
        'Displayed values are policy estimates, not automatic transfers',
        'Final payout requires documented closeout and qualified outcome',
        'No guaranteed payout until auditor-approved outcome recorded'
      ]
    },

    gates: {
      gate1: { name: 'Opportunity Approval', description: 'Before operator acts', checks: ['Entity eligible per requirements', 'Deadline achievable', 'Opportunity classification correct', 'No conflict of interest'] },
      gate2: { name: 'Submission Review', description: 'Before filing or executing', checks: ['Documentation complete', 'Budget/financials verified', 'Compliance requirements met', 'Narrative matches requirements'] },
      gate3: { name: 'Post-Execution Compliance', description: 'After award or close', checks: ['Deliverables match approved scope', 'Reporting deadlines met', 'Funds used for approved purpose', 'Outcome accurately recorded'] }
    },

    regulations: {
      grant: { refs: ['2 CFR Part 200 (Uniform Guidance)', '2 CFR §200.403 (Allowable costs)', '2 CFR §200.501 (Single Audit >$750K)'], note: 'Operational reference only — not legal advice.' },
      patent: { refs: ['35 U.S.C. §111(b) (Provisional filing)', '35 U.S.C. §111(a) (Non-provisional)', '35 U.S.C. §103 (Non-obvious)'], note: 'Operational reference only — not legal advice.' },
      loan: { refs: ['15 U.S.C. §636 (SBA authority)', 'SBA SOP 50 10 (Lending criteria)', 'State lending regulations'], note: 'Operational reference only — not legal advice.' },
      investment: { refs: ['SEC Rule 10b-5 (Anti-fraud)', '15 U.S.C. §80b (Investment Advisers Act)'], note: 'LIMEN does not provide investment advice. All positions are operator-initiated. Operational reference only.' }
    },

    disputes: {
      process: ['Operator submits dispute with claim ID and documentation', 'Auditor reviews within 5 business days', 'If unresolved, escalates to management review', 'Final decision documented and binding'],
      grounds: ['Incorrect outcome classification', 'Payout calculation error', 'Unfair rejection without documented reason', 'Process violation by auditor']
    },

    workflow: {
      steps: ['Find opportunity', 'Review economics', 'Accept framework terms', 'Complete execution checklist', 'Submit for audit review', 'Execute approved action', 'Record progress', 'Record outcome', 'Close claim', 'Review payout estimate'],
      statuses: ['claimed', 'in_review', 'submitted', 'approved', 'rejected', 'closed']
    },

    misconduct: {
      rules: ['Fabricated outcomes result in immediate claim revocation', 'Duplicate claims on same opportunity are automatically rejected', 'Non-compliance with regulatory requirements may result in tier demotion', 'Abandonment without notice affects reliability score']
    },

    outcomeStandards: {
      success: 'Objective fully achieved with documented evidence',
      partial: 'Some progress made but full objective not achieved — NOT treated as failure',
      fail: 'Objective not achieved despite good-faith execution',
      abandoned: 'Operator withdrew before completion without valid cause'
    }
  };

  console.log('[PolicyConfig] Global execution policy v' + window.LIMENExecution.policy.version + ' loaded');
})();
