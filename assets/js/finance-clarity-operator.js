/**
 * finance-clarity-operator.js — Money-Driven Action Surface for Finance Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 * Company phase/rupture data is READ from kernel outputs (state.companies) — NEVER computed here.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #fos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=finance is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on finance domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'finance') return;

  var VIEW_ID = 'fos-operator-view';
  var STATUS_KEY = 'limen_finance_operator_status';
  var COLLAPSE_KEY = 'limen_finance_collapse_state';
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
  // STYLES — injected once (shared eos- prefix with energy operator)
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
    var brain = brains.get('finance');
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
    'BANKING_CRISIS': {
      what: 'Major banks are under solvency or liquidity stress',
      money: 'Deposit flight creates funding gaps. Distressed asset sales open acquisition windows. Counterparty risk reprices across the entire financial chain. Insurance and resolution frameworks activate.',
      step: 'Check bank CDS spreads on Bloomberg. Monitor FDIC actions. If tier-1 capital ratios drop below 8%, position in acquirers (JPM, BAC) or short exposed regionals.',
      outcome: '15-40% repricing across banking sector during sustained crisis'
    },
    'CREDIT_FREEZE': {
      what: 'Credit markets are seizing — lending has stopped or slowed dramatically',
      money: 'Borrowers cannot refinance. Lenders with cash dominate. Private credit fills the gap at premium rates. Companies with strong balance sheets acquire distressed peers at steep discounts.',
      step: 'Check HY OAS spread on FRED. If above 600bp, credit is frozen. Position in private credit (ARCC, MAIN) or distressed debt funds. Monitor CLO tranches for impairment.',
      outcome: '20-50% returns on private credit during freeze, 30-70% on distressed acquisitions'
    },
    'MARKET_CRASH': {
      what: 'Equity markets are in freefall — broad-based selling across sectors',
      money: 'Panic selling creates mispricing. Hedging instruments spike. Volatility products pay out. Patient capital with pre-set buy levels captures generational entry points.',
      step: 'Check VIX level. If above 40, crash regime is confirmed. Position in long-vol (UVXY short-term only), or accumulate quality names (MSFT, AAPL, BRK.B) at pre-set levels.',
      outcome: '50-200% on volatility plays, 20-40% on quality accumulation within 12 months'
    },
    'CURRENCY_COLLAPSE': {
      what: 'A major currency is losing value rapidly against reserve currencies',
      money: 'Import costs spike for affected country. Export-oriented companies in that country become cheaper. Hard-asset demand surges. FX hedging costs explode for unhedged corporates.',
      step: 'Check DXY and affected currency pair. If devaluation exceeds 15%, position in gold (GLD), dollar-denominated assets, or export companies in the affected economy.',
      outcome: '10-30% on hard assets, 20-50% on correctly positioned FX trades'
    },
    'SYSTEMIC_CONTAGION': {
      what: 'Financial stress is spreading across institutions and markets — contagion is active',
      money: 'Correlation goes to 1. Diversification fails. Only truly uncorrelated assets survive. Counterparty risk forces margin calls and forced selling. Central bank intervention becomes inevitable.',
      step: 'Check financial conditions index (NFCI). Monitor repo rates and FRA-OIS spread. If contagion confirmed, raise cash, buy Treasuries (TLT), and prepare dry powder for post-crisis entry.',
      outcome: 'Capital preservation during crisis, 30-60% on post-crisis reentry'
    },
    'FRAUD_SCANDAL': {
      what: 'Major financial fraud or scandal has been exposed',
      money: 'The fraudulent entity collapses. Competitors capture its market share. Regulators impose new compliance requirements creating consulting and technology demand. Auditors and forensic accountants see procurement surge.',
      step: 'Identify the fraud entity and its competitors. Short the fraud entity if still tradeable. Go long competitors. Position in compliance technology (VRSK, FIS) and forensic consulting.',
      outcome: '15-40% competitor premium, new compliance revenue streams worth $50M-$500M industry-wide'
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

  // Diagnosis → playbook ID for Finance-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'BANKING_CRISIS':       'fin_risk',
    'CREDIT_FREEZE':        'fin_capital',
    'MARKET_CRASH':         'fin_risk',
    'CURRENCY_COLLAPSE':    'fin_risk',
    'SYSTEMIC_CONTAGION':   'fin_regulation',
    'FRAUD_SCANDAL':        'fin_regulation'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'fin_capital',
    'company_stressed':  'fin_risk',
    'convergence':       'fin_regulation',
    'cross_domain':      'fin_capital'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'fin_risk': { title: 'Financial Risk Management', domains: ['finance', 'insurance'], type: 'invest' },
    'fin_capital': { title: 'Capital Markets & Lending', domains: ['finance', 'economy'], type: 'invest' },
    'fin_regulation': { title: 'Regulatory Response & Policy', domains: ['finance', 'governance'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in finance.json portal),
  //             DOMAIN_MAPPED (in finance command board), ETF_PROXY (sector proxy, no company-level validation)
  var INVEST_TARGETS = {
    'fin_risk': [
      { ticker: 'BRK.B', name: 'Berkshire Hathaway',     cik: '1067983', validation: 'HELIX_VALIDATED', reason: 'Diversified financial conglomerate; insurance float and cash reserves provide crisis resilience and acquisition capacity' },
      { ticker: 'ALL',   name: 'Allstate',               cik: '899629',  validation: 'HELIX_VALIDATED', reason: 'Property-casualty insurer; premium income rises during risk repricing events' },
      { ticker: 'PGR',   name: 'Progressive',            cik: '80661',   validation: 'HELIX_VALIDATED', reason: 'Auto and specialty insurer; data-driven underwriting outperforms during volatile loss periods' },
      { ticker: 'MET',   name: 'MetLife',                cik: '1099219', validation: 'HELIX_VALIDATED', reason: 'Life and benefits insurer; rising rate environment boosts investment portfolio returns' },
      { ticker: 'TRV',   name: 'Travelers Companies',    cik: '86312',   validation: 'HELIX_VALIDATED', reason: 'Commercial insurance leader; hardening market cycle drives premium growth and margin expansion' },
      { ticker: 'CB',    name: 'Chubb',                  cik: '896159',  validation: 'HELIX_VALIDATED', reason: 'Global P&C insurer; diversified book and strong reserves weather systemic stress' }
    ],
    'fin_capital': [
      { ticker: 'JPM',  name: 'JPMorgan Chase',          cik: '19617',   validation: 'HELIX_VALIDATED', reason: 'Largest US bank; market-making and lending dominance captures share during credit stress' },
      { ticker: 'GS',   name: 'Goldman Sachs',           cik: '886982',  validation: 'HELIX_VALIDATED', reason: 'Investment banking leader; advisory and trading revenue surges during market dislocation' },
      { ticker: 'MS',   name: 'Morgan Stanley',          cik: '895421',  validation: 'HELIX_VALIDATED', reason: 'Wealth management and institutional securities; diversified revenue base resilient in downturns' },
      { ticker: 'BLK',  name: 'BlackRock',               cik: '1364742', validation: 'HELIX_VALIDATED', reason: 'Largest asset manager; fee income from $10T+ AUM provides stability; Aladdin platform is infrastructure' },
      { ticker: 'KKR',  name: 'KKR & Co',                cik: '1404912', validation: 'HELIX_VALIDATED', reason: 'Alternative asset manager; distressed investing expertise activates during credit freezes' },
      { ticker: 'BX',   name: 'Blackstone',              cik: '1393818', validation: 'HELIX_VALIDATED', reason: 'Largest alternative asset manager; real estate, credit, and PE dry powder deploys into dislocation' }
    ],
    'fin_regulation': [
      { ticker: 'SPGI', name: 'S&P Global',              cik: '64040',   validation: 'HELIX_VALIDATED', reason: 'Ratings and analytics provider; regulatory demand for credit assessments increases during stress' },
      { ticker: 'MCO',  name: 'Moody\'s',                cik: '1059556', validation: 'HELIX_VALIDATED', reason: 'Credit ratings agency; issuance and surveillance revenue rises with regulatory attention' },
      { ticker: 'ICE',  name: 'Intercontinental Exchange',cik: '1571949', validation: 'HELIX_VALIDATED', reason: 'Exchange and clearing operator; trading volumes spike during volatility; clearing mandate benefits' },
      { ticker: 'CME',  name: 'CME Group',               cik: '1156375', validation: 'HELIX_VALIDATED', reason: 'Derivatives exchange; hedging demand surges during financial stress; clearing infrastructure is essential' },
      { ticker: 'FIS',  name: 'Fidelity National Info',   cik: '1136893', validation: 'HELIX_VALIDATED', reason: 'Financial technology infrastructure; compliance and reporting technology demand rises with new regulations' },
      { ticker: 'FISV', name: 'Fiserv',                  cik: '798354',  validation: 'HELIX_VALIDATED', reason: 'Payment processing and fintech; regulatory technology and fraud detection demand increases post-scandal' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → fin_risk
    if (opp.source === 'lagging') return 'fin_risk';
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Finance condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Finance portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=finance&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
  // MECHANISM EXPLANATION — plain-language story for each mechanism
  // ══════════════════════════════════════════════════════════════════════

  // Per-diagnosis, per-mechanism: WHY THIS MATTERS + COMMERCIAL MOVE
  var MECH_EXPLAIN = {
    'BANKING_CRISIS': {
      'credit_contraction':   { why: 'Banks are pulling back lending. Credit lines are being reduced or revoked. Businesses that depend on revolving credit face immediate liquidity crises.', move: 'Build a credit exposure map. Sell it to CFOs, treasury teams, and private credit funds looking to fill the gap left by retreating banks.' },
      'liquidity_drain':      { why: 'Cash is leaving the banking system. Deposits are fleeing to safety. Banks cannot fund their loan books. Interbank lending freezes.', move: 'Build a deposit flight tracker. Sell it to bank risk teams, regulators, and hedge funds positioning around the liquidity crisis.' },
      'counterparty_risk':    { why: 'Nobody trusts anybody. Counterparty exposure is being re-evaluated across every trading desk. Collateral calls are cascading.', move: 'Build a counterparty exposure model. Sell it to trading desks, clearinghouses, and risk management teams scrambling to understand their net exposure.' },
      'solvency_stress':      { why: 'Bank capital ratios are declining. Loan losses are mounting. The gap between assets and liabilities is widening toward insolvency.', move: 'Build a bank solvency scorecard. Sell it to regulators, deposit insurers, and acquirers evaluating which banks will survive and which will be resolved.' },
      'contagion_spread':     { why: 'Stress at one bank is spreading to others through shared exposures, common funding sources, and market panic. The interconnections become the transmission mechanism.', move: 'Build a contagion mapping tool. Sell it to central banks, systemic risk committees, and macro funds positioning around the cascade.' }
    },
    'CREDIT_FREEZE': {
      'credit_contraction':   { why: 'Credit markets have seized. New issuance has stopped. Existing credit facilities are being drawn down as borrowers grab whatever they can before lines close.', move: 'Build a credit market status dashboard. Sell it to corporate treasurers, private credit funds, and regulators monitoring the freeze.' },
      'liquidity_drain':      { why: 'Liquidity has evaporated from credit markets. Bid-ask spreads have blown out. Bonds that traded daily now have no buyers.', move: 'Build a liquidity heat map for credit instruments. Sell it to fixed income desks and institutional investors trapped in illiquid positions.' },
      'rate_transmission':    { why: 'Central bank rate signals are not reaching borrowers. The transmission mechanism from policy rates to market rates is broken.', move: 'Build a rate transmission monitor. Sell it to central bank analysts, bank economists, and fixed income strategists tracking the disconnect.' },
      'refinancing_wall':     { why: 'A wave of debt is maturing and cannot be refinanced. Companies face default not because they are bad businesses, but because the credit market is closed.', move: 'Build a maturity wall tracker. Sell it to distressed debt funds, restructuring advisors, and the companies themselves who need to know their exposure.' }
    },
    'MARKET_CRASH': {
      'price_dislocation':    { why: 'Asset prices have detached from fundamentals. Panic selling has driven valuations to levels not justified by earnings, cash flow, or book value.', move: 'Build a dislocation scorecard that compares current prices to fundamental anchors. Sell it to value investors, pension funds, and family offices with dry powder.' },
      'volatility_spike':     { why: 'Implied and realized volatility have spiked to crisis levels. Options premiums are extreme. Hedging costs have made normal portfolio management impossible.', move: 'Build a volatility regime classifier. Sell it to options desks, systematic funds, and risk teams trying to distinguish between hedging and speculation in extreme vol.' },
      'margin_cascade':       { why: 'Margin calls are forcing involuntary selling. Leveraged positions are being liquidated regardless of fundamental value. Forced selling begets more forced selling.', move: 'Build a margin pressure model. Sell it to prime brokers, hedge fund risk teams, and opportunistic buyers waiting for the forced selling to exhaust itself.' },
      'liquidity_drain':      { why: 'Market makers have withdrawn. Order books are thin. Large orders move prices by multiples of normal impact. Execution quality has collapsed.', move: 'Build a market microstructure monitor. Sell it to institutional trading desks and execution algorithms that need to navigate thin markets without excessive impact.' }
    },
    'CURRENCY_COLLAPSE': {
      'rate_transmission':    { why: 'Interest rate differentials have blown out. The central bank is losing control of its currency through conventional rate policy. Emergency measures are being considered.', move: 'Build a rate differential tracker with policy response scenarios. Sell it to FX desks, multinational treasurers, and sovereign wealth funds managing currency risk.' },
      'capital_flight':       { why: 'Capital is leaving the country. Investors, corporations, and citizens are converting local currency to hard assets and foreign currencies as fast as possible.', move: 'Build a capital flow monitor. Sell it to central banks, IMF analysts, and macro funds positioning around the outflow and eventual stabilization.' },
      'trade_disruption':     { why: 'Import costs are spiking for the affected country. Trade finance is drying up as nobody wants to extend credit in the collapsing currency.', move: 'Build a trade finance impact model. Sell it to exporters to the affected country, trade finance banks, and supply chain managers facing payment risk.' },
      'contagion_spread':     { why: 'The currency collapse is spreading to neighboring economies and trading partners. Markets are testing other currencies with similar vulnerabilities.', move: 'Build a currency vulnerability scorecard. Sell it to FX desks, emerging market funds, and central banks trying to assess which currency falls next.' }
    },
    'SYSTEMIC_CONTAGION': {
      'contagion_spread':     { why: 'Financial stress is spreading through interconnected institutions. Common exposures, shared funding sources, and market panic create self-reinforcing feedback loops.', move: 'Build a systemic risk map showing institution-to-institution linkages. Sell it to regulators, central banks, and macro funds positioning around the contagion path.' },
      'counterparty_risk':    { why: 'Every institution is re-evaluating every counterparty. Trading relationships that functioned for decades are being questioned. Novation and portfolio compression become urgent.', move: 'Build a counterparty network analyzer. Sell it to CCPs, prime brokers, and risk committees needing to understand second and third-order exposures.' },
      'liquidity_drain':      { why: 'System-wide liquidity is disappearing. Central bank facilities are the only functioning source of funding. Collateral requirements are being tightened everywhere.', move: 'Build a system liquidity dashboard. Sell it to central banks, treasury departments, and any institution that needs to know where the last pockets of liquidity remain.' },
      'solvency_stress':      { why: 'Multiple institutions are approaching insolvency simultaneously. Resolution frameworks designed for one-at-a-time failures are being overwhelmed.', move: 'Build a multi-institution stress test. Sell it to deposit insurers, resolution authorities, and acquirers evaluating which institutions to save and which to let fail.' }
    },
    'FRAUD_SCANDAL': {
      'regulatory_response':  { why: 'Regulators are launching investigations, issuing emergency orders, and drafting new rules. The compliance landscape is changing in real time.', move: 'Build a regulatory action tracker. Sell it to compliance teams, legal departments, and consulting firms advising affected institutions on the new requirements.' },
      'counterparty_risk':    { why: 'Everyone who did business with the fraudulent entity is re-evaluating their exposure. Contracts may be voidable. Recoveries are uncertain. Legal claims are forming.', move: 'Build a fraud exposure assessment. Sell it to counterparties, creditors, and litigation funders evaluating claims against the fraudulent entity.' },
      'trust_erosion':        { why: 'Market trust has been damaged. Investors are pulling capital from similar entities. Due diligence standards are being raised. The entire sector faces a credibility discount.', move: 'Build a sector trust recovery model. Sell it to the competitors who need to demonstrate they are different, and to investors deciding when the credibility discount has gone too far.' },
      'compliance_demand':    { why: 'Every institution in the sector is upgrading its compliance function. Board risk committees are demanding new controls. Auditors and forensic specialists are in high demand.', move: 'Build a compliance gap assessment framework. Sell it to institutions rushing to demonstrate their own controls are adequate before regulators come asking.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn't exist
  var MECH_FALLBACK = {
    'credit_contraction':   { why: 'Credit availability is shrinking. Borrowers face tighter conditions.', move: 'Build a credit conditions monitor and sell it to affected borrowers and lenders.' },
    'liquidity_drain':      { why: 'Liquidity is leaving the system. Markets are becoming harder to trade.', move: 'Build a liquidity tracker and sell it to institutional participants.' },
    'counterparty_risk':    { why: 'Counterparty exposure is being re-evaluated across the system.', move: 'Build an exposure mapping tool and sell it to risk management teams.' },
    'solvency_stress':      { why: 'Institution solvency is under pressure. Capital adequacy is declining.', move: 'Build a solvency scorecard and sell it to regulators and acquirers.' },
    'contagion_spread':     { why: 'Financial stress is spreading through interconnected institutions.', move: 'Build a contagion map and sell it to systemic risk monitors.' },
    'rate_transmission':    { why: 'Policy rate changes are not reaching market rates as expected.', move: 'Build a transmission monitor and sell it to central bank analysts.' },
    'price_dislocation':    { why: 'Asset prices have moved away from fundamental value.', move: 'Build a dislocation scorecard and sell it to value-oriented investors.' },
    'volatility_spike':     { why: 'Market volatility has surged to crisis levels.', move: 'Build a volatility regime model and sell it to options desks and risk teams.' },
    'capital_flight':       { why: 'Capital is fleeing to safety. Asset allocation is shifting rapidly.', move: 'Build a flow monitor and sell it to asset managers and central banks.' },
    'regulatory_response':  { why: 'Regulators are acting in response to financial stress or fraud.', move: 'Build a regulatory tracker and sell it to compliance teams.' }
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

    if (di.portalDomainId || (di.ancestryPath && di.ancestryPath.length > 0)) { var _pid = di.portalDomainId || di.ancestryPath[di.ancestryPath.length - 1]; h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + esc(_pid) + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + esc(_pid) + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>'; }
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
    return fetch('/assets/data/deep/finance-branch-index.json')
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
        h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + portalDomainId + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + portalDomainId + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>';
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
      // Econ relevance gate — relaxed when no active diagnoses (prebuilt pool is pre-ranked)
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

    // Get financial stress indicators from feeds
    var vixLevel = null;
    var spreadLevel = null;
    var feeds = state.feeds || [];
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      if (feeds[fpi].value && feeds[fpi].live) {
        if (feeds[fpi].id && feeds[fpi].id.indexOf('vix') !== -1) vixLevel = feeds[fpi].value;
        if (feeds[fpi].id && feeds[fpi].id.indexOf('spread') !== -1) spreadLevel = feeds[fpi].value;
        if (!vixLevel && !spreadLevel) { vixLevel = feeds[fpi].value; }
      }
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

    // Build summary from financial stress data
    var text = '';
    if (pct >= 70) {
      text = '<b>Financial system stress at ' + pct + '% \u2014 crisis territory.</b> Multiple stress pathways are active. Credit markets, equity markets, or banking system are under acute pressure. ';
      if (activeDx.length > 0) {
        text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed by live evidence. This is where money is made \u2014 or lost.';
      }
    } else if (pct >= 50) {
      text = '<b>Financial stress at ' + pct + '% \u2014 elevated.</b> One or more financial subsystems are showing strain. Positioning windows are forming for those who see the signal early. ';
      if (activeDx.length > 0) text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + '.';
    } else if (pct >= 25) {
      text = '<b>Financial stress at ' + pct + '%.</b> Above baseline but within normal volatility range. ';
      if (activeDx.length > 0) {
        text += activeDx.length + ' diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' active. ';
      } else {
        text += 'No diagnosis pathways active at current levels. ';
      }
      text += 'Monitoring for escalation.';
    } else if (pct > 0) {
      text = '<b>Financial stress at ' + pct + '%.</b> Within normal range. No acute pressure on banking, credit, or equity systems. ';
      if (activeDx.length === 0) text += 'No immediate money on the table from financial stress alone.';
    } else {
      // No live stress data
      text = '<b>Financial feeds loading.</b> Waiting for live market stress data. ';
      if (pulse && pulse.deadCount > 0) text += pulse.deadCount + ' source(s) offline. ';
      text += 'Assessments are provisional until live data arrives.';
    }

    // Pulse regime context
    if (pulse && pulse.regime === 'crisis') {
      text += ' <b style="color:#e85454">Regime: CRISIS.</b> Multiple positioning windows are open.';
    } else if (pulse && pulse.regime === 'elevated') {
      text += ' Regime: ELEVATED. Positioning windows may be forming.';
    }

    // Kernel company data — READ ONLY from state.companies
    var companies = state.companies || [];
    if (companies.length > 0) {
      var terminalCount = 0;
      var stressedCount = 0;
      for (var ci = 0; ci < companies.length; ci++) {
        var comp = companies[ci];
        if (comp.phase === 'terminal' || comp.phase === 'rupture') terminalCount++;
        else if (comp.phase === 'stressed' || comp.phase === 'warning') stressedCount++;
      }
      if (terminalCount > 0) text += ' <b style="color:#e85454">' + terminalCount + ' company(ies) in terminal/rupture phase</b> (kernel-validated).';
      if (stressedCount > 0) text += ' ' + stressedCount + ' company(ies) in stress/warning phase.';
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
      h += '<div style="font-size:0.28rem;color:#5ab5a0;margin:3px 0">PAY: ' + (comp.base || 0) + (comp.unit || '%') + ' \u00b7 NEXT: ' + (comp.nextTier ? comp.nextTier.comp + (comp.unit || '%') : '?') + ' \u00b7 MAX: ' + (comp.maxTier ? comp.maxTier.comp : '?') + (comp.unit || '%') + '</div>';

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
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENFinanceExecutionPanels) {
        h += window.LIMENFinanceExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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
    var economy = window.LIMENFinance && window.LIMENFinance.economy;
    var claimsMap = economy && economy.claims ? economy.claims : null;
    var ledger = window.LIMENClaimLedger;
    if (ledger) {
      var claims = ledger.getClaimsByDomain('finance');
      var oppIds = {};
      for (var oi = 0; oi < opps.length; oi++) oppIds[opps[oi].id || oppKey(opps[oi])] = true;
      for (var cli = 0; cli < claims.length; cli++) {
        var claim = claims[cli];
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
          domain: 'finance',
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
      // CLAIM button — domain-scoped via window.LIMENFinance.economy
      var _claimExisting = null;
      if (economy && economy.claims) {
        _claimExisting = economy.claims[o.id || key] || null;
      } else if (window.LIMENClaimLedger) {
        _claimExisting = window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'finance');
      }
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

    var bridge = window.LIMENFinancePromotionBridge;
    console.log('[FinanceOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('finance') : null;
      var portalCache = brain ? brain._portalCache : null;
      var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
      console.log('[FinanceOperator] brain=' + !!brain + ' portalCache=' + !!portalCache + ' activeDx=' + activeDx.length + ' stress=' + state.stress);

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          console.log('[FinanceOperator] First bridge run — extracting...');
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            console.log('[FinanceOperator] Bridge returned ' + (promoted ? promoted.length : 0) + ' promoted directives');
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) {
                console.log('[FinanceOperator] Re-rendering with ' + promoted.length + ' directives');
                _renderOperatorDOM(freshState);
              }
            }
          }).catch(function (err) {
            console.error('[FinanceOperator] Bridge error:', err);
          });
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        console.log('[FinanceOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var retryBrain = brains ? brains.get('finance') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          console.log('[FinanceOperator] Retry: brain=' + !!retryBrain + ' cache=' + !!retryCache);
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            var retryDx = retryState ? (retryState.diagnoses || []).filter(function (d) { return d.active; }).length : 0;
            console.log('[FinanceOperator] Retry: state=' + !!retryState + ' activeDx=' + retryDx);
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                console.log('[FinanceOperator] Retry bridge returned ' + (promoted ? promoted.length : 0));
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function (err) {
                console.error('[FinanceOperator] Retry bridge error:', err);
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
    h += '<div class="eos-title" style="margin-bottom:0">FINANCE \u00b7 OPERATOR SURFACE</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<button id="fos-back-to-console" style="font-family:monospace;font-size:0.32rem;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer;transition:all 0.2s">\u2190 CONSOLE</button>';
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
    var backBtn = document.getElementById('fos-back-to-console');
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

    // Accordion delegation is bound ONCE on _operatorView (see boot() below)

    // Wire INVEST deep-link buttons — canonical playbook IDs only
    var investBtns = _operatorView.querySelectorAll('[data-pb-id]');
    for (var ib = 0; ib < investBtns.length; ib++) {
      investBtns[ib].addEventListener('click', function (e) {
        e.stopPropagation();
        var pbId = this.getAttribute('data-pb-id');
        var oppTitle = this.getAttribute('data-opp-title');
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['finance'], type: 'invest' };

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
        if (!branchUp) branchUp = 'Thesis confirmed — linked financial companies reprice higher. Stress persists above ' + stressPct + '%, driving capital allocation and regulatory demand.';

        // Generate branch_down from invalidation
        var branchDown = mc.invalidIf || (matchOpp && matchOpp.failure) || '';
        if (!branchDown) branchDown = 'Stress resolves below 50%. Diagnosis deactivates. Financial sector tailwind dissipates before positions capture repricing.';
        if (targetNames) branchDown += ' Reduce exposure in: ' + targetNames + '.';

        // Generate outcome from thesis
        var outcome = '';
        if (matchOpp && matchOpp.valueRange) outcome = 'Value range: ' + matchOpp.valueRange + '. ';
        if (matchOpp && matchOpp.outcome) outcome += matchOpp.outcome;
        else if (mc.whyPays) outcome += mc.whyPays;
        if (mc.timing) outcome += ' Timing: ' + mc.timing;
        if (!outcome) outcome = 'Linked financial companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=finance&returnTo=' + encodeURIComponent('/domain-console?domain=finance');
      });
    }

    // Wire GRANT/PATENT/BUILD buttons — open execution workspace inline
    // removed: GRANT/PATENT/BUILD workspace wiring

    // Wire CLAIM buttons — domain-scoped via window.LIMENFinance.economy
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
        // Domain-scoped claim flow via window.LIMENFinance.economy
        var economy = window.LIMENFinance && window.LIMENFinance.economy;
        if (opp && economy && economy.claimFlow) {
          economy.claimFlow(opp, 'finance', function (confirmedOpp, estimate) {
            if (window.LIMENClaimLedger) {
              window.LIMENClaimLedger.createClaim(confirmedOpp, 'finance', estimate);
            }
            renderOperator();
          });
          return;
        }
        // Fallback to global claim flow
        if (!opp || !window.LIMENClaimFlow) return;
        window.LIMENClaimFlow.openClaimModal(opp, 'finance', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'finance', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel — domain-scoped
    var economy = window.LIMENFinance && window.LIMENFinance.economy;
    if (economy && economy.panel) {
      economy.panel.inject();
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
    if (window.LIMENFinanceBusinessReview) {
      window.LIMENFinanceBusinessReview.mount(_operatorView);
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
        var tidx = targetRow.getAttribute('data-target-idx');
        var detail = _operatorView.querySelector('[data-target-detail="' + tidx + '"]');
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
      if (loadBranchBtn) {
        _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch'));
        return;
      }
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

    console.log('[FinanceOperator] Booted — operator view created, toggle wired');
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
