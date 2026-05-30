/**
 * technology-clarity-operator.js — Money-Driven Action Surface for Technology Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #eos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=technology is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on energy domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'technology') return;

  var VIEW_ID = 'eos-operator-view';
  var STATUS_KEY = 'limen_technology_operator_status';
  var COLLAPSE_KEY = 'limen_technology_collapse_state';
  var _operatorView = null;
  var _isOperatorMode = false;
  var _booted = false;

  // Session-persistent collapse state
  function getCollapseState() {
    try { return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setCollapsed(sectionId, collapsed) {
    var st = getCollapseState();
    st[sectionId] = collapsed;
    try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(st)); } catch (e) {}
  }
  function isCollapsed(sectionId) {
    return getCollapseState()[sectionId] === true;
  }
  function wrapCollapsible(sectionId, titleText, contentHtml, defaultOpen) {
    var collapsed = isCollapsed(sectionId);
    if (defaultOpen === undefined) defaultOpen = true;
    // First render: default to open unless explicitly collapsed
    var cs = getCollapseState();
    if (cs[sectionId] === undefined) collapsed = !defaultOpen;
    var h = '<div class="eos-section-header" data-section="' + sectionId + '">';
    h += '<div class="eos-title" style="margin-bottom:0">' + titleText + '</div>';
    h += '<span class="eos-section-toggle">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div class="eos-section-body' + (collapsed ? ' collapsed' : '') + '" data-section-body="' + sectionId + '">';
    h += contentHtml;
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // STYLES — injected once
  // ══════════════════════════════════════════════════════════════════════

  var _stylesInjected = false;

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + VIEW_ID + '{padding:20px 24px 60px;font-family:"IBM Plex Mono",monospace;overflow-y:auto;grid-column:1/-1;grid-row:2;display:none}',

      /* Section titles */
      '.eos-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:6px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',

      /* Money summary */
      '.eos-summary{font-size:0.54rem;color:#f0ece2;line-height:1.65;margin-bottom:18px;max-width:900px}',
      '.eos-summary b{color:#C9A94E}',

      /* Top 3 plays */
      '.eos-plays{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:18px}',
      '.eos-play{padding:12px 14px;border:1px solid rgba(201,169,78,0.1);border-radius:3px;background:rgba(10,12,20,0.6);transition:border-color 0.2s}',
      '.eos-play:hover{border-color:rgba(201,169,78,0.25)}',
      '.eos-play-rank{font-size:0.6rem;color:rgba(201,169,78,0.25);font-weight:bold;float:right;margin-left:8px}',
      '.eos-play-name{font-size:0.46rem;color:#f0ece2;margin-bottom:4px;line-height:1.4}',
      '.eos-play-path{display:inline-block;font-size:0.28rem;letter-spacing:1.5px;padding:1px 6px;border-radius:2px;margin-bottom:6px}',
      '.eos-path-grant{color:#5ab5a0;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.06)}',
      '.eos-path-invest{color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)}',
      '.eos-path-patent{color:#a87adb;border:1px solid rgba(168,122,219,0.25);background:rgba(168,122,219,0.06)}',
      '.eos-play-why{font-size:0.38rem;color:#c9c1b0;line-height:1.5;margin-bottom:4px}',
      '.eos-play-outcome{font-size:0.34rem;color:rgba(201,169,78,0.75);margin-top:4px}',

      /* Action queue table */
      '.eos-queue{width:100%;border-collapse:collapse;margin-bottom:8px}',
      '.eos-queue th{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.75);text-transform:uppercase;text-align:left;padding:5px 8px;border-bottom:1px solid rgba(201,169,78,0.12);font-weight:600}',
      '.eos-queue td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.38rem;color:#d0c8b8;vertical-align:top}',
      '.eos-queue tr:hover{background:rgba(201,169,78,0.02)}',
      '.eos-queue-pri{color:#C9A94E;font-weight:bold;font-size:0.42rem;width:30px}',
      '.eos-queue-name{max-width:220px}',
      '.eos-queue-why{color:#c0b8a5;max-width:340px;line-height:1.4}',
      '.money-thesis-cell{display:flex;flex-direction:column;gap:6px}',
      '.money-thesis-preview{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5}',
      '.money-thesis-expanded{display:block;line-height:1.5;white-space:pre-line}',
      '.money-thesis-expanded.hidden{display:none}',
      '.money-thesis-detail{margin-top:6px;padding:6px 8px;border-left:2px solid rgba(201,169,78,0.25);font-size:0.34rem;color:#c0b8a5;line-height:1.5}',
      '.money-thesis-detail span.mtd-label{color:rgba(201,169,78,0.7);font-size:0.26rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-top:6px}',
      '.money-thesis-detail span.mtd-label:first-child{margin-top:0}',
      '.money-thesis-toggle{align-self:flex-start;background:none;border:1px solid rgba(201,169,78,0.2);color:#C9A94E;font-size:0.26rem;letter-spacing:1px;padding:2px 8px;cursor:pointer;border-radius:3px}',
      '.money-thesis-toggle:hover{background:rgba(201,169,78,0.08)}',
      '.eos-queue-step{color:#d0cec8;max-width:220px;line-height:1.4}',
      '.eos-queue-status{width:auto}',
      '.eos-action-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:4px 8px 8px 38px}',
      '.eos-action-row td{border-bottom:1px solid rgba(255,255,255,0.025);padding:0}',

      /* Status buttons */
      '.eos-status-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(255,255,255,0.1);background:none;color:#a09888;margin:1px;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-status-btn:hover{border-color:rgba(201,169,78,0.3);color:#C9A94E}',
      '.eos-status-btn.active-new{color:#5ab5a0;border-color:rgba(90,181,160,0.3)}',
      '.eos-status-btn.active-wip{color:#C9A94E;border-color:rgba(201,169,78,0.3)}',
      '.eos-status-btn.active-done{color:#4a8fd4;border-color:rgba(74,143,212,0.3)}',
      '.eos-status-btn.active-watch{color:#807868;border-color:rgba(128,120,104,0.3)}',

      /* Toggle button in header — now uses dual buttons in .ch-center */

      /* Quiet state */
      '.eos-quiet{font-size:0.42rem;color:#b0a898;line-height:1.6;padding:8px 0}',

      /* Collapsible sections */
      '.eos-section-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;margin-bottom:6px;user-select:none;-webkit-user-select:none}',
      '.eos-section-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 8px rgba(201,169,78,0.4)}',
      '.eos-section-toggle{font-size:0.24rem;color:rgba(201,169,78,0.35);transition:transform 0.2s}',
      '.eos-section-body{overflow:hidden;transition:max-height 0.25s ease,opacity 0.2s ease}',
      '.eos-section-body.collapsed{max-height:0;opacity:0;margin:0;padding:0}',

      /* Anchor Directive card */
      '.eos-anchor{margin-bottom:14px;padding:14px 16px;border:1px solid rgba(201,169,78,0.25);border-left:3px solid #C9A94E;border-radius:3px;background:rgba(201,169,78,0.03)}',
      '.eos-anchor-label{font-size:0.24rem;letter-spacing:2.5px;color:#C9A94E;margin-bottom:8px;font-weight:700}',
      '.eos-anchor-title{font-size:0.56rem;color:#f0ece2;line-height:1.4;margin-bottom:8px;font-weight:500}',
      '.eos-anchor-explain{font-size:0.40rem;color:#c0b8a5;line-height:1.6;margin-bottom:10px}',
      '.eos-anchor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
      '@media(max-width:700px){.eos-anchor-grid{grid-template-columns:1fr}}',
      '.eos-anchor-block{padding:8px 10px;border-left:2px solid rgba(201,169,78,0.15);background:rgba(0,0,0,0.1);border-radius:2px}',
      '.eos-anchor-block-label{font-size:0.24rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7);margin-bottom:4px;font-weight:600}',
      '.eos-anchor-block-text{font-size:0.34rem;color:#d0c8b8;line-height:1.6}',
      '.eos-anchor-step{font-size:0.34rem;color:#c0b8a5;padding:2px 0;line-height:1.5}',
      '.eos-anchor-step b{color:#d0c8b8}',
      '.eos-anchor-lineage{font-size:0.24rem;color:rgba(74,143,212,0.6);letter-spacing:0.5px;margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)}',

      /* Deep Proof block */
      '.eos-deepproof{margin-bottom:14px;padding:12px 16px;border:1px solid rgba(74,143,212,0.2);border-left:3px solid rgba(74,143,212,0.6);border-radius:3px;background:rgba(74,143,212,0.03)}',
      '.eos-deepproof-label{font-size:0.24rem;letter-spacing:2.5px;color:rgba(74,143,212,0.8);margin-bottom:6px;font-weight:700}',
      '.eos-deepproof-title{font-size:0.48rem;color:#e0daca;line-height:1.4;margin-bottom:6px}',
      '.eos-deepproof-why{font-size:0.34rem;color:rgba(74,143,212,0.6);line-height:1.5;margin-bottom:8px;font-style:italic}',
      '.eos-deepproof-steps{font-size:0.34rem;color:#c0b8a5;line-height:1.6;margin-bottom:8px}',

      /* Deep Intelligence expandable */
      '.eos-deep-toggle{font-family:inherit;font-size:0.24rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(74,143,212,0.2);border-radius:2px;background:rgba(74,143,212,0.03);color:rgba(74,143,212,0.7);cursor:pointer;transition:all 0.15s;margin-top:6px}',
      '.eos-deep-toggle:hover{background:rgba(74,143,212,0.08);color:rgba(74,143,212,0.95)}',
      '.eos-deep-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease;margin-top:0}',
      '.eos-deep-body.open{max-height:600px;opacity:1;margin-top:8px}',
      '.eos-deep-section{margin-bottom:8px;padding:6px 10px;border-left:2px solid rgba(74,143,212,0.12);background:rgba(74,143,212,0.02);border-radius:2px}',
      '.eos-deep-label{font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.6);margin-bottom:3px;font-weight:600}',
      '.eos-deep-text{font-size:0.30rem;color:#b0a898;line-height:1.6}',
      '.eos-deep-cite{font-size:0.26rem;color:#908878;line-height:1.5;padding:2px 0}',

      /* Invest button in action queue */
      '.eos-invest-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.04);color:#5ab5a0;margin-left:0;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-invest-btn:hover{background:rgba(90,181,160,0.12);border-color:rgba(90,181,160,0.4)}',

      /* Target section */
      '.eos-targets{margin-top:6px;padding-top:5px;border-top:1px solid rgba(201,169,78,0.06)}',
      '.eos-targets-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px;user-select:none}',
      '.eos-targets-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 6px rgba(201,169,78,0.3)}',
      '.eos-invest-meaning{font-size:0.28rem;color:#a09888;font-style:italic;margin-bottom:6px}',
      /* Target row — compact horizontal */
      '.eos-target-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.02);cursor:pointer;transition:background 0.15s}',
      '.eos-target-row:hover{background:rgba(201,169,78,0.03)}',
      '.eos-target-ticker{color:#C9A94E;font-weight:bold;font-size:0.38rem;min-width:42px}',
      '.eos-target-name{color:#d0c8b8;font-size:0.34rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eos-target-cik{font-size:0.24rem;color:#908878;min-width:70px}',
      '.eos-target-val{font-size:0.22rem;letter-spacing:1px;padding:1px 4px;border-radius:1px;white-space:nowrap}',
      '.eos-val-helix{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.eos-val-node{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)}',
      '.eos-val-domain{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '.eos-val-etf{color:#807868;border:1px solid rgba(128,120,104,0.2)}',
      '.eos-target-fit{font-size:0.30rem;color:#b0a898;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px}',
      '.eos-target-expand{font-size:0.22rem;color:rgba(201,169,78,0.3);margin-left:auto}',
      /* Target detail — hidden by default */
      '.eos-target-detail{display:none;padding:6px 8px 8px 48px;font-size:0.32rem;color:#b0a898;line-height:1.5;border-bottom:1px solid rgba(201,169,78,0.04);background:rgba(0,0,0,0.1)}',
      '.eos-target-detail.open{display:block}',
      '.eos-target-link{font-family:inherit;font-size:0.24rem;letter-spacing:0.5px;padding:1px 5px;border:1px solid rgba(201,169,78,0.12);border-radius:1px;background:none;color:#a09888;cursor:pointer;text-decoration:none;transition:all 0.15s;margin-right:3px}',
      '.eos-target-link:hover{color:#C9A94E;border-color:rgba(201,169,78,0.3)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATA ACCESS — reads brain state, never writes
  // ══════════════════════════════════════════════════════════════════════

  function getState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('technology');
    return brain ? brain.getState() : null;
  }

  function getStatusMap() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch (e) { return {}; }
  }

  /**
   * Render a compact lineage badge for promoted portal directives.
   * Shows depth, source portal, and node — signals "this came from deep intelligence."
   */
  function promotedBadge(o) {
    if (!o || o.source !== 'portal_directive' || !o._directive) return '';
    var d = o._directive;
    var depth = d.depth != null ? d.depth : 0;
    var node = d.nodeLabel || d.nodeId || '';
    var portal = d.portalTitle || d.portalDomainId || '';
    // Stronger visual for L2+ (deep) vs L0-L1 (shallow)
    var isDeep = depth >= 2;
    var borderColor = isDeep ? 'rgba(74,143,212,0.5)' : 'rgba(74,143,212,0.2)';
    var bgColor = isDeep ? 'rgba(74,143,212,0.08)' : 'rgba(74,143,212,0.04)';
    var prefix = isDeep ? 'DEEP L' + depth : 'L' + depth;
    var mechLabel = (o._mechanism && o._mechanism.primaryLabel) ? ' \u00b7 ' + o._mechanism.primaryLabel : '';
    return ' <span style="font-size:0.22rem;letter-spacing:0.5px;padding:1px 5px;border-radius:2px;color:rgba(74,143,212,0.9);border:1px solid ' + borderColor + ';background:' + bgColor + '">' +
      prefix + ' \u00b7 ' + esc(node) + mechLabel + '</span>';
  }

  function setStatus(key, status) {
    var map = getStatusMap();
    map[key] = status;
    try { localStorage.setItem(STATUS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // LANGUAGE ENGINE — rewrites brain output into money language
  // ══════════════════════════════════════════════════════════════════════

  var DX_CONTEXT = {
    'CYBER_ATTACK': {
      what: 'Ransomware, nation-state intrusions, and supply-chain compromises are elevating enterprise cyber risk across every sector',
      money: 'EDR/XDR vendors, MDR services, SOAR platforms, and zero-trust identity providers gain leverage. Cyber insurers tighten underwriting. CISOs accelerate stack consolidation and incident-response retainers.',
      step: 'Check CISA Known Exploited Vulnerabilities catalog. Position in CRWD, PANW, ZS or sign an MDR retainer with Arctic Wolf / Red Canary.',
      outcome: '$500K-$10M enterprise security contracts or 20-30% cybersecurity sector premium'
    },
    'AI_ALIGNMENT_FAILURE': {
      what: 'Frontier model capabilities are outpacing alignment, evaluation, and governance tooling, and regulators are moving in',
      money: 'AI eval platforms, red-team services, AI governance software, and safety consultancies gain demand. Enterprise AI buyers require model cards, DPIAs, and EU AI Act posture.',
      step: 'Track major model releases, AI incident database entries, OSTP / EU AI Act / NIST AI RMF announcements. Position in eval and governance tooling.',
      outcome: '$250K-$5M enterprise AI governance contracts or sustained eval / red-team revenue'
    },
    'INFRASTRUCTURE_COLLAPSE': {
      what: 'Cloud outages, cascading dependency failures, and cross-region incidents are exposing concentration risk across the enterprise stack',
      money: 'Multi-cloud orchestration, resilience testing, chaos engineering, and observability vendors gain leverage. Enterprises fund resilience and disaster-recovery tabletop programs.',
      step: 'Track AWS / Azure / GCP status pages, major BGP and DNS incidents, SLA breach disclosures. Position in DDOG, NET, or chaos engineering platforms.',
      outcome: '$250K-$5M resilience contracts or sustained observability ARR'
    },
    'DATA_BREACH': {
      what: 'Large-scale data exposures and credential-theft campaigns are expanding, and state data-breach notification laws are expanding liability',
      money: 'DSPM, DLP, privileged access, and breach response vendors gain demand. Privacy automation platforms become mandatory in regulated workflows.',
      step: 'Track Have I Been Pwned, state AG breach notifications, and SEC 8-K cyber disclosures. Position in DSPM (VRNS, Wiz), identity (CYBR), and breach response.',
      outcome: '$500K-$5M breach response retainers or sustained DSPM / privacy ARR'
    },
    'CHIP_SHORTAGE': {
      what: 'GPU, HBM, and advanced-node capacity constraints are driving compute cost up and extending AI delivery timelines',
      money: 'GPU optimization, inference efficiency, model quantization, and alternative compute providers gain leverage. Enterprises fund cost-optimization and reservation management tools.',
      step: 'Track TSMC / ASML / Nvidia commentary, CHIPS Act allocations, and export-control updates. Position in NVDA, TSM, ASML or inference optimization startups.',
      outcome: '$1M-$20M compute optimization savings or sustained platform ARR'
    },
    'PLATFORM_MONOPOLY': {
      what: 'Antitrust enforcement against big-tech platforms and app-store gatekeeper rules (EU DMA) are reshaping the platform landscape',
      money: 'Interoperability layers, platform-agnostic payment rails, and alternative marketplaces gain leverage. Enterprises fund vendor lock-in audits.',
      step: 'Track DOJ / FTC cases, EU DMA designation lists, and app-store policy changes. Position in interoperability and lock-in mitigation services.',
      outcome: '$250K-$5M platform transition contracts or sustained interop ARR'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };

  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL INVESTMENT PLAYBOOK MAPPING
  // Maps brain opportunity sources to registered investment console IDs.
  // Only opportunities with a canonical mapping get an INVEST button.
  // ══════════════════════════════════════════════════════════════════════

  // Diagnosis → playbook ID for Technology-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'CYBER_ATTACK':            'tech_cyber',
    'AI_ALIGNMENT_FAILURE':    'tech_ai_governance',
    'INFRASTRUCTURE_COLLAPSE': 'tech_resilience',
    'DATA_BREACH':             'tech_data_protection',
    'CHIP_SHORTAGE':           'tech_compute',
    'PLATFORM_MONOPOLY':       'tech_platform'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'tech_cyber',
    'company_stressed':  'tech_resilience',
    'convergence':       'tech_ai_governance',
    'cross_domain':      'tech_compute'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'tech_cyber':           { title: 'Cybersecurity Surge', domains: ['technology', 'defense'], type: 'invest' },
    'tech_ai_governance':   { title: 'AI Governance & Safety', domains: ['technology', 'governance'], type: 'invest' },
    'tech_resilience':      { title: 'Cloud / Platform Resilience', domains: ['technology', 'infrastructure'], type: 'invest' },
    'tech_data_protection': { title: 'Data Protection & Privacy', domains: ['technology', 'governance'], type: 'invest' },
    'tech_compute':         { title: 'Compute & Semiconductor Capacity', domains: ['technology', 'infrastructure'], type: 'invest' },
    'tech_platform':        { title: 'Platform Antitrust & Interoperability', domains: ['technology', 'governance'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in technology.json portal),
  //             DOMAIN_MAPPED (in technology command board), ETF_PROXY (sector proxy, no company-level validation)
  var INVEST_TARGETS = {
    'tech_cyber': [
      { ticker: 'CIBR', name: 'First Trust NASDAQ Cybersecurity ETF', cik: null,      validation: 'ETF_PROXY',       reason: 'Broad cybersecurity ETF — thematic proxy for the cyber threat surge' },
      { ticker: 'CRWD', name: 'CrowdStrike Holdings',                 cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'EDR/XDR market leader; direct beneficiary of elevated threat activity' },
      { ticker: 'PANW', name: 'Palo Alto Networks',                   cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Platformized security leader; firewall + cloud + SOC bundles' },
      { ticker: 'ZS',   name: 'Zscaler',                              cik: '1713683', validation: 'HELIX_VALIDATED', reason: 'Zero-trust SASE leader; benefits from identity / perimeter collapse' },
      { ticker: 'S',    name: 'SentinelOne',                          cik: '1583708', validation: 'DOMAIN_MAPPED',   reason: 'Autonomous EDR challenger; growth in mid-market' },
      { ticker: 'FTNT', name: 'Fortinet',                             cik: '1262039', validation: 'HELIX_VALIDATED', reason: 'Network security incumbent with broad firewall + secure SD-WAN footprint' },
      { ticker: 'OKTA', name: 'Okta',                                 cik: '1660134', validation: 'DOMAIN_MAPPED',   reason: 'Identity provider; identity is the new perimeter under cyber surge' }
    ],
    'tech_ai_governance': [
      { ticker: 'BOTZ', name: 'Global X Robotics & AI ETF',           cik: null,      validation: 'ETF_PROXY',       reason: 'AI / robotics ETF — thematic proxy for AI governance and adoption' },
      { ticker: 'MSFT', name: 'Microsoft (Azure AI + OpenAI)',        cik: '789019',  validation: 'HELIX_VALIDATED', reason: 'Largest enterprise AI platform exposed to governance requirements' },
      { ticker: 'GOOGL',name: 'Alphabet (Gemini + Vertex)',           cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'Gemini + Vertex AI enterprise surface + AI governance tooling' },
      { ticker: 'NVDA', name: 'NVIDIA',                               cik: '1045810', validation: 'HELIX_VALIDATED', reason: 'AI compute platform; directly tied to model deployment governance' },
      { ticker: 'IBM',  name: 'IBM (watsonx.governance)',             cik: '51143',   validation: 'DOMAIN_MAPPED',   reason: 'watsonx.governance targeted at enterprise AI risk' },
      { ticker: 'PLTR', name: 'Palantir',                             cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'AIP enterprise AI platform with governance and deployment controls' }
    ],
    'tech_resilience': [
      { ticker: 'SKYY', name: 'First Trust Cloud Computing ETF',      cik: null,      validation: 'ETF_PROXY',       reason: 'Cloud infrastructure ETF — thematic proxy for resilience spend' },
      { ticker: 'DDOG', name: 'Datadog',                              cik: '1561550', validation: 'HELIX_VALIDATED', reason: 'Dominant observability platform benefits from resilience programs' },
      { ticker: 'NET',  name: 'Cloudflare',                           cik: '1477333', validation: 'HELIX_VALIDATED', reason: 'Edge resilience + DDoS + zero-trust across the perimeter' },
      { ticker: 'MDB',  name: 'MongoDB',                              cik: '1441816', validation: 'DOMAIN_MAPPED',   reason: 'Distributed database resilience and multi-cloud deployment' },
      { ticker: 'NOW',  name: 'ServiceNow',                           cik: '1373715', validation: 'HELIX_VALIDATED', reason: 'IT service management; runs the resilience and incident workflows' },
      { ticker: 'ESTC', name: 'Elastic',                              cik: '1707753', validation: 'DOMAIN_MAPPED',   reason: 'Search + observability; resilience telemetry layer' }
    ],
    'tech_data_protection': [
      { ticker: 'HACK', name: 'ETFMG Prime Cyber Security ETF',       cik: null,      validation: 'ETF_PROXY',       reason: 'Cyber ETF — thematic proxy for breach + privacy spend' },
      { ticker: 'CRWD', name: 'CrowdStrike Holdings',                 cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Identity + data protection expansion via Falcon' },
      { ticker: 'CYBR', name: 'CyberArk',                             cik: '1370755', validation: 'DOMAIN_MAPPED',   reason: 'Privileged access management limits blast radius of breaches' },
      { ticker: 'VRNS', name: 'Varonis Systems',                      cik: '1365101', validation: 'DOMAIN_MAPPED',   reason: 'Data security posture management focus on unstructured data' },
      { ticker: 'OKTA', name: 'Okta',                                 cik: '1660134', validation: 'DOMAIN_MAPPED',   reason: 'Identity governance + adaptive auth limits credential exposure' },
      { ticker: 'NET',  name: 'Cloudflare',                           cik: '1477333', validation: 'HELIX_VALIDATED', reason: 'Zero-trust + DLP across edge and origin' }
    ],
    'tech_compute': [
      { ticker: 'SOXX', name: 'iShares Semiconductor ETF',            cik: null,      validation: 'ETF_PROXY',       reason: 'Semiconductor ETF — thematic proxy for compute capacity constraints' },
      { ticker: 'NVDA', name: 'NVIDIA',                               cik: '1045810', validation: 'HELIX_VALIDATED', reason: 'Dominant GPU supplier; chip shortage premium' },
      { ticker: 'TSM',  name: 'Taiwan Semiconductor (TSMC)',          cik: '1046179', validation: 'HELIX_VALIDATED', reason: 'Advanced-node foundry exposure to capacity constraints' },
      { ticker: 'ASML', name: 'ASML Holding',                         cik: '937966',  validation: 'HELIX_VALIDATED', reason: 'EUV lithography monopoly; essential to advanced-node expansion' },
      { ticker: 'AMD',  name: 'Advanced Micro Devices',               cik: '2488',    validation: 'HELIX_VALIDATED', reason: 'GPU/CPU alternative to Nvidia; instinct AI accelerators' },
      { ticker: 'AVGO', name: 'Broadcom',                             cik: '1730168', validation: 'HELIX_VALIDATED', reason: 'Custom silicon (TPU) and networking ASICs for hyperscalers' }
    ],
    'tech_platform': [
      { ticker: 'XLC',  name: 'Communication Services Select SPDR',   cik: null,      validation: 'ETF_PROXY',       reason: 'Communication / platforms ETF — thematic proxy for platform regulatory exposure' },
      { ticker: 'GOOGL',name: 'Alphabet (Google)',                    cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'Primary DOJ antitrust target; platform restructuring exposure' },
      { ticker: 'META', name: 'Meta Platforms',                       cik: '1326801', validation: 'HELIX_VALIDATED', reason: 'EU DMA gatekeeper; messaging interoperability and ad-tech exposure' },
      { ticker: 'AAPL', name: 'Apple',                                cik: '320193',  validation: 'HELIX_VALIDATED', reason: 'App Store / DMA exposure; interoperability mandates' },
      { ticker: 'AMZN', name: 'Amazon',                               cik: '1018724', validation: 'HELIX_VALIDATED', reason: 'FTC marketplace antitrust case; gatekeeper exposure' },
      { ticker: 'MSFT', name: 'Microsoft',                            cik: '789019',  validation: 'HELIX_VALIDATED', reason: 'EU DMA gatekeeper for Windows / LinkedIn / Teams' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → infra_demand
    if (opp.source === 'lagging') return 'infra_demand';
    // 4. No mapping — INVEST button will be hidden
    return null;
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var VAL_LABELS = {
    'HELIX_VALIDATED': { label: 'HELIX VALIDATED', cls: 'eos-val-helix' },
    'NODE_MAPPED':     { label: 'NODE MAPPED',     cls: 'eos-val-node' },
    'DOMAIN_MAPPED':   { label: 'DOMAIN MAPPED',   cls: 'eos-val-domain' },
    'ETF_PROXY':       { label: 'ETF PROXY',       cls: 'eos-val-etf' }
  };

  function renderTargets(pbId) {
    var targets = INVEST_TARGETS[pbId];
    if (!targets || targets.length === 0) return '';
    var tCollapsed = isCollapsed('targets-' + pbId);

    var h = '<div class="eos-targets">';
    // Collapsible header
    h += '<div class="eos-targets-header" data-section="targets-' + pbId + '">';
    h += '<div class="eos-title" style="margin-bottom:0;font-size:0.26rem">SUGGESTED TARGETS \u00b7 ' + targets.length + '</div>';
    h += '<span style="font-size:0.22rem;color:rgba(201,169,78,0.25)">' + (tCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="targets-' + pbId + '"' + (tCollapsed ? ' style="display:none"' : '') + '>';
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Technology condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var v = VAL_LABELS[t.validation] || { label: t.validation, cls: '' };
      var shortFit = t.reason.length > 60 ? t.reason.substring(0, 57) + '...' : t.reason;

      // Compact row — ticker | name | CIK | badge | short fit
      h += '<div class="eos-target-row" data-target-idx="' + pbId + '-' + i + '">';
      h += '<span class="eos-target-ticker">' + esc(t.ticker) + '</span>';
      h += '<span class="eos-target-name">' + esc(t.name) + '</span>';
      h += '<span class="eos-target-cik">' + (t.cik ? 'CIK ' + esc(t.cik) : '') + '</span>';
      h += '<span class="eos-target-val ' + v.cls + '">' + v.label + '</span>';
      h += '<span class="eos-target-fit">' + esc(shortFit) + '</span>';
      h += '<span class="eos-target-expand">\u25BC</span>';
      h += '</div>';

      // Expandable detail
      h += '<div class="eos-target-detail" data-target-detail="' + pbId + '-' + i + '">';
      h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why it fits:</b> ' + esc(t.reason) + '</div>';
      if (t.validation === 'ETF_PROXY') h += '<div style="margin-bottom:4px;color:#807868">This is an ETF sector proxy, not a company-level Helix-validated pick.</div>';
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Technology portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=technology&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      if (!t.cik && t.ticker) h += '<a class="eos-target-link" href="company-portal.html?company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      h += '</div>';
      h += '</div>';
    }

    h += '</div>'; // close section body
    h += '</div>'; // close targets
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1: MONEY SUMMARY
  // ══════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM EXPLANATION — plain-language story for each mechanism
  // ══════════════════════════════════════════════════════════════════════

  // Per-diagnosis, per-mechanism: WHY THIS MATTERS + COMMERCIAL MOVE
  // Plain-English explanations: assume the reader is a smart operator, not a security expert.
  var MECH_EXPLAIN = {
    'CYBER_ATTACK': {
      'cyber_threat':      { why: 'Attackers are getting in faster than defenders can detect them. The average company takes weeks or months to notice a breach, and ransomware crews now publish stolen data within 24 hours of getting in. This means every day a customer goes without modern detection-and-response tooling is a day they could be quietly losing data, money, or both. The buyers (CISOs and security directors) feel this in their bones — they have a budget, they have boards demanding answers, and they need a vendor who can show up tomorrow and start cutting risk.', move: 'Build a detection-and-response service or platform that gets a customer from "we have no idea what\u2019s happening on our endpoints" to "we can see and contain attacks in minutes." Sell to CISOs at mid-market companies (200-5000 employees) who can\u2019t staff a 24/7 SOC themselves. Charge $50-$200 per endpoint per year, or $100K-$500K per year for a managed service.' },
      'data_privacy':      { why: 'Every successful breach now triggers regulator phone calls, state attorney general notifications, customer churn, and class-action lawsuits. The cost of a breach is no longer just the cleanup — it\u2019s the months of legal exposure that follow. Companies that haven\u2019t mapped where their sensitive data lives, who can access it, and how it moves, are walking into preventable disasters. Tools that find sensitive data and lock it down before it gets stolen are now considered table stakes by enterprise buyers.', move: 'Build a "data security posture management" (DSPM) tool that scans cloud accounts, finds sensitive data (customer PII, secrets, regulated data), and tells the customer who has access and what the risk is. Sell to CISOs and CPOs at companies with cloud-heavy workloads. Pricing: $50K-$500K per year based on data volume.' },
      'infra_resilience':  { why: 'When a cyber attack hits, the difference between a 4-hour outage and a 4-week outage is whether the company has practiced what they would do. Most companies have never run a full disaster recovery test, so when the real attack comes, they discover their backups are corrupted, their playbooks are out of date, and nobody knows who is in charge. The moment a board asks "are we ready for ransomware?" the buyer needs an answer.', move: 'Build a "cyber resilience tabletop" service that walks executive teams through a simulated ransomware attack and produces a gap report. Charge $25K-$150K per engagement. Or build software that automates failover and recovery testing. Sell to CTOs and CISOs.' },
      'supply_chain_risk': { why: 'Modern software is built from thousands of pieces that came from somewhere else. When one of those pieces (an open-source library, a vendor SDK, a build tool) gets compromised, every customer that depends on it is suddenly exposed. SolarWinds, Log4j, and the xz backdoor all proved that the supply chain is now the attack surface. Customers need to know what\u2019s in their software and what would happen if any one ingredient were compromised tomorrow.', move: 'Build a "software bill of materials" (SBOM) and supply-chain monitoring service that tracks every dependency in a customer\u2019s code, watches for vulnerabilities, and alerts when something dangerous shows up. Sell to engineering leaders and CISOs. Pricing: $10K-$100K per year based on repo count.' }
    },
    'AI_ALIGNMENT_FAILURE': {
      'ai_alignment':        { why: 'AI systems are now being deployed inside enterprises faster than anyone can verify they behave correctly. Models hallucinate, leak training data, generate toxic content, and fail in ways the developers never anticipated. Every company shipping AI into production needs a way to test it before it embarrasses them on live customers, and a way to keep watching it after deployment. The buyers (CTOs, heads of AI, CISOs) know they have a problem, they just don\u2019t know which vendor solves it best.', move: 'Build an AI evaluation and "red team" platform that lets a customer test their model against thousands of attack prompts and edge cases before shipping. Sell to AI labs, enterprise AI teams, and platform companies. Pricing: $25K-$500K per year based on model count and eval complexity.' },
      'regulatory_pressure': { why: 'The EU AI Act, NIST AI Risk Management Framework, and state-level AI laws are now creating real legal obligations for any company using AI in customer-facing or consequential decisions. Companies need documentation, model cards, bias audits, and incident reporting. Most companies have no idea where to start — they need a vendor who shows up with a checklist and a tool to fill it out.', move: 'Build an AI governance and compliance automation platform that tracks every model in use, generates the required documentation, and flags new regulations as they apply. Sell to legal teams, chief AI officers, and CISOs. Charge $50K-$300K per year.' },
      'compute_economics':   { why: 'Training and running AI models is expensive — sometimes the GPU bill alone exceeds the entire engineering payroll. Companies are looking at their cloud invoices and asking how to cut AI costs in half without cutting capability. Every dollar of unnecessary inference cost is a dollar that should go to product development.', move: 'Build a compute optimization service or platform that profiles a customer\u2019s AI workloads and tells them where they\u2019re wasting money (oversized GPUs, idle clusters, inefficient batching, suboptimal precision). Sell to AI/ML platform leads. Charge a percentage of savings (typically 20-30%) or a flat $50K-$250K per year.' }
    },
    'INFRASTRUCTURE_COLLAPSE': {
      'infra_resilience':  { why: 'Most companies run their entire business on a single cloud region, often a single availability zone, often depending on a single third-party vendor for some critical piece. When that piece fails (and it does fail, regularly) the whole business goes down. The CrowdStrike outage took down airlines, hospitals, and banks for a day. Customers need to know what depends on what, and what would actually happen if a single piece broke right now.', move: 'Build a dependency mapping and resilience audit service that walks through a customer\u2019s production architecture and produces a real "what would break" report with prioritized fixes. Charge $25K-$150K per audit. Or build software that continuously monitors for single points of failure.' },
      'supply_chain_risk': { why: 'The "stack" most companies depend on is hundreds of vendors deep — each one is a potential outage source. When one of them has a bad day, the customer\u2019s system has a bad day. Most companies can\u2019t even list all their vendors, much less monitor them. A vendor health dashboard turns a fire drill into a planned response.', move: 'Build a vendor and SaaS monitoring platform that watches the status pages and incident feeds of every third-party service a customer depends on, and alerts the engineering team when something they rely on goes down. Charge $15K-$75K per year per customer.' },
      'dev_velocity':      { why: 'When the infrastructure is fragile, engineers spend their time fighting fires instead of shipping features. Every incident drains the team and pushes the roadmap back a week. Customers (engineering leaders) feel this directly — their velocity metrics drop, their best people start interviewing elsewhere. They need a way to make incidents shorter and rarer.', move: 'Build an incident management platform that helps teams declare, manage, and review incidents with structured postmortems. Sell to VPs of Engineering and SRE leads. Charge $25K-$200K per year.' }
    },
    'DATA_BREACH': {
      'data_privacy':        { why: 'Breaches are public the day they happen — customers find out, regulators find out, journalists find out. The window between a breach happening and the company having to talk about it publicly is now measured in days, not months. Every company needs a "ready response" capability before something bad happens, not after.', move: 'Build an incident response retainer service that\u2019s on standby for customers, ready to deploy investigators within hours. Charge $25K-$150K per year for the retainer plus hourly billing during an actual incident.' },
      'cyber_threat':        { why: 'Most breaches start with a stolen password. Credential theft is now the single largest entry point for attackers. Companies that haven\u2019t enforced phishing-resistant multi-factor authentication and continuous identity monitoring are walking into preventable breaches.', move: 'Build an "identity threat detection and response" service that monitors for stolen credentials on the dark web, anomalous logins, and identity-based attacks. Sell to CISOs. Charge $50K-$300K per year.' },
      'regulatory_pressure': { why: 'After a breach, the legal clock starts immediately. The SEC now requires public companies to disclose material breaches within four business days. State AGs require notification within 30-60 days. GDPR requires 72 hours. Customers get sued, regulators get fined, executives lose their jobs. Companies need a workflow that makes compliance with these rules automatic.', move: 'Build a breach response and disclosure automation platform that knows every notification rule in every jurisdiction the customer operates in, and produces the required filings and notifications on time. Charge $50K-$250K per year.' }
    },
    'CHIP_SHORTAGE': {
      'supply_chain_risk':   { why: 'GPU and advanced semiconductor capacity is the bottleneck on every AI roadmap right now. Companies can\u2019t get the chips they need on the timelines they need them, and the few suppliers that exist (TSMC, ASML, Nvidia) have effectively unlimited pricing power. A customer who can secure capacity has a real advantage; a customer who can\u2019t is at the mercy of whatever scraps remain.', move: 'Build a compute capacity brokerage that aggregates GPU availability across providers (AWS, GCP, CoreWeave, Lambda, Voltage Park) and helps customers reserve and schedule the cheapest available capacity. Charge a 5-15% margin on the underlying compute.' },
      'compute_economics':   { why: 'Every dollar spent on inefficient inference is a dollar not spent on growth. Customers are running models with 10x more capacity than they need, with batch sizes that don\u2019t fit the workload, with precision settings designed for training instead of serving. There is enormous slack in every AI workload waiting to be optimized.', move: 'Build an inference optimization platform that uses quantization, batching, KV cache reuse, and model distillation to cut inference cost by 30-70% without changing the model interface. Sell to AI platform teams. Charge a percentage of savings or $100K-$500K per year.' },
      'regulatory_pressure': { why: 'CHIPS Act allocations and export controls are reshaping who can buy what and where things can be made. Companies in the semiconductor or AI compute space need to know what\u2019s legal where, what subsidies they qualify for, and how the rules will change next quarter. Compliance is no longer a back-office concern — it shapes product roadmaps.', move: 'Build a compliance and export-control tracking service for semiconductor and AI compute companies. Charge $25K-$150K per year per customer.' }
    },
    'PLATFORM_MONOPOLY': {
      'platform_lockin':     { why: 'Big-tech platforms have spent a decade locking customers in — proprietary APIs, walled gardens, exclusive deals. Now the EU Digital Markets Act and US antitrust enforcement are forcing them to open up, and customers suddenly have a window to escape the lock-in they didn\u2019t even realize was there. The companies that move first will save tens of millions in vendor fees.', move: 'Build an interoperability layer that lets a customer move data, identity, or workflows between previously incompatible platforms. Sell to enterprise IT leaders looking to reduce vendor concentration. Charge $50K-$500K per year.' },
      'regulatory_pressure': { why: 'Antitrust cases against Google, Apple, Meta, and Amazon are reshaping what platforms can and cannot do. App store rules are changing. Default-search deals are being unwound. Self-preferencing is being outlawed. Customers (anyone who depends on these platforms for distribution) need to know what\u2019s coming and how to plan around it.', move: 'Build a regulatory monitoring service for platform-dependent businesses. Track every case, ruling, and policy change, and tell customers what it means for their distribution and revenue. Charge $25K-$100K per year.' },
      'open_source_risk':    { why: 'Open source is the obvious alternative when big-tech platforms get hostile, but open source brings its own governance load — license compliance, contributor agreements, vulnerability tracking, supply chain risk. Companies that adopt open source without a governance program quickly accumulate hidden risk.', move: 'Build an open-source governance service that helps customers track every open-source dependency, license, vulnerability, and contributor obligation. Sell to engineering leaders and legal teams. Charge $25K-$150K per year.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn't exist
  // Plain-English: each entry should make sense to someone who is not a security expert.
  var MECH_FALLBACK = {
    'cyber_threat':        { why: 'The threat surface is growing faster than any defense team can keep up with. Every new system, every new vendor, every new employee is another way in. Customers need help keeping the perimeter visible and the response fast.', move: 'Build a managed detection and response service or product, and sell it to CISOs who need 24/7 coverage they can\u2019t staff internally.' },
    'ai_alignment':        { why: 'AI systems are being deployed faster than anyone can verify they\u2019re safe. Customers shipping AI into production need a way to test, evaluate, and monitor their models before something embarrassing happens.', move: 'Build an AI evaluation and red-team platform and sell to AI teams and enterprise AI buyers.' },
    'infra_resilience':    { why: 'Most production systems are one bad day away from a major outage. Customers need to find their single points of failure before the failure finds them.', move: 'Build a resilience testing and chaos engineering platform and sell to platform teams and SREs.' },
    'data_privacy':        { why: 'Sensitive data is everywhere — in databases, in cloud buckets, in spreadsheets, in chat logs. Customers need to know where it lives and who has access before regulators come asking.', move: 'Build a data security posture management (DSPM) platform and sell to CPOs and CISOs.' },
    'supply_chain_risk':   { why: 'Software supply chains are deep and opaque. A vulnerability in any dependency can compromise everything downstream. Customers need a clear inventory and live monitoring.', move: 'Build a software bill of materials and supply chain security platform and sell to CISOs and DevSecOps leads.' },
    'platform_lockin':     { why: 'Customers are locked into platforms they didn\u2019t realize they were locked into. Antitrust enforcement is creating an exit window — but only for customers who plan ahead.', move: 'Build an interoperability or vendor lock-in mitigation service and sell to enterprise IT.' },
    'dev_velocity':        { why: 'Engineering velocity is the heart of the business, and it\u2019s eroding under compliance load, incident churn, and tooling sprawl. Customers need to make their engineers faster and happier.', move: 'Build a developer experience or engineering analytics platform and sell to VPs of Engineering.' },
    'open_source_risk':    { why: 'Open source is now central to enterprise software, but governance lags adoption. Customers need to know what they\u2019re running, who licensed it, and what the risk is.', move: 'Build an OSS governance and SBOM platform and sell to engineering leaders.' },
    'compute_economics':   { why: 'GPU and cloud bills are eating product margins. Customers need to find waste and cut it without losing capability.', move: 'Build an inference and compute cost optimization platform and sell to AI platform leads.' },
    'regulatory_pressure': { why: 'Tech regulation is expanding across every jurisdiction at once. Customers need to track what applies to them and what\u2019s coming next.', move: 'Build a regulatory monitoring and compliance automation service and sell to legal and compliance teams.' }
  };

  /**
   * Render the mechanism explanation block for a promoted directive.
   * Shows: mechanism badge, WHY THIS MATTERS, COMMERCIAL MOVE.
   * Returns empty string if no mechanism classified.
   */
  function renderMechanismBlock(opp, style) {
    if (!opp || !opp._mechanism || !opp._mechanism.primary) return '';

    var mech = opp._mechanism;
    var dxId = (opp.diagnosisId || '').toUpperCase();
    var dxExplains = MECH_EXPLAIN[dxId] || {};
    var explain = dxExplains[mech.primary] || MECH_FALLBACK[mech.primary] || null;
    if (!explain) return '';

    var borderColor = style === 'deep' ? 'rgba(74,143,212,0.2)' : 'rgba(201,169,78,0.2)';
    var labelColor = style === 'deep' ? 'rgba(74,143,212,0.8)' : 'rgba(201,169,78,0.8)';
    var bgColor = style === 'deep' ? 'rgba(74,143,212,0.02)' : 'rgba(201,169,78,0.02)';

    var h = '<div style="margin:8px 0;padding:8px 10px;border:1px solid ' + borderColor + ';border-radius:3px;background:' + bgColor + '">';
    h += '<div style="font-size:0.24rem;letter-spacing:1.5px;color:' + labelColor + ';font-weight:600;margin-bottom:4px">MECHANISM \u00b7 ' + esc(mech.primaryLabel || mech.primary).toUpperCase() + '</div>';
    h += '<div style="font-size:0.34rem;color:#d0c8b8;line-height:1.6;margin-bottom:4px"><b style="color:#e0daca">Why this matters:</b> ' + esc(explain.why) + '</div>';
    h += '<div style="font-size:0.34rem;color:#5ab5a0;line-height:1.6"><b style="color:#6ec5b0">Commercial move:</b> ' + esc(explain.move) + '</div>';
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEEP INTELLIGENCE — renders expandable child portal metadata
  // ══════════════════════════════════════════════════════════════════════

  var _deepToggleCounter = 0;

  /**
   * Render an expandable "Deep Intelligence" section for a promoted directive.
   * Uses _deepIntel metadata from the translator.
   *
   * @param {Object} opp - opportunity with _deepIntel field
   * @param {string} label - toggle button label (default "DEEP INTELLIGENCE")
   * @returns {string} HTML string (collapsed by default)
   */
  function renderDeepIntel(opp, label) {
    if (!opp || !opp._deepIntel) return '';
    var di = opp._deepIntel;

    // Check if there's anything to show
    var hasContent = di.monitoring || di.escalation || (di.citations && di.citations.length > 0) || di.cite || di.targetPathway;
    if (!hasContent) return '';

    var toggleId = 'deep-' + (++_deepToggleCounter);
    label = label || 'DEEP INTELLIGENCE';

    var h = '';
    h += '<button class="eos-deep-toggle" onclick="var b=document.getElementById(\'' + toggleId + '\');b.classList.toggle(\'open\');this.textContent=b.classList.contains(\'open\')?\'\u25BC ' + label + '\':\'\u25B6 ' + label + '\'">\u25B6 ' + label + '</button>';
    h += '<div class="eos-deep-body" id="' + toggleId + '">';

    // MONITORING
    if (di.monitoring) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">MONITORING PROTOCOL</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.monitoring === 'string' ? di.monitoring : JSON.stringify(di.monitoring)) + '</div>';
      h += '</div>';
    }

    // ESCALATION
    if (di.escalation) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">IF THIS FAILS</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.escalation === 'string' ? di.escalation : JSON.stringify(di.escalation)) + '</div>';
      h += '</div>';
    }

    // TARGET PATHWAY
    if (di.targetPathway) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">STRATEGY PATH</div>';
      h += '<div class="eos-deep-text">' + esc(di.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</div>';
      h += '</div>';
    }

    // CITATIONS
    if (di.citations && di.citations.length > 0) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">SOURCES (' + di.citations.length + ')</div>';
      for (var ci = 0; ci < di.citations.length; ci++) {
        var c = di.citations[ci];
        var citeStr = '';
        if (typeof c === 'string') { citeStr = c; }
        else {
          citeStr = (c.author || '') + ' (' + (c.year || '') + '). ' + (c.title || '') + '. ' + (c.journal || '');
          if (c.doi) citeStr += ' doi:' + c.doi;
        }
        h += '<div class="eos-deep-cite">' + esc(citeStr) + '</div>';
      }
      h += '</div>';
    } else if (di.cite) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">SOURCES</div>';
      h += '<div class="eos-deep-cite">' + esc(di.cite) + '</div>';
      h += '</div>';
    }

    // PORTAL LINEAGE
    if (di.ancestryPath && di.ancestryPath.length > 0) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">PORTAL LINEAGE</div>';
      h += '<div class="eos-deep-text">' + di.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ') + ' (L' + (di.depth || '?') + ')</div>';
      h += '</div>';
    }

    // SOURCE PORTAL — tries HTML first, falls back to API branch loading
    if (di.portalDomainId || (di.ancestryPath && di.ancestryPath.length > 0)) {
      var _pid = di.portalDomainId || di.ancestryPath[di.ancestryPath.length - 1];
      h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + esc(_pid) + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + esc(_pid) + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>';
    }

    h += '</div>'; // close deep body
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DRILL DEEPER BRANCH RESEARCH — on-demand omitted branch exploration
  // ══════════════════════════════════════════════════════════════════════

  var _branchIndex = null;
  var _branchIndexFailed = false;

  function _loadBranchIndex() {
    if (_branchIndex) return Promise.resolve(_branchIndex);
    if (_branchIndexFailed) return Promise.resolve(null);
    return fetch('/assets/data/deep/technology-branch-index.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { _branchIndex = data; return data; })
      .catch(function () { _branchIndexFailed = true; return null; });
  }

  function renderDrillDeeper(opp) {
    if (!opp || !opp._omittedSiblingCount || opp._omittedSiblingCount <= 0) return '';
    var dir = opp._directive || {};
    var drillId = 'drill-' + (++_deepToggleCounter);
    var h = '';
    h += '<div style="margin-top:6px">';
    h += '<button class="eos-deep-toggle" data-drill-id="' + drillId + '" data-node="' + esc(dir.nodeId || opp.nodeId || '') + '" data-ancestry="' + esc((dir.ancestryPath || opp.ancestryPath || []).join(',')) + '" style="color:rgba(74,143,212,0.8);border-color:rgba(74,143,212,0.25)">';
    h += '\u{1F50D} DRILL DEEPER \u00b7 ' + opp._omittedSiblingCount + ' related branches</button>';
    h += '<div id="' + drillId + '" class="eos-deep-body" style="max-height:400px;overflow-y:auto"></div>';
    h += '</div>';
    return h;
  }

  function _handleDrillClick(drillId, nodeId, ancestryStr) {
    var container = document.getElementById(drillId);
    if (!container) return;
    if (container.classList.contains('open')) { container.classList.remove('open'); return; }
    container.innerHTML = '<div style="color:#807868;padding:8px">Loading branch index\u2026</div>';
    container.classList.add('open');

    _loadBranchIndex().then(function (idx) {
      if (!idx || !idx.branches) { container.innerHTML = '<div style="color:#807868;padding:8px">Branch index unavailable</div>'; return; }
      var ancestry = ancestryStr ? ancestryStr.split(',') : [];
      var ancestryRoot = ancestry.length >= 2 ? ancestry[1] : '';

      // Filter: same node preferred, same ancestry family, sorted by richness
      var relevant = [];
      for (var i = 0; i < idx.branches.length; i++) {
        var b = idx.branches[i];
        var score = 0;
        if (b.nodeId === nodeId) score += 10;
        if (ancestryRoot && b.ancestryPath && b.ancestryPath.length >= 2 && b.ancestryPath[1] === ancestryRoot) score += 5;
        if (b.parentBranch && ancestry.indexOf(b.parentBranch) !== -1) score += 3;
        if (score > 0) { b._relevance = score + (b.richness || 0); relevant.push(b); }
      }
      relevant.sort(function (a, b) { return b._relevance - a._relevance; });
      relevant = relevant.slice(0, 20);

      if (relevant.length === 0) { container.innerHTML = '<div style="color:#807868;padding:8px">No closely related branches found</div>'; return; }

      var h = '';
      for (var ri = 0; ri < relevant.length; ri++) {
        var br = relevant[ri];
        var badges = '';
        if (br.hasMonitoring) badges += '<span style="color:rgba(74,143,212,0.7);margin-right:4px">monitoring</span>';
        if (br.hasCitations) badges += '<span style="color:rgba(90,181,160,0.7);margin-right:4px">citations</span>';
        if (br.hasEscalation) badges += '<span style="color:rgba(201,169,78,0.7);margin-right:4px">escalation</span>';

        h += '<div style="padding:6px 8px;margin-bottom:4px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div>';
        h += '<div style="font-size:0.32rem;color:#c0b8a5">' + esc(br.treatmentLabel) + '</div>';
        h += '<div style="font-size:0.24rem;color:#807868">' + esc(br.portalDomainId) + ' \u00b7 L' + br.depth + ' \u00b7 ' + esc(br.nodeId) + '</div>';
        h += '<div style="font-size:0.22rem;margin-top:2px">' + badges + '</div>';
        h += '</div>';
        h += '<button class="eos-deep-toggle" data-load-branch="' + esc(br.portalDomainId) + '" style="font-size:0.22rem;white-space:nowrap">LOAD BRANCH</button>';
        h += '</div>';
        h += '<div id="branch-content-' + esc(br.portalDomainId) + '" style="display:none;margin-top:6px;padding:6px;border-top:1px solid rgba(74,143,212,0.1)"></div>';
        h += '</div>';
      }
      container.innerHTML = h;
    });
  }

  function _handleLoadBranch(portalDomainId) {
    var contentEl = document.getElementById('branch-content-' + portalDomainId);
    if (!contentEl) return;
    if (contentEl.style.display !== 'none') { contentEl.style.display = 'none'; return; }
    contentEl.style.display = 'block';
    contentEl.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading ' + portalDomainId + '\u2026</div>';

    fetch('/assets/data/domains/' + encodeURIComponent(portalDomainId) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(portalDomainId)); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var h = '';
        var acts = data.activations || [];
        for (var ai = 0; ai < acts.length; ai++) {
          var a = acts[ai];
          for (var ti = 0; ti < (a.treatments || []).length; ti++) {
            var t = a.treatments[ti];
            if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue;
            h += '<div style="margin-bottom:8px">';
            h += '<div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>';
            if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>';
            if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>';
            if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>';
            h += '</div>';
            break; // Best treatment per activation
          }
        }
        if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content in this branch</div>';
        h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + pid + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + pid + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>';
        contentEl.innerHTML = h;
      })
      .catch(function () { contentEl.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load branch</div>'; });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PORTAL SOURCE — tries HTML first, falls back to API branch loading
  // ══════════════════════════════════════════════════════════════════════
  function _handlePortalSource(pid) {
    fetch('/' + pid + '_portal.html', { method: 'HEAD' }).then(function (r) {
      if (r.ok || r.status === 308) { window.open('/' + pid + '_portal.html', '_blank'); }
      else { _loadBranchInline(pid); }
    }).catch(function () { _loadBranchInline(pid); });
  }
  function _loadBranchInline(pid) {
    var el = document.getElementById('portal-inline-' + pid);
    if (el && el.style.display !== 'none') { el.style.display = 'none'; return; }
    if (el) { el.style.display = 'block'; el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading source portal\u2026</div>'; }
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
      var h = _renderBranchContent(data);
      if (el) { el.innerHTML = h; } else {
        var ov = document.createElement('div'); ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,16,0.7);z-index:9998'; ov.onclick = function(){ov.remove()};
        ov.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0e1018;border:1px solid rgba(74,143,212,0.3);border-radius:4px;padding:16px 20px;max-width:600px;max-height:80vh;overflow-y:auto;z-index:9999"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:0.28rem;letter-spacing:2px;color:rgba(74,143,212,0.7)">SOURCE: '+pid+'</span><button onclick="this.closest(\'div\').parentNode.remove()" style="background:none;border:none;color:#908878;cursor:pointer;font-size:0.4rem">\u2715</button></div>'+h+'</div>';
        document.body.appendChild(ov);
      }
    }).catch(function () { if (el) el.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load</div>'; });
  }
  function _renderBranchContent(data) {
    var h = ''; for (var ai = 0; ai < (data.activations || []).length; ai++) { var a = data.activations[ai]; for (var ti = 0; ti < (a.treatments || []).length; ti++) { var t = a.treatments[ti]; if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue; h += '<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>'; if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>'; if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>'; if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>'; h += '</div>'; break; } }
    if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ANCHOR DIRECTIVE — top promoted directive displayed with extreme clarity
  // ══════════════════════════════════════════════════════════════════════

  function renderAnchorDirective(state) {
    var opps = state.opportunities || [];

    // Find the best proof-quality promoted directive for the anchor.
    // Must be economically relevant + rich + high rank.
    var anchor = null;
    var bestProofScore = -1;
    var hasActiveDx = (state.diagnoses || []).some(function (d) { return d.active; });
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      if (o.source !== 'portal_directive' || !o._directive) continue;
      var econRel = (o.scores && o.scores.econRelevance != null) ? o.scores.econRelevance : 0.5;
      if (hasActiveDx && econRel < 0.3) continue;
      // Compute display priority: rank + richness + econ alignment
      var displayScore = (o.rank || 0) * 0.35 + (o._richness || 0) * 0.10 + (o._stepsArePortalNative ? 0.12 : 0) + econRel * 0.15;
      if (o._deepIntel && o._deepIntel.monitoring) displayScore += 0.08;
      if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) displayScore += 0.08;
      if (displayScore > bestProofScore) {
        bestProofScore = displayScore;
        anchor = o;
      }
    }

    if (!anchor) return ''; // No promoted directives — don't render

    var mc = anchor.moneyChain || {};
    var dir = anchor._directive || {};
    var companies = anchor.examples || [];
    var steps = anchor.steps || [];

    var h = '<div class="eos-anchor">';

    // Label + mechanism badge
    h += '<div class="eos-anchor-label">TOP DIRECTIVE \u2014 ACTION NOW';
    if (anchor._mechanism && anchor._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(90,181,160,0.3);border-radius:2px;color:#5ab5a0;font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(anchor._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';

    // Title
    h += '<div class="eos-anchor-title">' + esc(anchor.title) + '</div>';

    // Plain English explanation
    var explain = anchor.explain || mc.doThis || '';
    if (explain) {
      h += '<div class="eos-anchor-explain">' + esc(explain) + '</div>';
    }

    // Mechanism explanation — shock → mechanism → money
    h += renderMechanismBlock(anchor, 'anchor');

    // 2x2 grid: WHAT TO DO | WHO TO TARGET | HOW MONEY IS MADE | DELIVERABLE
    h += '<div class="eos-anchor-grid">';

    // WHAT TO DO
    h += '<div class="eos-anchor-block">';
    var stepsLabel = anchor._stepsArePortalNative ? 'WHAT TO DO \u00b7 PORTAL-DERIVED' : 'WHAT TO DO \u00b7 OPERATOR SYNTHESIS';
    h += '<div class="eos-anchor-block-label">' + stepsLabel + '</div>';
    h += '<div class="eos-anchor-block-text">';
    if (steps.length > 0) {
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var stepText = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        h += '<div class="eos-anchor-step"><b>' + (si + 1) + '.</b> ' + esc(stepText) + '</div>';
      }
    } else if (mc.doThis) {
      h += esc(mc.doThis);
    } else {
      h += esc(anchor.action || 'Execute via operator pathway');
    }
    h += '</div></div>';

    // WHO TO TARGET — uses resolved tiered targeting if available
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">WHO TO TARGET</div>';
    h += '<div class="eos-anchor-block-text">';
    var rt = anchor._resolvedTargets;
    if (rt) {
      // Tier 2 — entity classes (always shown)
      if (rt.tier2 && rt.tier2.length > 0) {
        for (var t2i = 0; t2i < rt.tier2.length; t2i++) {
          h += '<div style="padding:2px 0;color:#d0c8b8">\u25B8 ' + esc(rt.tier2[t2i].label) + '</div>';
        }
      }
      // Tier 1 — verified entities
      if (rt.tier1 && rt.tier1.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(201,169,78,0.7);letter-spacing:1px">VERIFIED</div>';
        for (var t1i = 0; t1i < rt.tier1.length; t1i++) {
          h += '<div style="padding:1px 0;color:#e0daca">' + esc(rt.tier1[t1i].name) + (rt.tier1[t1i].ticker ? ' <span style="color:#C9A94E">(' + esc(rt.tier1[t1i].ticker) + ')</span>' : '') + '</div>';
        }
      }
      // Tier 3 — example entities
      if (rt.tier3 && rt.tier3.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(90,181,160,0.6);letter-spacing:1px">ALSO CONSIDER</div>';
        for (var t3i = 0; t3i < Math.min(rt.tier3.length, 4); t3i++) {
          h += '<div style="padding:1px 0;color:#b0a898">' + esc(rt.tier3[t3i].name) + (rt.tier3[t3i].ticker ? ' (' + esc(rt.tier3[t3i].ticker) + ')' : '') + '</div>';
        }
      }
      // Execution targets
      if (rt.executionTargets && rt.executionTargets.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.28rem;color:#908878">Execute via: ' + rt.executionTargets.join(', ') + '</div>';
      }
    } else {
      // Fallback to old display
      if (companies.length > 0) {
        for (var ci = 0; ci < Math.min(companies.length, 5); ci++) {
          h += '<div style="padding:1px 0">' + esc(companies[ci]) + '</div>';
        }
      }
      if (mc.target) h += '<div style="margin-top:3px;color:#a09888;font-size:0.30rem">' + esc(mc.target) + '</div>';
      if (!companies.length && !mc.target) h += 'See mapped companies in action queue';
    }
    h += '</div></div>';

    // HOW MONEY IS MADE
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">HOW MONEY IS MADE</div>';
    h += '<div class="eos-anchor-block-text">';
    if (mc.whyPays) h += esc(mc.whyPays);
    else h += esc(anchor.outcome || anchor.valueRange || 'See monetization path in expanded view');
    h += '</div></div>';

    // DELIVERABLE + TIMING
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">DELIVERABLE &middot; TIMING</div>';
    h += '<div class="eos-anchor-block-text">';
    if (anchor._shapedDeliverable) h += '<div style="margin-bottom:4px"><b style="color:#d0c8b8">Produce:</b> ' + esc(anchor._shapedDeliverable) + '</div>';
    if (mc.nextStep) h += '<div style="margin-bottom:3px"><b style="color:#5ab5a0">Next:</b> ' + esc(mc.nextStep) + '</div>';
    if (mc.timing) h += '<div><b style="color:#C9A94E">Window:</b> ' + esc(mc.timing) + '</div>';
    if (anchor.valueRange) h += '<div style="margin-top:2px;color:#5ab5a0">' + esc(anchor.valueRange) + '</div>';
    h += '</div></div>';

    h += '</div>'; // close grid

    // Traceability lineage
    // ── SOURCE INTELLIGENCE PROOF BLOCK ──
    h += '<div style="margin-top:8px;padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:2px;background:rgba(74,143,212,0.02);font-size:0.28rem">';
    h += '<div style="color:rgba(74,143,212,0.7);letter-spacing:1.5px;font-weight:600;margin-bottom:4px">SOURCE INTELLIGENCE</div>';
    var depthStr = dir.depth != null ? 'L' + dir.depth : 'L0';
    var richStr = anchor._richness || 0;
    var nativeStr = anchor._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';
    var deepFields = [];
    if (anchor._deepIntel) {
      if (anchor._deepIntel.monitoring) deepFields.push('monitoring');
      if (anchor._deepIntel.escalation) deepFields.push('escalation');
      if (anchor._deepIntel.citations && anchor._deepIntel.citations.length > 0) deepFields.push(anchor._deepIntel.citations.length + ' citations');
      if (anchor._deepIntel.targetPathway) deepFields.push('strategy path');
    }
    h += '<div style="color:#b0a898;line-height:1.6">';
    h += '<span style="color:#d0c8b8">Depth:</span> ' + depthStr + ' &middot; ';
    h += '<span style="color:#d0c8b8">Steps:</span> ' + nativeStr + ' &middot; ';
    h += '<span style="color:#d0c8b8">Richness:</span> ' + richStr + '/5';
    if (deepFields.length > 0) h += ' &middot; <span style="color:#d0c8b8">Has:</span> ' + deepFields.join(', ');
    if (dir.portalTitle) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalTitle) + ' (' + depthStr + ')';
    if (dir.ancestryPath && dir.ancestryPath.length > 1) h += '<br><span style="color:#d0c8b8">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    h += '</div></div>';

    // Deep Intelligence expandable section
    h += renderDeepIntel(anchor, 'DEEP INTELLIGENCE');
    h += renderDrillDeeper(anchor);

    var lineageParts = [];
    if (anchor.diagnosisId) lineageParts.push(esc((anchor.diagnosisId || '').replace(/_/g, ' ')));
    if (dir.nodeLabel) lineageParts.push(esc(dir.nodeLabel));
    if (dir.portalTitle) lineageParts.push(esc(dir.portalTitle));
    if (dir.depth != null) lineageParts.push('L' + dir.depth);
    if (dir.rankScore != null) lineageParts.push('score ' + dir.rankScore);
    if (lineageParts.length > 0) {
      h += '<div class="eos-anchor-lineage">\u25B8 ' + lineageParts.join(' \u2192 ') + '</div>';
    }

    h += '</div>'; // close anchor card
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEEP PROOF BLOCK — deepest high-quality promoted directive (L2+)
  // ══════════════════════════════════════════════════════════════════════

  function renderDeepProofBlock(state) {
    var opps = state.opportunities || [];

    // Find the best L2+ promoted directive
    var deep = null;
    var bestScore = -1;
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      if (o.source !== 'portal_directive' || !o._directive) continue;
      var depth = (o._directive.depth != null) ? o._directive.depth : 0;
      if (depth < 2) continue;
      var score = depth * 0.2 + (o._richness || 0) * 0.15 + (o._stepsArePortalNative ? 0.2 : 0) + (o.rank || 0) * 0.3;
      if (o._deepIntel && o._deepIntel.monitoring) score += 0.1;
      if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) score += 0.1;
      if (score > bestScore) { bestScore = score; deep = o; }
    }

    if (!deep) return ''; // No L2+ directive — hide block cleanly

    var dir = deep._directive || {};
    var mc = deep.moneyChain || {};
    var di = deep._deepIntel || {};
    var steps = deep.steps || [];
    var depthStr = 'L' + (dir.depth || '?');
    var nativeStr = deep._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';

    var h = '<div class="eos-deepproof">';

    // Label
    h += '<div class="eos-deepproof-label">DEEP PROOF \u2014 FRACTAL INTELLIGENCE';
    if (deep._mechanism && deep._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(74,143,212,0.3);border-radius:2px;color:rgba(74,143,212,0.9);font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(deep._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';

    // Title
    h += '<div class="eos-deepproof-title">' + esc(deep.title) + '</div>';

    // Why this is from deeper intelligence
    h += '<div class="eos-deepproof-why">Deepest high-quality directive from ';
    if (deep.diagnosisId) h += esc(deep.diagnosisId.replace(/_/g, ' '));
    h += ' branch. Depth ' + depthStr;
    if (dir.portalTitle) h += ' via ' + esc(dir.portalTitle);
    h += '. Deeper portal layers reveal more specific, actionable treatment protocols than the top-level brain.</div>';

    // Mechanism explanation — shock → mechanism → money
    h += renderMechanismBlock(deep, 'deep');

    // Steps (compact)
    if (steps.length > 0) {
      h += '<div class="eos-deepproof-steps">';
      h += '<div style="font-size:0.24rem;letter-spacing:1px;color:rgba(74,143,212,0.6);margin-bottom:3px">STEPS \u00b7 ' + nativeStr.toUpperCase() + '</div>';
      for (var si = 0; si < Math.min(steps.length, 4); si++) {
        var st = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        h += '<div><b>' + (si + 1) + '.</b> ' + esc(st) + '</div>';
      }
      h += '</div>';
    }

    // Source Intelligence proof
    h += '<div style="padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:2px;background:rgba(74,143,212,0.02);font-size:0.28rem;margin-bottom:6px">';
    h += '<div style="color:rgba(74,143,212,0.7);letter-spacing:1.5px;font-weight:600;margin-bottom:3px">SOURCE INTELLIGENCE</div>';
    h += '<div style="color:#b0a898;line-height:1.6">';
    h += '<span style="color:#d0c8b8">Depth:</span> ' + depthStr + ' &middot; ';
    h += '<span style="color:#d0c8b8">Steps:</span> ' + nativeStr + ' &middot; ';
    h += '<span style="color:#d0c8b8">Richness:</span> ' + (deep._richness || 0) + '/5';
    var deepFields = [];
    if (di.monitoring) deepFields.push('monitoring');
    if (di.escalation) deepFields.push('escalation');
    if (di.citations && di.citations.length > 0) deepFields.push(di.citations.length + ' citations');
    if (di.targetPathway) deepFields.push('strategy path');
    if (deepFields.length > 0) h += ' &middot; <span style="color:#d0c8b8">Has:</span> ' + deepFields.join(', ');
    if (dir.portalTitle) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalTitle) + ' (' + depthStr + ')';
    if (dir.ancestryPath && dir.ancestryPath.length > 1) h += '<br><span style="color:#d0c8b8">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    h += '</div></div>';

    // Deep Intelligence expandable
    h += renderDeepIntel(deep, 'EXPAND DEEP INTELLIGENCE');

    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1: MONEY SUMMARY
  // ══════════════════════════════════════════════════════════════════════

  function buildMoneySummary(state) {
    var stress = state.stress || 0;
    var pct = Math.round(stress * 100);
    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var opps = state.opportunities || [];
    var pulse = state.pulse || null;
    var grantCount = opps.filter(function (o) { return o.path === 'GRANT-ELIGIBLE'; }).length;
    var investCount = opps.filter(function (o) { return o.path === 'INVESTABLE'; }).length;
    var patentCount = opps.filter(function (o) { return o.path === 'PATENTABLE'; }).length;

    // Pull live technology feed signals — CISA KEV adds, NVD critical CVEs, Krebs posts
    var feeds = state.feeds || [];
    var kevAdds = null, cveTotal = null, cveCritical = null, krebsPosts = null, hnTopics = null;
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      var f = feeds[fpi];
      if (!f.live) continue;
      var fn = (f.name || '').toLowerCase();
      if (fn.indexOf('cisa') !== -1 || fn.indexOf('kev') !== -1) kevAdds = f.value;
      if (fn.indexOf('nvd') !== -1) {
        cveTotal = f.value;
        var m = (f.label || '').match(/(\d+)\s*critical/i);
        if (m) cveCritical = parseInt(m[1], 10);
      }
      if (fn.indexOf('krebs') !== -1) krebsPosts = f.value;
      if (fn.indexOf('hacker news') !== -1) hnTopics = f.value;
    }

    var h = '';

    // Pulse freshness warning
    if (pulse) {
      var freshPct = Math.round(pulse.freshnessScore * 100);
      if (freshPct < 50) {
        h += '<div style="font-size:0.34rem;color:#e85454;padding:4px 8px;margin-bottom:8px;border:1px solid rgba(232,84,84,0.15);border-radius:2px;background:rgba(232,84,84,0.04)">\u26A0 Feed freshness at ' + freshPct + '% \u2014 some data may be stale. Confidence reduced.</div>';
      }
      // Blocked diagnoses warning
      var blocked = (pulse.validatedDiagnoses || []).filter(function (v) { return v.blocked; });
      if (blocked.length > 0) {
        h += '<div style="font-size:0.30rem;color:#C9A94E;padding:3px 8px;margin-bottom:6px;border-left:2px solid rgba(201,169,78,0.2)">' + blocked.length + ' diagnosis(es) blocked by evidence contract \u2014 insufficient live evidence to support activation.</div>';
      }
    }

    // ── Plain-English summary built from REAL technology feed data ──
    // Tone: assume the reader is a smart operator, NOT a security expert.
    // Lead with the cyber number that tells the clearest story.
    var text = '';

    // Lead with the strongest signal we have
    if (kevAdds !== null && kevAdds >= 25) {
      text = '<b>The U.S. cybersecurity agency added ' + kevAdds + ' actively-exploited vulnerabilities to its Known Exploited Vulnerabilities catalog in the last 30 days.</b> This is a sustained surge \u2014 attackers are weaponizing new bugs faster than defenders can patch them. Every enterprise CISO is now in catch-up mode. ';
    } else if (kevAdds !== null && kevAdds >= 10) {
      text = '<b>' + kevAdds + ' new actively-exploited vulnerabilities were added to the CISA KEV catalog in the last 30 days.</b> That\u2019s elevated activity \u2014 it means attackers are finding fresh ways in faster than usual. Patching teams are under pressure. ';
    } else if (kevAdds !== null) {
      text = '<b>' + kevAdds + ' new exploited vulnerabilities flagged by CISA in the last 30 days.</b> That\u2019s a normal background rate, but it never goes to zero. ';
    }

    // Layer in NVD critical CVE context
    if (cveTotal !== null) {
      text += '<b>' + cveTotal + ' new vulnerabilities</b> were published by NIST in the last 7 days';
      if (cveCritical !== null && cveCritical > 0) {
        text += ', including <b style="color:#e85454">' + cveCritical + ' rated critical</b>';
      }
      text += '. Every one of those is a potential opening into a customer environment. ';
    }

    // Krebs / Hacker News context
    if (krebsPosts !== null && krebsPosts >= 5) {
      text += 'Krebs on Security has published <b>' + krebsPosts + ' investigations</b> recently \u2014 the public discourse around breaches and incidents is loud right now. ';
    }

    // Hyperscaler / discourse signal
    if (hnTopics !== null && hnTopics >= 200) {
      text += 'Tech discourse on Hacker News is highly active (<b>' + hnTopics + '</b> top stories), which usually means the engineering community is reacting to something major. ';
    }

    // Tie back to active diagnoses
    if (activeDx.length > 0) {
      text += '<b>' + activeDx.length + ' active diagnosis ' + (activeDx.length > 1 ? 'pathways are' : 'pathway is') + ' currently confirmed by live evidence.</b> ';
    } else if (kevAdds !== null || cveTotal !== null) {
      text += 'No diagnosis pathways are currently active \u2014 the system is watching for signal escalation across the security stack. ';
    }

    // Fallback if no feeds at all
    if (!text) {
      text = '<b>Technology feeds loading.</b> Waiting for live cybersecurity, vulnerability, and discourse data. ';
      if (pulse && pulse.deadCount > 0) text += pulse.deadCount + ' source(s) offline. ';
      text += 'Assessments are provisional until live data arrives.';
    }

    // Pulse regime context
    if (pulse && pulse.regime === 'crisis') {
      text += ' <b style="color:#e85454">Regime: CRISIS.</b> Multiple positioning windows are open.';
    } else if (pulse && pulse.regime === 'elevated') {
      text += ' Regime: ELEVATED. Positioning windows may be forming.';
    }

    // Path counts
    var parts = [];
    if (grantCount > 0) parts.push(grantCount + ' grant path' + (grantCount > 1 ? 's' : ''));
    if (investCount > 0) parts.push(investCount + ' investment position' + (investCount > 1 ? 's' : ''));
    if (patentCount > 0) parts.push(patentCount + ' patent opportunit' + (patentCount > 1 ? 'ies' : 'y'));
    if (parts.length > 0) text += ' Currently showing <b>' + parts.join(', ') + '</b> ready for action.';

    // What changed (from pulse)
    if (pulse && pulse.deltas && pulse.deltas.length > 0) {
      h += '<div class="eos-summary">' + text + '</div>';
      h += '<div style="font-size:0.32rem;color:#908878;margin-bottom:10px;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.2)">';
      h += '<span style="font-size:0.26rem;letter-spacing:1.5px;color:rgba(90,181,160,0.5)">SINCE LAST CYCLE:</span> ';
      var deltaTexts = pulse.deltas.slice(0, 3).map(function (d) { return d.detail; });
      h += deltaTexts.join(' \u00b7 ');
      h += '</div>';
    } else {
      h += '<div class="eos-summary">' + text + '</div>';
    }

    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 2: TOP 3 MONEY PLAYS
  // ══════════════════════════════════════════════════════════════════════

  function buildTopPlays(state) {
    var opps = (state.opportunities || []).slice();
    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Exclude the #1 promoted directive — it's already shown as the Anchor Directive card
    var anchorId = null;
    for (var ai = 0; ai < opps.length; ai++) {
      if (opps[ai].source === 'portal_directive' && opps[ai]._directive) { anchorId = opps[ai].id; break; }
    }
    if (anchorId) opps = opps.filter(function (o) { return o.id !== anchorId; });
    var top = opps.slice(0, 3);

    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      var title = (o.title || '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      h += '<div class="eos-play">';
      h += '<span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(title) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      if (o.paths && o.paths.indexOf('BUSINESS') !== -1) h += ' <span class="eos-play-path" style="color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)">BUSINESS</span>';
      if (o.urgency === 'IMMEDIATE' || o.urgency === 'high') h += ' <span style="font-size:0.26rem;color:#e85454;letter-spacing:1px">URGENT</span>';
      h += promotedBadge(o);

      // Compensation strip
      var comp = o.compensation || {};
      h += '<div style="font-size:0.28rem;color:#5ab5a0;margin:3px 0">PAY: ' + (comp.base || 0) + (comp.unit || '%') + ' \u00b7 NEXT: ' + (comp.nextTier ? comp.nextTier.comp + (comp.unit || '%') : '?') + ' \u00b7 MAX: ' + (comp.maxTier ? comp.maxTier.comp + (comp.unit || '%') : '?') + '</div>';

      // WHY THIS MAKES MONEY — causal chain
      if (o.moneyChain) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        if (o.moneyChain.doThis) h += '<span style="color:#d0c8b8">Do this:</span> ' + esc(o.moneyChain.doThis) + '<br>';
        if (o.moneyChain.whyPays) h += '<span style="color:#d0c8b8">Why it pays:</span> ' + esc(o.moneyChain.whyPays) + '<br>';
        if (o.moneyChain.target) h += '<span style="color:#d0c8b8">Target:</span> ' + esc(o.moneyChain.target) + '<br>';
        if (o.moneyChain.timing) h += '<span style="color:#d0c8b8">Timing:</span> ' + esc(o.moneyChain.timing) + '<br>';
        if (o.moneyChain.evidence) h += '<span style="color:#d0c8b8">Evidence:</span> ' + esc(o.moneyChain.evidence);
        h += '</div>';
      } else {
        h += '<div class="eos-play-why">' + esc(o.explain || o.title) + '</div>';
      }
      // OUTCOME
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || o.outcome || 'See playbook detail') + '</div>';

      // Collapsible detail — VALIDATION + EXECUTION + FAILURE + GROUNDING
      if (o.explain || o.steps || o.failure) {
        h += '<div style="margin-top:6px;border-top:1px solid rgba(201,169,78,0.06);padding-top:4px">';
        h += '<details style="font-size:0.32rem;color:#908878">';
        h += '<summary style="cursor:pointer;color:rgba(201,169,78,0.5);font-size:0.26rem;letter-spacing:1.5px">DETAIL \u25BC</summary>';
        if (o.action) h += '<div style="margin:4px 0"><b style="color:#b0a898">ACTION:</b> ' + esc(o.action) + '</div>';
        if (o.trigger) h += '<div style="margin:4px 0"><b style="color:#b0a898">TRIGGER:</b> ' + esc(o.trigger) + '</div>';
        if (o.validation) h += '<div style="margin:4px 0"><b style="color:#b0a898">VALIDATION:</b> ' + esc(o.validation) + '</div>';
        if (o.steps && o.steps.length > 0) {
          h += '<div style="margin:4px 0"><b style="color:#b0a898">EXECUTION:</b></div>';
          for (var sti = 0; sti < o.steps.length; sti++) h += '<div style="padding-left:8px;color:#a09888">' + (sti + 1) + '. ' + esc(o.steps[sti]) + '</div>';
        }
        if (o.outcome) h += '<div style="margin:4px 0"><b style="color:#5ab5a0">OUTCOME:</b> ' + esc(o.outcome) + '</div>';
        if (o.failure) h += '<div style="margin:4px 0"><b style="color:#e85454">FAILURE:</b> ' + esc(o.failure) + '</div>';
        if (o.window) h += '<div style="margin:4px 0"><b style="color:#807868">WINDOW:</b> ' + esc(o.window) + '</div>';
        if (o.fastPath && o.fastPath.length > 0) {
          h += '<div style="margin:6px 0;padding:4px 8px;background:rgba(90,181,160,0.03);border-left:2px solid rgba(90,181,160,0.2)">';
          h += '<div style="font-size:0.24rem;letter-spacing:1.5px;color:rgba(90,181,160,0.5);margin-bottom:2px">FAST PATH</div>';
          for (var fpi = 0; fpi < o.fastPath.length; fpi++) h += '<div style="color:#a09888">' + esc(o.fastPath[fpi]) + '</div>';
          h += '</div>';
        }
        if (o.examples && o.examples.length > 0) {
          h += '<div style="margin:4px 0"><b style="color:#807868">EXAMPLES:</b> ' + o.examples.map(function (ex) { return esc(ex); }).join(' \u00b7 ') + '</div>';
        }
        h += '</details></div>';
      }

      // Deep Intelligence for promoted directives
      if (o.source === 'portal_directive') {
        // Mechanism + deep intelligence for promoted plays
        if (o._mechanism && o._mechanism.primary) {
          var dxEx = (MECH_EXPLAIN[(o.diagnosisId || '').toUpperCase()] || {})[o._mechanism.primary] || MECH_FALLBACK[o._mechanism.primary];
          if (dxEx) {
            h += '<div style="font-size:0.30rem;color:#b0a898;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.12)"><b style="color:rgba(201,169,78,0.7)">' + esc(o._mechanism.primaryLabel) + ':</b> ' + esc(dxEx.move) + '</div>';
          }
        }
        h += renderDeepIntel(o, 'MORE INTELLIGENCE');
      }

      // Suggested targets for INVEST plays
      if (o.path === 'INVESTABLE') {
        var pbId = o.playbookId || resolvePlaybookId(o);
        if (pbId) h += renderTargets(pbId);
      }
      // Execution panels for GRANT and PATENT plays
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENTechnologyExecutionPanels) {
        h += window.LIMENTechnologyExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 3: ACTION QUEUE
  // ══════════════════════════════════════════════════════════════════════

  function buildActionQueue(state) {
    var opps = (state.opportunities || []).slice();

    // CRITICAL: Merge claimed opportunities from ledger so they never disappear
    // If an operator claimed an opportunity and the feed changes, the claim persists
    var ledger = window.LIMENClaimLedger;
    if (ledger) {
      var claims = ledger.getClaimsByDomain('technology');
      var oppIds = {};
      for (var oi = 0; oi < opps.length; oi++) oppIds[opps[oi].id || oppKey(opps[oi])] = true;
      for (var ci = 0; ci < claims.length; ci++) {
        var claim = claims[ci];
        if (claim.status === 'closed') continue; // Don't resurrect closed claims
        if (oppIds[claim.opportunityId]) continue; // Already in live list
        // This is a claimed opportunity that is no longer generated by the brain — preserve it
        opps.push({
          id: claim.opportunityId,
          title: claim.title,
          path: claim.path || 'GRANT-ELIGIBLE',
          urgency: 'WATCH',
          rank: 0.1, // Low rank — it's no longer live-supported
          source: 'claimed_preserved',
          tier: 3,
          stress: 0,
          domain: 'technology',
          explain: 'This opportunity was claimed but is no longer supported by live feed data. Complete or close your claim.',
          action: 'Review claim status. If still valid, continue execution. If no longer relevant, record outcome and close.',
          _preserved: true
        });
      }
    }

    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var statuses = getStatusMap();

    var h = '<table class="eos-queue"><thead><tr><th>#</th><th>OPPORTUNITY</th><th>PATH</th><th>WHY THIS MAKES MONEY</th><th>NEXT STEP</th></tr></thead><tbody>';

    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      var key = o.id || oppKey(o);
      var currentStatus = statuses[key] || 'NEW';
      var title = (o.title || '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      // Read directly from canonical object — no local recomputation
      var whyFull = o.explain || o.action || o.title;
      var mc = o.moneyChain || null;

      var step = o.action || (o.fastPath && o.fastPath.length > 0 ? o.fastPath[0] : 'Open detail for execution steps');

      var statusHTML = '';
      var STATUSES = ['NEW', 'WIP', 'DONE', 'WATCH'];
      var STATUS_CLASS = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' };
      for (var si = 0; si < STATUSES.length; si++) {
        var st = STATUSES[si];
        statusHTML += '<button class="eos-status-btn' + (currentStatus === st ? ' ' + STATUS_CLASS[st] : '') +
          '" data-key="' + esc(key) + '" data-status="' + st + '">' + st + '</button>';
      }

      // Build collapsible WHY THIS MAKES MONEY cell
      var whyCell = '<div class="money-thesis-cell">';
      whyCell += '<div class="money-thesis-preview">' + esc(whyFull) + '</div>';
      whyCell += '<div class="money-thesis-expanded hidden">' + esc(whyFull);
      if (mc) {
        whyCell += '<div class="money-thesis-detail">';
        if (mc.doThis) whyCell += '<span class="mtd-label">DO THIS</span>' + esc(mc.doThis);
        if (mc.whyPays) whyCell += '<span class="mtd-label">WHY THIS PAYS</span>' + esc(mc.whyPays);
        if (mc.target) whyCell += '<span class="mtd-label">TARGET</span>' + esc(mc.target);
        if (mc.timing) whyCell += '<span class="mtd-label">TIMING</span>' + esc(mc.timing);
        if (mc.invalidIf) whyCell += '<span class="mtd-label">INVALID IF</span>' + esc(mc.invalidIf);
        if (mc.evidence) whyCell += '<span class="mtd-label">EVIDENCE</span>' + esc(mc.evidence);
        if (mc.nextStep) whyCell += '<span class="mtd-label">NEXT STEP</span>' + esc(mc.nextStep);
        whyCell += '</div>';
      }
      // Deep intel for promoted directives inside the expanded view
      if (o.source === 'portal_directive' && o._deepIntel) {
        whyCell += renderDeepIntel(o, 'PORTAL INTELLIGENCE');
      }
      whyCell += '</div>';
      whyCell += '<button class="money-thesis-toggle" onclick="this.previousElementSibling.classList.toggle(\'hidden\');this.parentElement.querySelector(\'.money-thesis-preview\').style.display=this.previousElementSibling.classList.contains(\'hidden\')?\'\':\'none\';this.textContent=this.previousElementSibling.classList.contains(\'hidden\')?\'MORE\':\'LESS\'">MORE</button>';
      whyCell += '</div>';

      h += '<tr' + (o.urgency === 'IMMEDIATE' || o.urgency === 'high' ? ' style="border-left:2px solid #e85454"' : '') + '>';
      h += '<td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(title) + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + whyCell + '</td>';
      h += '<td class="eos-queue-step">' + esc(step) + '</td>';
      h += '</tr>';
      // Action button row — full width below opportunity
      h += '<tr><td colspan="5" style="padding:0;border-bottom:1px solid rgba(255,255,255,0.04)"><div class="eos-action-row">' + statusHTML;
      // Path-specific action buttons
      var pbId = (o.path === 'INVESTABLE') ? resolvePlaybookId(o) : null;
      if (pbId) {
        h += '<button class="eos-invest-btn" data-pb-id="' + esc(pbId) + '" data-opp-title="' + esc(title) + '">INVEST \u2192</button>';
      }
      if (o.path === 'GRANT-ELIGIBLE') {
        h += '<button class="eos-invest-btn" style="color:#5ab5a0;border-color:rgba(90,181,160,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="GRANT-ELIGIBLE">GRANT \u2192</button>';
      }
      if (o.path === 'PATENTABLE') {
        h += '<button class="eos-invest-btn" style="color:#a87adb;border-color:rgba(168,122,219,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="PATENTABLE">PATENT \u2192</button>';
      }
      if (o.paths && o.paths.indexOf('BUSINESS') !== -1) {
        h += '<button class="eos-invest-btn" style="color:#C9A94E;border-color:rgba(201,169,78,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="BUSINESS">BUILD \u2192</button>';
      }
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      // CLAIM button (always last)
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'technology') : null;
      if (_claimExisting) {
        h += '<span class="eos-status-btn" style="color:#5ab5a0;border-color:rgba(90,181,160,0.2);cursor:default">\u2713 CLAIMED</span>';
      } else {
        h += '<button class="eos-invest-btn" style="color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.06)" data-claim-opp="' + esc(o.id || key) + '">CLAIM</button>';
      }
      h += '</div></td></tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — builds operator view content
  // ══════════════════════════════════════════════════════════════════════

  // Track whether directive bridge has completed first extraction
  var _bridgeInitialized = false;

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) return;

    var bridge = window.LIMENTechnologyPromotionBridge;
    console.log('[TechnologyOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('technology') : null;
      var portalCache = brain ? brain._portalCache : null;
      var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
      console.log('[TechnologyOperator] brain=' + !!brain + ' portalCache=' + !!portalCache + ' activeDx=' + activeDx.length + ' stress=' + state.stress);

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          console.log('[TechnologyOperator] First bridge run — extracting...');
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            console.log('[TechnologyOperator] Bridge returned ' + (promoted ? promoted.length : 0) + ' promoted directives');
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) {
                console.log('[TechnologyOperator] Re-rendering with ' + promoted.length + ' directives');
                _renderOperatorDOM(freshState);
              }
            }
          }).catch(function (err) {
            console.error('[TechnologyOperator] Bridge error:', err);
          });
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        console.log('[TechnologyOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var retryBrain = brains ? brains.get('technology') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          console.log('[TechnologyOperator] Retry: brain=' + !!retryBrain + ' cache=' + !!retryCache);
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            var retryDx = retryState ? (retryState.diagnoses || []).filter(function (d) { return d.active; }).length : 0;
            console.log('[TechnologyOperator] Retry: state=' + !!retryState + ' activeDx=' + retryDx);
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                console.log('[TechnologyOperator] Retry bridge returned ' + (promoted ? promoted.length : 0));
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function (err) {
                console.error('[TechnologyOperator] Retry bridge error:', err);
              });
            }
          }
        }, 5000);
      }
    }

    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {

    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div class="eos-title" style="margin-bottom:0">ENERGY \u00b7 OPERATOR SURFACE</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<a href="/execution-framework" target="_blank" style="font-family:monospace;font-size:0.28rem;letter-spacing:1.5px;padding:3px 8px;border:1px solid rgba(201,169,78,0.15);border-radius:2px;color:rgba(201,169,78,0.5);text-decoration:none;transition:all 0.2s">LEGAL FRAMEWORK</a>';
    h += '<button id="eos-back-to-console" style="font-family:monospace;font-size:0.32rem;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer;transition:all 0.2s">\u2190 CONSOLE</button>';
    h += '</div></div>';

    // ── DIAGNOSIS STATUS PANEL (collapsible, same as other sections) ──
    var allDx = state.diagnoses || [];
    var activeDxList = allDx.filter(function (d) { return d.active; });
    var inactiveDxList = allDx.filter(function (d) { return !d.active; });
    var dxContent = '';
    if (activeDxList.length > 0) {
      for (var adi = 0; adi < activeDxList.length; adi++) {
        var adx = activeDxList[adi];
        dxContent += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem">';
        dxContent += '<span style="color:#5ab5a0">\u25CF ACTIVE</span>';
        dxContent += '<span style="color:#e0daca">' + esc((adx.label || adx.id || '').replace(/_/g, ' ')) + '</span>';
        dxContent += '<span style="color:#807868;font-size:0.28rem">' + Math.round((adx.relevance || 0) * 100) + '% match \u00b7 ' + (adx.matchedConditions || 0) + '/' + (adx.totalTriggers || 0) + ' triggers</span>';
        if (adx.blocked) dxContent += '<span style="color:#e85454;font-size:0.26rem">BLOCKED: ' + esc(adx.blockReason || '') + '</span>';
        if (adx.evidenceReason) dxContent += '<span style="color:#5ab5a0;font-size:0.26rem">' + esc(adx.evidenceReason) + '</span>';
        dxContent += '</div>';
      }
    } else {
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Opportunities require at least one active diagnosis with live evidence.</div>';
    }
    if (inactiveDxList.length > 0) {
      dxContent += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.26rem;color:#706860;letter-spacing:1px">INACTIVE (' + inactiveDxList.length + ') \u25BC</summary>';
      for (var idi = 0; idi < inactiveDxList.length; idi++) {
        var idx = inactiveDxList[idi];
        dxContent += '<div style="font-size:0.30rem;color:#706860;padding:1px 0">\u25CB ' + esc((idx.label || idx.id || '').replace(/_/g, ' ')) + ' \u2014 ' + (idx.matchedConditions || 0) + '/' + (idx.totalTriggers || 0) + ' triggers';
        if (idx.blocked) dxContent += ' <span style="color:#e85454">(blocked)</span>';
        dxContent += '</div>';
      }
      dxContent += '</details>';
    }
    h += wrapCollapsible('diagnosis-status', 'DIAGNOSIS STATUS \u00b7 ' + activeDxList.length + ' ACTIVE \u00b7 ' + inactiveDxList.length + ' INACTIVE', dxContent, false);

    h += renderAnchorDirective(state);
    h += renderDeepProofBlock(state);
    h += buildMoneySummary(state);
    h += wrapCollapsible('top-plays', 'TOP MONEY PLAYS', buildTopPlays(state), false);
    h += wrapCollapsible('action-queue', 'ACTION QUEUE', buildActionQueue(state), false);

    _operatorView.innerHTML = h;

    // Wire back button
    var backBtn = document.getElementById('eos-back-to-console');
    if (backBtn) backBtn.addEventListener('click', switchToConsole);

    // Wire status buttons
    var btns = _operatorView.querySelectorAll('.eos-status-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var key = this.getAttribute('data-key');
        var status = this.getAttribute('data-status');
        setStatus(key, status);
        var row = this.parentNode;
        var siblings = row.querySelectorAll('.eos-status-btn');
        var SC = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' };
        for (var j = 0; j < siblings.length; j++) {
          siblings[j].className = 'eos-status-btn' + (siblings[j].getAttribute('data-status') === status ? ' ' + SC[status] : '');
        }
      });
    }

    // Accordion delegation is bound ONCE on _operatorView (see _wireAccordionDelegation below)

    // Wire INVEST deep-link buttons — canonical playbook IDs only
    var investBtns = _operatorView.querySelectorAll('[data-pb-id]');
    for (var ib = 0; ib < investBtns.length; ib++) {
      investBtns[ib].addEventListener('click', function (e) {
        e.stopPropagation();
        var pbId = this.getAttribute('data-pb-id');
        var oppTitle = this.getAttribute('data-opp-title');
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['technology'], type: 'invest' };

        // Find matching opportunity from state for enriched data
        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var matchOpp = null;
        for (var mi = 0; mi < opps.length; mi++) {
          if (opps[mi].playbookId === pbId && opps[mi].path === 'INVESTABLE') { matchOpp = opps[mi]; break; }
        }
        // If no exact match, try by title
        if (!matchOpp) {
          for (var mi2 = 0; mi2 < opps.length; mi2++) {
            if (opps[mi2].title === oppTitle) { matchOpp = opps[mi2]; break; }
          }
        }

        var mc = matchOpp ? (matchOpp.moneyChain || {}) : {};
        var stressPct = matchOpp ? Math.round((matchOpp.stress || 0) * 100) : 0;
        var targets = INVEST_TARGETS[pbId] || [];
        var targetNames = targets.filter(function(t) { return t.cik; }).map(function(t) { return t.ticker + ' (' + t.name + ')'; }).join(', ');

        // Generate branch_up from opportunity intelligence
        var branchUp = mc.doThis ? mc.doThis : '';
        if (mc.whyPays) branchUp += (branchUp ? ' ' : '') + mc.whyPays;
        if (targetNames) branchUp += ' Beneficiaries: ' + targetNames + '.';
        if (!branchUp) branchUp = 'Thesis confirmed — linked companies reprice higher. Stress persists above ' + stressPct + '%, driving procurement and capital allocation to the sector.';

        // Generate branch_down from invalidation
        var branchDown = mc.invalidIf || (matchOpp && matchOpp.failure) || '';
        if (!branchDown) branchDown = 'Stress resolves below 50%. Diagnosis deactivates. Sector tailwind dissipates before positions can capture repricing.';
        if (targetNames) branchDown += ' Reduce exposure in: ' + targetNames + '.';

        // Generate outcome from thesis
        var outcome = '';
        if (matchOpp && matchOpp.valueRange) outcome = 'Value range: ' + matchOpp.valueRange + '. ';
        if (matchOpp && matchOpp.outcome) outcome += matchOpp.outcome;
        else if (mc.whyPays) outcome += mc.whyPays;
        if (mc.timing) outcome += ' Timing: ' + mc.timing;
        if (!outcome) outcome = 'Linked technology companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

        // Build handoff matching investment console contract
        var handoff = {
          pb: {
            id: pbId, title: def.title, domains: def.domains, type: def.type,
            explain: matchOpp ? (matchOpp.explain || oppTitle) : oppTitle,
            action: matchOpp ? (matchOpp.action || '') : '',
            valueRange: matchOpp ? (matchOpp.valueRange || '') : '',
            saturation: 'medium',
            trigger: matchOpp ? (matchOpp.trigger || '') : '',
            validation: matchOpp ? (matchOpp.validation || '') : '',
            steps: matchOpp ? (matchOpp.steps || []) : [],
            branch_up: branchUp,
            branch_down: branchDown,
            outcome: outcome,
            failure: matchOpp ? (matchOpp.failure || mc.invalidIf || '') : '',
            window: matchOpp ? (matchOpp.window || '') : '',
            realWorld: {},
            examples: matchOpp ? (matchOpp.examples || []) : [],
            fastPath: matchOpp ? (matchOpp.fastPath || []) : []
          },
          confidence: matchOpp ? (matchOpp.confidence || 50) : 50,
          urgency: matchOpp ? (matchOpp.urgency || 'medium') : 'medium',
          whyNow: oppTitle,
          status: 'active'
        };
        try { sessionStorage.setItem('limen_invest_opp', JSON.stringify(handoff)); } catch (ex) {}
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=technology&returnTo=' + encodeURIComponent('/domain-console?domain=technology');
      });
    }

    // Wire GRANT/PATENT buttons — open execution workspace inline
    var execBtns = _operatorView.querySelectorAll('[data-exec-key]');
    for (var eb = 0; eb < execBtns.length; eb++) {
      execBtns[eb].addEventListener('click', function (e) {
        e.stopPropagation();
        var execKey = this.getAttribute('data-exec-key');
        var execPath = this.getAttribute('data-exec-path');
        // Store context and navigate to workspace page
        try {
          var trackMap = { 'GRANT-ELIGIBLE': 'grant', 'PATENTABLE': 'patent', 'BUSINESS': 'business' };
          sessionStorage.setItem('limen_exec_context', JSON.stringify({
            key: execKey,
            path: execPath,
            track: trackMap[execPath] || 'grant',
            source: 'technology',
            returnTo: '/domain-console?domain=technology&mode=operator'
          }));
        } catch (ex) {}
        var trackName = trackMap[execPath] || 'grant';
        window.location.href = 'technology-workspace.html?track=' + trackName + '&opp=' + encodeURIComponent(execKey) + '&returnTo=' + encodeURIComponent('/domain-console?domain=technology&mode=operator');
      });
    }

    // Wire CLAIM buttons (global operator economy)
    var claimBtns = _operatorView.querySelectorAll('[data-claim-opp]');
    for (var cb = 0; cb < claimBtns.length; cb++) {
      claimBtns[cb].addEventListener('click', function (e) {
        e.stopPropagation();
        var oppId = this.getAttribute('data-claim-opp');
        // Find the opportunity object
        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var opp = null;
        for (var oi = 0; oi < opps.length; oi++) {
          if ((opps[oi].id || oppKey(opps[oi])) === oppId) { opp = opps[oi]; break; }
        }
        if (!opp || !window.LIMENClaimFlow) return;
        // Open claim modal
        window.LIMENClaimFlow.openClaimModal(opp, 'technology', function (confirmedOpp, estimate) {
          // Create claim in ledger
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'technology', estimate);
          }
          // Re-render to show CLAIMED badge
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel (global)
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'technology');
    }

    // Mount execution memory panel (global)
    if (window.LIMENExecution && window.LIMENExecution.reliabilityPanel) {
      window.LIMENExecution.reliabilityPanel.mount(_operatorView);
    }

    // Mount ops dashboard (Phase 5 global)
    if (window.LIMENExecution && window.LIMENExecution.phase5 && window.LIMENExecution.phase5.opsDashboard) {
      window.LIMENExecution.phase5.opsDashboard.mount(_operatorView);
    }

    // Workload warning near claim buttons
    if (window.LIMENExecution && window.LIMENExecution.phase5 && window.LIMENExecution.phase5.workload) {
      var warnHtml = window.LIMENExecution.phase5.workload.getWarningHtml();
      if (warnHtml) {
        var warnDiv = document.createElement('div');
        warnDiv.innerHTML = warnHtml;
        var firstClaimBtn = _operatorView.querySelector('[data-claim-opp]');
        if (firstClaimBtn && firstClaimBtn.parentNode) firstClaimBtn.parentNode.insertBefore(warnDiv.firstChild, firstClaimBtn);
      }
    }

    // Mount business review panel below the action queue
    if (window.LIMENTechnologyBusinessReview) {
      window.LIMENTechnologyBusinessReview.mount(_operatorView);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW SWITCHING — Console ↔ Operator
  // ══════════════════════════════════════════════════════════════════════

  function switchToOperator() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = 'none';
    if (_operatorView) {
      _operatorView.style.display = 'block';
      renderOperator();
    }
    _isOperatorMode = true;
    updateToggleButton();
  }

  function switchToConsole() {
    if (_operatorView) _operatorView.style.display = 'none';
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = '';
    _isOperatorMode = false;
    updateToggleButton();
  }

  function updateToggleButton() {
    var btnC = document.getElementById('chModeConsole');
    var btnO = document.getElementById('chModeOperator');
    if (btnC) { btnC.classList.toggle('active', !_isOperatorMode); }
    if (btnO) { btnO.classList.toggle('active', _isOperatorMode); }
  }

  // ══════════════════════════════════════════════════════════════════════
  // BOOT — create operator view container + replace header toggle
  // ══════════════════════════════════════════════════════════════════════

  function boot() {
    injectStyles();

    // Create the operator view container as a sibling of #clarity-view
    var cv = document.getElementById('clarity-view');
    if (!cv) return;

    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none'; // hidden by default — console shows first
    cv.parentNode.insertBefore(_operatorView, cv.nextSibling);

    // ── ACCORDION DELEGATION — wired ONCE on _operatorView, survives all re-renders ──
    _operatorView.addEventListener('click', function (e) {
      // Skip clicks on buttons/links/inputs inside sections
      if (e.target.closest('.eos-status-btn') || e.target.closest('button[data-pb-id]') ||
          e.target.closest('button[data-exec-key]') || e.target.closest('button[data-claim-opp]') ||
          e.target.closest('a') || e.target.closest('input') || e.target.closest('select') ||
          e.target.closest('.ebr-btn') || e.target.closest('[data-business-node]')) return;

      // 1. Section header collapse (.eos-section-header)
      var sectionHeader = e.target.closest('.eos-section-header');
      if (sectionHeader) {
        var sid = sectionHeader.getAttribute('data-section');
        var body = _operatorView.querySelector('[data-section-body="' + sid + '"]');
        var toggle = sectionHeader.querySelector('.eos-section-toggle');
        if (body) {
          var nowCollapsed = !body.classList.contains('collapsed');
          body.classList.toggle('collapsed');
          setCollapsed(sid, nowCollapsed);
          if (toggle) toggle.textContent = nowCollapsed ? '\u25B6' : '\u25BC';
        }
        return;
      }

      // 2. Target section headers (.eos-targets-header)
      var targetHeader = e.target.closest('.eos-targets-header');
      if (targetHeader) {
        var tsid = targetHeader.getAttribute('data-section');
        var tbody = _operatorView.querySelector('[data-section-body="' + tsid + '"]');
        var ttoggle = targetHeader.querySelector('span');
        if (tbody) {
          var nowHidden = tbody.style.display !== 'none';
          tbody.style.display = nowHidden ? 'none' : '';
          setCollapsed(tsid, nowHidden);
          if (ttoggle) ttoggle.textContent = nowHidden ? '\u25B6' : '\u25BC';
        }
        return;
      }

      // 3. Target row expand (.eos-target-row)
      var targetRow = e.target.closest('.eos-target-row');
      if (targetRow) {
        var idx = targetRow.getAttribute('data-target-idx');
        var detail = _operatorView.querySelector('[data-target-detail="' + idx + '"]');
        var arrow = targetRow.querySelector('.eos-target-expand');
        if (detail) {
          detail.classList.toggle('open');
          if (arrow) arrow.textContent = detail.classList.contains('open') ? '\u25B2' : '\u25BC';
        }
        return;
      }

      // 4a. Drill deeper branch research
      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) {
        _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry'));
        return;
      }

      // 4b. Load full branch
      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) { _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch')); return; }
      var portalSourceBtn = e.target.closest('[data-portal-source]');
      if (portalSourceBtn) { _handlePortalSource(portalSourceBtn.getAttribute('data-portal-source')); return; }

      // 4c. Deep intel toggle (.eos-deep-toggle)
      var deepToggle = e.target.closest('.eos-deep-toggle');
      if (deepToggle) {
        var toggleId = deepToggle.getAttribute('data-toggle');
        var deepBody = document.getElementById('deep-' + toggleId);
        if (deepBody) {
          deepBody.classList.toggle('open');
          deepToggle.textContent = deepBody.classList.contains('open') ? '\u25BC' : '\u25B6';
        }
        return;
      }
    });

    // Wire the dual Console/Operator mode buttons in the header center
    var btnConsole = document.getElementById('chModeConsole');
    var btnOperator = document.getElementById('chModeOperator');
    if (btnConsole) {
      btnConsole.addEventListener('click', function () {
        if (_isOperatorMode) switchToConsole();
      });
    }
    if (btnOperator) {
      btnOperator.addEventListener('click', function () {
        if (!_isOperatorMode) switchToOperator();
      });
    }

    _booted = true;

    // Auto-open operator if ?mode=operator is in URL (return from workspace)
    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') {
      switchToOperator();
    }

    console.log('[TechnologyOperator] Booted — operator view created, toggle wired');
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE — wait for brain to render, then boot
  // ══════════════════════════════════════════════════════════════════════

  var _bootCheck = setInterval(function () {
    var cv = document.getElementById('clarity-view');
    var state = getState();
    // Wait for brain to fully render (dcb-exec = executive strip)
    var brainRendered = cv && cv.querySelector('#dcb-exec');
    if (brainRendered && state && state.updated > 0) {
      clearInterval(_bootCheck);
      boot();
    }
  }, 300);

  // Brain updates do NOT trigger full operator re-render.
  // The operator surface is stable once rendered — no scroll-destroying repaints.
  // Data refreshes happen only when the user switches views or claims an opportunity.
  // The console (brain panels) still updates live — that's a different view.

})();
