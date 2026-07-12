/**
 * intelligence-business-review.js — Intelligence Business Assignment Review Surface
 *
 * INTELLIGENCE DOMAIN ONLY. Renders a review panel for proposed business mappings
 * across the full 103-node hierarchy.
 * Requires intelligence-node-business-engine.js to be loaded first.
 *
 * Self-gates: only runs when ?domain=intelligence
 * Exposes: window.LIMENIntelligenceBusinessReview
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'intelligence') return;

  var PANEL_ID = 'dbr-business-review';
  var COLLAPSE_KEY = 'limen_intelligence_collapse_state';
  var _stylesInjected = false;

  function _isCollapsed(sectionId) { try { return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}')[sectionId] === true; } catch (e) { return false; } }
  function _setCollapsed(sectionId, val) { try { var st = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); st[sectionId] = val; sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(st)); } catch (e) {} }

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + PANEL_ID + '{font-family:"IBM Plex Mono",monospace;padding:16px 24px}',
      '.dbr-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:8px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.dbr-stats{display:flex;gap:16px;margin-bottom:12px;font-size:0.36rem;flex-wrap:wrap}',
      '.dbr-stat{color:#a09888}',
      '.dbr-stat b{color:#e8e3d9}',
      '.dbr-filter-bar{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}',
      '.dbr-filter{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:#a09888;cursor:pointer;transition:all 0.15s}',
      '.dbr-filter:hover{border-color:rgba(201,169,78,0.3);color:#d0c8b8}',
      '.dbr-filter.active{border-color:rgba(201,169,78,0.4);color:#C9A94E;background:rgba(201,169,78,0.06)}',
      '.dbr-card{padding:0;border:1px solid rgba(201,169,78,0.06);border-radius:3px;margin-bottom:6px;background:rgba(8,10,18,0.7);transition:border-color 0.2s,border-left-color 0.2s}',
      '.dbr-card:hover{border-color:rgba(201,169,78,0.15)}',
      '.dbr-card.approved{border-left:3px solid #5ab5a0}',
      '.dbr-card.denied{border-left:3px solid #e85454;opacity:0.5}',
      '.dbr-card.needs-review{border-left:3px solid #C9A94E}',
      '.dbr-card.is-expanded:not(.approved):not(.denied):not(.needs-review){border-left:3px solid rgba(201,169,78,0.35)}',
      '.dbr-card-summary{padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;user-select:none;transition:background 0.15s}',
      '.dbr-card-summary:hover{background:rgba(201,169,78,0.03)}',
      '.dbr-card-summary-left{flex:1;min-width:0}',
      '.dbr-card-chevron{font-size:0.32rem;color:rgba(201,169,78,0.35);flex-shrink:0;transition:transform 0.25s ease}',
      '.dbr-card.is-expanded .dbr-card-chevron{transform:rotate(90deg);color:rgba(201,169,78,0.55)}',
      '.dbr-card-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease,padding 0.25s ease;padding:0 12px}',
      '.dbr-card.is-expanded .dbr-card-body{max-height:800px;opacity:1;padding:0 12px 12px 12px}',
      '.dbr-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px}',
      '.dbr-card-type{font-size:0.4rem;color:#f0ece2;flex:1}',
      '.dbr-card-node{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7)}',
      '.dbr-card-conf{font-size:0.28rem;color:#a09888}',
      '.dbr-card-reasoning{font-size:0.32rem;color:#b0a898;line-height:1.6;margin-bottom:8px;border-left:2px solid rgba(201,169,78,0.12);padding-left:10px}',
      '.dbr-card-reasoning b{color:#d0c8b8}',
      '.dbr-card-existing{font-size:0.28rem;color:#908878;margin-bottom:8px}',
      '.dbr-card-actions{display:flex;gap:4px;align-items:center}',
      '.dbr-btn{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:3px 8px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid}',
      '.dbr-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.04)}',
      '.dbr-btn-deny{color:#e85454;border-color:rgba(232,84,84,0.3);background:rgba(232,84,84,0.04)}',
      '.dbr-btn-hold{color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04)}',
      '.dbr-btn-release{color:#807868;border-color:rgba(128,120,104,0.3);background:rgba(128,120,104,0.04)}',
      '.dbr-badge{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px;margin-left:6px}',
      '.dbr-badge-proposed{color:#C9A94E;border:1px solid rgba(201,169,78,0.2);background:rgba(201,169,78,0.06)}',
      '.dbr-badge-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.06)}',
      '.dbr-badge-denied{color:#e85454;border:1px solid rgba(232,84,84,0.2);background:rgba(232,84,84,0.06)}',
      '.dbr-badge-mapped{color:#5ab5a0;border:1px solid rgba(90,181,160,0.15);background:rgba(90,181,160,0.04)}',
      '.dbr-badge-missing{color:#C9A94E;border:1px solid rgba(201,169,78,0.15);background:rgba(201,169,78,0.04)}',
      '.dbr-badge-spec{color:#a87adb;border:1px solid rgba(168,122,219,0.15);background:rgba(168,122,219,0.04)}',
      '.dbr-badge-top{color:#5ab5a0;border:1px solid rgba(90,181,160,0.15);background:rgba(90,181,160,0.04)}',
      '.dbr-badge-operational{color:#4a8fd4;border:1px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.04)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var _currentFilter = 'all';
  var _expandedCards = {};
  var _delegationWired = false;

  function statusBadge(approval) {
    if (!approval) return '<span class="dbr-badge dbr-badge-proposed">PROPOSED</span>';
    var cls = { 'PROPOSED': 'dbr-badge-proposed', 'APPROVED': 'dbr-badge-approved', 'DENIED': 'dbr-badge-denied', 'NEEDS_REVIEW': 'dbr-badge-proposed' };
    return '<span class="dbr-badge ' + (cls[approval.status] || '') + '">' + (approval.status || 'PROPOSED') + '</span>';
  }
  function bucketBadge(bucket) {
    var cls = { 'MAPPED': 'dbr-badge-mapped', 'MISSING': 'dbr-badge-missing', 'SPECULATIVE': 'dbr-badge-spec' };
    return '<span class="dbr-badge ' + (cls[bucket] || '') + '">' + bucket + '</span>';
  }
  function tierBadge(tier) {
    if (!tier) return '';
    var cls = { 'top': 'dbr-badge-top', 'operational': 'dbr-badge-operational' };
    return '<span class="dbr-badge ' + (cls[tier] || '') + '">' + (tier === 'top' ? 'TOP-LEVEL' : 'HIERARCHY') + '</span>';
  }

  function renderCard(entry) {
    var approvalClass = entry.approval ? entry.approval.status.toLowerCase().replace('_', '-') : 'proposed';
    var cardKey = (entry.nodeId || '') + '::' + (entry.businessType || '');
    var expanded = _expandedCards[cardKey] ? ' is-expanded' : '';
    var h = '<div class="dbr-card ' + approvalClass + expanded + '" data-card-key="' + esc(cardKey) + '">';
    h += '<div class="dbr-card-summary">';
    h += '<div class="dbr-card-summary-left">';
    h += '<div class="dbr-card-header">';
    h += '<div class="dbr-card-type">' + esc(entry.businessType) + '</div>';
    h += '<div>';
    if (entry.tier) h += tierBadge(entry.tier);
    h += bucketBadge(entry.bucket);
    h += statusBadge(entry.approval);
    if (entry.nodeActive) h += ' <span class="dbr-badge" style="color:#e85454;border:1px solid rgba(232,84,84,0.2)">ACTIVE</span>';
    h += '</div></div>';
    h += '<div class="dbr-card-node">' + esc(entry.nodeId) + ' (' + esc(entry.nodeFullName || entry.nodeId) + ') \u2014 ' + esc(entry.nodeLabel) + '</div>';
    h += '<div class="dbr-card-conf">' + (entry.capitalTier ? entry.capitalTier + ' · ' : '') + 'idea (unproven) · live signal ' + Math.round(entry.confidence * 100) + '%</div>';
    h += '</div>';
    h += '<span class="dbr-card-chevron">\u25B6</span>';
    h += '</div>';
    h += '<div class="dbr-card-body">';
    if (entry.neuroTranslation) {
      h += '<div style="margin:8px 0;padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:3px;background:rgba(74,143,212,0.03)">';
      h += '<div style="font-size:0.26rem;letter-spacing:2px;color:rgba(74,143,212,0.5);margin-bottom:4px">IN NEUROLOGY / IN INTELLIGENCE TRANSLATION</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin-bottom:4px"><b style="color:rgba(74,143,212,0.7)">In neurology:</b> ' + esc(entry.neuroTranslation.inNeurology) + '</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5"><b style="color:rgba(201,169,78,0.7)">In intelligence (learning systems):</b> ' + esc(entry.neuroTranslation.inBusiness) + '</div>';
      h += '</div>';
    }
    h += '<div class="dbr-card-reasoning">';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What this node does:</b> ' + esc(entry.plainFunction || entry.nodeFunction) + '</div>';
    if (entry.plainDysregulation) h += '<div style="margin-bottom:4px"><b style="color:#b0a898">What dysfunction looks like:</b> ' + esc(entry.plainDysregulation) + '</div>';
    h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why this creates demand:</b> ' + esc(entry.reason) + '</div>';
    h += '</div>';
    if (entry.existingCompanies && entry.existingCompanies.length > 0) {
      h += '<div class="dbr-card-existing">Currently mapped: ' + entry.existingCompanies.join(', ') + '</div>';
    } else if (entry.alreadyMapped) {
      h += '<div class="dbr-card-existing">Already represented in system</div>';
    } else {
      h += '<div class="dbr-card-existing" style="color:#C9A94E">Missing from current Intelligence system</div>';
    }
    if (entry.approvalConsequence) {
      h += '<div style="font-size:0.30rem;color:#908878;line-height:1.5;margin:6px 0;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.2);background:rgba(90,181,160,0.02)">' + esc(entry.approvalConsequence) + '</div>';
    }
    if (entry.approvalRequired) {
      h += '<div class="dbr-card-actions">';
      h += '<button class="dbr-btn dbr-btn-approve" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="APPROVED">APPROVE</button>';
      h += '<button class="dbr-btn dbr-btn-deny" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="DENIED">DENY</button>';
      h += '<button class="dbr-btn dbr-btn-hold" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="NEEDS_REVIEW">HOLD</button>';
      h += '<button class="dbr-btn dbr-btn-release" data-node="' + esc(entry.nodeId) + '" data-type="' + esc(entry.businessType) + '" data-action="PROPOSED">RELEASE</button>';
      // removed: BUSINESS build button — workspace lane dropped
      h += '</div>';
    }
    h += '</div></div>';
    return h;
  }

  function render() {
    var engine = window.LIMENIntelligenceBusinessEngine;
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
    else if (_currentFilter === 'active-nodes') filtered = allItems.filter(function (e) { return e.nodeActive; });
    else if (_currentFilter === 'top-level') filtered = allItems.filter(function (e) { return e.tier === 'top'; });
    else if (_currentFilter === 'hierarchy') filtered = allItems.filter(function (e) { return e.tier === 'operational'; });

    var proposedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'PROPOSED'; }).length;
    var approvedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'APPROVED'; }).length;
    var deniedCount = allItems.filter(function (e) { return e.approval && e.approval.status === 'DENIED'; }).length;
    var activeNodeCount = allItems.filter(function (e) { return e.nodeActive; }).length;
    var topCount = allItems.filter(function (e) { return e.tier === 'top'; }).length;
    var hierarchyCount = allItems.filter(function (e) { return e.tier === 'operational'; }).length;

    var reviewCollapsed = _isCollapsed('dbr-review');
    var cs; try { cs = JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { cs = {}; }
    if (cs['dbr-review'] === undefined) { reviewCollapsed = true; _setCollapsed('dbr-review', true); }

    var h = '';
    h += '<div class="eos-section-header" data-section="dbr-review" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:6px;user-select:none">';
    h += '<div class="dbr-title" style="margin-bottom:0">NODE-TO-BUSINESS ASSIGNMENT REVIEW</div>';
    h += '<span style="font-size:0.24rem;color:rgba(201,169,78,0.25)">' + (reviewCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="dbr-review"' + (reviewCollapsed ? ' style="display:none"' : '') + '>';

    h += '<div class="dbr-stats">';
    h += '<span class="dbr-stat">Mapped: <b>' + result.mapped.length + '</b></span>';
    h += '<span class="dbr-stat" style="color:#C9A94E">Missing: <b>' + result.missing.length + '</b></span>';
    h += '<span class="dbr-stat" style="color:#a87adb">Speculative: <b>' + result.speculative.length + '</b></span>';
    h += '<span class="dbr-stat">Proposed: <b>' + proposedCount + '</b></span>';
    h += '<span class="dbr-stat" style="color:#5ab5a0">Approved: <b>' + approvedCount + '</b></span>';
    h += '<span class="dbr-stat" style="color:#e85454">Denied: <b>' + deniedCount + '</b></span>';
    h += '<span class="dbr-stat">Active nodes: <b>' + activeNodeCount + '</b></span>';
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
    h += '<div class="dbr-filter-bar">';
    for (var fi = 0; fi < filters.length; fi++) {
      var f = filters[fi];
      h += '<button class="dbr-filter' + (f.id === _currentFilter ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
    }
    h += '</div>';

    if (filtered.length === 0) {
      h += '<div style="font-size:0.38rem;color:#807868;padding:12px 0">No entries match this filter.</div>';
    } else {
      for (var i = 0; i < filtered.length; i++) h += renderCard(filtered[i]);
    }

    h += '</div>';
    return h;
  }

  function mount(container) {
    if (!container) return;
    var panel = document.getElementById(PANEL_ID);
    if (panel) {
      var expandedEls = panel.querySelectorAll('.dbr-card.is-expanded');
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

    var filterBtns = panel.querySelectorAll('.dbr-filter');
    for (var i = 0; i < filterBtns.length; i++) {
      filterBtns[i].addEventListener('click', function () { _currentFilter = this.getAttribute('data-filter'); mount(container); });
    }

    var actionBtns = panel.querySelectorAll('.dbr-btn');
    for (var j = 0; j < actionBtns.length; j++) {
      actionBtns[j].addEventListener('click', function (e) {
        e.stopPropagation();
        var nodeId = this.getAttribute('data-node');
        var type = this.getAttribute('data-type');
        var action = this.getAttribute('data-action');
        var engine = window.LIMENIntelligenceBusinessEngine;
        if (engine && nodeId && action) {
          engine.setApprovalStatus(nodeId, type, action, action === 'APPROVED' ? 'Operator approved' : action === 'DENIED' ? 'Operator denied' : action === 'PROPOSED' ? 'Released' : 'Held for review');
        }
        mount(container);
      });
    }

    // removed: BUSINESS build-workspace wiring

    var reviewHeader = panel.querySelector('[data-section="dbr-review"]');
    if (reviewHeader) {
      reviewHeader.addEventListener('click', function () {
        var body = panel.querySelector('[data-section-body="dbr-review"]');
        var toggle = this.querySelector('span');
        if (body) {
          var nowHidden = body.style.display !== 'none';
          body.style.display = nowHidden ? 'none' : '';
          _setCollapsed('dbr-review', nowHidden);
          if (toggle) toggle.textContent = nowHidden ? '\u25B6' : '\u25BC';
        }
      });
    }

    if (!_delegationWired) {
      _delegationWired = true;
      panel.addEventListener('click', function (e) {
        var summary = e.target.closest('.dbr-card-summary');
        if (!summary) return;
        if (e.target.closest('.dbr-btn') || e.target.closest('a') || e.target.closest('button')) return;
        var card = summary.closest('.dbr-card');
        if (card) {
          card.classList.toggle('is-expanded');
          var ck = card.getAttribute('data-card-key');
          if (ck) _expandedCards[ck] = card.classList.contains('is-expanded');
        }
      });
    }
  }

  window.LIMENIntelligenceBusinessReview = { render: render, mount: mount };
  console.log('[DefenseBusinessReview] Loaded \u2014 review surface ready');
})();
