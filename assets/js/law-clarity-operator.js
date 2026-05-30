/**
 * law-clarity-operator.js — Money-Driven Action Surface for Law / Regulation Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view (default view)
 *   - Operator surface renders in #los-operator-view (separate sibling container)
 *   - Toggle button switches between Console and Operator
 *
 * Self-gates: only runs when ?domain=law
 *
 * Sections:
 *   1. TOP DIRECTIVE - one-shot rich anchor opportunity with mechanism + deep intel
 *   2. MECHANISM BLOCK - per-diagnosis why-it-matters and commercial-move
 *   3. DEEP INTELLIGENCE - expandable monitoring/escalation/citations
 *   4. DRILL DEEPER - relevant omitted branches recoverable from branch index
 *   5. TOP MONEY PLAYS - prioritized actions with path + payoff
 *   6. ACTION QUEUE - full opportunity table
 *   7. BUSINESS REVIEW - mounts law-business-review.js
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on law domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'law') return;

  var VIEW_ID = 'los-operator-view';
  var STATUS_KEY = 'limen_law_operator_status';
  var COLLAPSE_KEY = 'limen_law_collapse_state';
  var _operatorView = null;
  var _isOperatorMode = false;
  var _booted = false;

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
  // STYLES
  // ══════════════════════════════════════════════════════════════════════

  var _stylesInjected = false;

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + VIEW_ID + '{padding:20px 24px 60px;font-family:"IBM Plex Mono",monospace;overflow-y:auto;grid-column:1/-1;grid-row:2;display:none}',
      '.eos-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:6px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.eos-summary{font-size:0.54rem;color:#f0ece2;line-height:1.65;margin-bottom:18px;max-width:900px}',
      '.eos-summary b{color:#C9A94E}',
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
      '.eos-queue{width:100%;border-collapse:collapse;margin-bottom:8px}',
      '.eos-queue th{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.75);text-transform:uppercase;text-align:left;padding:5px 8px;border-bottom:1px solid rgba(201,169,78,0.12);font-weight:600}',
      '.eos-queue td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.38rem;color:#d0c8b8;vertical-align:top}',
      '.eos-queue tr:hover{background:rgba(201,169,78,0.02)}',
      '.eos-queue-pri{color:#C9A94E;font-weight:bold;font-size:0.42rem;width:30px}',
      '.eos-queue-name{max-width:220px}',
      '.eos-queue-why{color:#c0b8a5;max-width:340px;line-height:1.4}',
      '.eos-quiet{font-size:0.42rem;color:#b0a898;line-height:1.6;padding:8px 0}',
      '.eos-section-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;margin-bottom:6px;user-select:none;-webkit-user-select:none}',
      '.eos-section-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 8px rgba(201,169,78,0.4)}',
      '.eos-section-toggle{font-size:0.24rem;color:rgba(201,169,78,0.35);transition:transform 0.2s}',
      '.eos-section-body{overflow:hidden;transition:max-height 0.25s ease,opacity 0.2s ease}',
      '.eos-section-body.collapsed{max-height:0;opacity:0;margin:0;padding:0}',
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
      '.eos-deepproof{margin-bottom:14px;padding:12px 16px;border:1px solid rgba(74,143,212,0.2);border-left:3px solid rgba(74,143,212,0.6);border-radius:3px;background:rgba(74,143,212,0.03)}',
      '.eos-deepproof-label{font-size:0.24rem;letter-spacing:2.5px;color:rgba(74,143,212,0.8);margin-bottom:6px;font-weight:700}',
      '.eos-deepproof-title{font-size:0.48rem;color:#e0daca;line-height:1.4;margin-bottom:6px}',
      '.eos-deepproof-why{font-size:0.34rem;color:rgba(74,143,212,0.6);line-height:1.5;margin-bottom:8px;font-style:italic}',
      '.eos-deep-toggle{font-family:inherit;font-size:0.24rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(74,143,212,0.2);border-radius:2px;background:rgba(74,143,212,0.03);color:rgba(74,143,212,0.7);cursor:pointer;transition:all 0.15s;margin-top:6px}',
      '.eos-deep-toggle:hover{background:rgba(74,143,212,0.08);color:rgba(74,143,212,0.95)}',
      '.eos-deep-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease;margin-top:0}',
      '.eos-deep-body.open{max-height:600px;opacity:1;margin-top:8px}',
      '.eos-deep-section{margin-bottom:8px;padding:6px 10px;border-left:2px solid rgba(74,143,212,0.12);background:rgba(74,143,212,0.02);border-radius:2px}',
      '.eos-deep-label{font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.6);margin-bottom:3px;font-weight:600}',
      '.eos-deep-text{font-size:0.30rem;color:#b0a898;line-height:1.6}',
      '.eos-deep-cite{font-size:0.26rem;color:#908878;line-height:1.5;padding:2px 0}',
      '.eos-mode-toggle{display:flex;gap:4px;margin-bottom:14px}',
      '.eos-mode-btn{font-family:inherit;font-size:0.30rem;letter-spacing:1.5px;padding:5px 14px;border-radius:2px;cursor:pointer;border:1px solid rgba(201,169,78,0.2);background:none;color:#807868;transition:all 0.15s}',
      '.eos-mode-btn:hover{color:#C9A94E;border-color:rgba(201,169,78,0.4)}',
      '.eos-mode-btn.active{color:#C9A94E;background:rgba(201,169,78,0.08);border-color:rgba(201,169,78,0.5)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATA ACCESS
  // ══════════════════════════════════════════════════════════════════════

  function getState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('law');
    return brain ? brain.getState() : null;
  }

  function getStatusMap() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function setStatus(key, status) {
    var map = getStatusMap();
    map[key] = status;
    try { localStorage.setItem(STATUS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PROMOTED BADGE — blue L<depth> tag on portal_directive opportunities
  // ══════════════════════════════════════════════════════════════════════

  function promotedBadge(o) {
    if (!o || o.source !== 'portal_directive' || !o._directive) return '';
    var d = o._directive;
    var depth = d.depth != null ? d.depth : 0;
    var node = d.nodeLabel || d.nodeId || '';
    var isDeep = depth >= 2;
    var borderColor = isDeep ? 'rgba(74,143,212,0.5)' : 'rgba(74,143,212,0.2)';
    var bgColor = isDeep ? 'rgba(74,143,212,0.08)' : 'rgba(74,143,212,0.04)';
    var prefix = isDeep ? 'DEEP L' + depth : 'L' + depth;
    var mechLabel = (o._mechanism && o._mechanism.primaryLabel) ? ' \u00b7 ' + o._mechanism.primaryLabel : '';
    return ' <span style="font-size:0.22rem;letter-spacing:0.5px;padding:1px 5px;border-radius:2px;color:rgba(74,143,212,0.9);border:1px solid ' + borderColor + ';background:' + bgColor + '">' +
      prefix + ' \u00b7 ' + esc(node) + mechLabel + '</span>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // LANGUAGE ENGINE — law-native diagnosis context
  // ══════════════════════════════════════════════════════════════════════

  var DX_CONTEXT = {
    'JUDICIAL_CRISIS': {
      what: 'Court dockets are backed up and rulings are delayed past procedural windows',
      money: 'Litigation funders, court-modernization vendors, and ADR providers gain leverage. Practice management and docket-tracking software wins procurement priority.',
      step: 'Check court docket data for affected jurisdictions. Position in legaltech docket vendors or ADR providers. Search SJI grants for court-modernization opportunities.',
      outcome: '$250K-$5M court-modernization contracts or 15-25% legaltech sector premium'
    },
    'CONSTITUTIONAL_VIOLATION': {
      what: 'Constitutional rights challenges are accelerating and structural protections are under stress',
      money: 'Civil rights litigation funders, impact-litigation firms, and constitutional-law boutiques see elevated demand. Class certification and 1983 cases command premium fees.',
      step: 'Track Section 1983 filings and impact litigation in affected districts. Position in civil rights firms or legal aid organizations. Apply for ACLU and impact litigation grants.',
      outcome: '$500K-$10M impact litigation funding or contingency fee recovery'
    },
    'REGULATORY_CAPTURE': {
      what: 'Regulatory bodies are showing favoritism patterns and enforcement is becoming uneven',
      money: 'Whistleblower / qui tam firms, FOIA litigation specialists, and regulatory watchdog organizations gain leverage. Compliance technology that exposes capture patterns wins.',
      step: 'Track enforcement asymmetries via FOIA. Position in whistleblower firms or regtech monitoring vendors. File False Claims Act cases where evidence supports.',
      outcome: '15-30% qui tam recoveries or sustained regulatory advisory revenue'
    },
    'MASS_INCARCERATION': {
      what: 'Sentencing volume is rising and incarcerated population is growing past capacity',
      money: 'Criminal defense firms, public defender contractors, sentencing mitigation specialists, and reentry organizations see sustained demand. Bail reform and pretrial services gain traction.',
      step: 'Check sentencing data and prison population stats. Position in sentencing mitigation, public defender contracting, or reentry services. Apply for BJA and DOJ second-chance grants.',
      outcome: '$250K-$5M BJA grants or sustained criminal-defense fee revenue'
    },
    'INTERNATIONAL_LAW_BREAKDOWN': {
      what: 'Treaty enforcement is failing, sanctions are being challenged, and cross-border legal coordination is fragmenting',
      money: 'International trade firms, sanctions compliance specialists, and arbitration boutiques win mandates. OFAC / BIS / FCPA practices see surge demand.',
      step: 'Track OFAC SDN list updates and FCPA enforcement actions. Position in sanctions compliance technology or international arbitration. Pitch trade compliance audits to importers.',
      outcome: '15-30% sanctions compliance sector premium or $250K-$2M audit engagements'
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
    'JUDICIAL_CRISIS':              'law_courts',
    'CONSTITUTIONAL_VIOLATION':     'law_civil_rights',
    'REGULATORY_CAPTURE':           'law_regtech',
    'MASS_INCARCERATION':           'law_criminal_justice',
    'INTERNATIONAL_LAW_BREAKDOWN':  'law_international'
  };

  var INVEST_TARGETS = {
    'law_courts': [
      { ticker: 'TYL',  name: 'Tyler Technologies',                cik: '860731',  validation: 'HELIX_VALIDATED', reason: 'Largest court case-management software vendor; benefits from court modernization spend' },
      { ticker: 'TRI',  name: 'Thomson Reuters',                   cik: '1206774', validation: 'HELIX_VALIDATED', reason: 'Westlaw, Practical Law, court analytics; legal research and court technology' },
      { ticker: 'RELX', name: 'RELX (LexisNexis)',                 cik: '1206774', validation: 'DOMAIN_MAPPED',   reason: 'LexisNexis legal research and court analytics' },
      { ticker: 'LAW',  name: 'CS Disco',                          cik: '1745020', validation: 'HELIX_VALIDATED', reason: 'E-discovery and legal AI platform' },
      { ticker: 'DOCU', name: 'DocuSign',                          cik: '1261333', validation: 'DOMAIN_MAPPED',   reason: 'Contract management and electronic signature for legal workflows' }
    ],
    'law_civil_rights': [
      { ticker: 'BFAM', name: 'Bright Horizons (legal benefits)',  cik: '1437578', validation: 'ETF_PROXY',       reason: 'Legal benefits and impact litigation exposure proxy' },
      { ticker: 'TRI',  name: 'Thomson Reuters',                   cik: '1206774', validation: 'HELIX_VALIDATED', reason: 'Court analytics for civil rights litigation tracking' },
      { ticker: 'RELX', name: 'RELX (LexisNexis)',                 cik: '1206774', validation: 'DOMAIN_MAPPED',   reason: 'Civil rights case research and analytics' }
    ],
    'law_regtech': [
      { ticker: 'NICE', name: 'NICE Ltd (Actimize)',               cik: '1003061', validation: 'HELIX_VALIDATED', reason: 'Compliance and AML monitoring; benefits from regulatory complexity' },
      { ticker: 'NDAQ', name: 'Nasdaq (Verafin)',                  cik: '1120193', validation: 'HELIX_VALIDATED', reason: 'AML and compliance technology via Verafin acquisition' },
      { ticker: 'TRI',  name: 'Thomson Reuters',                   cik: '1206774', validation: 'HELIX_VALIDATED', reason: 'CLEAR investigative database and compliance tools' },
      { ticker: 'WTW',  name: 'Willis Towers Watson',              cik: '1140536', validation: 'DOMAIN_MAPPED',   reason: 'Regulatory and compliance advisory for financial services' },
      { ticker: 'INFO', name: 'IHS Markit / S&P Global',           cik: '64040',   validation: 'DOMAIN_MAPPED',   reason: 'Regulatory data and compliance intelligence' }
    ],
    'law_criminal_justice': [
      { ticker: 'GEO',  name: 'GEO Group',                         cik: '923796',  validation: 'DOMAIN_MAPPED',   reason: 'Private corrections and reentry services exposure' },
      { ticker: 'CXW',  name: 'CoreCivic',                         cik: '1070985', validation: 'DOMAIN_MAPPED',   reason: 'Detention and corrections services' },
      { ticker: 'SCM',  name: 'Stellus Capital',                   cik: '1546383', validation: 'ETF_PROXY',       reason: 'Mid-market criminal-justice technology lending exposure' }
    ],
    'law_international': [
      { ticker: 'TRI',  name: 'Thomson Reuters',                   cik: '1206774', validation: 'HELIX_VALIDATED', reason: 'Sanctions screening, World-Check, international trade compliance' },
      { ticker: 'NICE', name: 'NICE Ltd (Actimize)',               cik: '1003061', validation: 'HELIX_VALIDATED', reason: 'OFAC sanctions screening and AML compliance' },
      { ticker: 'NDAQ', name: 'Nasdaq (Verafin)',                  cik: '1120193', validation: 'HELIX_VALIDATED', reason: 'Sanctions and AML monitoring' },
      { ticker: 'INFO', name: 'IHS Markit / S&P Global',           cik: '64040',   validation: 'DOMAIN_MAPPED',   reason: 'Trade compliance data and sanctions intelligence' }
    ]
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'law_regtech';
  }

  var VAL_LABELS = {
    'HELIX_VALIDATED': { label: 'HELIX VALIDATED', cls: 'eos-val-helix' },
    'NODE_MAPPED':     { label: 'NODE MAPPED',     cls: 'eos-val-node' },
    'DOMAIN_MAPPED':   { label: 'DOMAIN MAPPED',   cls: 'eos-val-domain' },
    'ETF_PROXY':       { label: 'ETF PROXY',       cls: 'eos-val-etf' }
  };

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM EXPLANATIONS — per-diagnosis, per-mechanism
  // ══════════════════════════════════════════════════════════════════════

  var MECH_EXPLAIN = {
    'JUDICIAL_CRISIS': {
      'judicial_backlog':     { why: 'Court dockets are months or years behind. Cases that should be resolved in weeks are taking quarters. Witnesses and evidence degrade.', move: 'Build a court docket monitoring service. Sell it to litigation teams, GCs, and litigation funders tracking case progression.' },
      'procedural_failure':   { why: 'Procedural defaults are increasing. Motions are being denied for technical reasons. Parties are losing on procedure rather than merit.', move: 'Build a procedural compliance checker. Sell it to law firms and pro se support organizations.' },
      'discovery_bottleneck': { why: 'Discovery is consuming 60-80% of litigation cost and timeline. Document review backlogs are crippling cases.', move: 'Build an e-discovery cost optimizer or deploy TAR services. Sell to AmLaw firms and corporate legal departments.' },
      'administrative_law':   { why: 'Administrative agency hearings are months behind. ALJ decisions are slow. Agency review cycles are extending.', move: 'Build an administrative case tracking platform. Sell to administrative-law firms and Social Security disability practices.' }
    },
    'CONSTITUTIONAL_VIOLATION': {
      'rights_challenge':     { why: 'Constitutional rights are being challenged at scale. Civil rights filings are accelerating in affected jurisdictions.', move: 'Build a civil rights litigation analytics platform. Sell to impact litigation firms and legal aid organizations.' },
      'procedural_failure':   { why: 'Due process is being shortcut. Notice and hearing requirements are being bypassed.', move: 'Build a due process audit tool. Sell to administrative law practitioners and government accountability organizations.' },
      'enforcement_action':   { why: 'Government enforcement is overreaching constitutional limits. Fourth Amendment and First Amendment cases are rising.', move: 'Build an enforcement-action monitoring service. Sell to civil liberties organizations and constitutional law firms.' }
    },
    'REGULATORY_CAPTURE': {
      'regulatory_burden':    { why: 'Compliance burden is rising disproportionately on small actors while large incumbents are exempted. Agency favoritism patterns are visible.', move: 'Build a compliance burden disparity index. Sell to industry associations and small-business advocacy groups.' },
      'enforcement_action':   { why: 'Enforcement is selective. Some entities are repeatedly fined while others doing the same conduct are not. Whistleblower opportunities expanding.', move: 'Build a whistleblower case intake and qui tam tracking platform. Partner with whistleblower law firms.' },
      'administrative_law':   { why: 'Agency rulemaking is being shaped by industry insiders. Notice-and-comment processes show capture patterns.', move: 'Build a rulemaking comment tracker that exposes industry-vs-public commenter patterns. Sell to advocacy groups and journalists.' }
    },
    'MASS_INCARCERATION': {
      'sentencing_pressure':  { why: 'Sentencing volume is rising. Mandatory minimums are creating a sentencing pipeline that exceeds incarceration capacity.', move: 'Build a sentencing-disparity analytics platform. Sell to public defender offices and sentencing reform advocacy groups.' },
      'enforcement_action':   { why: 'Arrest and prosecution rates are accelerating in target communities. Pretrial detention is rising.', move: 'Build a pretrial release risk assessment tool. Sell to bail reform organizations and pretrial services agencies.' },
      'procedural_failure':   { why: 'Plea bargains are being coerced. Defendants are pleading guilty without full advice of counsel.', move: 'Build a plea bargain advice platform for public defenders. Apply for BJA innovation grants.' }
    },
    'INTERNATIONAL_LAW_BREAKDOWN': {
      'treaty_friction':      { why: 'Treaty obligations are being violated or repudiated. International compacts are losing force.', move: 'Build a treaty compliance monitoring service. Sell to multinational corporations and international trade desks.' },
      'enforcement_action':   { why: 'Sanctions enforcement is accelerating. OFAC actions are creating compliance scrambles.', move: 'Build a sanctions screening and OFAC compliance platform. Sell to banks, exporters, and trade-finance teams.' },
      'contract_dispute':     { why: 'Cross-border contracts are being repudiated. Foreign judgment enforcement is failing.', move: 'Build a foreign judgment enforcement tracking service. Sell to international litigation and trade finance firms.' }
    }
  };

  var MECH_FALLBACK = {
    'judicial_backlog':    { why: 'Courts are backed up. Cases are stuck.', move: 'Build a docket tracking tool and sell to affected parties.' },
    'regulatory_burden':   { why: 'Regulatory complexity is rising fast.', move: 'Build a compliance scorecard and sell to compliance teams.' },
    'enforcement_action':  { why: 'Enforcement actions are accelerating.', move: 'Build an enforcement tracker and sell to affected industries.' },
    'rights_challenge':    { why: 'Rights are being challenged.', move: 'Build civil rights case analytics and sell to impact firms.' },
    'sentencing_pressure': { why: 'Sentencing volume is rising.', move: 'Build sentencing analytics and sell to defense organizations.' },
    'treaty_friction':     { why: 'International legal coordination is fragmenting.', move: 'Build a treaty compliance tracker.' },
    'contract_dispute':    { why: 'Contract disputes are spreading.', move: 'Build a contract risk model and sell to commercial litigators.' },
    'administrative_law':  { why: 'Agency action is accelerating.', move: 'Build an agency action tracker and sell to regulated industries.' },
    'discovery_bottleneck':{ why: 'Discovery costs are exploding.', move: 'Build an e-discovery optimizer and sell to law firms.' },
    'procedural_failure':  { why: 'Procedural defaults are increasing.', move: 'Build a procedural compliance tool and sell to legal practitioners.' }
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
  // DEEP INTELLIGENCE RENDER
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
      h += '<div class="eos-deep-section"><div class="eos-deep-label">MONITORING PROTOCOL</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.monitoring === 'string' ? di.monitoring : JSON.stringify(di.monitoring)) + '</div></div>';
    }
    if (di.escalation) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">IF THIS FAILS</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.escalation === 'string' ? di.escalation : JSON.stringify(di.escalation)) + '</div></div>';
    }
    if (di.targetPathway) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">STRATEGY PATH</div>';
      h += '<div class="eos-deep-text">' + esc(di.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</div></div>';
    }
    if (di.citations && di.citations.length > 0) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES (' + di.citations.length + ')</div>';
      for (var ci = 0; ci < di.citations.length; ci++) {
        var c = di.citations[ci];
        var citeStr = '';
        if (typeof c === 'string') { citeStr = c; }
        else { citeStr = (c.author || '') + ' (' + (c.year || '') + '). ' + (c.title || '') + '. ' + (c.journal || ''); if (c.doi) citeStr += ' doi:' + c.doi; }
        h += '<div class="eos-deep-cite">' + esc(citeStr) + '</div>';
      }
      h += '</div>';
    } else if (di.cite) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES</div>';
      h += '<div class="eos-deep-cite">' + esc(di.cite) + '</div></div>';
    }
    if (di.ancestryPath && di.ancestryPath.length > 0) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">PORTAL LINEAGE</div>';
      h += '<div class="eos-deep-text">' + di.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ') + ' (L' + (di.depth || '?') + ')</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DRILL DEEPER BRANCH RESEARCH
  // ══════════════════════════════════════════════════════════════════════

  var _branchIndex = null, _branchIndexFailed = false;
  function _loadBranchIndex() {
    if (_branchIndex) return Promise.resolve(_branchIndex);
    if (_branchIndexFailed) return Promise.resolve(null);
    return fetch('/assets/data/deep/law-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
  }

  function renderDrillDeeper(opp) {
    if (!opp || !opp._omittedSiblingCount || opp._omittedSiblingCount <= 0) return '';
    var dir = opp._directive || {};
    var drillId = 'drill-' + (++_deepToggleCounter);
    return '<div style="margin-top:6px"><button class="eos-deep-toggle" data-drill-id="' + drillId + '" data-node="' + esc(dir.nodeId || opp.nodeId || '') + '" data-ancestry="' + esc((dir.ancestryPath || opp.ancestryPath || []).join(',')) + '" style="color:rgba(74,143,212,0.8);border-color:rgba(74,143,212,0.25)">\u{1F50D} DRILL DEEPER \u00b7 ' + opp._omittedSiblingCount + ' related branches</button><div id="' + drillId + '" class="eos-deep-body" style="max-height:400px;overflow-y:auto"></div></div>';
  }

  function _handleDrillClick(drillId, nodeId, ancestryStr) {
    var c = document.getElementById(drillId);
    if (!c) return;
    if (c.classList.contains('open')) { c.classList.remove('open'); return; }
    c.innerHTML = '<div style="color:#807868;padding:8px">Loading\u2026</div>';
    c.classList.add('open');
    _loadBranchIndex().then(function (idx) {
      if (!idx || !idx.branches) { c.innerHTML = '<div style="color:#807868;padding:8px">Branch index unavailable</div>'; return; }
      var anc = ancestryStr ? ancestryStr.split(',') : [];
      var root = anc.length >= 2 ? anc[1] : '';
      var rel = [];
      for (var i = 0; i < idx.branches.length; i++) {
        var b = idx.branches[i];
        var s = 0;
        if (b.nodeId === nodeId) s += 10;
        if (root && b.ancestryPath && b.ancestryPath.length >= 2 && b.ancestryPath[1] === root) s += 5;
        if (s > 0) { b._rel = s + (b.richness || 0); rel.push(b); }
      }
      rel.sort(function (a, b) { return b._rel - a._rel; });
      rel = rel.slice(0, 20);
      if (!rel.length) { c.innerHTML = '<div style="color:#807868;padding:8px">No related branches</div>'; return; }
      var h = '';
      for (var ri = 0; ri < rel.length; ri++) {
        var br = rel[ri];
        var badges = '';
        if (br.hasMonitoring) badges += '<span style="color:rgba(74,143,212,0.7);margin-right:4px">monitoring</span>';
        if (br.hasCitations) badges += '<span style="color:rgba(90,181,160,0.7);margin-right:4px">citations</span>';
        if (br.hasEscalation) badges += '<span style="color:rgba(201,169,78,0.7);margin-right:4px">escalation</span>';
        h += '<div style="padding:6px 8px;margin-bottom:4px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:0.32rem;color:#c0b8a5">' + esc(br.treatmentLabel) + '</div><div style="font-size:0.24rem;color:#807868">' + esc(br.portalDomainId) + ' \u00b7 L' + br.depth + ' \u00b7 ' + esc(br.nodeId) + '</div><div style="font-size:0.22rem;margin-top:2px">' + badges + '</div></div><button class="eos-deep-toggle" data-load-branch="' + esc(br.portalDomainId) + '" style="font-size:0.22rem;white-space:nowrap">LOAD BRANCH</button></div><div id="branch-content-' + esc(br.portalDomainId) + '" style="display:none;margin-top:6px;padding:6px;border-top:1px solid rgba(74,143,212,0.1)"></div></div>';
      }
      c.innerHTML = h;
    });
  }

  function _handleLoadBranch(pid) {
    var el = document.getElementById('branch-content-' + pid);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading branch\u2026</div>';
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var h = '';
        for (var ai = 0; ai < (data.activations || []).length; ai++) {
          var a = data.activations[ai];
          for (var ti = 0; ti < (a.treatments || []).length; ti++) {
            var t = a.treatments[ti];
            if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue;
            h += '<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>';
            if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>';
            if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>';
            if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>';
            h += '</div>';
            break;
          }
        }
        if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content in this branch</div>';
        el.innerHTML = h;
      })
      .catch(function () { el.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load branch</div>'; });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ANCHOR (TOP DIRECTIVE) RENDER
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
      if (displayScore > bestProofScore) { bestProofScore = displayScore; anchor = o; }
    }
    if (!anchor) {
      // Fall back to highest-ranked native opportunity
      for (var ni = 0; ni < opps.length; ni++) {
        if ((opps[ni].rank || 0) > bestProofScore) { bestProofScore = opps[ni].rank || 0; anchor = opps[ni]; }
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
    if (explain) h += '<div class="eos-anchor-explain">' + esc(explain) + '</div>';
    h += renderMechanismBlock(anchor, 'anchor');
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
    } else if (mc.doThis) { h += esc(mc.doThis); }
    else { h += esc(anchor.action || 'Execute via operator pathway'); }
    h += '</div></div>';
    // WHO TO TARGET
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">WHO TO TARGET</div>';
    h += '<div class="eos-anchor-block-text">';
    var rt = anchor._resolvedTargets;
    if (rt) {
      if (rt.tier2 && rt.tier2.length > 0) { for (var t2i = 0; t2i < rt.tier2.length; t2i++) { h += '<div style="padding:2px 0;color:#d0c8b8">\u25B8 ' + esc(rt.tier2[t2i].label) + '</div>'; } }
      if (rt.tier1 && rt.tier1.length > 0) { h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(201,169,78,0.7);letter-spacing:1px">VERIFIED</div>'; for (var t1i = 0; t1i < rt.tier1.length; t1i++) { h += '<div style="padding:1px 0;color:#e0daca">' + esc(rt.tier1[t1i].name) + (rt.tier1[t1i].ticker ? ' <span style="color:#C9A94E">(' + esc(rt.tier1[t1i].ticker) + ')</span>' : '') + '</div>'; } }
      if (rt.tier3 && rt.tier3.length > 0) { h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(90,181,160,0.6);letter-spacing:1px">ALSO CONSIDER</div>'; for (var t3i = 0; t3i < Math.min(rt.tier3.length, 4); t3i++) { h += '<div style="padding:1px 0;color:#b0a898">' + esc(rt.tier3[t3i].name) + (rt.tier3[t3i].ticker ? ' (' + esc(rt.tier3[t3i].ticker) + ')' : '') + '</div>'; } }
      if (rt.executionTargets && rt.executionTargets.length > 0) { h += '<div style="margin-top:4px;font-size:0.28rem;color:#908878">Execute via: ' + rt.executionTargets.join(', ') + '</div>'; }
    } else {
      if (companies.length > 0) { for (var ci = 0; ci < Math.min(companies.length, 5); ci++) { h += '<div style="padding:1px 0">' + esc(companies[ci]) + '</div>'; } }
      if (mc.target) h += '<div style="margin-top:3px;color:#a09888;font-size:0.30rem">' + esc(mc.target) + '</div>';
      if (!companies.length && !mc.target) h += 'See mapped targets in action queue';
    }
    h += '</div></div>';
    // HOW MONEY IS MADE
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">HOW MONEY IS MADE</div>';
    h += '<div class="eos-anchor-block-text">';
    if (mc.whyPays) h += esc(mc.whyPays);
    else h += esc(anchor.outcome || anchor.valueRange || 'See monetization path in expanded view');
    h += '</div></div>';
    // TIMING / WINDOW
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">TIMING</div>';
    h += '<div class="eos-anchor-block-text">';
    h += esc(mc.timing || anchor.window || 'Active now');
    h += '</div></div>';
    h += '</div>'; // close anchor-grid

    // ── SOURCE INTELLIGENCE PROOF BLOCK ──
    // Always render so the operator can see provenance even on shallow anchors.
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
    h += '<span style="color:#d0c8b8">Depth:</span> ' + depthStr + ' \u00b7 ';
    h += '<span style="color:#d0c8b8">Steps:</span> ' + nativeStr + ' \u00b7 ';
    h += '<span style="color:#d0c8b8">Richness:</span> ' + richStr + '/5';
    if (deepFields.length > 0) h += ' \u00b7 <span style="color:#d0c8b8">Has:</span> ' + deepFields.join(', ');
    if (dir.portalTitle) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalTitle) + ' (' + depthStr + ')';
    else if (dir.portalDomainId) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalDomainId) + ' (' + depthStr + ')';
    if (dir.ancestryPath && dir.ancestryPath.length > 1) h += '<br><span style="color:#d0c8b8">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    if (dir.nodeLabel || dir.nodeId) h += '<br><span style="color:#d0c8b8">Brain node:</span> ' + esc(dir.nodeLabel || '') + (dir.nodeId ? ' (' + esc(dir.nodeId) + ')' : '');
    h += '</div></div>';

    // Deep Intelligence expandable section + Drill Deeper
    h += renderDeepIntel(anchor, 'DEEP INTELLIGENCE');
    h += renderDrillDeeper(anchor);

    // Compact lineage line at the bottom
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
  // DEEP PROOF BLOCK — best L2+ portal directive with full source intelligence
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
    var steps = deep.steps || [];
    var depthStr = 'L' + (dir.depth != null ? dir.depth : '?');
    var nativeStr = deep._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';
    var h = '<div class="eos-deepproof">';
    h += '<div class="eos-deepproof-label">DEEP PROOF \u2014 FRACTAL INTELLIGENCE';
    if (deep._mechanism && deep._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(74,143,212,0.3);border-radius:2px;color:rgba(74,143,212,0.9);font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(deep._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';
    h += '<div class="eos-deepproof-title">' + esc(deep.title) + '</div>';
    if (mc.whyPays) h += '<div class="eos-deepproof-why">' + esc(mc.whyPays) + '</div>';
    if (steps.length > 0) {
      h += '<div class="eos-deepproof-steps">';
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var stepText = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || '');
        h += '<div><b>' + (si + 1) + '.</b> ' + esc(stepText) + '</div>';
      }
      h += '</div>';
    }
    h += renderMechanismBlock(deep, 'deep');
    // SOURCE INTELLIGENCE / LINEAGE
    h += '<div style="font-size:0.28rem;color:#b0a898;line-height:1.6;margin-top:8px;padding-top:6px;border-top:1px solid rgba(74,143,212,0.12)">';
    h += '<div style="font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.7);font-weight:600;margin-bottom:4px">SOURCE INTELLIGENCE</div>';
    h += '<span style="color:rgba(74,143,212,0.8)">Depth:</span> ' + depthStr + ' \u00b7 <span style="color:rgba(74,143,212,0.8)">Steps:</span> ' + nativeStr + ' \u00b7 <span style="color:rgba(74,143,212,0.8)">Richness:</span> ' + (deep._richness || 0) + '/5';
    if (dir.ancestryPath && dir.ancestryPath.length > 0) {
      h += '<br><span style="color:rgba(74,143,212,0.8)">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    }
    if (dir.portalDomainId) {
      h += '<br><span style="color:rgba(74,143,212,0.8)">Source portal:</span> ' + esc(dir.portalDomainId);
    }
    if (dir.nodeLabel || dir.nodeId) {
      h += '<br><span style="color:rgba(74,143,212,0.8)">Brain node:</span> ' + esc(dir.nodeLabel || '') + (dir.nodeId ? ' (' + esc(dir.nodeId) + ')' : '');
    }
    h += '</div>';
    h += renderDeepIntel(deep, 'EXPAND DEEP INTELLIGENCE');
    h += renderDrillDeeper(deep);
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // TOP MONEY PLAYS RENDER
  // ══════════════════════════════════════════════════════════════════════

  function renderMoneyPlays(state) {
    var opps = state.opportunities || [];
    if (opps.length === 0) return '<div class="eos-quiet">No opportunities surfaced yet. Brain is still ingesting feeds.</div>';
    var top = opps.slice(0, 6);
    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      h += '<div class="eos-play">';
      h += '<span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(o.title || '') + promotedBadge(o) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      if (o.urgency === 'IMMEDIATE' || o.urgency === 'high') h += ' <span style="font-size:0.26rem;color:#e85454;letter-spacing:1px;margin-left:4px">URGENT</span>';
      h += '<div class="eos-play-why">' + esc(o.explain || (o.moneyChain && o.moneyChain.whyPays) || '') + '</div>';
      h += '<div class="eos-play-outcome">' + esc(o.outcome || o.valueRange || '') + '</div>';
      // Inline deep intelligence for portal_directive plays
      if (o.source === 'portal_directive') {
        h += renderDeepIntel(o, 'MORE INTELLIGENCE');
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ACTION QUEUE RENDER
  // ══════════════════════════════════════════════════════════════════════

  function renderActionQueue(state) {
    var opps = state.opportunities || [];
    if (opps.length === 0) return '<div class="eos-quiet">No opportunities in queue.</div>';
    var h = '<table class="eos-queue"><thead><tr>';
    h += '<th>#</th><th>Opportunity</th><th>Path</th><th>Why now</th><th>Window</th>';
    h += '</tr></thead><tbody>';
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      h += '<tr' + (o.urgency === 'IMMEDIATE' || o.urgency === 'high' ? ' style="border-left:2px solid #e85454"' : '') + '>';
      h += '<td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(o.title || '') + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + esc(o.explain || (o.moneyChain && o.moneyChain.whyPays) || '') + '</td>';
      h += '<td>' + esc(o.window || (o.moneyChain && o.moneyChain.timing) || '') + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // OPERATOR RENDER ORCHESTRATION
  // ══════════════════════════════════════════════════════════════════════

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) {
      _operatorView.innerHTML = '<div class="eos-quiet">Brain not ready. Loading\u2026</div>';
      return;
    }

    var bridge = window.LIMENLawPromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('law') : null;
      if (brain && brain._portalCache) {
        bridge.promote(state, brain._portalCache, { limit: 5 }).then(function (promoted) {
          if (promoted && promoted.length > 0) {
            var freshState = getState();
            if (freshState) _renderOperatorDOM(freshState);
          }
        }).catch(function () {});
      }
    }

    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {
    if (!_operatorView) return;
    injectStyles();

    var stress = state.stress || 0;
    var stressPct = Math.round(stress * 100);
    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });

    var h = '';

    // Money summary
    // (Console / Operator toggle is wired to the page-header buttons in boot())
    var summaryText = 'Law domain at <b>' + stressPct + '%</b> stress. ';
    if (activeDx.length > 0) {
      summaryText += '<b>' + activeDx.length + '</b> active diagnoses. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[primaryDx.id];
      if (ctx) summaryText += ctx.what + '. ';
      if (ctx) summaryText += '<b>Money move:</b> ' + ctx.step;
    } else {
      summaryText += 'No active diagnoses. Watch for emerging legal/regulatory pressure.';
    }
    h += '<div class="eos-summary">' + summaryText + '</div>';

    // Top Directive (anchor)
    var anchorHtml = renderAnchorDirective(state);
    if (anchorHtml) h += anchorHtml;

    // Deep Proof — Fractal Intelligence (best L2+ portal directive with source intelligence)
    var deepProofHtml = renderDeepProofBlock(state);
    if (deepProofHtml) h += deepProofHtml;

    // Top Money Plays
    h += wrapCollapsible('top-money-plays', 'TOP MONEY PLAYS', renderMoneyPlays(state), true);

    // Action Queue
    h += wrapCollapsible('action-queue', 'ACTION QUEUE', renderActionQueue(state), true);

    // Business review mount point
    h += '<div id="lbr-mount-point"></div>';

    _operatorView.innerHTML = h;

    // Mount business review
    var lbrMount = document.getElementById('lbr-mount-point');
    if (lbrMount && window.LIMENLawBusinessReview) {
      window.LIMENLawBusinessReview.mount(lbrMount);
    }

    // Mount operator panel and claim flow
    var _top = window.LIMENLaw && window.LIMENLaw.economy && window.LIMENLaw.economy.panel;
    if (_top) _top.inject();
    var _tcf = window.LIMENLaw && window.LIMENLaw.economy && window.LIMENLaw.economy.claimFlow;
    if (_tcf) _tcf.injectIntoCards();
  }

  // ══════════════════════════════════════════════════════════════════════
  // CONSOLE / OPERATOR MODE TOGGLE
  // ══════════════════════════════════════════════════════════════════════

  function switchToOperator() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = 'none';
    if (_operatorView) _operatorView.style.display = 'block';
    _isOperatorMode = true;
    updateToggleButton();
    renderOperator();
  }

  function switchToConsole() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = '';
    if (_operatorView) _operatorView.style.display = 'none';
    _isOperatorMode = false;
    updateToggleButton();
  }

  function updateToggleButton() {
    var btnC = document.getElementById('chModeConsole');
    var btnO = document.getElementById('chModeOperator');
    if (btnC) btnC.classList.toggle('active', !_isOperatorMode);
    if (btnO) btnO.classList.toggle('active', _isOperatorMode);
  }

  // ══════════════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════════════

  function boot() {
    if (_booted) return;
    injectStyles();

    // Create operator view container — must be inserted next to the
    // brain-rendered clarity view, NOT into <body>, or layout breaks.
    var clarityView = document.getElementById('clarity-view');
    if (!clarityView || !clarityView.parentNode) return;
    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none';
    clarityView.parentNode.insertBefore(_operatorView, clarityView.nextSibling);

    // Wire the page-header Console / Operator toggle buttons
    var btnConsole = document.getElementById('chModeConsole');
    var btnOperator = document.getElementById('chModeOperator');
    if (btnConsole) btnConsole.addEventListener('click', function () { if (_isOperatorMode) switchToConsole(); });
    if (btnOperator) btnOperator.addEventListener('click', function () { if (!_isOperatorMode) switchToOperator(); });

    // Click delegation for drill-deeper / load-branch / sections
    _operatorView.addEventListener('click', function (e) {
      var sectionHeader = e.target.closest('.eos-section-header');
      if (sectionHeader && !e.target.closest('button') && !e.target.closest('a')) {
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
      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) {
        _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry'));
        return;
      }
      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) {
        _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch'));
        return;
      }
    });

    _booted = true;

    // Auto-open operator if ?mode=operator
    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') { switchToOperator(); }

    console.log('[LawClarityOperator] Booted \u2014 operator view ready');
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE — wait for brain, then boot + one-shot re-render
  // ══════════════════════════════════════════════════════════════════════

  var _bootCheck = setInterval(function () {
    var cv = document.getElementById('clarity-view');
    var state = getState();
    var brainRendered = cv && cv.querySelector('#dcb-exec');
    if (brainRendered && state && state.updated > 0) {
      clearInterval(_bootCheck);
      boot();

      var _reRendered = false;
      function _onBrainUpdate() {
        if (_reRendered) return;
        var freshState = getState();
        if (freshState && freshState.diagnoses && freshState.diagnoses.some(function (d) { return d.active; })) {
          _reRendered = true;
          window.removeEventListener('limen:domain-brain-update', _onBrainUpdate);
          if (_isOperatorMode) renderOperator();
        }
      }
      window.addEventListener('limen:domain-brain-update', _onBrainUpdate);
      setTimeout(function () { window.removeEventListener('limen:domain-brain-update', _onBrainUpdate); }, 90000);
    }
  }, 300);

  window.LIMENLawClarityOperator = {
    renderOperator: renderOperator,
    switchToOperator: switchToOperator,
    switchToConsole: switchToConsole
  };

})();
