/**
 * defense-clarity-operator.js — Money-Driven Action Surface for Defense Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #eos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=defense is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on defense domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'defense') return;

  var VIEW_ID = 'eos-operator-view';
  var STATUS_KEY = 'limen_defense_operator_status';
  var COLLAPSE_KEY = 'limen_defense_collapse_state';
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
      '.eos-path-research{color:#5ab5a0;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.06)}',
      '.eos-path-invest{color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)}',
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
    var brain = brains.get('defense');
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
    'INVASION': {
      what: 'A nation-state is conducting (or staging) a kinetic invasion or large-scale military movement across borders. This is the highest-money-flow defense scenario \u2014 entire decade-long procurement cycles compress into months when tanks are actually moving.',
      money: 'Defense primes (Lockheed, RTX, Northrop, BAE, Rheinmetall), munitions manufacturers (replenishment of stockpiles), drone / counter-drone vendors, sustainment and logistics contractors all see acute demand. Sovereign wealth funds and allied ministries open emergency procurement lines. Foreign Military Sales pipelines accelerate dramatically.',
      step: 'Track Janes, IISS, RUSI, ACLED conflict feeds, ISW daily updates, and allied defense ministry procurement announcements. Position in munitions replenishment, counter-UAS, electronic warfare, and sustainment logistics. Focus on European primes (BA., HO, RHM) and US primes (LMT, RTX, NOC).',
      outcome: '$50M-$5B+ allied procurement contracts, FMS approvals, or 30-50% defense sector premium during sustained tension'
    },
    'CYBER_ATTACK': {
      what: 'A nation-state cyber operation is targeting critical infrastructure, defense networks, or weapons systems. Often the precursor to or accompaniment of kinetic action.',
      money: 'Defense cybersecurity vendors (CrowdStrike Falcon Federal, Mandiant, Palantir, Two Six), CMMC compliance providers, and critical infrastructure protection firms gain immediate demand. Cyber Command contracts accelerate. Allied partners request capability transfers.',
      step: 'Track CISA advisories, Mandiant M-Trends, Microsoft DCU and MSTIC reports, Talos Intel, NCSC UK alerts. Position in defense cybersecurity, weapon system cyber assessment, and CMMC compliance.',
      outcome: '$5M-$500M defense cyber contracts (DARPA, AFRL, DISA, Cyber Command, allied SOCs)'
    },
    'NUCLEAR_THREAT': {
      what: 'Nuclear escalation indicators are rising \u2014 weapon tests, deployment changes, treaty withdrawals, or rhetorical threats. Strategic deterrence is being tested.',
      money: 'Nuclear sustainment contractors (BWXT, Honeywell FM&T), strategic deterrent platform integrators (Lockheed Trident / Sentinel, Northrop B-21 / Sentinel), nuclear command and control modernization vendors, and arms control verification providers all see increased budget priority. Allied nuclear sharing programs receive new attention.',
      step: 'Track IAEA reporting, NTI (Nuclear Threat Initiative) updates, FAS Nuclear Notebook, ISW strategic deterrence updates, and STRATCOM commentary. Position in strategic deterrent modernization, NC3, and verification capabilities.',
      outcome: '$100M-$10B+ nuclear sustainment and modernization contracts'
    },
    'INTELLIGENCE_FAILURE': {
      what: 'A major intelligence gap or strategic surprise has exposed the limits of current ISR and analysis capabilities. The question becomes: what did we miss, and how do we make sure we never miss it again?',
      money: 'OSINT and multi-INT fusion vendors (Palantir, Anduril, Two Six, Recorded Future, Sayari), commercial satellite imagery (Maxar, Planet, BlackSky, Capella, ICEYE), AI-powered analysis platforms, and HUMINT support services see rapid procurement. IARPA and In-Q-Tel investment activity accelerates.',
      step: 'Track ODNI public statements, congressional intelligence committee hearings, IC ITE / DoDIIS modernization plans, and public commercial imagery and OSINT vendor roadmaps. Position in multi-INT fusion, commercial ISR, and AI analyst augmentation.',
      outcome: '$10M-$1B+ ISR and intelligence analysis contracts'
    },
    'LOGISTICS_COLLAPSE': {
      what: 'Defense supply chains, sustainment, and force readiness are degrading \u2014 munitions stockpiles depleted, spare parts gaps, fuel supply problems, or sealift / airlift shortfalls. The military can\u2019t fight as long as planned.',
      money: 'Munitions manufacturers (replenishment urgency), defense logistics contractors (KBR, Vectrus, Fluor, DynCorp), sustainment service providers, additive manufacturing for defense, and predictive maintenance vendors all see opportunity. Defense Logistics Agency contracts accelerate. Allied sustainment partnerships expand.',
      step: 'Track DLA awards, GAO reports on readiness, congressional readiness hearings, NATO NSPA contracts, and prime contractor sustainment quarterly results. Position in munitions production, additive manufacturing, and sustainment SaaS.',
      outcome: '$50M-$5B+ sustainment and replenishment contracts (DLA, NSPA, allied logistics commands)'
    },
    'CIVIL_UNREST': {
      what: 'Domestic or allied-territory civil unrest is escalating to the point where military or paramilitary forces are involved \u2014 protests, riots, insurrection, or martial response.',
      money: 'Civil disturbance equipment vendors, non-lethal weapons manufacturers, crowd-control technology providers, intelligence support to civil authorities, and law enforcement augmentation services see demand. National Guards and gendarmerie equivalents accelerate procurement.',
      step: 'Track ACLED civil unrest data, Crisis24, Stratfor civil disturbance reports, and national-guard equivalent budget activity. Position in non-lethal capability, civil disturbance training, and intelligence support to civil authorities.',
      outcome: '$5M-$500M civil disturbance and homeland security contracts'
    }
  };

  var PATH_LABELS = { 'RESEARCHABLE': 'RESEARCH', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'RESEARCHABLE': 'eos-path-research', 'INVESTABLE': 'eos-path-invest' };

  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL INVESTMENT PLAYBOOK MAPPING
  // Maps brain opportunity sources to registered investment console IDs.
  // Only opportunities with a canonical mapping get an INVEST button.
  // ══════════════════════════════════════════════════════════════════════

  // Diagnosis → playbook ID for Defense-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'INVASION':              'def_kinetic',
    'CYBER_ATTACK':          'def_cyber',
    'NUCLEAR_THREAT':        'def_strategic',
    'INTELLIGENCE_FAILURE':  'def_isr',
    'LOGISTICS_COLLAPSE':    'def_sustainment',
    'CIVIL_UNREST':          'def_homeland'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'def_kinetic',
    'company_stressed':  'def_sustainment',
    'convergence':       'def_isr',
    'cross_domain':      'def_strategic'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'def_kinetic':    { title: 'Kinetic Force, Munitions & Replenishment', domains: ['defense', 'industry'], type: 'invest' },
    'def_cyber':      { title: 'Defense Cyber & Critical Infrastructure', domains: ['defense', 'technology'], type: 'invest' },
    'def_strategic':  { title: 'Strategic Deterrence & Nuclear Modernization', domains: ['defense', 'governance'], type: 'invest' },
    'def_isr':        { title: 'ISR, OSINT & Intelligence Modernization', domains: ['defense', 'intelligence'], type: 'invest' },
    'def_sustainment':{ title: 'Defense Sustainment & Logistics', domains: ['defense', 'supplyChain'], type: 'invest' },
    'def_homeland':   { title: 'Homeland Security & Civil Defense', domains: ['defense', 'governance'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in defense.json portal),
  //             DOMAIN_MAPPED (in defense command board), ETF_PROXY (sector proxy, no company-level validation)
  var INVEST_TARGETS = {
    'def_kinetic': [
      { ticker: 'ITA',       name: 'iShares U.S. Aerospace & Defense ETF', cik: null,      validation: 'ETF_PROXY',       reason: 'Defense ETF \u2014 thematic proxy for U.S. defense spending surge' },
      { ticker: 'XAR',       name: 'SPDR S&P Aerospace & Defense ETF',     cik: null,      validation: 'ETF_PROXY',       reason: 'Equal-weight defense and aerospace ETF \u2014 more exposure to mid-cap primes than ITA' },
      { ticker: 'LMT',       name: 'Lockheed Martin',                      cik: '936468',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. defense prime; missiles, F-35, HIMARS, PAC-3, THAAD' },
      { ticker: 'RTX',       name: 'RTX Corporation',                      cik: '101829',  validation: 'HELIX_VALIDATED', reason: 'Raytheon air defense (Patriot, SM-6), Stinger, Tomahawk, NASAMS' },
      { ticker: 'NOC',       name: 'Northrop Grumman',                     cik: '1133421', validation: 'HELIX_VALIDATED', reason: 'B-21 Raider, Sentinel ICBM, Triton, AARGM-ER' },
      { ticker: 'GD',        name: 'General Dynamics',                     cik: '40533',   validation: 'HELIX_VALIDATED', reason: 'Abrams, Stryker, Virginia / Columbia submarines, Bath Iron Works' },
      { ticker: 'BA.L',      name: 'BAE Systems plc',                      cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Largest European defense prime; Eurofighter, Type 26, M777' },
      { ticker: 'RHM.DE',    name: 'Rheinmetall AG',                       cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'European munitions and Leopard 2 main battle tank; massive replenishment exposure' },
      { ticker: 'AVAV',      name: 'AeroVironment',                        cik: '1368622', validation: 'DOMAIN_MAPPED',   reason: 'Switchblade loitering munitions; Puma and Raven small UAS for U.S. Army and allies' },
      { ticker: 'KTOS',      name: 'Kratos Defense & Security Solutions',  cik: '1069258', validation: 'DOMAIN_MAPPED',   reason: 'Valkyrie CCA autonomous wingman, target drones, and tactical missile propulsion' },
      { ticker: '012450.KS', name: 'Hanwha Aerospace',                     cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'K9 Thunder self-propelled howitzer, Chunmoo MLRS \u2014 major Korean artillery exports to Poland and NATO' },
      { ticker: 'KOG.OL',    name: 'Kongsberg Gruppen',                    cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Naval Strike Missile and Joint Strike Missile; CROWS remote weapon stations for U.S. Army' }
    ],
    'def_cyber': [
      { ticker: 'CRWD',    name: 'CrowdStrike Holdings',                  cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Falcon Federal serves DoD, IC, and federal civilian agencies' },
      { ticker: 'PANW',    name: 'Palo Alto Networks',                    cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Cortex XDR + firewall serve DoD networks and allied SOCs' },
      { ticker: 'PLTR',    name: 'Palantir Technologies',                 cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'AIP and Gotham platforms anchor multi-INT and cyber operations for DoD and IC' },
      { ticker: 'BAH',     name: 'Booz Allen Hamilton',                   cik: '1443669', validation: 'DOMAIN_MAPPED',   reason: 'Largest federal cyber services contractor, serves NSA, Cyber Command' },
      { ticker: 'LDOS',    name: 'Leidos Holdings',                       cik: '1336920', validation: 'DOMAIN_MAPPED',   reason: 'Federal IT and cyber services prime' },
      { ticker: 'CACI',    name: 'CACI International',                    cik: '17843',   validation: 'DOMAIN_MAPPED',   reason: 'Defense and intelligence-focused cyber and SIGINT contractor' },
      { ticker: 'SAIC',    name: 'Science Applications International',    cik: '1571123', validation: 'DOMAIN_MAPPED',   reason: 'Federal cyber engineering and DISA / ACC NIPR+SIPR support contracts' },
      { ticker: 'PSN',     name: 'Parsons Corporation',                   cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Cyber and missile defense engineering for Cyber Command, MDA, and DHS CISA' },
      { ticker: 'CIBR',    name: 'First Trust NASDAQ Cybersecurity ETF',  cik: null,      validation: 'ETF_PROXY',       reason: 'Cybersecurity sector ETF \u2014 captures federal-exposed names that don\u2019t fit as pure defense primes' }
    ],
    'def_strategic': [
      { ticker: 'BWXT',    name: 'BWX Technologies',                      cik: '1383054', validation: 'HELIX_VALIDATED', reason: 'Naval reactors, NNSA Y-12 / Pantex, nuclear weapons sustainment' },
      { ticker: 'LMT',     name: 'Lockheed Martin (Trident, Sentinel)',   cik: '936468',  validation: 'HELIX_VALIDATED', reason: 'Trident D5 SLBM, Sentinel ICBM warhead integrator' },
      { ticker: 'NOC',     name: 'Northrop Grumman (B-21, Sentinel)',     cik: '1133421', validation: 'HELIX_VALIDATED', reason: 'Prime on B-21 Raider strategic bomber and Sentinel ICBM' },
      { ticker: 'HII',     name: 'Huntington Ingalls (Columbia SSBN)',    cik: '1501585', validation: 'HELIX_VALIDATED', reason: 'Columbia-class SSBN and Virginia-class SSN construction at Newport News' },
      { ticker: 'HON',     name: 'Honeywell International',               cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Federal Manufacturing & Technologies runs NNSA Kansas City National Security Campus \u2014 85% of non-nuclear warhead components' },
      { ticker: 'CCJ',     name: 'Cameco',                                cik: '1009001', validation: 'DOMAIN_MAPPED',   reason: 'Largest publicly traded uranium producer; nuclear fuel cycle exposure' },
      { ticker: 'LEU',     name: 'Centrus Energy',                        cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Only U.S.-licensed HALEU producer; critical to DOE advanced reactor and defense fuel supply' },
      { ticker: 'DNN',     name: 'Denison Mines',                         cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Athabasca Basin uranium developer; North American fuel cycle security exposure' },
      { ticker: 'URA',     name: 'Global X Uranium ETF',                  cik: null,      validation: 'ETF_PROXY',       reason: 'Uranium / nuclear fuel cycle ETF' }
    ],
    'def_isr': [
      { ticker: 'PLTR',    name: 'Palantir Technologies',                 cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Gotham + AIP are the dominant intel analyst platforms for IC and DoD' },
      { ticker: 'PL',      name: 'Planet Labs',                           cik: '1836833', validation: 'DOMAIN_MAPPED',   reason: 'Daily-revisit commercial satellite imagery; major IC and IL5 customer' },
      { ticker: 'BKSY',    name: 'BlackSky Technology',                   cik: '1753539', validation: 'DOMAIN_MAPPED',   reason: 'Tactical commercial satellite imagery for DoD and allies' },
      { ticker: 'RKLB',    name: 'Rocket Lab USA',                        cik: '1819994', validation: 'DOMAIN_MAPPED',   reason: 'Responsive launch and small satellite provider; growing space ISR business' },
      { ticker: 'LHX',     name: 'L3Harris Technologies',                 cik: '202058',  validation: 'HELIX_VALIDATED', reason: 'C5ISR, EW, and tactical communications prime' },
      { ticker: 'IRDM',    name: 'Iridium Communications',                cik: '1418819', validation: 'DOMAIN_MAPPED',   reason: 'Global satellite comms with major DoD Iridium Government contract' },
      { ticker: 'SPIR',    name: 'Spire Global',                          cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'RF-sensing cubesat constellation; GPS-denied maritime and aviation signal intelligence' },
      { ticker: 'TDY',     name: 'Teledyne Technologies',                 cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'FLIR EO/IR imaging, unmanned maritime systems, defense electronics after FLIR merger' },
      { ticker: 'AVAV',    name: 'AeroVironment (ISR UAS)',               cik: '1368622', validation: 'DOMAIN_MAPPED',   reason: 'Puma, Raven, Jump 20 small UAS provide tactical ISR for U.S. Army and allies' },
      { ticker: 'KTOS',    name: 'Kratos (target drones, C5ISR)',         cik: '1069258', validation: 'DOMAIN_MAPPED',   reason: 'BQM target drones, Geo Location satellite services, and tactical C5ISR integration' }
    ],
    'def_sustainment': [
      { ticker: 'KBR',     name: 'KBR Inc.',                              cik: '1357615', validation: 'HELIX_VALIDATED', reason: 'LOGCAP V prime; defense logistics and base support for DoD and NATO' },
      { ticker: 'V2X',     name: 'V2X Inc.',                              cik: '1844488', validation: 'DOMAIN_MAPPED',   reason: 'Mission support and operations / maintenance for DoD globally' },
      { ticker: 'GD',      name: 'General Dynamics (NASSCO, Bath)',       cik: '40533',   validation: 'HELIX_VALIDATED', reason: 'Naval sustainment, ship maintenance, depot operations' },
      { ticker: 'HII',     name: 'Huntington Ingalls Industries',         cik: '1501585', validation: 'HELIX_VALIDATED', reason: 'Largest U.S. military shipbuilder; carrier and submarine sustainment' },
      { ticker: 'BA',      name: 'Boeing Defense, Space & Security',      cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'KC-46 tanker, Apache, Chinook, and F-15EX sustainment contracts across U.S. and allied fleets' },
      { ticker: 'TDG',     name: 'TransDigm Group',                       cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Proprietary aerospace components with defense aftermarket concentration; high margin on spares' },
      { ticker: 'HEI',     name: 'HEICO Corporation',                     cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'FAA-approved aftermarket defense aerospace parts; a direct sustainment beneficiary' },
      { ticker: 'PRLB',    name: 'Protolabs',                             cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Digital manufacturing of low-volume defense spare parts; additive and CNC for DLA' },
      { ticker: 'CW',      name: 'Curtiss-Wright',                        cik: '26324',   validation: 'DOMAIN_MAPPED',   reason: 'Naval nuclear propulsion components, flight test instrumentation, defense aerospace sustainment' }
    ],
    'def_homeland': [
      { ticker: 'AXON',    name: 'Axon Enterprise',                       cik: '1069183', validation: 'DOMAIN_MAPPED',   reason: 'Tasers, body cameras, and law enforcement / homeland security tech' },
      { ticker: 'MOG.A',   name: 'Moog Inc.',                             cik: '67887',   validation: 'DOMAIN_MAPPED',   reason: 'Motion control for missile systems and security platforms' },
      { ticker: 'MSI',     name: 'Motorola Solutions',                    cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'P25 mission-critical radios and command center software for FBI, DHS, and state/local first responders' },
      { ticker: 'BAH',     name: 'Booz Allen Hamilton (DHS practice)',    cik: '1443669', validation: 'DOMAIN_MAPPED',   reason: 'DHS CISA, TSA, and federal civilian cyber and advisory work' },
      { ticker: 'LDOS',    name: 'Leidos Holdings (DHS)',                 cik: '1336920', validation: 'DOMAIN_MAPPED',   reason: 'TSA checkpoint screening systems and CBP biometric programs' },
      { ticker: 'SAIC',    name: 'Science Applications International (DHS)', cik: '1571123', validation: 'DOMAIN_MAPPED', reason: 'DHS enterprise IT modernization and CBP border infrastructure programs' },
      { ticker: 'PSN',     name: 'Parsons Corporation (CISA)',            cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'DHS CISA critical infrastructure protection and physical security engineering' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → kinetic
    if (opp.source === 'lagging') return 'def_kinetic';
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Defense condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Defense portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=defense&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
  // Plain-English explanations: assume the reader is a smart operator, not a defense expert.
  var MECH_EXPLAIN = {
    'INVASION': {
      'kinetic_threat':    { why: 'When tanks actually start moving, decade-long defense procurement cycles compress into months. Allied stockpiles get blown through in weeks, not years \u2014 the Ukraine war proved that the United States and its allies can fire 155mm artillery shells faster than they can produce them, and that we have nothing close to enough Stingers, Javelins, and PAC-3 interceptors to sustain a major war. Defense ministries everywhere are now writing checks they wouldn\u2019t have written five years ago, and the primes that can actually deliver are seeing the biggest demand surge since the early Cold War.', move: 'Position in munitions manufacturers (Lockheed Martin HIMARS / JASSM, RTX Tomahawk / SM-6, Northrop AARGM-ER, BAE Systems M777, Rheinmetall 155mm production), counter-UAS vendors (Anduril, Epirus, Fortem), and combat vehicle manufacturers (GD Land Systems, Rheinmetall Leopard 2, KNDS). Allied procurement contracts are running $50M-$5B+. The window stays open as long as the war does.' },
      'logistics_supply':  { why: 'A military runs on logistics, and modern wars expose how fragile defense supply chains have become. The U.S. discovered during Ukraine support that critical components for missiles and artillery shells come from sole-source suppliers, that depot maintenance takes years longer than planned, and that sustainment contracts are massively underfunded. Every defense ministry on the planet is now scrambling to rebuild industrial base, fix supply chains, and grow stockpiles \u2014 and the contractors who can deliver are seeing money they\u2019ve never seen before.', move: 'Position in defense logistics primes (KBR LOGCAP V, Vectrus, Fluor, DynCorp), additive manufacturing for defense parts, predictive maintenance vendors, and Defense Logistics Agency suppliers. Pursue NSPA, DLA, and allied sustainment contracts. Range: $50M-$5B+ per multi-year contract.' },
      'alliance_pressure': { why: 'When one ally is invaded, every other ally has to prove its commitment \u2014 immediately. NATO Article 5, AUKUS, the Quad, and ad hoc coalitions all generate massive coordination demand: interoperable communications, joint exercises, capability transfer, training, and combined logistics. The contractors who can deliver coalition C2, joint training, and allied capability transfer become indispensable.', move: 'Build or position in coalition C2 platforms, NATO interoperability services, joint exercise providers (Cubic, BAE Mission Systems, Leidos), and allied capability transfer programs. Pursue NATO STO, EDF, and AUKUS Pillar 2 grants. Contracts run $5M-$500M.' },
      'drone_autonomous':  { why: 'Modern wars are now drone wars. Ukraine showed that $500 FPV drones can destroy $5M tanks, that loitering munitions reshape every battlefield, and that counter-UAS is now as important as air defense. Every defense ministry is racing to scale both offensive autonomous systems and counter-drone capability. The valley of death between prototype and program of record has finally collapsed.', move: 'Position in autonomous strike vendors (Anduril, Shield AI, Saronic, AeroVironment Switchblade, Lockheed Speed Racer), counter-UAS vendors (Anduril Sentry, Epirus Leonidas, Fortem, Northrop FAAD), and the FPV ecosystem. Position in venture-backed defense-tech (Anduril, Helsing, Quantum Systems, Tekever). Range: $10M-$1B per contract.' }
    },
    'CYBER_ATTACK': {
      'cyber_warfare':     { why: 'Cyber operations against defense networks, weapons systems, and critical infrastructure are now constant background noise that escalates sharply during any kinetic crisis. Every defense ministry is investing in defensive cyber. The U.S. is investing in offensive cyber. Allied SOCs need every tool they can get. CMMC is now a hard requirement for every defense contractor in the supply chain.', move: 'Position in defense cyber primes (CrowdStrike Falcon Federal, Mandiant, Palantir, Two Six Technologies), CMMC compliance vendors, weapon-system cybersecurity assessment firms, and federal red-team services. Pursue Cyber Command, DARPA, AFRL, and allied SOC contracts. Range: $5M-$500M per contract.' },
      'intel_gap':         { why: 'Cyber attacks usually come with intelligence gaps \u2014 you didn\u2019t see them coming because you didn\u2019t have the visibility. The fix is more sensors, better analysis, and faster fusion. The IC and DoD are spending heavily on commercial OSINT, AI-driven analysis, and multi-INT fusion to close those gaps.', move: 'Position in OSINT vendors (Recorded Future, Sayari, Janes), commercial satellite imagery (Maxar, Planet, BlackSky), and multi-INT platforms (Palantir Gaia, Anduril Lattice, BAE Sentinel). Pursue IARPA, In-Q-Tel, and DIA contracts.' },
      'space_dominance':   { why: 'Cyber and space are now joined at the hip \u2014 you attack satellites with cyber, you spoof GPS, you jam SATCOM. Defense space spending is climbing fast as the U.S. Space Force matures and as China and Russia demonstrate counter-space capability. Commercial space ISR providers are absorbing huge new defense contracts.', move: 'Position in commercial satellite imagery (Maxar, Planet, BlackSky, Capella, ICEYE), responsive launch (Rocket Lab, Firefly), and space domain awareness vendors (LeoLabs, ExoAnalytic). Pursue Space Force USSF and Space Development Agency contracts.' },
      'drone_autonomous':  { why: 'A serious cyber attack pushes defense ministries to assume adversary presence on U.S. and allied networks, and that drives a sharp shift toward autonomous and edge-resident systems that can keep fighting when the link is compromised. Counter-drone capability becomes urgent too, because cyber-attack campaigns are now routinely paired with kamikaze drone swarms against airfields, refineries, and substations. The collapsing valley of death for defense autonomy gets pushed even harder.', move: 'Position in autonomous edge compute for denied networks (Anduril Lattice, Shield AI Hivemind, Saronic), counter-UAS (Anduril Sentry, Epirus Leonidas, Fortem TrueView), and hardened tactical clouds (Kratos OpenSpace, Palantir Edge AI). Pursue DIU CUAS and Replicator contracts.' }
    },
    'NUCLEAR_THREAT': {
      'nuclear_escalation':{ why: 'Nuclear modernization is the largest defense investment most people never hear about. The U.S. nuclear triad replacement (Sentinel ICBM, Columbia-class SSBN, B-21 bomber, NC3 modernization, W93 warhead) is a multi-decade $1+ trillion program. Allied programs (UK Dreadnought, France ASN4G, Australian SSN-AUKUS) add hundreds of billions more. When nuclear tensions rise, this funding accelerates and protected.', move: 'Position in nuclear sustainment contractors (BWXT, Honeywell FM&T, Y-12 contractors), strategic deterrent platform integrators (Lockheed Martin Trident / Sentinel, Northrop Grumman B-21 / Sentinel), NC3 modernization vendors, and uranium / fuel cycle (Cameco, BWXT, Centrus). Range: $100M-$10B+ programs.' },
      'alliance_pressure': { why: 'Nuclear threats force allies to renew commitments and capability sharing. AUKUS submarine program, NATO nuclear sharing, and extended deterrence all generate procurement and sustainment contracts. Allied SSBN and SSN programs accelerate. Nuclear-armed allies coordinate doctrine and modernization.', move: 'Position in allied nuclear program suppliers (BAE Systems UK Astute / Dreadnought, Naval Group France, ASC Australia for SSN-AUKUS), and alliance nuclear consultancy. Pursue AUKUS Pillar 1 contracts and allied SLBM / SSBN sustainment.' },
      'intel_gap':         { why: 'Nuclear monitoring requires extraordinary intelligence capability \u2014 satellite imagery of enrichment sites, sigint on launch preparations, HUMINT on weapon programs, scientific instruments at test sites. IAEA, NNSA, and defense intelligence all expand budget under nuclear stress.', move: 'Position in nuclear monitoring and verification (Kratos, Lockheed Martin special programs), IAEA support contractors, and arms-control verification firms. Pursue NNSA and IAEA contracts.' },
      'space_dominance':   { why: 'Nuclear warning is a space mission. The U.S. SBIRS and Next-Gen OPIR constellations detect ICBM launches from space; NC3 depends on AEHF and MILSTAR satellites; NDS-T tracks hypersonic glide vehicles from LEO. When nuclear threats rise, Space Force and the Space Development Agency accelerate every one of these, and commercial space ISR gets pulled into the nuclear indications and warning pipeline.', move: 'Position in space-based missile warning integrators (Lockheed Martin Next-Gen OPIR, Northrop Grumman NDS-T, L3Harris tracking layer), protected SATCOM for NC3 (Boeing WGS, Lockheed AEHF), and commercial SAR for nuclear site monitoring (Capella, ICEYE, Umbra). Pursue SDA Tracking Layer and SSC Protected SATCOM contracts.' }
    },
    'INTELLIGENCE_FAILURE': {
      'intel_gap':         { why: 'A major intelligence failure \u2014 a strategic surprise, a missed indicator, a botched analysis \u2014 forces the IC to spend money fast on the gap. Pearl Harbor created the OSS. 9/11 created DHS, ODNI, and a decade of OSINT and HUMINT spending. The October 7 surprise has accelerated commercial OSINT and AI-augmented analysis investment. After every failure, money flows to whoever can credibly say "we would have caught this."', move: 'Position in commercial OSINT (Recorded Future, Sayari, Janes), commercial satellite imagery (Maxar, Planet, BlackSky), AI-augmented analyst tools (Palantir AIP, Two Six Primer, Anduril), and multi-INT fusion platforms. Pursue IARPA, In-Q-Tel, and IC ITE contracts. Range: $10M-$1B+.' },
      'cyber_warfare':     { why: 'Most intelligence failures now involve a cyber dimension \u2014 either we couldn\u2019t see because adversary OPSEC was too good, or we missed the cyber preparation that preceded a kinetic event. Investing in cyber-enabled intelligence collection and analysis is a direct response.', move: 'Position in cyber-enabled intelligence vendors and federal cyber collection contractors. Pursue NSA contractor work and IC offensive / defensive cyber programs.' },
      'space_dominance':   { why: 'Space is now the dominant ISR collection medium. After every intel failure, commercial space ISR sees a procurement surge. The IC is also racing to integrate commercial space data into traditional intelligence workflows.', move: 'Position in commercial space ISR (Maxar, Planet, BlackSky, Capella, ICEYE), space data fusion platforms, and tactical ground stations. Pursue NRO commercial imagery contracts.' },
      'drone_autonomous':  { why: 'Intelligence failures are now almost always tactical ISR failures \u2014 the satellite revisit was too slow, the drone wasn\u2019t on station, the AI model missed the pattern. The fix is more persistent, more autonomous, more tactical collection. Commercial tactical UAS, loitering munitions with ISR payloads, and AI-augmented pattern detection on full-motion video are all direct beneficiaries after every surprise.', move: 'Position in tactical UAS ISR (AeroVironment Puma / Jump 20, Skydio X10D, Shield AI V-BAT), autonomy stacks that run tactical loitering ISR (Anduril Ghost / Altius, Shield AI Hivemind), and computer-vision targeting (Project Maven primes: Palantir, Microsoft, Amazon, Google). Pursue DIU, DARPA, and Replicator ISR contracts.' }
    },
    'LOGISTICS_COLLAPSE': {
      'logistics_supply':  { why: 'When defense logistics fails \u2014 fuel shortages, depot delays, munitions stockouts, sealift gaps \u2014 the political and budget consequences are immediate. Defense Logistics Agency, Transportation Command, and allied equivalents start writing emergency contracts. The contractors who can actually deliver fuel, food, parts, munitions, and maintenance get every dollar in the surge budget.', move: 'Position in defense logistics primes (KBR LOGCAP V, Vectrus, Fluor, DynCorp, V2X), additive manufacturing for defense parts, predictive maintenance, fuel and energy contractors, and ship maintenance / depot vendors (Huntington Ingalls, BAE Ship Repair). Range: $50M-$5B+ per multi-year contract.' },
      'arms_export':       { why: 'When the U.S. military runs short, the natural fix is to lean on allied production: more European 155mm shells, more Korean K9 howitzers, more Japanese munitions. FMS approvals accelerate, allied primes get U.S. contracts, and joint production lines get standing up faster than anyone thought possible. Procurement intelligence becomes critical.', move: 'Position in defense procurement intelligence (Govini, GovWin, Janes IHS), allied prime exposure (Hanwha, KAI, Mitsubishi Heavy, Rheinmetall, BAE Systems), and FMS support consultancies. Pursue DSCA-related advisory work.' },
      'kinetic_threat':    { why: 'Logistics collapse usually happens because demand spiked from a kinetic threat. The fix is parallel: accelerate kinetic capability while fixing the supply chain. Every dollar that goes into logistics fixes also flows into munitions production, vehicle replacement, and force generation.', move: 'Position in munitions production (Lockheed, RTX, Northrop, BAE, Rheinmetall) and combat vehicle production (GD Land Systems, Rheinmetall, Hanwha, Hyundai Rotem).' },
      'drone_autonomous':  { why: 'The sharpest fix for a broken logistics chain is to cut humans out of the last mile. Autonomous resupply drones, unmanned surface vessels for contested logistics, and distributed additive manufacturing at the point of need are all getting their first real production contracts because U.S. and allied logistics cannot scale the way they did before. When depot maintenance or sealift breaks, Congress suddenly funds what had been stuck in prototype for a decade.', move: 'Position in unmanned logistics (Kratos, Elroy Air, Saronic USVs, Sikorsky Matrix autonomy), distributed additive manufacturing (Protolabs, 3D Systems, Markforged defense), and contested-logistics automation (Palantir Foundry Warp Speed, Anduril Menace, HII Unmanned). Pursue TRANSCOM, DLA, and Replicator contracts.' }
    },
    'CIVIL_UNREST': {
      'civil_unrest':      { why: 'When domestic civil unrest escalates to military involvement \u2014 National Guard activation, gendarmerie deployment, martial law \u2014 there is sudden demand for non-lethal capability, crowd control, surveillance, and intelligence support to civil authorities. Most countries have small homeland security budgets relative to their main defense budgets, but those budgets surge fast when unrest hits.', move: 'Position in non-lethal weapons (Axon Enterprise, BAE Systems Land), civil disturbance training, intelligence support to civil authorities, and homeland security IT (Leidos, BAH, CACI). Range: $5M-$500M per contract.' },
      'intel_gap':         { why: 'Civil unrest is often a downstream symptom of intelligence failure \u2014 missed indicators of escalation, poor open-source monitoring of social movements, slow analysis of grievances. Investing in domestic OSINT and social-media monitoring is the response.', move: 'Position in OSINT and social-media monitoring vendors that work with domestic security agencies. Pursue DHS S&T and federal civilian contracts.' },
      'kinetic_threat':    { why: 'Sustained unrest forces governments to think about kinetic force continuity inside the homeland: riot control munitions, anti-materiel rifles for trained response teams, LRAD acoustic hailers, armored vehicles for urban deployment, and sniper / counter-sniper capability around critical sites. The line between military and law enforcement procurement blurs fast, and primes that serve both channels see a dedicated procurement surge.', move: 'Position in crowd-management kinetic vendors (Combined Systems, Defense Technology / Safariland less-lethal, LRAD acoustic hailers via Genasys), armored vehicle retrofit (Oshkosh LTATV, Lenco BearCat), and counter-sniper sensing (Raytheon Boomerang, Shooter Detection Systems). Pursue DHS HSI, USMS, and federal protective services contracts.' },
      'cyber_warfare':     { why: 'Civil unrest now runs on encrypted messaging, livestreamed protests, and coordinated information operations. Federal law enforcement and DHS expand domestic cyber and social-media forensics the moment unrest hits a critical threshold. This creates a narrow but well-funded lane for lawful-intercept, social-media forensics, and cross-platform attribution vendors \u2014 a space that is politically sensitive and where contractor selection is scrutinized.', move: 'Position in social-media forensics and attribution (Voyager Labs, ShadowDragon, Cobwebs Technologies, Recorded Future domestic), lawful-intercept integrators (Peraton, BAH), and encrypted-messaging analytics (Cellebrite, Magnet Forensics). Pursue DHS I&A, FBI OTD, and USSS contracts \u2014 expect active civil-liberties oversight.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn\u2019t exist
  // Plain-English: each entry should make sense to someone who is not a defense expert.
  var MECH_FALLBACK = {
    'kinetic_threat':     { why: 'A kinetic military threat is active. Defense ministries spend heavily on munitions, vehicles, fires, and the contractors who can deliver them quickly.', move: 'Position in defense primes (LMT, RTX, NOC, GD, BAE, Rheinmetall) and pursue munitions and vehicle replenishment contracts.' },
    'cyber_warfare':      { why: 'Defense cyber capability is being tested. Defense cyber vendors and CMMC compliance providers see immediate demand.', move: 'Position in defense cyber (CrowdStrike Federal, Mandiant, Palantir) and pursue Cyber Command and allied SOC contracts.' },
    'nuclear_escalation': { why: 'Nuclear modernization and deterrent posture are under stress. Strategic platform contractors and uranium / fuel cycle suppliers see budget priority.', move: 'Position in nuclear sustainment (BWXT, LMT, NOC) and uranium (CCJ).' },
    'intel_gap':          { why: 'Intelligence collection and analysis gaps are exposed. OSINT and multi-INT vendors see surge demand.', move: 'Position in OSINT (Recorded Future, Sayari) and multi-INT fusion (Palantir, Anduril).' },
    'logistics_supply':   { why: 'Defense logistics and sustainment are degrading. Defense logistics primes and additive manufacturing vendors see opportunity.', move: 'Position in defense logistics (KBR, Vectrus, Fluor) and pursue DLA contracts.' },
    'civil_unrest':       { why: 'Civil unrest is escalating to military involvement. Non-lethal capability and homeland security IT vendors see demand.', move: 'Position in non-lethal capability (Axon) and homeland security IT (Leidos, BAH).' },
    'arms_export':        { why: 'Arms exports and FMS pipelines are accelerating. Procurement intelligence and allied prime exposure become valuable.', move: 'Position in procurement intelligence (Govini) and allied primes (Hanwha, BAE, Rheinmetall).' },
    'space_dominance':    { why: 'Space and counter-space capability is contested. Commercial space ISR and space domain awareness vendors gain priority.', move: 'Position in commercial space ISR (Maxar, Planet, BlackSky) and pursue Space Force contracts.' },
    'drone_autonomous':   { why: 'Autonomous and unmanned systems are reshaping the battlespace. Counter-UAS and autonomous strike vendors see acute demand.', move: 'Position in autonomous strike (Anduril, Shield AI) and counter-UAS (Anduril Sentry, Epirus, Fortem).' },
    'alliance_pressure':  { why: 'Alliances are activating capability transfer and joint procurement. Coalition C2 and interoperability vendors see contract growth.', move: 'Position in coalition C2 platforms and pursue NATO STO, EDF, and AUKUS Pillar 2 contracts.' }
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
    return fetch('/assets/data/deep/defense-branch-index.json')
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
    var researchCount = opps.filter(function (o) { return o.path === 'RESEARCHABLE'; }).length;
    var investCount = opps.filter(function (o) { return o.path === 'INVESTABLE'; }).length;

    // Pull live defense feed signals — Western feeds and adversary perspective feeds
    var feeds = state.feeds || [];
    var conflictEvents = null, defenseSignals = null, isrAlerts = null, kineticReports = null, allianceActivity = null;
    var adversaryRussia = null, adversaryChina = null, adversaryIran = null, adversaryDPRK = null, regionalChina = null;
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      var f = feeds[fpi];
      if (!f.live) continue;
      var fn = (f.name || '').toLowerCase();
      if (fn.indexOf('acled') !== -1 || fn.indexOf('conflict') !== -1) conflictEvents = f.value;
      if (fn.indexOf('rss defense') !== -1 || fn.indexOf('defense signals') !== -1 || fn.indexOf('janes') !== -1) defenseSignals = f.value;
      if (fn.indexOf('iss') !== -1 || fn.indexOf('isw') !== -1 || fn.indexOf('rusi') !== -1) isrAlerts = f.value;
      if (fn.indexOf('breaking defense') !== -1 || fn.indexOf('defense news') !== -1) kineticReports = f.value;
      if (fn.indexOf('nato') !== -1 || fn.indexOf('sipri') !== -1) allianceActivity = f.value;
      // Adversary perspective feeds
      if (fn.indexOf('tass') !== -1) adversaryRussia = f.value;
      if (fn.indexOf('xinhua') !== -1 || fn.indexOf('global times') !== -1) adversaryChina = (adversaryChina || 0) + (f.value || 0);
      if (fn.indexOf('press tv') !== -1) adversaryIran = f.value;
      if (fn.indexOf('kcna') !== -1) adversaryDPRK = f.value;
      if (fn.indexOf('south china morning') !== -1) regionalChina = f.value;
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

    // ── Plain-English summary built from REAL defense feed data ──
    // Tone: assume the reader is a smart operator, NOT a defense expert.
    // Lead with the conflict number that tells the clearest story.
    var text = '';

    // Lead with the strongest conflict / defense signal we have
    if (conflictEvents !== null && conflictEvents >= 100) {
      text = '<b>Global armed conflict activity is at very high intensity \u2014 ' + conflictEvents + ' tracked events in the last cycle.</b> This is the kind of background noise that produces accelerated procurement, FMS approvals, and emergency stockpile replenishment. Allied defense ministries are already writing checks they wouldn\u2019t have written six months ago, and the primes that can deliver are seeing the largest demand surge in a generation. ';
    } else if (conflictEvents !== null && conflictEvents >= 30) {
      text = '<b>' + conflictEvents + ' armed conflict events tracked globally in the last cycle.</b> Elevated activity \u2014 enough to push allied defense procurement priorities and accelerate replenishment programs. Watch for FMS approvals and supplemental appropriations. ';
    } else if (conflictEvents !== null) {
      text = '<b>' + conflictEvents + ' armed conflict events globally.</b> Background level. The system is watching for escalation in any of the active theaters. ';
    }

    // Layer in defense signal feeds (Janes, Defense News, Breaking Defense)
    if (defenseSignals !== null && defenseSignals > 0) {
      text += '<b>' + defenseSignals + ' defense industry signals</b> moved through the trade press in the last cycle (contracts, programs, capabilities, geopolitical analysis). ';
    }

    // ISW / IISS / RUSI / strategic analysis
    if (isrAlerts !== null && isrAlerts > 0) {
      text += '<b>' + isrAlerts + ' strategic analysis updates</b> from think-tank-grade sources (ISW, IISS, RUSI). These typically anchor decision-makers\u2019 framing of the next 30-90 days. ';
    }

    // Breaking Defense / Defense News kinetic activity
    if (kineticReports !== null && kineticReports > 0) {
      text += '<b>' + kineticReports + ' breaking defense / kinetic activity reports</b> tracked. Elevated kinetic press coverage usually leads supplemental appropriations by 60-90 days. ';
    }

    // NATO / SIPRI alliance activity
    if (allianceActivity !== null && allianceActivity > 0) {
      text += '<b>' + allianceActivity + ' NATO / alliance activity items</b> tracked \u2014 a leading indicator for coalition C2, interoperability spending, and capability transfer programs. ';
    }

    // Adversary-perspective feeds (positional signal, not ground truth)
    var adversaryParts = [];
    if (adversaryRussia !== null && adversaryRussia > 0) adversaryParts.push('TASS Russia: ' + adversaryRussia);
    if (adversaryChina !== null && adversaryChina > 0) adversaryParts.push('Chinese state media: ' + adversaryChina);
    if (adversaryIran !== null && adversaryIran > 0) adversaryParts.push('Press TV Iran: ' + adversaryIran);
    if (adversaryDPRK !== null && adversaryDPRK > 0) adversaryParts.push('KCNA DPRK: ' + adversaryDPRK);
    if (adversaryParts.length > 0) {
      text += '<b style="color:#e85454">ADVERSARY PERSPECTIVE</b> (positional signal, not confirmation of fact): ' + adversaryParts.join(' \u00b7 ') + '. Watch for what the adversary is choosing to amplify and what is suddenly going quiet \u2014 changes in tone and framing usually lead Western reporting by 1-3 days. ';
    }
    if (regionalChina !== null && regionalChina > 0) {
      text += '<b>SCMP regional perspective</b>: ' + regionalChina + ' items \u2014 Hong Kong-based China-focused analysis. ';
    }

    // Tie back to active diagnoses
    if (activeDx.length > 0) {
      text += '<b>' + activeDx.length + ' active diagnosis ' + (activeDx.length > 1 ? 'pathways are' : 'pathway is') + ' currently confirmed by live evidence.</b> ';
    } else if (conflictEvents !== null || defenseSignals !== null) {
      text += 'No diagnosis pathways are currently active \u2014 the system is watching for kinetic escalation, cyber attacks, nuclear posture changes, intel failures, logistics shortfalls, and civil unrest. ';
    }

    // Fallback if no feeds at all
    if (!text) {
      text = '<b>Defense feeds loading.</b> Waiting for live conflict, defense industry, and strategic analysis data. ';
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
    if (researchCount > 0) parts.push(researchCount + ' research brief' + (researchCount > 1 ? 's' : ''));
    if (investCount > 0) parts.push(investCount + ' investment position' + (investCount > 1 ? 's' : ''));
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
      // Execution panel for RESEARCH plays
      if (o.path === 'RESEARCHABLE' && window.LIMENDefenseExecutionPanels) {
        h += window.LIMENDefenseExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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
      var claims = ledger.getClaimsByDomain('defense');
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
          path: claim.path || 'INVESTABLE',
          urgency: 'WATCH',
          rank: 0.1, // Low rank — it's no longer live-supported
          source: 'claimed_preserved',
          tier: 3,
          stress: 0,
          domain: 'defense',
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
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'defense') : null;
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

    var bridge = window.LIMENDefensePromotionBridge;
    console.log('[DefenseOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('defense') : null;
      var portalCache = brain ? brain._portalCache : null;
      var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
      console.log('[DefenseOperator] brain=' + !!brain + ' portalCache=' + !!portalCache + ' activeDx=' + activeDx.length + ' stress=' + state.stress);

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          console.log('[DefenseOperator] First bridge run — extracting...');
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            console.log('[DefenseOperator] Bridge returned ' + (promoted ? promoted.length : 0) + ' promoted directives');
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) {
                console.log('[DefenseOperator] Re-rendering with ' + promoted.length + ' directives');
                _renderOperatorDOM(freshState);
              }
            }
          }).catch(function (err) {
            console.error('[DefenseOperator] Bridge error:', err);
          });
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        console.log('[DefenseOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var retryBrain = brains ? brains.get('defense') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          console.log('[DefenseOperator] Retry: brain=' + !!retryBrain + ' cache=' + !!retryCache);
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            var retryDx = retryState ? (retryState.diagnoses || []).filter(function (d) { return d.active; }).length : 0;
            console.log('[DefenseOperator] Retry: state=' + !!retryState + ' activeDx=' + retryDx);
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                console.log('[DefenseOperator] Retry bridge returned ' + (promoted ? promoted.length : 0));
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function (err) {
                console.error('[DefenseOperator] Retry bridge error:', err);
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['defense'], type: 'invest' };

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
        if (!outcome) outcome = 'Linked defense companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=defense&returnTo=' + encodeURIComponent('/domain-console?domain=defense');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'defense', function (confirmedOpp, estimate) {
          // Create claim in ledger
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'defense', estimate);
          }
          // Re-render to show CLAIMED badge
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel (global)
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'defense');
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
    if (window.LIMENDefenseBusinessReview) {
      window.LIMENDefenseBusinessReview.mount(_operatorView);
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

    console.log('[DefenseOperator] Booted — operator view created, toggle wired');
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
