/**
 * law-business-review.js — Law Business Assignment Review Surface
 *
 * LAW DOMAIN ONLY. Renders a review panel for proposed business mappings
 * across the full 103-node hierarchy.
 * Requires law-node-business-engine.js to be loaded first.
 *
 * Provides APPROVE / DENY / HOLD buttons per proposal.
 * Only APPROVED mappings become active in the Law operator surface.
 *
 * Self-gates: only runs when ?domain=law
 * Exposes: window.LIMENLawBusinessReview
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'law') return;

  var PANEL_ID = 'lbr-business-review';
  var COLLAPSE_KEY = 'limen_law_collapse_state';
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
      '.lbr-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:8px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.lbr-stats{display:flex;gap:16px;margin-bottom:12px;font-size:0.36rem;flex-wrap:wrap}',
      '.lbr-stat{color:#a09888}',
      '.lbr-stat b{color:#e8e3d9}',
      '.lbr-filter-bar{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}',
      '.lbr-filter{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:#a09888;cursor:pointer;transition:all 0.15s}',
      '.lbr-filter:hover{border-color:rgba(201,169,78,0.3);color:#d0c8b8}',
      '.lbr-filter.active{border-color:rgba(201,169,78,0.4);color:#C9A94E;background:rgba(201,169,78,0.06)}',
      '.lbr-section{margin-bottom:16px}',
      '.lbr-card{padding:0;border:1px solid rgba(201,169,78,0.06);border-radius:3px;margin-bottom:6px;background:rgba(8,10,18,0.7);transition:border-color 0.2s,border-left-color 0.2s}',
      '.lbr-card:hover{border-color:rgba(201,169,78,0.15)}',
      '.lbr-card.approved{border-left:3px solid #5ab5a0}',
      '.lbr-card.denied{border-left:3px solid #e85454;opacity:0.5}',
      '.lbr-card.needs-review{border-left:3px solid #C9A94E}',
      '.lbr-card.is-expanded:not(.approved):not(.denied):not(.needs-review){border-left:3px solid rgba(201,169,78,0.35)}',
      '.lbr-card-summary{padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;user-select:none;transition:background 0.15s}',
      '.lbr-card-summary:hover{background:rgba(201,169,78,0.03)}',
      '.lbr-card-summary-left{flex:1;min-width:0}',
      '.lbr-card-chevron{font-size:0.32rem;color:rgba(201,169,78,0.35);flex-shrink:0;transition:transform 0.25s ease}',
      '.lbr-card.is-expanded .lbr-card-chevron{transform:rotate(90deg);color:rgba(201,169,78,0.55)}',
      '.lbr-card-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease,padding 0.25s ease;padding:0 12px}',
      '.lbr-card.is-expanded .lbr-card-body{max-height:800px;opacity:1;padding:0 12px 12px 12px}',
      '.lbr-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px}',
      '.lbr-card-type{font-size:0.4rem;color:#f0ece2;flex:1}',
      '.lbr-card-node{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7)}',
      '.lbr-card-conf{font-size:0.28rem;color:#a09888}',
      '.lbr-card-reasoning{font-size:0.32rem;color:#b0a898;line-height:1.6;margin-bottom:8px;border-left:2px solid rgba(201,169,78,0.12);padding-left:10px}',
      '.lbr-card-reasoning b{color:#d0c8b8}',
      '.lbr-card-existing{font-size:0.28rem;color:#908878;margin-bottom:8px}',
      '.lbr-card-actions{display:flex;gap:4px;align-items:center}',
      '.lbr-btn{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:3px 8px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid}',
      '.lbr-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.04)}',
      '.lbr-btn-approve:hover{background:rgba(90,181,160,0.12)}',
      '.lbr-btn-deny{color:#e85454;border-color:rgba(232,84,84,0.3);background:rgba(232,84,84,0.04)}',
      '.lbr-btn-deny:hover{background:rgba(232,84,84,0.12)}',
      '.lbr-btn-hold{color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04)}',
      '.lbr-btn-hold:hover{background:rgba(201,169,78,0.12)}',
      '.lbr-btn-release{color:#807868;border-color:rgba(128,120,104,0.3);background:rgba(128,120,104,0.04)}',
      '.lbr-btn-release:hover{background:rgba(128,120,104,0.12);color:#b0a898}',
      '.lbr-badge{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px;margin-left:6px}',
      '.lbr-badge-proposed{color:#C9A94E;border:1px solid rgba(201,169,78,0.2);background:rgba(201,169,78,0.06)}',
      '.lbr-badge-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.06)}',
      '.lbr-badge-denied{color:#e85454;border:1px solid rgba(232,84,84,0.2);background:rgba(232,84,84,0.06)}',
      '.lbr-badge-review{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2);background:rgba(74,143,212,0.06)}',
      '.lbr-badge-mapped{color:#5ab5a0;border:1px solid rgba(90,181,160,0.15);background:rgba(90,181,160,0.04)}',
      '.lbr-badge-missing{color:#C9A94E;border:1px solid rgba(201,169,78,0.15);background:rgba(201,169,78,0.04)}',
      '.lbr-badge-spec{color:#a87adb;border:1px solid rgba(168,122,219,0.15);background:rgba(168,122,219,0.04)}',
      '.lbr-badge-top{color:#5ab5a0;border:1px solid rgba(90,181,160,0.15);background:rgba(90,181,160,0.04)}',
      '.lbr-badge-operational{color:#4a8fd4;border:1px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.04)}'
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
    if (!approval) return '<span class="lbr-badge lbr-badge-proposed">PROPOSED</span>';
    var cls = { 'PROPOSED': 'lbr-badge-proposed', 'APPROVED': 'lbr-badge-approved', 'DENIED': 'lbr-badge-denied', 'NEEDS_REVIEW': 'lbr-badge-review' };
    return '<span class="lbr-badge ' + (cls[approval.status] || '') + '">' + (approval.status || 'PROPOSED') + '</span>';
  }

  function bucketBadge(bucket) {
    var cls = { 'MAPPED': 'lbr-badge-mapped', 'MISSING': 'lbr-badge-missing', 'SPECULATIVE': 'lbr-badge-spec' };
    return '<span class="lbr-badge ' + (cls[bucket] || '') + '">' + bucket + '</span>';
  }

  function tierBadge(tier) {
    if (!tier) return '';
    var cls = { 'top': 'lbr-badge-top', 'operational': 'lbr-badge-operational' };
    return '<span class="lbr-badge ' + (cls[tier] || '') + '">' + (tier === 'top' ? 'TOP-LEVEL' : 'HIERARCHY') + '</span>';
  }

  function renderCard(entry) {
    var approvalClass = entry.approval ? entry.approval.status.toLowerCase().replace('_', '-') : 'proposed';
    var cardKey = (entry.nodeId || '') + '::' + (entry.businessType || '');
    var expanded = _expandedCards[cardKey] ? ' is-expanded' : '';
    var h = '<div class="lbr-card ' + approvalClass + expanded + '" data-card-key="' + esc(cardKey) + '">';

    h += '<div class="lbr-card-summary">';
    h += '<div class="lbr-card-summary-left">';

    h += '<div class="lbr-card-header">';
    h += '<div class="lbr-card-type">' + esc(entry.businessType) + '</div>';
    h += '<div>';
    var _badgeSeen = {};
    if (entry.tier) h += tierBadge(entry.tier);
    var _bk = (entry.bucket || '').trim().toUpperCase();
    if (_bk && !_badgeSeen[_bk]) { _badgeSeen[_bk] = true; h += bucketBadge(entry.bucket); }
    var _as = entry.approval ? (entry.approval.status || 'PROPOSED').trim().toUpperCase() : 'PROPOSED';
    if (!_badgeSeen[_as]) { _badgeSeen[_as] = true; h += statusBadge(entry.approval); }
    if (entry.nodeActive && !_badgeSeen['ACTIVE']) { _badgeSeen['ACTIVE'] = true; h += ' <span class="lbr-badge" style="color:#e85454;border:1px solid rgba(232,84,84,0.2)">ACTIVE</span>'; }
    h += '</div>';
    h += '</div>';

    h += '<div class="lbr-card-node">' + esc(entry.nodeId) + ' (' + esc(entry.nodeFullName || entry.nodeId) + ') \u2014 ' + esc(entry.nodeLabel) + '</div>';
    h += '<div class="lbr-card-conf">Confidence: ' + Math.round(entry.confidence * 100) + '%</div>';

    h += '</div>';
    h += '<span class="lbr-card-chevron">\u25B6</span>';
    h += '</div>';

    h += '<div class="lbr-card-body">';

    if (entry.neuroTranslation) {
      h += '<div style="margin:8px 0;padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:3px;background:rgba(74,143,212,0.03)">';
      h += '<div style="font-size:0.26rem;letter-spacing:2px;color:rgba(74,143,212,0.5);margin-bottom:4px">IN NEUROLOGY / IN LAW TRANSLATION</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin-bottom:4px"><b style="color:rgba(74,143,212,0.7)">In neurology:</b> ' + esc(entry.neuroTranslation.inNeurology) + '</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5"><b style="color:rgba(201,169,78,0.7)">In law (legal systems):</b> ' + esc(entry.neuroTranslation.inBusiness) + '</div>';
      h += '</div>';
    }

    h += '<div class="lbr-card-reasoning">';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What this node does:</b> ' + esc(entry.plainFunction || entry.nodeFunction) + '</div>';
    if (entry.plainDysregulation) h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What dysfunction looks like:</b> ' + esc(entry.plainDysregulation) + '</div>';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why this creates demand:</b> ' + esc(entry.reason) + '</div>';
    h += '</div>';

    if (entry.existingCompanies && entry.existingCompanies.length > 0) {
      h += '<div class="lbr-card-existing">Currently mapped: ' + entry.existingCompanies.join(', ') + '</div>';
    } else if (entry.alreadyMapped) {
      h += '<div class="lbr-card-existing">Already represented in system</div>';
    } else {
      h += '<div class="lbr-card-existing" style="color:#C9A94E">Missing from current Law system</div>';
    }

    if (entry.approvalConsequence) {
      h += '<div style="font-size:0.30rem;color:#908878;line-height:1.5;margin:6px 0;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.02)">' + esc(entry.approvalConsequence) + '</div>';
    }

    if (entry.approvalRequired) {
      var _reviewState = entry.approval ? entry.approval.status : 'PENDING';
      var _stateColors = { 'APPROVED': '#5ab5a0', 'DENIED': '#e85454', 'NEEDS_REVIEW': '#4a8fd4', 'PROPOSED': '#C9A94E' };
      h += '<div style="font-size:0.24rem;letter-spacing:1px;color:' + (_stateColors[_reviewState] || '#908878') + ';margin-bottom:4px">REVIEW STATE: ' + esc(_reviewState) + '</div>';

      h += '<div class="lbr-card-actions">';
      h += '<button class="lbr-btn lbr-btn-approve" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="APPROVED">APPROVE</button>';
      h += '<button class="lbr-btn lbr-btn-deny" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="DENIED">DENY</button>';
      h += '<button class="lbr-btn lbr-btn-hold" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="NEEDS_REVIEW">HOLD</button>';
      h += '<button class="lbr-btn lbr-btn-release" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="PROPOSED">RELEASE</button>';
      // removed: BUSINESS build button — workspace lane dropped
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

    h += '</div>';
    h += '</div>';
    return h;
  }

  function render() {
    var engine = window.LIMENLawBusinessEngine;
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
    else if (_currentFilter === 'top-level') filtered = allItems.filter(function (e) { return e.tier === 'top'; });
    else if (_currentFilter === 'hierarchy') filtered = allItems.filter(function (e) { return e.tier === 'operational'; });

    var proposedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'PROPOSED'; }).length;
    var approvedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'APPROVED'; }).length;
    var deniedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'DENIED'; }).length;
    var activeNodeCount = allItems.filter(function (e) { return e.nodeActive; }).length;
    var topCount = allItems.filter(function (e) { return e.tier === 'top'; }).length;
    var hierarchyCount = allItems.filter(function (e) { return e.tier === 'operational'; }).length;

    var reviewCollapsed = _isCollapsed('lbr-review');
    var cs; try { cs = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { cs = {}; }
    if (cs['lbr-review'] === undefined) { reviewCollapsed = true; _setCollapsed('lbr-review', true); }

    var h = '';
    h += '<div class="eos-section-header" data-section="lbr-review" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:6px;user-select:none">';
    h += '<div class="lbr-title" style="margin-bottom:0">NODE-TO-BUSINESS ASSIGNMENT REVIEW <a href="/execution-framework" target="_blank" style="font-size:0.22rem;color:rgba(201,169,78,0.4);text-decoration:none;margin-left:8px;border:1px solid rgba(201,169,78,0.1);padding:1px 5px;border-radius:2px" onclick="event.stopPropagation()">LEGAL</a></div>';
    h += '<span style="font-size:0.24rem;color:rgba(201,169,78,0.25)">' + (reviewCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="lbr-review"' + (reviewCollapsed ? ' style="display:none"' : '') + '>';

    h += '<div class="lbr-stats">';
    h += '<span class="lbr-stat">Mapped: <b>' + result.mapped.length + '</b></span>';
    h += '<span class="lbr-stat" style="color:#C9A94E">Missing: <b>' + result.missing.length + '</b></span>';
    h += '<span class="lbr-stat" style="color:#a87adb">Speculative: <b>' + result.speculative.length + '</b></span>';
    h += '<span class="lbr-stat">Proposed: <b>' + proposedCount + '</b></span>';
    h += '<span class="lbr-stat" style="color:#5ab5a0">Approved: <b>' + approvedCount + '</b></span>';
    h += '<span class="lbr-stat" style="color:#e85454">Denied: <b>' + deniedCount + '</b></span>';
    h += '<span class="lbr-stat">Active nodes: <b>' + activeNodeCount + '</b></span>';
    h += '</div>';

    var filters = [
      { id: 'all', label: 'ALL (' + allItems.length + ')' },
      { id: 'missing', label: 'MISSING (' + result.missing.length + ')' },
      { id: 'mapped', label: 'MAPPED (' + result.mapped.length + ')' },
      { id: 'speculative', label: 'SPECULATIVE (' + result.speculative.length + ')' },
      { id: 'proposed', label: 'PROPOSED (' + proposedCount + ')' },
      { id: 'approved', label: 'APPROVED (' + approvedCount + ')' },
      { id: 'active-nodes', label: 'ACTIVE NODES (' + activeNodeCount + ')' },
      { id: 'top-level', label: 'TOP-LEVEL (' + topCount + ')' },
      { id: 'hierarchy', label: 'HIERARCHY (' + hierarchyCount + ')' }
    ];
    h += '<div class="lbr-filter-bar">';
    for (var fi = 0; fi < filters.length; fi++) {
      var f = filters[fi];
      h += '<button class="lbr-filter' + (f.id === _currentFilter ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
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

  function mount(container) {
    if (!container) return;

    var panel = document.getElementById(PANEL_ID);
    if (panel) {
      var expandedEls = panel.querySelectorAll('.lbr-card.is-expanded');
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

    var filterBtns = panel.querySelectorAll('.lbr-filter');
    for (var i = 0; i < filterBtns.length; i++) {
      filterBtns[i].addEventListener('click', function () {
        _currentFilter = this.getAttribute('data-filter');
        mount(container);
      });
    }

    var actionBtns = panel.querySelectorAll('.lbr-btn');
    for (var j = 0; j < actionBtns.length; j++) {
      actionBtns[j].addEventListener('click', function (e) {
        e.stopPropagation();
        var nodeId = this.getAttribute('data-node');
        var type = this.getAttribute('data-type');
        var action = this.getAttribute('data-action');
        var engine = window.LIMENLawBusinessEngine;
        if (engine && nodeId && action) {
          var reason = action === 'APPROVED' ? 'Operator approved' : action === 'DENIED' ? 'Operator denied' : action === 'PROPOSED' ? 'Released \u2014 returned to pending review' : 'Held for review';
          engine.setApprovalStatus(nodeId, type, action, reason);
        }
        mount(container);
      });
    }

    // removed: BUSINESS build-workspace wiring

    var reviewHeader = panel.querySelector('[data-section="lbr-review"]');
    if (reviewHeader) {
      reviewHeader.addEventListener('click', function () {
        var body = panel.querySelector('[data-section-body="lbr-review"]');
        var toggle = this.querySelector('span');
        if (body) {
          var nowHidden = body.style.display !== 'none';
          body.style.display = nowHidden ? 'none' : '';
          _setCollapsed('lbr-review', nowHidden);
          if (toggle) toggle.textContent = nowHidden ? '\u25B6' : '\u25BC';
        }
      });
    }

    if (!_delegationWired) {
      _delegationWired = true;
      panel.addEventListener('click', function (e) {
        var summary = e.target.closest('.lbr-card-summary');
        if (!summary) return;
        if (e.target.closest('.lbr-btn') || e.target.closest('a') || e.target.closest('button')) return;
        var card = summary.closest('.lbr-card');
        if (card) {
          card.classList.toggle('is-expanded');
          var ck = card.getAttribute('data-card-key');
          if (ck) _expandedCards[ck] = card.classList.contains('is-expanded');
        }
      });
    }
  }

  window.LIMENLawBusinessReview = {
    render: render,
    mount: mount
  };

  console.log('[LawBusinessReview] Loaded \u2014 review surface ready');

})();
