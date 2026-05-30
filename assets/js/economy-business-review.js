/**
 * economy-business-review.js — Economy Business Assignment Review Surface
 *
 * ECONOMY DOMAIN ONLY. Renders a review panel for proposed business mappings.
 * Requires economy-node-business-engine.js to be loaded first.
 *
 * Provides APPROVE / DENY / HOLD / RELEASE buttons per proposal.
 * Only APPROVED mappings become active in the Economy operator surface.
 *
 * Integrates into the Operator view as an additional section.
 * Self-gates: only runs when ?domain=economy is in the URL.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'economy') return;

  var PANEL_ID = 'eos-economy-review';
  var COLLAPSE_KEY = 'limen_economy_collapse_state';
  var _stylesInjected = false;

  function _isCollapsed(sectionId) {
    try { var st = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); return st[sectionId] === true; } catch (e) { return false; }
  }
  function _setCollapsed(sectionId, val) {
    try { var st = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); st[sectionId] = val; sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + PANEL_ID + '{font-family:"IBM Plex Mono",monospace;padding:16px 24px}',
      '.ebr-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:8px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.ebr-stats{display:flex;gap:16px;margin-bottom:12px;font-size:0.36rem;flex-wrap:wrap}',
      '.ebr-stat{color:#a09888}',
      '.ebr-stat b{color:#e8e3d9}',
      '.ebr-filter-bar{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}',
      '.ebr-filter{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:#a09888;cursor:pointer;transition:all 0.15s}',
      '.ebr-filter:hover{border-color:rgba(201,169,78,0.3);color:#d0c8b8}',
      '.ebr-filter.active{border-color:rgba(201,169,78,0.4);color:#C9A94E;background:rgba(201,169,78,0.06)}',
      '.ebr-section{margin-bottom:16px}',
      '.ebr-section-title{font-size:0.3rem;letter-spacing:1.5px;color:rgba(201,169,78,0.75);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(201,169,78,0.08);font-weight:600}',
      '.ebr-card{padding:0;border:1px solid rgba(201,169,78,0.06);border-radius:3px;margin-bottom:6px;background:rgba(8,10,18,0.7);transition:border-color 0.2s,border-left-color 0.2s}',
      '.ebr-card:hover{border-color:rgba(201,169,78,0.15)}',
      '.ebr-card.approved{border-left:3px solid #5ab5a0}',
      '.ebr-card.denied{border-left:3px solid #e85454;opacity:0.5}',
      '.ebr-card.needs-review{border-left:3px solid #C9A94E}',
      '.ebr-card.is-expanded:not(.approved):not(.denied):not(.needs-review){border-left:3px solid rgba(201,169,78,0.35)}',
      '.ebr-card-summary{padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;user-select:none;transition:background 0.15s}',
      '.ebr-card-summary:hover{background:rgba(201,169,78,0.03)}',
      '.ebr-card-summary-left{flex:1;min-width:0}',
      '.ebr-card-chevron{font-size:0.32rem;color:rgba(201,169,78,0.35);flex-shrink:0;transition:transform 0.25s ease}',
      '.ebr-card.is-expanded .ebr-card-chevron{transform:rotate(90deg);color:rgba(201,169,78,0.55)}',
      '.ebr-card-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease,padding 0.25s ease;padding:0 12px}',
      '.ebr-card.is-expanded .ebr-card-body{max-height:800px;opacity:1;padding:0 12px 12px 12px}',
      '.ebr-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px}',
      '.ebr-card-type{font-size:0.4rem;color:#f0ece2;flex:1}',
      '.ebr-card-node{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7)}',
      '.ebr-card-conf{font-size:0.28rem;color:#a09888}',
      '.ebr-card-reason{font-size:0.34rem;color:#c0b8a5;line-height:1.5;margin-bottom:8px}',
      '.ebr-card-reasoning{font-size:0.32rem;color:#b0a898;line-height:1.6;margin-bottom:8px;border-left:2px solid rgba(201,169,78,0.12);padding-left:10px}',
      '.ebr-card-reasoning b{color:#d0c8b8}',
      '.ebr-card-existing{font-size:0.28rem;color:#908878;margin-bottom:8px}',
      '.ebr-card-actions{display:flex;gap:4px;align-items:center}',
      '.ebr-btn{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:3px 8px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid}',
      '.ebr-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.04)}',
      '.ebr-btn-approve:hover{background:rgba(90,181,160,0.12)}',
      '.ebr-btn-deny{color:#e85454;border-color:rgba(232,84,84,0.3);background:rgba(232,84,84,0.04)}',
      '.ebr-btn-deny:hover{background:rgba(232,84,84,0.12)}',
      '.ebr-btn-hold{color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04)}',
      '.ebr-btn-hold:hover{background:rgba(201,169,78,0.12)}',
      '.ebr-btn-release{color:#807868;border-color:rgba(128,120,104,0.3);background:rgba(128,120,104,0.04)}',
      '.ebr-btn-release:hover{background:rgba(128,120,104,0.12);color:#b0a898}',
      '.ebr-badge{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px;margin-left:6px}',
      '.ebr-badge-proposed{color:#C9A94E;border:1px solid rgba(201,169,78,0.2);background:rgba(201,169,78,0.06)}',
      '.ebr-badge-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.06)}',
      '.ebr-badge-denied{color:#e85454;border:1px solid rgba(232,84,84,0.2);background:rgba(232,84,84,0.06)}',
      '.ebr-badge-review{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2);background:rgba(74,143,212,0.06)}',
      '.ebr-badge-mapped{color:#5ab5a0;border:1px solid rgba(90,181,160,0.15);background:rgba(90,181,160,0.04)}',
      '.ebr-badge-missing{color:#C9A94E;border:1px solid rgba(201,169,78,0.15);background:rgba(201,169,78,0.04)}',
      '.ebr-badge-spec{color:#a87adb;border:1px solid rgba(168,122,219,0.15);background:rgba(168,122,219,0.04)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var _currentFilter = 'all';
  var _expandedCards = {};
  var _delegationWired = false;

  function statusBadge(approval) {
    if (!approval) return '<span class="ebr-badge ebr-badge-proposed">PROPOSED</span>';
    var cls = { 'PROPOSED': 'ebr-badge-proposed', 'APPROVED': 'ebr-badge-approved', 'DENIED': 'ebr-badge-denied', 'NEEDS_REVIEW': 'ebr-badge-review' };
    return '<span class="ebr-badge ' + (cls[approval.status] || '') + '">' + (approval.status || 'PROPOSED') + '</span>';
  }

  function bucketBadge(bucket) {
    var cls = { 'MAPPED': 'ebr-badge-mapped', 'MISSING': 'ebr-badge-missing', 'SPECULATIVE': 'ebr-badge-spec' };
    return '<span class="ebr-badge ' + (cls[bucket] || '') + '">' + bucket + '</span>';
  }

  function renderCard(entry) {
    var approvalClass = entry.approval ? entry.approval.status.toLowerCase().replace('_', '-') : 'proposed';
    var cardKey = (entry.nodeId || '') + '::' + (entry.businessType || '');
    var expanded = _expandedCards[cardKey] ? ' is-expanded' : '';
    var h = '<div class="ebr-card ' + approvalClass + expanded + '" data-card-key="' + esc(cardKey) + '">';

    h += '<div class="ebr-card-summary">';
    h += '<div class="ebr-card-summary-left">';
    h += '<div class="ebr-card-header">';
    h += '<div class="ebr-card-type">' + esc(entry.businessType) + '</div>';
    h += '<div>';
    var _badgeSeen = {};
    var _bk = (entry.bucket || '').trim().toUpperCase();
    if (_bk && !_badgeSeen[_bk]) { _badgeSeen[_bk] = true; h += bucketBadge(entry.bucket); }
    var _as = entry.approval ? (entry.approval.status || 'PROPOSED').trim().toUpperCase() : 'PROPOSED';
    if (!_badgeSeen[_as]) { _badgeSeen[_as] = true; h += statusBadge(entry.approval); }
    if (entry.variantState) {
      var _vs = entry.variantState.trim().toUpperCase();
      if (!_badgeSeen[_vs]) {
        _badgeSeen[_vs] = true;
        var _vsColors = {PROPOSED:'color:#C9A94E;border:1px solid rgba(201,169,78,0.2)',MISSING:'color:#e85454;border:1px solid rgba(232,84,84,0.2)',ACTIVE:'color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)',MAPPED:'color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)',REJECTED:'color:#807868;border:1px solid rgba(128,120,104,0.2)'};
        h += ' <span class="ebr-badge" style="' + (_vsColors[entry.variantState] || '') + '">' + entry.variantState + '</span>';
      }
    }
    if (entry.nodeActive && !_badgeSeen['ACTIVE']) { _badgeSeen['ACTIVE'] = true; h += ' <span class="ebr-badge" style="color:#e85454;border:1px solid rgba(232,84,84,0.2)">ACTIVE</span>'; }
    h += '</div></div>';
    h += '<div class="ebr-card-node">' + esc(entry.nodeId) + ' (' + esc(entry.nodeFullName || entry.nodeId) + ') \u2014 ' + esc(entry.nodeLabel) + '</div>';
    h += '<div class="ebr-card-conf">Confidence: ' + Math.round(entry.confidence * 100) + '%</div>';
    h += '</div>';
    h += '<span class="ebr-card-chevron">\u25B6</span>';
    h += '</div>';

    h += '<div class="ebr-card-body">';
    if (entry.neuroTranslation) {
      h += '<div style="margin:8px 0;padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:3px;background:rgba(74,143,212,0.03)">';
      h += '<div style="font-size:0.26rem;letter-spacing:2px;color:rgba(74,143,212,0.5);margin-bottom:4px">IN NEUROLOGY / IN BUSINESS TRANSLATION</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin-bottom:4px"><b style="color:rgba(74,143,212,0.7)">In neurology:</b> ' + esc(entry.neuroTranslation.inNeurology) + '</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5"><b style="color:rgba(201,169,78,0.7)">In business (Economic systems):</b> ' + esc(entry.neuroTranslation.inBusiness) + '</div>';
      h += '</div>';
    }
    h += '<div class="ebr-card-reasoning">';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What this node does:</b> ' + esc(entry.plainFunction || entry.nodeFunction) + '</div>';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What dysfunction looks like:</b> ' + esc(entry.plainDysregulation || entry.dysregulation) + '</div>';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why this creates demand:</b> ' + esc(entry.reason) + '</div>';
    h += '</div>';

    if (entry.existingCompanies && entry.existingCompanies.length > 0) {
      h += '<div class="ebr-card-existing">Currently mapped: ' + entry.existingCompanies.join(', ') + '</div>';
    } else if (entry.alreadyMapped) {
      h += '<div class="ebr-card-existing">Already represented in system</div>';
    } else {
      h += '<div class="ebr-card-existing" style="color:#C9A94E">Missing from current Economy system</div>';
    }

    if (entry.approvalConsequence) {
      h += '<div style="font-size:0.30rem;color:#908878;line-height:1.5;margin:6px 0;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.02)">' + esc(entry.approvalConsequence) + '</div>';
    }

    if (entry.approvalRequired) {
      var _reviewState = entry.approval ? entry.approval.status : 'PENDING';
      var _stateColors = { 'APPROVED': '#5ab5a0', 'DENIED': '#e85454', 'NEEDS_REVIEW': '#4a8fd4', 'PROPOSED': '#C9A94E' };
      h += '<div style="font-size:0.24rem;letter-spacing:1px;color:' + (_stateColors[_reviewState] || '#908878') + ';margin-bottom:4px">REVIEW STATE: ' + esc(_reviewState) + '</div>';

      h += '<div class="ebr-card-actions">';
      h += '<button class="ebr-btn ebr-btn-approve" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="APPROVED">APPROVE</button>';
      h += '<button class="ebr-btn ebr-btn-deny" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="DENIED">DENY</button>';
      h += '<button class="ebr-btn ebr-btn-hold" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="NEEDS_REVIEW">HOLD</button>';
      h += '<button class="ebr-btn ebr-btn-release" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="PROPOSED">RELEASE</button>';
      h += '<button class="ebr-btn" style="color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04);margin-left:4px" data-business-node="' + esc(entry.nodeId) + '" data-business-type="' + esc(entry.businessType) + '" data-business-label="' + esc(entry.nodeLabel) + '" data-business-reason="' + esc(entry.reason) + '">BUSINESS \u2192</button>';
      if (entry.approval && entry.approval.reviewed_by) {
        h += '<span style="font-size:0.24rem;color:#908878;margin-left:8px">' +
          esc(entry.approval.status) + ' by ' + esc(entry.approval.reviewed_by) +
          (entry.approval.review_note ? ' \u2014 ' + esc(entry.approval.review_note) : '') +
          (entry.approval.reviewed_at ? ' \u00b7 ' + new Date(entry.approval.reviewed_at).toLocaleDateString() : '') +
          '</span>';
      } else if (entry.approval && entry.approval.reason) {
        h += '<span style="font-size:0.24rem;color:#908878;margin-left:8px">' + esc(entry.approval.reason) + '</span>';
      }
      h += '</div>';
    }

    h += '</div></div>';
    return h;
  }

  function render() {
    var engine = window.LIMENEconomyBusinessEngine;
    if (!engine) return;

    injectStyles();

    var result = engine.runInference();
    if (result.error) return;

    var allItems = result.mapped.concat(result.missing).concat(result.speculative);

    var filtered = allItems;
    if (_currentFilter === 'missing') filtered = result.missing;
    else if (_currentFilter === 'mapped') filtered = result.mapped;
    else if (_currentFilter === 'speculative') filtered = result.speculative;
    else if (_currentFilter === 'proposed') filtered = allItems.filter(function (e) { return e.approval && e.approval.status === 'PROPOSED'; });
    else if (_currentFilter === 'approved') filtered = allItems.filter(function (e) { return e.approval && e.approval.status === 'APPROVED'; });
    else if (_currentFilter === 'denied') filtered = allItems.filter(function (e) { return e.approval && e.approval.status === 'DENIED'; });
    else if (_currentFilter === 'active-nodes') filtered = allItems.filter(function (e) { return e.nodeActive; });

    var proposedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'PROPOSED'; }).length;
    var approvedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'APPROVED'; }).length;
    var deniedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'DENIED'; }).length;
    var activeNodeCount = allItems.filter(function (e) { return e.nodeActive; }).length;

    var reviewCollapsed = _isCollapsed('ebr-review');
    var cs; try { cs = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { cs = {}; }
    if (cs['ebr-review'] === undefined) { reviewCollapsed = true; _setCollapsed('ebr-review', true); }

    var h = '';
    h += '<div class="eos-section-header" data-section="ebr-review" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:6px;user-select:none">';
    h += '<div class="ebr-title" style="margin-bottom:0">NODE-TO-BUSINESS ASSIGNMENT REVIEW <a href="/execution-framework" target="_blank" style="font-size:0.22rem;color:rgba(201,169,78,0.4);text-decoration:none;margin-left:8px;border:1px solid rgba(201,169,78,0.1);padding:1px 5px;border-radius:2px" onclick="event.stopPropagation()">LEGAL</a></div>';
    h += '<span style="font-size:0.24rem;color:rgba(201,169,78,0.25)">' + (reviewCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="ebr-review"' + (reviewCollapsed ? ' style="display:none"' : '') + '>';

    h += '<div class="ebr-stats">';
    h += '<span class="ebr-stat">Mapped: <b>' + result.mapped.length + '</b></span>';
    h += '<span class="ebr-stat" style="color:#C9A94E">Missing: <b>' + result.missing.length + '</b></span>';
    h += '<span class="ebr-stat" style="color:#a87adb">Speculative: <b>' + result.speculative.length + '</b></span>';
    h += '<span class="ebr-stat">Proposed: <b>' + proposedCount + '</b></span>';
    h += '<span class="ebr-stat" style="color:#5ab5a0">Approved: <b>' + approvedCount + '</b></span>';
    h += '<span class="ebr-stat" style="color:#e85454">Denied: <b>' + deniedCount + '</b></span>';
    h += '<span class="ebr-stat">Active nodes: <b>' + activeNodeCount + '</b></span>';
    h += '</div>';

    var filters = [
      { id: 'all', label: 'ALL (' + allItems.length + ')' },
      { id: 'missing', label: 'MISSING (' + result.missing.length + ')' },
      { id: 'mapped', label: 'MAPPED (' + result.mapped.length + ')' },
      { id: 'speculative', label: 'SPECULATIVE (' + result.speculative.length + ')' },
      { id: 'proposed', label: 'PROPOSED (' + proposedCount + ')' },
      { id: 'approved', label: 'APPROVED (' + approvedCount + ')' },
      { id: 'active-nodes', label: 'ACTIVE NODES (' + activeNodeCount + ')' }
    ];
    h += '<div class="ebr-filter-bar">';
    for (var fi = 0; fi < filters.length; fi++) {
      var f = filters[fi];
      h += '<button class="ebr-filter' + (f.id === _currentFilter ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
    }
    h += '</div>';

    if (filtered.length === 0) {
      h += '<div style="font-size:0.38rem;color:#807868;padding:12px 0">No entries match this filter.</div>';
    } else {
      for (var i = 0; i < filtered.length; i++) {
        h += renderCard(filtered[i]);
      }
    }

    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // MOUNT
  // ══════════════════════════════════════════════════════════════════════

  function mount(container) {
    if (!container) return;

    var panel = document.getElementById(PANEL_ID);
    if (panel) {
      var expandedEls = panel.querySelectorAll('.ebr-card.is-expanded');
      for (var ei = 0; ei < expandedEls.length; ei++) {
        var ck = expandedEls[ei].getAttribute('data-card-key');
        if (ck) _expandedCards[ck] = true;
      }
    }

    var html = render();
    if (!html) return;

    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      container.appendChild(panel);
      _delegationWired = false;
    }
    panel.innerHTML = html;

    // Wire filter buttons
    var filterBtns = panel.querySelectorAll('.ebr-filter');
    for (var i = 0; i < filterBtns.length; i++) {
      filterBtns[i].addEventListener('click', function () {
        _currentFilter = this.getAttribute('data-filter');
        mount(container);
      });
    }

    // Wire approval buttons
    var actionBtns = panel.querySelectorAll('.ebr-btn');
    for (var j = 0; j < actionBtns.length; j++) {
      actionBtns[j].addEventListener('click', function (e) {
        e.stopPropagation();
        var nodeId = this.getAttribute('data-node');
        var type = this.getAttribute('data-type');
        var action = this.getAttribute('data-action');
        var engine = window.LIMENEconomyBusinessEngine;
        if (engine) {
          var reason = action === 'APPROVED' ? 'Operator approved' : action === 'DENIED' ? 'Operator denied' : action === 'PROPOSED' ? 'Released — returned to pending review' : 'Held for review';
          engine.setApprovalStatus(nodeId, type, action, reason);
        }
        mount(container);
      });
    }

    // Wire BUSINESS buttons
    var bizBtns = panel.querySelectorAll('[data-business-node]');
    for (var bi = 0; bi < bizBtns.length; bi++) {
      bizBtns[bi].addEventListener('click', function (e) {
        e.stopPropagation();
        var nodeId = this.getAttribute('data-business-node');
        var bizType = this.getAttribute('data-business-type');
        var nodeLabel = this.getAttribute('data-business-label');
        var reason = this.getAttribute('data-business-reason');
        var oppKey = (nodeId + '_' + bizType).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60);
        try {
          sessionStorage.setItem('limen_exec_context', JSON.stringify({
            key: oppKey, track: 'business', nodeId: nodeId,
            businessType: bizType, nodeLabel: nodeLabel, reason: reason,
            source: 'economy', returnTo: '/domain-console?domain=economy&mode=operator'
          }));
        } catch (ex) {}
        window.location.href = 'economy-workspace.html?track=business&opp=' + encodeURIComponent(oppKey) + '&returnTo=' + encodeURIComponent('/domain-console?domain=economy&mode=operator');
      });
    }

    // Wire collapsible review header
    var reviewHeader = panel.querySelector('[data-section="ebr-review"]');
    if (reviewHeader) {
      reviewHeader.addEventListener('click', function () {
        var body = panel.querySelector('[data-section-body="ebr-review"]');
        var toggle = this.querySelector('span');
        if (body) {
          var nowHidden = body.style.display !== 'none';
          body.style.display = nowHidden ? 'none' : '';
          _setCollapsed('ebr-review', nowHidden);
          if (toggle) toggle.textContent = nowHidden ? '\u25B6' : '\u25BC';
        }
      });
    }

    // Wire per-card collapsible toggle via event delegation
    if (!_delegationWired) {
      _delegationWired = true;
      panel.addEventListener('click', function (e) {
        var summary = e.target.closest('.ebr-card-summary');
        if (!summary) return;
        if (e.target.closest('.ebr-btn') || e.target.closest('a') || e.target.closest('button')) return;
        var card = summary.closest('.ebr-card');
        if (card) {
          card.classList.toggle('is-expanded');
          var ck = card.getAttribute('data-card-key');
          if (ck) _expandedCards[ck] = card.classList.contains('is-expanded');
        }
      });
    }
  }

  window.LIMENEconomyBusinessReview = {
    render: render,
    mount: mount
  };

  console.log('[EconomyBusinessReview] Loaded — review surface ready');

})();
