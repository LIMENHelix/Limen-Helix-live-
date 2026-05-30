/**
 * execution-manager.js — Client-side execution state manager
 *
 * Reads/writes execution state via /api/limen-execution.
 * Provides methods for opportunity claiming, execution record creation,
 * pipeline aggregation, and outcome tracking.
 *
 * Exposes: window.LIMENExecution
 */
(function () {
  'use strict';

  var _state = null;
  var _domain = 'energy';
  var _loading = false;

  // ══════════════════════════════════════════════════════════════════════
  // FETCH STATE
  // ══════════════════════════════════════════════════════════════════════

  function loadState(domain) {
    _domain = domain || _domain;
    _loading = true;
    return fetch('/api/limen-execution?domain=' + _domain)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _state = data.ok ? data.state : { opportunities: {}, executions: [], outcomes: [] };
        _loading = false;
        return _state;
      })
      .catch(function () { _loading = false; return _state; });
  }

  function _post(action, data) {
    return fetch('/api/limen-execution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: _domain, action: action, data: data })
    }).then(function (r) { return r.json(); }).catch(function (e) {
      console.error('[Execution] POST failed:', action, e.message);
      return { ok: false, error: e.message };
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // OPPORTUNITY OWNERSHIP
  // ══════════════════════════════════════════════════════════════════════

  function claimOpportunity(oppId) {
    return _post('claim_opportunity', { opportunity_id: oppId, claimed_by: 'LOCAL_USER' }).then(function (res) {
      // Log to change log
      var CL = window.LIMENChangeLog;
      if (CL) CL.append(_domain, CL.TYPES.OPPORTUNITY_CHANGE, CL.SEVERITIES.MEDIUM, 'Opportunity claimed', oppId, { opportunity_id: oppId });
      return loadState(); // refresh
    });
  }

  function updateOpportunity(oppId, status, lastAction) {
    return _post('update_opportunity', { opportunity_id: oppId, status: status, last_action: lastAction }).then(function () {
      return loadState();
    });
  }

  function getOpportunityState(oppId) {
    if (!_state || !_state.opportunities) return null;
    return _state.opportunities[oppId] || null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXECUTION RECORDS
  // ══════════════════════════════════════════════════════════════════════

  function createExecution(oppId, actionType) {
    return _post('create_execution', { opportunity_id: oppId, action_type: actionType }).then(function (res) {
      var CL = window.LIMENChangeLog;
      if (CL) CL.append(_domain, CL.TYPES.EXECUTION_CHANGE, CL.SEVERITIES.MEDIUM, actionType + ' generated', 'For opportunity: ' + oppId, { opportunity_id: oppId, action_type: actionType });
      return loadState().then(function () { return res; });
    });
  }

  function updateExecution(execId, status) {
    return _post('update_execution', { execution_id: execId, status: status }).then(function () {
      return loadState();
    });
  }

  function getExecutionsForOpportunity(oppId) {
    if (!_state || !_state.executions) return [];
    return _state.executions.filter(function (e) { return e.opportunity_id === oppId; });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PIPELINE AGGREGATION
  // ══════════════════════════════════════════════════════════════════════

  function getPipeline() {
    if (!_state || !_state.executions) return {};
    var pipeline = {};
    for (var i = 0; i < _state.executions.length; i++) {
      var e = _state.executions[i];
      var type = e.action_type || 'OTHER';
      if (!pipeline[type]) pipeline[type] = { generated: 0, in_progress: 0, submitted: 0, completed: 0 };
      var status = (e.status || 'GENERATED').toLowerCase().replace(/ /g, '_');
      if (pipeline[type][status] !== undefined) pipeline[type][status]++;
      else pipeline[type].generated++;
    }
    return pipeline;
  }

  // ══════════════════════════════════════════════════════════════════════
  // OUTCOMES
  // ══════════════════════════════════════════════════════════════════════

  function createOutcome(oppId, execId, type, value, description) {
    return _post('create_outcome', { opportunity_id: oppId, execution_id: execId, type: type, value: value, description: description }).then(function () {
      var CL = window.LIMENChangeLog;
      if (CL) CL.append(_domain, CL.TYPES.OUTCOME_CHANGE, CL.SEVERITIES.HIGH, type + ': ' + value, description || '', { opportunity_id: oppId, value: value, type: type });
      return loadState();
    });
  }

  function getOutcomes() {
    if (!_state || !_state.outcomes) return [];
    return _state.outcomes;
  }

  function getOutcomeTotals() {
    var outcomes = getOutcomes();
    var totals = { FUNDING: 0, DEAL: 0, REVENUE: 0, SAVINGS: 0 };
    for (var i = 0; i < outcomes.length; i++) {
      var type = outcomes[i].type || 'FUNDING';
      totals[type] = (totals[type] || 0) + (outcomes[i].value || 0);
    }
    return totals;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ══════════════════════════════════════════════════════════════════════

  var STATUS_COLORS = {
    UNCLAIMED: 'rgba(200,195,184,0.4)',
    CLAIMED: '#FF9800',
    IN_PROGRESS: '#4a8fd4',
    SUBMITTED: '#8B5CF6',
    COMPLETED: '#5ab5a0',
    REJECTED: '#e85454',
    GENERATED: '#C9A94E'
  };

  function renderStatusBadge(status) {
    var color = STATUS_COLORS[status] || '#888';
    return '<span style="font-size:0.24rem;letter-spacing:1.5px;padding:2px 6px;border-radius:2px;border:1px solid ' + color + '44;color:' + color + '">' + (status || 'UNCLAIMED').replace(/_/g, ' ') + '</span>';
  }

  function renderOwnership(oppId) {
    var opp = getOpportunityState(oppId);
    if (!opp || !opp.claimed_by) return '<span style="font-size:0.26rem;color:rgba(200,195,184,0.3)">unclaimed</span>';
    var time = opp.claimed_at ? new Date(opp.claimed_at).toLocaleDateString() : '';
    return '<span style="font-size:0.26rem;color:#FF9800">' + opp.claimed_by + '</span>' +
           (time ? ' <span style="font-size:0.22rem;color:rgba(200,195,184,0.3)">' + time + '</span>' : '');
  }

  function renderPipeline() {
    var pipeline = getPipeline();
    var types = Object.keys(pipeline);
    if (types.length === 0) return '<div style="font-size:0.32rem;color:rgba(200,195,184,0.25)">No execution records</div>';
    var h = '';
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var p = pipeline[t];
      h += '<div style="margin-bottom:6px">';
      h += '<div style="font-size:0.32rem;color:rgba(201,169,78,0.7);letter-spacing:1.5px">' + t + '</div>';
      var parts = [];
      if (p.generated) parts.push(p.generated + ' generated');
      if (p.in_progress) parts.push(p.in_progress + ' in progress');
      if (p.submitted) parts.push(p.submitted + ' submitted');
      if (p.completed) parts.push(p.completed + ' completed');
      h += '<div style="font-size:0.3rem;color:rgba(220,215,200,0.7);padding-left:8px">' + parts.join(' · ') + '</div>';
      h += '</div>';
    }
    return h;
  }

  function renderOutcomeSummary() {
    var totals = getOutcomeTotals();
    var outcomes = getOutcomes();
    var h = '';
    var metrics = [
      { key: 'FUNDING', label: 'Funding Secured', prefix: '$' },
      { key: 'DEAL', label: 'Deals Closed', prefix: '' },
      { key: 'REVENUE', label: 'Revenue Generated', prefix: '$' },
      { key: 'SAVINGS', label: 'Cost Savings', prefix: '$' }
    ];
    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      var v = totals[m.key] || 0;
      h += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.02)">';
      h += '<span style="font-size:0.32rem;color:rgba(220,215,200,0.5)">' + m.label + '</span>';
      h += '<span style="font-size:0.38rem;font-weight:500;color:' + (v > 0 ? '#5ab5a0' : 'rgba(200,195,184,0.3)') + '">' + m.prefix + v.toLocaleString() + '</span>';
      h += '</div>';
    }
    // Show recent outcomes with source
    for (var j = outcomes.length - 1; j >= Math.max(0, outcomes.length - 3); j--) {
      var o = outcomes[j];
      h += '<div style="font-size:0.26rem;color:rgba(200,195,184,0.35);margin-top:3px">' + o.type + ': ' + (o.description || o.opportunity_id || '') + '</div>';
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENExecution = {
    loadState: loadState,
    claimOpportunity: claimOpportunity,
    updateOpportunity: updateOpportunity,
    getOpportunityState: getOpportunityState,
    createExecution: createExecution,
    updateExecution: updateExecution,
    getExecutionsForOpportunity: getExecutionsForOpportunity,
    getPipeline: getPipeline,
    createOutcome: createOutcome,
    getOutcomes: getOutcomes,
    getOutcomeTotals: getOutcomeTotals,
    renderStatusBadge: renderStatusBadge,
    renderOwnership: renderOwnership,
    renderPipeline: renderPipeline,
    renderOutcomeSummary: renderOutcomeSummary,
    getState: function () { return _state; },
    STATUS_COLORS: STATUS_COLORS
  };

})();
