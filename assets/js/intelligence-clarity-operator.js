/**
 * intelligence-clarity-operator.js — Money-Driven Action Surface for Intelligence Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #eos-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console ↔ Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=intelligence is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on intelligence domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'intelligence') return;

  var VIEW_ID = 'eos-operator-view';
  var STATUS_KEY = 'limen_intelligence_operator_status';
  var COLLAPSE_KEY = 'limen_intelligence_collapse_state';
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
    var brain = brains.get('intelligence');
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
    'INTELLIGENCE_FAILURE': {
      what: 'A strategic surprise or analytic miss has exposed gaps in the intelligence collection-to-analysis pipeline. Either SIGINT/GEOINT/HUMINT collection failed to detect an adversary action, or all-source analysts failed to fuse available signals into a timely warning. This is the IC\u2019s nightmare scenario \u2014 the one that triggers congressional inquiries, ODNI reviews, and emergency procurement.',
      money: 'Multi-INT fusion platforms (Palantir Gotham/AIP, Recorded Future), commercial GEOINT providers (BlackSky, Planet Labs), AI-augmented analysis vendors (Two Six Technologies, Primer), and HUMINT support contractors (Booz Allen, CACI) see acute demand. IARPA accelerates research programs. In-Q-Tel portfolio companies get fast-tracked to production. NIP and MIP supplemental budgets flow within 60-90 days of a public failure.',
      step: 'Track ODNI public statements, SSCI/HPSCI hearing transcripts, IC ITE modernization RFIs, IARPA BAAs, and In-Q-Tel investment announcements. Position in all-source fusion, commercial ISR, and AI analyst augmentation. Focus on SITE III, Alliant 2, and ITES-3S contract vehicles for rapid task-order capture.',
      outcome: '$10M\u2013$2B+ in ISR modernization, analyst tool, and collection management contracts across NGA, DIA, NSA, and CIA'
    },
    'MASS_SURVEILLANCE_SCANDAL': {
      what: 'A bulk collection program, warrantless surveillance authority, or data-sharing arrangement has been publicly exposed, triggering congressional investigations, PCLOB reviews, and public backlash. The political fallout forces the IC to invest in compliance infrastructure, audit capability, and minimization technology while simultaneously defending collection authorities.',
      money: 'Oversight and compliance platform vendors (Palantir, Booz Allen, Leidos), privacy-enhancing technology firms (CyberArk, Varonis), and IC IT modernization contractors gain priority. Congressional mandates create new funded requirements for audit trails, data tagging, and minimization engines. FISA Court technical compliance orders generate sole-source contracts. The Privacy and Civil Liberties Oversight Board (PCLOB) recommendations become funded mandates.',
      step: 'Track FISA reauthorization debates, PCLOB reports, EO 12333 implementation guidance, USSID 18 compliance updates, and ODNI civil liberties officer statements. Position in data governance, audit trail technology, privacy-preserving analytics, and IC compliance consulting. Pursue ODNI and IC element compliance contract vehicles.',
      outcome: '$5M\u2013$500M in compliance infrastructure, audit platform, and privacy technology contracts across ODNI, NSA, and FBI'
    },
    'CYBER_ESPIONAGE': {
      what: 'A nation-state cyber espionage campaign has penetrated IC networks, defense industrial base systems, or allied intelligence infrastructure. The breach may have compromised sources and methods, exposed collection capabilities, or enabled adversary counter-intelligence operations. This is both a security crisis and a procurement accelerant.',
      money: 'Federal cybersecurity vendors (CrowdStrike Federal, Palo Alto Cortex XSIAM, SentinelOne), network forensics firms (Mandiant, Recorded Future), and zero-trust architecture providers (Zscaler, Okta Federal) see surge demand. NSA Cybersecurity Directorate issues emergency technical guidance. Cyber Command defensive operations tempo increases. IC ITE cloud security requirements tighten, flowing money to AWS C2S and Azure Government security layers.',
      step: 'Track NSA Cybersecurity Advisories, CISA KEV catalog updates, FBI IC3 flash alerts, and Mandiant APT reports. Position in endpoint detection, network monitoring, zero-trust implementation, and incident response. Pursue Cyber Command, NSA CSS, and DISA contract vehicles (ENCORE III, NetOps, SEWP V).',
      outcome: '$5M\u2013$1B+ in defensive cyber, zero-trust architecture, and incident response contracts across NSA, DISA, and IC elements'
    },
    'WHISTLEBLOWER_CRISIS': {
      what: 'An insider has disclosed classified programs, collection methods, or institutional misconduct to media or oversight bodies. The damage assessment is underway, and the IC must simultaneously contain the leak, assess the compromise, and rebuild the programs or authorities that were exposed. Politically, Congress demands accountability while the workforce demands protection for legitimate whistleblowing.',
      money: 'Insider threat detection vendors (DTEX Systems, Forcepoint, Securonix), personnel security modernization contractors (Peraton, CACI, Leidos), and damage assessment support firms see immediate demand. ODNI Insider Threat programs get emergency funding. Continuous vetting (CV) and Trusted Workforce 2.0 implementation accelerates. Counterintelligence contractors supporting damage assessments bill at crisis rates.',
      step: 'Track ODNI Inspector General reports, congressional oversight committee statements, Trusted Workforce 2.0 milestones, and DCSA continuous vetting program status. Position in insider threat analytics, personnel security modernization, continuous evaluation platforms, and counterintelligence support. Pursue DCSA, ODNI, and IC element insider threat contract vehicles.',
      outcome: '$10M\u2013$500M in insider threat, personnel security, and counterintelligence assessment contracts'
    },
    'FOREIGN_INTERFERENCE': {
      what: 'A foreign adversary is conducting influence operations, election interference, disinformation campaigns, or covert political manipulation targeting domestic institutions. The threat spans cyber operations, social media manipulation, covert funding, and human agents of influence. The IC must detect, attribute, and counter these operations while respecting First Amendment constraints.',
      money: 'OSINT and social media analysis vendors (Recorded Future, Babel Street, Dataminr, Fivecast), counter-influence platform providers (Palantir, Two Six Technologies), and attribution/forensics firms (Mandiant, CrowdStrike) see demand growth. CISA election security programs expand. FBI Foreign Influence Task Force procurement accelerates. GEC (Global Engagement Center) technology pilots scale to production.',
      step: 'Track FBI Foreign Influence Task Force reports, CISA election security bulletins, GEC counter-disinformation program announcements, and ODNI foreign threat assessments. Position in social media monitoring, attribution analytics, counter-influence platforms, and election security infrastructure. Pursue CISA, FBI, and GEC contract vehicles.',
      outcome: '$5M\u2013$500M in counter-influence, election security, and attribution technology contracts across FBI, CISA, and ODNI'
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

  // Diagnosis → playbook ID for Intelligence-domain invest opportunities
  var DX_TO_PLAYBOOK = {
    'INTELLIGENCE_FAILURE':         'intel_collection',
    'MASS_SURVEILLANCE_SCANDAL':    'intel_oversight',
    'CYBER_ESPIONAGE':              'intel_cyber',
    'WHISTLEBLOWER_CRISIS':         'intel_oversight',
    'FOREIGN_INTERFERENCE':         'intel_counter'
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'intel_collection',
    'company_stressed':  'intel_oversight',
    'convergence':       'intel_fusion',
    'cross_domain':      'intel_counter'
  };

  // Registered playbook definitions for sessionStorage handoff
  var PLAYBOOK_DEFS = {
    'intel_collection': { title: 'Intelligence Collection & ISR Modernization', domains: ['intelligence', 'defense'], type: 'invest' },
    'intel_cyber':      { title: 'Intelligence Cyber Operations & Defense', domains: ['intelligence', 'technology'], type: 'invest' },
    'intel_oversight':  { title: 'IC Oversight, Compliance & Personnel Security', domains: ['intelligence', 'governance'], type: 'invest' },
    'intel_counter':    { title: 'Counterintelligence & Counter-Influence', domains: ['intelligence', 'defense'], type: 'invest' },
    'intel_fusion':     { title: 'All-Source Data Fusion & Analytics', domains: ['intelligence', 'technology'], type: 'invest' }
  };

  // Suggested targets per playbook — companies validated via Helix command board
  // validation: HELIX_VALIDATED (in command-board-data, phase-scored), NODE_MAPPED (in intelligence.json portal),
  //             DOMAIN_MAPPED (in intelligence command board), ETF_PROXY (sector proxy, no company-level validation)
  // Intelligence domain: 5 playbooks, ~60 total rows, all real public tickers
  var INVEST_TARGETS = {
    'intel_collection': [
      { ticker: 'PLTR',  name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Gotham and AIP are the dominant analyst workbench across CIA, DIA, and NSA; Gaia powers GEOINT fusion at NGA; MetaConstellation enables satellite tasking from an analyst seat' },
      { ticker: 'LHX',   name: 'L3Harris Technologies',            cik: '202058',  validation: 'HELIX_VALIDATED', reason: 'Prime on C5ISR and SIGINT collection systems for NSA, NRO tactical ground stations, and Army TROJAN / Prophet SIGINT platforms under ITES-3S and Alliant 2' },
      { ticker: 'BAH',   name: 'Booz Allen Hamilton',              cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Largest IC professional services contractor; supports DIA analytic tradecraft, NSA mission operations, and CIA DS&T technical programs under multiple IDIQ vehicles' },
      { ticker: 'CACI',  name: 'CACI International',               cik: '17843',   validation: 'DOMAIN_MAPPED',   reason: 'Prime SIGINT and cyber contractor for NSA under ITES-3S; provides signals processing, collection management, and linguist services across theater SIGINT sites' },
      { ticker: 'LDOS',  name: 'Leidos Holdings',                  cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Prime on DIA SITE III ($11.5B ceiling); runs NGA enterprise IT under GEOINT Analytic Modernization; supports IC ITE transition for ODNI' },
      { ticker: 'SAIC',  name: 'Science Applications International',cik: '1571123', validation: 'DOMAIN_MAPPED',   reason: 'Supports NGA GEOINT production, IC ITE systems engineering, and DIA analysis support under Alliant 2 and SITE III task orders' },
      { ticker: 'NOC',   name: 'Northrop Grumman',                 cik: '1133421', validation: 'HELIX_VALIDATED', reason: 'Prime on multiple classified ISR platforms for NRO; builds Global Hawk / Triton high-altitude ISR; runs ground-based SIGINT processing systems for NSA' },
      { ticker: 'BKSY',  name: 'BlackSky Technology',              cik: '1753539', validation: 'DOMAIN_MAPPED',   reason: 'Commercial GEOINT provider with NRO and NGA contracts; delivers sub-hourly revisit tactical imagery; awarded Electro-Optical Commercial Layer (EOCL) contract' },
      { ticker: 'PL',    name: 'Planet Labs PBC',                  cik: '1836833', validation: 'DOMAIN_MAPPED',   reason: 'Largest commercial Earth observation constellation; daily global coverage feeds NGA, NRO, and allied GEOINT agencies under Electro-Optical Commercial Layer' },
      { ticker: 'RKLB',  name: 'Rocket Lab USA',                   cik: '1819994', validation: 'DOMAIN_MAPPED',   reason: 'Responsive launch provider for NRO; Electron enables rapid satellite deployment for classified LEO constellations; Neutron in development for larger IC payloads' },
      { ticker: 'IRDM',  name: 'Iridium Communications',           cik: '1418819', validation: 'DOMAIN_MAPPED',   reason: 'EMSS2 contract with DoD for global satellite communications; L-band constellation provides beyond-line-of-sight comms for HUMINT case officers and SIGINT relay' },
      { ticker: 'GSAT',  name: 'Globalstar Inc.',                   cik: '1176316', validation: 'DOMAIN_MAPPED',   reason: 'Satellite communications spectrum; Apple partnership drives Band 53/n53 LEO spectrum value; growing relevance for assured PNT and IoT collection infrastructure' }
    ],
    'intel_cyber': [
      { ticker: 'CRWD',  name: 'CrowdStrike Holdings',             cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Falcon platform is deployed across federal civilian and IC networks; CrowdStrike Federal holds FedRAMP High authorization; threat intelligence unit tracks nation-state APTs that feed IC reporting' },
      { ticker: 'PANW',  name: 'Palo Alto Networks',               cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Cortex XDR and XSIAM serve IC element SOCs; Next-Gen Firewall deployed across JWICS and SIPRNet enclaves; Unit 42 threat research directly relevant to IC cyber defense' },
      { ticker: 'FTNT',  name: 'Fortinet Inc.',                    cik: '1262039', validation: 'DOMAIN_MAPPED',   reason: 'FortiGate firewalls deployed across DoD and IC networks under DISA STIG compliance; FortiSIEM used for classified network monitoring at multiple IC sites' },
      { ticker: 'S',     name: 'SentinelOne Inc.',                  cik: '1744676', validation: 'DOMAIN_MAPPED',   reason: 'Singularity platform provides autonomous endpoint protection for IC workstations; FedRAMP High authorized; AI-driven threat detection aligns with NSA Cybersecurity Directorate guidance' },
      { ticker: 'ZS',    name: 'Zscaler Inc.',                     cik: '1713683', validation: 'DOMAIN_MAPPED',   reason: 'Zero Trust Exchange is the reference architecture for IC zero-trust network access; supports ODNI Zero Trust Strategy implementation across IC elements' },
      { ticker: 'NET',   name: 'Cloudflare Inc.',                  cik: '1477333', validation: 'DOMAIN_MAPPED',   reason: 'DDoS mitigation and secure web gateway for federal agencies; Project Galileo protects civil society organizations that IC OSINT collectors monitor; growing FedRAMP presence' },
      { ticker: 'OKTA',  name: 'Okta Inc.',                        cik: '1660134', validation: 'DOMAIN_MAPPED',   reason: 'Identity and access management for IC cloud environments; supports IC ITE identity federation across AWS C2S and Azure Government; FedRAMP High authorized' },
      { ticker: 'CYBR',  name: 'CyberArk Software',                cik: '1615165', validation: 'DOMAIN_MAPPED',   reason: 'Privileged access management deployed across IC classified networks; protects admin credentials on JWICS and NSANet; critical for insider threat mitigation' },
      { ticker: 'VRNS',  name: 'Varonis Systems',                  cik: '1361113', validation: 'DOMAIN_MAPPED',   reason: 'Data security and insider threat detection for unstructured data on IC file shares; identifies anomalous access patterns on classified repositories and SharePoint sites' },
      { ticker: 'TENB',  name: 'Tenable Holdings',                 cik: '1660280', validation: 'DOMAIN_MAPPED',   reason: 'Nessus and Tenable.io are the vulnerability assessment standard for IC STIG compliance; ACAS (Assured Compliance Assessment Solution) deployed across DoD and IC networks' },
      { ticker: 'RPD',   name: 'Rapid7 Inc.',                      cik: '1560327', validation: 'DOMAIN_MAPPED',   reason: 'InsightIDR and InsightVM provide detection and vulnerability management for IC contractor networks; supports CMMC compliance for defense industrial base intelligence suppliers' },
      { ticker: 'CIBR',  name: 'First Trust NASDAQ Cybersecurity ETF', cik: null,  validation: 'ETF_PROXY',       reason: 'Cybersecurity sector ETF capturing the full stack of IC-relevant cyber vendors; provides diversified exposure to zero-trust, endpoint, and SIEM companies serving federal/IC' }
    ],
    'intel_oversight': [
      { ticker: 'BAH',   name: 'Booz Allen Hamilton',              cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Largest IC oversight support contractor; provides ODNI compliance consulting, FISA minimization support, and PCLOB technical assistance under multiple ODNI IDIQ vehicles' },
      { ticker: 'LDOS',  name: 'Leidos Holdings',                  cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Runs personnel security and continuous vetting IT systems for DCSA; supports Trusted Workforce 2.0 implementation; prime on background investigation modernization' },
      { ticker: 'CACI',  name: 'CACI International',               cik: '17843',   validation: 'DOMAIN_MAPPED',   reason: 'Provides counterintelligence polygraph support, personnel security adjudication systems, and insider threat analytics for multiple IC elements under ITES-3S' },
      { ticker: 'SAIC',  name: 'Science Applications International',cik: '1571123', validation: 'DOMAIN_MAPPED',   reason: 'Supports DCSA continuous vetting enterprise IT, ODNI IC-wide audit systems, and compliance platform development for EO 12333 and USSID 18 requirements' },
      { ticker: 'PSN',   name: 'Parsons Corporation',              cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Federal solutions division supports IC compliance engineering, SCIF construction and accreditation, and technical surveillance countermeasures (TSCM) programs' },
      { ticker: 'GD',    name: 'General Dynamics IT (GDIT)',        cik: '40533',   validation: 'DOMAIN_MAPPED',   reason: 'Runs IC classified cloud infrastructure and network operations that underpin all oversight audit trails; prime on multiple IC IT operations contracts' },
      { ticker: 'ICF',   name: 'ICF International',                cik: '1130310', validation: 'DOMAIN_MAPPED',   reason: 'Federal consulting firm supporting ODNI policy development, IC workforce analytics, and congressional reporting requirements for intelligence oversight' },
      { ticker: 'MMS',   name: 'Maximus Inc.',                     cik: '1032220', validation: 'DOMAIN_MAPPED',   reason: 'Federal program management and compliance support; supports large-scale personnel security processing and federal civilian background check modernization' },
      { ticker: 'DXC',   name: 'DXC Technology',                   cik: '1688568', validation: 'DOMAIN_MAPPED',   reason: 'Enterprise IT services supporting IC legacy system modernization, audit trail infrastructure, and compliance reporting platforms across multiple IC elements' },
      { ticker: 'PLTR',  name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Foundry supports IC data governance and audit trail generation; provides the analytics layer that oversight bodies use to verify minimization and compliance across collection programs' },
      { ticker: 'HACK',  name: 'ETFMG Prime Cyber Security ETF',   cik: null,      validation: 'ETF_PROXY',       reason: 'Cybersecurity ETF with exposure to insider threat, identity management, and compliance technology vendors that serve IC oversight requirements' }
    ],
    'intel_counter': [
      { ticker: 'PLTR',  name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Gotham powers counterintelligence link analysis for FBI CI Division and military CI; AIP enables pattern detection across classified and open-source data for foreign influence tracking' },
      { ticker: 'BAH',   name: 'Booz Allen Hamilton',              cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Supports FBI Foreign Influence Task Force analytics, DIA counterintelligence operations, and NCSC (National Counterintelligence and Security Center) threat assessments' },
      { ticker: 'LDOS',  name: 'Leidos Holdings',                  cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Prime on counterintelligence IT support contracts for DCSA and DIA; supports foreign intelligence threat databases and CI investigative case management systems' },
      { ticker: 'CACI',  name: 'CACI International',               cik: '17843',   validation: 'DOMAIN_MAPPED',   reason: 'Provides HUMINT and CI operational support to Army G-2, DIA, and theater CI units; CI linguist and analyst services under INSCOM ITES-3S task orders' },
      { ticker: 'SAIC',  name: 'Science Applications International',cik: '1571123', validation: 'DOMAIN_MAPPED',   reason: 'Supports counter-influence analytics for GEC (Global Engagement Center), social media forensics for FBI, and foreign threat assessment for ODNI NCTC' },
      { ticker: 'LHX',   name: 'L3Harris Technologies',            cik: '202058',  validation: 'HELIX_VALIDATED', reason: 'SIGINT and electronic warfare systems that detect foreign intelligence collection against U.S. forces; TSCM equipment for counterintelligence sweep operations' },
      { ticker: 'GOOGL', name: 'Alphabet Inc. (Mandiant)',          cik: '1652044', validation: 'DOMAIN_MAPPED',   reason: 'Mandiant (acquired by Google) provides nation-state APT attribution that directly feeds IC counterintelligence assessments; Threat Intelligence unit tracks SVR, MSS, IRGC, and RGB cyber operations' },
      { ticker: 'CRWD',  name: 'CrowdStrike Holdings',             cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Falcon OverWatch threat hunting identifies foreign intelligence service intrusions; adversary intelligence reports on FANCY BEAR, COZY BEAR, and WICKED PANDA feed FBI CI investigations' },
      { ticker: 'PANW',  name: 'Palo Alto Networks',               cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Unit 42 threat research attributes nation-state campaigns that inform IC counterespionage priorities; Cortex XSOAR automates CI indicator sharing across IC elements' },
      { ticker: 'NOC',   name: 'Northrop Grumman',                 cik: '1133421', validation: 'HELIX_VALIDATED', reason: 'Builds classified counterintelligence collection systems and CI-relevant SIGINT platforms; supports NRO counterspace intelligence and DIA CI technical operations' },
      { ticker: 'RTX',   name: 'RTX Corporation',                  cik: '101829',  validation: 'DOMAIN_MAPPED',   reason: 'Raytheon Intelligence & Space provides counterintelligence SIGINT processing and TSCM equipment; supports NSA CSS technical surveillance detection programs' },
      { ticker: 'LMT',   name: 'Lockheed Martin',                  cik: '936468',  validation: 'HELIX_VALIDATED', reason: 'Classified programs division supports CIA and DIA counterintelligence technical operations; Space division builds NRO CI-relevant collection platforms' }
    ],
    'intel_fusion': [
      { ticker: 'PLTR',  name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Foundry and AIP are the IC reference platform for all-source data fusion; integrates SIGINT, GEOINT, HUMINT, and OSINT into unified analyst workspaces across JWICS and IC ITE cloud' },
      { ticker: 'SNOW',  name: 'Snowflake Inc.',                   cik: '1640147', validation: 'DOMAIN_MAPPED',   reason: 'Data Cloud for Government supports IC analytic data lakes on AWS C2S and Azure Government; enables cross-agency data sharing for all-source fusion under IC ITE architecture' },
      { ticker: 'DDOG',  name: 'Datadog Inc.',                     cik: '1561550', validation: 'DOMAIN_MAPPED',   reason: 'Observability platform for IC cloud infrastructure monitoring; FedRAMP authorized; ensures IC ITE data pipelines and fusion engines maintain operational health' },
      { ticker: 'ESTC',  name: 'Elastic N.V.',                     cik: '1707753', validation: 'DOMAIN_MAPPED',   reason: 'Elasticsearch powers full-text search and analytics across IC intelligence repositories; deployed on classified networks for rapid document discovery and cross-INT correlation' },
      { ticker: 'MDB',   name: 'MongoDB Inc.',                     cik: '1441816', validation: 'DOMAIN_MAPPED',   reason: 'Atlas for Government provides the document database layer for IC unstructured intelligence storage; supports NGA and DIA analytic applications requiring flexible schema for multi-INT data' },
      { ticker: 'DT',    name: 'Dynatrace Inc.',                   cik: '1773383', validation: 'DOMAIN_MAPPED',   reason: 'Application performance monitoring for IC cloud-native analytics platforms; AI-powered root cause analysis ensures fusion engine reliability on IC ITE infrastructure' },
      { ticker: 'AI',    name: 'C3.ai Inc.',                       cik: '1577526', validation: 'DOMAIN_MAPPED',   reason: 'Enterprise AI platform with federal contracts for predictive analytics; relevant to IC efforts to apply machine learning to intelligence fusion and pattern detection at scale' },
      { ticker: 'BBAI',  name: 'BigBear.ai Holdings',              cik: '1836981', validation: 'DOMAIN_MAPPED',   reason: 'AI/ML analytics provider with active IC and DoD contracts; provides predictive intelligence and decision support for DIA, Army G-2, and SOCOM intelligence fusion centers' },
      { ticker: 'CFLT',  name: 'Confluent Inc.',                   cik: '1816613', validation: 'DOMAIN_MAPPED',   reason: 'Apache Kafka-based event streaming platform for real-time intelligence data pipelines; enables IC fusion centers to process high-velocity SIGINT and sensor feeds in real time' },
      { ticker: 'PATH',  name: 'UiPath Inc.',                      cik: '1734722', validation: 'DOMAIN_MAPPED',   reason: 'Robotic process automation for IC analyst workflows; automates repetitive intelligence processing tasks (cable routing, report formatting, database queries) freeing analysts for higher-order fusion' },
      { ticker: 'GTLB',  name: 'GitLab Inc.',                      cik: '1653482', validation: 'DOMAIN_MAPPED',   reason: 'DevSecOps platform for IC software factories; supports the development and deployment of custom fusion tools and analytic applications across IC ITE environments' },
      { ticker: 'WCLD',  name: 'WisdomTree Cloud Computing ETF',   cik: null,      validation: 'ETF_PROXY',       reason: 'Cloud computing ETF capturing the infrastructure layer that IC ITE runs on; provides diversified exposure to the SaaS and PaaS vendors powering intelligence fusion at scale' }
    ]
  };

  function resolvePlaybookId(opp) {
    // 1. Try diagnosis-based mapping
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    // 2. Try source-based mapping
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    // 3. Lagging/system responses → collection
    if (opp.source === 'lagging') return 'intel_collection';
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Intelligence condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Intelligence portal node. Company-level Helix validation pending.</div>';
      // Action links
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=intelligence&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
  // Plain-English explanations: assume the reader is a smart operator, not a intelligence expert.
  var MECH_EXPLAIN = {
    'INTELLIGENCE_FAILURE': {
      'signal_blindness':       { why: 'Signal blindness occurs when the IC\'s collection apparatus is looking at the wrong place, the wrong time, or the wrong phenomenology. The October 7 Hamas attack demonstrated how an adversary with good OPSEC can defeat a technologically superior collection architecture by simply going dark on channels being monitored. The 2003 Iraq WMD failure showed how analytic assumptions can blind collectors to disconfirming evidence. Every major intelligence failure since Pearl Harbor has involved some form of signal blindness — not necessarily a lack of data, but a failure to collect the RIGHT data. IARPA estimates that improving collection targeting could reduce analytic error rates by 30-40%.', move: 'Position in commercial GEOINT (BlackSky EOCL contract, Planet Labs NRO agreement), SIGINT collection modernization (L3Harris SIGINT platforms, CACI theater SIGINT under ITES-3S), and AI-powered collection management tools (Palantir MetaConstellation, Recorded Future Intelligence Graph). Pursue NRO, NGA, and NSA collection modernization contracts. Range: $10M-$500M per task order.' },
      'collection_gap':         { why: 'Collection gaps emerge when the IC\'s sensor architecture cannot cover the threat space — too few satellites over a denied area, too few case officers in a hard target, too little SIGINT coverage of an adversary\'s new communications system. The NRO\'s shift to proliferated LEO constellations and NGA\'s Electro-Optical Commercial Layer (EOCL) program are direct responses to decades of collection gaps. The IC spent $23.1B on the NIP in FY2023, and a significant portion goes to closing collection gaps identified in post-mortem reviews.', move: 'Position in responsive space (Rocket Lab NRO launches, BlackSky real-time tasking), HUMINT augmentation (Booz Allen CIA support, CACI DIA HUMINT under SITE III), and multi-INT fusion that exposes gaps (Palantir AIP gap analysis, Leidos NGA GEOINT Analytic Modernization). Pursue IARPA research programs and In-Q-Tel-backed collection technologies. Range: $5M-$1B+.' },
      'analytic_distortion':    { why: 'Analytic distortion happens when cognitive biases, groupthink, or political pressure cause analysts to misread available intelligence. The Iraq WMD estimate is the canonical case — analysts anchored on prior assessments, dismissed HUMINT source problems, and faced institutional pressure toward a conclusion. ODNI\'s establishment of the Analytic Integrity and Standards office and mandated use of structured analytic techniques (ACH, red teaming, devil\'s advocacy) are direct responses. IARPA\'s forecasting tournaments (ACE, FOCUS) proved that structured methods outperform traditional analysis by 30%+.', move: 'Position in structured analytic technique tools (Palantir AIP analyst notebooks, Two Six Technologies analytic tools), red team / alternative analysis services (Booz Allen, RAND, CSIS), and AI-augmented analysis that reduces bias (Recorded Future automated hypothesis testing, BigBear.ai predictive intelligence). Pursue DIA DI and CIA DA analytic modernization contracts under Alliant 2 and SITE III.' },
      'coordination_failure':   { why: 'Coordination failure occurs when IC elements fail to share intelligence across organizational boundaries — the pre-9/11 wall between FBI and CIA, the ongoing friction between Title 10 (military) and Title 50 (intelligence) operations, or simple bureaucratic stovepiping. The ODNI was created specifically to fix this, and IC ITE (Intelligence Community Information Technology Enterprise) is the $10B+ infrastructure program designed to enable cross-agency data sharing. Yet coordination failures persist because organizational culture resists technical solutions.', move: 'Position in IC ITE implementation (Leidos, SAIC, GDIT enterprise IT), cross-agency data sharing platforms (Palantir Foundry, Snowflake for Government, Elastic), and collaboration tools for classified environments (Microsoft 365 for Government, Wickr Gov). Pursue ODNI CIO and IC ITE program office contracts. Range: $50M-$2B+.' }
    },
    'MASS_SURVEILLANCE_SCANDAL': {
      'oversight_failure':      { why: 'Oversight failure in the IC context means the checks and balances designed to constrain collection authorities — FISA Court, PCLOB, congressional intelligence committees, agency inspectors general — failed to catch or correct a problematic program. The Snowden disclosures revealed that NSA\'s Section 215 bulk telephony metadata program operated for years with minimal effective judicial oversight and that the FISA Court had approved collection far broader than most members of Congress understood. The 2023 FISA Section 702 reauthorization debate showed these tensions remain unresolved. When oversight fails, the political backlash creates $100M+ compliance mandates.', move: 'Position in compliance technology (Palantir audit trail, Varonis data governance, CyberArk privileged access), IC oversight consulting (Booz Allen ODNI compliance, ICF policy consulting), and privacy-enhancing technology. Pursue ODNI civil liberties office, NSA compliance directorate, and PCLOB technical assistance contracts.' },
      'trust_boundary_breach':  { why: 'A trust boundary breach occurs when data collected under one authority (e.g., foreign intelligence) is used for an unauthorized purpose (e.g., domestic law enforcement), or when collection against a foreign target inadvertently sweeps up U.S. person communications. The NSA\'s inadvertent collection of U.S. person data under Section 702 — and the FBI\'s querying of that data for domestic criminal investigations — has been the single most politically explosive IC issue for a decade. Each breach generates congressional demands for technical controls that cost $50M-$200M to implement.', move: 'Position in data tagging and minimization technology, identity resolution systems that flag U.S. persons, and audit trail platforms. Target NSA compliance directorate contracts, FBI data governance modernization, and ODNI minimization procedure implementation.' },
      'bulk_collection_excess': { why: 'Bulk collection excess refers to collection programs that gather far more data than needed for legitimate intelligence purposes. Section 215 bulk telephony metadata, PRISM, and Upstream collection all generated political backlash not because they were illegal per se, but because their scope shocked the public and Congress. The USA FREEDOM Act of 2015 ended bulk telephony metadata collection, but bulk collection under other authorities continues to generate oversight scrutiny. Each reauthorization cycle creates procurement demand for targeted collection alternatives.', move: 'Position in targeted collection technology (precision SIGINT, selector-based collection), privacy-preserving analytics (homomorphic encryption, differential privacy), and commercial data alternatives to bulk collection (Babel Street, Dataminr, Fivecast). Pursue NSA targeted collection modernization and IARPA privacy technology research programs.' },
      'privacy_violation':      { why: 'Privacy violations in the IC context range from inadvertent U.S. person collection to deliberate misuse of surveillance authorities. The LOVEINT incidents (NSA employees using surveillance tools to spy on romantic partners), FBI\'s improper Section 702 queries, and repeated FISA Court findings of noncompliance all erode public trust and generate funded compliance mandates. The Privacy and Civil Liberties Oversight Board (PCLOB) recommendations become binding procurement requirements.', move: 'Position in automated compliance monitoring (Varonis, Securonix, Palantir audit), user behavior analytics for insider misuse (DTEX Systems, Forcepoint, CyberArk), and privacy impact assessment consulting (ICF, Booz Allen, Deloitte Federal). Pursue NSA and FBI compliance technology modernization contracts.' }
    },
    'CYBER_ESPIONAGE': {
      'adversarial_penetration':{ why: 'Nation-state cyber espionage against the IC represents the most sophisticated threat in cyberspace. The SolarWinds/SUNBURST campaign (attributed to SVR) penetrated multiple IC-adjacent networks. The OPM breach (attributed to MSS) compromised 22 million SF-86 security clearance files — giving China a counterintelligence goldmine worth decades of HUMINT operations. These are not ordinary data breaches; they are strategic intelligence operations that can compromise sources and methods, enable counter-intelligence targeting of U.S. agents, and degrade the entire IC apparatus. The cost of remediation from a single major penetration can exceed $1B.', move: 'Position in federal endpoint detection (CrowdStrike Federal, SentinelOne Federal), network forensics (Mandiant/Google, Palo Alto Unit 42), and classified network monitoring (Fortinet, Tenable ACAS). Pursue NSA Cybersecurity Directorate, Cyber Command CNMF, and IC CISO contracts under ENCORE III and SEWP V. Range: $10M-$500M per incident response and hardening contract.' },
      'network_intrusion':      { why: 'Network intrusions into IC systems go beyond typical enterprise breaches because the adversary\'s goal is not financial — it\'s to map the IC\'s collection capabilities, identify intelligence officers, and understand what the U.S. knows. The Chinese penetration of Juniper Networks routers, the Russian compromise of SolarWinds, and the Iranian intrusion into Navy Marine Corps Intranet all demonstrated that nation-states will invest years of effort to gain persistent access to IC networks. Zero-trust architecture is the IC\'s primary response, and it\'s a multi-billion-dollar modernization effort.', move: 'Position in zero-trust architecture (Zscaler Government, Okta Federal, CyberArk), network segmentation and microsegmentation (Palo Alto, Fortinet), and continuous monitoring (Tenable, Rapid7). Pursue DISA zero-trust implementation, IC ITE network modernization, and individual IC element CISO contracts.' },
      'deception_exposure':     { why: 'Deception exposure occurs when a cyber espionage campaign reveals that an adversary has been feeding disinformation through compromised channels, or when the IC discovers that a trusted intelligence source has been doubled. The Aldrich Ames and Robert Hanssen cases showed how a single penetration agent can compromise entire intelligence networks. In the cyber domain, adversaries can implant false data in collection systems, manipulate analyst tools, or corrupt databases — making every piece of intelligence from a compromised system suspect.', move: 'Position in data integrity verification tools, blockchain-based provenance tracking for intelligence products, and counter-deception analytics (Palantir anomaly detection, Recorded Future source validation). Pursue CIA Counterintelligence Center and DIA CI technical operations contracts.' },
      'compromised_channel':    { why: 'A compromised communications channel is an existential threat to intelligence operations. When China reportedly compromised CIA\'s covert communications system circa 2010-2012, it led to the execution or imprisonment of dozens of CIA assets in China — the worst intelligence disaster since the Aldrich Ames compromise. Compromised SIGINT channels mean the adversary knows what you\'re collecting and can feed disinformation. The cost in human lives and lost intelligence is incalculable, but the remediation and modernization contracts that follow are substantial.', move: 'Position in secure communications technology (L3Harris tactical COMSEC, General Dynamics TACLANE, Wickr Gov), covert communications modernization for CIA (classified programs), and SIGINT channel integrity monitoring (NSA CSS platforms). Pursue CIA OTS, NSA IAD, and DISA COMSEC contracts.' }
    },
    'WHISTLEBLOWER_CRISIS': {
      'leaked_signals':         { why: 'When classified intelligence leaks — whether through a Snowden, Reality Winner, Jack Teixeira, or unnamed source — the damage goes far beyond the specific documents disclosed. Adversaries can reverse-engineer collection methods from the intelligence products themselves. The Teixeira Discord leaks revealed real-time SIGINT take on allied and adversary communications, forcing collection system modifications costing hundreds of millions. The IC\'s response is always the same: tighten access controls, expand monitoring, accelerate insider threat detection. Each major leak generates $100M-$500M in security modernization contracts.', move: 'Position in insider threat detection (DTEX Systems, Forcepoint, Securonix), data loss prevention for classified networks (Digital Guardian, Symantec Government), and user activity monitoring (CyberArk, Varonis). Pursue ODNI National Insider Threat Task Force contracts, IC element insider threat program support, and DCSA continuous vetting modernization.' },
      'institutional_exposure': { why: 'Institutional exposure from a whistleblower crisis extends beyond the leaked material to the political and organizational damage. Congressional investigations, IG reports, PCLOB reviews, and media coverage all force the IC to divert resources from mission to damage control. The Snowden aftermath consumed years of senior IC leadership attention and forced fundamental restructuring of NSA\'s approach to oversight and transparency. The organizational cost exceeds the technical remediation cost by an order of magnitude.', move: 'Position in strategic communications and crisis management consulting for IC elements, congressional liaison support, and organizational restructuring advisory (Booz Allen, McKinsey Government, BCG Federal). Pursue ODNI public affairs support and IC element strategic communications contracts.' },
      'narrative_capture':      { why: 'Narrative capture occurs when a whistleblower\'s framing of events dominates public discourse, making it politically impossible for the IC to defend legitimate programs. Snowden\'s framing of NSA surveillance as mass domestic spying — regardless of the legal authorities and minimization procedures in place — captured the narrative so completely that even allies like Germany and Brazil expelled CIA station chiefs. Once narrative capture occurs, the IC must invest in transparency, declassification review, and public communication infrastructure.', move: 'Position in declassification review technology (AI-assisted document review, redaction tools), IC public affairs modernization, and transparency platform development. Pursue ODNI declassification review support, IC element public affairs consulting, and congressional engagement support contracts.' },
      'oversight_failure':      { why: 'Whistleblower crises often reveal oversight failures — the systems that should have caught the problem before someone felt compelled to leak. The Snowden disclosures exposed that congressional oversight of NSA programs was superficial, that the FISA Court operated with minimal adversarial process, and that internal compliance mechanisms were inadequate. Post-crisis, Congress mandates new oversight infrastructure that generates sustained procurement demand.', move: 'Position in oversight technology platforms (audit trail systems, compliance dashboards, congressional reporting tools), IG investigation support (forensic accounting, document review, witness interview support), and compliance consulting. Pursue IC IG offices, PCLOB, and congressional intelligence committee support contracts.' }
    },
    'FOREIGN_INTERFERENCE': {
      'narrative_manipulation':  { why: 'Foreign narrative manipulation — Russia\'s Internet Research Agency operations against the 2016 and 2020 U.S. elections, China\'s wolf warrior diplomacy and TikTok influence, Iran\'s social media sock puppets — represents a new intelligence challenge that sits at the intersection of collection, analysis, and action. The IC must detect and attribute these operations without infringing on First Amendment-protected speech. The GEC (Global Engagement Center) was created specifically for counter-narrative operations, and FBI\'s Foreign Influence Task Force handles domestic-facing threats. Combined annual spending on counter-influence exceeds $300M and is growing.', move: 'Position in social media monitoring and attribution (Recorded Future, Babel Street, Dataminr, Fivecast), counter-narrative technology (Two Six Technologies, Palantir), and election security infrastructure (CrowdStrike, EAC-certified voting system vendors). Pursue GEC technology pilot contracts, FBI FITF analytics support, and CISA election security infrastructure work.' },
      'information_contamination': { why: 'Information contamination goes beyond simple disinformation to include covert influence through think tanks, academic institutions, media organizations, and political campaigns. The FBI has identified Chinese Confucius Institutes, Russian-funded media (RT, Sputnik), and Iranian-backed social media operations as vectors for contaminating the U.S. information environment. The challenge for the IC is distinguishing protected speech from covert foreign government operations — a distinction that requires sophisticated attribution capability and close coordination between FBI, ODNI, and DOJ.', move: 'Position in attribution analytics (Mandiant/Google threat intelligence, CrowdStrike adversary tracking, Recorded Future), open-source intelligence platforms (Babel Street, Sayari, Fivecast), and foreign agent registration compliance technology. Pursue FBI Counterintelligence Division, ODNI FMIC (Foreign Malign Influence Center), and DOJ FARA enforcement support contracts.' },
      'adversarial_penetration': { why: 'Foreign interference campaigns often include cyber penetration of political organizations, government systems, and election infrastructure as a complement to information operations. The 2016 DNC hack (GRU Units 26165 and 74455) and the 2020 SolarWinds campaign demonstrated that cyber penetration and influence operations are now routinely combined. The IC must track both the cyber intrusion and the subsequent weaponization of stolen material — requiring close coordination between NSA, CIA, FBI, and Cyber Command.', move: 'Position in election infrastructure security (CrowdStrike, Palo Alto, Fortinet), political organization cyber defense, and combined cyber-influence tracking platforms (Palantir, Recorded Future). Pursue CISA election security, FBI Cyber Division, and Cyber Command hunt-forward contracts.' },
      'coordination_failure':    { why: 'Counter-interference operations require unprecedented coordination across IC elements, law enforcement, DHS, and the private sector. The failure to coordinate the IC\'s response to Russian election interference in 2016 — where NSA, CIA, and FBI each held pieces of the puzzle but didn\'t synthesize them quickly enough — led to the creation of the Election Threats Executive and expanded interagency coordination mechanisms. Each new foreign interference campaign exposes coordination gaps and generates procurement for shared platforms and liaison infrastructure.', move: 'Position in interagency coordination platforms (Palantir, GDIT collaboration tools), joint operations center technology, and information-sharing frameworks. Pursue ODNI FMIC technology support, FBI-DHS-CISA joint operations contracts, and interagency liaison support work.' }
    }
  };

  // Fallback explanations when diagnosis-specific entry doesn\u2019t exist
  // Plain-English: each entry should make sense to someone who is not a intelligence expert.
  var MECH_FALLBACK = {
    'signal_blindness':        { why: 'The IC\'s collection sensors are not pointed at the right targets. Intelligence gaps are forming because the collection architecture was designed for a different threat.', move: 'Position in commercial GEOINT (BlackSky, Planet Labs), SIGINT modernization (L3Harris, CACI), and AI-powered collection management (Palantir MetaConstellation).' },
    'collection_gap':          { why: 'Critical intelligence requirements cannot be satisfied with current collection assets. The gap between what policymakers need and what the IC can deliver is widening.', move: 'Position in responsive space (Rocket Lab, BlackSky), HUMINT augmentation (Booz Allen, CACI), and multi-INT fusion (Palantir, Leidos SITE III).' },
    'analytic_distortion':     { why: 'Cognitive bias, groupthink, or political pressure is degrading analytic quality. Intelligence assessments may not reflect ground truth.', move: 'Position in structured analytic tools (Palantir AIP, Two Six), red team services (RAND, Booz Allen), and AI-augmented analysis (Recorded Future, BigBear.ai).' },
    'coordination_failure':    { why: 'IC elements are not sharing intelligence effectively across organizational boundaries. Stovepiping and bureaucratic friction are degrading all-source fusion.', move: 'Position in IC ITE implementation (Leidos, SAIC, GDIT), cross-agency sharing platforms (Palantir, Snowflake Government), and collaboration tools for classified environments.' },
    'oversight_failure':       { why: 'IC oversight mechanisms have failed to catch or correct a problematic collection or analysis practice. Congressional and public backlash is generating compliance mandates.', move: 'Position in compliance technology (Palantir audit, Varonis, CyberArk), IC oversight consulting (Booz Allen, ICF), and privacy-enhancing technology.' },
    'trust_boundary_breach':   { why: 'Data collected under one authority has been used for an unauthorized purpose, or collection has inadvertently captured protected communications.', move: 'Position in data tagging, minimization technology, and audit trail platforms. Target NSA compliance and FBI data governance contracts.' },
    'adversarial_penetration': { why: 'A nation-state actor has penetrated IC or IC-adjacent networks. The adversary may have access to sources, methods, or collection capabilities.', move: 'Position in federal endpoint detection (CrowdStrike, SentinelOne), network forensics (Mandiant, Palo Alto), and zero-trust architecture (Zscaler, Okta Federal).' },
    'network_intrusion':       { why: 'IC network security has been compromised. Persistent access by a nation-state adversary threatens intelligence sources and methods.', move: 'Position in zero-trust architecture, network segmentation, and continuous monitoring. Pursue DISA and IC element CISO contracts.' },
    'deception_exposure':      { why: 'An adversary has been feeding disinformation through compromised channels or doubled sources. Intelligence product integrity is in question.', move: 'Position in data integrity verification, counter-deception analytics (Palantir, Recorded Future), and source validation tools.' },
    'narrative_manipulation':   { why: 'A foreign adversary is conducting information operations to manipulate public discourse, policy decisions, or election outcomes.', move: 'Position in social media monitoring (Recorded Future, Babel Street, Dataminr), counter-narrative technology (Two Six, Palantir), and election security infrastructure (CrowdStrike, CISA).' },
    'information_contamination':{ why: 'Foreign influence operations are contaminating the domestic information environment through covert channels, front organizations, and social media manipulation.', move: 'Position in attribution analytics (Mandiant, CrowdStrike), OSINT platforms (Babel Street, Sayari), and foreign agent compliance technology.' },
    'leaked_signals':          { why: 'Classified intelligence has been disclosed to unauthorized parties. Damage assessment is underway and security modernization is being funded.', move: 'Position in insider threat detection (DTEX, Forcepoint, Securonix), data loss prevention, and continuous vetting (DCSA modernization contracts).' }
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
    return fetch('/assets/data/deep/intelligence-branch-index.json')
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

    // Pull live intelligence feed signals — Western feeds and adversary perspective feeds
    var feeds = state.feeds || [];
    var conflictEvents = null, defenseSignals = null, isrAlerts = null, kineticReports = null, allianceActivity = null;
    var adversaryRussia = null, adversaryChina = null, adversaryIran = null, adversaryDPRK = null, regionalChina = null;
    for (var fpi = 0; fpi < feeds.length; fpi++) {
      var f = feeds[fpi];
      if (!f.live) continue;
      var fn = (f.name || '').toLowerCase();
      if (fn.indexOf('acled') !== -1 || fn.indexOf('conflict') !== -1) conflictEvents = f.value;
      if (fn.indexOf('rss intelligence') !== -1 || fn.indexOf('intelligence signals') !== -1 || fn.indexOf('janes') !== -1) defenseSignals = f.value;
      if (fn.indexOf('iss') !== -1 || fn.indexOf('isw') !== -1 || fn.indexOf('rusi') !== -1) isrAlerts = f.value;
      if (fn.indexOf('breaking intelligence') !== -1 || fn.indexOf('intelligence news') !== -1) kineticReports = f.value;
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

    // ── Plain-English summary built from REAL intelligence feed data ──
    // Tone: assume the reader is a smart operator, NOT a intelligence expert.
    // Lead with the conflict number that tells the clearest story.
    var text = '';

    // Lead with the strongest conflict / intelligence signal we have
    if (conflictEvents !== null && conflictEvents >= 100) {
      text = '<b>Global armed conflict activity is at very high intensity \u2014 ' + conflictEvents + ' tracked events in the last cycle.</b> This is the kind of background noise that produces accelerated procurement, FMS approvals, and emergency stockpile replenishment. Allied intelligence ministries are already writing checks they wouldn\u2019t have written six months ago, and the primes that can deliver are seeing the largest demand surge in a generation. ';
    } else if (conflictEvents !== null && conflictEvents >= 30) {
      text = '<b>' + conflictEvents + ' armed conflict events tracked globally in the last cycle.</b> Elevated activity \u2014 enough to push allied intelligence procurement priorities and accelerate replenishment programs. Watch for FMS approvals and supplemental appropriations. ';
    } else if (conflictEvents !== null) {
      text = '<b>' + conflictEvents + ' armed conflict events globally.</b> Background level. The system is watching for escalation in any of the active theaters. ';
    }

    // Layer in intelligence signal feeds (Janes, Intelligence News, Breaking Intelligence)
    if (defenseSignals !== null && defenseSignals > 0) {
      text += '<b>' + defenseSignals + ' intelligence industry signals</b> moved through the trade press in the last cycle (contracts, programs, capabilities, geopolitical analysis). ';
    }

    // ISW / IISS / RUSI / strategic analysis
    if (isrAlerts !== null && isrAlerts > 0) {
      text += '<b>' + isrAlerts + ' strategic analysis updates</b> from think-tank-grade sources (ISW, IISS, RUSI). These typically anchor decision-makers\u2019 framing of the next 30-90 days. ';
    }

    // Breaking Intelligence / Intelligence News kinetic activity
    if (kineticReports !== null && kineticReports > 0) {
      text += '<b>' + kineticReports + ' breaking intelligence / kinetic activity reports</b> tracked. Elevated kinetic press coverage usually leads supplemental appropriations by 60-90 days. ';
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
      text += 'No diagnosis pathways are currently active \u2014 the system is watching for intelligence failures, surveillance scandals, cyber espionage, whistleblower crises, and foreign interference operations. ';
    }

    // Fallback if no feeds at all
    if (!text) {
      text = '<b>Intelligence feeds loading.</b> Waiting for live conflict, intelligence industry, and strategic analysis data. ';
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
      if ((o.path === 'GRANT-ELIGIBLE' || o.path === 'PATENTABLE') && window.LIMENIntelligenceExecutionPanels) {
        h += window.LIMENIntelligenceExecutionPanels.renderForOpportunity(oppKey(o), o.path, o);
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
      var claims = ledger.getClaimsByDomain('intelligence');
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
          domain: 'intelligence',
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
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'intelligence') : null;
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

    var bridge = window.LIMENIntelligencePromotionBridge;
    console.log('[DefenseOperator] renderOperator: bridge=' + !!bridge + ' flag=' + !!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('intelligence') : null;
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
          var retryBrain = brains ? brains.get('intelligence') : null;
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['intelligence'], type: 'invest' };

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
        if (!outcome) outcome = 'Linked intelligence companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=intelligence&returnTo=' + encodeURIComponent('/domain-console?domain=intelligence');
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
            source: 'intelligence',
            returnTo: '/domain-console?domain=intelligence&mode=operator'
          }));
        } catch (ex) {}
        var trackName = trackMap[execPath] || 'grant';
        window.location.href = 'intelligence-workspace.html?track=' + trackName + '&opp=' + encodeURIComponent(execKey) + '&returnTo=' + encodeURIComponent('/domain-console?domain=intelligence&mode=operator');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'intelligence', function (confirmedOpp, estimate) {
          // Create claim in ledger
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'intelligence', estimate);
          }
          // Re-render to show CLAIMED badge
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel (global)
    if (window.LIMENOperatorPanel) {
      window.LIMENOperatorPanel.mount(_operatorView, 'intelligence');
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
    if (window.LIMENIntelligenceBusinessReview) {
      window.LIMENIntelligenceBusinessReview.mount(_operatorView);
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
