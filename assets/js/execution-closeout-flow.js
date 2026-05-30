/**
 * execution-closeout-flow.js — Global Claim Closeout Modal
 *
 * When a claim reaches closable state, operator records the outcome.
 * One final outcome per claim. Prevents duplicate closeouts.
 *
 * Exposes: window.LIMENExecution.closeout
 */
(function () {
  'use strict';

  window.LIMENExecution = window.LIMENExecution || {};

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function openCloseoutModal(claim, onComplete) {
    var overlay = document.createElement('div');
    overlay.className = 'lcf-overlay';

    var h = '<div class="lcf-modal">';
    h += '<div class="lcf-title">RECORD OUTCOME</div>';

    h += '<div class="lcf-section"><div class="lcf-section-title">CLAIM</div>';
    h += '<div class="lcf-row"><span>Title</span><b>' + esc(claim.title) + '</b></div>';
    h += '<div class="lcf-row"><span>Domain</span><b>' + esc((claim.domain || '').toUpperCase()) + '</b></div>';
    h += '<div class="lcf-row"><span>Type</span><b>' + esc(claim.type || claim.path || '') + '</b></div>';
    h += '<div class="lcf-row"><span>Est. value</span><b>$' + (claim.estimatedValue || 0).toLocaleString() + '</b></div>';
    h += '</div>';

    h += '<div class="lcf-section"><div class="lcf-section-title">OUTCOME</div>';
    h += '<div class="eep-field"><label class="eep-field-label">Result</label>';
    h += '<select id="eco-result" class="eep-select" style="width:100%">';
    h += '<option value="success">SUCCESS — objective achieved</option>';
    h += '<option value="partial" selected>PARTIAL — some progress, not fully achieved</option>';
    h += '<option value="fail">FAIL — objective not achieved</option>';
    h += '<option value="abandoned">ABANDONED — withdrew before completion</option>';
    h += '</select></div>';

    h += '<div class="eep-field"><label class="eep-field-label">Final value realized ($)</label>';
    h += '<input id="eco-value" class="eep-input" type="text" value="' + (claim.estimatedValue || 0) + '" style="width:100%"></div>';

    h += '<div class="eep-field"><label class="eep-field-label">Notes</label>';
    h += '<textarea id="eco-notes" class="eep-textarea" style="width:100%;min-height:50px" placeholder="What happened? What worked? What didn\'t?"></textarea></div>';
    h += '</div>';

    h += '<div class="lcf-btns">';
    h += '<button class="lcf-btn lcf-btn-confirm" id="eco-confirm">CONFIRM CLOSEOUT</button>';
    h += '<button class="lcf-btn lcf-btn-cancel" id="eco-cancel">CANCEL</button>';
    h += '</div>';
    h += '</div>';

    overlay.innerHTML = h;
    document.body.appendChild(overlay);

    document.getElementById('eco-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    document.getElementById('eco-confirm').addEventListener('click', function () {
      var result = document.getElementById('eco-result').value;
      var value = parseFloat(document.getElementById('eco-value').value) || 0;
      var notes = document.getElementById('eco-notes').value;

      // Record outcome
      var outcomes = window.LIMENExecution.outcomes;
      if (outcomes) {
        var cycleTime = outcomes.computeCycleTimeDays(claim);
        outcomes.recordOutcome(claim.id, {
          opportunityId: claim.opportunityId,
          domain: claim.domain,
          type: claim.type,
          title: claim.title,
          result: result,
          outcomeValue: value,
          expectedValue: claim.estimatedValue || 0,
          notes: notes,
          operatorConfidenceAtClaim: claim.estimatedOperatorPayout || 0,
          finalPayoutEstimate: value > 0 ? Math.round(value * 0.15) : 0,
          cycleTimeDays: cycleTime
        });
      }

      // Update claim ledger
      var ledger = window.LIMENClaimLedger;
      if (ledger) {
        ledger.recordOutcome(claim.id, value, notes);
      }

      overlay.remove();
      if (typeof onComplete === 'function') onComplete(result, value);
    });
  }

  window.LIMENExecution.closeout = {
    openCloseoutModal: openCloseoutModal
  };

  console.log('[ExecutionCloseout] Global closeout flow loaded');
})();
