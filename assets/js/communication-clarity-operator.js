/**
 * communication-clarity-operator.js — Money-Driven Action Surface for Communication Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #eos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=communication is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on communication domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'communication') return;

  var VIEW_ID = 'eos-operator-view';
  var STATUS_KEY = 'limen_communication_operator_status';
  var COLLAPSE_KEY = 'limen_communication_collapse_state';
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
    var brain = brains.get('communication');
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
    'DISINFORMATION_CRISIS': {
      what: 'False stories, fabricated evidence, and coordinated narrative manipulation are spreading across platforms faster than fact-checkers and newsrooms can correct them',
      money: 'Fact-checking organizations, misinformation tracking platforms, AI authenticity tools, and pre-bunking content services gain leverage. Brands and platforms hire trust-and-safety vendors and crisis comms firms to respond. Foundations and federal grant offices open new lines of funding.',
      step: 'Track NewsGuard ratings, Stanford Internet Observatory reports, fact-check throughput, and incident reports from the major platforms. Position in trust-and-safety tooling, fact-check services, or AI authenticity infrastructure.',
      outcome: '$250K-$5M Knight Foundation / NSF / DARPA grants, or sustained six-figure trust-and-safety service contracts'
    },
    'TELECOM_FAILURE': {
      what: 'Internet outages, fiber cuts, BGP routing leaks, submarine cable damage, and government-ordered shutdowns are disrupting how people and businesses talk to each other',
      money: 'CDN, edge, and resilience providers gain leverage as customers diversify. Satellite and mesh-network alternatives (Starlink, LoRa, Helium) attract emergency procurement. Network monitoring vendors get RFPs from enterprises that just got burned.',
      step: 'Track CloudflareRadar, Netblocks, and the major carriers\u2019 status pages. Position in CDN diversification, satellite backhaul, or network monitoring tooling.',
      outcome: '$500K-$10M enterprise network resilience contracts or sustained CDN / network monitoring ARR'
    },
    'CENSORSHIP_OVERREACH': {
      what: 'Governments and platforms are removing content, banning accounts, and restricting speech faster than legal and civil society oversight can keep up',
      money: 'Press freedom organizations, journalist safety services, and legal defense funds get foundation and individual donor inflows. Anti-censorship technology (Tor, VPNs, IPFS, mesh tools) sees usage spikes. Platform alternatives and self-hosted options gain traction.',
      step: 'Track Reporters Without Borders index changes, EFF takedown reports, Lumen database filings, and platform transparency reports. Position in journalist safety, anti-surveillance tooling, or platform-alternative infrastructure.',
      outcome: '$100K-$2M civil society grants or sustained legal defense / safety service revenue'
    },
    'MEDIA_MONOPOLY': {
      what: 'News organizations are merging, closing, or being absorbed by financial owners faster than communities can replace local journalism',
      money: 'Local news startups, nonprofit newsrooms, and reader-funded publications attract foundation and reader-revenue inflows. Newsroom-as-a-service tools (CMS, audience, monetization) gain traction. Newsroom consultancies guide turnaround and transitions.',
      step: 'Track Newspack, INN, and Knight Foundation funding rounds; Pew Research news desert maps; Pew local news consumption surveys. Position in nonprofit newsroom tooling, reader revenue platforms, or local news consultancies.',
      outcome: '$100K-$3M Knight / Lenfest / Solutions Journalism grants or sustained local news SaaS revenue'
    },
    'CYBER_PROPAGANDA': {
      what: 'Coordinated bot networks, foreign influence operations, and AI-generated propaganda are flooding the information environment with content designed to deceive',
      money: 'Influence operation detection vendors (Graphika, Logically, Recorded Future), open-source intelligence platforms, and content provenance tools gain leverage. Federal contracts (DARPA SemaFor, DHS CISA) flow toward attribution and detection.',
      step: 'Track DFRLab and Stanford Internet Observatory takedown reports, GEC bulletins, and the platforms\u2019 own coordinated inauthentic behavior reports. Position in OSINT tooling, deepfake detection, or content provenance services.',
      outcome: '$500K-$10M federal contracts (DARPA, DHS, GEC) or sustained influence-detection SaaS revenue'
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

  // Diagnosis → playbook ID for Communication-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'DISINFORMATION_CRISIS': 'comm_trust_safety',
    'TELECOM_FAILURE':       'comm_resilience',
    'CENSORSHIP_OVERREACH':  'comm_press_freedom',
    'MEDIA_MONOPOLY':        'comm_local_news',
    'CYBER_PROPAGANDA':      'comm_influence_ops'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'comm_local_news',
    'company_stressed':  'comm_resilience',
    'convergence':       'comm_trust_safety',
    'cross_domain':      'comm_influence_ops'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'comm_trust_safety':  { title: 'Trust, Safety, and Misinformation Response', domains: ['communication', 'technology'], type: 'invest' },
    'comm_resilience':    { title: 'Telecom and Network Resilience', domains: ['communication', 'infrastructure'], type: 'invest' },
    'comm_press_freedom': { title: 'Press Freedom and Anti-Censorship', domains: ['communication', 'governance'], type: 'invest' },
    'comm_local_news':    { title: 'Local News and Media Sustainability', domains: ['communication', 'governance'], type: 'invest' },
    'comm_influence_ops': { title: 'Influence Operations and Content Provenance', domains: ['communication', 'defense'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in communication.json portal),
  //             DOMAIN_MAPPED (in communication command board), ETF_PROXY (sector proxy, no company-level validation)
  var INVEST_TARGETS = {
    'comm_trust_safety': [
      { ticker: 'XLC',  name: 'Communication Services Select SPDR',   cik: null,      validation: 'ETF_PROXY',       reason: 'Communication ETF \u2014 thematic proxy for trust-and-safety spend across platforms' },
      { ticker: 'META', name: 'Meta Platforms',                       cik: '1326801', validation: 'HELIX_VALIDATED', reason: 'Largest trust-and-safety budget on Earth; reference customer for every T&S vendor' },
      { ticker: 'GOOGL',name: 'Alphabet (YouTube + Search)',          cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'YouTube + Search are the primary surfaces for misinformation moderation programs' },
      { ticker: 'TTD',  name: 'The Trade Desk',                       cik: '1671933', validation: 'HELIX_VALIDATED', reason: 'Demand-side ad platform; benefits as advertisers demand brand safety guarantees' },
      { ticker: 'DV',   name: 'DoubleVerify',                         cik: '1819928', validation: 'DOMAIN_MAPPED',   reason: 'Brand safety, fraud protection, and ad verification across digital advertising' },
      { ticker: 'IAS',  name: 'Integral Ad Science',                  cik: '1842718', validation: 'DOMAIN_MAPPED',   reason: 'Ad verification and brand safety; pure-play exposure to misinformation defense spend' }
    ],
    'comm_resilience': [
      { ticker: 'NET',  name: 'Cloudflare',                           cik: '1477333', validation: 'HELIX_VALIDATED', reason: 'Global edge resilience, DDoS mitigation, and content delivery for media customers' },
      { ticker: 'FSLY', name: 'Fastly',                               cik: '1517413', validation: 'DOMAIN_MAPPED',   reason: 'Edge compute and CDN focused on news and media publishers' },
      { ticker: 'AKAM', name: 'Akamai Technologies',                  cik: '1086222', validation: 'HELIX_VALIDATED', reason: 'Largest global CDN; exposure to broadcaster and publisher distribution resilience' },
      { ticker: 'VZ',   name: 'Verizon Communications',               cik: '732712',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. wireless carrier; backbone for resilient mobile communication' },
      { ticker: 'T',    name: 'AT&T',                                 cik: '732717',  validation: 'HELIX_VALIDATED', reason: 'Wireless and fiber backbone; benefits from resilience and emergency comms procurement' },
      { ticker: 'IRDM', name: 'Iridium Communications',               cik: '1418819', validation: 'DOMAIN_MAPPED',   reason: 'Global satellite communication; benefits when terrestrial networks fail' }
    ],
    'comm_press_freedom': [
      { ticker: 'NYT',  name: 'New York Times Company',               cik: '71691',   validation: 'HELIX_VALIDATED', reason: 'Largest U.S. subscription news org; exposure to subscription growth during press freedom crises' },
      { ticker: 'NWSA', name: 'News Corp',                            cik: '1564708', validation: 'HELIX_VALIDATED', reason: 'WSJ + Dow Jones + News UK; broad press freedom and journalism exposure' },
      { ticker: 'GTN',  name: 'Gray Television',                      cik: '43196',   validation: 'DOMAIN_MAPPED',   reason: 'Local television broadcaster; backbone of local journalism in many U.S. markets' },
      { ticker: 'MDIA', name: 'MediaCo Holding',                      cik: '1577484', validation: 'DOMAIN_MAPPED',   reason: 'Independent media holding company; reader-revenue alignment' },
      { ticker: 'NET',  name: 'Cloudflare',                           cik: '1477333', validation: 'HELIX_VALIDATED', reason: 'Project Galileo provides free DDoS protection to journalists and human-rights orgs' }
    ],
    'comm_local_news': [
      { ticker: 'NYT',  name: 'New York Times Company',               cik: '71691',   validation: 'HELIX_VALIDATED', reason: 'Reference model for digital subscription news; informs the local news playbook' },
      { ticker: 'GCI',  name: 'Gannett (USA Today Network)',          cik: '1635718', validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. local newspaper publisher; exposure to local news transformation' },
      { ticker: 'LEE',  name: 'Lee Enterprises',                      cik: '58361',   validation: 'DOMAIN_MAPPED',   reason: 'Local newspaper publisher across mid-size U.S. markets' },
      { ticker: 'GTN',  name: 'Gray Television',                      cik: '43196',   validation: 'DOMAIN_MAPPED',   reason: 'Local television broadcaster; broad U.S. local market coverage' },
      { ticker: 'NXST', name: 'Nexstar Media Group',                  cik: '1142417', validation: 'HELIX_VALIDATED', reason: 'Largest U.S. local TV station owner; major local news distribution channel' }
    ],
    'comm_influence_ops': [
      { ticker: 'PLTR', name: 'Palantir Technologies',                cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'OSINT and intelligence platforms used for influence operation detection in defense contexts' },
      { ticker: 'NET',  name: 'Cloudflare',                           cik: '1477333', validation: 'HELIX_VALIDATED', reason: 'Bot management and account abuse prevention at the edge' },
      { ticker: 'CRWD', name: 'CrowdStrike Holdings',                 cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Threat intelligence on nation-state operators and IO actors' },
      { ticker: 'BAH',  name: 'Booz Allen Hamilton',                  cik: '1443669', validation: 'DOMAIN_MAPPED',   reason: 'Government contractor running influence-detection programs for federal customers' },
      { ticker: 'LDOS', name: 'Leidos Holdings',                      cik: '1336920', validation: 'DOMAIN_MAPPED',   reason: 'Federal IT contractor running content provenance and OSINT programs' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → trust_safety
    if (opp.source === 'lagging') return 'comm_trust_safety';
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Communication condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Communication portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=communication&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
  // Plain-English explanations: assume the reader is a smart operator, not a media expert.
  var MECH_EXPLAIN = {
    'DISINFORMATION_CRISIS': {
      'disinformation':     { why: 'False stories now travel six times faster than corrections, and the volume of misinformation has outgrown every newsroom\u2019s ability to chase it down. Once a false claim takes hold, it shapes how millions of people understand an event \u2014 and the longer it sits unchallenged, the harder it is to dislodge. The customers (newsrooms, brands, platforms, public health agencies) feel this every day: they watch a hoax explode on social media, they know it\u2019s damaging them, and they don\u2019t have the people, the tools, or the playbook to respond fast enough.', move: 'Build a fact-checking and rapid-response service or platform that catches misinformation in the first few hours and produces a clear, citable correction the customer can publish immediately. Sell to newsrooms, brand comms teams, and public health agencies. Charge $50K-$500K per year for a monitoring and response retainer, or $25K-$150K per engagement for crisis response.' },
      'coordinated_inauth': { why: 'Most modern misinformation isn\u2019t accidental \u2014 it\u2019s orchestrated by paid actors, state-backed networks, or coordinated bot armies pushing a specific story. The hard part is proving it: showing that 5,000 accounts saying the same thing at the same time aren\u2019t random people. Customers (governments, platforms, election integrity orgs, brands under attack) need investigators who can pull the threads and produce a defensible report.', move: 'Build an OSINT and network-analysis service that detects coordinated inauthentic activity, identifies who is behind it, and produces a takedown-ready report. Sell to platforms, government agencies, election integrity groups, and brand protection teams. Charge $100K-$1M per year for ongoing monitoring or $50K-$500K per investigation.' },
      'trust_erosion':      { why: 'Once an audience stops trusting a source, the source loses its ability to do its job. Newsrooms, platforms, and brands all face the same problem: even when they get the story right, their audience has been trained to assume bias and motive. Rebuilding trust takes structured, transparent work \u2014 visible corrections, clear sourcing, audience engagement, ethics documentation. Customers know they need this; they just don\u2019t know how to operationalize it.', move: 'Build a transparency and reader-trust platform that helps a newsroom or brand surface its sourcing, corrections, and editorial standards in a way readers can verify. Sell to newsrooms, brands, and nonprofits. Charge $25K-$150K per year per customer.' },
      'audience_fragment':  { why: 'Audiences have splintered into thousands of niche communities that don\u2019t share a common information environment. A story that lands in one community never reaches another. This creates an opening for narrow, community-specific publications and tools that meet audiences where they actually live \u2014 and those niche operations can grow real subscription businesses without needing a mass audience.', move: 'Build a community-specific newsletter, podcast, or platform that serves one well-defined audience extremely well. Or build the tools (analytics, monetization, community management) that let other niche operators do the same. Charge $5-$25 per subscriber per month, or $25K-$100K per year for a SaaS tool.' }
    },
    'TELECOM_FAILURE': {
      'network_outage':     { why: 'When the network goes down \u2014 whether it\u2019s a fiber cut, a BGP routing leak, a DDoS attack, or a government shutdown \u2014 every business and every newsroom that depends on it is dead in the water. The customers learned during the AT&T outage and the Cloudflare outage that they have no backup. Now they\u2019re willing to pay for diversification: second carriers, satellite backhaul, mesh networks, anything that means the next outage doesn\u2019t take them off the air.', move: 'Build a network resilience consultancy that audits a customer\u2019s connectivity, identifies single points of failure, and procures and installs backup paths (second ISP, satellite, LTE failover). Sell to broadcasters, financial firms, and any business that can\u2019t afford an outage. Charge $25K-$200K per audit plus ongoing managed service fees.' },
      'platform_capture':   { why: 'A handful of platforms now control how most communication actually moves. When they have a bad day \u2014 an algorithm change, an account suspension, an API deprecation \u2014 the businesses that depend on them lose their audience overnight. Customers need to own their distribution. The ones who get this are racing to build owned channels (newsletters, apps, direct relationships) before the next platform shock hits them.', move: 'Build a platform-independence service that helps a customer migrate from rented audiences (social platforms) to owned audiences (email lists, apps, communities). Charge $25K-$150K per migration plus an ongoing retainer for audience growth.' },
      'speech_regulation':  { why: 'Telecom regulation is changing fast: Section 230 is under attack, the FCC is reasserting net neutrality, the EU\u2019s Digital Services Act is reshaping platform obligations, and state-level speech laws are multiplying. Customers (broadcasters, ISPs, platforms) need to track every change and figure out what it means for them \u2014 fast \u2014 because falling on the wrong side of a new rule means fines and forced takedowns.', move: 'Build a regulatory monitoring and compliance service for telecom and platform customers. Track every FCC ruling, court case, and state law, and translate it into action items. Charge $50K-$250K per year per customer.' }
    },
    'CENSORSHIP_OVERREACH': {
      'censorship_pressure':{ why: 'Governments, platforms, and even private actors are removing content faster than oversight can catch up. Journalists get banned, activists get deplatformed, news sites get blocked at the ISP level. The people on the receiving end of this need legal defense, technical countermeasures, and a loud enough voice to push back. Foundations and individual donors are funding this work because they see democracy itself at stake.', move: 'Build a press freedom legal defense fund or a journalist safety service that provides emergency legal aid, secure communications, digital security training, and rapid-response advocacy. Sell to foundations and individual donors as a 501(c)(3). Annual budgets: $500K-$5M from foundation grants and donor-advised funds.' },
      'speech_regulation':  { why: 'Speech laws are changing in every direction at once \u2014 some governments want more removal, some want less, some want different rules for different speakers. Anyone publishing across borders needs to track what\u2019s legal where, and adjust in real time. Big publishers have legal teams; small ones don\u2019t.', move: 'Build a cross-jurisdictional speech compliance service that helps publishers, podcasters, and platforms navigate what they can and can\u2019t say in each market. Charge $25K-$150K per year per customer.' },
      'platform_capture':   { why: 'When the major platforms decide to enforce a rule (or ignore one), millions of users have no recourse. The pressure is building for alternatives: federated platforms, self-hosted tools, peer-to-peer networks. Early users are paying real money for the freedom to publish without a single point of control.', move: 'Build a self-hosted or federated publishing platform (podcast, blog, video, social) that gives the customer ownership of their channel. Sell to creators and small publishers. Charge $10-$50 per user per month.' }
    },
    'MEDIA_MONOPOLY': {
      'media_concentration':{ why: 'Hedge funds and PE firms now own most of the local newspapers in America. They cut reporters, raise prices, and run the operation for cash flow until it dies. Communities are losing their information infrastructure. The replacement is showing up: mission-driven nonprofit newsrooms, reader-funded local outlets, foundation-backed journalism collaboratives. They need tooling, money, and operational support to scale.', move: 'Build a nonprofit newsroom-in-a-box service that helps a community launch a local news operation: incorporation, CMS, fundraising, editorial training, distribution. Charge $25K-$150K per launch, plus ongoing managed services. Or build the SaaS layer (Newspack, Lede, Pico) that powers many of these at once.' },
      'platform_capture':   { why: 'Big platforms used to send local newsrooms huge amounts of traffic. Now the algorithms have changed and the traffic is gone. Newsrooms that built on rented audiences are stuck. The ones that built reader-revenue businesses (subscriptions, donations, memberships) are surviving and growing. Customers need help making that transition.', move: 'Build a reader revenue consultancy or platform that helps a newsroom move from advertising and platform traffic to direct subscriptions and memberships. Charge $50K-$500K per engagement, or build the underlying SaaS and charge $10-$50 per subscriber per year.' },
      'journalism_collapse':{ why: 'Working journalists are leaving the industry faster than they\u2019re being replaced. Layoffs, low pay, and burnout are gutting newsrooms. The journalists who stay need new workflows, AI assistance, training, and community support to do more with less. The schools that train them need new curricula. The foundations funding the field need places to put their money.', move: 'Build a journalism training, support, or workflow service: AI-assisted reporting tools, journalist co-working spaces, mid-career fellowships, freelance marketplaces. Sell to newsrooms, foundations, and individual journalists. Charge $25K-$200K per year per institutional customer or $50-$200 per month per individual.' }
    },
    'CYBER_PROPAGANDA': {
      'coordinated_inauth': { why: 'Foreign and domestic actors are running coordinated influence campaigns at industrial scale. They use AI-generated content, fake accounts, and amplification networks to shape public opinion on elections, public health, foreign policy, and stock prices. Detecting these operations requires specialized investigators, OSINT tooling, and the ability to publish defensible reports that platforms and governments can act on.', move: 'Build a coordinated inauthentic behavior detection service. Use OSINT, network analysis, and link analysis to find and document influence operations. Sell to government (DHS CISA, GEC, DARPA SemaFor), platforms (Meta, Google, X), and corporate clients (election campaigns, brands under attack). Charge $250K-$5M per government contract or $100K-$500K per private sector engagement.' },
      'disinformation':     { why: 'Once propaganda is in the information environment, it has to be countered \u2014 not just removed. Customers need pre-bunking content, debunking tools, and rapid-response narratives that beat the propaganda to the audience. This is especially urgent during elections, public health crises, and conflicts.', move: 'Build a counter-messaging service that produces rapid-response content (videos, social posts, articles) to inoculate audiences against ongoing propaganda campaigns. Sell to election integrity groups, public health agencies, and foundations. Charge $250K-$2M per campaign or per year.' },
      'platform_capture':   { why: 'Influence operations work because the platforms reward viral content, regardless of whether it\u2019s true. Customers (regulators, civil society, platforms themselves) need ways to change the incentive structure: friction on sharing, virality limits, content provenance signals, transparency reports.', move: 'Build a content provenance and platform trust tooling service. Implement C2PA / Content Credentials, label AI-generated content, and surface authenticity signals. Sell to platforms, news organizations, and regulators. Charge $100K-$1M per year per platform customer.' },
      'trust_erosion':      { why: 'When people can\u2019t tell what\u2019s real, they stop trusting everything. The collapse of trust is itself the goal of much modern propaganda. Rebuilding trust requires visible verification, community vouching, and tools that make authenticity legible to ordinary readers.', move: 'Build a content authenticity badge or verification service that ordinary readers can use to check whether a piece of content is from a verified source. Sell to news organizations and platforms. Charge $25K-$250K per year per customer.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn\u2019t exist
  // Plain-English: each entry should make sense to someone who is not a media or comms expert.
  var MECH_FALLBACK = {
    'disinformation':      { why: 'False information is spreading faster than newsrooms and fact-checkers can correct it. Customers need fast, citable rebuttals before the false story takes hold.', move: 'Build a fact-checking and rapid-response service and sell to newsrooms, brands, and public health agencies.' },
    'platform_capture':    { why: 'A few platforms control how most communication moves. Customers who built on rented audiences need to own their distribution.', move: 'Build a platform-independence migration service and sell to publishers and creators.' },
    'censorship_pressure': { why: 'Speech is being restricted faster than oversight can catch up. Customers need legal defense, technical countermeasures, and visible pushback.', move: 'Build a press freedom legal defense or journalist safety service and fundraise from foundations and donors.' },
    'network_outage':      { why: 'When the network fails, the business fails. Customers need backup connectivity and resilient distribution.', move: 'Build a network resilience consultancy and sell to broadcasters, financial firms, and any business that can\u2019t afford an outage.' },
    'media_concentration': { why: 'Local journalism is collapsing as financial owners cut reporters and raise prices. Customers need an alternative model.', move: 'Build a nonprofit newsroom-in-a-box service or local news SaaS and sell to communities and foundations.' },
    'trust_erosion':       { why: 'Audiences have stopped trusting sources by default. Customers need structured ways to surface evidence and earn that trust back.', move: 'Build a transparency and reader-trust platform and sell to newsrooms and brands.' },
    'coordinated_inauth':  { why: 'Coordinated bot networks and influence operations are flooding the information environment. Customers need investigators and OSINT tools.', move: 'Build an influence operation detection service and sell to government, platforms, and election integrity orgs.' },
    'speech_regulation':   { why: 'Speech laws and platform rules are changing in every direction at once. Customers need a tracker.', move: 'Build a regulatory monitoring service and sell to publishers, broadcasters, and platforms.' },
    'journalism_collapse': { why: 'Working journalists are leaving the field faster than they can be replaced. The remaining ones need tools and training.', move: 'Build journalist training, workflow, or support services and sell to newsrooms and foundations.' },
    'audience_fragment':   { why: 'Audiences have fragmented into niche communities that don\u2019t share an information environment. Each niche is its own market.', move: 'Build niche newsletters, podcasts, or community platforms \u2014 or the tools that power them \u2014 and sell to subscribers.' }
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
    return fetch('/assets/data/deep/communication-branch-index.json')
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

    // Pull live communication feed signals — news volume, RSS media, press freedom, fact-check
    var feeds = state.feeds || [];
    var newsVolume = null, rssMedia = null, pressFreedom = null, factChecks = null, ripeOutages = null;
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      var f = feeds[fpi];
      if (!f.live) continue;
      var fn = (f.name || '').toLowerCase();
      if (fn.indexOf('newsapi') !== -1 || fn.indexOf('headlines') !== -1) newsVolume = f.value;
      if (fn.indexOf('rss media') !== -1) rssMedia = f.value;
      if (fn.indexOf('press freedom') !== -1 || fn.indexOf('rsf') !== -1) pressFreedom = f.value;
      if (fn.indexOf('fact') !== -1 || fn.indexOf('snopes') !== -1 || fn.indexOf('politifact') !== -1) factChecks = f.value;
      if (fn.indexOf('outage') !== -1 || fn.indexOf('cloudflare') !== -1 || fn.indexOf('ripe') !== -1 || fn.indexOf('netblocks') !== -1) ripeOutages = f.value;
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

    // ── Plain-English summary built from REAL communication feed data ──
    // Tone: assume the reader is a smart operator, NOT a media or comms expert.
    // Lead with the news volume number that tells the clearest story.
    var text = '';

    // Lead with the strongest news / discourse signal we have
    if (newsVolume !== null && newsVolume >= 50) {
      text = '<b>The global news cycle is firing at very high volume \u2014 ' + newsVolume + ' major headlines tracked in the last cycle.</b> Heavy news days like this are when misinformation spreads fastest, when newsrooms make mistakes, and when audiences either anchor on the right story or the wrong one. The information environment is loud, and the customers in it (newsrooms, brands, public agencies) are stretched thin. ';
    } else if (newsVolume !== null && newsVolume >= 20) {
      text = '<b>News volume is elevated \u2014 ' + newsVolume + ' major headlines tracked.</b> The information environment is busier than baseline. Watch for narrative cascades and platform amplification of any single story. ';
    } else if (newsVolume !== null) {
      text = '<b>News volume is at a normal background rate (' + newsVolume + ' headlines tracked).</b> The information environment is quiet today, which is the right time to ship long-form, build evergreen content, or position trust-and-safety infrastructure before the next surge. ';
    }

    // Layer in RSS media (broader publisher activity)
    if (rssMedia !== null && rssMedia > 0) {
      text += '<b>' + rssMedia + ' RSS media items</b> moved through the publisher feeds in the last cycle, giving us a read on how active the broader publisher ecosystem is. ';
    }

    // Press freedom / censorship signal
    if (pressFreedom !== null && pressFreedom > 0) {
      text += 'Press-freedom signals are showing <b>' + pressFreedom + '</b> recent incidents \u2014 a leading indicator of legal exposure for journalists and platforms operating in affected regions. ';
    }

    // Fact-check throughput
    if (factChecks !== null && factChecks > 0) {
      text += '<b>' + factChecks + ' fact-checks</b> were published in the last cycle, which tells us how hard the misinformation defenders are working right now. ';
    }

    // Network / connectivity outage signal
    if (ripeOutages !== null && ripeOutages > 0) {
      text += '<b>' + ripeOutages + ' network or connectivity outage events</b> are visible right now \u2014 this is the moment to position resilience and backup-connectivity services. ';
    }

    // Tie back to active diagnoses
    if (activeDx.length > 0) {
      text += '<b>' + activeDx.length + ' active diagnosis ' + (activeDx.length > 1 ? 'pathways are' : 'pathway is') + ' currently confirmed by live evidence.</b> ';
    } else if (newsVolume !== null || rssMedia !== null) {
      text += 'No diagnosis pathways are currently active \u2014 the system is watching for narrative escalation, censorship, telecom failures, and influence operations. ';
    }

    // Fallback if no feeds at all
    if (!text) {
      text = '<b>Communication feeds loading.</b> Waiting for live news, media, press-freedom, and fact-check data. ';
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
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENCommunicationExecutionPanels) {
        h += window.LIMENCommunicationExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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
      var claims = ledger.getClaimsByDomain('communication');
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
          domain: 'communication',
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
      // removed: GRANT/PATENT/BUILD workspace buttons — lanes dropped
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      // CLAIM button (always last)
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'communication') : null;
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

    var bridge = window.LIMENCommunicationPromotionBridge;
    console.log('[CommunicationOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('communication') : null;
      var portalCache = brain ? brain._portalCache : null;
      var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
      console.log('[CommunicationOperator] brain=' + !!brain + ' portalCache=' + !!portalCache + ' activeDx=' + activeDx.length + ' stress=' + state.stress);

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          console.log('[CommunicationOperator] First bridge run — extracting...');
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            console.log('[CommunicationOperator] Bridge returned ' + (promoted ? promoted.length : 0) + ' promoted directives');
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) {
                console.log('[CommunicationOperator] Re-rendering with ' + promoted.length + ' directives');
                _renderOperatorDOM(freshState);
              }
            }
          }).catch(function (err) {
            console.error('[CommunicationOperator] Bridge error:', err);
          });
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        console.log('[CommunicationOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var retryBrain = brains ? brains.get('communication') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          console.log('[CommunicationOperator] Retry: brain=' + !!retryBrain + ' cache=' + !!retryCache);
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            var retryDx = retryState ? (retryState.diagnoses || []).filter(function (d) { return d.active; }).length : 0;
            console.log('[CommunicationOperator] Retry: state=' + !!retryState + ' activeDx=' + retryDx);
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                console.log('[CommunicationOperator] Retry bridge returned ' + (promoted ? promoted.length : 0));
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function (err) {
                console.error('[CommunicationOperator] Retry bridge error:', err);
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
    h += '<div class="eos-title" style="margin-bottom:0">COMMUNICATION \u00b7 OPERATOR SURFACE</div>';
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['communication'], type: 'invest' };

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
        if (!outcome) outcome = 'Linked communication companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=communication&returnTo=' + encodeURIComponent('/domain-console?domain=communication');
      });
    }

    // removed: GRANT/PATENT/BUILD workspace wiring

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
        window.LIMENClaimFlow.openClaimModal(opp, 'communication', function (confirmedOpp, estimate) {
          // Create claim in ledger
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'communication', estimate);
          }
          // Re-render to show CLAIMED badge
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel (global)
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'communication');
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
    if (window.LIMENCommunicationBusinessReview) {
      window.LIMENCommunicationBusinessReview.mount(_operatorView);
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

    console.log('[CommunicationOperator] Booted — operator view created, toggle wired');
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
