/**
 * infrastructure-clarity-operator.js — Money-Driven Action Surface for Infrastructure Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #ios-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=infrastructure is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on infrastructure domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'infrastructure') return;

  var VIEW_ID = 'ios-operator-view';
  var STATUS_KEY = 'limen_infrastructure_operator_status';
  var COLLAPSE_KEY = 'limen_infrastructure_collapse_state';
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
    if (brains) {
      var brain = brains.get('infrastructure');
      if (brain) return brain.getState();
    }
    // Fallback to direct global
    if (window.LIMENInfrastructureBrain) return window.LIMENInfrastructureBrain.getState();
    return null;
  }

  function getStatusMap() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function promotedBadge(o) {
    if (!o || o.source !== 'portal_directive' || !o._directive) return '';
    var d = o._directive;
    var depth = d.depth != null ? d.depth : 0;
    var node = d.nodeLabel || d.nodeId || '';
    var portal = d.portalTitle || d.portalDomainId || '';
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
    'GRID_DEGRADATION': {
      what: 'Infrastructure grid systems are degrading',
      money: 'Grid modernization contracts and emergency maintenance positioning accelerate. Utilities and municipalities must upgrade aging infrastructure or face cascading failures.',
      step: 'Check DOE grid modernization grants on grants.gov. Monitor utility capital expenditure announcements. Position in grid infrastructure companies (PWR, PAVE).',
      outcome: '$250K-$5M government contracts, 15-30% infrastructure sector premium during modernization cycle'
    },
    'SUPPLY_CHAIN_BOTTLENECK': {
      what: 'Construction material supply chains are stressed',
      money: 'Alternative sourcing and logistics optimization create margin. Companies with existing inventory or alternative supply relationships command pricing power.',
      step: 'Monitor Construction Materials Price Index. Check cement, steel, and aggregate availability. Position in companies with supply chain resilience (VMC, MLM, URI).',
      outcome: '10-25% margin expansion for well-positioned suppliers and contractors'
    },
    'CAPACITY_OVERLOAD': {
      what: 'Infrastructure capacity is at critical limits',
      money: 'Demand management and capacity expansion projects are funded. Emergency expansion contracts command premium pricing. Congestion pricing systems create new revenue streams.',
      step: 'Monitor ASCE infrastructure report card. Check state DOT capacity reports. Position in capacity expansion contractors and technology providers.',
      outcome: '$500K-$10M capacity expansion contracts, 20-40% premium for emergency work'
    },
    'FUNDING_COLLAPSE': {
      what: 'Federal infrastructure funding gaps are widening',
      money: 'Grant positioning and PPP structures capture available capital. Municipal bond advisory demand surges. Alternative financing mechanisms create new fee opportunities.',
      step: 'Monitor Congressional appropriations. Check IIJA funding status. Register on sam.gov for federal grants. Position in municipal bond advisory and PPP structuring.',
      outcome: '$100K-$2M advisory fees, 15-25% premium on PPP structuring'
    },
    'MAINTENANCE_DEFICIT': {
      what: 'Deferred maintenance is reaching critical threshold',
      money: 'Emergency maintenance and asset rehabilitation contracts accelerate. Asset management technology demand surges. Insurance and inspection services see premium pricing.',
      step: 'Monitor state infrastructure condition reports. Check ASCE grades by infrastructure type. Position in maintenance contractors and asset management technology (XYL, MWA).',
      outcome: '$250K-$5M rehabilitation contracts, 20-35% maintenance sector premium'
    },
    'CYBER_PHYSICAL_ATTACK': {
      what: 'Infrastructure cyber threats are active',
      money: 'Security hardening and resilience deployment contracts are urgent. SCADA security upgrades and physical security systems see emergency procurement. Incident response consulting commands premium.',
      step: 'Monitor CISA alerts for infrastructure sectors. Check DHS cyber threat assessments. Position in infrastructure security companies and incident response firms.',
      outcome: '$500K-$5M security hardening contracts, 30-50% premium for incident response'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };

  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL INVESTMENT PLAYBOOK MAPPING
  // ══════════════════════════════════════════════════════════════════════

  var DX_TO_PLAYBOOK = {
    'GRID_DEGRADATION':         'infra_modernization',
    'SUPPLY_CHAIN_BOTTLENECK':  'infra_maintenance',
    'CAPACITY_OVERLOAD':        'infra_modernization',
    'FUNDING_COLLAPSE':         'infra_funding',
    'MAINTENANCE_DEFICIT':      'infra_maintenance',
    'CYBER_PHYSICAL_ATTACK':    'infra_modernization'
  };

  var SOURCE_TO_PLAYBOOK = {
    'portal_directive':  'infra_modernization',
    'diagnosis':         'infra_funding',
    'cross_domain':      'infra_funding',
    'company_terminal':  'infra_modernization',
    'company_stressed':  'infra_maintenance',
    'convergence':       'infra_funding',
    'lagging':           'infra_maintenance',
    'near_diagnosis':    'infra_modernization'
  };

  var PLAYBOOK_DEFS = {
    'infra_funding': {
      title: 'Infrastructure Funding & Finance',
      label: 'Infrastructure Funding & Finance',
      domains: ['infrastructure', 'finance'],
      type: 'invest',
      explain: 'Infrastructure funding gaps create demand for municipal bond advisory, PPP structuring, federal grant positioning, and alternative financing mechanisms.',
      steps: ['Monitor Congressional appropriations and IIJA funding status', 'Register on sam.gov and grants.gov for federal infrastructure grants', 'Build relationships with municipal finance officers and state DOT contacts', 'Structure PPP proposals for unfunded infrastructure projects', 'Position in infrastructure-focused financial instruments'],
      examples: ['Municipal bond structuring for water system upgrades', 'PPP advisory for toll road concessions', 'Federal grant writing for rural broadband'],
      investTargets: 'infra_funding'
    },
    'infra_maintenance': {
      title: 'Asset Maintenance & Rehabilitation',
      label: 'Asset Maintenance & Rehabilitation',
      domains: ['infrastructure', 'operations'],
      type: 'invest',
      explain: 'Deferred maintenance reaching critical thresholds creates urgent demand for rehabilitation contracts, asset management technology, and inspection services.',
      steps: ['Monitor state infrastructure condition reports and ASCE grades', 'Identify municipalities with critical maintenance backlogs', 'Position maintenance crews and equipment for emergency contracts', 'Deploy asset management and monitoring technology', 'Build relationships with utility operations managers'],
      examples: ['Emergency bridge rehabilitation contracts', 'Water main replacement programs', 'SCADA system upgrades for aging utilities'],
      investTargets: 'infra_maintenance'
    },
    'infra_modernization': {
      title: 'Infrastructure Modernization & Technology',
      label: 'Infrastructure Modernization & Technology',
      domains: ['infrastructure', 'technology'],
      type: 'invest',
      explain: 'Grid degradation, capacity overload, and cyber threats drive demand for smart infrastructure, digital twins, modern monitoring systems, and security hardening.',
      steps: ['Track DOE grid modernization and smart infrastructure grants', 'Deploy IoT sensors and monitoring platforms at pilot sites', 'Build digital twin capabilities for infrastructure assets', 'Develop cybersecurity solutions for SCADA and OT networks', 'Partner with utilities and municipalities on modernization programs'],
      examples: ['Smart grid deployment for rural electric cooperatives', 'Digital twin platform for bridge structural monitoring', 'SCADA security hardening for water utilities'],
      investTargets: 'infra_modernization'
    }
  };

  var INVEST_TARGETS = {
    'infra_funding': [
      { ticker: 'BIP',  name: 'Brookfield Infrastructure',    cik: '1406234', validation: 'HELIX_VALIDATED', reason: 'Global infrastructure owner-operator; diversified across utilities, transport, energy, and data infrastructure' },
      { ticker: 'ACM',  name: 'AECOM',                        cik: '868857',  validation: 'NODE_MAPPED',     reason: 'Infrastructure advisory and design; project management for transportation, water, and government facilities' },
      { ticker: 'PWR',  name: 'Quanta Services',              cik: '1040971', validation: 'HELIX_VALIDATED', reason: 'Electric power, oil/gas, and telecommunications infrastructure services; grid construction leader' },
      { ticker: 'PAVE', name: 'Global X US Infrastructure',   cik: null,      validation: 'ETF_PROXY',       reason: 'Infrastructure ETF \u2014 thematic proxy for US infrastructure spending and modernization' }
    ],
    'infra_maintenance': [
      { ticker: 'XYL',  name: 'Xylem',                        cik: '1524472', validation: 'HELIX_VALIDATED', reason: 'Water infrastructure technology; pumps, treatment, analytics, and smart metering for utilities' },
      { ticker: 'MWA',  name: 'Mueller Water Products',       cik: '1392857', validation: 'NODE_MAPPED',     reason: 'Water distribution products; fire hydrants, valves, and leak detection for municipal water systems' },
      { ticker: 'MTZ',  name: 'MasTec',                       cik: '876365',  validation: 'NODE_MAPPED',     reason: 'Infrastructure construction; pipeline, electrical transmission, and telecommunications contractor' },
      { ticker: 'FLR',  name: 'Fluor Corporation',             cik: '1124198', validation: 'DOMAIN_MAPPED',  reason: 'Engineering and construction services; infrastructure, mining, and government projects worldwide' }
    ],
    'infra_modernization': [
      { ticker: 'TRMB', name: 'Trimble',                      cik: '864749',  validation: 'HELIX_VALIDATED', reason: 'Positioning technology and digital solutions for construction, transportation, and utility infrastructure' },
      { ticker: 'BSY',  name: 'Bentley Systems',              cik: '1797907', validation: 'NODE_MAPPED',     reason: 'Infrastructure engineering software; digital twins, BIM, and asset performance management' },
      { ticker: 'ITRI', name: 'Itron',                         cik: '780571',  validation: 'NODE_MAPPED',     reason: 'Smart infrastructure technology; smart meters, sensors, and grid edge intelligence for utilities' },
      { ticker: 'AMT',  name: 'American Tower',               cik: '1053507', validation: 'DOMAIN_MAPPED',  reason: 'Communications infrastructure; tower and data center operator supporting broadband expansion' }
    ]
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    if (opp.source === 'lagging') return 'infra_maintenance';
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
    h += '<div class="eos-targets-header" data-section="targets-' + pbId + '">';
    h += '<div class="eos-title" style="margin-bottom:0;font-size:0.26rem">SUGGESTED TARGETS \u00b7 ' + targets.length + '</div>';
    h += '<span style="font-size:0.22rem;color:rgba(201,169,78,0.25)">' + (tCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="targets-' + pbId + '"' + (tCollapsed ? ' style="display:none"' : '') + '>';
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Infrastructure condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var v = VAL_LABELS[t.validation] || { label: t.validation, cls: '' };
      var shortFit = t.reason.length > 60 ? t.reason.substring(0, 57) + '...' : t.reason;

      h += '<div class="eos-target-row" data-target-idx="' + pbId + '-' + i + '">';
      h += '<span class="eos-target-ticker">' + esc(t.ticker) + '</span>';
      h += '<span class="eos-target-name">' + esc(t.name) + '</span>';
      h += '<span class="eos-target-cik">' + (t.cik ? 'CIK ' + esc(t.cik) : '') + '</span>';
      h += '<span class="eos-target-val ' + v.cls + '">' + v.label + '</span>';
      h += '<span class="eos-target-fit">' + esc(shortFit) + '</span>';
      h += '<span class="eos-target-expand">\u25BC</span>';
      h += '</div>';

      h += '<div class="eos-target-detail" data-target-detail="' + pbId + '-' + i + '">';
      h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why it fits:</b> ' + esc(t.reason) + '</div>';
      if (t.validation === 'ETF_PROXY') h += '<div style="margin-bottom:4px;color:#807868">This is an ETF sector proxy, not a company-level Helix-validated pick.</div>';
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to an Infrastructure portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=infrastructure&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      if (!t.cik && t.ticker) h += '<a class="eos-target-link" href="company-portal.html?company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      h += '</div>';
      h += '</div>';
    }

    h += '</div>';
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM EXPLANATION — plain-language story for each mechanism
  // ══════════════════════════════════════════════════════════════════════

  var MECH_EXPLAIN = {
    'GRID_DEGRADATION': {
      'infrastructure_stress': { why: 'Aging transmission and distribution assets are exceeding design life. Transformer failures, substation faults, and line sag events are increasing. Load growth from electrification and data centers is accelerating degradation beyond maintenance capacity.', move: 'Build a grid asset condition scoring model. Sell it to T&D utilities planning capital replacement cycles. Bid into IIJA-funded grid resilience upgrade programs via grants.gov.' },
      'supply_disruption':     { why: 'Replacement transformers, switchgear, and grid components have 12-36 month lead times. Utilities cannot source critical equipment fast enough to address cascading failures.', move: 'Build a grid equipment availability tracker. Sell it to utilities and EPC contractors competing for constrained inventory. Position in transformer and switchgear manufacturers (HUBB, ETN).' },
      'production_impact':     { why: 'Grid degradation is reducing power delivery capacity. Industrial customers face curtailment risk. Data centers and manufacturing facilities cannot get reliable interconnection.', move: 'Build a grid capacity constraint map. Sell it to industrial site selectors, data center developers, and utilities managing interconnection queues.' },
      'policy_response':       { why: 'State utility commissions and FERC are issuing emergency reliability orders. DOE is accelerating grid modernization grant programs under IIJA. Utilities face mandatory upgrade timelines.', move: 'Build a regulatory compliance tracker for grid reliability orders. Sell it to utilities and their engineering firms. Position for DOE grid modernization grants on sam.gov.' }
    },
    'SUPPLY_CHAIN_BOTTLENECK': {
      'supply_disruption':     { why: 'Cement, structural steel, aggregates, and specialty pipe are in short supply. Construction projects are delayed 3-6 months waiting for materials. Price escalation clauses are being triggered across active contracts.', move: 'Build a construction materials availability index. Sell it to general contractors, state DOTs, and project owners managing procurement risk. Position in aggregate producers (VMC, MLM).' },
      'logistics_constraint':  { why: 'Trucks, rail cars, and barges carrying construction materials are congested at key corridors. Delivery windows are unreliable. Jobsite staging areas are backing up.', move: 'Build a construction logistics bottleneck map. Sell it to heavy civil contractors and state DOT project managers. Identify alternative material sourcing routes.' },
      'contract_mispricing':   { why: 'Fixed-price infrastructure contracts signed before the shortage are now underwater. Contractors face margin compression or force majeure decisions. Change orders are multiplying.', move: 'Build a contract repricing model for infrastructure projects. Sell it to contractors, project owners, and surety bond underwriters evaluating exposure.' },
      'inventory_imbalance':   { why: 'Contractors who pre-purchased materials hold pricing advantage. Those without inventory face spot market premiums of 20-40%. Material substitution decisions are being forced.', move: 'Build a materials position tracker. Sell it to contractors managing multi-project inventory. Advise on strategic pre-purchase for upcoming bid cycles.' }
    },
    'CAPACITY_OVERLOAD': {
      'infrastructure_stress': { why: 'Roads, bridges, water systems, and transit networks are operating beyond design capacity. Peak-hour congestion, water pressure drops, and transit overcrowding are chronic. Emergency repairs cannot keep pace with wear.', move: 'Build a capacity utilization dashboard by infrastructure type. Sell it to state DOTs, transit authorities, and water utilities planning expansion. Bid into IIJA capacity expansion grants.' },
      'production_impact':     { why: 'Overloaded infrastructure is constraining economic output. Freight bottlenecks delay goods movement. Water system limitations block new development permits. Transit failures reduce workforce mobility.', move: 'Build an infrastructure constraint cost model. Sell it to economic development agencies, real estate developers, and manufacturers evaluating site capacity.' },
      'logistics_constraint':  { why: 'Highway congestion, bridge weight restrictions, and rail terminal saturation are creating systemic freight delays. Last-mile delivery costs are rising as infrastructure fails to keep pace with demand.', move: 'Build a freight corridor stress model. Sell it to trucking firms, rail operators, and state DOTs prioritizing capacity investments. Position in highway construction contractors (MTZ, PWR).' },
      'market_structure':      { why: 'Congestion pricing, tolling, and capacity allocation mechanisms are being introduced or restructured. Infrastructure access is becoming a priced commodity rather than a public good.', move: 'Build a congestion pricing impact model. Sell it to toll authorities, transit agencies, and logistics companies evaluating route economics under new pricing regimes.' }
    },
    'FUNDING_COLLAPSE': {
      'policy_response':       { why: 'Federal infrastructure appropriations are being delayed or reduced. IIJA implementation is behind schedule. State matching fund requirements are straining budgets. Municipal bond markets are tightening.', move: 'Build a federal infrastructure funding tracker. Sell it to state DOTs, municipalities, and engineering firms positioning for remaining allocations. Monitor grants.gov and sam.gov for open solicitations.' },
      'contract_mispricing':   { why: 'Projects bid under expected federal cost-share are now underfunded. Contractors face scope reductions or contract terminations. Design firms have unbillable work in progress.', move: 'Build a project funding gap analysis tool. Sell it to engineering firms, contractors, and municipalities evaluating which projects to advance, defer, or restructure.' },
      'market_structure':      { why: 'Municipal bond spreads are widening for infrastructure-dependent issuers. PPP deal flow is shifting as public funding retreats. Private capital is repricing infrastructure risk.', move: 'Build a municipal infrastructure credit model. Sell it to bond underwriters, PPP advisory firms, and institutional investors evaluating infrastructure debt. Position in infrastructure finance (BIP, BAM).' }
    },
    'MAINTENANCE_DEFICIT': {
      'infrastructure_stress': { why: 'Decades of deferred maintenance have pushed bridges, water mains, and road surfaces past safe condition thresholds. ASCE grades are D or below for multiple asset classes. Failure probability is accelerating non-linearly.', move: 'Build an asset deterioration forecast by infrastructure class. Sell it to state DOTs, water utilities, and municipal public works departments. Bid into emergency rehabilitation contracts.' },
      'production_impact':     { why: 'Failing infrastructure is forcing unplanned service interruptions. Water main breaks disrupt neighborhoods. Bridge closures reroute freight. Pavement failures increase vehicle operating costs.', move: 'Build a service disruption cost model. Sell it to municipalities quantifying the cost of continued deferral. Use as evidence base for emergency maintenance grant applications on sam.gov.' },
      'supply_disruption':     { why: 'Emergency maintenance demand is competing with new construction for the same contractors, equipment, and materials. Rehabilitation project timelines are extending as resources are stretched thin.', move: 'Build a maintenance contractor capacity tracker. Sell it to municipalities and utilities competing for scarce rehabilitation crews. Position in infrastructure maintenance firms (XYL, MWA, FLR).' }
    },
    'CYBER_PHYSICAL_ATTACK': {
      'infrastructure_stress': { why: 'SCADA systems controlling water treatment, power distribution, and traffic management are under active threat. Physical sabotage of substations and communication nodes compounds digital vulnerabilities. Attack surface expands as legacy systems are networked.', move: 'Build an infrastructure SCADA vulnerability assessment. Sell it to water utilities, electric cooperatives, and transit authorities. Bid into CISA and DHS infrastructure security grant programs.' },
      'supply_disruption':     { why: 'Cyber attacks on infrastructure control systems cause physical service outages. Water treatment plant shutdowns, traffic signal failures, and grid protection relay manipulation create cascading disruption across dependent systems.', move: 'Build an infrastructure interdependency failure model. Sell it to emergency management agencies, utilities, and municipalities. Position for DHS critical infrastructure protection contracts.' },
      'policy_response':       { why: 'TSA, CISA, and EPA are issuing mandatory cybersecurity directives for pipeline, water, and electric utilities. Compliance deadlines are near-term. Penalties for non-compliance are escalating.', move: 'Build a multi-sector infrastructure cyber compliance tracker. Sell it to utilities, pipeline operators, and water systems facing TSA/CISA/EPA mandates. Provide compliance gap assessments as a service.' }
    }
  };

  var MECH_FALLBACK = {
    'supply_disruption':    { why: 'Supply is disrupted. Buyers need to find alternatives fast.', move: 'Build a supply gap analysis and sell it to affected buyers.' },
    'price_dislocation':    { why: 'Prices are moving fast. Existing positions need to be re-marked.', move: 'Build a repricing model and sell it to exposed counterparties.' },
    'contract_mispricing':  { why: 'Contracts are mispriced under new conditions. Renegotiation is needed.', move: 'Build a contract exposure audit and sell it to both sides.' },
    'logistics_constraint': { why: 'Physical delivery is blocked. Alternative routes must be found.', move: 'Build a rerouting model and sell it to logistics operators.' },
    'infrastructure_stress':{ why: 'Physical infrastructure is under stress.', move: 'Build a vulnerability scorecard and sell it to asset operators.' },
    'policy_response':      { why: 'New regulations are being issued in response to the event.', move: 'Build a compliance tracker and sell it to affected entities.' },
    'market_structure':     { why: 'Market rules are being stressed or rewritten.', move: 'Build a pricing model and sell it to market participants.' },
    'production_impact':    { why: 'Production capacity has shifted. The market needs visibility.', move: 'Build a status dashboard and sell it to operators and traders.' }
  };

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

  function renderDeepIntel(opp, label) {
    if (!opp || !opp._deepIntel) return '';
    var di = opp._deepIntel;

    var hasContent = di.monitoring || di.escalation || (di.citations && di.citations.length > 0) || di.cite || di.targetPathway;
    if (!hasContent) return '';

    var toggleId = 'deep-' + (++_deepToggleCounter);
    label = label || 'DEEP INTELLIGENCE';

    var h = '';
    h += '<button class="eos-deep-toggle" onclick="var b=document.getElementById(\'' + toggleId + '\');b.classList.toggle(\'open\');this.textContent=b.classList.contains(\'open\')?\'\u25BC ' + label + '\':\'\u25B6 ' + label + '\'">\u25B6 ' + label + '</button>';
    h += '<div class="eos-deep-body" id="' + toggleId + '">';

    if (di.monitoring) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">MONITORING PROTOCOL</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.monitoring === 'string' ? di.monitoring : JSON.stringify(di.monitoring)) + '</div>';
      h += '</div>';
    }

    if (di.escalation) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">IF THIS FAILS</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.escalation === 'string' ? di.escalation : JSON.stringify(di.escalation)) + '</div>';
      h += '</div>';
    }

    if (di.targetPathway) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">STRATEGY PATH</div>';
      h += '<div class="eos-deep-text">' + esc(di.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</div>';
      h += '</div>';
    }

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

    if (di.ancestryPath && di.ancestryPath.length > 0) {
      h += '<div class="eos-deep-section">';
      h += '<div class="eos-deep-label">PORTAL LINEAGE</div>';
      h += '<div class="eos-deep-text">' + di.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ') + ' (L' + (di.depth || '?') + ')</div>';
      h += '</div>';
    }

    if (di.portalDomainId || (di.ancestryPath && di.ancestryPath.length > 0)) { var _pid = di.portalDomainId || di.ancestryPath[di.ancestryPath.length - 1]; h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + esc(_pid) + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + esc(_pid) + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>'; }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DRILL DEEPER BRANCH RESEARCH
  // ══════════════════════════════════════════════════════════════════════
  var _branchIndex = null, _branchIndexFailed = false;
  function _loadBranchIndex() { if (_branchIndex) return Promise.resolve(_branchIndex); if (_branchIndexFailed) return Promise.resolve(null); return fetch('/assets/data/deep/infrastructure-branch-index.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){_branchIndex=d;return d;}).catch(function(){_branchIndexFailed=true;return null;}); }
  function renderDrillDeeper(opp) { if (!opp||!opp._omittedSiblingCount||opp._omittedSiblingCount<=0) return ''; var dir=opp._directive||{}; var drillId='drill-'+(++_deepToggleCounter); return '<div style="margin-top:6px"><button class="eos-deep-toggle" data-drill-id="'+drillId+'" data-node="'+esc(dir.nodeId||opp.nodeId||'')+'" data-ancestry="'+esc((dir.ancestryPath||opp.ancestryPath||[]).join(','))+'" style="color:rgba(74,143,212,0.8);border-color:rgba(74,143,212,0.25)">\u{1F50D} DRILL DEEPER \u00b7 '+opp._omittedSiblingCount+' related branches</button><div id="'+drillId+'" class="eos-deep-body" style="max-height:400px;overflow-y:auto"></div></div>'; }
  function _handleDrillClick(drillId,nodeId,ancestryStr){var c=document.getElementById(drillId);if(!c)return;if(c.classList.contains('open')){c.classList.remove('open');return;}c.innerHTML='<div style="color:#807868;padding:8px">Loading\u2026</div>';c.classList.add('open');_loadBranchIndex().then(function(idx){if(!idx||!idx.branches){c.innerHTML='<div style="color:#807868;padding:8px">Unavailable</div>';return;}var anc=ancestryStr?ancestryStr.split(','):[];var root=anc.length>=2?anc[1]:'';var rel=[];for(var i=0;i<idx.branches.length;i++){var b=idx.branches[i];var s=0;if(b.nodeId===nodeId)s+=10;if(root&&b.ancestryPath&&b.ancestryPath.length>=2&&b.ancestryPath[1]===root)s+=5;if(s>0){b._rel=s+(b.richness||0);rel.push(b);}}rel.sort(function(a,b){return b._rel-a._rel;});rel=rel.slice(0,20);if(!rel.length){c.innerHTML='<div style="color:#807868;padding:8px">No related branches</div>';return;}var h='';for(var ri=0;ri<rel.length;ri++){var br=rel[ri];var badges='';if(br.hasMonitoring)badges+='<span style="color:rgba(74,143,212,0.7);margin-right:4px">monitoring</span>';if(br.hasCitations)badges+='<span style="color:rgba(90,181,160,0.7);margin-right:4px">citations</span>';if(br.hasEscalation)badges+='<span style="color:rgba(201,169,78,0.7);margin-right:4px">escalation</span>';h+='<div style="padding:6px 8px;margin-bottom:4px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:0.32rem;color:#c0b8a5">'+esc(br.treatmentLabel)+'</div><div style="font-size:0.24rem;color:#807868">'+esc(br.portalDomainId)+' \u00b7 L'+br.depth+' \u00b7 '+esc(br.nodeId)+'</div><div style="font-size:0.22rem;margin-top:2px">'+badges+'</div></div><button class="eos-deep-toggle" data-load-branch="'+esc(br.portalDomainId)+'" style="font-size:0.22rem;white-space:nowrap">LOAD BRANCH</button></div><div id="branch-content-'+esc(br.portalDomainId)+'" style="display:none;margin-top:6px;padding:6px;border-top:1px solid rgba(74,143,212,0.1)"></div></div>';}c.innerHTML=h;});}
  function _handleLoadBranch(pid){var el=document.getElementById('branch-content-'+pid);if(!el)return;if(el.style.display!=='none'){el.style.display='none';return;}el.style.display='block';el.innerHTML='<div style="color:#807868;font-size:0.28rem">Loading\u2026</div>';fetch('/api/fetch-portal?domainId='+encodeURIComponent(pid)).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(data){var h='';for(var ai=0;ai<(data.activations||[]).length;ai++){var a=data.activations[ai];for(var ti=0;ti<(a.treatments||[]).length;ti++){var t=a.treatments[ti];if(!t.monitoring&&!t.escalation&&!t.citation&&!t.cite)continue;h+='<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">'+esc(t.label||'')+'</div>';if(t.monitoring)h+='<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">'+esc(typeof t.monitoring==='string'?t.monitoring.substring(0,400):'')+'</span></div>';if(t.escalation)h+='<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">'+esc(typeof t.escalation==='string'?t.escalation.substring(0,400):'')+'</span></div>';if(t.cite)h+='<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">'+esc(typeof t.cite==='string'?t.cite.substring(0,300):'')+'</span></div>';h+='</div>';break;}}if(!h)h='<div style="color:#807868;font-size:0.28rem">No deep content</div>';h+='<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + pid + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + pid + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>';el.innerHTML=h;}).catch(function(){el.innerHTML='<div style="color:#e85454;font-size:0.28rem">Failed to load</div>';});}

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

    var anchor = null;
    var bestProofScore = -1;
    var hasActiveDx = (state.diagnoses || []).some(function (d) { return d.active; });
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      if (o.source !== 'portal_directive' || !o._directive) continue;
      var econRel = (o.scores && o.scores.econRelevance != null) ? o.scores.econRelevance : 0.5;
      if (hasActiveDx && econRel < 0.3) continue;
      var displayScore = (o.rank || 0) * 0.35 + (o._richness || 0) * 0.10 + (o._stepsArePortalNative ? 0.12 : 0) + econRel * 0.15;
      if (o._deepIntel && o._deepIntel.monitoring) displayScore += 0.08;
      if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) displayScore += 0.08;
      if (displayScore > bestProofScore) {
        bestProofScore = displayScore;
        anchor = o;
      }
    }

    if (!anchor) return '';

    var mc = anchor.moneyChain || {};
    var dir = anchor._directive || {};
    var companies = anchor.examples || [];
    var steps = anchor.steps || [];

    var h = '<div class="eos-anchor">';

    h += '<div class="eos-anchor-label">TOP DIRECTIVE \u2014 ACTION NOW';
    if (anchor._mechanism && anchor._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(90,181,160,0.3);border-radius:2px;color:#5ab5a0;font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(anchor._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';

    h += '<div class="eos-anchor-title">' + esc(anchor.title) + '</div>';

    var explain = anchor.explain || mc.doThis || '';
    if (explain) {
      h += '<div class="eos-anchor-explain">' + esc(explain) + '</div>';
    }

    h += renderMechanismBlock(anchor, 'anchor');

    // 2x2 grid
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

    // WHO TO TARGET
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">WHO TO TARGET</div>';
    h += '<div class="eos-anchor-block-text">';
    var rt = anchor._resolvedTargets;
    if (rt) {
      if (rt.tier2 && rt.tier2.length > 0) {
        for (var t2i = 0; t2i < rt.tier2.length; t2i++) {
          h += '<div style="padding:2px 0;color:#d0c8b8">\u25B8 ' + esc(rt.tier2[t2i].label) + '</div>';
        }
      }
      if (rt.tier1 && rt.tier1.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(201,169,78,0.7);letter-spacing:1px">VERIFIED</div>';
        for (var t1i = 0; t1i < rt.tier1.length; t1i++) {
          h += '<div style="padding:1px 0;color:#e0daca">' + esc(rt.tier1[t1i].name) + (rt.tier1[t1i].ticker ? ' <span style="color:#C9A94E">(' + esc(rt.tier1[t1i].ticker) + ')</span>' : '') + '</div>';
        }
      }
      if (rt.tier3 && rt.tier3.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(90,181,160,0.6);letter-spacing:1px">ALSO CONSIDER</div>';
        for (var t3i = 0; t3i < Math.min(rt.tier3.length, 4); t3i++) {
          h += '<div style="padding:1px 0;color:#b0a898">' + esc(rt.tier3[t3i].name) + (rt.tier3[t3i].ticker ? ' (' + esc(rt.tier3[t3i].ticker) + ')' : '') + '</div>';
        }
      }
      if (rt.executionTargets && rt.executionTargets.length > 0) {
        h += '<div style="margin-top:4px;font-size:0.28rem;color:#908878">Execute via: ' + rt.executionTargets.join(', ') + '</div>';
      }
    } else {
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

    // Source intelligence proof
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

    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEEP PROOF BLOCK — deepest high-quality promoted directive (L2+)
  // ══════════════════════════════════════════════════════════════════════

  function renderDeepProofBlock(state) {
    var opps = state.opportunities || [];

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

    if (!deep) return '';

    var dir = deep._directive || {};
    var mc = deep.moneyChain || {};
    var di = deep._deepIntel || {};
    var steps = deep.steps || [];
    var depthStr = 'L' + (dir.depth || '?');
    var nativeStr = deep._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';

    var h = '<div class="eos-deepproof">';

    h += '<div class="eos-deepproof-label">DEEP PROOF \u2014 FRACTAL INTELLIGENCE';
    if (deep._mechanism && deep._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(74,143,212,0.3);border-radius:2px;color:rgba(74,143,212,0.9);font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(deep._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';

    h += '<div class="eos-deepproof-title">' + esc(deep.title) + '</div>';

    h += '<div class="eos-deepproof-why">Deepest high-quality directive from ';
    if (deep.diagnosisId) h += esc(deep.diagnosisId.replace(/_/g, ' '));
    h += ' branch. Depth ' + depthStr;
    if (dir.portalTitle) h += ' via ' + esc(dir.portalTitle);
    h += '. Deeper portal layers reveal more specific, actionable treatment protocols than the top-level brain.</div>';

    h += renderMechanismBlock(deep, 'deep');

    if (steps.length > 0) {
      h += '<div class="eos-deepproof-steps">';
      h += '<div style="font-size:0.24rem;letter-spacing:1px;color:rgba(74,143,212,0.6);margin-bottom:3px">STEPS \u00b7 ' + nativeStr.toUpperCase() + '</div>';
      for (var si = 0; si < Math.min(steps.length, 4); si++) {
        var st = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        h += '<div><b>' + (si + 1) + '.</b> ' + esc(st) + '</div>';
      }
      h += '</div>';
    }

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

    var h = '';

    // Pulse freshness warning
    if (pulse) {
      var freshPct = Math.round(pulse.freshnessScore * 100);
      if (freshPct < 50) {
        h += '<div style="font-size:0.34rem;color:#e85454;padding:4px 8px;margin-bottom:8px;border:1px solid rgba(232,84,84,0.15);border-radius:2px;background:rgba(232,84,84,0.04)">\u26A0 Feed freshness at ' + freshPct + '% \u2014 some data may be stale. Confidence reduced.</div>';
      }
      var blocked = (pulse.validatedDiagnoses || []).filter(function (v) { return v.blocked; });
      if (blocked.length > 0) {
        h += '<div style="font-size:0.30rem;color:#C9A94E;padding:3px 8px;margin-bottom:6px;border-left:2px solid rgba(201,169,78,0.2)">' + blocked.length + ' diagnosis(es) blocked by evidence contract \u2014 insufficient live evidence to support activation.</div>';
      }
    }

    // Build summary from state
    var text = '';
    if (stress >= 0.70) {
      text = '<b>Infrastructure stress at ' + pct + '% \u2014 crisis level.</b> Multiple infrastructure systems are under acute pressure. Emergency contracts, rehabilitation projects, and modernization funding are accelerating. ';
    } else if (stress >= 0.50) {
      text = '<b>Infrastructure stress at ' + pct + '% \u2014 elevated.</b> Infrastructure systems are showing significant strain. Maintenance backlogs and capacity constraints are creating procurement windows. ';
    } else if (stress >= 0.30) {
      text = '<b>Infrastructure stress at ' + pct + '%.</b> Above baseline but within manageable range. ';
    } else {
      text = '<b>Infrastructure stress at ' + pct + '%.</b> Within normal operating parameters. ';
    }

    if (activeDx.length > 0) {
      text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed by live evidence. ';
    } else {
      text += 'No diagnosis pathways active at current levels. Monitoring for escalation. ';
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
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || o.outcome || 'See playbook detail') + '</div>';

      // Collapsible detail
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
        if (o._mechanism && o._mechanism.primary) {
          var dxEx = MECH_EXPLAIN[(o.diagnosisId || '').toUpperCase()];
          if (dxEx) {
            h += '<div style="font-size:0.30rem;color:#b0a898;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.12)"><b style="color:rgba(201,169,78,0.7)">' + esc(o._mechanism.primaryLabel) + ':</b> ' + esc(dxEx) + '</div>';
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
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENInfrastructureExecutionPanels) {
        h += window.LIMENInfrastructureExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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

    // Merge claimed opportunities from ledger
    var claimSource = (window.LIMENInfrastructure && window.LIMENInfrastructure.economy && window.LIMENInfrastructure.economy.claims) || window.LIMENClaimLedger;
    if (claimSource) {
      var claims = claimSource.getClaimsByDomain ? claimSource.getClaimsByDomain('infrastructure') : [];
      var oppIds = {};
      for (var oi = 0; oi < opps.length; oi++) oppIds[opps[oi].id || oppKey(opps[oi])] = true;
      for (var ci = 0; ci < claims.length; ci++) {
        var claim = claims[ci];
        if (claim.status === 'closed') continue;
        if (oppIds[claim.opportunityId]) continue;
        opps.push({
          id: claim.opportunityId,
          title: claim.title,
          path: claim.path || 'GRANT-ELIGIBLE',
          urgency: 'WATCH',
          rank: 0.1,
          source: 'claimed_preserved',
          tier: 3,
          stress: 0,
          domain: 'infrastructure',
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
      // Action button row
      h += '<tr><td colspan="5" style="padding:0;border-bottom:1px solid rgba(255,255,255,0.04)"><div class="eos-action-row">' + statusHTML;
      var pbId = (o.path === 'INVESTABLE') ? resolvePlaybookId(o) : null;
      if (pbId) {
        h += '<button class="eos-invest-btn" data-pb-id="' + esc(pbId) + '" data-opp-title="' + esc(title) + '">INVEST \u2192</button>';
      }
      // removed: GRANT/PATENT/BUILD workspace buttons — lanes dropped
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      // CLAIM button
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'infrastructure') : null;
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

  var _bridgeInitialized = false;

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) return;

    var bridge = window.LIMENInfrastructurePromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('infrastructure') : null;
      var portalCache = brain ? brain._portalCache : null;

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) { bridge.promote(state, portalCache, bridgeOpts); }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            if (promoted && promoted.length > 0) { var freshState = getState(); if (freshState) _renderOperatorDOM(freshState); }
          });
        } else { bridge.promote(state, portalCache, bridgeOpts); }
      } else if (!_bridgeInitialized) {
        console.log('[InfrastructureOperator] Portal cache not ready — scheduling retry');
        setTimeout(function () {
          var rb = brains ? brains.get('infrastructure') : null;
          var rc = rb ? rb._portalCache : null;
          if (rc && bridge) {
            _bridgeInitialized = true;
            var rs = getState();
            if (rs) { bridge.promote(rs, rc, { limit: 5 }).then(function (p) { if (p && p.length > 0) { var fs = getState(); if (fs) _renderOperatorDOM(fs); } }); }
          }
        }, 5000);
      }
    }

    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {

    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div class="eos-title" style="margin-bottom:0">INFRASTRUCTURE \u00b7 OPERATOR SURFACE</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<button id="eos-back-to-console" style="font-family:monospace;font-size:0.32rem;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer;transition:all 0.2s">\u2190 CONSOLE</button>';
    h += '</div></div>';

    // ── DIAGNOSIS STATUS PANEL ──
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

    // Wire INVEST deep-link buttons
    var investBtns = _operatorView.querySelectorAll('[data-pb-id]');
    for (var ib = 0; ib < investBtns.length; ib++) {
      investBtns[ib].addEventListener('click', function (e) {
        e.stopPropagation();
        var pbId = this.getAttribute('data-pb-id');
        var oppTitle = this.getAttribute('data-opp-title');
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['infrastructure'], type: 'invest' };

        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var matchOpp = null;
        for (var mi = 0; mi < opps.length; mi++) {
          if (opps[mi].playbookId === pbId && opps[mi].path === 'INVESTABLE') { matchOpp = opps[mi]; break; }
        }
        if (!matchOpp) {
          for (var mi2 = 0; mi2 < opps.length; mi2++) {
            if (opps[mi2].title === oppTitle) { matchOpp = opps[mi2]; break; }
          }
        }

        var mc = matchOpp ? (matchOpp.moneyChain || {}) : {};
        var stressPct = matchOpp ? Math.round((matchOpp.stress || 0) * 100) : 0;
        var targets = INVEST_TARGETS[pbId] || [];
        var targetNames = targets.filter(function(t) { return t.cik; }).map(function(t) { return t.ticker + ' (' + t.name + ')'; }).join(', ');

        var branchUp = mc.doThis ? mc.doThis : '';
        if (mc.whyPays) branchUp += (branchUp ? ' ' : '') + mc.whyPays;
        if (targetNames) branchUp += ' Beneficiaries: ' + targetNames + '.';
        if (!branchUp) branchUp = 'Thesis confirmed \u2014 linked companies reprice higher. Stress persists above ' + stressPct + '%, driving procurement and capital allocation to the sector.';

        var branchDown = mc.invalidIf || (matchOpp && matchOpp.failure) || '';
        if (!branchDown) branchDown = 'Stress resolves below 50%. Diagnosis deactivates. Sector tailwind dissipates before positions can capture repricing.';
        if (targetNames) branchDown += ' Reduce exposure in: ' + targetNames + '.';

        var outcome = '';
        if (matchOpp && matchOpp.valueRange) outcome = 'Value range: ' + matchOpp.valueRange + '. ';
        if (matchOpp && matchOpp.outcome) outcome += matchOpp.outcome;
        else if (mc.whyPays) outcome += mc.whyPays;
        if (mc.timing) outcome += ' Timing: ' + mc.timing;
        if (!outcome) outcome = 'Linked infrastructure companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=infrastructure&returnTo=' + encodeURIComponent('/domain-console?domain=infrastructure');
      });
    }

    // Wire GRANT/PATENT/BUILD buttons
    // removed: GRANT/PATENT/BUILD workspace wiring

    // Wire CLAIM buttons
    var claimBtns = _operatorView.querySelectorAll('[data-claim-opp]');
    for (var cb = 0; cb < claimBtns.length; cb++) {
      claimBtns[cb].addEventListener('click', function (e) {
        e.stopPropagation();
        var oppId = this.getAttribute('data-claim-opp');
        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var opp = null;
        for (var oi = 0; oi < opps.length; oi++) {
          if ((opps[oi].id || oppKey(opps[oi])) === oppId) { opp = opps[oi]; break; }
        }
        if (!opp || !window.LIMENClaimFlow) return;
        window.LIMENClaimFlow.openClaimModal(opp, 'infrastructure', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'infrastructure', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'infrastructure');
    }

    // Mount execution memory panel
    if (window.LIMENExecution && window.LIMENExecution.reliabilityPanel) {
      window.LIMENExecution.reliabilityPanel.mount(_operatorView);
    }

    // Mount ops dashboard (Phase 5)
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

    // Mount business review panel
    if (window.LIMENInfrastructureBusinessReview) {
      window.LIMENInfrastructureBusinessReview.mount(_operatorView);
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

    var cv = document.getElementById('clarity-view');
    if (!cv) return;

    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none';
    cv.parentNode.insertBefore(_operatorView, cv.nextSibling);

    // Accordion delegation — wired ONCE on _operatorView
    _operatorView.addEventListener('click', function (e) {
      if (e.target.closest('.eos-status-btn') || e.target.closest('button[data-pb-id]') ||
          e.target.closest('button[data-exec-key]') || e.target.closest('button[data-claim-opp]') ||
          e.target.closest('a') || e.target.closest('input') || e.target.closest('select') ||
          e.target.closest('.ebr-btn') || e.target.closest('[data-business-node]')) return;

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

      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) { _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry')); return; }
      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) { _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch')); return; }
      var portalSourceBtn = e.target.closest('[data-portal-source]');
      if (portalSourceBtn) { _handlePortalSource(portalSourceBtn.getAttribute('data-portal-source')); return; }
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

    // Wire the dual Console/Operator mode buttons
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

    // Auto-open operator if ?mode=operator
    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') {
      switchToOperator();
    }

    console.log('[InfrastructureClarityOperator] Booted \u2014 operator view created, toggle wired');
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE — wait for brain to render, then boot
  // ══════════════════════════════════════════════════════════════════════

  var _bootCheck = setInterval(function () {
    var cv = document.getElementById('clarity-view');
    var state = getState();
    var brainRendered = cv && cv.querySelector('#dcb-exec');
    if (brainRendered && state && state.updated > 0) {
      clearInterval(_bootCheck);
      boot();
    }
  }, 300);

  // One-shot re-render after boot: listen for brain update with active diagnoses
  var _oneShot = false;
  window.addEventListener('limen:domain-brain-update', function handler(e) {
    if (_oneShot || !_booted || !_isOperatorMode) return;
    var detail = e.detail || {};
    if (detail.domain !== 'infrastructure') return;
    var activeDx = (detail.diagnoses || []).filter(function (d) { return d.active; });
    if (activeDx.length > 0) {
      _oneShot = true;
      window.removeEventListener('limen:domain-brain-update', handler);
      renderOperator();
    }
  });

  // 90-second timeout for one-shot
  setTimeout(function () {
    if (!_oneShot && _booted && _isOperatorMode) {
      _oneShot = true;
      renderOperator();
    }
  }, 90000);

  console.log('[InfrastructureClarityOperator] Loaded \u2014 money-driven action surface ready');

})();
