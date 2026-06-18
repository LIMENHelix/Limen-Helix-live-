/**
 * governance-clarity-operator.js — Money-Driven Action Surface for Governance Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #eos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=governance is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on governance domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'governance') return;

  var VIEW_ID = 'eos-operator-view';
  var STATUS_KEY = 'limen_governance_operator_status';
  var COLLAPSE_KEY = 'limen_governance_collapse_state';
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
    var brain = brains.get('governance');
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
    'CONSTITUTIONAL_CRISIS': {
      what: 'A serious constitutional dispute is unfolding \u2014 separation of powers being stress-tested, court rulings being defied, executive actions challenged in court, or emergency powers being used in novel ways. The basic guardrails of the state are bending.',
      money: 'Constitutional law firms, civil liberties NGOs, legal defense funds, and democracy NGOs see immediate donor and grant flow. Bond markets reprice on rule-of-law uncertainty. Sovereign rating agencies put governments on watch. Public-interest litigation surges.',
      step: 'Track WilmerHale, Boies Schiller, Federalist Society, ACLU, EFF, Brennan Center for filings and amicus briefs. Track Moody\u2019s, S&P, Fitch sovereign rating notes for rule-of-law commentary. Position in constitutional law services, civil liberties NGOs, and political risk consulting.',
      outcome: '$500K-$10M foundation grants (Open Society, Hewlett, Carnegie, Ford), or sustained legal services revenue from public-interest litigation'
    },
    'REGIME_INSTABILITY': {
      what: 'A government is losing legitimacy and stability \u2014 plummeting approval ratings, mass protests, defections from the ruling coalition, leadership changes, or contested elections. The regime\u2019s ability to govern is degrading.',
      money: 'Political risk consultancies (Eurasia Group, Control Risks, RANE), polling firms (Gallup, Pew, Morning Consult), democracy assistance organizations (NED, NDI, IRI), and crisis communications firms see acute demand. Foreign investors hedge or divest. Sovereign debt spreads widen.',
      step: 'Track approval rating polls, protest event databases (ACLED, Crisis24), coalition defections, election challenges, and FX market signals. Position in political risk advisory and democracy assistance grant work.',
      outcome: '$250K-$5M democracy and political risk contracts, plus crisis communications retainers'
    },
    'POLICY_FAILURE': {
      what: 'A major policy initiative is failing \u2014 a law that can\u2019t pass, a program that can\u2019t implement, a regulation that gets struck down, a budget that can\u2019t close. Policy paralysis is now a recurring crisis, not a one-off.',
      money: 'Federal implementation consultancies (Booz Allen, Deloitte Federal, BAH, Accenture Federal), government affairs intelligence platforms (Bloomberg Government, FiscalNote, Quorum), policy think tanks, and lobbying firms (BGR, Akin Gump, Holland & Knight) gain leverage as customers scramble to navigate the gridlock.',
      step: 'Track congressional vote scheduling, OIRA review queues, agency rulemaking dockets, and major court rulings. Position in implementation consulting and government affairs intelligence.',
      outcome: '$1M-$50M federal implementation contracts and ongoing lobbying retainers'
    },
    'CORRUPTION_SCANDAL': {
      what: 'A major corruption case is breaking \u2014 self-dealing, bribery, conflict of interest, kickbacks, or insider influence trading. The scandal threatens individual officials and broader institutional trust.',
      money: 'Anti-corruption NGOs (Transparency International, OCCRP, ICIJ), investigative journalism nonprofits, government ethics consultancies, FCPA defense firms (Steptoe, Crowell & Moring, K&L Gates), and inspector general support contractors see surge demand. Compliance and ethics platforms gain customer interest.',
      step: 'Track DOJ Public Integrity Section indictments, SEC whistleblower awards, OCCRP investigations, ICIJ leaks (Panama, Pandora, Paradise), and IG report releases. Position in anti-corruption NGO work, FCPA defense, and government ethics consulting.',
      outcome: '$500K-$10M anti-corruption foundation grants or sustained FCPA defense engagements'
    },
    'DIPLOMATIC_BREAKDOWN': {
      what: 'Diplomatic relations between governments are deteriorating sharply \u2014 ambassadors recalled, sanctions imposed, treaties withdrawn, embassies closed, or trade wars escalating. The diplomatic guardrails on conflict are weakening.',
      money: 'International law firms (Sidley Austin, White & Case, Cleary Gottlieb), sanctions compliance vendors, political risk consultancies, multilateral institution support contractors, and diplomatic translation services all see demand. Corporate compliance teams scramble to update sanctions screening.',
      step: 'Track State Department announcements, EU Council conclusions, UN Security Council resolutions, OFAC sanctions updates, and major treaty status changes. Position in international law, sanctions compliance, and political risk advisory.',
      outcome: '$1M-$50M international law engagements and sanctions compliance retainers'
    },
    'MILITARY_OVERREACH': {
      what: 'The civil-military balance is tilting \u2014 generals making political statements, military deployments to civilian functions, expanded use of emergency military powers, or political leaders using armed forces for domestic purposes. Civilian control is being tested.',
      money: 'Civil-military relations think tanks (CNAS, CSIS, RAND), constitutional law firms, civilian oversight NGOs (POGO, Public Citizen), and Congressional oversight support contractors see funding flow. Foundation grants for civilian oversight and democratic resilience expand.',
      step: 'Track Congressional Armed Services Committee hearings, civil-military relations literature, presidential proclamations, and military leadership public statements. Position in civilian oversight NGOs and constitutional law services.',
      outcome: '$250K-$5M civilian oversight foundation grants and constitutional law retainers'
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

  // Diagnosis → playbook ID for Governance-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'CONSTITUTIONAL_CRISIS': 'gov_constitutional',
    'REGIME_INSTABILITY':    'gov_political_risk',
    'POLICY_FAILURE':        'gov_implementation',
    'CORRUPTION_SCANDAL':    'gov_anti_corruption',
    'DIPLOMATIC_BREAKDOWN':  'gov_diplomacy',
    'MILITARY_OVERREACH':    'gov_civil_military'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'gov_political_risk',
    'company_stressed':  'gov_implementation',
    'convergence':       'gov_constitutional',
    'cross_domain':      'gov_political_risk'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'gov_constitutional':  { title: 'Constitutional Law and Rule of Law Defense', domains: ['governance', 'law'], type: 'invest' },
    'gov_political_risk':  { title: 'Political Risk Intelligence and Advisory', domains: ['governance', 'finance'], type: 'invest' },
    'gov_implementation':  { title: 'Federal Implementation and Government Affairs', domains: ['governance', 'technology'], type: 'invest' },
    'gov_anti_corruption': { title: 'Anti-Corruption, Ethics, and Investigative Journalism', domains: ['governance', 'communication'], type: 'invest' },
    'gov_diplomacy':       { title: 'International Law and Sanctions Compliance', domains: ['governance', 'finance'], type: 'invest' },
    'gov_civil_military':  { title: 'Civilian Oversight and Civil-Military Relations', domains: ['governance', 'defense'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in governance.json portal),
  //             DOMAIN_MAPPED (in governance command board), ETF_PROXY (sector proxy, no company-level validation)
  var INVEST_TARGETS = {
    'gov_constitutional': [
      { ticker: 'TYL',    name: 'Tyler Technologies',                  cik: '860731',  validation: 'HELIX_VALIDATED', reason: 'Largest govtech vendor; courts, public safety, and ERP for state and local government \u2014 the rails that keep judiciaries and elected bodies running through a constitutional crisis' },
      { ticker: 'MCO',    name: 'Moody\u2019s',                             cik: '1059556', validation: 'HELIX_VALIDATED', reason: 'Sovereign rating exposure; rule-of-law deterioration drives sovereign and sub-sovereign rating actions and bond market repricing' },
      { ticker: 'SPGI',   name: 'S&P Global',                          cik: '64040',   validation: 'HELIX_VALIDATED', reason: 'Sovereign and corporate ratings; constitutional risk gets priced into spreads within hours of a major court ruling' },
      { ticker: 'TRI',    name: 'Thomson Reuters',                     cik: '1116132', validation: 'HELIX_VALIDATED', reason: 'Westlaw, Practical Law, Reuters legal news \u2014 the working tools of constitutional litigation; demand spikes during emergency cases' },
      { ticker: 'RELX',   name: 'RELX plc (LexisNexis)',               cik: '1771218', validation: 'HELIX_VALIDATED', reason: 'LexisNexis legal research and Lex Machina court analytics \u2014 used by constitutional law firms and amicus briefers' },
      { ticker: 'LSEG.L', name: 'London Stock Exchange Group (Refinitiv)', cik: null, validation: 'DOMAIN_MAPPED',   reason: 'Refinitiv World-Check and government risk data; banks and corporates use it to screen exposure during constitutional turmoil' },
      { ticker: 'NOW',    name: 'ServiceNow',                          cik: '1373715', validation: 'HELIX_VALIDATED', reason: 'ServiceNow Public Sector keeps federal agency workflows running through political shocks; government cloud authority growing' },
      { ticker: 'CIBR',   name: 'First Trust NASDAQ Cybersecurity ETF', cik: null,     validation: 'ETF_PROXY',       reason: 'Secondary proxy for the federal cyber surge that follows constitutional standoffs (CISA, IGs, oversight bodies all harden under stress)' }
    ],
    'gov_political_risk': [
      { ticker: 'MCO',    name: 'Moody\u2019s',                             cik: '1059556', validation: 'HELIX_VALIDATED', reason: 'Sovereign rating actions during regime instability move billions in fixed-income exposure' },
      { ticker: 'SPGI',   name: 'S&P Global',                          cik: '64040',   validation: 'HELIX_VALIDATED', reason: 'Sovereign credit ratings; widely used by political risk teams as their reference for country risk' },
      { ticker: 'AON',    name: 'Aon plc',                             cik: '315293',  validation: 'HELIX_VALIDATED', reason: 'Aon Political Risk insurance, Crisis Management, and credit risk advisory; multinational corporates and exporters are core customers' },
      { ticker: 'MMC',    name: 'Marsh McLennan',                      cik: '62709',   validation: 'HELIX_VALIDATED', reason: 'Marsh political risk insurance, Mercer government consulting, Oliver Wyman public sector \u2014 full-stack political risk franchise' },
      { ticker: 'WTW',    name: 'Willis Towers Watson',                cik: '1140536', validation: 'HELIX_VALIDATED', reason: 'WTW political risk and crisis management practice \u2014 third-largest broker globally with sovereign and corporate exposure' },
      { ticker: 'BRO',    name: 'Brown & Brown',                       cik: '79282',   validation: 'DOMAIN_MAPPED',   reason: 'Specialty broker with political risk insurance practice and growing public-entity book' },
      { ticker: 'CB',     name: 'Chubb Limited',                       cik: '896159',  validation: 'DOMAIN_MAPPED',   reason: 'Top-tier specialty insurer; political risk and credit risk insurance for corporates exposed to unstable jurisdictions' },
      { ticker: 'COFA.PA',name: 'Coface',                              cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'European credit insurer; political risk and trade credit for exporters into emerging-market regimes' },
      { ticker: 'GIB',    name: 'CGI Inc.',                            cik: '1057234', validation: 'DOMAIN_MAPPED',   reason: 'Top-five federal IT prime in U.S. and Canada; runs critical government systems through political transitions' }
    ],
    'gov_implementation': [
      { ticker: 'BAH',    name: 'Booz Allen Hamilton',                 cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Largest federal services / strategy consultancy; runs implementation work for nearly every cabinet department' },
      { ticker: 'LDOS',   name: 'Leidos Holdings',                     cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Federal IT services prime serving most civilian agencies; large implementation prime' },
      { ticker: 'CACI',   name: 'CACI International',                  cik: '17843',   validation: 'HELIX_VALIDATED', reason: 'Federal services prime; large civilian agency footprint and intelligence community work' },
      { ticker: 'GD',     name: 'General Dynamics (GDIT segment)',     cik: '40533',   validation: 'HELIX_VALIDATED', reason: 'GDIT runs major federal civilian and defense IT services across HHS, DoS, DoD, IRS' },
      { ticker: 'SAIC',   name: 'Science Applications International',  cik: '1571123', validation: 'HELIX_VALIDATED', reason: 'Top-tier federal IT prime; civilian agency systems integration at scale' },
      { ticker: 'MMS',    name: 'Maximus',                             cik: '1032220', validation: 'HELIX_VALIDATED', reason: 'Federal eligibility and benefits delivery (Medicare, Medicaid, ACA, child support enforcement) \u2014 the operational backbone of federal social programs' },
      { ticker: 'ICFI',   name: 'ICF International',                   cik: '1362004', validation: 'DOMAIN_MAPPED',   reason: 'Federal program implementation in energy, environment, health, and disaster recovery' },
      { ticker: 'TYL',    name: 'Tyler Technologies',                  cik: '860731',  validation: 'HELIX_VALIDATED', reason: 'State and local government software and ERP leader; courts, public safety, finance, and the actual rails policy runs on' },
      { ticker: 'ACN',    name: 'Accenture plc',                       cik: '1467373', validation: 'HELIX_VALIDATED', reason: 'Accenture Federal Services is a top-five federal SI prime; runs major civilian and defense modernization' },
      { ticker: 'NOW',    name: 'ServiceNow',                          cik: '1373715', validation: 'HELIX_VALIDATED', reason: 'ServiceNow Public Sector / Government Cloud is rapidly displacing legacy federal workflow systems' }
    ],
    'gov_anti_corruption': [
      { ticker: 'FCN',    name: 'FTI Consulting',                      cik: '887936',  validation: 'HELIX_VALIDATED', reason: 'Largest forensic accounting and FCPA investigation consultancy; the firm of record for major corruption cases' },
      { ticker: 'EFX',    name: 'Equifax',                             cik: '33185',   validation: 'HELIX_VALIDATED', reason: 'Identity, fraud detection, employment verification (E-Verify operator) for federal agencies' },
      { ticker: 'GEN',    name: 'Gen Digital',                         cik: '849399',  validation: 'DOMAIN_MAPPED',   reason: 'Norton-LifeLock identity protection and fraud prevention; agency and consumer-side identity defense' },
      { ticker: 'NICE',   name: 'NICE Ltd.',                           cik: '1003079', validation: 'HELIX_VALIDATED', reason: 'NICE Actimize is the dominant financial-crime, AML, and sanctions screening platform; used by federal regulators and global banks' },
      { ticker: 'NDAQ',   name: 'Nasdaq, Inc. (Verafin)',              cik: '1120193', validation: 'HELIX_VALIDATED', reason: 'Nasdaq Verafin AML / fraud detection platform; major federal and bank customer base for anti-money-laundering' },
      { ticker: 'TRI',    name: 'Thomson Reuters',                     cik: '1116132', validation: 'HELIX_VALIDATED', reason: 'Thomson Reuters Special Services and CLEAR investigations \u2014 used by federal investigators and FCPA defense teams' },
      { ticker: 'WKL.AS', name: 'Wolters Kluwer',                      cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Wolters Kluwer Financial Services compliance and legal regulatory tools; used by government and corporate compliance teams' },
      { ticker: 'KFY',    name: 'Korn Ferry',                          cik: '56679',   validation: 'DOMAIN_MAPPED',   reason: 'Executive search and ethics-driven leadership transitions when scandals force boardroom turnover' },
      { ticker: 'VRSK',   name: 'Verisk Analytics',                    cik: '1442145', validation: 'DOMAIN_MAPPED',   reason: 'Government risk and fraud analytics; insurance and benefits fraud detection sold to states and federal' }
    ],
    'gov_diplomacy': [
      { ticker: 'MCO',    name: 'Moody\u2019s',                             cik: '1059556', validation: 'HELIX_VALIDATED', reason: 'Sovereign rating moves on diplomatic crises, sanctions packages, and treaty withdrawal' },
      { ticker: 'SPGI',   name: 'S&P Global',                          cik: '64040',   validation: 'HELIX_VALIDATED', reason: 'Sovereign ratings and sanctions exposure pricing; foundational reference for treasury and corporate exposure' },
      { ticker: 'AON',    name: 'Aon plc',                             cik: '315293',  validation: 'HELIX_VALIDATED', reason: 'Aon Political Risk insurance for diplomatic / sanctions exposure; major broker for multinational deal flow' },
      { ticker: 'MMC',    name: 'Marsh McLennan',                      cik: '62709',   validation: 'HELIX_VALIDATED', reason: 'Marsh sanctions advisory and political risk insurance; Oliver Wyman geopolitics practice' },
      { ticker: 'NICE',   name: 'NICE Ltd.',                           cik: '1003079', validation: 'HELIX_VALIDATED', reason: 'NICE Actimize sanctions screening and OFAC compliance \u2014 the workhorse of bank sanctions desks' },
      { ticker: 'LSEG.L', name: 'London Stock Exchange Group (Refinitiv)', cik: null, validation: 'DOMAIN_MAPPED',   reason: 'Refinitiv World-Check sanctions and PEP screening; the standard reference list for global corporate compliance' },
      { ticker: 'WKL.AS', name: 'Wolters Kluwer',                      cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Wolters Kluwer regulatory compliance for trade controls, ECCN classification, and dual-use export licensing' },
      { ticker: 'FCN',    name: 'FTI Consulting',                      cik: '887936',  validation: 'HELIX_VALIDATED', reason: 'FTI sanctions compliance and economic consulting; the firm of record for major sanctions investigations' },
      { ticker: 'TRI',    name: 'Thomson Reuters',                     cik: '1116132', validation: 'HELIX_VALIDATED', reason: 'Reuters geopolitical news and Thomson Reuters trade compliance tools; foundational for diplomatic intelligence' }
    ],
    'gov_civil_military': [
      { ticker: 'LDOS',   name: 'Leidos Holdings',                     cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Federal services serving Congressional oversight and civilian-side defense agencies; one of the few firms cleared for both civilian and defense oversight work' },
      { ticker: 'BAH',    name: 'Booz Allen Hamilton',                 cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Federal services with civilian oversight, IG support, and program review work; major DoD oversight footprint' },
      { ticker: 'CACI',   name: 'CACI International',                  cik: '17843',   validation: 'HELIX_VALIDATED', reason: 'Civilian-side federal services and oversight support; major Congressional research and IG support contracts' },
      { ticker: 'SAIC',   name: 'Science Applications International',  cik: '1571123', validation: 'HELIX_VALIDATED', reason: 'Federal oversight IT and analytics for civilian and defense agencies' },
      { ticker: 'PLTR',   name: 'Palantir Technologies',               cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Palantir Foundry now operates inside DoD, IC, and civilian agencies \u2014 the data layer that civilian oversight bodies use to audit defense activity' },
      { ticker: 'V2X',    name: 'V2X Inc.',                            cik: '1844488', validation: 'DOMAIN_MAPPED',   reason: 'Mission support and operations for DoD; the contractor base that any civil-military rebalance directly affects' },
      { ticker: 'MMS',    name: 'Maximus',                             cik: '1032220', validation: 'DOMAIN_MAPPED',   reason: 'Federal civilian benefits operator; the civilian-state interface that absorbs or replaces military-administered programs (e.g., VA)' },
      { ticker: 'ITA',    name: 'iShares U.S. Aerospace & Defense ETF', cik: null,    validation: 'ETF_PROXY',       reason: 'Secondary proxy: civil-military rebalancing usually moves U.S. defense budgets and is reflected in the ITA ETF in either direction' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → political risk
    if (opp.source === 'lagging') return 'gov_political_risk';
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Governance condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Governance portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=governance&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
  // Plain-English explanations: assume the reader is a smart operator, not a governance expert.
  var MECH_EXPLAIN = {
    'CONSTITUTIONAL_CRISIS': {
      'constitutional_strain': { why: 'When the basic guardrails of a state start bending \u2014 a president defying a court ruling, a court ruling against the legislature, emergency powers being used in novel ways \u2014 the institutions that keep things in check have to work overtime. Constitutional law firms get briefed for emergency litigation, civil liberties NGOs file amicus briefs by the dozen, foundations release crisis grants, and bond markets reprice sovereign debt on rule-of-law uncertainty. The work is real, urgent, and well-funded.', move: 'Build a constitutional crisis monitoring service or join a public-interest law firm specializing in democracy and rule-of-law work. Sell to foundations (Open Society, Hewlett, Carnegie, Ford), NGOs (Brennan Center, ACLU, Protect Democracy), and large law firms with public-interest budgets. Charge $250K-$5M per multi-year program or $50K-$500K per investigation.' },
      'oversight_failure':     { why: 'Constitutional crises usually involve oversight bodies being defanged \u2014 inspector generals fired, congressional committees defied, GAO findings ignored. The fix is more aggressive, better-resourced oversight: more IGs, more committee staff, more independent investigators. After every crisis the call for stronger oversight gets funded.', move: 'Build inspector general support tools or congressional staff augmentation services. Sell to House and Senate committees, federal IG community, and oversight foundations. Charge $250K-$2M per multi-year support contract.' },
      'institutional_capture': { why: 'Constitutional crises often expose underlying capture \u2014 a regulatory agency that\u2019s been working for the regulated, a court system whose judges are political appointees, a legislature whose committee chairs are bought. The work of mapping and exposing capture becomes critical to any democratic recovery.', move: 'Build a regulatory and political capture investigation service. Sell to investigative journalism nonprofits (ProPublica, ICIJ, OCCRP), foundations, and oversight NGOs. Charge $100K-$1M per investigation.' },
      'civil_liberty_erosion': { why: 'Most constitutional standoffs spill into civil liberties almost immediately \u2014 protest crackdowns, surveillance expansion, press credentialing fights, detention authority creep. The civil liberties response community (ACLU, EFF, Knight First Amendment Institute, Lawyers\u2019 Committee, NAACP LDF) mobilizes within hours, and donors release crisis funds. Federal agencies on the receiving end of injunctions need outside compliance counsel fast.', move: 'Build a rapid-response civil liberties litigation shop or staff one of the existing constitutional defense firms (WilmerHale, Boies Schiller, Williams & Connolly, Munger Tolles). Fundraise from foundations and donor-advised funds for rapid-response legal pools \u2014 typical war-chests $1M-$50M, individual matters $100K-$2M.' }
    },
    'REGIME_INSTABILITY': {
      'legitimacy_erosion':    { why: 'When approval ratings collapse below 30%, when mass protests fill the streets every weekend, when ministers start resigning, regimes lose the ability to govern even when they technically hold power. Investors hedge or divest. Sovereign credit spreads widen. Foreign embassies start drafting evacuation plans. Polling firms, political risk advisories, and democracy NGOs see the highest demand.', move: 'Build a political risk advisory service. Sell to corporate boards, sovereign wealth funds, family offices, and multilateral institutions with exposure to the affected country. Eurasia Group / Control Risks / RANE / Stratfor charge $250K-$2M per annual subscription.' },
      'civil_liberty_erosion': { why: 'Unstable regimes often respond by tightening their grip on press freedom, assembly, and speech. Journalists get jailed, protests get banned, opposition leaders disappear. The civil liberties response community \u2014 ACLU, EFF, RSF, CPJ, Article 19 \u2014 mobilizes immediately, and donor money flows toward defending the people on the receiving end.', move: 'Build a press freedom legal defense fund or journalist safety service. Fundraise from foundations (Open Society, Knight, MacArthur) and individual donors. Annual budgets $500K-$5M.' },
      'constitutional_strain': { why: 'Unstable regimes test the limits of what their constitution allows \u2014 emergency declarations, suspended elections, reshuffled courts. Constitutional scholars become media stars, law firms with constitutional practices get retained, and democracy assistance programs accelerate.', move: 'Build a constitutional risk monitoring service for the affected jurisdiction. Sell to corporate boards, foundations, and democracy NGOs. Charge $50K-$500K per year per customer.' },
      'corruption_signal':     { why: 'Regime instability and corruption travel together. As legitimacy erodes, oligarch networks, kleptocratic flows, and beneficial-ownership trails all become live targets for investigators \u2014 think OCCRP, ICIJ Panama / Pandora Papers, the U.S. Kleptocracy Asset Recovery Initiative. Sanctions screening vendors and forensic accounting firms see multi-quarter demand spikes whenever a regime starts to wobble.', move: 'Build a kleptocracy investigation, beneficial-ownership tracing, or sanctions-screening service. Sell to OCCRP-style investigative journalism collectives, U.S. Treasury OFAC and DOJ Kleptocracy Initiative, FCPA defense firms (Sidley, Kirkland, Hogan Lovells, Gibson Dunn), and global banks doing enhanced due diligence. Charge $250K-$5M per investigation; sanctions data subscriptions $50K-$1M per year.' }
    },
    'POLICY_FAILURE': {
      'policy_paralysis':      { why: 'When government can\u2019t pass a budget, can\u2019t implement a law, or can\u2019t close a deal, the consequences are real: programs lapse, contracts pause, federal employees go unpaid, services degrade. Lobbyists work overtime, government affairs intelligence platforms see traffic spikes, and federal implementation contractors get paid to keep things running through the gridlock.', move: 'Build a policy gridlock impact tracker that helps customers (lobbyists, corporate gov affairs teams, federal contractors) anticipate which programs are at risk and plan around them. Sell as a SaaS subscription. Range: $25K-$250K per year per customer. Or join a top-tier government affairs firm (BGR, Akin Gump, Brownstein) and bill $750-$1500 per hour.' },
      'fiscal_crisis':         { why: 'Policy paralysis often hits hardest at the budget. Continuing resolutions, debt ceiling fights, and shutdowns create cycles of crisis that ripple through every federal contractor and bond holder. Fiscal advisory firms, sovereign rating agencies, and bond market analysts get pulled in repeatedly.', move: 'Build a fiscal cliff and budget impact analysis service. Sell to bond investors, federal contractors, and state and local governments dependent on federal funds. Range: $50K-$500K per engagement.' },
      'institutional_capture': { why: 'Policy failures often happen because the policy itself was captured \u2014 written by lobbyists, watered down in committee, hollowed out at implementation. The work of mapping and explaining capture becomes critical to any reform effort.', move: 'Build a policy provenance / capture analysis service. Sell to journalists, NGOs, and reform-oriented foundations. Charge $50K-$500K per year per customer.' },
      'oversight_failure':     { why: 'Most policy failures get traced back to weak oversight: an IG who never staffed the program, a committee that never held a hearing, a GAO recommendation that never got implemented. Once a failure is visible, the political pressure to spin up retroactive oversight is enormous, and the firms that can credibly do that work get budgeted into the next CR.', move: 'Build a federal program-integrity / IG-support practice that staffs surge audits and reviews after a visible policy failure. Sell to House and Senate appropriations and oversight committees, OIG offices, and CIGIE. Multi-year contracts $500K-$5M; rapid surge engagements $100K-$1M. Real prime examples: Kearney & Company, Cotton & Company (Sikich), Williams Adley.' }
    },
    'CORRUPTION_SCANDAL': {
      'corruption_signal':     { why: 'Corruption scandals create a predictable cascade: indictment, resignation, plea deal, congressional hearing, IG report, civil suit, ethics rules tightening. Every step of the cascade has a vendor: anti-corruption NGOs file the FOIA requests, investigative journalists do the digging, FCPA defense firms represent the accused, and ethics consultancies advise the agencies trying to clean up. Money moves through every step.', move: 'Build an anti-corruption investigation service or join a major investigative journalism nonprofit (ProPublica, ICIJ, OCCRP). Or build a forensic accounting practice (FTI Consulting / FRA / AlixPartners model). Range: $100K-$5M per investigation; ProPublica grants $500K-$2M per project.' },
      'oversight_failure':     { why: 'Big corruption cases usually expose oversight failure \u2014 IGs that didn\u2019t catch it, committees that ignored the warning signs, watchdogs that were defunded. The fix is more oversight capacity. Inspector general offices get budget hikes, and the contractors who help them do their work get more contracts.', move: 'Build an inspector general / oversight support service for federal agencies and Congress. Sell to IG community and Senate / House committee staff. Multi-year contracts $250K-$2M.' },
      'institutional_capture': { why: 'Corruption scandals are usually the visible surface of institutional capture. The real story is the network \u2014 who placed who, who hired whose family, who funded whose campaign. Mapping that network is the real anti-corruption work.', move: 'Build a relationship-mapping and network analysis service for investigative journalists and oversight bodies. Sell as a SaaS or as a service. Range: $50K-$500K per year per customer.' },
      'legitimacy_erosion':    { why: 'A live corruption case shreds public trust in whichever institution it touches. Poll numbers fall, reform candidates surge, and donor money flows to legitimacy-rebuilding work \u2014 ethics reform NGOs, transparency platforms, and reform-oriented campaigns. Boards of directors and agency heads who survive the cycle hire crisis communications firms and bring in independent monitors to rebuild a credible compliance posture.', move: 'Build an institutional trust-rebuilding service: ethics reform consulting, independent monitor services, transparency platform deployments, and reform-aligned strategic communications. Sell to boards under DOJ deferred-prosecution agreements, federal agencies under IG-imposed corrective action plans, and state governments rebuilding after a major scandal. Independent monitorships pay $1M-$25M annually; reform comms engagements $250K-$2M.' }
    },
    'DIPLOMATIC_BREAKDOWN': {
      'diplomatic_strain':     { why: 'When diplomacy breaks down \u2014 ambassadors recalled, sanctions imposed, treaties withdrawn \u2014 international law firms and sanctions compliance vendors get the call. Corporate compliance teams scramble to update screening lists, exporters face new licensing rules, and political risk consultancies are hired to interpret what comes next.', move: 'Build a sanctions compliance and international law advisory practice. Sell to multinational corporations, banks, and exporters with exposure to the affected jurisdictions. Major firms (Sidley, White & Case, Cleary, Freshfields) charge $1M-$10M per major sanctions matter.' },
      'legitimacy_erosion':    { why: 'Diplomatic breakdowns usually involve one or both sides losing legitimacy with the other. Tracking which side is losing the narrative becomes critical for businesses trying to plan around the crisis.', move: 'Build a public diplomacy / narrative monitoring service. Sell to state departments, embassies, and corporate government affairs teams. Charge $100K-$1M per year per customer.' },
      'fiscal_crisis':         { why: 'Major sanctions packages and treaty exits move sovereign credit and corporate exposure within hours. Ratings agencies adjust country ceilings, banks reprice trade finance, FX desks reposition, and credit insurers (Coface, Atradius, Aon, Marsh) get hit with new claims. Treasury and corporate hedging desks run scenarios overnight. The fiscal aftershock of a diplomatic break is often bigger than the diplomatic break itself.', move: 'Build a sovereign-and-corporate sanctions risk pricing service: sovereign ratings impact, FX exposure modeling, trade finance gap analysis, and political risk insurance brokerage. Sell to global banks, multinationals with sanctions exposure, and Treasury / Finance ministries. Sovereign rating advisory $250K-$2M; political risk insurance brokerage carries 10-25% commissions on premium volume.' },
      'constitutional_strain': { why: 'A diplomatic crisis often triggers a domestic constitutional fight: war powers questions, treaty-withdrawal authority, sanctions authorization (IEEPA, NEA), and standing for plaintiffs to challenge executive action. Constitutional and national security lawyers get retained immediately, and Congressional general counsel offices spin up rapid-response work.', move: 'Build a war powers / treaty law / national security litigation practice. Sell to congressional committees, sanctioned-party defendants seeking injunctive relief, civil liberties NGOs, and corporate plaintiffs facing sudden export controls. Major matters $500K-$10M; expert witness retainers $50K-$500K.' }
    },
    'MILITARY_OVERREACH': {
      'constitutional_strain': { why: 'When the civil-military balance tilts \u2014 generals making political statements, military deployed for civilian functions, expanded use of emergency powers \u2014 constitutional law firms and democracy NGOs sound the alarm immediately. Civilian oversight think tanks (CNAS, CSIS, RAND) get cited everywhere. Public-interest litigation accelerates.', move: 'Build a civilian oversight and civil-military relations advisory practice. Sell to Congressional committees, foundations, and democracy NGOs. Charge $250K-$5M per multi-year program.' },
      'civil_liberty_erosion': { why: 'Military overreach usually erodes civil liberties \u2014 surveillance powers expanded, detention authorities broadened, due process narrowed. Civil liberties NGOs respond hard.', move: 'Build a civil liberties legal defense fund or join an existing one (ACLU, EFF, Lawyers\u2019 Committee). Fundraise from foundations and donors. Annual budgets $1M-$50M.' },
      'oversight_failure':     { why: 'Military overreach usually depends on weakened oversight \u2014 IGs replaced, congressional committees bypassed, classified programs hidden from review. The fix is more aggressive oversight.', move: 'Build a Congressional oversight support service or join a public-interest oversight NGO (POGO, Public Citizen, CREW). Foundation funding $500K-$5M per year.' },
      'institutional_capture': { why: 'A military that operates outside its civilian-controlled lane is usually being captured \u2014 by a faction inside the executive branch, by defense primes whose programs depend on the deployment, or by a political coalition treating the military as a domestic policy instrument. Mapping the capture network becomes the precondition for any rebalance.', move: 'Build a defense budget and revolving-door investigation practice. Sell to investigative journalism nonprofits (POGO Federal Contractor Misconduct Database, ProPublica, The Intercept), civilian-oversight think tanks (Stimson Center, Quincy Institute, CNAS), and Congressional committees. Investigations $100K-$2M; multi-year research programs $500K-$5M.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn\u2019t exist
  // Plain-English: each entry should make sense to someone who is not a governance expert.
  var MECH_FALLBACK = {
    'institutional_capture':  { why: 'A government institution is being captured by special interests or powerful actors. The fix is independent oversight, watchdog journalism, and reform pressure.', move: 'Build a regulatory capture monitoring service and sell to oversight NGOs and reform foundations.' },
    'policy_paralysis':       { why: 'Government is stuck \u2014 can\u2019t pass laws, can\u2019t implement programs, can\u2019t close budgets. Customers need to anticipate and plan around the gridlock.', move: 'Build a government affairs intelligence service or join a top-tier lobbying firm.' },
    'legitimacy_erosion':     { why: 'Public trust in government is collapsing. Polling, advisory, and crisis communications firms see surge demand.', move: 'Build a political risk advisory practice and sell to corporate boards and sovereign wealth funds.' },
    'corruption_signal':      { why: 'A corruption case is breaking. Investigative journalists, FCPA defense firms, and ethics consultancies see surge demand.', move: 'Build an anti-corruption investigation service and sell to nonprofits, foundations, and FCPA defense firms.' },
    'constitutional_strain':  { why: 'The basic guardrails of the state are bending. Constitutional law firms and civil liberties NGOs respond.', move: 'Build a constitutional law / public-interest practice and fundraise from foundations.' },
    'election_integrity':     { why: 'Election integrity is being challenged. Election security vendors and voter protection NGOs see surge demand.', move: 'Build an election integrity / voter protection service and sell to election authorities and civil rights orgs.' },
    'oversight_failure':      { why: 'Oversight bodies are being defanged or ignored. Watchdog NGOs and Congressional staff augmentation services respond.', move: 'Build an inspector general support service and sell to federal IGs and Congressional committees.' },
    'diplomatic_strain':      { why: 'Diplomatic relations are deteriorating. International law firms and sanctions compliance vendors get the call.', move: 'Build a sanctions compliance and international law advisory practice.' },
    'civil_liberty_erosion':  { why: 'Civil liberties are being restricted. Civil liberties NGOs and constitutional law firms respond.', move: 'Build a civil liberties legal defense fund and fundraise from foundations.' },
    'fiscal_crisis':          { why: 'Fiscal stress is causing bond market repricing and budget pain. Sovereign rating agencies and fiscal advisory firms see demand.', move: 'Build a fiscal advisory and sovereign risk service and sell to bond investors and contractors.' }
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
    return fetch('/assets/data/deep/governance-branch-index.json')
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

    // Pull live governance feed signals — institutional, oversight, congressional, and partisan
    var feeds = state.feeds || [];
    var govSignals = null, congressSignals = null, oversightSignals = null, electionSignals = null, fiscalSignals = null;
    var partisanLeft = null, partisanRight = null;
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      var f = feeds[fpi];
      if (!f.live) continue;
      var fn = (f.name || '').toLowerCase();
      if (fn.indexOf('world bank governance') !== -1 || fn.indexOf('rss governance') !== -1) govSignals = f.value;
      if (fn.indexOf('congress') !== -1 || fn.indexOf('congressional') !== -1 || fn.indexOf('govtrack') !== -1) congressSignals = f.value;
      if (fn.indexOf('gao') !== -1 || fn.indexOf('inspector general') !== -1 || fn.indexOf('pogo') !== -1) oversightSignals = f.value;
      if (fn.indexOf('election') !== -1 || fn.indexOf('ballot') !== -1) electionSignals = f.value;
      if (fn.indexOf('fiscal') !== -1 || fn.indexOf('cbo') !== -1 || fn.indexOf('omb') !== -1 || fn.indexOf('debt ceiling') !== -1) fiscalSignals = f.value;
      // Partisan perspective feeds — positional signal, requires corroboration to fire diagnoses
      if (fn.indexOf('huffpost') !== -1 || fn.indexOf('mother jones') !== -1 || fn.indexOf('the nation') !== -1) partisanLeft = (partisanLeft || 0) + (f.value || 0);
      if (fn.indexOf('breitbart') !== -1 || fn.indexOf('washington times') !== -1 || fn.indexOf('national review') !== -1 || fn.indexOf('daily caller') !== -1) partisanRight = (partisanRight || 0) + (f.value || 0);
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

    // ── Plain-English summary built from REAL governance feed data ──
    // Tone: assume the reader is a smart operator, NOT a governance expert.
    // Lead with the institutional governance signal that tells the clearest story.
    var text = '';

    if (govSignals !== null && govSignals >= 50) {
      text = '<b>Governance signal volume is at very high intensity \u2014 ' + govSignals + ' tracked items in the last cycle.</b> Heavy governance days like this are when constitutional disputes, scandals, regulatory shifts, and major policy fights all hit at once. Lobbying firms work overtime, foundations release crisis grants, and bond markets reprice on rule-of-law signals. The customers in this environment are stretched thin and willing to pay for clarity. ';
    } else if (govSignals !== null && govSignals >= 20) {
      text = '<b>' + govSignals + ' governance items tracked.</b> Elevated activity \u2014 enough to push lobbying, government affairs, and political risk advisory demand higher. ';
    } else if (govSignals !== null) {
      text = '<b>' + govSignals + ' governance items tracked.</b> Background level. The system is watching for escalation across constitutional, oversight, and electoral channels. ';
    }

    if (congressSignals !== null && congressSignals > 0) {
      text += '<b>' + congressSignals + ' congressional / legislative signals</b> moved through the official tracking feeds in the last cycle (bills, votes, committee hearings, floor debates). ';
    }

    if (oversightSignals !== null && oversightSignals > 0) {
      text += '<b>' + oversightSignals + ' oversight signals</b> from GAO, IGs, and watchdog NGOs \u2014 leading indicators for accountability action and compliance demand. ';
    }

    if (electionSignals !== null && electionSignals > 0) {
      text += '<b>' + electionSignals + ' election integrity items</b> tracked \u2014 a leading indicator for election security spending and voter access litigation. ';
    }

    if (fiscalSignals !== null && fiscalSignals > 0) {
      text += '<b>' + fiscalSignals + ' fiscal / budget items</b> tracked from CBO, OMB, and Treasury \u2014 leading indicator for fiscal advisory and bond market repricing. ';
    }

    // Partisan / positional signals — treated as directional only, not as diagnosis confirmation
    var partisanParts = [];
    if (partisanLeft !== null && partisanLeft > 0) partisanParts.push('left-leaning press: ' + partisanLeft);
    if (partisanRight !== null && partisanRight > 0) partisanParts.push('right-leaning press: ' + partisanRight);
    if (partisanParts.length > 0) {
      text += '<b style="color:#C9A94E">PARTISAN PERSPECTIVE</b> (positional signal only \u2014 cannot independently confirm high-stress diagnoses): ' + partisanParts.join(' \u00b7 ') + '. Use these for directional framing, not for evidence. High-stress diagnoses still require corroboration from institutionally stronger sources (GAO, CBO, IG reports, mainstream press). ';
    }

    // Tie back to active diagnoses
    if (activeDx.length > 0) {
      text += '<b>' + activeDx.length + ' active diagnosis ' + (activeDx.length > 1 ? 'pathways are' : 'pathway is') + ' currently confirmed by live evidence.</b> ';
    } else if (govSignals !== null || congressSignals !== null) {
      text += 'No diagnosis pathways are currently active \u2014 the system is watching for constitutional crises, regime instability, policy failures, corruption scandals, diplomatic breakdowns, and military overreach. ';
    }

    // Fallback if no feeds at all
    if (!text) {
      text = '<b>Governance feeds loading.</b> Waiting for live institutional, congressional, and oversight data. ';
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
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENGovernanceExecutionPanels) {
        h += window.LIMENGovernanceExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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
      var claims = ledger.getClaimsByDomain('governance');
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
          domain: 'governance',
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
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'governance') : null;
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

    var bridge = window.LIMENGovernancePromotionBridge;
    console.log('[GovernanceOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('governance') : null;
      var portalCache = brain ? brain._portalCache : null;
      var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
      console.log('[GovernanceOperator] brain=' + !!brain + ' portalCache=' + !!portalCache + ' activeDx=' + activeDx.length + ' stress=' + state.stress);

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          console.log('[GovernanceOperator] First bridge run — extracting...');
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            console.log('[GovernanceOperator] Bridge returned ' + (promoted ? promoted.length : 0) + ' promoted directives');
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) {
                console.log('[GovernanceOperator] Re-rendering with ' + promoted.length + ' directives');
                _renderOperatorDOM(freshState);
              }
            }
          }).catch(function (err) {
            console.error('[GovernanceOperator] Bridge error:', err);
          });
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        console.log('[GovernanceOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var retryBrain = brains ? brains.get('governance') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          console.log('[GovernanceOperator] Retry: brain=' + !!retryBrain + ' cache=' + !!retryCache);
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            var retryDx = retryState ? (retryState.diagnoses || []).filter(function (d) { return d.active; }).length : 0;
            console.log('[GovernanceOperator] Retry: state=' + !!retryState + ' activeDx=' + retryDx);
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                console.log('[GovernanceOperator] Retry bridge returned ' + (promoted ? promoted.length : 0));
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function (err) {
                console.error('[GovernanceOperator] Retry bridge error:', err);
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['governance'], type: 'invest' };

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
        if (!outcome) outcome = 'Linked governance companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=governance&returnTo=' + encodeURIComponent('/domain-console?domain=governance');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'governance', function (confirmedOpp, estimate) {
          // Create claim in ledger
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'governance', estimate);
          }
          // Re-render to show CLAIMED badge
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel (global)
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'governance');
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
    if (window.LIMENGovernanceBusinessReview) {
      window.LIMENGovernanceBusinessReview.mount(_operatorView);
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

    console.log('[GovernanceOperator] Booted — operator view created, toggle wired');
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
