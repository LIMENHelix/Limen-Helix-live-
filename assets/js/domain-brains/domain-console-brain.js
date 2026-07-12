/**
 * domain-console-brain.js — Domain Console Brain Renderer
 *
 * When domain-isolator is active (?domain=X), takes over #clarity-view
 * and renders a live brain interface: signals → nodes → diagnoses → treatments → actions.
 *
 * Works for any domain. Pulls state from the domain brain instance.
 */
(function () {
  'use strict';

  // Only run if domain-scoped
  if (!window.LIMENDomainIsolator || !window.LIMENDomainIsolator.isDomainScoped()) return;

  // Console-clarity is blocked in domain-console.html via inline script BEFORE it loads.
  // By the time this file runs, clarity's start/refresh are already no-ops.

  var DOMAIN = window.LIMENDomainIsolator.getActiveDomain();
  var DOMAIN_KEY = window.LIMENDomainIsolator.getResolvedKey();
  var DOMAIN_LABEL = window.LIMENDomainIsolator.getDomainLabel();

  var _clarityView = null;
  var _brain = null;
  var _changelog = [];
  var _companies = [];
  var _crossDomain = [];
  var _portalData = null;
  var _booted = false;

  // ══════════════════════════════════════════════════════════════════════
  // STYLE INJECTION — uses civilization styling language
  // ══════════════════════════════════════════════════════════════════════

  var style = document.createElement('style');
  style.textContent = [
    /* Clarity-view — page CSS handles overflow, brain just needs isolation */
    '#clarity-view{position:relative}',
    /* Hide underlying columns when brain is active — prevents bleed-through */
    '.dcb-active #col-left,.dcb-active #col-center,.dcb-active #col-right{display:none!important}',
    /* Root grid */
    '#dcb-root{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:8px;padding:8px 12px}',
    '@media(max-width:900px){#dcb-root{grid-template-columns:1fr 1fr;gap:6px}}',
    '@media(max-width:600px){#dcb-root{grid-template-columns:1fr}}',
    '#dcb-exec{grid-column:1/-1;display:flex;align-items:center;gap:16px;padding:8px 12px;border-bottom:1px solid rgba(201,169,78,0.08);flex-wrap:wrap;margin-bottom:4px;transition:border-color 0.5s;position:sticky;top:0;z-index:10;background:rgba(5,8,16,0.96);transform:translateZ(0)}',
    '#dcb-exec.live{border-bottom-color:rgba(90,181,160,0.25);background:rgba(5,8,16,0.96)}',
    /* Live activation — panels glow when signals are active */
    '.dcb-panel.dcb-live{border-color:rgba(201,169,78,0.18);box-shadow:0 0 12px rgba(201,169,78,0.05),inset 0 0 8px rgba(201,169,78,0.02)}',
    '.dcb-panel.dcb-firing{border-color:rgba(232,84,84,0.22);box-shadow:0 0 16px rgba(232,84,84,0.06),inset 0 0 8px rgba(232,84,84,0.02)}',
    '#dcb-timestamp{grid-column:1/-1;text-align:center;font-size:0.24rem;letter-spacing:2px;color:#605850;padding:4px 0;font-family:monospace}',
    '#dcb-timestamp .live-dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:4px;vertical-align:middle;animation:livePulse 2s infinite}',
    '@keyframes livePulse{0%,100%{background:rgba(90,181,160,0.3)}50%{background:rgba(90,181,160,0.8)}}',
    /* Columns — scroll independently */
    '.dcb-col{display:flex;flex-direction:column;gap:6px;min-width:0;overflow:visible}',
    /* Panels — fully self-contained collapsible boxes */
    '.dcb-panel{background:rgba(0,0,0,0.15);border:1px solid rgba(201,169,78,0.06);border-radius:3px;overflow:hidden;position:relative;margin-bottom:2px}',
    '.dcb-panel-title{font-size:0.34rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:color 0.2s,text-shadow 0.2s;user-select:none;-webkit-user-select:none;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
    '.dcb-panel-title:hover{color:rgba(201,169,78,1);text-shadow:0 0 8px rgba(201,169,78,0.4)}',
    '.dcb-panel-title::after{content:"\\25BC";font-size:0.24rem;color:rgba(201,169,78,0.3);transition:transform 0.2s}',
    '.dcb-panel.collapsed .dcb-panel-title::after{transform:rotate(-90deg)}',
    '.dcb-panel-body{padding:0 10px 8px;max-height:320px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(201,169,78,0.08) transparent;transition:max-height 0.25s ease,padding 0.25s ease,opacity 0.2s ease}',
    '.dcb-panel-body::-webkit-scrollbar{width:2px}',
    '.dcb-panel-body::-webkit-scrollbar-thumb{background:rgba(201,169,78,0.08);border-radius:2px}',
    '.dcb-panel.collapsed .dcb-panel-body{max-height:0;padding-top:0;padding-bottom:0;opacity:0;overflow:hidden}',
    /* 3-tier contrast system: PRIMARY #e0daca (0.88) / SECONDARY #b0a898 (0.62) / MUTED #807868 (0.40) */
    '.dcb-stress-big{font-size:1.2rem;font-weight:500;letter-spacing:1px}',
    '.dcb-meta{font-size:0.32rem;color:#9a9080;letter-spacing:1px}',
    '.dcb-meta b{color:#d0c8b8}',
    '.dcb-signal{padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.36rem;color:#c0b8a5;line-height:1.5;overflow:hidden;text-overflow:ellipsis}',
    '.dcb-signal-dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:5px;vertical-align:middle}',
    '.dcb-node{padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03)}',
    '.dcb-node-id{font-size:0.34rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7);text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dcb-node-fn{font-size:0.32rem;color:#a09888;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dcb-dx{padding:6px 8px;margin-bottom:4px;border-radius:2px;border-left:3px solid transparent}',
    '.dcb-dx.active{background:rgba(232,84,84,0.08);border-left-color:rgba(232,84,84,0.5)}',
    '.dcb-dx.inactive{background:rgba(0,0,0,0.1);border-left-color:#706860}',
    '.dcb-dx-title{font-size:0.38rem;letter-spacing:1.5px;text-transform:uppercase}',
    '.dcb-dx-meta{font-size:0.3rem;color:#a09888;margin-top:2px}',
    '.dcb-treat{padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.34rem}',
    '.dcb-treat-label{color:#d0c8b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:70%;vertical-align:middle}',
    '.dcb-treat-type{font-size:0.28rem;letter-spacing:1px;padding:1px 4px;border-radius:1px;margin-left:4px;vertical-align:middle}',
    '.dcb-treat-ev{font-size:0.26rem;letter-spacing:1px;color:#908878;margin-left:4px}',
    '.dcb-cross{padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.34rem;display:flex;justify-content:space-between;align-items:center;gap:6px;overflow:hidden}',
    '.dcb-cross-domain{color:rgba(201,169,78,0.7);letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}',
    '.dcb-cross-type{font-size:0.28rem;color:#9a9080;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dcb-opp{padding:5px 8px;margin-bottom:3px;border:1px solid rgba(201,169,78,0.08);border-radius:2px;background:rgba(0,0,0,0.12)}',
    '.dcb-opp-title{font-size:0.34rem;color:#d0c8b8;letter-spacing:0.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:75%;vertical-align:middle}',
    '.dcb-opp-path{font-size:0.26rem;letter-spacing:1.5px;padding:1px 5px;border-radius:1px;margin-left:4px}',
    '.dcb-company{padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.34rem;display:flex;justify-content:space-between;gap:6px;overflow:hidden}',
    '.dcb-company-name{color:#c0b8a5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}',
    '.dcb-company-phase{font-size:0.3rem;letter-spacing:1px}',
    '.dcb-log{padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.30rem;color:#a09888;overflow:hidden;text-overflow:ellipsis}',
    '.dcb-log-type{font-size:0.24rem;letter-spacing:1px;padding:1px 3px;border-radius:1px;margin-right:4px;vertical-align:middle;color:rgba(201,169,78,0.55);border:1px solid rgba(201,169,78,0.15)}',
    '.dcb-bar{height:4px;border-radius:2px;background:rgba(255,255,255,0.05);overflow:hidden;margin-top:3px}',
    '.dcb-bar-fill{height:100%;border-radius:2px;transition:width 0.5s}',
    '.dcb-enter-portal{display:inline-block;font-size:0.34rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.5);text-decoration:none;padding:6px 14px;border:1px solid rgba(201,169,78,0.15);border-radius:2px;margin-top:8px;transition:all 0.2s;cursor:pointer;background:rgba(201,169,78,0.04)}',
    '.dcb-enter-portal:hover{color:rgba(201,169,78,0.9);border-color:rgba(201,169,78,0.35);background:rgba(201,169,78,0.1)}',
    '.dcb-empty{font-size:0.32rem;color:#807868;letter-spacing:1px;padding:8px 0}'
  ].join('\n');
  document.head.appendChild(style);

  // ══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════

  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
  function stressColor(v) { return v > 0.65 ? '#e85454' : v > 0.4 ? '#C9A94E' : '#5ab5a0'; }
  function phaseColor(p) {
    var m = {p0:'#5ab5a0',p1:'#C9A94E',p2:'#4a8fd4',p3:'#e85454',p4:'#5ab5a0',p5:'#C9A94E',p6:'#4a8fd4',p7:'#C9A94E',p7a:'#e85454',p9:'#e85454',p10:'#5ab5a0',ERROR:'#555'};
    return m[p] || '#888';
  }
  function phaseName(p) {
    var m = {p0:'SOURCE',p1:'RUPTURE',p2:'RHYTHM',p3:'INSTABILITY',p4:'STABILISATION',p5:'ENDURANCE',p6:'ORDER',p7:'DIVERGENCE',p7a:'TERMINAL',p9:'COLLAPSE',p10:'RESURRECTION',ERROR:'ERROR'};
    return m[p] || p;
  }
  function pathColor(path) {
    if (path === 'RESEARCHABLE') return 'color:#a855f7;border:1px solid rgba(168,85,247,0.2)';
    if (path === 'INVESTABLE') return 'color:#C9A94E;border:1px solid rgba(201,169,78,0.2)';
    return 'color:#9a9080;border:1px solid rgba(200,195,184,0.08)';
  }
  // Diagnosis stage + label precision
  function dxStage(dx, stress, maturity) {
    var rel = dx.relevance || 0;
    if (rel >= 0.8 && stress >= 0.7) return { stage: 'ACUTE', label: 'Confirmed pattern', color: '#e85454' };
    if (rel >= 0.6 || (maturity === 'STRUCTURAL' && rel >= 0.3)) return { stage: 'STRUCTURAL', label: 'Structural pressure', color: '#C9A94E' };
    if (rel >= 0.3 || stress >= 0.5) return { stage: 'EMERGING', label: 'Emerging signal', color: '#4a8fd4' };
    if (rel > 0) return { stage: 'WATCH', label: 'Early detection', color: '#5ab5a0' };
    return { stage: 'MONITORING', label: 'Pathway monitored', color: '#555' };
  }
  function dxPreciseLabel(dx, stageInfo) {
    var base = (dx.label || dx.id || '').replace(/_/g, ' ');
    if (stageInfo.stage === 'ACUTE') return base;
    if (stageInfo.stage === 'STRUCTURAL') return base + ' RISK PATTERN';
    if (stageInfo.stage === 'EMERGING') return base + ' PATHWAY';
    return base + ' PATHWAY';
  }

  function treatTypeColor(type) {
    if (type === 'pharmacological' || type === 'technology') return 'color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)';
    if (type === 'behavioral' || type === 'policy') return 'color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)';
    if (type === 'somatic' || type === 'infrastructure') return 'color:#C9A94E;border:1px solid rgba(201,169,78,0.2)';
    return 'color:#9a9080;border:1px solid rgba(200,195,184,0.08)';
  }

  // ══════════════════════════════════════════════════════════════════════
  // Gate B δ — Panel-authority classification.
  //
  // Visual authority DOWNGRADE for the 4 HIGH claim-bearing panels
  // (state / diagnoses / playbook / opportunities). Per operator
  // doctrine 2026-06-01:
  //
  //   Placeholder scanning prevents malformed artifacts. It does not
  //   prove panel authority.
  //
  //   Domain-console authority must be grounded in runtime brain
  //   state, not static portal schema.
  //
  //   STALE content may remain visible for audit, but not at full
  //   authority. Missing brain state suppresses content; weak brain
  //   state downgrades content. Ontology gaps are not a side panel.
  //   They are an authority input.
  //
  // Body is suppressed ONLY when content genuinely doesn't exist or
  // shouldn't be acted on:
  //   NO_BRAIN          — brain instance not registered
  //   BRAIN_NOT_READY   — INIT or READY-no-cycle
  //   BRAIN_STOPPED     — explicitly stopped
  //
  // STALE, CANDIDATE, NO_CONTENT keep their body visible. CANDIDATE
  // and STALE add a header badge; NO_CONTENT keeps the existing
  // honest empty-state text.
  //
  // δ logic stays local to domain-console-brain.js — brain-lifecycle
  // states (RUNNING/STOPPED/INIT) are not surfaces that exist on
  // company-portal or kernel-comparison, so render-authority.js
  // surface stays small.
  function classifyPanelAuthority(panelId, brain, state, ctx) {
    ctx = ctx || {};
    if (!brain) {
      return { level: 'NO_BRAIN', badge: 'NO BRAIN', reason: 'Domain brain not registered for this domain.', suppressBody: true };
    }
    if (!state) {
      return { level: 'BRAIN_NOT_READY', badge: 'NOT READY', reason: 'Brain has no state object.', suppressBody: true };
    }
    if (state.status === 'INIT') {
      return { level: 'BRAIN_NOT_READY', badge: 'INITIALIZING', reason: 'Brain is initializing.', suppressBody: true };
    }
    if (state.status === 'READY' && !state.updated) {
      return { level: 'BRAIN_NOT_READY', badge: 'AWAITING FIRST CYCLE', reason: 'Brain is ready but has not run a cycle yet.', suppressBody: true };
    }
    if (state.status === 'STOPPED') {
      return { level: 'BRAIN_STOPPED', badge: 'BRAIN STOPPED', reason: 'Brain was stopped. Re-enter domain to restart.', suppressBody: true };
    }
    // Freshness gate — applies once RUNNING
    if (state.status === 'RUNNING') {
      if (!state.updated) {
        // Running but no cycle timestamp — freshness unknown, content still rendered
        return { level: 'CANDIDATE', badge: 'FRESHNESS UNKNOWN', reason: 'Brain running but cycle timestamp missing.', suppressBody: false };
      }
      var age = Date.now() - state.updated;
      var staleAfter = (brain.cycleInterval || 30000) * 3; // 90s default
      if (age > staleAfter) {
        var ageSec = Math.round(age / 1000);
        return { level: 'STALE', badge: 'STALE · last cycle ' + ageSec + 's ago', reason: 'Last cycle older than ' + Math.round(staleAfter / 1000) + 's.', suppressBody: false };
      }
    }
    // Content presence — empty-state existing render handles its own message
    if (panelId === 'diagnoses' && (!state.diagnoses || state.diagnoses.length === 0)) {
      return { level: 'NO_CONTENT', badge: null, reason: null, suppressBody: false };
    }
    if (panelId === 'playbook' && (!state.treatments || state.treatments.length === 0)) {
      return { level: 'NO_CONTENT', badge: null, reason: null, suppressBody: false };
    }
    if (panelId === 'opportunities' && (!state.opportunities || state.opportunities.length === 0)) {
      return { level: 'NO_CONTENT', badge: null, reason: null, suppressBody: false };
    }
    // Ontology-gap downgrade — applies to state, diagnoses, playbook.
    // Ontology gaps are a self-reported brain-precision weakness;
    // they downgrade panel authority because the brain is admitting
    // its diagnosis ontology doesn't cover all currently-active
    // conditions.
    if (typeof ctx.unmappedConditionCount === 'number' && ctx.unmappedConditionCount > 0 &&
        (panelId === 'state' || panelId === 'diagnoses' || panelId === 'playbook')) {
      return { level: 'CANDIDATE', badge: 'ONTOLOGY COVERAGE INCOMPLETE · ' + ctx.unmappedConditionCount + ' gaps', reason: 'Brain reports unmapped active conditions; coverage incomplete.', suppressBody: false };
    }
    // Panel-specific authority
    if (panelId === 'state') {
      if (state.maturity === 'EARLY') {
        return { level: 'CANDIDATE', badge: 'EARLY-MATURITY DOMAIN', reason: 'Domain is still maturing; interpret with care.', suppressBody: false };
      }
      return { level: 'FULL', badge: null, reason: null, suppressBody: false };
    }
    if (panelId === 'diagnoses') {
      if (typeof ctx.activeDxCount === 'number' && ctx.activeDxCount === 0) {
        return { level: 'CANDIDATE', badge: 'MONITORED · no active diagnoses', reason: 'Diagnoses monitored but none active; per-item dxStage hedging applies.', suppressBody: false };
      }
      return { level: 'FULL', badge: null, reason: null, suppressBody: false };
    }
    if (panelId === 'playbook') {
      // Evidence field is empirically populated 100% in canonical data;
      // this rule is forward-protection. Any treatment missing .evidence
      // (or with blank string) downgrades the whole playbook to CANDIDATE.
      var hasMissingEvidence = state.treatments.some(function (t) {
        return !t || t.evidence === undefined || t.evidence === null ||
               (typeof t.evidence === 'string' && t.evidence.trim().length === 0);
      });
      if (hasMissingEvidence) {
        return { level: 'CANDIDATE', badge: 'TREATMENT EVIDENCE INCOMPLETE', reason: 'One or more treatments lack evidence value.', suppressBody: false };
      }
      return { level: 'FULL', badge: null, reason: null, suppressBody: false };
    }
    if (panelId === 'opportunities') {
      var hasMissingMeta = state.opportunities.some(function (o) {
        return !o || !o.path || o.urgency === undefined || o.urgency === null;
      });
      if (hasMissingMeta) {
        return { level: 'CANDIDATE', badge: 'OPPORTUNITY LANE INCOMPLETE', reason: 'One or more opportunities missing path or urgency.', suppressBody: false };
      }
      return { level: 'FULL', badge: null, reason: null, suppressBody: false };
    }
    return { level: 'FULL', badge: null, reason: null, suppressBody: false };
  }

  // Header badge for CANDIDATE / STALE / FRESHNESS_UNKNOWN states.
  // Empty string for FULL / NO_CONTENT (those use existing render).
  function renderPanelAuthorityBadge(authority) {
    if (!authority || !authority.badge) return '';
    if (authority.level === 'FULL' || authority.level === 'NO_CONTENT') return '';
    var color =
      (authority.level === 'STALE') ? '#e8a44e' :
      (authority.level === 'CANDIDATE') ? '#C9A94E' :
      '#C9A94E';
    var bg = (authority.level === 'STALE') ? 'rgba(232,164,78,0.06)' : 'rgba(201,169,78,0.04)';
    var border = (authority.level === 'STALE') ? 'rgba(232,164,78,0.25)' : 'rgba(201,169,78,0.20)';
    var h = '<div style="font-size:0.30rem;letter-spacing:1.5px;color:' + color + ';background:' + bg + ';padding:4px 8px;border-radius:2px;margin:0 0 6px;border:1px solid ' + border + ';text-transform:uppercase">';
    h += esc(authority.badge);
    if (authority.reason) {
      h += '<div style="font-size:0.28rem;color:rgba(200,195,184,0.55);margin-top:2px;letter-spacing:0.5px;text-transform:none">' + esc(authority.reason) + '</div>';
    }
    h += '</div>';
    return h;
  }

  // Replacement body for NO_BRAIN / BRAIN_NOT_READY / BRAIN_STOPPED.
  // These states mean the panel content genuinely doesn't exist or
  // shouldn't be acted on — show the operator why.
  function renderSuppressedPanelBody(authority) {
    var color = (authority.level === 'BRAIN_STOPPED' || authority.level === 'NO_BRAIN') ? '#e85454' : '#C9A94E';
    var bg = (authority.level === 'BRAIN_STOPPED' || authority.level === 'NO_BRAIN') ? 'rgba(232,84,84,0.05)' : 'rgba(201,169,78,0.04)';
    var border = (authority.level === 'BRAIN_STOPPED' || authority.level === 'NO_BRAIN') ? 'rgba(232,84,84,0.25)' : 'rgba(201,169,78,0.25)';
    var h = '<div style="padding:14px 12px;text-align:center;background:' + bg + ';border:1px solid ' + border + ';border-radius:3px">';
    h += '<div style="font-size:0.42rem;letter-spacing:2px;color:' + color + ';text-transform:uppercase;margin-bottom:6px">' + esc(authority.badge) + '</div>';
    h += '<div style="font-size:0.32rem;color:rgba(200,195,184,0.55);line-height:1.5">' + esc(authority.reason) + '</div>';
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATA FETCH
  // ══════════════════════════════════════════════════════════════════════

  // Freshness — reads from shared refresh controller
  function getFreshness() {
    var F = window['LIMEN' + DOMAIN_LABEL.replace(/\s/g, '') + 'Fresh'] || {};
    return {
      lastFetch: F.fetchedAt || null,
      snapshotAge: F.snapshotAge != null ? F.snapshotAge : null,
      status: F.status || 'INIT',
      fetchOk: F.status === 'LIVE',
      cycle: F.cycle || 0
    };
  }

  function fetchAllData() {
    var fetches = [];

    // Domain snapshot is handled by {domain}-refresh-controller.js (single source of truth)
    // We only fetch supplementary data here

    // Changelog
    fetches.push(
      fetch('/api/limen-changelog?domain=' + DOMAIN + '&limit=30')
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (d) { _changelog = Array.isArray(d) ? d : (d.entries || d.changelog || []); })
        .catch(function () { _changelog = []; })
    );

    // Companies from command board data
    fetches.push(
      fetch('assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : { companies: [] }; })
        .then(function (d) {
          var all = d.companies || [];
          var _brainPortalKey = (window.LIMENDomainBrains && window.LIMENDomainBrains.get(DOMAIN_KEY) && window.LIMENDomainBrains.get(DOMAIN_KEY).portalKey) || null;
          _companies = all.filter(function (c) { var cd = c.d || c.domain; return cd === DOMAIN_KEY || cd === DOMAIN || (_brainPortalKey && cd === _brainPortalKey); });
        })
        .catch(function () { _companies = []; })
    );

    // Portal data for nodes — use brain's portalKey if available (handles aliases like science→research, agriculture→p2_agri)
    var _portalFetchKey = DOMAIN;
    var _brainForPortal = window.LIMENDomainBrains ? window.LIMENDomainBrains.get(DOMAIN_KEY) : null;
    if (_brainForPortal && _brainForPortal.portalKey) _portalFetchKey = _brainForPortal.portalKey;
    fetches.push(
      fetch('/api/fetch-portal?domainId=' + _portalFetchKey)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { _portalData = d; })
        .catch(function () { _portalData = null; })
    );

    return Promise.all(fetches);
  }

  // ══════════════════════════════════════════════════════════════════════
  // GET BRAIN STATE
  // ══════════════════════════════════════════════════════════════════════

  function getBrainState() {
    // Try domain brain registry first
    if (window.LIMENDomainBrains) {
      var brain = window.LIMENDomainBrains.get(DOMAIN_KEY);
      if (brain && brain.getState) return brain.getState();
    }
    // Try direct window reference
    var directName = 'LIMEN' + DOMAIN_LABEL.replace(/\s/g, '') + 'Brain';
    if (window[directName] && window[directName].state) return window[directName].state;
    // Fallback: build from LIMENDomains
    var dom = window.LIMENDomains && window.LIMENDomains[DOMAIN_KEY];
    if (dom) {
      return {
        stress: dom.stress || 0,
        confidence: dom.confidence || 0,
        activity: dom.activity || 0,
        maturity: dom.maturity || 'EARLY',
        phase: dom.phase || 'p0',
        signals: dom.signals || [],
        feeds: dom.sources || [],
        diagnoses: [],
        treatments: [],
        opportunities: [],
        companies: [],
        convergence: null,
        crossDomainEmissions: [],
        memory: { stressHistory: [], phaseHistory: [], outcomeLog: [] }
      };
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CROSS-DOMAIN DATA
  // ══════════════════════════════════════════════════════════════════════

  // Cross-domain coupling weights — which domains transmit pressure to which
  var CROSS_DOMAIN_COUPLING = {
    energy: {finance:'commodity dislocation / capital stress',trade:'fuel export / import disruption',supplyChain:'logistics / fuel cost transmission',industry:'production cost coupling',defense:'geopolitical conflict / oil risk',agriculture:'biofuel / fertilizer cost linkage',infrastructure:'grid / pipeline dependency',manufacturing:'industrial energy demand',transportation:'fuel demand / supply shock',economy:'macro energy price sensitivity',environment:'regulatory / carbon policy'},
    finance: {energy:'commodity price volatility',trade:'trade flow disruption',economy:'macro fiscal stress',technology:'fintech / liquidity coupling',infrastructure:'municipal bond / project finance exposure'},
    agriculture: {energy:'fuel / fertilizer input cost',environment:'climate / water stress',trade:'export market disruption',supplyChain:'logistics / cold chain'},
    technology: {energy:'data center / grid demand',finance:'capital / funding stress',communications:'infrastructure dependency',defense:'cyber / supply chain',infrastructure:'cyber-physical (SCADA / ICS) exposure'},
    defense: {energy:'fuel supply / strategic reserve',finance:'defense spending / sanctions',trade:'embargo / conflict zones',manufacturing:'defense industrial base',infrastructure:'critical-infrastructure protection'},
    trade: {energy:'fuel logistics cost',finance:'currency / tariff stress',supplyChain:'global flow disruption',manufacturing:'input cost transmission'},
    medicine: {supplyChain:'pharma logistics',finance:'healthcare funding',research:'clinical pipeline','science':'research coupling'},
    health: {medicine:'treatment access',environment:'pollution / climate health',agriculture:'food security / nutrition'},
    environment: {energy:'emissions / extraction',agriculture:'land / water use',industry:'pollution / waste',manufacturing:'industrial emissions',infrastructure:'built-environment / water-treatment coupling'},
    education: {finance:'funding / endowment stress',technology:'edtech dependency',economy:'workforce pipeline'},
    infrastructure: {energy:'grid stress / transmission congestion feedback',economy:'construction cost drag / public-works inflation',supplyChain:'logistics constraint / transport network capacity',population:'service disruption cascade',finance:'capital funding exposure (municipal bonds / project finance)',environment:'built-environment / water-treatment coupling',technology:'cyber-physical (SCADA / ICS) exposure',defense:'critical-infrastructure protection',intelligence:'infrastructure threat intelligence (CISA KEV / ICS)',manufacturing:'materials supply',transportation:'transit network'},
    manufacturing: {energy:'energy input cost',supplyChain:'materials logistics',trade:'export / tariff impact',finance:'capital access'},
    transportation: {energy:'fuel cost',infrastructure:'road / rail / port',trade:'freight / logistics flow',manufacturing:'vehicle / parts supply'},
    construction: {manufacturing:'materials supply',finance:'lending / rates',infrastructure:'project pipeline',energy:'energy cost'},
    communications: {technology:'infrastructure coupling',energy:'power dependency',finance:'telecom investment'},
    science: {finance:'research funding',technology:'instrument / compute',energy:'lab / facility power'},
    research: {science:'discovery pipeline',finance:'grant funding',medicine:'clinical translation'},
    legal: {finance:'regulatory / compliance',trade:'international law',defense:'security law'},
    governance: {finance:'fiscal policy',defense:'national security',trade:'trade policy',legal:'regulatory framework'},
    space: {defense:'military space',technology:'launch / satellite tech',finance:'space investment',communications:'satellite dependency'},
    arts: {economy:'cultural economy',education:'arts education',technology:'digital media'},
    economy: {finance:'macro fiscal',trade:'trade balance',energy:'energy cost',manufacturing:'output / employment',infrastructure:'construction drag / public-works cost inflation'},
    population: {infrastructure:'service disruption / utility access',health:'public health capacity',economy:'employment / cost of living',environment:'climate displacement / habitability'},
    intelligence: {infrastructure:'infrastructure threat intelligence (CISA KEV / ICS)',defense:'national security coupling',technology:'cyber / exploited-CVE surface',finance:'sanctions / economic intelligence'}
  };

  function getCrossDomainPressure() {
    var pressure = [];
    var seen = {};
    // Source 1: LIMENCrossDomain detector
    if (window.LIMENCrossDomain && window.LIMENCrossDomain.active) {
      var active = window.LIMENCrossDomain.active;
      for (var i = 0; i < active.length; i++) {
        var p = active[i];
        if (p.domains && p.domains.indexOf(DOMAIN_KEY) !== -1) {
          pressure.push(p);
          if (p.sourceDomain) seen[p.sourceDomain] = true;
        }
      }
    }
    // Source 2: Other domain brains emitting into us
    if (window.LIMENDomainBrains) {
      var allStates = window.LIMENDomainBrains.getAllStates ? window.LIMENDomainBrains.getAllStates() : {};
      for (var dk in allStates) {
        if (dk === DOMAIN_KEY || seen[dk]) continue;
        var st = allStates[dk];
        var emissions = st.crossDomainEmissions || [];
        for (var ei = 0; ei < emissions.length; ei++) {
          if (emissions[ei].targetDomain === DOMAIN_KEY) {
            pressure.push({ sourceDomain: dk, signalType: emissions[ei].signalType, magnitude: emissions[ei].magnitude, stress: st.stress });
            seen[dk] = true;
          }
        }
      }
    }
    // Source 3: Shared snapshot — ALL domains (primary source for cross-domain stress)
    var snap = window.LIMENSharedSnapshot && window.LIMENSharedSnapshot.getSnapshot ? window.LIMENSharedSnapshot.getSnapshot() : null;
    var domainData = snap && snap.domains ? snap.domains : (window.LIMENDomains || {});
    var couplings = CROSS_DOMAIN_COUPLING[DOMAIN_KEY] || {};
    for (var d in domainData) {
      if (d === DOMAIN_KEY || seen[d]) continue;
      var dd = domainData[d];
      var stress = dd ? (dd.stress || dd.compositeStress || 0) : 0;
      if (stress >= 0.30 && couplings[d]) {
        pressure.push({ sourceDomain: d, signalType: couplings[d], magnitude: stress, stress: stress });
        seen[d] = true;
      } else if (stress >= 0.50) {
        pressure.push({ sourceDomain: d, signalType: 'sector_stress', magnitude: stress, stress: stress });
        seen[d] = true;
      }
    }
    // Source 4: Domain brain states fallback (for brains that have run but aren't in snapshot)
    if (window.LIMENDomainBrains && window.LIMENDomainBrains.getAllStates) {
      var brainStates = window.LIMENDomainBrains.getAllStates();
      for (var bk in brainStates) {
        if (bk === DOMAIN_KEY || seen[bk]) continue;
        var bs = brainStates[bk];
        var bStress = bs.stress || 0;
        if (bStress >= 0.30 && couplings[bk]) {
          pressure.push({ sourceDomain: bk, signalType: couplings[bk], magnitude: bStress, stress: bStress });
          seen[bk] = true;
        }
      }
    }
    pressure.sort(function (a, b) { return (b.magnitude || b.stress || 0) - (a.magnitude || a.stress || 0); });
    return pressure;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  function render() {
    var cv = _clarityView;
    if (!cv) return;

    var _freshness = getFreshness();
    var state = getBrainState();
    _crossDomain = getCrossDomainPressure();

    // Fallback when brain hasn't loaded yet
    if (!state) {
      cv.innerHTML = '<div style="padding:20px;text-align:center;color:#807868;font-size:0.4rem;letter-spacing:2px">' +
        DOMAIN_LABEL.toUpperCase() + ' BRAIN INITIALIZING\u2026</div>';
      return;
    }

    var stress = state.stress || 0;
    var sc = stressColor(stress);
    var conf = state.confidence || 0;
    var signals = state.signals || [];
    var diagnoses = state.diagnoses || [];
    var treatments = state.treatments || [];
    var opportunities = state.opportunities || [];
    var feeds = state.feeds || [];
    var memory = state.memory || {};
    var stressHistory = memory.stressHistory || [];
    var activeDx = diagnoses.filter(function (d) { return d.active; });
    // state.treatments transiently holds the RAW portal harvest (hundreds) before the
    // regulation engine narrows it — that's why the count used to flash ~400 then settle.
    // Count/show only treatments that map to an ACTIVE diagnosis: the stable, actionable set.
    var _activeDxIds = {}; for (var _ax = 0; _ax < activeDx.length; _ax++) _activeDxIds[activeDx[_ax].id] = true;
    treatments = treatments.filter(function (t) { return t && t.diagnosisId && _activeDxIds[t.diagnosisId]; });
    var resolvedContent = state.resolvedContent || {};
    var byDx = resolvedContent.byDiagnosis || {};

    // Get activated nodes from portal data
    var nodes = (_portalData && _portalData.activations) || [];
    // Build node lookup by brainNodeId
    var nodeMap = {};
    for (var nmi = 0; nmi < nodes.length; nmi++) { nodeMap[nodes[nmi].brainNodeId] = nodes[nmi]; }

    // ── DERIVED INTELLIGENCE ──
    var stressPct = Math.round(stress * 100);
    var confPct = Math.round(conf * 100);
    var liveFeeds = feeds.filter(function (f) { return f.live; });
    var prevStress = stressHistory.length >= 2 ? (typeof stressHistory[stressHistory.length - 2] === 'number' ? stressHistory[stressHistory.length - 2] : stressHistory[stressHistory.length - 2].stress || 0) : stress;
    var trendDir = stress > prevStress + 0.01 ? 'rising' : stress < prevStress - 0.01 ? 'falling' : 'stable';
    var trendWord = trendDir === 'rising' ? '\u25B2 RISING' : trendDir === 'falling' ? '\u25BC FALLING' : '\u25C6 STABLE';
    var trendColor = trendDir === 'rising' ? '#e85454' : trendDir === 'falling' ? '#5ab5a0' : '#C9A94E';

    // Severity classification
    var severity = stressPct >= 75 ? 'CRITICAL' : stressPct >= 55 ? 'ELEVATED' : stressPct >= 35 ? 'MODERATE' : 'CONTAINED';
    var sevColor = severity === 'CRITICAL' ? '#e85454' : severity === 'ELEVATED' ? '#C9A94E' : severity === 'MODERATE' ? '#4a8fd4' : '#5ab5a0';

    // Build executive intelligence summary — the "what is happening" line
    var execSummary = '';
    if (activeDx.length === 0 && stressPct < 30) {
      execSummary = DOMAIN_LABEL + ' operating within nominal parameters. No diagnosis pathways activated. Signal coverage ' + (conf >= 0.5 ? 'adequate' : 'limited') + '.';
    } else if (activeDx.length === 0 && stressPct >= 30) {
      execSummary = DOMAIN_LABEL + ' stress at ' + stressPct + '% without mapped diagnosis activation. Pressure is present but has not yet resolved into a recognized threat pattern. Monitor for escalation.';
    } else {
      var dxNames = [];
      for (var edi = 0; edi < activeDx.length; edi++) dxNames.push(activeDx[edi].label || activeDx[edi].id);
      execSummary = severity + ': ' + DOMAIN_LABEL + ' domain at ' + stressPct + '% stress with ' + activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' (' + dxNames.join(', ') + '). ';
      if (trendDir === 'rising') execSummary += 'Pressure is escalating. ';
      else if (trendDir === 'falling') execSummary += 'Pressure is decompressing but pathways remain active. ';
      if (treatments.length > 0) execSummary += treatments.length + ' regulation response' + (treatments.length > 1 ? 's' : '') + ' queued. ';
      if (_crossDomain.length > 0) execSummary += _crossDomain.length + ' external domain' + (_crossDomain.length > 1 ? 's' : '') + ' contributing pressure. ';
      if (state.maturity === 'STRUCTURAL') execSummary += 'Pattern classified STRUCTURAL \u2014 not transient, requires systemic response.';
    }

    // Safety layer: sanitize executive summary
    var _safety = window.LIMENResponseSafety;
    if (_safety) execSummary = _safety.sanitize(execSummary, 'console_exec_summary');

    // State assessment narrative — deeper than summary
    var stateNarr = DOMAIN_LABEL + ' aggregate stress: ' + stressPct + '%. ';
    stateNarr += 'Signal confidence: ' + confPct + '%' + (conf < 0.3 ? ' (LOW \u2014 assessments should be treated as provisional)' : conf < 0.6 ? ' (MODERATE)' : ' (HIGH)') + '. ';
    stateNarr += 'Trajectory: ' + trendDir + ' over recent cycles';
    if (trendDir === 'rising' && stressPct >= 50) stateNarr += ' \u2014 if this continues, expect downstream impact on infrastructure operations and capital deployment windows';
    else if (trendDir === 'falling' && activeDx.length > 0) stateNarr += ' \u2014 decompression underway but active diagnoses have not yet resolved';
    stateNarr += '. ';
    stateNarr += liveFeeds.length + '/' + feeds.length + ' feeds live. ';
    if (liveFeeds.length === 0 && feeds.length > 0) stateNarr += 'ALL FEEDS DARK \u2014 assessment based on last known state, not current observation. ';
    if (state.maturity === 'STRUCTURAL') stateNarr += 'Maturity: STRUCTURAL. This is not a transient spike \u2014 the stress pattern has persisted long enough to indicate a systemic condition requiring deliberate intervention, not watchful waiting.';

    // Safety layer: sanitize state narrative
    if (_safety) stateNarr = _safety.sanitize(stateNarr, 'console_state_narr');

    // ── DIAGNOSIS GAP DETECTION ──
    var _activeConditions = [];
    var _brainRef = window.LIMENDomainBrains ? window.LIMENDomainBrains.get(DOMAIN_KEY) : null;
    if (!_brainRef) _brainRef = window['LIMEN' + DOMAIN_LABEL.replace(/\s/g, '') + 'Brain'] || null;
    if (_brainRef && _brainRef._activeConditions) {
      _activeConditions = _brainRef._activeConditions;
    }
    // Find conditions not covered by any active diagnosis
    var coveredConditions = {};
    var diagIndex = (_brainRef && _brainRef.diagnosisIndex) || {};
    for (var dxId in diagIndex) {
      var triggers = diagIndex[dxId];
      for (var tri = 0; tri < triggers.length; tri++) { coveredConditions[triggers[tri]] = dxId; }
    }
    var unmappedConditions = [];
    for (var aci = 0; aci < _activeConditions.length; aci++) {
      var cond = _activeConditions[aci];
      // '_'-prefixed conditions (e.g. _stress_cash_flag) are DELIBERATELY unmapped:
      // stress-derived reporting flags, prefixed so they can't satisfy diagnosis
      // evidence-family requirements (see agriculture-brain.js). They are not
      // ontology gaps, so they must not be surfaced as DRAFT DIAGNOSES.
      if (cond.charAt(0) === '_') continue;
      if (!coveredConditions[cond]) {
        unmappedConditions.push(cond);
      }
    }

    // Gate B δ — panel-authority context. Built once per render(); fed into
    // classifyPanelAuthority() for the 4 HIGH claim-bearing panels (state,
    // diagnoses, playbook, opportunities).
    var __dcbPanelCtx = {
      unmappedConditionCount: unmappedConditions.length,
      activeDxCount: activeDx.length
    };

    var h = '';

    // ── EXECUTIVE STRIP ──
    var isLive = liveFeeds.length > 0 || signals.length > 0;
    var hasFiring = activeDx.length > 0;

    // Executive intelligence strip
    h += '<div id="dcb-exec" class="' + (isLive ? 'live' : '') + '">';
    h += '<span class="dcb-stress-big" style="color:' + sc + '">' + stressPct + '%</span>';
    h += '<span style="font-size:0.34rem;letter-spacing:2px;color:' + sevColor + ';font-family:monospace">' + severity + '</span>';
    h += '<span class="dcb-meta" style="color:' + trendColor + '">' + trendWord + '</span>';
    h += '<span class="dcb-meta">' + activeDx.length + ' dx <b style="color:' + (hasFiring ? '#e85454' : '#5ab5a0') + '">' + (hasFiring ? 'FIRING' : 'CLEAR') + '</b></span>';
    h += '<span class="dcb-meta">' + treatments.length + ' treatments</span>';
    h += '<span class="dcb-meta">' + liveFeeds.length + '/' + feeds.length + ' feeds</span>';
    // removed: BIO regulation label + HR STRAP connect button (biosensor UI off-site)
    h += '<span class="dcb-meta">conf <b>' + confPct + '%</b></span>';
    if (unmappedConditions.length > 0) h += '<span class="dcb-meta" style="color:#a855f7">' + unmappedConditions.length + ' GAPS</span>';
    h += '<span style="flex:1"></span>';
    h += '<span class="dcb-meta" style="font-size:0.26rem;color:#605850">' + DOMAIN_LABEL.toUpperCase() + ' INTELLIGENCE</span>';
    h += '</div>';
    // Executive summary narrative
    h += '<div style="grid-column:1/-1;padding:6px 14px;font-size:0.38rem;color:' + (hasFiring ? '#e0d8c5' : '#b0a898') + ';line-height:1.6;font-family:Georgia,serif;border-bottom:1px solid rgba(201,169,78,0.06)">' + esc(execSummary) + '</div>';

    // ── 3-COLUMN BRAIN GRID ──
    h += '<div id="dcb-root">';

    // ════ LEFT COLUMN ════
    h += '<div class="dcb-col">';

    // Pulse / What Changed (Energy only — reads from pulse engine)
    var pulse = state.pulse || null;
    if (pulse) {
      var pulseDeltas = pulse.deltas || [];
      var hasDelta = pulseDeltas.length > 0;
      h += '<div class="dcb-panel' + (hasDelta ? ' dcb-firing' : isLive ? ' dcb-live' : '') + '" data-panel="pulse" style="border-color:rgba(90,181,160,0.15)">';
      h += '<div class="dcb-panel-title"><span style="color:rgba(90,181,160,0.4)">PULSE \u00b7 ' + (pulse.regime || 'unknown').toUpperCase() + ' \u00b7 ' + (pulse.acceleration || 'stable').toUpperCase() + '</span></div>';
      h += '<div class="dcb-panel-body">';
      // Freshness
      h += '<div style="font-size:0.28rem;color:#807868;margin-bottom:4px">Freshness: ' + Math.round(pulse.freshnessScore * 100) + '% \u00b7 ' + pulse.liveFreshCount + ' fresh \u00b7 ' + pulse.liveStaleCount + ' stale \u00b7 ' + pulse.deadCount + ' dead</div>';
      // Source freshness detail
      var pSources = pulse.sources || [];
      for (var psi = 0; psi < pSources.length; psi++) {
        var ps = pSources[psi];
        var psColor = ps.fresh ? '#5ab5a0' : ps.stale ? '#C9A94E' : ps.live ? '#807868' : '#e85454';
        var psLabel = ps.fresh ? 'FRESH' : ps.stale ? 'STALE' : ps.live ? 'LIVE' : 'DEAD';
        h += '<div style="font-size:0.28rem;color:' + psColor + '">\u2022 ' + esc(ps.name) + ': ' + psLabel + ' (' + ps.ageLabel + ') \u00b7 ' + ps.sourceType;
        if (ps.value) h += ' \u00b7 $' + ps.value.toFixed(2);
        h += '</div>';
      }
      // Evidence families
      if (pulse.evidenceFamilies.length > 0) {
        h += '<div style="font-size:0.28rem;color:#4a8fd4;margin-top:4px">Evidence: ' + pulse.evidenceFamilies.join(', ') + '</div>';
      } else {
        h += '<div style="font-size:0.28rem;color:#706860;margin-top:4px">No specific evidence families active \u2014 only stress-derived conditions</div>';
      }
      // What changed
      if (hasDelta) {
        h += '<div style="font-size:0.26rem;letter-spacing:1.5px;color:rgba(90,181,160,0.5);margin-top:6px;margin-bottom:3px">WHAT CHANGED</div>';
        for (var dli = 0; dli < pulseDeltas.length; dli++) {
          var dl = pulseDeltas[dli];
          var dlColor = dl.direction === 'rising' || dl.direction === 'up' || dl.direction === 'activated' || dl.direction === 'recovered' ? '#5ab5a0' : dl.direction === 'falling' || dl.direction === 'down' || dl.direction === 'deactivated' || dl.direction === 'lost' ? '#e85454' : dl.direction === 'stale' ? '#C9A94E' : '#807868';
          h += '<div style="font-size:0.30rem;color:' + dlColor + '">\u25B8 ' + esc(dl.detail) + '</div>';
        }
      } else {
        h += '<div style="font-size:0.28rem;color:#706860;margin-top:4px">No changes since last cycle</div>';
      }
      // Blocked diagnoses
      var blocked = (pulse.validatedDiagnoses || []).filter(function (v) { return v.blocked; });
      if (blocked.length > 0) {
        h += '<div style="font-size:0.26rem;letter-spacing:1.5px;color:rgba(232,84,84,0.5);margin-top:6px;margin-bottom:3px">BLOCKED BY EVIDENCE CONTRACT</div>';
        for (var bli = 0; bli < blocked.length; bli++) {
          h += '<div style="font-size:0.28rem;color:#e85454">\u2717 ' + esc(blocked[bli].diagnosis.label) + ': ' + esc(blocked[bli].reason) + '</div>';
        }
      }
      h += '</div></div>';
    }

    // Live Feeds + Signals
    h += '<div class="dcb-panel' + (isLive ? ' dcb-live' : '') + '" data-panel="signals">';
    h += '<div class="dcb-panel-title"><span>SIGNAL INTAKE \u00b7 ' + signals.length + ' signals \u00b7 ' + liveFeeds.length + ' feeds</span></div>';
    h += '<div class="dcb-panel-body">';
    // Feed status
    if (feeds.length > 0) {
      for (var fi = 0; fi < feeds.length; fi++) {
        var fd = feeds[fi];
        var fdLive = fd.live !== false;
        h += '<div class="dcb-signal"><span class="dcb-signal-dot" style="background:' + (fdLive ? '#5ab5a0' : '#555') + '"></span>';
        h += '<span style="color:rgba(200,195,184,' + (fdLive ? '0.5' : '0.2') + ')">' + esc(fd.name || fd.label || 'Feed ' + fi);
        if (fd.value !== undefined) h += ' <b style="color:rgba(201,169,78,0.5)">' + fd.value + '</b>';
        h += '</span></div>';
      }
      h += '<div style="border-top:1px solid rgba(201,169,78,0.04);margin:4px 0"></div>';
    }
    // Extracted signals
    if (signals.length === 0) {
      h += '<div class="dcb-empty">No extracted signals</div>';
    } else {
      for (var si = 0; si < signals.length; si++) {
        var sig = signals[si];
        var sigText = typeof sig === 'string' ? sig : (sig.label || sig.name || JSON.stringify(sig));
        var dotColor = sigText.indexOf('ELEVATED') !== -1 || sigText.indexOf('ALERT') !== -1 ? '#e85454' :
                       sigText.indexOf('WARNING') !== -1 ? '#C9A94E' : '#5ab5a0';
        h += '<div class="dcb-signal"><span class="dcb-signal-dot" style="background:' + dotColor + '"></span>' + esc(sigText) + '</div>';
      }
    }
    // Active conditions
    if (_activeConditions.length > 0) {
      h += '<div style="border-top:1px solid rgba(201,169,78,0.04);margin:4px 0"></div>';
      h += '<div class="dcb-meta" style="margin-bottom:3px">ACTIVE CONDITIONS</div>';
      for (var aci2 = 0; aci2 < _activeConditions.length; aci2++) {
        var ac = _activeConditions[aci2];
        var mapped = coveredConditions[ac];
        h += '<div style="font-size:0.30rem;padding:1px 0;color:' + (mapped ? 'rgba(200,195,184,0.4)' : '#a855f7') + '">';
        h += esc(ac.replace(/_/g, ' '));
        h += mapped ? ' <span style="color:#807868">\u2192 ' + esc(mapped) + '</span>' : ' <span style="color:#a855f7">\u2192 UNMAPPED</span>';
        h += '</div>';
      }
    }
    h += '</div></div>';

    // Activated Nodes
    h += '<div class="dcb-panel" data-panel="nodes">';
    h += '<div class="dcb-panel-title"><span>NODE ACTIVATION \u00b7 ' + nodes.length + ' nodes</span></div>';
    h += '<div class="dcb-panel-body">';
    if (nodes.length === 0) {
      h += '<div class="dcb-empty">Awaiting portal node data</div>';
    } else {
      for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        // Check if this node is implicated in any active diagnosis
        var implicated = false;
        var implicatedDx = [];
        for (var adi = 0; adi < activeDx.length; adi++) {
          var circuits = activeDx[adi].circuits || [];
          for (var cci = 0; cci < circuits.length; cci++) {
            if (circuits[cci].nodeId === node.brainNodeId) { implicated = true; implicatedDx.push(activeDx[adi].label || activeDx[adi].id); break; }
          }
        }
        h += '<div class="dcb-node" style="' + (implicated ? 'border-left:2px solid rgba(232,84,84,0.3);padding-left:6px' : '') + '">';
        h += '<div class="dcb-node-id">' + esc(node.brainNodeId || '') + ' \u2192 ' + esc(node.domainLabel || '') + '</div>';
        h += '<div class="dcb-node-fn">' + esc(node.domainFunction || '') + '</div>';
        if (node.whyThisNode) h += '<div style="font-size:0.28rem;color:#807868;margin-top:1px;line-height:1.3">' + esc(node.whyThisNode.substring(0, 100)) + '</div>';
        if (implicated) h += '<div style="font-size:0.26rem;color:#e85454;margin-top:2px">IMPLICATED: ' + esc(implicatedDx.join(', ')) + '</div>';
        if (node.companies && node.companies.length > 0) {
          h += '<div class="dcb-meta" style="margin-top:2px">';
          for (var nci = 0; nci < Math.min(node.companies.length, 3); nci++) {
            var nc = node.companies[nci];
            h += (nci > 0 ? ' \u00b7 ' : '') + (nc.ticker_or_id || nc.ticker || '') + ' <span style="color:#706860">(' + (nc.binding_strength ? Math.round(nc.binding_strength * 100) + '%' : '') + ')</span>';
          }
          if (node.companies.length > 3) h += ' +' + (node.companies.length - 3);
          h += '</div>';
        }
        h += '</div>';
      }
    }
    h += '</div></div>';

    // Change Log
    h += '<div class="dcb-panel" data-panel="changelog">';
    h += '<div class="dcb-panel-title"><span>CHANGE LOG \u00b7 ' + _changelog.length + '</span></div>';
    h += '<div class="dcb-panel-body">';
    if (_changelog.length === 0) {
      h += '<div class="dcb-empty">No recent changes recorded</div>';
    } else {
      for (var li = 0; li < _changelog.length; li++) {
        var log = _changelog[li];
        var logType = log.type || log.changeType || 'EVENT';
        var logMsg = log.message || log.description || log.summary || '';
        var logTime = log.timestamp || log.ts || log.date || '';
        if (logTime) { try { logTime = new Date(logTime).toLocaleString(); } catch (e) { /* keep raw */ } }
        h += '<div class="dcb-log">';
        h += '<span class="dcb-log-type">' + esc(logType.replace(/_/g, ' ')) + '</span>';
        h += esc(logMsg.substring(0, 100));
        if (logTime) h += '<div style="font-size:0.22rem;color:#706860;margin-top:1px">' + esc(logTime) + '</div>';
        h += '</div>';
      }
    }
    h += '</div></div>';

    h += '</div>'; // end left col

    // ════ CENTER COLUMN ════
    h += '<div class="dcb-col">';

    // Domain State — derived narrative
    var __authState = classifyPanelAuthority('state', _brainRef, state, __dcbPanelCtx);
    h += '<div class="dcb-panel' + (isLive ? ' dcb-live' : '') + '" data-panel="state">';
    h += '<div class="dcb-panel-title"><span>' + DOMAIN_LABEL.toUpperCase() + ' STATE ASSESSMENT</span></div>';
    h += '<div class="dcb-panel-body">';
    if (__authState.suppressBody) {
      h += renderSuppressedPanelBody(__authState);
    } else {
      h += renderPanelAuthorityBadge(__authState);
    h += '<div class="dcb-bar"><div class="dcb-bar-fill" style="width:' + stressPct + '%;background:' + sc + '"></div></div>';
    h += '<div class="dcb-meta" style="margin-top:6px">' + stressPct + '% stress \u00b7 ' + confPct + '% confidence \u00b7 ' + Math.round((state.activity || 0) * 100) + '% activity \u00b7 phase <b style="color:' + phaseColor(state.phase) + '">' + (state.phase || 'p0').toUpperCase() + ' ' + phaseName(state.phase) + '</b></div>';
    // Derived narrative
    h += '<div style="font-size:0.32rem;color:#c0b8a5;line-height:1.6;margin-top:6px">' + esc(stateNarr) + '</div>';
    // Stress trend sparkline
    if (stressHistory.length >= 2) {
      h += '<div class="dcb-meta" style="margin-top:6px">STRESS TRAJECTORY: ';
      var histLen = Math.min(stressHistory.length, 15);
      for (var hi = stressHistory.length - histLen; hi < stressHistory.length; hi++) {
        var hv = typeof stressHistory[hi] === 'number' ? stressHistory[hi] : (stressHistory[hi].stress || 0);
        h += '<span style="color:' + stressColor(hv) + '">' + Math.round(hv * 100) + '</span> ';
      }
      h += '</div>';
    }
    }
    h += '</div></div>';

    // Diagnosis Chain — deep explanations
    var __authDiagnoses = classifyPanelAuthority('diagnoses', _brainRef, state, __dcbPanelCtx);
    h += '<div class="dcb-panel' + (hasFiring ? ' dcb-firing' : isLive ? ' dcb-live' : '') + '" data-panel="diagnoses">';
    h += '<div class="dcb-panel-title"><span>DIAGNOSIS CHAIN \u00b7 ' + activeDx.length + ' active / ' + diagnoses.length + ' monitored</span></div>';
    h += '<div class="dcb-panel-body">';
    if (__authDiagnoses.suppressBody) {
      h += renderSuppressedPanelBody(__authDiagnoses);
    } else {
      h += renderPanelAuthorityBadge(__authDiagnoses);
    if (diagnoses.length === 0) {
      h += '<div class="dcb-empty">No diagnoses derived \u2014 portal structure not yet loaded or no conditions matched.</div>';
    } else {
      for (var di = 0; di < diagnoses.length; di++) {
        var dx = diagnoses[di];
        var dxCircuits = dx.circuits || [];
        var dxResolved = byDx[dx.id];
        var stg = dxStage(dx, stress, state.maturity);
        var preciseLabel = dx.active ? dxPreciseLabel(dx, stg) : (dx.label || dx.id || '').replace(/_/g, ' ') + ' PATHWAY';

        h += '<div class="dcb-dx ' + (dx.active ? 'active' : 'inactive') + '">';
        // Precise label with stage badge
        h += '<div class="dcb-dx-title" style="color:' + (dx.active ? stg.color : '#807868') + '">';
        h += (dx.active ? '\u26A0 ' : '\u25CB ') + esc(preciseLabel);
        h += '</div>';
        // Stage + confirmation
        if (dx.active) {
          h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:0.28rem">';
          h += '<span style="color:' + stg.color + ';letter-spacing:1px">' + stg.stage + '</span>';
          h += '<span style="color:#b0a898">' + stg.label + '</span>';
          h += '<span style="color:#807868">' + (dx.matchedConditions || 0) + '/' + (dx.totalTriggers || 0) + ' triggers \u00b7 ' + Math.round((dx.relevance || 0) * 100) + '% match</span>';
          if (stg.stage !== 'ACUTE') h += '<span style="color:#807868">No confirmed event \u2014 pathway inference</span>';
          h += '</div>';
        } else {
          h += '<div style="font-size:0.28rem;color:#807868;margin-top:2px">Inactive \u2014 0/' + (dx.totalTriggers || 0) + ' triggers matched</div>';
        }
        // Summary
        if (dx.summary) h += '<div style="font-size:0.30rem;color:#a09888;line-height:1.5;margin-top:3px">' + esc(dx.summary) + '</div>';
        // Implicated nodes
        if (dx.active && dxCircuits.length > 0) {
          h += '<div style="font-size:0.28rem;color:#a09888;margin-top:3px">IMPLICATED NODES: ';
          for (var dci = 0; dci < dxCircuits.length; dci++) {
            var nid = dxCircuits[dci].nodeId;
            var nobj = nodeMap[nid];
            h += (dci > 0 ? ', ' : '') + '<span style="color:rgba(201,169,78,0.7)">' + esc(nid) + '</span>';
            if (nobj) h += ' (' + esc(nobj.domainLabel || '') + ')';
          }
          h += '</div>';
        }
        // Deep causal explanation for active diagnoses
        if (dx.active) {
          h += '<div style="font-size:0.30rem;color:#b0a898;line-height:1.6;margin-top:4px;border-top:1px solid rgba(201,169,78,0.06);padding-top:4px">';
          // WHY IT FIRED
          h += '<b style="color:#e08060">WHY:</b> ' + (dx.matchedConditions || 0) + ' of ' + (dx.totalTriggers || 0) + ' trigger conditions matched in live feed data. ';
          // WHICH SIGNALS
          var matchedSigs = [];
          var dxTriggers = diagIndex[dx.id] || [];
          for (var msi = 0; msi < dxTriggers.length; msi++) {
            if (_activeConditions.indexOf(dxTriggers[msi]) !== -1) matchedSigs.push(dxTriggers[msi].replace(/_/g, ' '));
          }
          if (matchedSigs.length > 0) h += 'Matched: <b style="color:#d0c8b8">' + matchedSigs.join(', ') + '</b>. ';
          // WHICH NODES + WHY THEY MATTER
          if (dxCircuits.length > 0) {
            var nodeDescs = [];
            for (var eni = 0; eni < dxCircuits.length; eni++) {
              var en = nodeMap[dxCircuits[eni].nodeId];
              if (en) nodeDescs.push((en.domainLabel || dxCircuits[eni].nodeId) + (en.functional_role ? ' [' + en.functional_role + ']' : ''));
            }
            h += '<br><b style="color:rgba(201,169,78,0.7)">IMPAIRED:</b> ' + nodeDescs.join(', ') + '. ';
            var firstNode = nodeMap[dxCircuits[0].nodeId];
            if (firstNode && firstNode.domainFunction) h += 'Primary function at risk: ' + esc(firstNode.domainFunction.substring(0, 120)) + '. ';
          }
          // CONSEQUENCE IF UNTREATED
          h += '<br><b style="color:#a09888">IF UNTREATED:</b> ';
          if (dx.relevance >= 0.7) h += 'High probability of cascading failure across dependent ' + DOMAIN_LABEL + ' subsystems. Capital deployment windows narrow. Regulatory exposure increases.';
          else if (dx.relevance >= 0.4) h += 'Moderate risk of escalation. Infrastructure degradation becomes harder to reverse if stress persists beyond current observation window.';
          else h += 'Currently early-stage. May resolve without intervention, but should be tracked for pattern confirmation over the next 2\u20133 cycles.';
          // CONFIDENCE
          h += '<br><b style="color:#a09888">CONFIDENCE:</b> ' + Math.round((dx.relevance || 0) * 100) + '% trigger match. ';
          h += conf >= 0.6 ? 'Signal coverage adequate for operational decisions.' : 'Signal coverage limited \u2014 treat as indicative, not confirmatory.';
          h += '</div>';
        }
        h += '</div>';
      }
    }
    }
    h += '</div></div>';

    // ═══ REGULATION PLAYBOOK — grouped by diagnosis ═══
    var __authPlaybook = classifyPanelAuthority('playbook', _brainRef, state, __dcbPanelCtx);
    h += '<div class="dcb-panel' + (treatments.length > 0 ? ' dcb-firing' : isLive ? ' dcb-live' : '') + '" data-panel="playbook">';
    h += '<div class="dcb-panel-title"><span>REGULATION PLAYBOOK \u00b7 ' + treatments.length + ' treatments across ' + activeDx.length + ' diagnoses</span></div>';
    h += '<div class="dcb-panel-body">';
    if (__authPlaybook.suppressBody) {
      h += renderSuppressedPanelBody(__authPlaybook);
    } else {
      h += renderPanelAuthorityBadge(__authPlaybook);

    if (treatments.length === 0 && activeDx.length === 0) {
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5">No active regulation pathways. Playbook populates when diagnosis triggers fire against live feed data.</div>';
    } else if (treatments.length === 0 && activeDx.length > 0) {
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5">Diagnoses active but no treatments resolved from portal node structure. Treatment mapping gap detected for current diagnosis set.</div>';
    } else {
      // Group treatments by diagnosis
      var treatByDx = {};
      for (var tgi = 0; tgi < treatments.length; tgi++) {
        var tg = treatments[tgi];
        var dxKey = tg.diagnosisId || 'UNLINKED';
        if (!treatByDx[dxKey]) treatByDx[dxKey] = [];
        treatByDx[dxKey].push(tg);
      }

      // Evidence rank for priority ordering
      var evRank = { 'Strong': 4, 'A': 4, 'Moderate': 3, 'B': 3, 'Emerging': 2, 'C': 2 };

      for (var dxKey2 in treatByDx) {
        var dxTreats = treatByDx[dxKey2];
        var dxLabel2 = dxKey2.replace(/_/g, ' ');

        // Sort by evidence strength
        dxTreats.sort(function (a, b) { return (evRank[b.evidence] || 1) - (evRank[a.evidence] || 1); });

        h += '<div style="margin-bottom:8px">';
        h += '<div style="font-size:0.28rem;letter-spacing:2px;color:rgba(201,169,78,0.6);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid rgba(201,169,78,0.08)">' + esc(dxLabel2.toUpperCase()) + ' \u00b7 ' + dxTreats.length + ' treatments</div>';

        for (var tri2 = 0; tri2 < dxTreats.length; tri2++) {
          var t = dxTreats[tri2];
          var tn = nodeMap[t.nodeId];
          var priority = tri2 === 0 ? 'PRIMARY' : tri2 === 1 ? 'SECONDARY' : 'SUPPORTING';
          var prioColor = tri2 === 0 ? '#C9A94E' : tri2 === 1 ? '#b0a898' : '#807868';

          h += '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.02);' + (tri2 === 0 ? 'border-left:2px solid rgba(201,169,78,0.3);padding-left:8px;' : '') + '">';

          // Title + priority + type + evidence
          h += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">';
          h += '<span style="font-size:0.22rem;letter-spacing:2px;color:' + prioColor + '">' + priority + '</span>';
          h += '<span class="dcb-treat-label">' + esc(t.label) + '</span>';
          if (t.type) h += '<span class="dcb-treat-type" style="' + treatTypeColor(t.type) + '">' + esc(t.type) + '</span>';
          if (t.evidence) h += '<span class="dcb-treat-ev">EV: ' + esc(t.evidence) + '</span>';
          // Promoted directive badge
          if (t.source === 'portal_directive_promoted' && t._promotedFrom) {
            var pf = t._promotedFrom;
            h += '<span style="font-size:0.20rem;letter-spacing:0.5px;padding:1px 4px;border-radius:2px;color:rgba(74,143,212,0.8);border:1px solid rgba(74,143,212,0.2);background:rgba(74,143,212,0.04);margin-left:2px">PROMOTED L' + (pf.depth != null ? pf.depth : '?') + ' \u00b7 ' + esc(pf.nodeLabel || pf.portalDomainId || '') + '</span>';
          }
          h += '</div>';

          // Node binding
          h += '<div style="font-size:0.24rem;color:#807868;margin-top:1px">node ' + esc(t.nodeId || '?');
          if (tn) h += ' (' + esc(tn.domainLabel || '') + ')';
          if (t.source === 'portal_directive_promoted' && t._promotedFrom && t._promotedFrom.portalTitle) {
            h += ' \u00b7 <span style="color:rgba(74,143,212,0.5)">via ' + esc(t._promotedFrom.portalTitle) + '</span>';
          }
          h += '</div>';

          // Operational meaning + implementation actions
          h += '<div style="font-size:0.28rem;color:#a09888;line-height:1.5;margin-top:3px">';
          if (t.description) h += esc(t.description.substring(0, 180)) + ' ';
          // Concrete implementation — prefer treatment-specific text, generic only as last resort
          var _doText = '';
          if (t.steps && t.steps.length > 0) {
            var _s0 = t.steps[0].step || t.steps[0];
            if (typeof _s0 === 'string' && _s0.length > 3) _doText = _s0;
          }
          if (!_doText && t.description && t.description.length > 10) {
            _doText = t.description.length > 200 ? t.description.substring(0, 200) + '\u2026' : t.description;
          }
          if (!_doText) {
            _doText = t.type === 'STRUCTURAL'
              ? 'Deploy capital into physical infrastructure. Procure, build, or harden systems at the node level.'
              : 'Implement operational process change. Adjust monitoring, routing, or response protocols.';
          }
          h += '<br><b style="color:#908878">DO:</b> ' + esc(_doText) + ' ';
          // Who does it
          if (tn && tn.companies && tn.companies.length > 0) {
            h += '<br><b style="color:#908878">WHO:</b> ';
            for (var twi = 0; twi < Math.min(tn.companies.length, 3); twi++) {
              var twc = tn.companies[twi];
              h += (twi > 0 ? ', ' : '') + esc(twc.name || twc.ticker_or_id || '');
            }
            h += '. ';
          }
          h += '</div>';

          // Steps if available
          if (t.steps && t.steps.length > 0) {
            h += '<div style="font-size:0.26rem;color:#807868;margin-top:2px">STEPS: ';
            for (var tsi2 = 0; tsi2 < t.steps.length; tsi2++) {
              h += (tsi2 > 0 ? ' \u2192 ' : '') + esc(t.steps[tsi2].step || t.steps[tsi2]);
            }
            h += '</div>';
          }

          // Success / failure signals
          h += '<div style="font-size:0.26rem;margin-top:3px">';
          h += '<span style="color:#5ab5a0">\u2713 IMPROVING:</span> <span style="color:#908878">stress contribution from ' + esc(dxLabel2) + ' declines, node ' + esc(t.nodeId || '') + ' load normalizes, monitoring metrics trend positive</span>';
          h += '<br><span style="color:#e85454">\u2717 WORSENING:</span> <span style="color:#908878">stress persists or accelerates despite intervention, downstream nodes activate, new diagnosis triggers fire</span>';
          h += '<br><span style="color:#807868">\u2205 INVALID IF:</span> <span style="color:#706860">parent diagnosis ' + esc(dxLabel2) + ' deactivates, domain stress falls below 30%, or structural conditions fundamentally change</span>';
          h += '</div>';

          // Monitoring
          if (t.monitoring && t.monitoring.length > 0) {
            h += '<div style="font-size:0.24rem;color:rgba(74,143,212,0.5);margin-top:2px">MONITOR: ';
            for (var tmi2 = 0; tmi2 < t.monitoring.length; tmi2++) {
              h += (tmi2 > 0 ? ', ' : '') + esc(t.monitoring[tmi2].metric || t.monitoring[tmi2]);
            }
            h += '</div>';
          }

          if (t.cite && typeof t.cite === 'string' && t.cite.length > 0) {
            h += '<div style="font-size:0.22rem;color:#706860;margin-top:1px">Sources: ' + esc(t.cite) + '</div>';
          } else if (t.cite && t.cite.length > 0) {
            h += '<div style="font-size:0.22rem;color:#706860;margin-top:1px">' + t.cite.length + ' citation' + (t.cite.length > 1 ? 's' : '') + '</div>';
          }

          // Deep portal metadata for promoted overlays
          if (t.source === 'portal_directive_promoted') {
            var hasDeep = t.monitoring || t.escalation || t.targetPathway || (t.citations && t.citations.length > 0);
            if (hasDeep) {
              h += '<details style="margin-top:4px;font-size:0.26rem"><summary style="cursor:pointer;color:rgba(74,143,212,0.5);letter-spacing:1px">DEEP INTELLIGENCE \u25BC</summary>';
              h += '<div style="margin-top:4px;padding:4px 8px;border-left:2px solid rgba(74,143,212,0.12);background:rgba(74,143,212,0.02)">';
              if (t.monitoring) {
                h += '<div style="margin-bottom:4px"><span style="color:rgba(74,143,212,0.6);letter-spacing:1px;font-size:0.22rem">MONITORING</span><br><span style="color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring : '') + '</span></div>';
              }
              if (t.escalation) {
                h += '<div style="margin-bottom:4px"><span style="color:rgba(74,143,212,0.6);letter-spacing:1px;font-size:0.22rem">IF THIS FAILS</span><br><span style="color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation : '') + '</span></div>';
              }
              if (t.targetPathway) {
                h += '<div style="margin-bottom:4px"><span style="color:rgba(74,143,212,0.6);letter-spacing:1px;font-size:0.22rem">STRATEGY PATH</span><br><span style="color:#a09888">' + esc(t.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</span></div>';
              }
              if (t.citations && t.citations.length > 0) {
                h += '<div><span style="color:rgba(74,143,212,0.6);letter-spacing:1px;font-size:0.22rem">SOURCES (' + t.citations.length + ')</span>';
                for (var dci = 0; dci < t.citations.length; dci++) {
                  var dc = t.citations[dci];
                  var dcStr = typeof dc === 'string' ? dc : ((dc.author || '') + ' (' + (dc.year || '') + '). ' + (dc.title || '') + '. ' + (dc.journal || ''));
                  h += '<br><span style="color:#807868">' + esc(dcStr) + '</span>';
                }
                h += '</div>';
              }
              h += '</div></details>';
            }
          }

          h += '</div>';
        }
        h += '</div>';
      }
    }
    }
    h += '</div></div>';

    // ═══ NODE → COMPANY → DOMAIN MAPPING ═══
    if (nodes.length > 0 && activeDx.length > 0) {
      h += '<div class="dcb-panel" data-panel="nodemapping">';
      h += '<div class="dcb-panel-title"><span>NODE \u2192 SYSTEM MAPPING</span></div>';
      h += '<div class="dcb-panel-body">';
      // Only show nodes implicated in active diagnoses
      var mappedNodes = [];
      for (var mni = 0; mni < nodes.length; mni++) {
        var mn = nodes[mni];
        for (var mdi = 0; mdi < activeDx.length; mdi++) {
          var mCirc = activeDx[mdi].circuits || [];
          for (var mci = 0; mci < mCirc.length; mci++) {
            if (mCirc[mci].nodeId === mn.brainNodeId) { mappedNodes.push(mn); break; }
          }
          if (mappedNodes[mappedNodes.length - 1] === mn) break;
        }
      }
      if (mappedNodes.length === 0) mappedNodes = nodes.slice(0, 5); // fallback to first 5
      for (var mpi = 0; mpi < mappedNodes.length; mpi++) {
        var mpn = mappedNodes[mpi];
        h += '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03)">';
        h += '<div style="font-size:0.30rem;color:rgba(201,169,78,0.7);letter-spacing:1px">' + esc(mpn.brainNodeId || '') + ' \u2192 ' + esc(mpn.domainLabel || '') + '</div>';
        h += '<div style="font-size:0.28rem;color:#b0a898;line-height:1.4;margin-top:1px">';
        if (mpn.domainFunction) h += '<b style="color:#a09888">Function:</b> ' + esc(mpn.domainFunction.substring(0, 100)) + '. ';
        if (mpn.functional_role) h += '<b style="color:#a09888">Role:</b> ' + esc(mpn.functional_role) + '. ';
        if (mpn.group) h += '<b style="color:#a09888">Group:</b> ' + esc(mpn.group) + '. ';
        // Companies
        if (mpn.companies && mpn.companies.length > 0) {
          h += '<br><b style="color:#a09888">Operators:</b> ';
          for (var mpci = 0; mpci < Math.min(mpn.companies.length, 4); mpci++) {
            var mpc = mpn.companies[mpci];
            h += (mpci > 0 ? ' \u00b7 ' : '') + esc(mpc.name || mpc.ticker_or_id || '');
          }
        }
        h += '</div>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // ═══ CROSS-DOMAIN TRANSFER LOGIC ═══
    var emissions = state.crossDomainEmissions || [];
    h += '<div class="dcb-panel" data-panel="transfer">';
    h += '<div class="dcb-panel-title"><span>CROSS-DOMAIN REGULATORY TRANSFER \u00b7 ' + emissions.length + '</span></div>';
    h += '<div class="dcb-panel-body">';
    if (emissions.length > 0) {
      h += '<div style="font-size:0.30rem;color:#b0a898;line-height:1.5;margin-bottom:6px">' + DOMAIN_LABEL + ' regulatory patterns propagate to ' + emissions.length + ' dependent domain' + (emissions.length > 1 ? 's' : '') + '. The same stress \u2192 diagnosis \u2192 treatment logic applies across these systems with domain-specific expression.</div>';
      for (var tli = 0; tli < emissions.length; tli++) {
        var tlem = emissions[tli];
        var tlTarget = (tlem.targetDomain || '').replace(/_/g, ' ');
        var tlSig = (tlem.signal || tlem.signalType || '').replace(/_/g, ' ');
        h += '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.30rem">';
        h += '<span style="color:rgba(201,169,78,0.7)">' + DOMAIN_LABEL.toUpperCase() + ' \u2192 ' + esc(tlTarget.toUpperCase()) + '</span>';
        h += ' <span style="color:#9a9080">\u00b7 ' + esc(tlSig) + ' \u00b7 ' + Math.round((tlem.magnitude || 0) * 100) + '% magnitude</span>';
        h += '<div style="font-size:0.28rem;color:#908878;margin-top:1px">';
        var _coupling = (CROSS_DOMAIN_COUPLING[DOMAIN_KEY] || {})[tlem.targetDomain];
        if (_coupling) h += 'Reuse: ' + esc(_coupling) + ' \u2014 stress-transmission diagnosis applies across this pathway.';
        else if (tlem.targetDomain === 'supplyChain') h += 'Reuse: supply chain transmission diagnosis applies to logistics, distribution, and input chains.';
        else if (tlem.targetDomain === 'finance') h += 'Reuse: financial transmission diagnosis transfers to hedging, derivatives, and sector rotation strategies.';
        else if (tlem.targetDomain === 'economy') h += 'Reuse: economic pressure diagnosis applies to pricing, demand, and macro fiscal systems.';
        else if (tlem.targetDomain === 'energy') h += 'Reuse: energy input diagnosis applies to fuel, power, and biofuel systems.';
        else if (tlem.targetDomain === 'environment') h += 'Reuse: environmental pressure diagnosis applies to land use, water, and climate systems.';
        else if (tlem.targetDomain === 'agriculture') h += 'Reuse: agricultural input diagnosis applies to fertilizer, irrigation, and food supply systems.';
        else if (tlem.targetDomain === 'industry') h += 'Reuse: industrial transmission diagnosis applies to manufacturing, materials, and output systems.';
        else h += 'Reuse: stress-transmission logic applies to dependent systems in this domain.';
        h += '</div>';
        h += '</div>';
      }
    } else {
      h += '<div style="font-size:0.30rem;color:#706860;line-height:1.5">No active cross-domain transfers. Emissions activate when ' + DOMAIN_LABEL + ' stress exceeds emission thresholds and propagates to dependent domains.</div>';
    }
    h += '</div></div>';

    // ═══ DIAGNOSIS GAP — CONSTRUCTIVE DRAFT ═══
    if (unmappedConditions.length > 0) {
      h += '<div class="dcb-panel" data-panel="gaps" style="border-color:rgba(168,85,247,0.15)">';
      h += '<div class="dcb-panel-title"><span style="color:#a855f7">ONTOLOGY GAP \u00b7 ' + unmappedConditions.length + ' DRAFT DIAGNOSES</span></div>';
      h += '<div class="dcb-panel-body">';
      h += '<div style="font-size:0.30rem;color:rgba(168,85,247,0.5);line-height:1.5;margin-bottom:6px">Active conditions with no matching diagnosis pathway. Each draft below proposes a new diagnosis for portal expansion.</div>';
      for (var gi = 0; gi < unmappedConditions.length; gi++) {
        var gap = unmappedConditions[gi];
        var gapLabel = gap.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        // Find candidate nodes — nodes whose diagnosticTriggers might relate
        var candNodes = [];
        for (var cni = 0; cni < nodes.length; cni++) {
          var cn = nodes[cni];
          if (cn.diagnosticTriggers) {
            for (var dti = 0; dti < cn.diagnosticTriggers.length; dti++) {
              if (cn.diagnosticTriggers[dti].toLowerCase().indexOf(gap.replace(/_/g, ' ').toLowerCase()) !== -1 ||
                  gap.toLowerCase().indexOf(cn.group || '###') !== -1) {
                candNodes.push(cn); break;
              }
            }
          }
        }
        // Candidate treatments from those nodes
        var candTreats = [];
        for (var ctni = 0; ctni < candNodes.length; ctni++) {
          var cnt = candNodes[ctni].treatments || [];
          for (var ctti = 0; ctti < cnt.length; ctti++) { candTreats.push(cnt[ctti].label); }
        }
        // Related domains
        var relDomains = ['infrastructure', 'finance', 'supplyChain'];
        if (gap.indexOf('grid') !== -1 || gap.indexOf('infrastructure') !== -1) relDomains = ['infrastructure', 'technology', 'industry'];
        if (gap.indexOf('macro') !== -1 || gap.indexOf('shock') !== -1) relDomains = ['finance', 'economy', 'governance'];

        h += '<div style="padding:6px 8px;margin-bottom:6px;background:rgba(168,85,247,0.04);border-left:3px solid rgba(168,85,247,0.3);border-radius:2px">';
        h += '<div style="font-size:0.32rem;color:#a855f7;letter-spacing:1px">' + esc(gapLabel) + '</div>';
        h += '<div style="font-size:0.26rem;color:#a09888;line-height:1.6;margin-top:4px">';
        h += '<b style="color:rgba(168,85,247,0.5)">TITLE:</b> ' + esc(gapLabel) + '<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">TRIGGER:</b> ' + esc(gap) + '<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">CANDIDATE NODES:</b> ' + (candNodes.length > 0 ? candNodes.map(function(n){return esc(n.brainNodeId+' ('+n.domainLabel+')');}).join(', ') : 'requires mapping — no node diagnosticTriggers matched') + '<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">CANDIDATE TREATMENTS:</b> ' + (candTreats.length > 0 ? candTreats.slice(0,4).map(esc).join(', ') : 'derive from node mapping once established') + '<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">RELATED DOMAINS:</b> ' + relDomains.join(', ') + '<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">PORTAL PLACEMENT:</b> ' + DOMAIN_KEY + ' \u2192 new subtree<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">GAP REASON:</b> condition is generated by normalizeSignals() but no entry in diagnosisIndex maps to it. Add trigger string to an existing diagnosis or create a new portal issue.<br>';
        h += '<b style="color:rgba(168,85,247,0.5)">CONFIDENCE:</b> LOW \u2014 single condition, no cross-validation yet';
        h += '</div>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // Enter Portal
    // \u2500\u2500 SELF-MODEL / METACOGNITION \u2014 rendered when the brain computes a cognition surface
    //    (predictive self-model + awareness/conscience/immune/intuition). Domain-agnostic.
    var cog = state.cognition || null;
    if (cog) {
      var cm = cog.model || {}, cpe = (cm.predictionError && cm.predictionError.total) || 0;
      var creg = (cm.regulation && cm.regulation.state) || '?';
      var caw = cog.awareness || {}, cim = cog.immune || {}, ccon = cog.conscience || {}, cint = cog.intuition || {};
      var regColor = (creg === 'surprised' || creg === 'overconfident') ? '#e0a437' : (creg === 'stale' || creg === 'flooding' || creg === 'starving') ? '#e85454' : '#5ab5a0';
      var tag = function (label, val, color) { return '<span style="background:rgba(120,140,220,0.09);border:1px solid rgba(120,140,220,0.22);border-radius:8px;padding:1px 7px;color:#aeb6d8">' + label + ' <b style="color:' + (color || '#cdd3ec') + '">' + val + '</b></span>'; };
      h += '<div class="dcb-panel" data-panel="cognition" style="border-color:rgba(120,140,220,0.2)">';
      h += '<div class="dcb-panel-title"><span>SELF-MODEL \u00B7 METACOGNITION</span><span class="dcb-meta">cycle ' + (cm.cycle || 0) + '</span></div>';
      if (caw.selfNarrative) h += '<div style="font-size:0.34rem;color:#d8d2c5;line-height:1.6;font-family:Georgia,serif;margin-bottom:8px">' + esc(caw.selfNarrative) + '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:0.30rem;margin-bottom:8px">';
      h += tag('regulation', esc(creg), regColor);
      h += tag('prediction-error', (Math.round(cpe * 100) / 100), cpe > 0.4 ? '#e0a437' : '#5ab5a0');
      h += tag('immune', esc(cim.immuneState || '?'), cim.immuneState === 'alert' ? '#e85454' : cim.immuneState === 'active' ? '#e0a437' : '#5ab5a0');
      if (typeof cm.predictedStress === 'number') h += tag('predicted-stress', Math.round(cm.predictedStress * 100) + '%');
      h += '</div>';
      var ard = ccon.artifactReadinessDecision || {};
      h += '<div style="font-size:0.29rem;color:#9a9080;line-height:1.5;margin-bottom:6px"><b style="color:#b0a898">Conscience:</b> patent/grant <b style="color:#e85454">blocked</b>, investment/research <b style="color:' + (ard.investmentReady ? '#5ab5a0' : '#9a9080') + '">' + (ard.investmentReady ? 'allowed-with-warning' : 'gated') + '</b>' + ((ccon.cautions && ccon.cautions.length) ? (' \u00B7 ' + ccon.cautions.length + ' caution(s)') : '') + '</div>';
      var hunches = cint.hunches || [];
      if (hunches.length) {
        h += '<div style="font-size:0.29rem;color:#9a9080;margin-bottom:3px"><b style="color:#b0a898">Intuition</b> <span style="color:#6a6458">(UNVERIFIED hunches \u2014 a lens, not a claim):</span></div>';
        for (var hci = 0; hci < Math.min(3, hunches.length); hci++) h += '<div style="font-size:0.28rem;color:#807868;line-height:1.45;margin-bottom:2px">\u00B7 ' + esc(hunches[hci].hunch) + ' <span style="color:#5a5448">(' + esc(hunches[hci].why || '') + ')</span></div>';
      }
      if ((cint.analogies || []).length) h += '<div style="font-size:0.27rem;color:#6a6458;margin-top:4px">analogies: ' + esc(cint.analogies.slice(0, 2).map(function (a) { return a.analogy; }).join('; ')) + '</div>';
      h += '</div>';
    }

    h += '<div class="dcb-panel" style="text-align:center;border:none;background:none">';
    h += '<a class="dcb-enter-portal" href="/portal?domain=' + DOMAIN + '">ENTER ' + DOMAIN_LABEL.toUpperCase() + ' PORTAL \u203A</a>';
    h += '</div>';

    h += '</div>'; // end center col

    // ════ RIGHT COLUMN ════
    h += '<div class="dcb-col">';

    // Cross-Domain Pressure — with explanations
    h += '<div class="dcb-panel" data-panel="crossdomain">';
    h += '<div class="dcb-panel-title"><span>CROSS-DOMAIN PRESSURE \u00b7 ' + _crossDomain.length + '</span></div>';
    h += '<div class="dcb-panel-body">';
    if (_crossDomain.length === 0) {
      // Guard: suppress isolation language if domain stress is high or outbound emissions exist
      var _hasEmissions = (state.crossDomainEmissions || []).length > 0;
      var _stressHigh = (state.stress || 0) >= 0.50;
      if (_hasEmissions || _stressHigh) {
        h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5">Cross-domain pressure data is being resolved. ' + DOMAIN_LABEL + ' is actively emitting outbound stress and may receive inbound coupling as connected domain data refreshes.</div>';
      } else {
        h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5">No significant external domain pressure detected. Connected domains are below stress transmission thresholds.</div>';
      }
    } else {
      var _topDomains = _crossDomain.slice(0, 3).map(function(x) { return (x.sourceDomain || '').toUpperCase(); }).join(', ');
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5;margin-bottom:6px">' + DOMAIN_LABEL + ' is receiving cross-domain pressure from ' + _crossDomain.length + ' connected domain' + (_crossDomain.length > 1 ? 's' : '') + '. Inbound stress is being transmitted through ' + _topDomains + '.</div>';
      for (var xi = 0; xi < _crossDomain.length; xi++) {
        var xd = _crossDomain[xi];
        var xStress = xd.magnitude || xd.stress || 0;
        var xType = (xd.signalType || 'sector_stress').replace(/_/g, ' ');
        h += '<div class="dcb-cross">';
        h += '<span><span class="dcb-cross-domain">' + esc(xd.sourceDomain || xd.patternId || '') + '</span>';
        h += '<span class="dcb-cross-type"> \u2192 ' + esc(xType) + '</span></span>';
        h += '<span style="color:' + stressColor(xStress) + ';white-space:nowrap">' + Math.round(xStress * 100) + '%</span>';
        h += '</div>';
      }
    }
    h += '</div></div>';

    // Outbound emissions
    var emissions = state.crossDomainEmissions || [];
    if (emissions.length > 0) {
      h += '<div class="dcb-panel" data-panel="emissions">';
      h += '<div class="dcb-panel-title"><span>' + DOMAIN_LABEL.toUpperCase() + ' OUTBOUND EMISSIONS \u00b7 ' + emissions.length + '</span></div>';
      h += '<div class="dcb-panel-body">';
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5;margin-bottom:6px">' + DOMAIN_LABEL + ' stress is propagating into ' + emissions.length + ' dependent domain' + (emissions.length > 1 ? 's' : '') + '. Downstream systems should anticipate cost transmission and operational disruption proportional to emission magnitude.</div>';
      for (var ei = 0; ei < emissions.length; ei++) {
        var em = emissions[ei];
        h += '<div class="dcb-cross">';
        h += '<span><span style="color:rgba(201,169,78,0.5)">' + DOMAIN_LABEL.toUpperCase() + '</span>';
        h += '<span class="dcb-cross-type"> \u2192 ' + esc((em.targetDomain || '').replace(/_/g, ' ')) + ' \u00b7 ' + esc((em.signal || em.signalType || '').replace(/_/g, ' ')) + '</span></span>';
        h += '<span style="color:' + stressColor(em.magnitude || 0) + ';white-space:nowrap">' + Math.round((em.magnitude || 0) * 100) + '%</span>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // ═══ PRIORITIZED OPPORTUNITY DECISION SURFACE ═══

    // Score and classify opportunities
    var scored = [];
    for (var oi = 0; oi < opportunities.length; oi++) {
      var opp = opportunities[oi];
      // Composite score: rank (0-1) + urgency bonus + tier bonus + cross-domain bonus
      var score = opp.rank || 0;
      if (opp.urgency === 'IMMEDIATE') score += 0.15;
      if (opp.tier === 1) score += 0.10;
      else if (opp.tier === 2) score += 0.03;
      if (opp.source === 'convergence') score += 0.12;
      if (opp.source === 'company_terminal') score += 0.08;
      // Cross-domain signal strength bonus
      if (opp.source === 'cross_domain') score += 0.05;
      score = Math.min(score, 1.5);

      // Invalidation condition
      var invalidation = '';
      if (opp.source === 'diagnosis') invalidation = (opp.diagnosisId || '').replace(/_/g, ' ') + ' deactivates or stress < 30%';
      else if (opp.source === 'company_terminal') invalidation = 'terminal companies recover to P4+ or are delisted';
      else if (opp.source === 'convergence') invalidation = 'convergence signal dissipates';
      else if (opp.source === 'cross_domain') invalidation = 'source domain stress normalizes below emission threshold';
      else if (opp.source === 'lagging') invalidation = 'policy/market response absorbs the pressure';
      else if (opp.source === 'near_diagnosis') invalidation = 'partial triggers fail to materialize into full diagnosis';
      else invalidation = 'underlying conditions resolve';

      scored.push({ o: opp, score: score, invalidation: invalidation });
    }
    scored.sort(function (a, b) { return b.score - a.score; });

    // Classify into tiers
    var primary = [], secondary = [], conditional = [], watch = [];
    for (var si2 = 0; si2 < scored.length; si2++) {
      var s = scored[si2];
      if (si2 < 3 && s.score >= 0.5) primary.push(s);
      else if (s.o.urgency === 'WATCH' || s.o.source === 'near_diagnosis') watch.push(s);
      else if (s.o.source === 'lagging' || s.o.tier === 3) conditional.push(s);
      else secondary.push(s);
    }

    var __authOpportunities = classifyPanelAuthority('opportunities', _brainRef, state, __dcbPanelCtx);
    h += '<div class="dcb-panel' + (opportunities.length > 0 ? ' dcb-live' : '') + '" data-panel="opportunities">';
    h += '<div class="dcb-panel-title"><span>DECISION SURFACE \u00b7 ' + opportunities.length + ' OPPORTUNITIES</span></div>';
    h += '<div class="dcb-panel-body">';
    if (__authOpportunities.suppressBody) {
      h += renderSuppressedPanelBody(__authOpportunities);
    } else {
      h += renderPanelAuthorityBadge(__authOpportunities);

    if (opportunities.length === 0) {
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5">';
      if (activeDx.length === 0) h += 'No opportunities active. Pipeline requires diagnosis activation, terminal-phase detection, or convergence triggers.';
      else h += 'Diagnoses active but no opportunities cleared confidence threshold. Stress pattern may be too early-stage.';
      h += '</div>';
    } else {
      // Render function for opportunity card
      function renderOppCard(s, isPrimary) {
        var o = s.o;
        var border = isPrimary ? 'border-left:2px solid rgba(201,169,78,0.4);padding-left:8px;' : '';
        var rh = '<div class="dcb-opp" style="' + border + '">';
        rh += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">';
        if (isPrimary) rh += '<span style="font-size:0.22rem;letter-spacing:2px;color:#C9A94E;margin-right:2px">\u2605</span>';
        rh += '<span class="dcb-opp-title">' + esc(o.title) + '</span>';
        if (o.path) rh += '<span class="dcb-opp-path" style="' + pathColor(o.path) + '">' + esc(o.path) + '</span>';
        if (o.urgency) rh += '<span style="font-size:0.22rem;letter-spacing:1px;color:' + (o.urgency === 'IMMEDIATE' ? '#e85454' : o.urgency === 'WATCH' ? '#807868' : '#9a9080') + '">' + esc(o.urgency) + '</span>';
        rh += '</div>';
        // Causal + invalidation
        rh += '<div style="font-size:0.26rem;color:#908878;line-height:1.4;margin-top:2px">';
        if (o.source === 'diagnosis' && o.diagnosisId) rh += esc(o.diagnosisId.replace(/_/g, ' ')) + ' \u00b7 ';
        else if (o.source === 'company_terminal' && o.companies) rh += 'terminal: ' + esc(o.companies.join(', ')) + ' \u00b7 ';
        else if (o.source === 'cross_domain') rh += 'cross-domain \u00b7 ';
        else if (o.source === 'lagging') rh += 'system response \u00b7 ';
        else if (o.source === 'near_diagnosis') rh += 'early signal \u00b7 ';
        rh += 'score ' + s.score.toFixed(2) + ' \u00b7 T' + (o.tier || '?');
        rh += '</div>';
        rh += '<div style="font-size:0.24rem;color:#807868;margin-top:1px">INVALID IF: ' + esc(s.invalidation) + '</div>';
        rh += '</div>';
        return rh;
      }

      // PRIMARY ACTIONS
      if (primary.length > 0) {
        h += '<div style="font-size:0.26rem;letter-spacing:2.5px;color:rgba(201,169,78,0.5);margin-bottom:4px">\u2605 PRIMARY ACTIONS</div>';
        for (var pi2 = 0; pi2 < primary.length; pi2++) h += renderOppCard(primary[pi2], true);
      }

      // SUPPORTING PLAYS
      if (secondary.length > 0) {
        h += '<div style="font-size:0.26rem;letter-spacing:2.5px;color:#9a9080;margin:8px 0 4px">SUPPORTING PLAYS</div>';
        for (var si3 = 0; si3 < secondary.length; si3++) h += renderOppCard(secondary[si3], false);
      }

      // CONDITIONAL
      if (conditional.length > 0) {
        h += '<div style="font-size:0.26rem;letter-spacing:2.5px;color:#807868;margin:8px 0 4px">CONDITIONAL</div>';
        for (var ci2 = 0; ci2 < conditional.length; ci2++) h += renderOppCard(conditional[ci2], false);
      }

      // WATCH
      if (watch.length > 0) {
        h += '<div style="font-size:0.26rem;letter-spacing:2.5px;color:#706860;margin:8px 0 4px">WATCH</div>';
        for (var wi = 0; wi < watch.length; wi++) h += renderOppCard(watch[wi], false);
      }

      // Only 15 domains ship a dedicated {domain}-opportunities.html; the other 5
      // (defense, economy, governance, industry, law) have none -> the link 404'd.
      // Emit the dedicated page when it exists, else fall back to the global one.
      var _OPP_PAGES = { agriculture:1, communication:1, culture:1, education:1, energy:1, environment:1, finance:1, infrastructure:1, intelligence:1, medicine:1, population:1, religion:1, science:1, technology:1, trade:1 };
      var _oppHref = _OPP_PAGES[DOMAIN] ? ('/' + DOMAIN + '-opportunities') : ('/opportunities?domain=' + encodeURIComponent(DOMAIN));
      h += '<div style="margin-top:6px"><a href="' + _oppHref + '" style="font-size:0.3rem;color:rgba(201,169,78,0.4);text-decoration:none;letter-spacing:2px">VIEW ALL OPPORTUNITIES \u2192</a></div>';
    }
    }
    h += '</div></div>';

    // Companies — with phase explanation
    h += '<div class="dcb-panel" data-panel="companies">';
    h += '<div class="dcb-panel-title"><span>COMPANIES \u00b7 ' + _companies.length + '</span></div>';
    h += '<div class="dcb-panel-body">';
    if (_companies.length === 0) {
      h += '<div class="dcb-empty">Loading company data\u2026</div>';
    } else {
      var sorted = _companies.slice().sort(function (a, b) { return (b.ds || 0) - (a.ds || 0); });
      var termCount = sorted.filter(function (c) { return c.p === 'p7a' || c.p === 'p9'; }).length;
      var highStressCount = sorted.filter(function (c) { return (c.ds || 0) >= 0.7; }).length;
      // Derived narrative
      h += '<div style="font-size:0.30rem;color:#9a9080;line-height:1.5;margin-bottom:6px">';
      h += sorted.length + ' companies tracked in ' + DOMAIN_LABEL + ' domain. ';
      if (termCount > 0) h += termCount + ' in terminal/collapse phase (P7a/P9) \u2014 structural distress confirmed. ';
      if (highStressCount > 0) h += highStressCount + ' operating under \u226570% domain stress.';
      h += '</div>';
      for (var ci = 0; ci < sorted.length; ci++) {
        var co = sorted[ci];
        var coPhase = co.p || 'p0';
        var coStress = co.ds || 0;
        h += '<div class="dcb-company">';
        h += '<span class="dcb-company-name">' + esc(co.t || co.ticker || '') + ' <span style="color:#807868">' + esc((co.n || co.name || '').substring(0, 25)) + '</span></span>';
        h += '<span style="white-space:nowrap"><span class="dcb-company-phase" style="color:' + phaseColor(coPhase) + '">' + coPhase.toUpperCase() + '</span>';
        h += ' <span style="font-size:0.28rem;color:' + stressColor(coStress) + '">' + Math.round(coStress * 100) + '%</span></span>';
        h += '</div>';
      }
      h += '<div style="margin-top:4px"><a href="/' + DOMAIN + '-command" style="font-size:0.3rem;color:rgba(201,169,78,0.4);text-decoration:none;letter-spacing:2px">VIEW ALL IN COMMAND BOARD \u2192</a></div>';
    }
    h += '</div></div>';

    // Debug Trace
    h += '<div class="dcb-panel" data-panel="debug" style="border-color:rgba(74,143,212,0.15)">';
    h += '<div class="dcb-panel-title"><span style="color:rgba(74,143,212,0.35)">PIPELINE TRACE</span></div>';
    h += '<div class="dcb-panel-body">';
    var brainStatus = state.status || 'UNKNOWN';
    var brainLive = brainStatus === 'RUNNING';
    var domEngineLive = !!(window.LIMENDomainEngine);
    var domEngineStarted = !!(window.LIMENDebug && window.LIMENDebug.loadedModules && window.LIMENDebug.loadedModules.indexOf('domain-signal-engine') !== -1);
    var domData = window.LIMENDomains && window.LIMENDomains[DOMAIN_KEY];
    var domStatus = domData ? (domData.status || 'unknown') : 'NOT LOADED';
    var domCadence = domData ? (domData.cadence || '?') : 'N/A';
    var feedsLive = liveFeeds.length;
    var feedsTotal = feeds.length;
    var lastUpdate = state.updated ? new Date(state.updated).toLocaleTimeString() : 'never';
    var lines = [
      ['DOMAIN ENGINE', domEngineLive ? (domEngineStarted ? 'STARTED' : 'LOADED') : 'MISSING', domEngineStarted ? '#5ab5a0' : '#e85454'],
      ['BRAIN STATUS', brainStatus, brainLive ? '#5ab5a0' : '#e85454'],
      ['DOMAIN DATA', domStatus, domStatus === 'live' ? '#5ab5a0' : domStatus === 'FALLBACK' ? '#e85454' : '#C9A94E'],
      ['CADENCE', domCadence, '#C9A94E'],
      ['FEEDS', feedsLive + '/' + feedsTotal + ' live', feedsLive > 0 ? '#5ab5a0' : '#e85454'],
      ['SIGNALS', signals.length + ' extracted', signals.length > 0 ? '#5ab5a0' : '#C9A94E'],
      ['CONDITIONS', _activeConditions.length + ' active', _activeConditions.length > 0 ? '#5ab5a0' : 'rgba(200,195,184,0.3)'],
      ['DIAGNOSES', activeDx.length + '/' + diagnoses.length + ' active', activeDx.length > 0 ? '#e85454' : '#5ab5a0'],
      ['TREATMENTS', treatments.length + ' queued', treatments.length > 0 ? '#5ab5a0' : 'rgba(200,195,184,0.3)'],
      ['OPPORTUNITIES', opportunities.length + ' surfaced', opportunities.length > 0 ? '#5ab5a0' : 'rgba(200,195,184,0.3)'],
      ['COMPANIES', _companies.length + ' tracked', _companies.length > 0 ? '#5ab5a0' : '#C9A94E'],
      ['PORTAL DATA', _portalData ? (nodes.length + ' nodes') : 'NOT LOADED', _portalData ? '#5ab5a0' : '#e85454'],
      ['CROSS-DOMAIN', _crossDomain.length + ' sources', _crossDomain.length > 0 ? '#C9A94E' : 'rgba(200,195,184,0.3)'],
      ['GAPS', unmappedConditions.length + ' unmapped', unmappedConditions.length > 0 ? '#a855f7' : '#5ab5a0'],
      ['LAST UPDATE', lastUpdate, '#C9A94E'],
      ['FRESH FETCH', _freshness.lastFetch ? new Date(_freshness.lastFetch).toLocaleTimeString() : 'never', _freshness.fetchOk ? '#5ab5a0' : '#e85454'],
      ['FETCH STATUS', _freshness.status, freshColor],
      ['SNAPSHOT AGE', ageStr || 'unknown', _freshness.snapshotAge != null && _freshness.snapshotAge < 300000 ? '#5ab5a0' : '#C9A94E'],
      ['STRESS SOURCE', _freshness.fetchOk ? 'DIRECT /api/domain-snapshot' : (domData ? 'CACHED ENGINE' : 'NONE'), _freshness.fetchOk ? '#5ab5a0' : '#e85454']
    ];
    for (var dbi = 0; dbi < lines.length; dbi++) {
      h += '<div style="font-size:0.26rem;display:flex;justify-content:space-between;padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.01)">';
      h += '<span style="color:#807868;letter-spacing:1px">' + lines[dbi][0] + '</span>';
      h += '<span style="color:' + lines[dbi][2] + '">' + esc(lines[dbi][1]) + '</span>';
      h += '</div>';
    }
    // Startup errors
    if (window.LIMENDebug && window.LIMENDebug.startupErrors && window.LIMENDebug.startupErrors.length > 0) {
      h += '<div style="font-size:0.24rem;color:#e85454;margin-top:4px">' + window.LIMENDebug.startupErrors.length + ' STARTUP ERRORS:</div>';
      for (var sei = 0; sei < window.LIMENDebug.startupErrors.length; sei++) {
        h += '<div style="font-size:0.22rem;color:rgba(232,84,84,0.4)">' + esc(window.LIMENDebug.startupErrors[sei].module) + '</div>';
      }
    }
    h += '</div></div>';

    h += '</div>'; // end right col

    // Freshness proof bar
    var now = new Date();
    var timeStr = now.toLocaleTimeString();
    var freshStatus = _freshness.status || 'INIT';
    var freshColor = freshStatus === 'LIVE' ? '#5ab5a0' : freshStatus === 'DEGRADED' ? '#C9A94E' : '#e85454';
    var ageStr = '';
    if (_freshness.snapshotAge != null) {
      var ageSec = Math.round(_freshness.snapshotAge / 1000);
      ageStr = ageSec < 60 ? ageSec + 's ago' : Math.round(ageSec / 60) + 'm ago';
    }
    h += '<div id="dcb-timestamp">';
    h += (freshStatus === 'LIVE' ? '<span class="live-dot"></span>' : '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:' + freshColor + ';margin-right:4px;vertical-align:middle"></span>');
    h += '<span style="color:' + freshColor + '">' + freshStatus + '</span>';
    h += ' \u00b7 FETCHED ' + timeStr;
    if (ageStr) h += ' \u00b7 SNAPSHOT ' + ageStr;
    h += ' \u00b7 CADENCE 3m snapshot / 60s page';
    h += ' \u00b7 ' + signals.length + ' signals \u00b7 ' + activeDx.length + ' dx';
    if (unmappedConditions.length > 0) h += ' \u00b7 <span style="color:#a855f7">' + unmappedConditions.length + ' gaps</span>';
    h += '</div>';

    h += '</div>'; // end dcb-root

    // ── Skip the rebuild when nothing actually changed (anti-flicker) ──
    // render() fires every 30s brain / 60s page / signal cycle, but the only
    // thing that changes most cycles is the live timestamp ("FETCHED 3s ago").
    // Blowing away cv.innerHTML every cycle makes the DIAGNOSIS CHAIN and
    // REGULATION PLAYBOOK panels flicker/redraw even when their content is
    // identical. So we compare everything EXCEPT the volatile timestamp; if
    // the substantive markup is unchanged, we update ONLY the timestamp text
    // in place and return — no panel repaint, listeners/scroll/collapse all
    // left intact.
    var _stable = h.replace(/<div id="dcb-timestamp">[\s\S]*?<\/div>/, '<div id="dcb-timestamp"></div>');
    if (_stable === _lastStableHtml && cv.querySelector('#dcb-root')) {
      var _tsEl = document.getElementById('dcb-timestamp');
      var _tsMatch = h.match(/<div id="dcb-timestamp">([\s\S]*?)<\/div>/);
      if (_tsEl && _tsMatch) _tsEl.innerHTML = _tsMatch[1];
      return; // content unchanged — no rebuild, no flicker
    }
    _lastStableHtml = _stable;

    // Preserve per-panel scroll position across the re-render. Each
    // .dcb-panel-body is its own overflow-y:auto scroll container, so the
    // innerHTML swap below would otherwise reset every panel to the top on
    // each 30s brain / 60s page / signal-engine cycle — making it impossible
    // to read through long panels (DIAGNOSIS CHAIN, REGULATION PLAYBOOK).
    // Mirrors the _collapsedPanels persistence pattern; keyed by data-panel.
    var _prevPanels = cv.querySelectorAll('.dcb-panel[data-panel]');
    for (var _sp = 0; _sp < _prevPanels.length; _sp++) {
      var _spKey = _prevPanels[_sp].getAttribute('data-panel');
      var _spBody = _prevPanels[_sp].querySelector('.dcb-panel-body');
      if (_spKey && _spBody && _spBody.scrollTop > 0) {
        _panelScroll[_spKey] = _spBody.scrollTop;
      } else if (_spKey) {
        delete _panelScroll[_spKey];
      }
    }

    cv.innerHTML = h;

    // removed: BLE HR strap connect wiring (biosensor UI off-site)

    // Default all panels to collapsed on first load; restore user toggle state
    var panels = cv.querySelectorAll('.dcb-panel[data-panel]');
    for (var pi = 0; pi < panels.length; pi++) {
      var key = panels[pi].getAttribute('data-panel');
      // If user has explicitly expanded, keep open; otherwise default collapsed
      if (_collapsedPanels[key] === false) {
        panels[pi].classList.remove('collapsed');
      } else {
        panels[pi].classList.add('collapsed');
      }
      // Restore the panel-body scroll position captured before this render
      // so a refresh cycle no longer yanks the reader back to the top.
      if (_panelScroll[key] != null) {
        var _rb = panels[pi].querySelector('.dcb-panel-body');
        if (_rb) _rb.scrollTop = _panelScroll[key];
      }
    }
  }

  // Collapsed state persists across re-renders (true=collapsed, false=expanded)
  var _collapsedPanels = {};

  // Per-panel scroll position persists across re-renders (data-panel -> scrollTop),
  // so the 30s/60s refresh cycles don't reset scroll while the operator reads.
  var _panelScroll = {};

  // Signature of the last substantive render (timestamp excluded). When the
  // next render matches it, we skip the innerHTML rebuild to avoid flicker.
  var _lastStableHtml = null;

  // Delegate click on panel titles to toggle collapse
  document.addEventListener('click', function (e) {
    var title = e.target.closest('.dcb-panel-title');
    if (!title) return;
    var panel = title.closest('.dcb-panel[data-panel]');
    if (!panel) return;
    panel.classList.toggle('collapsed');
    var key = panel.getAttribute('data-panel');
    _collapsedPanels[key] = panel.classList.contains('collapsed');
  });

  // ══════════════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════════════

  function boot() {
    console.log('[DCB] boot() called');
    _clarityView = document.getElementById('clarity-view');
    if (!_clarityView) {
      console.error('[DCB] #clarity-view NOT FOUND');
      return;
    }
    console.log('[DCB] clarity-view found, display:', _clarityView.style.display, 'size:', _clarityView.offsetWidth + 'x' + _clarityView.offsetHeight);

    // Mark grid as brain-active to hide underlying columns
    var grid = document.getElementById('console-grid');
    if (grid) grid.classList.add('dcb-active');

    // Ensure clarity-view is visible
    _clarityView.style.display = '';

    // ── ANALYST / CLARITY TOGGLE ──
    // Domains with their own operator surface (Console/Operator toggle) skip this.
    // The operator surface replaces the legacy Analyst/Clarity toggle.
    var _domainsWithOperator = ['energy', 'agriculture', 'supplyChain', 'trade', 'infrastructure'];
    var _isAnalyst = false;
    var headerRight = document.querySelector('.ch-right');
    if (headerRight && _domainsWithOperator.indexOf(DOMAIN) === -1) {
      var toggleBtn = document.createElement('button');
      toggleBtn.id = 'clarity-analyst-toggle';
      toggleBtn.textContent = 'ANALYST';
      toggleBtn.title = 'Toggle analyst grid view';
      toggleBtn.style.cssText = 'font-family:monospace;font-size:0.38rem;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer;transition:all 0.2s';
      toggleBtn.addEventListener('mouseenter', function(){ this.style.borderColor='rgba(201,169,78,0.25)';this.style.color='rgba(201,169,78,0.6)'; });
      toggleBtn.addEventListener('mouseleave', function(){ if(!_isAnalyst){this.style.borderColor='rgba(201,169,78,0.12)';this.style.color='rgba(200,195,184,0.35)';}else{this.style.borderColor='rgba(201,169,78,0.3)';this.style.color='#C9A94E';} });
      toggleBtn.addEventListener('click', function () {
        _isAnalyst = !_isAnalyst;
        if (_isAnalyst) {
          _clarityView.style.display = 'none';
          ['col-left','col-center','col-right'].forEach(function(id){ var el=document.getElementById(id); if(el)el.style.display=''; });
          if(grid) grid.classList.remove('dcb-active');
          toggleBtn.textContent = 'CLARITY';
          toggleBtn.style.color = '#C9A94E';
          toggleBtn.style.borderColor = 'rgba(201,169,78,0.3)';
        } else {
          ['col-left','col-center','col-right'].forEach(function(id){ var el=document.getElementById(id); if(el)el.style.display='none'; });
          if(grid) grid.classList.add('dcb-active');
          _clarityView.style.display = '';
          render();
          toggleBtn.textContent = 'ANALYST';
          toggleBtn.style.color = 'rgba(200,195,184,0.35)';
          toggleBtn.style.borderColor = 'rgba(201,169,78,0.12)';
        }
      });
      headerRight.insertBefore(toggleBtn, headerRight.firstChild);
    }

    // Show loading state immediately
    _clarityView.innerHTML = '<div style="padding:20px;text-align:center;color:#807868;font-size:0.4rem;letter-spacing:2px">' +
      DOMAIN_LABEL.toUpperCase() + ' BRAIN INITIALIZING\u2026</div>';

    // Fetch supplementary data (changelog, companies, portal) then render
    fetchAllData().then(function () {
      console.log('[DCB] fetchAllData complete, calling render. State:', getBrainState() ? 'EXISTS' : 'NULL', 'portal:', !!_portalData, 'companies:', _companies.length);
      render();
      _booted = true;
      console.log('[DCB] booted. clarity-view children:', _clarityView.childNodes.length);
    });

    // Subscribe to shared refresh controller (single source of truth)
    document.addEventListener('limen:' + DOMAIN + '-refresh', function () {
      if (_booted) {
        // Re-fetch supplementary data and re-render with fresh shared state
        fetchAllData().then(render);
      }
    });

    // Also listen for domain-update from signal engine
    document.addEventListener('limen:domain-update', function () {
      if (_booted) render();
    });

    // Listen for brain cycle completion — ensures emissions/treatments
    // from the brain's 30s cycle trigger a re-render without waiting
    // for the 60s refresh controller cycle.
    // Note: no _booted guard — brain may complete first cycle before
    // fetchAllData resolves. If so, we must still re-render.
    window.addEventListener('limen:domain-brain-update', function (e) {
      if (e.detail && e.detail.domainId === DOMAIN_KEY) {
        if (_booted) {
          render();
        } else {
          // Brain finished before boot — schedule render after boot completes
          var _waitBoot = setInterval(function () {
            if (_booted) { clearInterval(_waitBoot); render(); }
          }, 200);
        }
      }
    });

    // Console-clarity is blocked from starting (see blockClarity() above).
    // No intercept or MutationObserver needed — brain owns #clarity-view exclusively.
  }

  // Boot immediately once DOM is ready — no delay.
  // Column hiding is handled by static CSS (.dcb-active) applied in domain-console.html.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(boot); });
  } else {
    requestAnimationFrame(boot);
  }

})();
