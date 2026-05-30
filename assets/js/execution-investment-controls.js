/**
 * execution-investment-controls.js — Investment Risk Control Layer
 *
 * Wraps investment actions with safety controls.
 * Does NOT modify Alpaca endpoints or trading logic.
 * UI-only pre-trade validation.
 *
 * Exposes: window.LIMENExecution.phase4.investControls
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  function validatePreTrade(tradeData) {
    var errors = [];
    if (!tradeData.kernelPhase) errors.push('Kernel phase verdict missing');
    if (!tradeData.stopLoss) errors.push('Stop-loss not set — required before entry');
    if (!tradeData.thesis) errors.push('Position thesis not documented');
    if (!tradeData.riskAccepted) errors.push('Risk acknowledgement not confirmed');
    return { valid: errors.length === 0, errors: errors };
  }

  function createTradeRecord(tradeData) {
    return {
      symbol: tradeData.symbol,
      side: tradeData.side,
      qty: tradeData.qty,
      kernelPhase: tradeData.kernelPhase || '',
      stopLoss: tradeData.stopLoss || '',
      thesis: tradeData.thesis || '',
      exitTrigger: tradeData.exitTrigger || '',
      riskAccepted: tradeData.riskAccepted || false,
      timestamp: Date.now()
    };
  }

  function renderRiskBlock() {
    return '<div style="padding:6px 8px;border:1px solid rgba(232,84,84,0.12);border-radius:3px;background:rgba(232,84,84,0.03);margin:6px 0;font-size:0.30rem">' +
      '<div style="color:rgba(232,84,84,0.6);letter-spacing:1.5px;font-size:0.24rem;margin-bottom:3px">RISK CONTROL</div>' +
      '<div style="color:#908878">Stop-loss required before entry. Thesis must be documented. Risk acknowledgement required. SEC Rule 10b-5 compliance assumed.</div>' +
      '<div style="color:#706860;font-size:0.26rem;margin-top:2px">LIMEN does not provide investment advice. All positions are operator-initiated.</div>' +
      '</div>';
  }

  window.LIMENExecution.phase4.investControls = {
    validatePreTrade: validatePreTrade,
    createTradeRecord: createTradeRecord,
    renderRiskBlock: renderRiskBlock
  };
})();
