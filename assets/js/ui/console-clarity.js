/**
 * console-clarity.js
 * LIMEN HELIX — Cognitive Clarity Layer
 *
 * Replaces the default simultaneous-panel dump with a focused, prioritized view.
 * The user should understand system state in under 5 seconds.
 *
 * Default view (Clarity Mode):
 *   1. HERO — global state, confidence, primary driver, Philemon narration
 *   2. DOMAIN HEALTH — stress bars for all 7 domains
 *   3. TOP EVENTS — 3 highest priority escalation items
 *   4. RECOMMENDED ACTIONS — prioritized treatments from registry
 *   5. TABS — deeper analysis on demand (hidden until selected)
 *
 * Analyst Mode reveals the full 3-column panel grid, export/debug tools.
 *
 * Exposes: window.LIMENClarity
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════════════

  var DOMAIN_LABELS = {
    economy: 'Economy', energy: 'Energy', environment: 'Environment',
    health: 'Health', technology: 'Technology', research: 'Research',
    supplyChain: 'Supply Chain', governance: 'Governance',
    infrastructure: 'Infrastructure', agriculture: 'Agriculture',
    industry: 'Industry', education: 'Education',
    communication: 'Communication', culture: 'Culture',
    defense: 'Defense', religion: 'Religion',
    population: 'Population', law: 'Law',
    finance: 'Finance', intelligence: 'Intelligence'
  };

  var DOMAIN_ORDER = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var STATE_COLORS = {
    stable: '#5ab5a0', pressured: '#FF9800', fragmented: '#e85454',
    escalating: '#e85454', adaptive: '#4a8fd4', recovering: '#5ab5a0'
  };

  // Philemon removed — hero status lines kept as system status
  var SYSTEM_STATUS = {
    stable: 'All domains within baseline. No elevated stress detected.',
    pressured: 'Multiple domains above baseline. Monitor for sustained elevation.',
    fragmented: 'Domain signals are divergent. Stress pattern is inconsistent.',
    escalating: 'Concurrent domain elevation detected. Cross-domain review recommended.',
    adaptive: 'Stress levels shifting. Trend direction not yet stable.',
    recovering: 'Stress declining across domains. Trend toward baseline.',
    noData: 'Waiting for feed data.'
  };

  var TABS = [
    { id: 'evidence',        label: 'Source Audit' },
    { id: 'regulation',      label: 'Regulation' },
    { id: 'patent',          label: 'Capital Conversion' }
    // 'council' (Artifact Council) retired 2026-06-28 — patent/NSF-only + unfed + AI-cost.
    // Engine/render code kept below; re-add this entry to relane it to investment/research.
  ];

  // Brain diagnosis hold-last-nonempty cache — prevents section flap on transient inactive cycles
  var _BD_CACHE_TTL = 90000; // 90 seconds
  var _brainDxCache = {}; // { domainKey: { activeDx: [...], capturedAt: number } }

  // Persisted expand/collapse state for per-domain brain sections
  var _brainSectionExpanded = {}; // { domainKey: boolean }
  var _brainSectionDelegated = false; // one-time event delegation flag

  // Domain Health per-tile drilldown state (Phase 2 step 1 — Domain Panel merge)
  var _domainHealthExpanded = {}; // { domainKey: boolean } — session-only, default collapsed
  var _domainHealthDelegated = false; // one-time click delegation on _domainsEl

  var EMPTY_STATUS = {
    civilization: 'No civilization report available. Report generation may be pending.',
    patent: 'No capital conversion candidates surfaced. Awaiting brain emissions, report signals, registry gaps, or macro shocks.',
    evidence: 'No evidence chain available. Requires a completed report cycle.',
    regulation: 'No regulation data loaded. Waiting for domain feeds.',
    council: 'Select a lane and packet, then run the council. No history is retained. Master Brain queue write is not wired in this MVP.'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  var _container = null;
  var _activeTab = null;
  var _isAnalystMode = false;
  var _started = false;
  var _refreshTimer = null;

  // Cached section elements for targeted refresh
  var _heroEl = null;
  var _domainsEl = null;
  var _eventsEl = null;
  var _actionsEl = null;
  var _handoffEl = null;             // Master Brain Handoff Queue card (Patch B)
  var _tabBarEl = null;
  var _tabContentEl = null;

  // ── ARTIFACT-UI-0: Artifact Council state ───────────────────────────
  // In-memory only. No persistence. No localStorage. Cleared on page load.
  // Master Brain queue write is NOT wired in this MVP.
  var _councilState = {
    lane:    'patents',
    packetId:null,
    packet:  null,
    stage:   'idle',                  // idle|building|expanding|critiquing|done|error
    stages: {
      build:    { status: 'idle', error: null, startedAt: null, completedAt: null },
      expand:   { status: 'idle', error: null, startedAt: null, completedAt: null },
      critique: { status: 'idle', error: null, startedAt: null, completedAt: null },
      ledger:   { status: 'idle', error: null, startedAt: null, completedAt: null }
    },
    draft:           null,
    critique:        null,
    objectionLedger: null,
    raw: { expandResponse: null, critiqueResponse: null },
    activePane: 'draft',              // 'draft'|'critique'|'ledger'
    reviewedAt: null,
    // MB-B bridge marker — set when operator clicks "Send to Main Brain
    // intake". Carries the assigned intake id and the timestamp at write.
    // Setting this ONLY records that an intake JSON was written into the
    // same-origin sessionStorage queue. It does NOT mean the item was
    // submitted, executed, validated, approved, or routed externally.
    bridgedAt: null,
    bridgeIntakeId: null
  };

  // Master Brain Handoff Queue — per-lane expand state and one-time
  // event-listener guard. Reads window.LIMENMainBrainHandoff which is
  // populated by assets/js/civilization/handoff-contract.js (Step 1).
  var _handoffExpandedLanes = {};    // { lane: boolean }
  var _handoffEventBound = false;    // ensure addEventListener fires once
  var HANDOFF_LANE_LABELS = {
    'patents':         'Patents',
    'copyrights':      'Copyrights',
    'business-grants': 'Business Grants',
    'research-grants': 'Research Grants',
    'sba-loans':       'SBA Loans',
    'franchise':       'Franchise',
    'investments':     'Investments',
    'research-papers': 'Research Papers'
  };

  // Singular form for manager-readable packet titles like
  // "Patent candidate — Education + Energy". Plural form above is used
  // for lane chip headers.
  var HANDOFF_LANE_LABELS_SINGULAR = {
    'patents':         'Patent',
    'copyrights':      'Copyright',
    'business-grants': 'Business Grant',
    'research-grants': 'Research Grant',
    'sba-loans':       'SBA Loan',
    'franchise':       'Franchise',
    'investments':     'Investment',
    'research-papers': 'Research Paper'
  };

  // Lane purpose explanations shown only when a lane is expanded.
  // Static text — does not invent meaning beyond what the lane name implies.
  var HANDOFF_LANE_DESCRIPTIONS = {
    'patents':         'Potential invention/IP filings from cross-domain patterns.',
    'copyrights':      'Protectable content, frameworks, training material, or authored assets.',
    'business-grants': 'Commercial or public-private funding packets.',
    'research-grants': 'Research funding packets tied to evidence, science, or policy questions.',
    'sba-loans':       'Small-business financing candidates; requires business/operator packet.',
    'franchise':       'Replicable business-model candidates.',
    'investments':     'Investment memo candidates; requires risk and source validation.',
    'research-papers': 'Paper/article candidates from evidence-backed cross-domain findings.'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════════════════════

  function _injectStyles() {
    if (document.getElementById('limen-clarity-css')) return;
    var s = document.createElement('style');
    s.id = 'limen-clarity-css';
    s.textContent = [
      '#clarity-view { padding:12px 24px 60px; overflow-y:auto; min-height:0; font-family:"IBM Plex Mono",monospace; color:#d0cec8; }',
      '@media(max-width:600px) { #clarity-view { padding:8px 12px 60px; } }',

      /* Executive strip (Zone A) — compact state summary */
      '.clr-exec-strip { display:flex; align-items:center; gap:16px; flex-wrap:wrap;',
      '  padding:8px 16px; margin-bottom:10px; border-bottom:1px solid rgba(201,169,78,0.08);',
      '  font-size:0.5rem; letter-spacing:1.2px; }',
      '.clr-exec-state { font-size:0.7rem; letter-spacing:3px; text-transform:uppercase; font-weight:bold; }',
      '.clr-exec-meta { color:#888; font-size:0.48rem; letter-spacing:1px; }',
      '.clr-exec-signal { color:#bbb; font-size:0.48rem; flex:1; text-align:right;',
      '  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',

      /* Command center zone (Zone B) */
      '.clr-command-zone { margin-bottom:16px; }',

      /* Evidence workspace zone (Zone C) — visually secondary */
      '.clr-evidence-zone { opacity:0.75; border-top:1px solid rgba(201,169,78,0.06);',
      '  padding-top:12px; margin-top:4px; }',
      '.clr-evidence-zone:hover { opacity:0.92; }',
      '.clr-evidence-label { font-size:0.4rem; letter-spacing:2.5px; text-transform:uppercase;',
      '  color:rgba(201,169,78,0.2); margin-bottom:8px; }',

      /* Legacy hero (kept for _fillHero compat but restyled as exec strip) */
      '.clr-hero { display:none; }',
      '.clr-hero-row, .clr-hero-state, .clr-hero-conf, .clr-hero-driver, .clr-hero-philemon { }',

      /* Domain health */
      '.clr-section { margin-bottom:12px; }',
      '.clr-section-title { font-size:0.5rem; letter-spacing:2.5px; text-transform:uppercase;',
      '  color:rgba(201,169,78,0.35); margin-bottom:6px; }',
      '.clr-domain-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; }',
      '@media(max-width:700px) { .clr-domain-grid { grid-template-columns:1fr; } }',
      '.clr-domain-row { display:flex; align-items:center; gap:8px; padding:3px 0; cursor:pointer; }',
      '.clr-domain-label { width:80px; font-size:0.52rem; letter-spacing:0.8px; color:#999; text-transform:uppercase; }',
      '.clr-domain-track { flex:1; height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; min-width:60px; }',
      '.clr-domain-fill { height:100%; border-radius:3px; transition:width 0.5s ease; }',
      '.clr-domain-val { width:36px; font-size:0.52rem; color:#999; text-align:right; }',
      '.clr-domain-trend { width:14px; font-size:0.55rem; text-align:center; }',

      /* Focus row */
      '.clr-focus-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }',
      '@media(max-width:700px) { .clr-focus-row { grid-template-columns:1fr; } }',
      '.clr-card { background:#0e1018; border:1px solid rgba(201,169,78,0.08); border-radius:4px; padding:12px 14px; }',
      '.clr-card-title { font-size:0.5rem; letter-spacing:2px; text-transform:uppercase;',
      '  color:rgba(201,169,78,0.4); margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(201,169,78,0.06); }',
      '.clr-event-item { display:flex; align-items:flex-start; gap:6px; padding:5px 0;',
      '  border-bottom:1px solid rgba(255,255,255,0.03); font-size:0.52rem; }',
      '.clr-event-item:last-child { border-bottom:none; }',
      '.clr-event-tier { flex-shrink:0; font-size:0.42rem; letter-spacing:1px; text-transform:uppercase;',
      '  padding:1px 5px; border-radius:2px; font-weight:bold; }',
      '.clr-tier-immediate { background:rgba(232,84,84,0.15); color:#e85454; }',
      '.clr-tier-developing { background:rgba(255,152,0,0.12); color:#FF9800; }',
      '.clr-tier-watch { background:rgba(90,181,160,0.1); color:#5ab5a0; }',
      /* Gate B #9C.1 — Civilization tab confidence authority badge */
      '.clr-civ-conf-badge { display:block; font-size:0.5rem; letter-spacing:1.5px;',
      '  text-transform:uppercase; padding:5px 9px; border-radius:2px;',
      '  margin:0 0 8px; font-weight:600; }',
      '.clr-civ-conf-badge.low { color:#e85454; background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.28); }',
      '.clr-civ-conf-badge.moderate { color:#FF9800; background:rgba(255,152,0,0.05);',
      '  border:1px solid rgba(255,152,0,0.28); }',
      '.clr-civ-conf-badge.unknown { color:#888; background:rgba(255,255,255,0.02);',
      '  border:1px solid rgba(200,195,184,0.18); }',
      '.clr-civ-conf-badge-reason { display:block; font-size:0.4rem;',
      '  color:rgba(200,195,184,0.55); letter-spacing:0.5px;',
      '  text-transform:none; font-weight:normal; margin-top:2px; }',
      /* Gate B #9C.2 — Regulation TOP 3 ACTIONS NOW per-action confidence badge */
      '.clr-action-conf-badge { display:inline-block; font-size:0.36rem;',
      '  letter-spacing:1px; text-transform:uppercase; padding:2px 6px;',
      '  border-radius:2px; margin:0 0 4px; font-weight:600; }',
      '.clr-action-conf-badge.low { color:#e85454; background:rgba(232,84,84,0.08);',
      '  border:1px solid rgba(232,84,84,0.30); }',
      '.clr-action-conf-badge.moderate { color:#FF9800; background:rgba(255,152,0,0.07);',
      '  border:1px solid rgba(255,152,0,0.30); }',
      '.clr-action-conf-badge.unknown { color:#888; background:rgba(255,255,255,0.03);',
      '  border:1px solid rgba(200,195,184,0.20); }',
      /* Gate B #9C.3 — Executive Strip + Domain Health authority */
      '.clr-exec-conf-badge { display:block; font-size:0.4rem; letter-spacing:1.5px;',
      '  text-transform:uppercase; padding:3px 8px; border-radius:2px;',
      '  margin:4px 0 0; font-weight:600; }',
      '.clr-exec-conf-badge.low { color:#e85454; background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.28); }',
      '.clr-exec-conf-badge.moderate { color:#FF9800; background:rgba(255,152,0,0.05);',
      '  border:1px solid rgba(255,152,0,0.28); }',
      '.clr-exec-conf-badge.unknown { color:#888; background:rgba(255,255,255,0.02);',
      '  border:1px solid rgba(200,195,184,0.18); }',
      '.clr-exec-suppress { padding:10px 14px; border:1px solid rgba(232,84,84,0.30);',
      '  background:rgba(232,84,84,0.05); border-radius:2px;',
      '  color:#e85454; font-size:0.5rem; letter-spacing:1.5px;',
      '  text-transform:uppercase; }',
      '.clr-exec-suppress small { display:block; margin-top:4px; font-size:0.36rem;',
      '  color:rgba(200,195,184,0.55); letter-spacing:0.5px; text-transform:none; }',
      '.clr-dh-tile-badge { display:block; font-size:0.32rem; letter-spacing:1px;',
      '  text-transform:uppercase; margin:0 0 3px; font-weight:600;',
      '  background:none; border:none; padding:0; }',
      '.clr-dh-tile-badge.low { color:#e85454; }',
      '.clr-dh-tile-badge.moderate { color:#FF9800; }',
      '.clr-dh-tile-badge.unknown { color:#888; }',
      '.clr-dh-tile-badge.fallback { color:#C9A94E; }',
      '.clr-dh-absent { padding:6px 8px; border-left:3px solid rgba(232,84,84,0.45);',
      '  background:rgba(0,0,0,0.10); opacity:0.7; }',
      '.clr-dh-absent-label { font-size:0.42rem; letter-spacing:1px; color:#c0b8a5; }',
      '.clr-dh-absent-banner { display:block; margin-top:2px; font-size:0.34rem;',
      '  letter-spacing:1.5px; color:#e85454; text-transform:uppercase; }',
      '.clr-dh-absent-reason { display:block; margin-top:1px; font-size:0.32rem;',
      '  color:rgba(200,195,184,0.45); }',
      /* Gate B #9C.4 Phase 1 — Capital Conversion action-verb demotion.
         Replaces the "DO NOW: {action}" headline with a hedged label and
         moves the original action text into a collapsed audit drawer.
         Mirrors the kernel-comparison #47 suppressed-classifier-output
         drawer style. */
      '.clr-cap-hedged-label { display:block; font-size:0.4rem; letter-spacing:1.5px;',
      '  text-transform:uppercase; padding:5px 8px; border-radius:2px;',
      '  margin:4px 0 4px; font-weight:600; }',
      '.clr-cap-hedged-label.candidate { color:#C9A94E; background:rgba(201,169,78,0.06);',
      '  border:1px solid rgba(201,169,78,0.30); border-left:3px solid rgba(201,169,78,0.55); }',
      '.clr-cap-hedged-label.unsupported { color:#e85454; background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.30); border-left:3px solid rgba(232,84,84,0.55); }',
      '.clr-cap-audit-drawer { margin-top:4px; padding:4px 8px;',
      '  border:1px dashed rgba(232,84,84,0.22); border-radius:2px;',
      '  background:rgba(0,0,0,0.10); }',
      '.clr-cap-audit-drawer > summary { cursor:pointer; font-size:0.3rem;',
      '  letter-spacing:2px; color:rgba(232,180,180,0.5);',
      '  text-transform:uppercase; outline:none; }',
      '.clr-cap-audit-drawer > summary:hover { color:rgba(232,180,180,0.8); }',
      '.clr-cap-audit-body { margin-top:6px; font-size:0.32rem;',
      '  color:rgba(200,195,184,0.55); line-height:1.5; }',
      '.clr-cap-audit-body strong { color:rgba(232,180,180,0.7); font-weight:600;',
      '  letter-spacing:0.5px; }',
      '.clr-event-label { color:#bbb; flex:1; }',
      '.clr-event-score { color:#888; flex-shrink:0; width:32px; text-align:right; }',
      '.clr-action-item { padding:5px 0 5px 10px; font-size:0.52rem; color:#bbb;',
      '  border-left:2px solid rgba(201,169,78,0.12); margin-bottom:3px; }',
      '.clr-action-item:before { content:"\\2192 "; color:#C9A94E; }',
      '.clr-action-prov { display:inline-block; margin-left:8px; padding:0 4px;',
      '  font-size:0.36rem; letter-spacing:1px; border-radius:2px;',
      '  vertical-align:middle; text-transform:uppercase; }',
      '.clr-action-prov-brain { background:rgba(90,181,160,0.18); color:#5ab5a0; }',
      '.clr-action-prov-registry { background:rgba(201,169,78,0.16); color:#C9A94E; }',
      '.clr-domain-phase-src { display:inline-block; padding:0 4px;',
      '  font-size:0.26rem; letter-spacing:0.8px; border-radius:2px;',
      '  vertical-align:middle; text-transform:uppercase; }',
      '.clr-domain-phase-src-brain { background:rgba(90,181,160,0.18); color:#5ab5a0; }',
      '.clr-domain-phase-src-prov { background:rgba(201,169,78,0.16); color:#C9A94E; }',
      '.clr-dh-caret { display:inline-block; width:10px; font-size:0.4rem;',
      '  color:rgba(201,169,78,0.5); user-select:none;',
      '  text-align:center; margin-right:2px; }',
      '.clr-dh-drill { margin:4px 0 6px 12px; padding:4px 0 4px 8px;',
      '  border-left:1px solid rgba(201,169,78,0.12); }',
      '.clr-dh-sect-label { font-size:0.42rem; color:rgba(201,169,78,0.35);',
      '  letter-spacing:0.8px; margin-top:4px; }',
      '.clr-dh-sect-row { font-size:0.42rem; color:rgba(200,195,184,0.45);',
      '  padding-left:6px; line-height:1.5; }',

      /* Tabs */
      '.clr-tab-bar { display:flex; gap:0; border-bottom:1px solid rgba(201,169,78,0.1);',
      '  margin-bottom:0; overflow-x:auto; }',
      '.clr-tab { padding:7px 14px; font-size:0.5rem; letter-spacing:1.2px; text-transform:uppercase;',
      '  cursor:pointer; color:#666; border:none; background:none; border-bottom:2px solid transparent;',
      '  font-family:inherit; white-space:nowrap; transition:color 0.2s; }',
      '.clr-tab:hover { color:#C9A94E; }',
      '.clr-tab.active { color:#C9A94E; border-bottom-color:#C9A94E; }',
      '.clr-tab-content { min-height:120px; padding:12px 0; }',
      '.clr-tab-content:empty { min-height:0; }',

      /* Empty state */
      '.clr-empty { text-align:center; padding:32px 20px; }',
      '.clr-empty-msg { font-size:0.6rem; color:#666; margin-bottom:10px; }',
      '.clr-empty-philemon { font-size:0.5rem; color:rgba(201,169,78,0.45); font-style:italic; }',

      /* Analyst toggle */
      '.clr-analyst-btn { font-family:monospace; font-size:0.38rem; letter-spacing:2px; text-transform:uppercase;',
      '  color:rgba(201,169,78,0.35); cursor:pointer; padding:3px 8px;',
      '  border:1px solid rgba(201,169,78,0.08); border-radius:2px;',
      '  background:rgba(201,169,78,0.03); transition:all 0.2s; }',
      '.clr-analyst-btn:hover { border-color:rgba(201,169,78,0.2); color:rgba(201,169,78,0.6); }',
      '.clr-analyst-btn.active { color:#C9A94E; border-color:rgba(201,169,78,0.3);',
      '  background:rgba(201,169,78,0.1); }',

      /* Refresh button */
      '.clr-refresh-btn { font-family:monospace; font-size:0.38rem; letter-spacing:1.5px;',
      '  color:rgba(201,169,78,0.3); cursor:pointer; padding:3px 8px;',
      '  border:1px solid rgba(201,169,78,0.06); border-radius:2px;',
      '  background:none; transition:all 0.2s; }',
      '.clr-refresh-btn:hover { color:rgba(201,169,78,0.6); border-color:rgba(201,169,78,0.2); }',

      /* Subdued card reuse */
      '.clr-sub-card { background:#181a20; border:1px solid rgba(201,169,78,0.06); border-radius:3px;',
      '  padding:10px 12px; margin-bottom:8px; }',
      '.clr-sub-title { font-size:0.55rem; letter-spacing:1.5px; text-transform:uppercase; color:#C9A94E;',
      '  margin:0 0 6px; padding-bottom:3px; border-bottom:1px solid rgba(201,169,78,0.06); }',
      '.clr-row { display:flex; justify-content:space-between; padding:2px 0; font-size:0.52rem; }',
      '.clr-row-label { color:#888; }',
      '.clr-row-value { color:#bbb; }',
      '.clr-row-value.critical { color:#e85454; }',
      '.clr-row-value.high { color:#FF9800; }',
      '.clr-row-value.moderate { color:#C9A94E; }',
      '.clr-row-value.low { color:#5ab5a0; }',
      '.clr-list-item { padding:3px 0 3px 10px; font-size:0.5rem; color:#bbb;',
      '  border-left:2px solid rgba(201,169,78,0.1); margin-bottom:2px; }',
      /* Detected Diagnoses & Treatments — stacked readable layout (not flex space-between). */
      '.clr-dx-row { padding:6px 0 4px; border-bottom:1px solid rgba(201,169,78,0.04); }',
      '.clr-dx-row:last-child { border-bottom:none; }',
      '.clr-dx-label { font-size:0.58rem; letter-spacing:1px; color:#d6c89a;',
      '  line-height:1.35; font-weight:500; }',
      '.clr-dx-explain { font-size:0.5rem; color:#b8b2a0; line-height:1.55;',
      '  margin-top:3px; overflow-wrap:break-word; word-break:normal; }',
      '.clr-tx-item { padding:5px 0 5px 10px; font-size:0.52rem; color:#c5b590;',
      '  line-height:1.5; border-left:2px solid rgba(90,181,160,0.3); margin:4px 0;',
      '  overflow-wrap:break-word; word-break:normal; }',

      /* Master Brain Handoff Queue card (Patch B) */
      '.clr-handoff-card { background:#161821; border:1px solid rgba(90,181,160,0.18);',
      '  border-radius:3px; padding:10px 12px; margin:10px 0 4px; }',
      '.clr-handoff-head { display:flex; align-items:center; gap:8px; margin-bottom:4px; }',
      '.clr-handoff-title { font-size:0.55rem; letter-spacing:1.8px; text-transform:uppercase;',
      '  color:#5ab5a0; flex:1; padding-bottom:3px; border-bottom:1px solid rgba(90,181,160,0.12); }',
      '.clr-handoff-refresh { font-family:monospace; font-size:0.36rem; letter-spacing:1.5px;',
      '  color:rgba(90,181,160,0.55); cursor:pointer; padding:3px 8px;',
      '  border:1px solid rgba(90,181,160,0.18); border-radius:2px;',
      '  background:none; transition:all 0.2s; text-transform:uppercase; }',
      '.clr-handoff-refresh:hover { color:rgba(90,181,160,0.95); border-color:rgba(90,181,160,0.45); }',
      '.clr-handoff-subtitle { font-size:0.42rem; color:#888; line-height:1.45;',
      '  letter-spacing:0.3px; margin:0 0 8px; }',
      '.clr-handoff-empty { font-size:0.46rem; color:#666; font-style:italic;',
      '  padding:6px 4px; letter-spacing:0.3px; }',
      '.clr-handoff-warn { font-size:0.46rem; color:#FF9800; font-style:italic;',
      '  padding:6px 4px; letter-spacing:0.3px; }',
      '.clr-handoff-lanes { display:flex; flex-direction:column; gap:2px; }',
      '.clr-handoff-lane { border-left:2px solid rgba(90,181,160,0.10); }',
      '.clr-handoff-lane.has-ready { border-left-color:rgba(90,181,160,0.55); }',
      '.clr-handoff-lane-head { display:flex; align-items:center; gap:6px; cursor:pointer;',
      '  padding:5px 8px; user-select:none; transition:background 0.15s; }',
      '.clr-handoff-lane-head:hover { background:rgba(90,181,160,0.04); }',
      '.clr-handoff-caret { font-size:0.36rem; color:rgba(90,181,160,0.6); width:10px;',
      '  display:inline-block; }',
      '.clr-handoff-lane-label { font-size:0.5rem; letter-spacing:1px; color:#d6c89a;',
      '  flex:1; min-width:120px; }',
      '.clr-handoff-counts { font-size:0.44rem; color:#888; letter-spacing:0.3px; }',
      '.clr-handoff-counts .clr-handoff-ready { color:#5ab5a0; }',
      '.clr-handoff-counts .clr-handoff-pending { color:#C9A94E; }',
      '.clr-handoff-detail { padding:4px 12px 8px 24px; }',
      '.clr-handoff-packet { padding:5px 0 5px 10px; margin:3px 0; font-size:0.46rem;',
      '  color:#bbb; line-height:1.55; border-left:2px solid rgba(201,169,78,0.18); }',
      '.clr-handoff-packet-title { color:#d6c89a; font-size:0.5rem; letter-spacing:0.5px; }',
      '.clr-handoff-packet-meta { color:#888; font-size:0.42rem; margin-top:2px; }',
      '.clr-handoff-packet-meta b { color:#bbb; font-weight:normal; }',
      '.clr-handoff-packet-rationale { color:#a89c7a; font-style:italic; margin-top:3px;',
      '  font-size:0.44rem; }',
      '.clr-handoff-packet-ready { color:#5ab5a0; font-size:0.4rem; letter-spacing:1.5px;',
      '  text-transform:uppercase; margin-top:2px; }',
      '.clr-handoff-packet-empty { padding:6px 0 4px 10px; font-size:0.44rem; color:#666;',
      '  font-style:italic; }',
      '.clr-handoff-stamp { font-size:0.38rem; color:#555; letter-spacing:0.5px;',
      '  margin-top:6px; padding-top:4px; border-top:1px solid rgba(90,181,160,0.06); }',

      /* Patch B1 — manager-readable additions */
      '.clr-handoff-explainer { font-size:0.4rem; color:#888; line-height:1.5;',
      '  letter-spacing:0.3px; margin:0 0 8px; }',
      '.clr-handoff-lane-desc { font-size:0.42rem; color:#a89c7a; line-height:1.5;',
      '  letter-spacing:0.3px; padding:0 4px 6px 0; font-style:italic; }',
      '.clr-handoff-lane-status-pending { font-size:0.44rem; color:#C9A94E;',
      '  line-height:1.5; padding:4px 0; }',
      '.clr-handoff-lane-status-pending .sub { display:block; color:#888; font-size:0.4rem;',
      '  margin-top:2px; font-style:italic; }',
      '.clr-handoff-lane-status-empty { font-size:0.44rem; color:#666;',
      '  line-height:1.5; padding:4px 0; font-style:italic; }',
      '.clr-handoff-packet-id { font-size:0.38rem; color:#666; letter-spacing:0.3px;',
      '  margin-top:1px; font-family:monospace; }',
      '.clr-handoff-packet-row { font-size:0.44rem; color:#bbb; padding:1px 0;',
      '  letter-spacing:0.3px; line-height:1.5; }',
      '.clr-handoff-packet-row b { color:#888; font-weight:normal; }',
      '.clr-handoff-packet-status-ready { color:#5ab5a0; font-size:0.42rem;',
      '  letter-spacing:0.5px; padding:2px 0; }',
      '.clr-handoff-packet-status-pending { color:#C9A94E; font-size:0.42rem;',
      '  letter-spacing:0.5px; padding:2px 0; }',
      '.clr-handoff-packet-why { color:#a89c7a; font-size:0.42rem; padding:3px 0;',
      '  letter-spacing:0.3px; line-height:1.5; font-style:italic; }',

      /* Gate B #9C.5 Phase 1 — handoff queue source-state authority badge */
      '.clr-handoff-source-badge { display:block; letter-spacing:1.5px;',
      '  text-transform:uppercase; padding:5px 9px; border-radius:2px;',
      '  margin:0 0 8px; font-weight:600; font-size:0.45rem; }',
      /* FRESH: small, low-key — operator does not need to act on this */
      '.clr-handoff-source-badge.fresh { color:#5ab5a0; font-size:0.4rem;',
      '  letter-spacing:1px; font-weight:normal;',
      '  background:rgba(90,181,160,0.04);',
      '  border:1px solid rgba(90,181,160,0.20); }',
      /* STALE: amber — operator should know the queue may be out-of-date */
      '.clr-handoff-source-badge.stale { color:#FF9800;',
      '  background:rgba(255,152,0,0.05);',
      '  border:1px solid rgba(255,152,0,0.30); }',
      /* VERY_STALE: red — operator should not trust queue contents */
      '.clr-handoff-source-badge.very-stale { color:#e85454;',
      '  background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.30); }',
      /* NO_TIMESTAMP: gray — freshness unknown, distinct from stale */
      '.clr-handoff-source-badge.no-timestamp { color:#888;',
      '  background:rgba(255,255,255,0.02);',
      '  border:1px solid rgba(200,195,184,0.18); }',
      /* NO_SOURCE / NO_PIPELINE: red — pipeline itself is broken */
      '.clr-handoff-source-badge.no-source,',
      '.clr-handoff-source-badge.no-pipeline { color:#e85454;',
      '  background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.30); }',

      /* ARTIFACT-UI-0 — Artifact Council */
      '.clr-council { padding:10px 12px; background:#161821;',
      '  border:1px solid rgba(74,143,212,0.18); border-radius:3px;',
      '  font-size:0.5rem; line-height:1.55; color:#d6c89a; }',
      '.clr-council-head { display:flex; align-items:baseline; gap:10px;',
      '  margin-bottom:6px; }',
      '.clr-council-title { font-size:0.6rem; letter-spacing:1.8px;',
      '  text-transform:uppercase; color:#4a8fd4; }',
      '.clr-council-sub { font-size:0.42rem; color:#888; line-height:1.5; }',
      '.clr-council-status { margin-left:auto; font-size:0.4rem;',
      '  letter-spacing:1.2px; text-transform:uppercase;',
      '  padding:2px 8px; border:1px solid rgba(74,143,212,0.4);',
      '  border-radius:2px; color:#4a8fd4; background:rgba(74,143,212,0.06); }',
      '.clr-council-status.idle { color:#888; border-color:rgba(255,255,255,0.1); }',
      '.clr-council-status.running { color:#C9A94E; border-color:rgba(201,169,78,0.5);',
      '  background:rgba(201,169,78,0.08); }',
      '.clr-council-status.done { color:#5ab5a0; border-color:rgba(90,181,160,0.45); }',
      '.clr-council-status.error { color:#e85454; border-color:rgba(232,84,84,0.5);',
      '  background:rgba(232,84,84,0.08); }',
      '.clr-council-row { display:flex; gap:10px; align-items:center;',
      '  flex-wrap:wrap; padding:6px 0; }',
      '.clr-council-label { font-size:0.42rem; letter-spacing:1px; color:#a89c7a;',
      '  min-width:55px; text-transform:uppercase; }',
      '.clr-council-select { background:#0d0f16; color:#d6c89a;',
      '  border:1px solid rgba(74,143,212,0.25); border-radius:2px;',
      '  padding:4px 8px; font-family:monospace; font-size:0.46rem;',
      '  letter-spacing:0.4px; min-width:180px; flex:1; max-width:520px; }',
      '.clr-council-select:disabled { color:#555; border-color:rgba(255,255,255,0.05); }',
      '.clr-council-run { background:rgba(74,143,212,0.18); color:#cfe1f2;',
      '  border:1px solid rgba(74,143,212,0.55); border-radius:2px;',
      '  padding:6px 16px; font-family:monospace; font-size:0.5rem;',
      '  letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; }',
      '.clr-council-run:hover { background:rgba(74,143,212,0.28); }',
      '.clr-council-run:disabled { color:#555; border-color:rgba(255,255,255,0.06);',
      '  background:transparent; cursor:not-allowed; }',

      '.clr-council-progress { display:flex; flex-direction:column; gap:2px;',
      '  margin:8px 0; padding:8px 0; border-top:1px solid rgba(255,255,255,0.04);',
      '  border-bottom:1px solid rgba(255,255,255,0.04); }',
      '.clr-council-stage { display:flex; align-items:center; gap:8px;',
      '  font-size:0.46rem; letter-spacing:0.4px; padding:2px 0; }',
      '.clr-council-stage-icon { width:14px; text-align:center; font-size:0.5rem; }',
      '.clr-council-stage.idle .clr-council-stage-icon { color:#555; }',
      '.clr-council-stage.idle .clr-council-stage-name { color:#666; }',
      '.clr-council-stage.running .clr-council-stage-icon { color:#C9A94E; }',
      '.clr-council-stage.running .clr-council-stage-name { color:#d6c89a; }',
      '.clr-council-stage.done .clr-council-stage-icon { color:#5ab5a0; }',
      '.clr-council-stage.done .clr-council-stage-name { color:#a89c7a; }',
      '.clr-council-stage.error .clr-council-stage-icon { color:#e85454; }',
      '.clr-council-stage.error .clr-council-stage-name { color:#e85454; }',
      '.clr-council-stage-time { margin-left:auto; font-size:0.38rem;',
      '  color:#666; letter-spacing:0.3px; }',
      '.clr-council-stage-error { color:#e85454; font-size:0.4rem;',
      '  letter-spacing:0.3px; padding:2px 0 4px 22px; line-height:1.4; }',

      '.clr-council-pane-bar { display:flex; gap:0; margin-top:8px;',
      '  border-bottom:1px solid rgba(74,143,212,0.18); }',
      '.clr-council-pane-tab { padding:6px 14px; font-size:0.46rem;',
      '  letter-spacing:1px; text-transform:uppercase; cursor:pointer;',
      '  color:#888; border-bottom:2px solid transparent; }',
      '.clr-council-pane-tab:hover { color:#d6c89a; }',
      '.clr-council-pane-tab.active { color:#4a8fd4;',
      '  border-bottom-color:#4a8fd4; }',
      '.clr-council-pane { padding:10px 0; min-height:60px; }',
      '.clr-council-pane-empty { color:#666; font-size:0.44rem;',
      '  font-style:italic; padding:6px 0; }',
      '.clr-council-section { margin:6px 0; padding:6px 8px; background:#0d0f16;',
      '  border-left:2px solid rgba(74,143,212,0.25); border-radius:0 2px 2px 0; }',
      '.clr-council-section-title { font-size:0.42rem; letter-spacing:1px;',
      '  color:#4a8fd4; text-transform:uppercase; margin-bottom:3px; }',
      '.clr-council-section-body { font-size:0.46rem; color:#d6c89a;',
      '  line-height:1.55; white-space:pre-wrap; word-break:break-word; }',
      '.clr-council-list { list-style:none; padding:0; margin:0; }',
      '.clr-council-list li { padding:4px 0 4px 12px; position:relative;',
      '  font-size:0.46rem; color:#d6c89a; line-height:1.5; }',
      '.clr-council-list li::before { content:"\\25B8"; position:absolute;',
      '  left:0; color:rgba(74,143,212,0.55); }',
      '.clr-council-schema { font-size:0.36rem; color:#666;',
      '  letter-spacing:0.5px; padding:4px 0 0; }',

      '.clr-council-ledger-title { font-size:0.5rem; letter-spacing:1px;',
      '  color:#e85454; text-transform:uppercase; margin:0 0 4px; }',
      '.clr-council-ledger-sub { font-size:0.4rem; color:#a89c7a;',
      '  font-style:italic; line-height:1.5; margin:0 0 8px; }',
      '.clr-council-ledger-empty { font-size:0.46rem; color:#5ab5a0;',
      '  padding:6px 0; }',
      '.clr-council-obj { padding:6px 8px; margin:4px 0; background:#0d0f16;',
      '  border-left:3px solid rgba(232,84,84,0.55); border-radius:0 2px 2px 0; }',
      '.clr-council-obj.severity-must-address { border-left-color:#e85454; }',
      '.clr-council-obj.severity-blocking { border-left-color:#e85454; }',
      '.clr-council-obj.severity-recommended { border-left-color:#FF9800; }',
      '.clr-council-obj.severity-warn { border-left-color:#FF9800; }',
      '.clr-council-obj.severity-info { border-left-color:#4a8fd4; }',
      '.clr-council-obj-head { display:flex; gap:8px; align-items:baseline;',
      '  font-size:0.4rem; letter-spacing:0.4px; color:#888;',
      '  text-transform:uppercase; }',
      '.clr-council-obj-id { color:#d6c89a; font-family:monospace; }',
      '.clr-council-obj-sev { color:#e85454; }',
      '.clr-council-obj-type { color:#a89c7a; }',
      '.clr-council-obj-issue { font-size:0.46rem; color:#d6c89a;',
      '  margin-top:3px; line-height:1.5; }',
      '.clr-council-obj-resp { font-size:0.42rem; color:#a89c7a;',
      '  margin-top:3px; font-style:italic; line-height:1.45; }',

      '.clr-council-raw { margin-top:8px; }',
      '.clr-council-raw summary { cursor:pointer; font-size:0.4rem;',
      '  color:#888; letter-spacing:0.5px; padding:4px 0;',
      '  text-transform:uppercase; }',
      '.clr-council-raw summary:hover { color:#d6c89a; }',
      '.clr-council-raw pre { background:#0a0c12; color:#a89c7a;',
      '  border:1px solid rgba(255,255,255,0.05); border-radius:2px;',
      '  padding:8px 10px; font-family:monospace; font-size:0.4rem;',
      '  line-height:1.45; max-height:320px; overflow:auto;',
      '  white-space:pre; }',

      '.clr-council-foot { margin-top:10px; padding-top:8px;',
      '  border-top:1px solid rgba(255,255,255,0.05);',
      '  display:flex; gap:10px; align-items:center; flex-wrap:wrap; }',
      '.clr-council-mark { background:rgba(90,181,160,0.14); color:#cfe1d8;',
      '  border:1px solid rgba(90,181,160,0.45); border-radius:2px;',
      '  padding:5px 14px; font-family:monospace; font-size:0.46rem;',
      '  letter-spacing:1px; text-transform:uppercase; cursor:pointer; }',
      '.clr-council-mark:hover { background:rgba(90,181,160,0.22); }',
      '.clr-council-mark:disabled { color:#555;',
      '  border-color:rgba(255,255,255,0.06); background:transparent;',
      '  cursor:not-allowed; }',
      '.clr-council-mark-stamp { font-size:0.4rem; color:#5ab5a0;',
      '  letter-spacing:0.4px; }',
      '.clr-council-note { font-size:0.4rem; color:#888; font-style:italic;',
      '  letter-spacing:0.3px; line-height:1.5; }',
      '.clr-council-warn { font-size:0.42rem; color:#C9A94E;',
      '  letter-spacing:0.3px; line-height:1.5; padding:6px 0; }',

      /* ARTIFACT-UI-0.1 — honesty notices */
      '.clr-council-notice { padding:6px 10px; margin:6px 0;',
      '  background:#0d0f16; border-left:3px solid rgba(74,143,212,0.4);',
      '  border-radius:0 2px 2px 0; font-size:0.42rem;',
      '  color:#a89c7a; line-height:1.55; letter-spacing:0.3px; }',
      '.clr-council-notice b { color:#d6c89a; font-weight:normal; }',
      '.clr-council-notice.warn { border-left-color:rgba(232,84,84,0.5);',
      '  color:#d6c89a; }',
      '.clr-council-notice.warn b { color:#e85454; }',
      '.clr-council-notice.safe { border-left-color:rgba(90,181,160,0.45); }',
      '.clr-council-status { cursor:default; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════════════════════════════════

  function _render() {
    if (!_container) return;
    _container.innerHTML = '';

    // ── Zone A: Executive Strip ──
    _execStripEl = document.createElement('div');
    _execStripEl.className = 'clr-exec-strip';
    _refreshExecStrip();
    _container.appendChild(_execStripEl);

    // Legacy hero removed (Phase 1 cleanup — was CSS-hidden, no UX effect)

    // ── Zone B: Command Center ──
    var commandZone = document.createElement('div');
    commandZone.className = 'clr-command-zone';

    _domainsEl = document.createElement('div');
    _domainsEl.className = 'clr-section';
    _refreshDomains();
    commandZone.appendChild(_domainsEl);

    var focusRow = document.createElement('div');
    focusRow.className = 'clr-focus-row';
    _eventsEl = document.createElement('div');
    _eventsEl.className = 'clr-card';
    _refreshEvents();
    focusRow.appendChild(_eventsEl);

    _actionsEl = document.createElement('div');
    _actionsEl.className = 'clr-card';
    _refreshActions();
    focusRow.appendChild(_actionsEl);
    commandZone.appendChild(focusRow);

    // Master Brain Handoff Queue (Patch B) — sits between RECOMMENDED
    // ACTIONS and the Evidence Workspace, scoped inside commandZone so it
    // reads as part of Zone B / Command Center.
    _handoffEl = document.createElement('div');
    _handoffEl.className = 'clr-handoff-card';
    _refreshHandoff();
    commandZone.appendChild(_handoffEl);

    // ── Live Discoveries (Feed→Discovery; DARK unless window.LIMEN_ENABLE_LIVE_DISCOVERIES) ──
    // Folds the feed-weighted, brain-diagnosis-derived discoveries in here. When
    // the flag is off, renderInto() leaves the element empty and it is not appended.
    try {
      if (window.LIMENLiveDiscoveriesUI && typeof window.LIMENLiveDiscoveriesUI.renderInto === 'function') {
        var _discEl = document.createElement('div');
        _discEl.className = 'clr-section';
        window.LIMENLiveDiscoveriesUI.renderInto(_discEl);
        if (_discEl.innerHTML) commandZone.appendChild(_discEl);
      }
    } catch (e) {}

    _container.appendChild(commandZone);

    // ── Zone C: Evidence Workspace ──
    var evidenceZone = document.createElement('div');
    evidenceZone.className = 'clr-evidence-zone';

    var evidenceLabel = document.createElement('div');
    evidenceLabel.className = 'clr-evidence-label';
    evidenceLabel.textContent = 'EVIDENCE WORKSPACE';
    evidenceZone.appendChild(evidenceLabel);

    _tabBarEl = _renderTabBar();
    evidenceZone.appendChild(_tabBarEl);

    _tabContentEl = document.createElement('div');
    _tabContentEl.className = 'clr-tab-content';
    evidenceZone.appendChild(_tabContentEl);

    _container.appendChild(evidenceZone);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Executive Strip
  // ═══════════════════════════════════════════════════════════════════════════

  // Gate B #9C.3 — Executive Strip authority classifier.
  //
  // Doctrine (operator 2026-06-02):
  //   Falsy fallback is not authority logic.
  //   Measured zero is a signal; missing data is a different state.
  //
  // NO_SOURCE replaces the entire strip with a banner — the existing
  // `mode || 'stable'` fallback would otherwise paint a fake "STABLE"
  // state when the pipeline is genuinely missing, which is dishonest.
  // UNKNOWN keeps the strip visible but adds a badge below it because
  // some signal might exist (mode/drivers) even when confidence is
  // absent. LOW / MODERATE add a structural badge below the strip
  // without suppressing content — the existing "CONF N%" inline
  // display stays in the meta row.
  //
  // The `_confidenceKnown` pattern from #9C.2 is reused via the
  // isFinite() check on gs.confidence.

  function _classifyExecStripAuthority(gs) {
    if (!gs || typeof gs !== 'object' || Array.isArray(gs) || Object.keys(gs).length === 0) {
      return {
        level: 'NO_SOURCE',
        badge: 'EXECUTIVE STATE PIPELINE NOT AVAILABLE',
        reason: 'window.LIMENGlobalState is missing or empty. Strip content suppressed.',
        suppressBody: true
      };
    }
    var hasConf = typeof gs.confidence === 'number' && isFinite(gs.confidence);
    if (!hasConf) {
      return { level: 'UNKNOWN', badge: 'CONFIDENCE UNKNOWN', reason: null, suppressBody: false };
    }
    var conf = gs.confidence;
    if (conf < 0.4) {
      return {
        level: 'LOW_CONFIDENCE',
        badge: 'LOW CONFIDENCE · ' + Math.round(conf * 100) + '%',
        reason: 'Mode signal interpretation may be unreliable.',
        suppressBody: false
      };
    }
    if (conf < 0.65) {
      return {
        level: 'MODERATE_CONFIDENCE',
        badge: 'MODERATE CONFIDENCE · ' + Math.round(conf * 100) + '%',
        reason: null,
        suppressBody: false
      };
    }
    return { level: 'FULL', badge: null, reason: null, suppressBody: false };
  }

  var _execStripEl = null;

  function _refreshExecStrip() {
    if (!_execStripEl) return;

    // Gate B #9C.3 — classify before painting. NO_SOURCE replaces the
    // entire strip with a banner; UNKNOWN / LOW / MODERATE add a badge
    // below the existing strip content; FULL renders as before.
    var __gsRaw = window.LIMENGlobalState;
    var __auth = _classifyExecStripAuthority(__gsRaw);

    if (__auth.suppressBody) {
      _execStripEl.innerHTML = '<div class="clr-exec-suppress">' +
        __auth.badge +
        (__auth.reason ? '<small>' + __auth.reason + '</small>' : '') +
        '</div>';
      return;
    }

    var gs = __gsRaw || {};
    var mode = gs.mode || 'stable';
    var confidence = gs.confidence || 0;
    var drivers = gs.topDrivers || [];
    var feedState = (window.LIMENFeedState) ? window.LIMENFeedState.getState() : null;

    var color = STATE_COLORS[mode] || '#999';

    var html = '';

    // State badge
    html += '<span class="clr-exec-state" style="color:' + color + '">' + mode.toUpperCase() + '</span>';
    html += '<span style="font-size:0.32rem;letter-spacing:1px;color:rgba(200,195,184,0.18);margin-left:4px">RECURSIVE REGULATION ENGINE</span>';

    // Confidence + feed
    var metaParts = ['CONF ' + Math.round(confidence * 100) + '%'];
    if (feedState) {
      var fc = feedState === 'hydrated' ? '#5ab5a0' : feedState === 'degraded' ? '#e85454' : '#C9A94E';
      metaParts.push('<span style="color:' + fc + '">' + feedState.toUpperCase() + '</span>');
    }
    html += '<span class="clr-exec-meta">' + metaParts.join(' \u00b7 ') + '</span>';

    // Primary signal — source-attributed from top stressed domain
    var doms = window.LIMENDomains || {};
    var topDom = null; var topStress = 0;
    for (var dk in doms) {
      if (doms[dk].stress > topStress) { topStress = doms[dk].stress; topDom = dk; }
    }
    if (topDom && topStress > 0.2) {
      var _esDomData = doms[topDom];
      var esParts = [topDom.toUpperCase()];
      // Try source name + label first
      var _esSources = _esDomData.sources || [];
      var _esSourceFound = false;
      for (var _esi = 0; _esi < _esSources.length; _esi++) {
        if (_esSources[_esi].live && _esSources[_esi].label) {
          var _esLabel = _esSources[_esi].label;
          if (_esLabel.length > 30) _esLabel = _esLabel.substring(0, 27) + '...';
          esParts.push(_esLabel);
          _esSourceFound = true;
          break;
        }
      }
      // Fallback: top driver signal text or stress score
      if (!_esSourceFound) {
        if (drivers.length > 0) {
          var _esDrv = drivers[0];
          if (_esDrv.length > 30) _esDrv = _esDrv.substring(0, 27) + '...';
          esParts.push(_esDrv);
        } else {
          esParts.push(topStress.toFixed(2));
        }
      }
      var esColor = topStress > 0.65 ? '#e85454' : topStress > 0.4 ? '#C9A94E' : '#5ab5a0';
      html += '<span class="clr-exec-signal" style="color:' + esColor + '">' + esParts.join(' \u00b7 ') + '</span>';
    }

    _execStripEl.innerHTML = html;

    // Gate B #9C.3 \u2014 append authority badge BELOW the existing strip
    // when level is UNKNOWN / LOW_CONFIDENCE / MODERATE_CONFIDENCE.
    // FULL appends nothing. NO_SOURCE was already handled above with
    // an early-return.
    if (__auth.badge) {
      var __badgeCls = __auth.level === 'LOW_CONFIDENCE' ? 'low'
                     : __auth.level === 'MODERATE_CONFIDENCE' ? 'moderate'
                     : 'unknown';
      var __badgeEl = document.createElement('div');
      __badgeEl.className = 'clr-exec-conf-badge ' + __badgeCls;
      __badgeEl.textContent = __auth.badge;
      if (__auth.reason) {
        // Small wrapping for the reason text \u2014 using a span keeps the
        // badge a single block-level element with a 2-line look.
        var __reasonEl = document.createElement('span');
        __reasonEl.style.cssText = 'display:block;margin-top:2px;font-size:0.32rem;color:rgba(200,195,184,0.55);letter-spacing:0.5px;text-transform:none;font-weight:normal';
        __reasonEl.textContent = __auth.reason;
        __badgeEl.appendChild(__reasonEl);
      }
      _execStripEl.appendChild(__badgeEl);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Hero Panel
  // ═══════════════════════════════════════════════════════════════════════════

  function _renderHero() {
    var el = document.createElement('div');
    el.className = 'clr-hero';
    _fillHero(el);
    return el;
  }

  function _refreshHero() {
    _refreshExecStrip();
    if (!_heroEl) return;
    _fillHero(_heroEl);
  }

  function _fillHero(el) {
    var gs = window.LIMENGlobalState || {};
    var mode = gs.mode || 'stable';
    var confidence = gs.confidence || 0;
    var drivers = gs.topDrivers || [];
    var stateKey = mode;
    var philLine = SYSTEM_STATUS[stateKey] || SYSTEM_STATUS.stable;

    // If no domain data at all
    var domains = window.LIMENDomains;
    if (!domains || Object.keys(domains).length === 0) {
      stateKey = 'noData';
      mode = 'INITIALIZING';
      confidence = 0;
      drivers = [];
      philLine = SYSTEM_STATUS.noData;
    }

    var color = STATE_COLORS[gs.mode] || '#999';
    el.style.borderLeftColor = color;

    el.innerHTML = '';

    var row = document.createElement('div');
    row.className = 'clr-hero-row';

    var stateEl = document.createElement('span');
    stateEl.className = 'clr-hero-state';
    stateEl.style.color = color;
    stateEl.textContent = mode.toUpperCase();
    row.appendChild(stateEl);

    var confEl = document.createElement('span');
    confEl.className = 'clr-hero-conf';
    confEl.textContent = 'CONFIDENCE ' + Math.round(confidence * 100) + '%';
    row.appendChild(confEl);

    el.appendChild(row);

    if (drivers.length > 0) {
      var driverEl = document.createElement('div');
      driverEl.className = 'clr-hero-driver';
      driverEl.textContent = 'Primary: ' + drivers.slice(0, 3).join(', ');
      el.appendChild(driverEl);
    }

    var philEl = document.createElement('div');
    philEl.className = 'clr-hero-philemon';
    philEl.textContent = philLine;
    el.appendChild(philEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Domain Health
  // ═══════════════════════════════════════════════════════════════════════════

  // Freshness helper for Domain Health drilldown.
  // Mirrors the shape used in domain-signal-engine.js _freshness — inlined to
  // keep this patch single-file (no engine changes).
  function _dhFreshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  // Build per-tile drilldown HTML from already-global read-only sources.
  // No synthesis: empty sections are omitted. Data type always renders since
  // it's a deterministic projection of d.confidence.
  function _buildDomainHealthDrill(dk, d) {
    var html = '';

    var sources = Array.isArray(d && d.sources) ? d.sources : [];
    if (sources.length > 0) {
      html += '<div class="clr-dh-sect-label">Sources</div>';
      for (var i = 0; i < sources.length; i++) {
        var src = sources[i] || {};
        var liveLabel = src.live ? 'LIVE' : 'OFFLINE';
        var liveColor = src.live ? '#5ab5a0' : '#e85454';
        html += '<div class="clr-dh-sect-row">Source ' + String.fromCharCode(65 + i) + ': ' +
          '<span style="color:rgba(201,169,78,0.7)">' + (src.name || '') + '</span>' +
          ' \u2014 <span style="color:' + liveColor + '">' + liveLabel + '</span>' +
          ' \u2014 updated ' + _dhFreshness(src.updated) + '</div>';
      }
    }

    var conf = typeof (d && d.confidence) === 'number' ? d.confidence : 0;
    var dataType, dtColor;
    if (conf >= 0.8)      { dataType = 'inferred from raw feed data'; dtColor = '#5ab5a0'; }
    else if (conf >= 0.4) { dataType = 'mixed live + fallback';       dtColor = '#d4a44e'; }
    else                  { dataType = 'heuristic fallback';          dtColor = '#e85454'; }
    html += '<div class="clr-dh-sect-label">Data type</div>';
    html += '<div class="clr-dh-sect-row" style="color:' + dtColor + '">' + dataType + '</div>';

    // Balance — row labels fixed as destabilizing / stabilizing / net.
    // State parenthetical on the net line: internal 'improving' maps to
    // displayed 'stabilizing'; 'destabilizing' stays 'destabilizing';
    // anything else displays as 'neutral'.
    var bal = (window.LIMENBalance && window.LIMENBalance[dk]) || null;
    if (bal && typeof bal.net === 'number') {
      var balStateLabel = 'neutral', balColor = 'rgba(200,195,184,0.5)';
      if (bal.state === 'improving')          { balStateLabel = 'stabilizing';   balColor = 'rgba(90,181,160,0.8)'; }
      else if (bal.state === 'destabilizing') { balStateLabel = 'destabilizing'; balColor = '#e85454'; }
      html += '<div class="clr-dh-sect-label">Balance</div>';
      if (typeof bal.destabilizing === 'number') html += '<div class="clr-dh-sect-row">destabilizing: ' + bal.destabilizing.toFixed(2) + '</div>';
      if (typeof bal.stabilizing === 'number')  html += '<div class="clr-dh-sect-row">stabilizing: ' + bal.stabilizing.toFixed(2) + '</div>';
      html += '<div class="clr-dh-sect-row" style="color:' + balColor + '">net: ' + (bal.net > 0 ? '+' : '') + bal.net.toFixed(2) + ' (' + balStateLabel + ')</div>';
    }

    var pol = (window.LIMENPolarity && window.LIMENPolarity[dk]) || null;
    if (pol && pol.polarity && pol.polarity !== 'uncertain') {
      var toneColor = 'rgba(200,195,184,0.5)';
      if (pol.polarity === 'positive')      toneColor = 'rgba(90,181,160,0.8)';
      else if (pol.polarity === 'negative') toneColor = '#e85454';
      else if (pol.polarity === 'mixed')    toneColor = '#d4a44e';
      var netTone = typeof pol.netTone === 'number' ? pol.netTone : 0;
      html += '<div class="clr-dh-sect-label">Report tone</div>';
      html += '<div class="clr-dh-sect-row" style="color:' + toneColor + '">' + pol.polarity + ' (net ' + (netTone > 0 ? '+' : '') + netTone.toFixed(2) + ')</div>';
      if (Array.isArray(pol.recentPositive) && pol.recentPositive.length > 0) {
        html += '<div class="clr-dh-sect-row" style="color:rgba(90,181,160,0.7)">+ ' + pol.recentPositive[0] + '</div>';
      }
      if (Array.isArray(pol.recentNegative) && pol.recentNegative.length > 0) {
        html += '<div class="clr-dh-sect-row" style="color:#e85454">- ' + pol.recentNegative[0] + '</div>';
      }
    }

    // Long-term regime (Phase 2 step 3 — Domain Repair detail merge).
    // Pure projection of window.LIMENLongMemory.getRegime. Only renders
    // EXTREME / ELEVATED regimes; other / null values omitted.
    var _lm = window.LIMENLongMemory;
    if (_lm && typeof _lm.getRegime === 'function') {
      var regime = _lm.getRegime(dk, 30);
      if (regime === 'EXTREME' || regime === 'ELEVATED') {
        var regimeColor = regime === 'EXTREME' ? '#e85454' : '#FF9800';
        html += '<div class="clr-dh-sect-label">Long-term regime</div>';
        html += '<div class="clr-dh-sect-row" style="color:' + regimeColor + '">' + regime + '</div>';
      }
    }

    // Registry diagnoses (Phase 2 step 3 — Domain Repair detail merge).
    // Pure projection of window.LIMENRemedyRegistryManager.getDiagnosesForDomain.
    // Tagged [registry] to distinguish from brain diagnoses (rendered separately
    // below the grid). Up to 2 entries. Section omitted if list empty.
    var _mgr = window.LIMENRemedyRegistryManager;
    if (_mgr && typeof _mgr.getDiagnosesForDomain === 'function') {
      var _dxList = _mgr.getDiagnosesForDomain(dk) || [];
      if (_dxList.length > 0) {
        var _regChip = '<span style="display:inline-block;margin-left:6px;padding:0 4px;font-size:0.32rem;letter-spacing:1px;border-radius:2px;background:rgba(201,169,78,0.16);color:#C9A94E;text-transform:uppercase">[registry]</span>';
        html += '<div class="clr-dh-sect-label">Registry diagnoses' + _regChip + '</div>';
        for (var _dxi = 0; _dxi < Math.min(_dxList.length, 2); _dxi++) {
          var _dx = _dxList[_dxi];
          if (!_dx) continue;
          var _dxText = (_dx.severity ? (_dx.severity + ': ') : '') + (_dx.title || _dx.label || '');
          if (_dxText) {
            html += '<div class="clr-dh-sect-row">' + _dxText + '</div>';
          }
        }
      }
    }

    return html;
  }

  // Public _refreshDomains — wipe-protected wrapper.
  // The legacy implementation cleared _domainsEl.innerHTML BEFORE building
  // new content. Any exception inside the build (e.g. cs.provenance.financial_kernel
  // when a convergence signal lacks provenance, sources[si].live when an entry
  // is null, signals[0].label when signal[0] is undefined) left _domainsEl
  // blank and the 10s setInterval re-blanked it on every cycle — visible as
  // "page goes blank after load". Wrapper preserves prior DOM if the inner
  // build throws OR produces empty content.
  function _refreshDomains() {
    if (!_domainsEl) return;
    var prevHTML = _domainsEl.innerHTML;
    try {
      _refreshDomainsInner();
      // If inner finished without throwing but produced nothing renderable,
      // and we DID have content before, keep the prior content visible.
      if (_domainsEl.children.length === 0 && prevHTML.length > 0) {
        console.warn('[clarity] _refreshDomains produced empty DOM; preserving prior content');
        _domainsEl.innerHTML = prevHTML;
      }
    } catch (err) {
      console.warn('[clarity] _refreshDomains threw; preserving prior DOM:', err && (err.message || err));
      if (_domainsEl.innerHTML.length === 0 && prevHTML.length > 0) {
        _domainsEl.innerHTML = prevHTML;
      }
    }
  }

  // Gate B #9C.3 — Domain Health per-tile authority classifier.
  //
  // Doctrine carried:
  //   Zero-defaults are not neutral.
  //   Falsy fallback is not authority logic.
  //
  // The earlier per-tile build read
  //   var d = domains[dk] || { stress: 0, trend: 0 };
  // and then displayed 0% bars + "→" stable trend regardless of whether
  // the domain entry was absent or genuinely all-zero. The classifier
  // distinguishes:
  //   ABSENT             — no measurement at all (replaces fake-zero tile)
  //   FALLBACK           — domain present + has sources but all .live === false
  //   UNKNOWN            — measured but confidence not a finite number
  //   LOW / MODERATE     — measured + confidence below FULL threshold
  //   FULL               — measured + confidence >= 0.65
  //
  // _hasDomainMeasurement mirrors #9a's domain-repair-map predicate but
  // is local to console-clarity (different runtime, slightly different
  // signal set — includes brainTreatments, maturity, trend).

  function _hasDomainMeasurement(d) {
    if (!d) return false;
    if (typeof d.stress === 'number' && d.stress > 0) return true;
    if (typeof d.confidence === 'number' && d.confidence > 0) return true;
    if (typeof d.activity === 'number' && d.activity > 0) return true;
    if (typeof d.trend === 'number' && d.trend !== 0) return true;
    if (d.maturity && typeof d.maturity === 'string' && d.maturity.length > 0) return true;
    if (Array.isArray(d.signals) && d.signals.length > 0) return true;
    if (Array.isArray(d.sources) && d.sources.length > 0) return true;
    if (Array.isArray(d.brainTreatments) && d.brainTreatments.length > 0) return true;
    if (d.brainPhase) return true;
    return false;
  }

  function _classifyDomainTileAuthority(d, dk) {
    if (!d || !_hasDomainMeasurement(d)) {
      return {
        level: 'ABSENT',
        badge: null,
        bannerLabel: 'ABSENT — no measurement',
        reason: 'No measurement available for ' + (DOMAIN_LABELS[dk] || dk) + '.',
        suppressBody: true
      };
    }
    // FALLBACK — domain present, has sources, but no source is live
    var sources = Array.isArray(d.sources) ? d.sources : [];
    if (sources.length > 0) {
      var liveCount = 0, fallbackCount = 0;
      for (var i = 0; i < sources.length; i++) {
        if (!sources[i]) continue;
        if (sources[i].live) liveCount++;
        else fallbackCount++;
      }
      if (liveCount === 0 && fallbackCount > 0) {
        return {
          level: 'FALLBACK',
          badge: 'FALLBACK SOURCES · ' + fallbackCount + ' fallback / 0 live',
          bannerLabel: null,
          reason: null,
          suppressBody: false
        };
      }
    }
    // Confidence bands
    var hasConf = typeof d.confidence === 'number' && isFinite(d.confidence);
    if (!hasConf) {
      return { level: 'UNKNOWN', badge: 'CONFIDENCE UNKNOWN', bannerLabel: null, reason: null, suppressBody: false };
    }
    var conf = d.confidence;
    if (conf < 0.4) {
      return { level: 'LOW_CONFIDENCE', badge: 'LOW CONFIDENCE · ' + Math.round(conf * 100) + '%', bannerLabel: null, reason: null, suppressBody: false };
    }
    if (conf < 0.65) {
      return { level: 'MODERATE_CONFIDENCE', badge: 'MODERATE CONFIDENCE · ' + Math.round(conf * 100) + '%', bannerLabel: null, reason: null, suppressBody: false };
    }
    return { level: 'FULL', badge: null, bannerLabel: null, reason: null, suppressBody: false };
  }

  function _refreshDomainsInner() {
    if (!_domainsEl) return;
    _domainsEl.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'clr-section-title';
    title.textContent = 'DOMAIN HEALTH';
    _domainsEl.appendChild(title);

    // One-time click delegation for per-tile drilldown toggle.
    // Row carries data-dh-toggle; clicks on row or any of its children bubble
    // up and trigger the toggle. Meta / feed hint / drilldown are cell-siblings
    // of row and deliberately don't carry the attribute.
    if (!_domainHealthDelegated) {
      _domainHealthDelegated = true;
      _domainsEl.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== _domainsEl) {
          if (t.getAttribute && t.getAttribute('data-dh-toggle')) {
            var dk2 = t.getAttribute('data-dh-toggle');
            _domainHealthExpanded[dk2] = !_domainHealthExpanded[dk2];
            _refreshDomains();
            return;
          }
          t = t.parentNode;
        }
      });
    }

    var grid = document.createElement('div');
    grid.className = 'clr-domain-grid';

    var domains = window.LIMENDomains || {};

    for (var i = 0; i < DOMAIN_ORDER.length; i++) {
      var dk = DOMAIN_ORDER[i];

      // Gate B #9C.3 — explicit-ABSENT classification BEFORE zero-default
      // fallback. Earlier behavior: `domains[dk] || { stress: 0, trend: 0 }`
      // painted fake-zero bars on absent domains. New behavior: ABSENT
      // tile renders a minimal explanatory cell instead.
      var __rawD = domains[dk];
      var __tileAuth = _classifyDomainTileAuthority(__rawD, dk);

      if (__tileAuth.suppressBody) {
        // ABSENT tile — header (label) + banner + reason. No bars, no
        // trend arrow, no fake zero values.
        var __absentCell = document.createElement('div');
        __absentCell.className = 'clr-dh-absent';
        var __absLabel = document.createElement('div');
        __absLabel.className = 'clr-dh-absent-label';
        __absLabel.textContent = DOMAIN_LABELS[dk] || dk;
        __absentCell.appendChild(__absLabel);
        var __absBanner = document.createElement('span');
        __absBanner.className = 'clr-dh-absent-banner';
        __absBanner.textContent = __tileAuth.bannerLabel;
        __absentCell.appendChild(__absBanner);
        if (__tileAuth.reason) {
          var __absReason = document.createElement('span');
          __absReason.className = 'clr-dh-absent-reason';
          __absReason.textContent = __tileAuth.reason;
          __absentCell.appendChild(__absReason);
        }
        grid.appendChild(__absentCell);
        continue;
      }

      var d = __rawD;
      var stress = typeof d.stress === 'number' && isFinite(d.stress) ? d.stress : 0;
      var trend = typeof d.trend === 'number' && isFinite(d.trend) ? d.trend : 0;
      var activity = typeof d.activity === 'number' && isFinite(d.activity) ? d.activity : 0;
      var confidence = typeof d.confidence === 'number' && isFinite(d.confidence) ? d.confidence : 0;

      // Wrap row + feed hint in a container
      var cell = document.createElement('div');

      // Gate B #9C.3 — per-tile authority badge above the row.
      // FULL renders nothing. UNKNOWN / LOW / MODERATE / FALLBACK
      // render a small badge ABOVE the row. Body stays visible at
      // all levels — visual downgrade only.
      if (__tileAuth.badge) {
        var __tileBadgeCls = __tileAuth.level === 'LOW_CONFIDENCE' ? 'low'
                           : __tileAuth.level === 'MODERATE_CONFIDENCE' ? 'moderate'
                           : __tileAuth.level === 'FALLBACK' ? 'fallback'
                           : 'unknown';
        var __tileBadgeEl = document.createElement('div');
        __tileBadgeEl.className = 'clr-dh-tile-badge ' + __tileBadgeCls;
        __tileBadgeEl.textContent = __tileAuth.badge;
        cell.appendChild(__tileBadgeEl);
      }

      var row = document.createElement('div');
      row.className = 'clr-domain-row';
      row.setAttribute('data-dh-toggle', dk);

      var caret = document.createElement('span');
      caret.className = 'clr-dh-caret';
      caret.textContent = _domainHealthExpanded[dk] ? '\u25BE' : '\u25B8';
      row.appendChild(caret);

      var label = document.createElement('span');
      label.className = 'clr-domain-label';
      label.textContent = DOMAIN_LABELS[dk] || dk;
      // (appended after the globe, below — globe first, then name)

      // Rotating phase globe (color matches the connectome's per-domain phase)
      if (!document.getElementById('clr-globe-style')) {
        var _gs = document.createElement('style'); _gs.id = 'clr-globe-style';
        _gs.textContent =
          '.clr-domain-globe{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;margin:0 8px;position:relative;overflow:hidden;flex:none}' +
          '.clr-domain-globe::after{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-linear-gradient(90deg,rgba(40,28,8,0) 0 3px,rgba(35,24,6,0.5) 3px 4px);animation:clr-dspin 1.4s linear infinite}' +
          '.clr-domain-globe::before{content:"";position:absolute;left:20%;top:14%;width:28%;height:22%;border-radius:50%;background:rgba(255,250,235,0.7)}' +
          '@keyframes clr-dspin{from{background-position:0 0}to{background-position:4px 0}}';
        document.head.appendChild(_gs);
      }
      var _cid = ({ health:'medicine', research:'science', supplyChain:'trade' })[dk] || dk;
      var _ph = ({ governance:'P7',economy:'P1',infrastructure:'P4',energy:'P3',agriculture:'P2',industry:'P3',science:'P6',medicine:'P8',education:'P1',technology:'P6',communication:'P6',culture:'P9',defense:'P7',environment:'P0',religion:'P10',population:'P5',trade:'P5',law:'P4',finance:'P1',intelligence:'P9' })[_cid] || 'P0';
      var _pcol = ({ P0:'#1B2A4A',P1:'#F2CF5B',P2:'#2BA8A0',P3:'#7A6B9D',P4:'#4FB3D4',P5:'#A98C6B',P6:'#C3CAD4',P7:'#5478A8',P8:'#5A4FC0',P9:'#D8B85A',P10:'#EFA6B8' })[_ph] || '#B4C8DC';
      var _clrSh = function (h, a) { h = h.replace('#',''); var r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); if(a>=0){r+=(255-r)*a;g+=(255-g)*a;b+=(255-b)*a;}else{r*=(1+a);g*=(1+a);b*=(1+a);} return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')'; };
      var globe = document.createElement('span');
      globe.className = 'clr-domain-globe';
      globe.title = _ph + ' · ' + Math.round(stress * 100) + '%';
      globe.style.background = 'radial-gradient(circle at 33% 28%,' + _clrSh(_pcol,0.55) + ' 0%,' + _pcol + ' 44%,' + _clrSh(_pcol,-0.55) + ' 100%)';
      globe.style.boxShadow = '0 0 6px ' + _pcol + ',inset -2px -2px 3px rgba(0,0,0,0.5),inset 1px 1px 2px rgba(255,255,255,0.35)';
      row.appendChild(globe);
      row.appendChild(label);

      var val = document.createElement('span');
      val.className = 'clr-domain-val';
      val.textContent = Math.round(stress * 100) + '%';
      row.appendChild(val);

      var trendEl = document.createElement('span');
      trendEl.className = 'clr-domain-trend';
      if (trend > 0.03) { trendEl.textContent = '\u2191'; trendEl.style.color = '#e85454'; }
      else if (trend < -0.03) { trendEl.textContent = '\u2193'; trendEl.style.color = '#5ab5a0'; }
      else { trendEl.textContent = '\u2192'; trendEl.style.color = '#666'; }
      row.appendChild(trendEl);

      cell.appendChild(row);

      // Phase 23F: Maturity + confidence + activity display
      var maturity = d.maturity || '';
      var meta = document.createElement('div');
      meta.style.cssText = 'display:flex;gap:6px;align-items:center;padding:0 2px;margin-top:1px;flex-wrap:wrap';

      // Maturity badge
      if (maturity) {
        var matColors = { STRUCTURAL: '#e85454', CONFIRMED: '#FF9800', FORMING: '#C9A94E', EARLY: '#555' };
        var matEl = document.createElement('span');
        matEl.style.cssText = 'font-size:0.26rem;letter-spacing:0.8px;padding:1px 4px;border-radius:2px;background:' +
          (matColors[maturity] || '#555') + '22;color:' + (matColors[maturity] || '#555');
        matEl.textContent = maturity;
        meta.appendChild(matEl);
      }

      // Confidence badge
      if (confidence > 0) {
        var confLabel = confidence >= 0.65 ? 'HIGH' : (confidence >= 0.4 ? 'MED' : 'LOW');
        var confColor = confidence >= 0.65 ? 'rgba(90,181,160,0.6)' : (confidence >= 0.4 ? 'rgba(200,195,184,0.4)' : 'rgba(232,84,84,0.5)');
        var confEl = document.createElement('span');
        confEl.style.cssText = 'font-size:0.26rem;letter-spacing:0.5px;color:' + confColor;
        confEl.textContent = confLabel + ' CONF';
        meta.appendChild(confEl);
      }

      // Activity indicator
      if (activity > 0.1) {
        var actLevel = activity >= 0.7 ? 'HIGH' : (activity >= 0.3 ? 'MED' : 'LOW');
        var actEl = document.createElement('span');
        actEl.style.cssText = 'font-size:0.26rem;letter-spacing:0.5px;color:rgba(200,195,184,0.35)';
        actEl.textContent = actLevel + ' ACTIVITY';
        meta.appendChild(actEl);
      }

      // Phase badge — prefer real brain phase (from adapter); fall back to
      // Civilization-side Phase 24X provisional annotation ONLY when no
      // brain phase is available. Visually distinguish the two.
      var _brainPhase = d.brainPhase;
      var _brainPhaseLabel = d.brainPhaseLabel;
      if (_brainPhase) {
        var brainPhaseBadge = document.createElement('span');
        brainPhaseBadge.style.cssText = 'font-size:0.26rem;letter-spacing:0.8px;padding:1px 5px;border-radius:2px;' +
          'background:rgba(90,181,160,0.1);color:rgba(90,181,160,0.9)';
        brainPhaseBadge.textContent = String(_brainPhase).toUpperCase() + (_brainPhaseLabel ? ' ' + _brainPhaseLabel : '');
        brainPhaseBadge.title = 'Brain phase (projected from domain)';
        meta.appendChild(brainPhaseBadge);
        var brainPhaseSrc = document.createElement('span');
        brainPhaseSrc.className = 'clr-domain-phase-src clr-domain-phase-src-brain';
        brainPhaseSrc.textContent = '[brain-phase]';
        meta.appendChild(brainPhaseSrc);
      } else {
        var phaseAnn = (window.LIMENPhaseAnnotations || {})[dk];
        if (phaseAnn && phaseAnn.phase) {
          var phaseBadge = document.createElement('span');
          var supportAlpha = phaseAnn.phaseSupport === 'HIGH' ? 'cc' : (phaseAnn.phaseSupport === 'MEDIUM' ? '88' : '44');
          phaseBadge.style.cssText = 'font-size:0.26rem;letter-spacing:0.8px;padding:1px 5px;border-radius:2px;' +
            'background:' + phaseAnn.color + '22;color:' + phaseAnn.color + supportAlpha;
          phaseBadge.textContent = phaseAnn.phase.toUpperCase() + ' ' + phaseAnn.label + ' (PROV)';
          phaseBadge.title = 'Provisional phase estimate — no brain phase available (support: ' + phaseAnn.phaseSupport + ')';
          meta.appendChild(phaseBadge);
          var provPhaseSrc = document.createElement('span');
          provPhaseSrc.className = 'clr-domain-phase-src clr-domain-phase-src-prov';
          provPhaseSrc.textContent = '[provisional]';
          meta.appendChild(provPhaseSrc);
        }
      }

      if (meta.childNodes.length > 0) cell.appendChild(meta);

      // Feed hint: source name + top signal (from sources[]).
      // Defensive nullable access — sources / signals may contain undefined
      // entries depending on upstream signal-engine state.
      var sources = Array.isArray(d.sources) ? d.sources : [];
      var signals = Array.isArray(d.signals) ? d.signals : [];
      var hintParts = [];
      for (var si = 0; si < sources.length; si++) {
        var _ss = sources[si];
        if (_ss && _ss.live && _ss.label) {
          hintParts.push(_ss.label);
          break;
        }
      }
      function _sigText(s) {
        if (typeof s === 'string') return s;
        if (s && typeof s.label === 'string') return s.label;
        return '';
      }
      if (signals.length > 0 && hintParts.length === 0) {
        var sigText = _sigText(signals[0]);
        if (sigText) hintParts.push(sigText);
      } else if (signals.length > 0 && hintParts.length > 0) {
        var sigText2 = _sigText(signals[0]);
        if (sigText2 && sigText2 !== hintParts[0]) {
          if (sigText2.length > 28) sigText2 = sigText2.substring(0, 25) + '...';
          hintParts.push(sigText2);
        }
      }
      if (hintParts.length > 0) {
        var hint = document.createElement('div');
        hint.style.cssText = 'font-size:0.36rem;color:#666;padding:0 0 2px 80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        hint.textContent = hintParts.join(' \u00b7 ');
        cell.appendChild(hint);
      }

      // Per-tile drilldown (Phase 2 step 1 — Domain Panel merge)
      if (_domainHealthExpanded[dk]) {
        var drill = document.createElement('div');
        drill.className = 'clr-dh-drill';
        drill.innerHTML = _buildDomainHealthDrill(dk, d);
        cell.appendChild(drill);
      }

      grid.appendChild(cell);
    }

    _domainsEl.appendChild(grid);

    // ── Phase 25: Convergence signals display ──
    var snap = window.LIMENFastBoot ? window.LIMENFastBoot.getConsoleSnapshotSync() : null;
    var convSignals = (snap && snap.convergenceSignals) || {};
    var convKeys = Object.keys(convSignals);
    if (convKeys.length > 0) {
      var convTitle = document.createElement('div');
      convTitle.className = 'clr-section-title';
      convTitle.style.cssText = 'margin-top:8px;color:#e85454';
      convTitle.textContent = 'CONVERGENCE SIGNALS';
      _domainsEl.appendChild(convTitle);

      var SIGNAL_COLORS = { CONVERGENCE_TERMINAL: '#e85454', CONVERGENCE_INSTABILITY: '#FF9800', DOMAIN_STRUCTURAL: '#C9A94E', COMPANY_FAILURE_CLUSTER: '#8B5CF6' };

      for (var csi = 0; csi < convKeys.length; csi++) {
        var cs = convSignals[convKeys[csi]];
        if (!cs) continue;
        // Defensive defaults — convergence signal payload shape is upstream
        // and may omit fields. Missing data must NOT throw and wipe the page.
        var primary       = (typeof cs.primary_signal === 'string') ? cs.primary_signal : 'UNKNOWN';
        var domainIdU     = (typeof cs.domain_id === 'string') ? cs.domain_id.toUpperCase() : '';
        var domainStress  = (typeof cs.domain_stress === 'number') ? cs.domain_stress : 0;
        var p7a           = (cs.p7a_count != null) ? cs.p7a_count : '?';
        var p3            = (cs.p3_count  != null) ? cs.p3_count  : '?';
        var mappedTotal   = (cs.mapped_company_count != null) ? cs.mapped_company_count : '?';
        var prov          = cs.provenance || {};
        var secondary     = Array.isArray(cs.secondary_signals) ? cs.secondary_signals : [];
        var companies     = Array.isArray(cs.companies) ? cs.companies : [];
        var csColor = SIGNAL_COLORS[primary] || '#888';

        var csCard = document.createElement('div');
        csCard.style.cssText = 'padding:4px 6px;margin:3px 0;border-left:3px solid ' + csColor + ';background:rgba(0,0,0,0.15)';

        var csHeader = '<div style="display:flex;align-items:baseline;gap:6px">';
        csHeader += '<span style="font-size:0.36rem;color:' + csColor + ';font-weight:bold;letter-spacing:0.8px">' + primary.replace(/_/g, ' ') + '</span>';
        csHeader += '<span style="font-size:0.3rem;color:rgba(200,195,184,0.5)">' + domainIdU + ' ' + Math.round(domainStress * 100) + '%</span>';
        csHeader += '</div>';

        csHeader += '<div style="font-size:0.28rem;color:rgba(200,195,184,0.35);margin-top:2px">';
        csHeader += 'P7a: ' + p7a + '/' + mappedTotal;
        csHeader += ' P3: '  + p3  + '/' + mappedTotal;
        if (companies.length > 0) {
          csHeader += ' [' + companies.map(function (c) {
            if (!c) return '';
            return (c.ticker || '?') + ':' + (c.phase || '?');
          }).filter(function (s) { return s; }).join(', ') + ']';
        }
        csHeader += '</div>';

        csHeader += '<div style="font-size:0.24rem;color:rgba(200,195,184,0.2);margin-top:1px;letter-spacing:0.5px">';
        csHeader += prov.financial_kernel ? 'Phase tracker (Thing 2 — interpretive)' : 'Domain Model Only';
        if (secondary.length > 0) {
          csHeader += ' + ' + secondary.map(function (s) { return typeof s === 'string' ? s : ''; })
                                       .filter(function (s) { return s; })
                                       .join(', ').replace(/_/g, ' ');
        }
        csHeader += '</div>';

        csCard.innerHTML = csHeader;
        _domainsEl.appendChild(csCard);
      }
    }

    // "GENERATED FOR CURRENT CONDITIONS" REMOVED.
    // That section rendered Civilization-side synthesized PROVISIONAL
    // diagnoses from LIMENGapSynthesis, which competed with real domain
    // brain diagnoses. Civilization is an observatory, not a parallel
    // domain-health generator. Real domain diagnoses are shown in the
    // DOMAIN BRAIN INTELLIGENCE section below, sourced from each brain's
    // window.LIMENDomains[key].brainDiagnoses via the adapter.

    // ── Brain Diagnoses: sovereign domain-brain intelligence (all domains, collapsible) ──
    var _bdDomains = window.LIMENDomains || {};
    var _bdNow = Date.now();
    var _bdDomainsWithData = [];

    // Include any domain that has ANY real brain payload transferred into runtime state
    function _bdHasBrainPayload(d) {
      if (!d) return false;
      if (Array.isArray(d.brainDiagnoses) && d.brainDiagnoses.length > 0) return true;
      if (Array.isArray(d.brainTreatments) && d.brainTreatments.length > 0) return true;
      if (Array.isArray(d.brainOpportunities) && d.brainOpportunities.length > 0) return true;
      if (d.brainPhase || d.brainPhaseLabel) return true;
      if (typeof d.brainStress === 'number' || typeof d.brainConfidence === 'number') return true;
      if (Array.isArray(d.brainEmissions) && d.brainEmissions.length > 0) return true;
      if (d.brainStatus) return true;
      if (d.brainUpdated) return true;
      return false;
    }

    for (var _bdi = 0; _bdi < DOMAIN_ORDER.length; _bdi++) {
      var _bdKey = DOMAIN_ORDER[_bdi];
      var _bdData = _bdDomains[_bdKey];
      if (!_bdHasBrainPayload(_bdData)) continue;
      _bdDomainsWithData.push(_bdKey);
    }

    if (_bdDomainsWithData.length > 0) {
      var _bdSectionTitle = document.createElement('div');
      _bdSectionTitle.className = 'clr-section-title';
      _bdSectionTitle.style.cssText = 'margin-top:8px;color:rgba(120,210,180,0.98)';
      _bdSectionTitle.textContent = 'DOMAIN BRAIN INTELLIGENCE';
      _domainsEl.appendChild(_bdSectionTitle);

      var _bdContainer = document.createElement('div');
      _bdContainer.setAttribute('data-brain-container', '1');
      _domainsEl.appendChild(_bdContainer);

      for (var _bdj = 0; _bdj < _bdDomainsWithData.length; _bdj++) {
        var _domKey = _bdDomainsWithData[_bdj];
        var _domData = _bdDomains[_domKey];
        var _domDx = _domData.brainDiagnoses || [];
        var _domFreshActive = _domDx.filter(function (dx) { return dx.active && !dx._heldActive; });
        var _domHeldActive = _domDx.filter(function (dx) { return dx.active && dx._heldActive; });
        var _domInactive = _domDx.filter(function (dx) { return !dx.active; });
        var _domTx = Array.isArray(_domData.brainTreatments) ? _domData.brainTreatments : [];
        var _domOpps = Array.isArray(_domData.brainOpportunities) ? _domData.brainOpportunities : [];

        // Hold-last-nonempty cache (kept as safety net for fresh-empty, no held)
        var _domIsStaleCache = false;
        var _domStaleAgeMs = 0;
        if (_domFreshActive.length === 0 && _domHeldActive.length === 0) {
          var _domCached = _brainDxCache[_domKey];
          if (_domCached && _domCached.activeDx && _domCached.activeDx.length > 0) {
            _domStaleAgeMs = _bdNow - _domCached.capturedAt;
            if (_domStaleAgeMs < _BD_CACHE_TTL) {
              _domFreshActive = _domCached.activeDx;
              _domIsStaleCache = true;
            }
          }
        } else if (_domFreshActive.length > 0) {
          _brainDxCache[_domKey] = { activeDx: _domFreshActive, capturedAt: _bdNow };
        }

        var _totalActive = _domFreshActive.length + _domHeldActive.length;
        var _isExpanded = !!_brainSectionExpanded[_domKey];

        // Build section
        var _domSection = document.createElement('div');
        var _sectionBorder = _totalActive > 0 ? 'rgba(90,181,160,0.4)' : 'rgba(200,195,184,0.12)';
        _domSection.style.cssText = 'margin:3px 0;border-left:3px solid ' + _sectionBorder + ';background:rgba(0,0,0,0.1)';

        // Header (clickable)
        var _domHeader = document.createElement('div');
        _domHeader.setAttribute('data-brain-domain', _domKey);
        _domHeader.style.cssText = 'padding:4px 6px;cursor:pointer;display:flex;align-items:baseline;gap:6px;user-select:none';

        var _statusColor;
        var _statusText;
        var _statusTitle = '';
        if (_totalActive > 0) {
          _statusColor = 'rgba(120,210,180,0.95)';
          _statusText = _totalActive + ' ACTIVE';
        } else if (_domDx.length > 0) {
          // Stress-aware disambiguation. When the brain has diagnoses in
          // state but none matched conditions, surface elevated stress
          // as a distinct badge so a stressed-but-unmapped domain stops
          // looking calm. Reads existing brain state only — no new field.
          var _domStress = (typeof _domData.brainStress === 'number') ? _domData.brainStress
                         : (typeof _domData.stress === 'number') ? _domData.stress : 0;
          if (_domStress >= 0.55) {
            _statusColor = 'rgba(215,185,95,0.85)';
            _statusText = 'STRESSED / NO DX MATCH';
            _statusTitle = 'Stress is elevated but no diagnosis trigger matched.';
          } else {
            _statusColor = 'rgba(210,205,195,0.55)';
            _statusText = 'NO ACTIVE DX';
          }
        } else if (_domTx.length > 0 || _domOpps.length > 0) {
          _statusColor = 'rgba(215,185,95,0.75)';
          _statusText = 'DATA ONLY';
        } else {
          _statusColor = 'rgba(200,195,184,0.4)';
          _statusText = 'LOADING';
        }

        var _caret = _isExpanded ? '\u25BE' : '\u25B8'; // ▾ / ▸
        var _headerHtml = '<span style="font-size:0.32rem;color:rgba(201,169,78,0.65);width:10px">' + _caret + '</span>';
        _headerHtml += '<span style="font-size:0.3rem;letter-spacing:0.8px;padding:1px 4px;border-radius:2px;background:rgba(90,181,160,0.15);color:rgba(120,200,180,0.95)">BRAIN</span>';
        _headerHtml += '<span style="font-size:0.36rem;color:rgba(230,225,215,0.92)">' + (DOMAIN_LABELS[_domKey] || _domKey).toUpperCase() + '</span>';
        _headerHtml += '<span style="font-size:0.28rem;color:' + _statusColor + ';margin-left:auto"' + (_statusTitle ? ' title="' + _statusTitle + '"' : '') + '>' + _statusText + '</span>';
        _domHeader.innerHTML = _headerHtml;
        _domSection.appendChild(_domHeader);

        // Sub-summary line (always visible) — real brain fields only
        var _subSummary = document.createElement('div');
        _subSummary.style.cssText = 'padding:0 6px 4px 22px;font-size:0.26rem;color:rgba(210,205,195,0.6);letter-spacing:0.5px';
        var _summaryParts = [];
        _summaryParts.push('dx ' + _totalActive + '/' + _domDx.length + ' active');
        if (_domHeldActive.length > 0) _summaryParts.push(_domHeldActive.length + ' held');
        if (_domIsStaleCache) _summaryParts.push('stale ' + Math.round(_domStaleAgeMs / 1000) + 's');
        _summaryParts.push('tx ' + _domTx.length);
        _summaryParts.push('opp ' + _domOpps.length);
        if (_domData.brainPhase) _summaryParts.push((_domData.brainPhase + '').toLowerCase());
        if (_domData.brainUpdated) {
          var _ageSec = Math.max(0, Math.round((_bdNow - _domData.brainUpdated) / 1000));
          _summaryParts.push(_ageSec + 's ago');
        }
        _subSummary.textContent = _summaryParts.join(' \u00b7 ');
        _domSection.appendChild(_subSummary);

        // Body (expanded only)
        if (_isExpanded) {
          var _body = document.createElement('div');
          _body.style.cssText = 'padding:4px 6px 6px 22px;border-top:1px solid rgba(201,169,78,0.06)';

          var _addLabel = function (text) {
            var _el = document.createElement('div');
            _el.style.cssText = 'font-size:0.24rem;letter-spacing:1px;color:rgba(215,185,95,0.75);margin:4px 0 2px';
            _el.textContent = text;
            _body.appendChild(_el);
          };

          var _addDx = function (dx, tone) {
            var _dxEl = document.createElement('div');
            var _border = tone === 'active' ? 'rgba(90,181,160,0.6)' : (tone === 'held' ? 'rgba(215,185,95,0.5)' : 'rgba(200,195,184,0.2)');
            // Brighter label alpha for active; moderate for held; still readable for inactive
            var _txtAlpha = tone === 'active' ? '0.95' : (tone === 'held' ? '0.75' : '0.5');
            var _summaryAlpha = tone === 'active' ? '0.6' : (tone === 'held' ? '0.5' : '0.4');
            _dxEl.style.cssText = 'padding:2px 6px;margin:2px 0;border-left:2px solid ' + _border + ';background:rgba(0,0,0,0.08)';
            var _h = '<div style="display:flex;align-items:baseline;gap:6px">';
            _h += '<span style="font-size:0.34rem;color:rgba(235,228,215,' + _txtAlpha + ')">' + (dx.label || dx.id) + '</span>';
            if (tone === 'held') _h += '<span style="font-size:0.24rem;letter-spacing:0.8px;color:rgba(215,185,95,0.8)">HELD</span>';
            if (tone === 'inactive') _h += '<span style="font-size:0.24rem;letter-spacing:0.8px;color:rgba(200,195,184,0.45)">INACTIVE</span>';
            _h += '<span style="font-size:0.24rem;color:rgba(200,195,184,0.4);margin-left:auto">rel ' + ((dx.relevance || 0) * 100).toFixed(0) + '%</span>';
            _h += '</div>';
            if (dx.summary) _h += '<div style="font-size:0.28rem;color:rgba(210,205,195,' + _summaryAlpha + ');margin-top:1px">' + dx.summary.substring(0, 120) + '</div>';
            _dxEl.innerHTML = _h;
            _body.appendChild(_dxEl);
          };

          // 1. Active diagnoses
          if (_domFreshActive.length > 0 || _domHeldActive.length > 0) {
            _addLabel('ACTIVE DIAGNOSES');
            var _dxi;
            for (_dxi = 0; _dxi < Math.min(_domFreshActive.length, 5); _dxi++) _addDx(_domFreshActive[_dxi], _domIsStaleCache ? 'held' : 'active');
            for (_dxi = 0; _dxi < Math.min(_domHeldActive.length, 5); _dxi++) _addDx(_domHeldActive[_dxi], 'held');
          }
          // 2. Inactive diagnoses
          if (_domInactive.length > 0) {
            _addLabel('INACTIVE DIAGNOSES');
            for (var _indxi = 0; _indxi < Math.min(_domInactive.length, 5); _indxi++) _addDx(_domInactive[_indxi], 'inactive');
          }

          // 3. Treatments (up to 5) — active treatments get brighter label
          if (_domTx.length > 0) {
            _addLabel('TREATMENTS');
            for (var _txi = 0; _txi < Math.min(_domTx.length, 5); _txi++) {
              var _txx = _domTx[_txi];
              if (!_txx || !_txx.label) continue;
              var _txEl = document.createElement('div');
              _txEl.style.cssText = 'padding:1px 6px;margin:1px 0;font-size:0.3rem;color:rgba(230,225,215,0.78);border-left:1px solid rgba(90,181,160,0.3)';
              var _txText = _txx.label;
              if (_txx.evidence) _txText += ' [' + _txx.evidence + ']';
              if (_txx.type) _txText += ' \u00b7 ' + _txx.type;
              _txEl.textContent = _txText;
              _body.appendChild(_txEl);
            }
          }

          // 4. Opportunities (up to 5) — active opportunities get brighter label
          if (_domOpps.length > 0) {
            _addLabel('OPPORTUNITIES');
            for (var _opi = 0; _opi < Math.min(_domOpps.length, 5); _opi++) {
              var _opp = _domOpps[_opi];
              if (!_opp || !_opp.title) continue;
              var _opEl = document.createElement('div');
              _opEl.style.cssText = 'padding:1px 6px;margin:1px 0;font-size:0.3rem;color:rgba(230,225,215,0.78);border-left:1px solid rgba(215,185,95,0.4)';
              var _opMeta = [];
              if (_opp.path) _opMeta.push(_opp.path);
              if (_opp.urgency) _opMeta.push(_opp.urgency);
              var _opText = _opp.title + (_opMeta.length ? ' [' + _opMeta.join(' \u00b7 ') + ']' : '');
              _opEl.textContent = _opText;
              _body.appendChild(_opEl);
            }
          }

          // 5. Cross-domain emissions (up to 5)
          if (Array.isArray(_domData.brainEmissions) && _domData.brainEmissions.length > 0) {
            _addLabel('CROSS-DOMAIN EMISSIONS');
            for (var _emi = 0; _emi < Math.min(_domData.brainEmissions.length, 5); _emi++) {
              var _em = _domData.brainEmissions[_emi];
              if (!_em) continue;
              var _emEl = document.createElement('div');
              _emEl.style.cssText = 'padding:1px 6px;margin:1px 0;font-size:0.28rem;color:rgba(210,205,195,0.7);border-left:1px solid rgba(138,181,210,0.35)';
              var _emParts = [];
              if (_em.targetDomain) _emParts.push('\u2192 ' + String(_em.targetDomain).toUpperCase());
              if (_em.signal) _emParts.push(String(_em.signal));
              if (typeof _em.magnitude === 'number') _emParts.push('mag ' + _em.magnitude.toFixed(2));
              _emEl.textContent = _emParts.length ? _emParts.join(' \u00b7 ') : JSON.stringify(_em).substring(0, 80);
              _body.appendChild(_emEl);
            }
          }

          // 6. Brain metadata (real fields only)
          var _metaLines = [];
          if (_domData.brainPhase || _domData.brainPhaseLabel) {
            var _phaseText = (_domData.brainPhase || '').toString().toUpperCase();
            if (_domData.brainPhaseLabel) _phaseText += ' ' + _domData.brainPhaseLabel;
            _metaLines.push('phase ' + _phaseText);
          }
          if (typeof _domData.brainStress === 'number') _metaLines.push('brain stress ' + _domData.brainStress.toFixed(2));
          if (typeof _domData.brainConfidence === 'number') _metaLines.push('conf ' + (_domData.brainConfidence * 100).toFixed(0) + '%');
          if (_domData.brainStatus) _metaLines.push('status ' + _domData.brainStatus);
          if (_domData.brainUpdated) {
            var _ageS = Math.max(0, Math.round((_bdNow - _domData.brainUpdated) / 1000));
            _metaLines.push('updated ' + _ageS + 's ago');
          }
          if (_metaLines.length > 0) {
            _addLabel('BRAIN METADATA');
            var _metaEl = document.createElement('div');
            _metaEl.style.cssText = 'padding:1px 6px;font-size:0.26rem;color:rgba(210,205,195,0.65);letter-spacing:0.5px';
            _metaEl.textContent = _metaLines.join(' \u00b7 ');
            _body.appendChild(_metaEl);
          }

          _domSection.appendChild(_body);
        }

        _bdContainer.appendChild(_domSection);
      }

      // Delegate click handler once — toggles expanded state and re-renders
      if (!_brainSectionDelegated) {
        _brainSectionDelegated = true;
        document.addEventListener('click', function (e) {
          var el = e.target;
          while (el && el !== document.body) {
            if (el.getAttribute && el.getAttribute('data-brain-domain')) {
              var k = el.getAttribute('data-brain-domain');
              _brainSectionExpanded[k] = !_brainSectionExpanded[k];
              _refreshDomains();
              return;
            }
            el = el.parentNode;
          }
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Top Events
  // ═══════════════════════════════════════════════════════════════════════════

  function _refreshEvents() {
    if (!_eventsEl) return;
    _eventsEl.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'clr-card-title';
    title.textContent = 'TOP EVENTS';
    _eventsEl.appendChild(title);

    var esc = window.LIMENEscalation;
    var items = [];

    if (esc && esc.tiers) {
      var tiers = ['immediate', 'developing', 'watch'];
      for (var t = 0; t < tiers.length; t++) {
        var tierItems = esc.tiers[tiers[t]] || [];
        for (var i = 0; i < tierItems.length; i++) {
          items.push({ item: tierItems[i], tier: tiers[t] });
        }
      }
    }

    if (items.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.5rem;color:#666;font-style:italic;padding:8px 0;';
      empty.textContent = 'No active events.';
      _eventsEl.appendChild(empty);
      return;
    }

    // Take top 3
    for (var j = 0; j < Math.min(items.length, 3); j++) {
      var entry = items[j];
      var row = document.createElement('div');
      row.className = 'clr-event-item';

      var tierBadge = document.createElement('span');
      tierBadge.className = 'clr-event-tier clr-tier-' + entry.tier;
      tierBadge.textContent = entry.tier === 'immediate' ? 'IMM' : (entry.tier === 'developing' ? 'DEV' : 'WTH');
      row.appendChild(tierBadge);

      var labelEl = document.createElement('span');
      labelEl.className = 'clr-event-label';
      labelEl.textContent = entry.item.label || entry.item.domain || 'event';
      row.appendChild(labelEl);

      var scoreEl = document.createElement('span');
      scoreEl.className = 'clr-event-score';
      scoreEl.textContent = entry.item.score ? entry.item.score.toFixed(2) : '';
      row.appendChild(scoreEl);

      _eventsEl.appendChild(row);

      // Decision context: type + stress + trend
      var evCtx = [];
      if (entry.item.type === 'cross-domain') evCtx.push('cross-domain');
      if (entry.item.stress > 0) evCtx.push('stress ' + entry.item.stress.toFixed(2));
      if (entry.item.trend > 0.02) evCtx.push('\u2191');
      else if (entry.item.trend < -0.02) evCtx.push('\u2193');
      if (entry.item.confidence > 0) evCtx.push('conf ' + Math.round(entry.item.confidence * 100) + '%');
      if (evCtx.length > 0) {
        var evCtxEl = document.createElement('div');
        evCtxEl.style.cssText = 'font-size:0.36rem;color:#555;padding:0 0 2px 28px;letter-spacing:0.5px;';
        evCtxEl.textContent = evCtx.join(' \u00b7 ');
        _eventsEl.appendChild(evCtxEl);
      }

      // Narrator observation merge (Phase 2 step 2 — Narrator Panel → Event Rail rows).
      // Pure projection of window.LIMENEventNarrator.getObservationFor(domain).
      // Omits the subordinate line when no matching narration is defined.
      var _narrator = window.LIMENEventNarrator;
      var _narration = (_narrator && typeof _narrator.getObservationFor === 'function')
        ? _narrator.getObservationFor(entry.item.domain)
        : null;
      if (_narration) {
        var narEl = document.createElement('div');
        narEl.style.cssText = 'font-size:0.36rem;color:#666;padding:0 0 3px 28px;letter-spacing:0.5px;font-style:italic;';
        narEl.textContent = _narration;
        _eventsEl.appendChild(narEl);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Recommended Actions
  // ═══════════════════════════════════════════════════════════════════════════

  function _refreshActions() {
    if (!_actionsEl) return;
    _actionsEl.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'clr-card-title';
    title.textContent = 'RECOMMENDED ACTIONS';
    _actionsEl.appendChild(title);

    var mgr = window.LIMENRemedyRegistryManager;
    var actions = [];
    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    var allTx = [];
    var _mgrHasTx = !!(mgr && mgr.stats && mgr.stats().treatments > 0);

    // Collect per-domain: prefer brain treatments, else use registry when available.
    // Brain treatments are collected unconditionally so they reach the render even
    // when the registry is empty (no portal harvest + no synthetic fabrication).
    for (var i = 0; i < dk.length; i++) {
      var d = domains[dk[i]];
      var _raBrainTx = (d && Array.isArray(d.brainTreatments) && d.brainTreatments.length > 0)
        ? d.brainTreatments.filter(function (t) { return t && t.label; })
        : null;

      if (_raBrainTx && _raBrainTx.length > 0) {
        for (var _rati = 0; _rati < _raBrainTx.length; _rati++) {
          allTx.push({
            id: _raBrainTx[_rati].id || (dk[i] + '_brain_' + _rati),
            title: _raBrainTx[_rati].label,
            _domainKey: dk[i],
            _brainSource: true
          });
        }
      } else if (_mgrHasTx) {
        var txList = mgr.getTreatmentsOnDomainStress(dk[i], d.stress || 0);
        var ctx = {};
        ctx[dk[i]] = d.stress || 0;
        var prioritized = mgr.prioritize(txList, { domainStress: ctx });
        for (var ti = 0; ti < prioritized.length; ti++) {
          prioritized[ti]._domainKey = dk[i];
          allTx.push(prioritized[ti]);
        }
      }
    }
    // Deduplicate by id and take top actions with domain tag
    var seen = {};
    for (var a = 0; a < allTx.length; a++) {
      if (!seen[allTx[a].id]) {
        seen[allTx[a].id] = true;
        actions.push({
          title: allTx[a].title || allTx[a].id,
          domain: allTx[a]._domainKey || dk[Math.min(a, dk.length - 1)] || '',
          _brainSource: !!allTx[a]._brainSource
        });
      }
      if (actions.length >= 4) break;
    }

    if (actions.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.5rem;color:#666;font-style:italic;padding:8px 0;';
      empty.textContent = 'No actions available. Generate a report.';
      _actionsEl.appendChild(empty);
      return;
    }

    for (var j = 0; j < actions.length; j++) {
      var item = document.createElement('div');
      item.className = 'clr-action-item';
      var domTag = actions[j].domain ? actions[j].domain.slice(0, 5).toUpperCase() + ': ' : '';
      item.textContent = domTag + actions[j].title;
      var _isBrain = !!actions[j]._brainSource;
      var provChip = document.createElement('span');
      provChip.className = 'clr-action-prov ' + (_isBrain ? 'clr-action-prov-brain' : 'clr-action-prov-registry');
      provChip.textContent = _isBrain ? '[brain]' : '[registry]';
      item.appendChild(provChip);
      _actionsEl.appendChild(item);

      // Feed-attributed context: source name + value, then signal
      var _actDom = actions[j].domain;
      var _actDomData = (_actDom && domains[_actDom]) ? domains[_actDom] : null;
      if (_actDomData) {
        var ctxParts = [];
        // Prefer source name + label (e.g., "FRED: unemployment 3.8%")
        var _actSources = _actDomData.sources || [];
        for (var _asi = 0; _asi < _actSources.length; _asi++) {
          if (_actSources[_asi].live && _actSources[_asi].label) {
            var srcName = _actSources[_asi].name || '';
            var srcLabel = _actSources[_asi].label || '';
            if (srcName.length > 12) srcName = srcName.substring(0, 10) + '..';
            if (srcLabel.length > 25) srcLabel = srcLabel.substring(0, 22) + '...';
            ctxParts.push(srcName ? srcName + ': ' + srcLabel : srcLabel);
            break;
          }
        }
        // Add top signal if no source found, or if it adds information
        if (ctxParts.length === 0) {
          var _actSig = (_actDomData.signals && _actDomData.signals.length > 0) ? _actDomData.signals[0] : null;
          if (_actSig) {
            var sigText = typeof _actSig === 'string' ? _actSig : (_actSig.label || '');
            if (sigText.length > 35) sigText = sigText.substring(0, 32) + '...';
            if (sigText) ctxParts.push(sigText);
          }
        }
        // Fallback: stress score only if nothing else available
        if (ctxParts.length === 0 && _actDomData.stress > 0.3) {
          ctxParts.push('stress ' + _actDomData.stress.toFixed(2));
        }
        if (ctxParts.length > 0) {
          var ctxEl = document.createElement('div');
          ctxEl.style.cssText = 'font-size:0.38rem;color:#666;padding:0 0 2px 12px;letter-spacing:0.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          ctxEl.textContent = ctxParts.join(' \u00b7 ');
          _actionsEl.appendChild(ctxEl);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Master Brain Handoff Queue  (Patch B)
  // Reads window.LIMENMainBrainHandoff produced by
  // assets/js/civilization/handoff-contract.js (Step 1).
  // ═══════════════════════════════════════════════════════════════════════════

  function _handoffLaneLabel(lane) {
    return HANDOFF_LANE_LABELS[lane] || (lane || 'unknown');
  }

  function _handoffLaneSingular(lane) {
    return HANDOFF_LANE_LABELS_SINGULAR[lane] || _handoffLaneLabel(lane);
  }

  function _handoffLaneDescription(lane) {
    return HANDOFF_LANE_DESCRIPTIONS[lane] || '';
  }

  // Capitalize first letter only of a domain id (e.g., 'energy' -> 'Energy').
  // Pure presentation; never modifies the underlying data.
  function _handoffCapDomain(d) {
    if (!d || typeof d !== 'string') return '';
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function _handoffJoinDomains(domains) {
    if (!Array.isArray(domains)) return '';
    var capped = [];
    for (var i = 0; i < domains.length; i++) {
      var c = _handoffCapDomain(domains[i]);
      if (c) capped.push(c);
    }
    return capped.join(' + ');
  }

  function _handoffJoinDomainsList(domains) {
    if (!Array.isArray(domains)) return '';
    var capped = [];
    for (var i = 0; i < domains.length; i++) {
      var c = _handoffCapDomain(domains[i]);
      if (c) capped.push(c);
    }
    return capped.join(', ');
  }

  function _escHandoff(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Manager-readable title fallback. Upstream packets do not currently
  // carry a `title` field; until they do, derive a title from sourceDomains
  // or sourceDiagnoses. When upstream fills packet.title, this fallback
  // becomes dormant rather than primary. (Risk note tracked separately.)
  function _handoffPacketTitle(p, lane) {
    if (!p) return 'Handoff packet candidate';
    if (p.title) return p.title;
    var laneSing = _handoffLaneSingular(lane);
    var sourceDomains = Array.isArray(p.sourceDomains) ? p.sourceDomains : [];
    if (sourceDomains.length > 0) {
      var joined = _handoffJoinDomains(sourceDomains);
      if (joined) return laneSing + ' candidate — ' + joined;
    }
    var sourceDx = Array.isArray(p.sourceDiagnoses) ? p.sourceDiagnoses : [];
    if (sourceDx.length > 0) {
      var first = sourceDx[0];
      var firstLabel = (first && (first.label || first.id)) || '';
      if (firstLabel) return laneSing + ' candidate — ' + firstLabel;
    }
    return 'Handoff packet candidate';
  }

  function _renderHandoffPacket(p, lane) {
    if (!p) return '<div class="clr-handoff-packet-empty">Packet missing.</div>';
    var managerTitle = _handoffPacketTitle(p, lane);
    var packetId = p.opportunityId || '';

    var sourceDomains = Array.isArray(p.sourceDomains) ? p.sourceDomains : [];
    var domainsStr = _handoffJoinDomainsList(sourceDomains);

    var dxLabels = [];
    if (Array.isArray(p.sourceDiagnoses)) {
      for (var di = 0; di < p.sourceDiagnoses.length; di++) {
        var dx = p.sourceDiagnoses[di];
        if (dx && (dx.label || dx.id)) dxLabels.push(dx.label || dx.id);
      }
    }
    var dxStr = '';
    if (dxLabels.length > 0) {
      if (dxLabels.length > 4) {
        dxStr = dxLabels.slice(0, 4).join('; ') + '; and ' + (dxLabels.length - 4) + ' more';
      } else {
        dxStr = dxLabels.join('; ');
      }
    }

    var nodeCount = Array.isArray(p.supportingNodes) ? p.supportingNodes.length : 0;
    var ev = (typeof p.evidenceQuality === 'number') ? p.evidenceQuality.toFixed(2) : null;
    var conf = (typeof p.confidence === 'number') ? p.confidence.toFixed(2) : null;
    var rationale = p.rationale || '';

    var html = '<div class="clr-handoff-packet">';
    html += '<div class="clr-handoff-packet-title">' + _escHandoff(managerTitle) + '</div>';
    if (packetId) {
      html += '<div class="clr-handoff-packet-id">Packet ID: ' + _escHandoff(packetId) + '</div>';
    }

    // Per-line metadata rows.
    if (domainsStr) {
      html += '<div class="clr-handoff-packet-row"><b>Source domains:</b> ' + _escHandoff(domainsStr) + '</div>';
    }
    if (dxStr) {
      html += '<div class="clr-handoff-packet-row"><b>Detected problems:</b> ' + _escHandoff(dxStr) + '</div>';
    }
    if (nodeCount > 0) {
      html += '<div class="clr-handoff-packet-row"><b>Supporting nodes:</b> ' + nodeCount + '</div>';
    }
    if (ev !== null) {
      html += '<div class="clr-handoff-packet-row"><b>Evidence quality:</b> ' + ev + '</div>';
    }
    if (conf !== null) {
      html += '<div class="clr-handoff-packet-row"><b>Confidence:</b> ' + conf + '</div>';
    }

    // Status row — explicit, manager-readable.
    if (p.readyForGeneration) {
      html += '<div class="clr-handoff-packet-status-ready"><b>Status:</b> Ready for draft review</div>';
    } else {
      html += '<div class="clr-handoff-packet-status-pending"><b>Status:</b> Pending review</div>';
    }

    if (rationale) {
      html += '<div class="clr-handoff-packet-rationale"><b>Rationale:</b> ' + _escHandoff(rationale) + '</div>';
    }

    // "Why this exists" — only when conditions are met. No invented reasons.
    if (sourceDomains.length >= 2 && nodeCount >= 1) {
      html += '<div class="clr-handoff-packet-why">Why this exists: Multiple domains are active at the same neurological node, creating a cross-system opportunity.</div>';
    }

    html += '</div>';
    return html;
  }

  // ─── Gate B #9C.5 Phase 1 — handoff source-state classifier ──────────
  // Returns a card-level authority classification for the MASTER BRAIN
  // HANDOFF QUEUE based on producer presence, summary() shape, and
  // LIMENMainBrainHandoffState.timestamp age. Visual authority downgrade
  // only — never suppresses body, never invents packet counts.
  //
  // Thresholds are deliberately forgiving (queue is a review surface,
  // not a market-tick surface): FRESH <= 15 min, STALE <= 60 min,
  // VERY_STALE > 60 min.
  //
  // Doctrine: handoff readiness must be visually subordinated to
  // handoff freshness. A queue can be honest about its packet statuses
  // and still be misleading if the queue's own source state is stale.
  var HANDOFF_FRESH_MS      = 15 * 60 * 1000;   // 15 minutes
  var HANDOFF_STALE_MS      = 60 * 60 * 1000;   // 60 minutes

  function _classifyHandoffSourceState(api, state, summaryResult) {
    // 1. NO_SOURCE — producer module not loaded at all.
    if (!api || typeof api.summary !== 'function') {
      return {
        level:  'NO_SOURCE',
        badge:  'HANDOFF PIPELINE UNAVAILABLE',
        reason: 'Handoff producer not loaded.'
      };
    }
    // 2. NO_PIPELINE — summary() threw (caller passes undefined) or
    // returned a shape we cannot use. Distinguished from NO_SOURCE so
    // operator knows the producer loaded but failed.
    if (summaryResult === undefined) {
      return {
        level:  'NO_PIPELINE',
        badge:  'HANDOFF PIPELINE FAILED',
        reason: 'summary() threw during read.'
      };
    }
    if (!Array.isArray(summaryResult) || summaryResult.length === 0 ||
        typeof summaryResult[0] !== 'object' || summaryResult[0] === null ||
        typeof summaryResult[0].lane !== 'string') {
      return {
        level:  'NO_PIPELINE',
        badge:  'HANDOFF PIPELINE RETURNED NO LANES',
        reason: 'summary() returned invalid lane shape.'
      };
    }
    // 3. NO_TIMESTAMP — pipeline works but freshness is unknown.
    // Distinct from STALE because we cannot say it's old, only that we
    // cannot tell. Operator should not treat as either FRESH or STALE.
    var ts = state && state.timestamp;
    if (typeof ts !== 'number' || !isFinite(ts) || ts <= 0) {
      return {
        level:  'NO_TIMESTAMP',
        badge:  'HANDOFF FRESHNESS UNKNOWN',
        reason: 'No valid handoff state timestamp.'
      };
    }
    // 4. Age-banded classification.
    var now = Date.now();
    var ageMs = now - ts;
    if (ageMs < 0) ageMs = 0;   // clock skew / future timestamp tolerance
    var ageMin = Math.floor(ageMs / 60000);
    if (ageMs <= HANDOFF_FRESH_MS) {
      return {
        level:  'FRESH',
        badge:  'HANDOFF SOURCE FRESH · updated ' + ageMin + 'm ago',
        ageMinutes: ageMin
      };
    }
    if (ageMs <= HANDOFF_STALE_MS) {
      return {
        level:  'STALE',
        badge:  'HANDOFF SOURCE STALE · updated ' + ageMin + 'm ago',
        ageMinutes: ageMin
      };
    }
    // VERY_STALE — render hours rather than minutes so the visual
    // weight matches the magnitude of the gap.
    var ageHours = Math.floor(ageMs / 3600000);
    return {
      level:  'VERY_STALE',
      badge:  'HANDOFF SOURCE VERY STALE · updated ' + ageHours + 'h ago',
      ageMinutes: ageMin,
      ageHours:   ageHours
    };
  }

  function _refreshHandoff() {
    if (!_handoffEl) return;
    _handoffEl.innerHTML = '';
    _handoffEl.style.display = 'none'; // hidden until the queue actually has packets (auto-shows below)

    // Header (title + refresh button) — built unconditionally so the
    // card always reads as a real surface even when the pipeline is
    // missing or empty.
    var head = document.createElement('div');
    head.className = 'clr-handoff-head';
    var title = document.createElement('div');
    title.className = 'clr-handoff-title';
    title.textContent = 'MASTER BRAIN HANDOFF QUEUE';
    head.appendChild(title);
    var refresh = document.createElement('button');
    refresh.className = 'clr-handoff-refresh';
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.title = 'Recompute handoff packets from current Civilization state';
    refresh.onclick = function () {
      var api = window.LIMENMainBrainHandoff;
      if (api && typeof api.recompute === 'function') {
        try { api.recompute(); } catch (e) { /* observer-only */ }
      }
      _refreshHandoff();
    };
    head.appendChild(refresh);
    _handoffEl.appendChild(head);

    var subtitle = document.createElement('div');
    subtitle.className = 'clr-handoff-subtitle';
    subtitle.textContent = 'Civilization packets ready for executive review. Shows lane counts only; drafting and submission remain separate steps.';
    _handoffEl.appendChild(subtitle);

    // Ready/Pending explainer — added in Patch B1 so manager understands
    // what the chip counts mean. No claim of automatic filing or execution.
    var explainer = document.createElement('div');
    explainer.className = 'clr-handoff-explainer';
    explainer.textContent = 'Ready = enough evidence for draft review. Pending = packet exists but has not met the readyForGeneration gate this cycle.';
    _handoffEl.appendChild(explainer);

    // Defensive: pipeline may not be present. Probe api/state/summary
    // up front so Gate B #9C.5 Phase 1 source-state badge classifier
    // runs on the same evidence the missing-pipeline checks below use.
    // The probe try/catch preserves the original console.warn behavior;
    // existing checks below read the pre-probed values rather than
    // re-calling api.summary() (no double-call).
    var api = window.LIMENMainBrainHandoff;
    var state = window.LIMENMainBrainHandoffState;
    var summary;
    var summaryThrew = false;
    if (api && typeof api.summary === 'function') {
      try {
        summary = api.summary();
      } catch (e) {
        summaryThrew = true;
        try { console.warn('[Handoff] summary() threw:', e && e.message); } catch (_) {}
      }
    }

    // Gate B #9C.5 Phase 1 — source-state authority badge.
    // Sits between explainer and lane list. Always renders one badge.
    // Visual authority downgrade only — body, lane chips, packet cards
    // remain visible for STALE / VERY_STALE / NO_TIMESTAMP. Pipeline
    // failure cases (NO_SOURCE / NO_PIPELINE) get a red badge above the
    // existing honest missing-pipeline text below — both layers stay.
    var sourceAuth = _classifyHandoffSourceState(
      api, state, summaryThrew ? undefined : summary
    );
    var srcBadgeEl = document.createElement('div');
    srcBadgeEl.className = 'clr-handoff-source-badge ' +
      sourceAuth.level.toLowerCase().replace(/_/g, '-');
    srcBadgeEl.textContent = sourceAuth.badge;
    _handoffEl.appendChild(srcBadgeEl);

    // Existing missing-pipeline messages — preserved verbatim, but now
    // read the pre-probed api/summary/summaryThrew values (no second
    // api.summary() call). Behavior unchanged for the operator.
    if (!api || typeof api.summary !== 'function') {
      var miss = document.createElement('div');
      miss.className = 'clr-handoff-warn';
      miss.textContent = 'Handoff pipeline not available.';
      _handoffEl.appendChild(miss);
      return;
    }
    if (summaryThrew) {
      var failed = document.createElement('div');
      failed.className = 'clr-handoff-warn';
      failed.textContent = 'Handoff summary failed.';
      _handoffEl.appendChild(failed);
      return;
    }
    if (!Array.isArray(summary) || summary.length === 0 ||
        typeof summary[0] !== 'object' || summary[0] === null ||
        typeof summary[0].lane !== 'string') {
      var noLanes = document.createElement('div');
      noLanes.className = 'clr-handoff-warn';
      noLanes.textContent = 'Handoff pipeline returned no lanes.';
      _handoffEl.appendChild(noLanes);
      return;
    }

    // Compute total across all lanes for the zero-count empty state.
    var totalAcross = 0;
    var readyAcross = 0;
    for (var ti = 0; ti < summary.length; ti++) {
      var s = summary[ti] || {};
      if (typeof s.total === 'number') totalAcross += s.total;
      if (typeof s.readyForGeneration === 'number') readyAcross += s.readyForGeneration;
    }

    if (totalAcross === 0) {
      // Queue empty (Master Brain write not wired in this MVP) — hide the whole
      // card instead of showing a dead surface. Auto-returns when packets exist.
      _handoffEl.style.display = 'none';
      return;
    }

    // Has packets — ensure the card is visible.
    _handoffEl.style.display = '';

    // Build lane chips. Always render every lane the summary reports
    // (including zero-count) so the full artifact map is visible.
    var lanesEl = document.createElement('div');
    lanesEl.className = 'clr-handoff-lanes';

    for (var i = 0; i < summary.length; i++) {
      var entry = summary[i] || {};
      var lane = entry.lane;
      if (typeof lane !== 'string') continue;
      var total = (typeof entry.total === 'number') ? entry.total : 0;
      var ready = (typeof entry.readyForGeneration === 'number') ? entry.readyForGeneration : 0;
      var pending = (typeof entry.pending === 'number') ? entry.pending : Math.max(0, total - ready);

      var laneEl = document.createElement('div');
      laneEl.className = 'clr-handoff-lane' + (ready > 0 ? ' has-ready' : '');

      var laneHead = document.createElement('div');
      laneHead.className = 'clr-handoff-lane-head';
      laneHead.setAttribute('data-handoff-lane', lane);

      var caret = document.createElement('span');
      caret.className = 'clr-handoff-caret';
      caret.textContent = _handoffExpandedLanes[lane] ? '▾' : '▸';
      laneHead.appendChild(caret);

      var label = document.createElement('span');
      label.className = 'clr-handoff-lane-label';
      label.textContent = _handoffLaneLabel(lane);
      laneHead.appendChild(label);

      var counts = document.createElement('span');
      counts.className = 'clr-handoff-counts';
      counts.innerHTML = total + ' total · ' +
        '<span class="clr-handoff-ready">' + ready + ' ready</span> · ' +
        '<span class="clr-handoff-pending">' + pending + ' pending</span>';
      laneHead.appendChild(counts);
      laneEl.appendChild(laneHead);

      // Drilldown rendered only if the lane is expanded.
      if (_handoffExpandedLanes[lane]) {
        var detail = document.createElement('div');
        detail.className = 'clr-handoff-detail';

        // Lane purpose description — static text from HANDOFF_LANE_DESCRIPTIONS.
        var laneDescText = _handoffLaneDescription(lane);
        if (laneDescText) {
          var laneDescEl = document.createElement('div');
          laneDescEl.className = 'clr-handoff-lane-desc';
          laneDescEl.textContent = laneDescText;
          detail.appendChild(laneDescEl);
        }

        if (typeof api.byLane !== 'function') {
          var noByLane = document.createElement('div');
          noByLane.className = 'clr-handoff-packet-empty';
          noByLane.textContent = 'Lane detail unavailable.';
          detail.appendChild(noByLane);
        } else if (total === 0) {
          // No packets produced for this lane this cycle. Honest message;
          // no speculation about why.
          var emptyTotal = document.createElement('div');
          emptyTotal.className = 'clr-handoff-lane-status-empty';
          emptyTotal.textContent = 'No packets produced for this lane in the current cycle.';
          detail.appendChild(emptyTotal);
        } else {
          // total > 0 — fetch packets defensively.
          var packets = [];
          try { packets = api.byLane(lane) || []; }
          catch (e2) { packets = []; }

          // If nothing is ready this cycle, surface that BEFORE listing
          // packets so the manager sees the gate state up front. Speculative
          // framing about why packets failed the gate belongs in the future
          // verifier layer, not this read-only queue.
          if (ready === 0) {
            var pendingMsg = document.createElement('div');
            pendingMsg.className = 'clr-handoff-lane-status-pending';
            pendingMsg.innerHTML = 'Packets exist but did not meet the readyForGeneration gate this cycle.' +
              '<span class="sub">The gate may tighten or relax as upstream evidence changes.</span>';
            detail.appendChild(pendingMsg);
          }

          if (!Array.isArray(packets) || packets.length === 0) {
            var emptyLane = document.createElement('div');
            emptyLane.className = 'clr-handoff-packet-empty';
            emptyLane.textContent = 'No packets in this lane yet.';
            detail.appendChild(emptyLane);
          } else {
            var packetsHtml = '';
            for (var pi = 0; pi < packets.length; pi++) {
              packetsHtml += _renderHandoffPacket(packets[pi], lane);
            }
            // detail already has child nodes (description, optional pending
            // message); append packet HTML as a sibling block.
            var packetsContainer = document.createElement('div');
            packetsContainer.innerHTML = packetsHtml;
            detail.appendChild(packetsContainer);
          }
        }
        laneEl.appendChild(detail);
      }

      lanesEl.appendChild(laneEl);
    }

    _handoffEl.appendChild(lanesEl);

    // Last-updated stamp — read from LIMENMainBrainHandoffState if present.
    var state = window.LIMENMainBrainHandoffState;
    if (state && typeof state.timestamp === 'number') {
      var stamp = document.createElement('div');
      stamp.className = 'clr-handoff-stamp';
      try {
        stamp.textContent = 'updated ' + new Date(state.timestamp).toLocaleTimeString();
      } catch (e3) {
        stamp.textContent = 'updated ' + state.timestamp;
      }
      _handoffEl.appendChild(stamp);
    }

    // One-time delegation for lane expand/collapse.
    if (!_handoffEl._handoffDelegated) {
      _handoffEl._handoffDelegated = true;
      _handoffEl.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== _handoffEl) {
          if (t.getAttribute && t.getAttribute('data-handoff-lane')) {
            var ln = t.getAttribute('data-handoff-lane');
            _handoffExpandedLanes[ln] = !_handoffExpandedLanes[ln];
            _refreshHandoff();
            return;
          }
          t = t.parentNode;
        }
      });
    }

    // One-time event listener for upstream handoff updates. Module-scope
    // flag prevents duplicate listeners across re-renders.
    if (!_handoffEventBound && typeof window.addEventListener === 'function') {
      _handoffEventBound = true;
      window.addEventListener('limen:main-brain-handoff-update', _refreshHandoff);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab Bar
  // ═══════════════════════════════════════════════════════════════════════════

  function _renderTabBar() {
    var bar = document.createElement('div');
    bar.className = 'clr-tab-bar';

    for (var i = 0; i < TABS.length; i++) {
      var btn = document.createElement('button');
      btn.className = 'clr-tab' + (TABS[i].id === _activeTab ? ' active' : '');
      btn.textContent = TABS[i].label;
      btn.setAttribute('data-tab', TABS[i].id);
      btn.addEventListener('click', _onTabClick);
      bar.appendChild(btn);
    }
    return bar;
  }

  function _onTabClick(e) {
    var tabId = e.target.getAttribute('data-tab');
    if (tabId === _activeTab) {
      // Deselect: hide tab content
      _activeTab = null;
      _refreshTabBar();
      if (_tabContentEl) _tabContentEl.innerHTML = '';
      return;
    }
    _activeTab = tabId;
    _refreshTabBar();
    _renderActiveTab();
  }

  function _refreshTabBar() {
    if (!_tabBarEl) return;
    var btns = _tabBarEl.querySelectorAll('.clr-tab');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = 'clr-tab' + (btns[i].getAttribute('data-tab') === _activeTab ? ' active' : '');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab Content Renderers
  // ═══════════════════════════════════════════════════════════════════════════

  function _renderActiveTab() {
    if (!_tabContentEl || !_activeTab) return;
    _tabContentEl.innerHTML = '';

    // Detach domain repair map when switching away — prevents it from
    // re-rendering over other tabs on limen:domain-update events
    if (_activeTab !== 'domain-repair' && window.LIMENDomainRepairMap && typeof window.LIMENDomainRepairMap.detach === 'function') {
      window.LIMENDomainRepairMap.detach();
    }

    switch (_activeTab) {
      case 'patent':          _renderTabPatent(); break;
      case 'evidence':        _renderTabEvidence(); break;
      case 'regulation':      _renderTabRegulation(); break;
      case 'council':         _renderTabCouncil(); break;
    }
  }

  // (Civilization Evidence-Workspace tab removed — operator call. Render code
  //  + confidence-badge/authority helpers deleted. The civilization REPORT is
  //  still generated; it simply has no dedicated tab now.)

  // ─── Patent Opportunities ─────────────────────────────────────────────────

  // ── Capital Opportunity Status (localStorage) ──
  var _CAP_OPP_KEY = 'limen_opportunities';
  function _getCapOppStatuses() {
    try { return JSON.parse(localStorage.getItem(_CAP_OPP_KEY) || '{}'); } catch(e) { return {}; }
  }
  function _setCapOppStatus(oppId, status) {
    var s = _getCapOppStatuses();
    s[oppId] = status;
    localStorage.setItem(_CAP_OPP_KEY, JSON.stringify(s));
  }
  function _capOppId(opp) {
    return (opp.path + '_' + opp.domain + '_' + (opp.sourceType || '') + '_' + (opp.indication || '').substring(0, 30)).replace(/[^a-zA-Z0-9_]/g, '');
  }
  // Make status setter accessible from onclick
  window._setCapOppStatus = function(oppId, status) {
    _setCapOppStatus(oppId, status);
    // Re-render tab
    if (_activeTab === 'patent') { _tabContentEl.innerHTML = ''; _renderTabPatent(); }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTION ENGINE — thin wrappers
  // The generator templates, real-world translation tables, modal,
  // copy/print export, and LIMENExecGenerator public API now live in
  // assets/js/executive/limen-exec-generator.js (loaded before this file
  // by both civilization.html and civilization-opportunities.html).
  //
  // What remains here:
  //   _canGenerateGrant(opp)           — thin wrapper used by Capital
  //                                      Conversion priority/gating logic
  //   window._execGenerate(oppId, type) — thin wrapper that looks up the
  //                                      opportunity in the private
  //                                      _capOpportunities cache and
  //                                      delegates to LIMENExecGenerator
  // ═══════════════════════════════════════════════════════════════════════

  function _canGenerateGrant(opp) {
    var api = window.LIMENExecGenerator;
    return !!(api && typeof api.canGenerateGrant === 'function' && api.canGenerateGrant(opp));
  }

  // Capital Conversion-side dispatcher. Looks up the opportunity in the
  // private _capOpportunities cache (populated by _renderTabPatent), then
  // delegates to the shared LIMENExecGenerator. From the manager's
  // perspective on /civilization, behavior is unchanged: missing-cache
  // and unknown-doc-type paths still alert and abort the same way.
  window._execGenerate = function (oppId, docType) {
    var opp = (window._capOpportunities || {})[oppId];
    if (!opp) { alert('Opportunity data not found. Re-open Capital Conversion tab.'); return; }
    if (window.LIMENExecGenerator && typeof window.LIMENExecGenerator.fromOpportunity === 'function') {
      window.LIMENExecGenerator.fromOpportunity(opp, docType);
    } else {
      alert('Draft generator not loaded.');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5 — OUTCOME LOOP + REGULATION VALIDATION
  // Behavior layer only — no connectome or propagation changes
  // ═══════════════════════════════════════════════════════════════════════

  // ── PART 1: REGULATION TRACEABILITY ──
  // Attach pathway summary to each opportunity when rendered
  function _traceRegulationPathway(opp) {
    var domain = opp.domain || '';
    var stress = opp.stress || 0;
    var sourceType = opp.sourceType || 'unknown';

    // Map domain to primary connectome pathways
    var DOMAIN_PATHWAYS = {
      energy:      { primary: 'THAL \u2192 dlPFC \u2192 executive control', amplifier: 'BLA/vmPFC emotional valuation', nodes: ['THAL','dlPFC','BLA','vmPFC'] },
      health:      { primary: 'NTS \u2192 AI \u2192 salience detection', amplifier: 'HIPP/mPFC contextual memory', nodes: ['NTS','AI','HIPP','mPFC'] },
      finance:     { primary: 'BLA \u2192 vmPFC \u2192 value assessment', amplifier: 'NAcc/VTA reward circuit', nodes: ['BLA','vmPFC','NAcc','VTA'] },
      technology:  { primary: 'dlPFC \u2192 THAL \u2192 sensory gating', amplifier: 'BDNF/TrkB plasticity', nodes: ['dlPFC','THAL','BDNF','TrkB'] },
      defense:     { primary: 'BLA \u2192 PAG \u2192 threat response', amplifier: 'dACC conflict monitoring', nodes: ['BLA','PAG','dACC','dlPFC'] },
      environment: { primary: 'NTS \u2192 THAL \u2192 autonomic relay', amplifier: 'AI interoceptive awareness', nodes: ['NTS','THAL','AI','mPFC'] },
      education:   { primary: 'HIPP \u2192 PCC \u2192 DMN consolidation', amplifier: 'BDNF learning plasticity', nodes: ['HIPP','PCC','DMN','BDNF'] },
      governance:  { primary: 'dlPFC \u2192 dACC \u2192 conflict resolution', amplifier: 'mPFC social cognition', nodes: ['dlPFC','dACC','mPFC','AI'] },
      industry:    { primary: 'THAL \u2192 dlPFC \u2192 motor planning', amplifier: 'GP/STRI basal ganglia gating', nodes: ['THAL','dlPFC','GP','STRI'] },
      trade:       { primary: 'THAL \u2192 dlPFC \u2192 logistic coordination', amplifier: 'NAcc reward optimization', nodes: ['THAL','dlPFC','NAcc','M1'] }
    };
    var grounded = !!DOMAIN_PATHWAYS[domain];
    var pathway = DOMAIN_PATHWAYS[domain] || { primary: 'general connectome propagation', amplifier: 'multi-system integration', nodes: ['THAL','dlPFC','BLA'] };

    return {
      primary: pathway.primary,
      amplifier: pathway.amplifier,
      topNodes: pathway.nodes.slice(0, 3),
      grounded: grounded,
      summary: 'Stress in ' + domain + ' (' + Math.round(stress * 100) + '%) driven by ' + pathway.primary + ', amplified by ' + pathway.amplifier,
      trigger: sourceType.replace(/_/g, ' ')
    };
  }

  // ── PART 2: OUTCOME TRACKING ──
  var _OUTCOME_KEY = 'limen_outcomes';

  function _getOutcomes() {
    try { return JSON.parse(localStorage.getItem(_OUTCOME_KEY) || '[]'); } catch(e) { return []; }
  }

  function _recordOutcome(oppId, outcome, notes) {
    var outcomes = _getOutcomes();
    var opp = (window._capOpportunities || {})[oppId];
    outcomes.push({
      oppId: oppId,
      outcome: outcome,  // SUCCESS, FAIL, PARTIAL
      timestamp: new Date().toISOString(),
      domain: opp ? opp.domain : '',
      sourceType: opp ? opp.sourceType : '',
      nodes: opp ? (_traceRegulationPathway(opp).topNodes || []) : [],
      stress: opp ? opp.stress : 0,
      notes: notes || ''
    });
    localStorage.setItem(_OUTCOME_KEY, JSON.stringify(outcomes));
    return outcomes;
  }

  // Make accessible from onclick
  window._recordOutcome = function(oppId, outcome) {
    var notes = prompt('Notes (optional):') || '';
    _recordOutcome(oppId, outcome, notes);
    // Re-render tab if open
    if (_activeTab === 'patent') { _tabContentEl.innerHTML = ''; _renderTabPatent(); }
    alert('Outcome recorded: ' + outcome);
  };

  // ── PART 3: OUTCOME WEIGHTING LAYER ──
  var _WEIGHT_KEY = 'limen_pathway_weights';

  function _getPathwayWeights() {
    try { return JSON.parse(localStorage.getItem(_WEIGHT_KEY) || '{}'); } catch(e) { return {}; }
  }

  function _updatePathwayWeights() {
    var outcomes = _getOutcomes();
    var weights = {};

    // Weighted scoring: SUCCESS=1.0, PARTIAL=0.5, FAIL=0.0
    var OUTCOME_SCORE = { SUCCESS: 1.0, PARTIAL: 0.5, FAIL: 0.0 };

    outcomes.forEach(function(o) {
      var score = OUTCOME_SCORE[o.outcome] != null ? OUTCOME_SCORE[o.outcome] : 0.5;
      (o.nodes || []).forEach(function(node) {
        if (!weights[node]) weights[node] = { weightedSum: 0, total: 0, factor: 1.0, domains: {} };
        weights[node].total++;
        weights[node].weightedSum += score;
        // Track which domains trained this node (for direct vs transfer)
        if (o.domain) weights[node].domains[o.domain] = true;
      });
    });

    // Compute factors: bounded 0.8x – 1.2x
    // factor = 0.8 + (weightedAvg * 0.4) where weightedAvg = weightedSum / total
    for (var node in weights) {
      var w = weights[node];
      if (w.total === 0) { w.factor = 1.0; continue; }
      var weightedAvg = w.weightedSum / w.total;
      w.factor = Math.round((0.8 + weightedAvg * 0.4) * 100) / 100;
    }

    localStorage.setItem(_WEIGHT_KEY, JSON.stringify(weights));
    return weights;
  }

  // Apply weight to opportunity priority
  // Max-anchor blend with hub-specificity penalty and direct/transfer split.
  // Direct pathway: node trained by THIS domain → full factor
  // Transfer pathway: node trained by OTHER domains → deviation scaled by 1/sqrt(hubFreq)
  // Ungrounded (fallback) pathways return basePriority unchanged — no contamination

  // Hub frequency: how many mapped domain pathways (top 3) each node appears in
  // Pre-computed from DOMAIN_PATHWAYS — static topology, not outcome-dependent
  var _NODE_HUB_FREQ = (function() {
    var freq = {};
    var DP = {
      energy: ['THAL','dlPFC','BLA'], health: ['NTS','AI','HIPP'],
      finance: ['BLA','vmPFC','NAcc'], technology: ['dlPFC','THAL','BDNF'],
      defense: ['BLA','PAG','dACC'], environment: ['NTS','THAL','AI'],
      education: ['HIPP','PCC','DMN'], governance: ['dlPFC','dACC','mPFC'],
      industry: ['THAL','dlPFC','GP'], trade: ['THAL','dlPFC','NAcc']
    };
    for (var d in DP) {
      for (var i = 0; i < DP[d].length; i++) {
        freq[DP[d][i]] = (freq[DP[d][i]] || 0) + 1;
      }
    }
    return freq;
  })();

  function _adjustedPriority(opp, basePriority) {
    var weights = _getPathwayWeights();
    var trace = _traceRegulationPathway(opp);
    if (!trace.grounded) return basePriority;
    var domain = opp.domain || '';
    var nodeFactors = [];
    (trace.topNodes || []).forEach(function(node) {
      if (!weights[node] || weights[node].total === 0) return;
      var raw = weights[node].factor;
      var isDirect = weights[node].domains && weights[node].domains[domain];
      if (isDirect) {
        // Direct pathway: full factor
        nodeFactors.push(raw);
      } else {
        // Transfer pathway: scale deviation by specificity = 1/sqrt(hubFreq)
        var hubFreq = _NODE_HUB_FREQ[node] || 1;
        var specificity = 1 / Math.sqrt(hubFreq);
        var scaled = 1.0 + (raw - 1.0) * specificity;
        nodeFactors.push(scaled);
      }
    });
    if (nodeFactors.length === 0) return basePriority;
    // Max-anchor blend: strongest signal anchors at 60%, rest averages at 40%
    nodeFactors.sort(function(a, b) { return Math.abs(b - 1.0) - Math.abs(a - 1.0); });
    var anchor = nodeFactors[0];
    var blended;
    if (nodeFactors.length === 1) {
      blended = anchor;
    } else {
      var restSum = 0;
      for (var i = 1; i < nodeFactors.length; i++) restSum += nodeFactors[i];
      var restAvg = restSum / (nodeFactors.length - 1);
      blended = anchor * 0.6 + restAvg * 0.4;
    }
    return Math.round(basePriority * Math.max(0.8, Math.min(1.2, blended)));
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 4: HISTORICAL STRESS MEMORY
  // Persistent stress snapshots across sessions. Records every 5 min,
  // keeps last 288 entries (~24h). Provides trend, baseline, and
  // anomaly detection for each domain.
  // ══════════════════════════════════════════════════════════════════════

  var _STRESS_HISTORY_KEY = 'limen_stress_history';
  var _STRESS_SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 min
  var _STRESS_HISTORY_MAX = 288; // ~24h at 5min intervals
  var _lastSnapshotTime = 0;

  function _getStressHistory() {
    try { return JSON.parse(localStorage.getItem(_STRESS_HISTORY_KEY) || '{"snapshots":[],"baselines":{}}'); }
    catch(e) { return { snapshots: [], baselines: {} }; }
  }

  function _recordStressSnapshot() {
    var now = Date.now();
    if (now - _lastSnapshotTime < _STRESS_SNAPSHOT_INTERVAL) return;
    _lastSnapshotTime = now;

    var domains = window.LIMENDomains || {};
    var snapshot = { t: now, d: {} };
    for (var dk in domains) {
      if (domains.hasOwnProperty(dk)) {
        snapshot.d[dk] = Math.round((domains[dk].stress || 0) * 1000) / 1000;
      }
    }

    var history = _getStressHistory();
    history.snapshots.push(snapshot);
    if (history.snapshots.length > _STRESS_HISTORY_MAX) {
      history.snapshots = history.snapshots.slice(-_STRESS_HISTORY_MAX);
    }

    // Update rolling baselines (exponential moving average, alpha=0.05)
    var alpha = 0.05;
    for (var bk in snapshot.d) {
      if (history.baselines[bk] === undefined) {
        history.baselines[bk] = snapshot.d[bk];
      } else {
        history.baselines[bk] = Math.round((history.baselines[bk] * (1 - alpha) + snapshot.d[bk] * alpha) * 1000) / 1000;
      }
    }

    localStorage.setItem(_STRESS_HISTORY_KEY, JSON.stringify(history));
    return history;
  }

  // Compute trend for a domain over recent history (last N snapshots)
  function _domainTrend(domain, windowSize) {
    var history = _getStressHistory();
    var snaps = history.snapshots;
    var n = windowSize || 12; // default: last hour at 5min intervals
    if (snaps.length < 3) return { direction: 'insufficient', slope: 0, volatility: 0 };

    var recent = snaps.slice(-n);
    var values = [];
    for (var i = 0; i < recent.length; i++) {
      if (recent[i].d[domain] !== undefined) values.push(recent[i].d[domain]);
    }
    if (values.length < 3) return { direction: 'insufficient', slope: 0, volatility: 0 };

    // Linear regression slope
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (var j = 0; j < values.length; j++) {
      sumX += j; sumY += values[j]; sumXY += j * values[j]; sumX2 += j * j;
    }
    var slope = (values.length * sumXY - sumX * sumY) / (values.length * sumX2 - sumX * sumX);

    // Volatility (standard deviation)
    var mean = sumY / values.length;
    var variance = 0;
    for (var v = 0; v < values.length; v++) variance += (values[v] - mean) * (values[v] - mean);
    var volatility = Math.sqrt(variance / values.length);

    var direction = Math.abs(slope) < 0.005 ? 'stable' : (slope > 0 ? 'rising' : 'falling');
    return {
      direction: direction,
      slope: Math.round(slope * 10000) / 10000,
      volatility: Math.round(volatility * 1000) / 1000,
      current: values[values.length - 1],
      baseline: (history.baselines[domain] || 0),
      deviationFromBaseline: Math.round((values[values.length - 1] - (history.baselines[domain] || 0)) * 1000) / 1000,
      sampleCount: values.length
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 5: RECOVERY / VAGAL PATHWAY LOGIC
  // Models parasympathetic recovery. Recovery isn't just "stress dropped" —
  // it's a regulated return to baseline via specific pathway activation.
  // Vagal tone = system's capacity to recover. High vagal tone = fast
  // recovery. Low vagal tone = slow or incomplete recovery.
  // ══════════════════════════════════════════════════════════════════════

  var _RECOVERY_KEY = 'limen_recovery_events';
  var _VAGAL_KEY = 'limen_vagal_tone';
  var _prevDomainStress = {};

  function _getVagalTone() {
    try { return JSON.parse(localStorage.getItem(_VAGAL_KEY) || '{"global":0.5,"domains":{}}'); }
    catch(e) { return { global: 0.5, domains: {} }; }
  }

  function _checkRecovery() {
    var domains = window.LIMENDomains || {};
    var recoveries = [];
    var history = _getStressHistory();

    for (var dk in domains) {
      var current = domains[dk].stress || 0;
      var prev = _prevDomainStress[dk];
      var baseline = history.baselines[dk] || 0.3;

      if (prev !== undefined && prev > 0.5 && current < prev * 0.7) {
        // >30% drop from elevated state = recovery event
        var trace = _traceRegulationPathway({ domain: dk, stress: current, sourceType: 'recovery' });
        var trend = _domainTrend(dk, 6);

        // SHORT-TERM recovery quality: relative to recent EMA (acute regulation)
        var returnRatio = baseline > 0 ? Math.min(1, Math.max(0, 1 - Math.abs(current - baseline) / baseline)) : 0.5;
        var speedScore = Math.min(1, Math.abs(trend.slope) * 50);
        var quality = (returnRatio * 0.6 + speedScore * 0.4);
        var qualityLabel = quality > 0.7 ? 'FULL' : (quality > 0.4 ? 'PARTIAL' : 'INCOMPLETE');

        // LONG-TERM lens (second classification, does not override short-term)
        // Relative to 30-day baseline regime — distinguishes true recovery vs temporary drop
        var longTermLens = 'UNKNOWN';
        var longBl = _longGetBaseline(dk, 30);
        if (longBl && longBl.count >= _LONG_MIN_DAYS_FOR_REGIME) {
          if (current <= longBl.mean + longBl.std) {
            longTermLens = 'TRUE_RECOVERY'; // returned within 1σ of 30-day baseline
          } else if (current <= longBl.mean + longBl.std * 2) {
            longTermLens = 'PARTIAL_REVERSION'; // dropped but still elevated vs history
          } else {
            longTermLens = 'TEMPORARY_DROP'; // still extreme relative to long-term
          }
        }

        recoveries.push({
          domain: dk,
          from: prev,
          to: current,
          drop: Math.round((prev - current) / prev * 100),
          timestamp: new Date().toISOString(),
          pathway: trace.summary,
          nodes: trace.topNodes,
          baseline: baseline,
          quality: Math.round(quality * 100) / 100,
          qualityLabel: qualityLabel,
          trend: trend.direction,
          longTermLens: longTermLens
        });
      }
      _prevDomainStress[dk] = current;
    }

    if (recoveries.length > 0) {
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem(_RECOVERY_KEY) || '[]'); } catch(e) {}
      existing = existing.concat(recoveries);
      if (existing.length > 50) existing = existing.slice(-50);
      localStorage.setItem(_RECOVERY_KEY, JSON.stringify(existing));

      // Update vagal tone from recovery quality
      _updateVagalTone(recoveries);

      console.log('[LIMEN] Recovery detected:', recoveries.map(function(r) {
        return r.domain + ' -' + r.drop + '% (' + r.qualityLabel + ')';
      }).join(', '));
    }

    return recoveries;
  }

  // Vagal tone: system's recovery capacity. Updated after each recovery event.
  // High vagal tone (>0.7) = system recovers quickly and fully.
  // Low vagal tone (<0.3) = system struggles to return to baseline.
  function _updateVagalTone(recoveries) {
    var vt = _getVagalTone();
    var alpha = 0.15; // learning rate

    for (var i = 0; i < recoveries.length; i++) {
      var r = recoveries[i];
      // Update domain-specific vagal tone
      var prev = vt.domains[r.domain] || 0.5;
      vt.domains[r.domain] = Math.round((prev * (1 - alpha) + r.quality * alpha) * 100) / 100;
    }

    // Global vagal tone = weighted average of domain vagal tones
    var sum = 0, count = 0;
    for (var dk in vt.domains) {
      sum += vt.domains[dk];
      count++;
    }
    if (count > 0) vt.global = Math.round((sum / count) * 100) / 100;

    localStorage.setItem(_VAGAL_KEY, JSON.stringify(vt));
    return vt;
  }

  // Record stress snapshots + check recovery on every domain update
  if (typeof window !== 'undefined') {
    window.addEventListener('limen:domain-update', function() {
      _recordStressSnapshot();
      _checkRecovery();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 6: ANOMALY DETECTION + SELF-AUDIT REPORTS
  // The system observes itself: detects anomalies (sustained deviations
  // from baseline, sudden spikes, unusual patterns), tracks its own
  // learning performance, and produces a self-assessment.
  // ══════════════════════════════════════════════════════════════════════

  var _ANOMALY_KEY = 'limen_anomalies';

  function _detectAnomalies() {
    var history = _getStressHistory();
    var snaps = history.snapshots;
    if (snaps.length < 6) return [];

    var anomalies = [];
    var allDomains = {};
    for (var i = 0; i < snaps.length; i++) {
      for (var dk in snaps[i].d) allDomains[dk] = true;
    }

    for (var domain in allDomains) {
      var trend = _domainTrend(domain, 12);
      if (trend.direction === 'insufficient') continue;
      var baseline = history.baselines[domain] || 0;
      var current = trend.current || 0;

      // Anomaly 1: Sustained deviation from baseline (>2 std devs for >30 min)
      if (trend.volatility > 0 && Math.abs(trend.deviationFromBaseline) > trend.volatility * 2 && trend.sampleCount >= 6) {
        anomalies.push({
          type: 'SUSTAINED_DEVIATION',
          domain: domain,
          severity: Math.min(1, Math.abs(trend.deviationFromBaseline) / 0.3),
          detail: domain + ' at ' + (current * 100).toFixed(0) + '% vs baseline ' + (baseline * 100).toFixed(0) + '% for ' + (trend.sampleCount * 5) + 'min',
          direction: current > baseline ? 'ELEVATED' : 'SUPPRESSED'
        });
      }

      // Anomaly 2: High volatility (rapid oscillation, system instability)
      if (trend.volatility > 0.15) {
        anomalies.push({
          type: 'HIGH_VOLATILITY',
          domain: domain,
          severity: Math.min(1, trend.volatility / 0.3),
          detail: domain + ' volatility ' + (trend.volatility * 100).toFixed(0) + '% (threshold 15%)',
          direction: 'UNSTABLE'
        });
      }

      // Anomaly 3: Rapid spike (slope magnitude > 0.03/interval)
      if (Math.abs(trend.slope) > 0.03) {
        anomalies.push({
          type: 'RAPID_CHANGE',
          domain: domain,
          severity: Math.min(1, Math.abs(trend.slope) / 0.06),
          detail: domain + ' ' + (trend.slope > 0 ? 'spiking' : 'crashing') + ' at ' + (Math.abs(trend.slope) * 100).toFixed(1) + '%/interval',
          direction: trend.slope > 0 ? 'SPIKE' : 'CRASH'
        });
      }
    }

    // Persist latest anomalies (keep last 100)
    if (anomalies.length > 0) {
      var ts = new Date().toISOString();
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem(_ANOMALY_KEY) || '[]'); } catch(e) {}
      for (var ai = 0; ai < anomalies.length; ai++) anomalies[ai].timestamp = ts;
      existing = existing.concat(anomalies);
      if (existing.length > 100) existing = existing.slice(-100);
      localStorage.setItem(_ANOMALY_KEY, JSON.stringify(existing));
    }

    return anomalies;
  }

  // Run anomaly detection alongside recovery checks
  if (typeof window !== 'undefined') {
    window.addEventListener('limen:domain-update', function() { _detectAnomalies(); });
  }

  // ── SELF-AUDIT PANEL (expanded) ──
  // Shows: outcome tracking, pathway weights, vagal tone, stress history,
  // anomalies, and recovery events in the Source Audit tab.

  function _buildSelfAuditHtml() {
    var outcomes = _getOutcomes();
    var weights = _updatePathwayWeights();
    var recoveries = [];
    try { recoveries = JSON.parse(localStorage.getItem(_RECOVERY_KEY) || '[]'); } catch(e) {}
    var vagal = _getVagalTone();
    var history = _getStressHistory();
    var anomalies = [];
    try { anomalies = JSON.parse(localStorage.getItem(_ANOMALY_KEY) || '[]'); } catch(e) {}

    var hasData = outcomes.length > 0 || recoveries.length > 0 || history.snapshots.length > 0 || anomalies.length > 0;
    if (!hasData) return '';

    var h = '';
    var panelStyle = 'margin-top:12px;padding:8px 10px;border-radius:3px;';
    var headerStyle = 'font-size:0.42rem;letter-spacing:2.5px;margin-bottom:6px;';
    var lineStyle = 'font-size:0.34rem;color:rgba(200,195,184,0.5);padding:2px 0;';
    var labelStyle = 'font-size:0.3rem;letter-spacing:1px;text-transform:uppercase;color:rgba(201,169,78,0.35);margin:4px 0 2px;';

    // ── System Vitals: vagal tone + stress memory depth ──
    h += '<div style="' + panelStyle + 'border:1px solid rgba(201,169,78,0.1);background:rgba(0,0,0,0.12)">';
    h += '<div style="' + headerStyle + 'color:rgba(201,169,78,0.5)">SYSTEM VITALS</div>';

    // Vagal tone indicator
    var vtColor = vagal.global > 0.7 ? '#5ab5a0' : (vagal.global > 0.4 ? '#C9A94E' : '#e85454');
    var vtLabel = vagal.global > 0.7 ? 'HIGH' : (vagal.global > 0.4 ? 'MODERATE' : 'LOW');
    h += '<div style="' + lineStyle + '">';
    h += 'Vagal tone: <span style="color:' + vtColor + '">' + vtLabel + ' (' + vagal.global + ')</span>';
    h += ' \u00b7 Recovery capacity: <span style="color:' + vtColor + '">' + (vagal.global > 0.7 ? 'strong' : vagal.global > 0.4 ? 'moderate' : 'impaired') + '</span>';
    h += '</div>';

    // Stress memory depth
    var memHours = history.snapshots.length > 0 ? Math.round((Date.now() - history.snapshots[0].t) / 3600000 * 10) / 10 : 0;
    h += '<div style="' + lineStyle + '">';
    h += 'Stress memory: ' + history.snapshots.length + ' snapshots \u00b7 ' + memHours + 'h depth';
    h += ' \u00b7 ' + Object.keys(history.baselines).length + ' domain baselines';
    h += '</div>';

    // Domain vagal tones
    var domVTs = Object.keys(vagal.domains);
    if (domVTs.length > 0) {
      h += '<div style="' + labelStyle + '">DOMAIN RECOVERY CAPACITY</div>';
      domVTs.sort(function(a,b) { return vagal.domains[b] - vagal.domains[a]; });
      for (var dvi = 0; dvi < Math.min(domVTs.length, 5); dvi++) {
        var dvk = domVTs[dvi];
        var dvv = vagal.domains[dvk];
        var dvc = dvv > 0.7 ? '#5ab5a0' : (dvv > 0.4 ? '#C9A94E' : '#e85454');
        h += '<span style="font-size:0.3rem;color:' + dvc + ';margin-right:8px">' + dvk.toUpperCase() + ':' + dvv + '</span>';
      }
    }
    h += '</div>';

    // ── Anomaly Report ──
    var recentAnomalies = anomalies.slice(-10);
    if (recentAnomalies.length > 0) {
      h += '<div style="' + panelStyle + 'border:1px solid rgba(232,84,84,0.1);background:rgba(0,0,0,0.08)">';
      h += '<div style="' + headerStyle + 'color:rgba(232,84,84,0.5)">ANOMALIES (' + recentAnomalies.length + ')</div>';
      // Group by type
      var byType = {};
      for (var ani = 0; ani < recentAnomalies.length; ani++) {
        var a = recentAnomalies[ani];
        if (!byType[a.type]) byType[a.type] = [];
        byType[a.type].push(a);
      }
      for (var atype in byType) {
        var typeColor = atype === 'SUSTAINED_DEVIATION' ? '#C9A94E' : (atype === 'RAPID_CHANGE' ? '#e85454' : '#4a8fd4');
        h += '<div style="' + labelStyle + '">' + atype.replace(/_/g, ' ') + '</div>';
        var items = byType[atype].slice(-3);
        for (var ati = 0; ati < items.length; ati++) {
          h += '<div style="' + lineStyle + 'color:' + typeColor + '">';
          h += items[ati].detail;
          h += '</div>';
        }
      }
      h += '</div>';
    }

    // ── Outcome Tracking ──
    if (outcomes.length > 0) {
      var succ = outcomes.filter(function(o) { return o.outcome === 'SUCCESS'; }).length;
      var fail = outcomes.filter(function(o) { return o.outcome === 'FAIL'; }).length;
      var part = outcomes.filter(function(o) { return o.outcome === 'PARTIAL'; }).length;

      h += '<div style="' + panelStyle + 'border:1px solid rgba(201,169,78,0.1);background:rgba(0,0,0,0.12)">';
      h += '<div style="' + headerStyle + 'color:rgba(201,169,78,0.5)">OUTCOME TRACKING</div>';
      h += '<div style="' + lineStyle + '">';
      h += 'Total: ' + outcomes.length + ' \u00b7 ';
      h += '<span style="color:#5ab5a0">Success: ' + succ + '</span> \u00b7 ';
      h += '<span style="color:#e85454">Fail: ' + fail + '</span> \u00b7 ';
      h += '<span style="color:#C9A94E">Partial: ' + part + '</span>';
      h += '</div>';

      // Top/worst pathways
      var sorted = Object.keys(weights).map(function(k) { return { node: k, factor: weights[k].factor, total: weights[k].total }; });
      sorted.sort(function(a, b) { return b.factor - a.factor; });
      if (sorted.length > 0) {
        h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.35);margin-top:4px">';
        h += 'Top: <span style="color:#5ab5a0">' + sorted[0].node + ' (' + sorted[0].factor + 'x)</span>';
        if (sorted.length > 1) {
          var worst = sorted[sorted.length - 1];
          h += ' \u00b7 Weakest: <span style="color:#e85454">' + worst.node + ' (' + worst.factor + 'x)</span>';
        }
        h += '</div>';
      }
      h += '</div>';
    }

    // ── Recovery Events ──
    if (recoveries.length > 0) {
      h += '<div style="' + panelStyle + 'border:1px solid rgba(90,181,160,0.1);background:rgba(0,0,0,0.08)">';
      h += '<div style="' + headerStyle + 'color:rgba(90,181,160,0.5)">RECOVERY EVENTS (' + recoveries.length + ')</div>';
      var recent = recoveries.slice(-5);
      for (var ri = 0; ri < recent.length; ri++) {
        var rec = recent[ri];
        var qc = rec.qualityLabel === 'FULL' ? '#5ab5a0' : (rec.qualityLabel === 'PARTIAL' ? '#C9A94E' : '#e85454');
        h += '<div style="' + lineStyle + '">';
        h += rec.domain.toUpperCase() + ' \u2193' + rec.drop + '% ';
        h += '<span style="color:' + qc + '">' + (rec.qualityLabel || 'UNKNOWN') + '</span>';
        // Long-term lens (second classification)
        if (rec.longTermLens && rec.longTermLens !== 'UNKNOWN') {
          var ltlColor = rec.longTermLens === 'TRUE_RECOVERY' ? '#5ab5a0' : (rec.longTermLens === 'PARTIAL_REVERSION' ? '#C9A94E' : '#e85454');
          h += ' <span style="color:' + ltlColor + ';font-size:0.28rem">[' + rec.longTermLens.replace(/_/g, ' ') + ']</span>';
        }
        if (rec.timestamp) {
          var ago = Math.round((Date.now() - new Date(rec.timestamp).getTime()) / 60000);
          h += ' \u00b7 ' + (ago < 60 ? ago + 'min ago' : Math.round(ago/60) + 'h ago');
        }
        h += '</div>';
      }
      h += '</div>';
    }

    // ── Short-term Baselines (24h EMA) ──
    var baselineKeys = Object.keys(history.baselines);
    if (baselineKeys.length > 0) {
      h += '<div style="' + panelStyle + 'border:1px solid rgba(200,195,184,0.06);background:rgba(0,0,0,0.05)">';
      h += '<div style="' + headerStyle + 'color:rgba(200,195,184,0.3)">SHORT-TERM BASELINES (24H)</div>';
      baselineKeys.sort(function(a,b) { return (history.baselines[b] || 0) - (history.baselines[a] || 0); });
      for (var bi = 0; bi < Math.min(baselineKeys.length, 10); bi++) {
        var bk = baselineKeys[bi];
        var bv = history.baselines[bk];
        var trend = _domainTrend(bk, 6);
        var trendArrow = trend.direction === 'rising' ? '\u2191' : (trend.direction === 'falling' ? '\u2193' : '\u2192');
        var trendColor = trend.direction === 'rising' ? '#e85454' : (trend.direction === 'falling' ? '#5ab5a0' : '#888');
        h += '<span style="font-size:0.3rem;color:#888;margin-right:8px">';
        h += bk.toUpperCase() + ':' + (bv * 100).toFixed(0) + '%';
        h += ' <span style="color:' + trendColor + '">' + trendArrow + '</span>';
        h += '</span>';
      }
      h += '</div>';
    }

    // ── Long-term Memory (daily, up to 365 days) ──
    var longMem = _getLongMemory();
    if (longMem.daily.length > 0) {
      h += '<div style="' + panelStyle + 'border:1px solid rgba(74,143,212,0.1);background:rgba(0,0,0,0.06)">';
      h += '<div style="' + headerStyle + 'color:rgba(74,143,212,0.5)">LONG-TERM MEMORY (' + longMem.daily.length + ' DAY' + (longMem.daily.length > 1 ? 'S' : '') + ')</div>';

      // Collect all domains from daily series
      var longDomSet = {};
      for (var lsi = 0; lsi < longMem.daily.length; lsi++) {
        for (var lsk in longMem.daily[lsi].domains) longDomSet[lsk] = true;
      }
      var longDomKeys = Object.keys(longDomSet);

      // Domains in EXTREME/ELEVATED regime (vs 30-day window)
      var extremeDomains = [];
      var elevatedDomains = [];
      for (var ldi = 0; ldi < longDomKeys.length; ldi++) {
        var ldk = longDomKeys[ldi];
        var regime = _longGetRegime(ldk, 30);
        if (regime === 'EXTREME') extremeDomains.push(ldk);
        else if (regime === 'ELEVATED') elevatedDomains.push(ldk);
      }

      if (extremeDomains.length > 0) {
        h += '<div style="' + lineStyle + '">';
        h += '<span style="color:#e85454;letter-spacing:1px;font-size:0.3rem">EXTREME (30d):</span> ';
        for (var exi = 0; exi < extremeDomains.length; exi++) {
          var exz = _longGetZScore(extremeDomains[exi], 30);
          h += '<span style="color:#e85454;font-size:0.3rem;margin-right:6px">' + extremeDomains[exi].toUpperCase();
          if (exz !== null) h += ' (' + (exz > 0 ? '+' : '') + exz + '\u03C3)';
          h += '</span>';
        }
        h += '</div>';
      }

      if (elevatedDomains.length > 0) {
        h += '<div style="' + lineStyle + '">';
        h += '<span style="color:#C9A94E;letter-spacing:1px;font-size:0.3rem">ELEVATED (30d):</span> ';
        for (var eli = 0; eli < elevatedDomains.length; eli++) {
          var elz = _longGetZScore(elevatedDomains[eli], 30);
          h += '<span style="color:#C9A94E;font-size:0.3rem;margin-right:6px">' + elevatedDomains[eli].toUpperCase();
          if (elz !== null) h += ' (' + (elz > 0 ? '+' : '') + elz + '\u03C3)';
          h += '</span>';
        }
        h += '</div>';
      }

      // 30-day trend per domain (baselines computed on read from daily[])
      h += '<div style="' + labelStyle + '">30-DAY TRENDS</div>';
      var trendDomains = longDomKeys.slice();
      trendDomains.sort(function(a,b) {
        var ba = _longComputeBaseline(a, 30), bb = _longComputeBaseline(b, 30);
        return (bb ? bb.mean : 0) - (ba ? ba.mean : 0);
      });
      for (var ti = 0; ti < Math.min(trendDomains.length, 10); ti++) {
        var tdk = trendDomains[ti];
        var lt = _longGetTrend(tdk, 30);
        var bl30 = _longComputeBaseline(tdk, 30);
        if (!bl30) continue;
        var ltArrow = lt.direction === 'rising' ? '\u2191' : (lt.direction === 'falling' ? '\u2193' : '\u2192');
        var ltColor = lt.direction === 'rising' ? '#e85454' : (lt.direction === 'falling' ? '#5ab5a0' : '#888');
        var regime30 = _longGetRegime(tdk, 30);
        var regColor = regime30 === 'EXTREME' ? '#e85454' : (regime30 === 'ELEVATED' ? '#C9A94E' : '#555');
        h += '<span style="font-size:0.3rem;color:#888;margin-right:8px">';
        h += tdk.toUpperCase() + ':' + (bl30.mean * 100).toFixed(0) + '%\u00b1' + (bl30.std * 100).toFixed(0);
        h += ' <span style="color:' + ltColor + '">' + ltArrow + '</span>';
        if (regime30 !== 'INSUFFICIENT_DATA' && regime30 !== 'NORMAL') {
          h += ' <span style="color:' + regColor + ';font-size:0.25rem">' + regime30 + '</span>';
        }
        h += '</span>';
      }
      h += '</div>';
    }

    // Executive state additions (from limen-executive-ui.js subscriber)
    if (typeof window !== 'undefined' && window._buildExecutiveAuditHtml) {
      h += window._buildExecutiveAuditHtml();
    }

    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 7: LONG-TERM MEMORY LAYER
  // Raw daily snapshots are the canonical source of truth (max 365).
  // Baselines (mean+std) are computed on read from the daily[] series,
  // windowed to 30/90/365 days — never stored as authoritative aggregates.
  // Complements short-term (5-min/24h) — does NOT replace it.
  // ══════════════════════════════════════════════════════════════════════

  var _LONG_MEMORY_KEY = 'limen_stress_history_long';
  var _LONG_MEMORY_MAX = 365;
  var _LONG_MEMORY_VERSION = 1;
  var _LONG_MIN_DAYS_FOR_REGIME = 7;

  function _getLongMemory() {
    try {
      var raw = JSON.parse(localStorage.getItem(_LONG_MEMORY_KEY) || 'null');
      if (!raw || !raw.daily) return { version: _LONG_MEMORY_VERSION, updatedAt: null, lastSnapshotDate: null, daily: [] };
      return raw;
    } catch(e) { return { version: _LONG_MEMORY_VERSION, updatedAt: null, lastSnapshotDate: null, daily: [] }; }
  }

  function _todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  // Write daily snapshot — called on domain-update, skips if today already recorded.
  // Storage is raw daily[] only. No pre-computed aggregates — baselines derived on read.
  function _writeDailySnapshot() {
    var today = _todayStr();
    var mem = _getLongMemory();

    // No duplicate per date
    if (mem.lastSnapshotDate === today) return;

    var domains = window.LIMENDomains || {};
    var snap = { date: today, domains: {} };
    for (var dk in domains) {
      if (domains.hasOwnProperty(dk)) {
        snap.domains[dk] = Math.round((domains[dk].stress || 0) * 1000) / 1000;
      }
    }
    if (Object.keys(snap.domains).length === 0) return;

    mem.daily.push(snap);
    if (mem.daily.length > _LONG_MEMORY_MAX) {
      mem.daily = mem.daily.slice(-_LONG_MEMORY_MAX);
    }

    mem.version = _LONG_MEMORY_VERSION;
    mem.updatedAt = new Date().toISOString();
    mem.lastSnapshotDate = today;

    localStorage.setItem(_LONG_MEMORY_KEY, JSON.stringify(mem));
    return mem;
  }

  // Trigger daily snapshot on first domain-update of the day
  if (typeof window !== 'undefined') {
    window.addEventListener('limen:domain-update', function() { _writeDailySnapshot(); });
  }

  // ── DERIVED COMPUTATIONS (computed on read from daily[] series) ──

  // Compute mean+std over a windowed slice of daily[]. Source of truth = daily[].
  function _longComputeBaseline(domain, days) {
    var mem = _getLongMemory();
    var window_ = days || mem.daily.length; // default = all data
    var slice = mem.daily.slice(-window_);
    var values = [];
    for (var i = 0; i < slice.length; i++) {
      if (slice[i].domains[domain] !== undefined) values.push(slice[i].domains[domain]);
    }
    if (values.length === 0) return null;
    var sum = 0;
    for (var v = 0; v < values.length; v++) sum += values[v];
    var mean = sum / values.length;
    var variance = 0;
    for (var s = 0; s < values.length; s++) variance += (values[s] - mean) * (values[s] - mean);
    var std = Math.sqrt(variance / values.length);
    // Floor std at 0.02 to prevent z-score explosion on flat/near-flat data
    if (std < 0.02) std = 0.02;
    return {
      mean: Math.round(mean * 1000) / 1000,
      std: Math.round(std * 1000) / 1000,
      count: values.length,
      window: days || 'all'
    };
  }

  // ── READ API ──

  function _longGetHistory(days) {
    var mem = _getLongMemory();
    return mem.daily.slice(-(days || 30));
  }

  // Windowed baseline: getBaseline(domain) = all data, getBaseline(domain, 30) = last 30 days
  function _longGetBaseline(domain, days) {
    return _longComputeBaseline(domain, days);
  }

  function _longGetTrend(domain, days) {
    var history = _longGetHistory(days || 30);
    if (history.length < 3) return { direction: 'insufficient', slope: 0 };
    var values = [];
    for (var i = 0; i < history.length; i++) {
      if (history[i].domains[domain] !== undefined) values.push(history[i].domains[domain]);
    }
    if (values.length < 3) return { direction: 'insufficient', slope: 0 };
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (var j = 0; j < values.length; j++) {
      sumX += j; sumY += values[j]; sumXY += j * values[j]; sumX2 += j * j;
    }
    var slope = (values.length * sumXY - sumX * sumY) / (values.length * sumX2 - sumX * sumX);
    var direction = Math.abs(slope) < 0.003 ? 'stable' : (slope > 0 ? 'rising' : 'falling');
    return { direction: direction, slope: Math.round(slope * 10000) / 10000, days: values.length };
  }

  // Z-score against specified window (default 30 days)
  function _longGetZScore(domain, days) {
    var bl = _longComputeBaseline(domain, days || 30);
    if (!bl || bl.count < _LONG_MIN_DAYS_FOR_REGIME) return null;
    var domains = window.LIMENDomains || {};
    var current = (domains[domain] && domains[domain].stress) || 0;
    return Math.round((current - bl.mean) / bl.std * 100) / 100;
  }

  // Regime classification against specified window
  function _longGetRegime(domain, days) {
    var z = _longGetZScore(domain, days);
    if (z === null) return 'INSUFFICIENT_DATA';
    var absZ = Math.abs(z);
    if (absZ > 2) return 'EXTREME';
    if (absZ > 1) return 'ELEVATED';
    return 'NORMAL';
  }

  function _longCompareToYesterday(domain) {
    var mem = _getLongMemory();
    if (mem.daily.length < 2) return null;
    var today = mem.daily[mem.daily.length - 1];
    var yesterday = mem.daily[mem.daily.length - 2];
    var t = today.domains[domain];
    var y = yesterday.domains[domain];
    if (t === undefined || y === undefined) return null;
    return { today: t, yesterday: y, delta: Math.round((t - y) * 1000) / 1000 };
  }

  function _longCompareTo30Day(domain) {
    var bl = _longComputeBaseline(domain, 30);
    if (!bl) return null;
    var domains = window.LIMENDomains || {};
    var current = (domains[domain] && domains[domain].stress) || 0;
    return {
      current: current,
      mean30: bl.mean,
      delta: Math.round((current - bl.mean) * 1000) / 1000,
      regime: _longGetRegime(domain, 30)
    };
  }

  // ── Cycle detection with deterministic thresholds ──
  // RECURRING_SPIKES: >=3 days in last 30 above +2σ, each separated by >=2 days
  // SUSTAINED_ELEVATION: >=7 of last 10 days above +1σ
  function _longDetectCycles(domain, days) {
    var window_ = days || 90;
    var history = _longGetHistory(window_);
    if (history.length < 14) return { hasCycle: false, reason: 'insufficient data (<14 days)' };

    var values = [];
    for (var i = 0; i < history.length; i++) {
      if (history[i].domains[domain] !== undefined) values.push(history[i].domains[domain]);
    }
    if (values.length < 14) return { hasCycle: false, reason: 'insufficient data (<14 values)' };

    var bl = _longComputeBaseline(domain, window_);
    if (!bl) return { hasCycle: false, reason: 'no baseline' };

    // RECURRING_SPIKES: >=3 days above +2σ, each pair separated by >=2 days
    var spikeThreshold = bl.mean + bl.std * 2;
    var spikeDays = [];
    for (var s = 0; s < values.length; s++) {
      if (values[s] > spikeThreshold) spikeDays.push(s);
    }
    // Filter: require >=2 day gaps between spikes (not consecutive = single event)
    var separatedSpikes = [];
    for (var sp = 0; sp < spikeDays.length; sp++) {
      if (separatedSpikes.length === 0 || spikeDays[sp] - separatedSpikes[separatedSpikes.length - 1] >= 2) {
        separatedSpikes.push(spikeDays[sp]);
      }
    }
    var hasRecurringSpikes = separatedSpikes.length >= 3;

    // SUSTAINED_ELEVATION: >=7 of last 10 days above +1σ
    var elevThreshold = bl.mean + bl.std;
    var last10 = values.slice(-10);
    var elevCount = 0;
    for (var e = 0; e < last10.length; e++) {
      if (last10[e] > elevThreshold) elevCount++;
    }
    var hasSustainedElevation = last10.length >= 10 && elevCount >= 7;

    var pattern = 'NONE';
    if (hasRecurringSpikes) pattern = 'RECURRING_SPIKES';
    else if (hasSustainedElevation) pattern = 'SUSTAINED_ELEVATION';

    return {
      hasCycle: hasRecurringSpikes || hasSustainedElevation,
      spikeCount: separatedSpikes.length,
      sustainedElevatedDays: elevCount,
      sustainedWindow: last10.length,
      totalDays: values.length,
      pattern: pattern
    };
  }

  // ── Public API ──
  window.LIMENLongMemory = {
    getHistory: _longGetHistory,
    getBaseline: _longGetBaseline,
    getTrend: _longGetTrend,
    getZScore: _longGetZScore,
    getRegime: _longGetRegime,
    compareToYesterday: _longCompareToYesterday,
    compareTo30Day: _longCompareTo30Day,
    detectCycles: _longDetectCycles
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Gate B #9C.4 Phase 1 — Capital Conversion authority classifier.
  //
  // Doctrine carried (operator 2026-06-02):
  //   A candidate capital signal is not a filing, grant, loan, or
  //   investment recommendation.
  //
  //   When the action verb is the dangerous part, a badge is not
  //   enough. The verb must be demoted.
  //
  // Different shape from #9C.1-3's badge-above-body family. Here the
  // load-bearing thing is the imperative action text rendered at
  // "DO NOW: {opp.action}" (file line 4033 of the pre-edit file).
  // Operator-facing verbs like "File provisional...", "Apply to SBIR...",
  // "Position in strongest..." are directly action-triggering. A badge
  // above them would still leave the operator processing the verb.
  // The fix: the verb itself changes shape — replaced by a hedged
  // label, and the original action text moves into a collapsed audit
  // drawer.
  //
  // FULL_ACTION_AUTHORITY is documented but unreachable today. No
  // upstream field on opp proves verified filing/investment/grant/loan
  // authority. When a future schema adds verified_filing /
  // executed_position / equivalent, the unreachable check below can
  // flip to a real predicate.
  // ═══════════════════════════════════════════════════════════════════════════

  var _CAP_KNOWN_SOURCE_TYPES = {
    brain_opportunity: true,
    brain_emission: true,
    treatment_gap: true,
    macro_shock: true,
    temporal_gap: true,
    filing_density: true,
    novelty: true,
    cross_domain: true,
    cross_domain_node: true,
    institutional_gap: true,
    medium_confidence_gap: true
  };

  var _CAP_KNOWN_PATHS = {
    'INVESTABLE': true,
    'RESEARCHABLE': true
  };

  function _capEscapeText(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _hedgedLabelForPath(path) {
    if (path === 'INVESTABLE')   return 'CANDIDATE INVESTABLE — not a position recommendation';
    if (path === 'RESEARCHABLE') return 'CANDIDATE RESEARCHABLE — not a validated finding';
    return 'CAPITAL SIGNAL — AUTHORITY UNKNOWN';
  }

  function _classifyCapitalOpportunityAuthority(opp) {
    // FULL_ACTION_AUTHORITY branch — currently unreachable. Documented
    // here so a future upstream change (verified_filing /
    // executed_position / etc.) can flip the predicate without
    // restructuring the classifier shape. The predicate is
    // false-by-construction today.
    var __hasVerifiedAuthority = false;
    if (__hasVerifiedAuthority) {
      return {
        level: 'FULL_ACTION_AUTHORITY',
        hedgedLabel: null,
        suppressActionText: false,
        reason: null
      };
    }

    // UNSUPPORTED_OR_INCOMPLETE — malformed opp, missing/unrecognized
    // sourceType, missing/unrecognized path. Any of these means
    // authority cannot be determined, so the action verb must be
    // suppressed and the label demoted to authority-unknown.
    if (!opp || typeof opp !== 'object') {
      return {
        level: 'UNSUPPORTED_OR_INCOMPLETE',
        hedgedLabel: 'CAPITAL SIGNAL — AUTHORITY UNKNOWN',
        suppressActionText: true,
        reason: 'Opportunity object is missing or malformed.'
      };
    }

    var sourceType = opp.sourceType;
    var path = opp.path;
    var sourceOK = typeof sourceType === 'string' &&
                   _CAP_KNOWN_SOURCE_TYPES[sourceType] === true;
    var pathOK = typeof path === 'string' &&
                 _CAP_KNOWN_PATHS[path] === true;

    if (!sourceOK || !pathOK) {
      var __unsupReasonParts = [];
      if (!sourceOK) {
        __unsupReasonParts.push('sourceType ' +
          (typeof sourceType === 'string' && sourceType.length > 0
            ? '"' + sourceType + '" is not recognized'
            : 'is missing'));
      }
      if (!pathOK) {
        __unsupReasonParts.push('path ' +
          (typeof path === 'string' && path.length > 0
            ? '"' + path + '" is not recognized'
            : 'is missing'));
      }
      return {
        level: 'UNSUPPORTED_OR_INCOMPLETE',
        hedgedLabel: 'CAPITAL SIGNAL — AUTHORITY UNKNOWN',
        suppressActionText: true,
        reason: 'Authority cannot be determined: ' +
                __unsupReasonParts.join('; ') + '.'
      };
    }

    // CANDIDATE_CAPITAL_SIGNAL — recognized source AND recognized path.
    // Engine-derived signal exists; action text suppressed because no
    // field proves the underlying action is verified or has been
    // executed.
    return {
      level: 'CANDIDATE_CAPITAL_SIGNAL',
      hedgedLabel: _hedgedLabelForPath(path),
      suppressActionText: true,
      reason: 'Source is engine-derived (' + sourceType + '), not ' +
              'verified filing/investment authority. Action text ' +
              'retained for audit only.'
    };
  }

  // ── TOP-10 INVESTMENT TARGETS support ──────────────────────────────────
  // command-board domain key differs from the brain domainId for three domains.
  var _CAP_BOARD_ALIAS = { health: 'medicine', research: 'science', supplyChain: 'trade' };

  // Load the command-board company universe once (cached on window). Builds a
  // domain -> [{ticker,name,ds,phase,alert,traj}] map sorted by alert then
  // distress (the most-stressed = the most urgent target). When it finishes,
  // re-render the patent tab so targets upgrade from the brainCompanies
  // fallback to distress-ranked names.
  function _capLoadBoardMap() {
    if (window._capBoardMap || window._capBoardMapLoading) return;
    window._capBoardMapLoading = true;
    fetch('/assets/data/command-board-data.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var map = {};
        if (data) {
          var arr = Array.isArray(data) ? data
            : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          arr.forEach(function (x) {
            if (!x || !x.d || !x.t) return;
            (map[x.d] = map[x.d] || []).push({
              ticker: x.t, name: x.n, ds: (typeof x.ds === 'number' ? x.ds : 0),
              phase: x.p, alert: !!x.a, traj: x.tr
            });
          });
          Object.keys(map).forEach(function (k) {
            map[k].sort(function (a, b) { return (b.alert - a.alert) || (b.ds - a.ds); });
          });
        }
        window._capBoardMap = map;
        window._capBoardMapLoading = false;
        if (_activeTab === 'patent') { _tabContentEl.innerHTML = ''; _renderTabPatent(); }
      })
      .catch(function () { window._capBoardMapLoading = false; window._capBoardMap = {}; });
  }

  // Pick the top-N target names for an opportunity's domain. Prefers the
  // distress-ranked command-board map; falls back to the brain's company list
  // (always present after the base-brain company fallback) so a target always
  // shows even before the board map finishes loading.
  function _capTargetsForDomain(domain, n) {
    var key = _CAP_BOARD_ALIAS[domain] || domain;
    var map = window._capBoardMap;
    if (map && map[key] && map[key].length) return map[key].slice(0, n);
    var dom = (window.LIMENDomains || {})[domain];
    var bc = dom && dom.brainCompanies;
    if (Array.isArray(bc) && bc.length) {
      return bc.slice(0, n).map(function (c) {
        return { ticker: c.ticker, name: c.name, phase: c.phase, ds: 0, alert: false };
      });
    }
    return [];
  }

  // Cross-domain Top-10 of the highest-urgency INVESTABLE opportunities, each
  // with concrete target tickers. Advisory framing only (not buy advice).
  function _renderTopInvestmentTargets(container, opportunities) {
    _capLoadBoardMap();
    var invest = (opportunities || []).filter(function (o) { return o && o.path === 'INVESTABLE'; });
    if (!invest.length) return;

    function uTier(o) {
      var u = (o._brainUrgency || o.urgency || '').toString().toUpperCase();
      if (u.indexOf('HIGH') !== -1 || u === 'CRITICAL') return 3;
      if ((o.stress || 0) >= 0.70 && (o.confidence || 0) >= 0.40) return 3;
      if (u.indexOf('MED') !== -1 || (o.stress || 0) >= 0.50) return 2;
      return 1;
    }
    invest.forEach(function (o) { o._uTier = uTier(o); });
    invest.sort(function (a, b) {
      return (b._uTier - a._uTier) || (b._priority - a._priority) || (b.confidence - a.confidence);
    });

    // Diversity cap: at most 2 per domain, then relax to fill to 10.
    var perDom = {}, top = [];
    for (var i = 0; i < invest.length && top.length < 10; i++) {
      var d = invest[i].domain || '?';
      if ((perDom[d] || 0) >= 2) continue;
      perDom[d] = (perDom[d] || 0) + 1; top.push(invest[i]);
    }
    for (var j = 0; j < invest.length && top.length < 10; j++) {
      if (top.indexOf(invest[j]) === -1) top.push(invest[j]);
    }

    var card = _subCard('TOP 10 HIGH-URGENCY INVESTMENT TARGETS');
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.34rem;color:rgba(200,195,184,0.45);padding:2px 8px 6px;letter-spacing:0.5px';
    sub.textContent = 'Cross-domain · INVESTABLE lane · ranked by urgency × priority · names with exposure, NOT buy recommendations';
    card.appendChild(sub);

    top.forEach(function (o, idx) {
      var targets = _capTargetsForDomain(o.domain, 3);
      var tickers = targets.map(function (t) { return t.ticker; }).filter(Boolean);
      if (o.exposedCompanies && o.exposedCompanies.length) {
        var ex = o.exposedCompanies.map(function (c) { return typeof c === 'string' ? c : (c && c.ticker); }).filter(Boolean);
        if (ex.length) tickers = ex.slice(0, 3);
      }
      var uColor = o._uTier >= 3 ? '#e85454' : o._uTier === 2 ? '#C9A94E' : '#888';
      var uLabel = o._uTier >= 3 ? 'HIGH' : o._uTier === 2 ? 'MED' : 'LOW';
      var thesis = (o.title || o.indication || 'opportunity').replace(/_/g, ' ');
      if (thesis.length > 72) thesis = thesis.slice(0, 70) + '…';

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:baseline;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.03)';
      var html = '';
      html += '<span style="font-size:0.5rem;color:rgba(201,169,78,0.7);width:18px;flex-shrink:0">' + (idx + 1) + '</span>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:0.44rem;color:rgba(228,224,214,0.92)">' + thesis + '</div>';
      html += '<div style="font-size:0.34rem;color:rgba(200,195,184,0.45);margin-top:1px">' + (o.domain || '').toUpperCase() + ' · ' + Math.round((o.confidence || 0) * 100) + '% conf · ' + Math.round((o.stress || 0) * 100) + '% stress</div>';
      if (tickers.length) {
        html += '<div style="font-size:0.42rem;color:rgba(120,205,185,0.92);margin-top:2px;letter-spacing:0.5px">Targets: ' + tickers.join(' · ') + '</div>';
      } else {
        html += '<div style="font-size:0.34rem;color:rgba(200,195,184,0.3);margin-top:2px">Targets: pull command board for ' + (o.domain || '') + ' names</div>';
      }
      html += '</div>';
      html += '<span style="font-size:0.3rem;letter-spacing:1.5px;color:' + uColor + ';border:1px solid ' + uColor + '55;border-radius:2px;padding:1px 5px;flex-shrink:0">' + uLabel + '</span>';
      row.innerHTML = html;
      card.appendChild(row);
    });

    var note = document.createElement('div');
    note.style.cssText = 'font-size:0.3rem;color:rgba(200,195,184,0.25);padding:5px 8px;letter-spacing:0.5px';
    note.textContent = 'Targets ranked by distress/alert within each opportunity’s domain · advisory only · not financial advice.';
    card.appendChild(note);
    container.appendChild(card);
  }

  function _renderTabPatent() {
    var reports = window.LIMENReports || {};
    var report = reports.patentOpportunity;
    var domains = window.LIMENDomains || {};
    var mgr = window.LIMENRemedyRegistryManager;

    // ── CAPITAL CLASSIFICATION MAP ──
    // Signal type → capital pathway
    var CAPITAL_MAP = {
      temporal_gap:         { path: 'RESEARCHABLE', color: '#9b8cff', icon: '\u203B', action: 'Innovation has stalled here with no formalized approach \u2014 a research opening. Frame the open question from the portal treatment steps and pursue it as a study.' },
      filing_density:       { path: 'RESEARCHABLE', color: '#9b8cff', icon: '\u203B', action: 'Thin formal coverage of an active area \u2014 a research opening. Characterize what works in practice and turn it into a documented method.' },
      novelty:              { path: 'RESEARCHABLE', color: '#9b8cff', icon: '\u203B', action: 'Innovation spike with little prior work. Define the research question from the portal treatment methodology and validate it.' },
      cross_domain:         { path: 'INVESTABLE',   color: '#5ab5a0', icon: '\u25B6', action: 'Cross-domain node = bridge company opportunity. Check the command board for companies in both domains. Position in the strongest.' },
      cross_domain_node:    { path: 'INVESTABLE',   color: '#5ab5a0', icon: '\u25B6', action: 'Node spans multiple sectors. Identify companies operating at this intersection via the command board.' },
      institutional_gap:    { path: 'INVESTABLE',   color: '#5ab5a0', icon: '\u25B6', action: 'Institutional gap = an unserved market. Identify who could build/operate this and the public names with exposure via the command board.' },
      medium_confidence_gap:{ path: 'INVESTABLE',   color: '#5ab5a0', icon: '\u25B6', action: 'Possible opening at moderate confidence \u2014 watch-list it. Confirm the strain via the live feeds before sizing any position.' }
    };

    // ── PROVENANCE CHIP ──
    // Maps the already-set opp.sourceType to a user-facing provenance label.
    function _provenanceChip(sourceType) {
      if (sourceType === 'brain_opportunity') return { label: 'BRAIN',          color: '#5ab5a0' };
      if (sourceType === 'brain_emission')    return { label: 'BRAIN-EMISSION', color: '#5ab5a0' };
      if (sourceType === 'treatment_gap')     return { label: 'REGISTRY-GAP',   color: '#4a8fd4' };
      if (sourceType === 'macro_shock')       return { label: 'MACRO-SHOCK',    color: '#e85454' };
      return { label: 'REPORT-SIGNAL', color: '#C9A94E' };
    }

    // Build capital opportunities from signals + live domain data + registry
    var opportunities = [];

    // Source 1: Patent report signals
    if (report && report.signals) {
      for (var si = 0; si < report.signals.length; si++) {
        var sig = report.signals[si];
        var capInfo = CAPITAL_MAP[sig.type] || { path: 'INVESTABLE', color: '#888', icon: '?', action: 'Investigate this signal.' };
        var domain = sig.domain || sig.techNode || (report.summary ? report.summary.topDomain : '') || '';
        var indication = sig.indication || sig.techNode || domain || 'unspecified area';

        // Skip abstract signals with no domain or indication
        if (!domain && !sig.indication && !sig.techNode) continue;

        // Get domain stress context
        var domStress = domains[domain] ? domains[domain].stress || 0 : 0;

        // Get treatment implementations from registry
        var implementations = [];
        if (mgr && domain) {
          var txList = mgr.getTreatmentsOnDomainStress(domain, domStress);
          for (var ti = 0; ti < Math.min(txList.length, 2); ti++) {
            implementations.push(txList[ti].title || txList[ti].label || '');
          }
        }

        var exposedCompanies = [];

        opportunities.push({
          path: capInfo.path,
          color: capInfo.color,
          icon: capInfo.icon,
          domain: domain,
          indication: indication,
          stress: domStress,
          action: capInfo.action,
          implementations: implementations,
          exposedCompanies: exposedCompanies,
          confidence: sig.confidence || (report.summary ? report.summary.confidence : 0) || 0,
          sourceType: sig.type || 'unknown'
        });
      }
    }

    // Source 2: Treatment gaps from registry (domains with many diagnoses, few treatments)
    if (mgr) {
      var dk = Object.keys(domains);
      for (var di = 0; di < dk.length; di++) {
        var dd = domains[dk[di]];
        var dxList = mgr.getDiagnosesForDomain(dk[di]);
        var txList = mgr.getTreatmentsOnDomainStress(dk[di], dd.stress || 0);
        if (dxList.length > 10 && txList.length < 3 && (dd.stress || 0) > 0.3) {
          opportunities.push({
            path: 'RESEARCHABLE',
            color: '#9b8cff',
            icon: '\u203b',
            domain: dk[di],
            indication: dk[di].toUpperCase() + ': ' + dxList.length + ' diagnoses but only ' + txList.length + ' treatments',
            stress: dd.stress || 0,
            action: 'Treatment gap in a stressed domain \u2014 a research opening: many diagnoses, few treatments. Frame the unmet-need question and pursue a study or build that addresses the diagnostic triggers.',
            implementations: txList.length > 0 ? [txList[0].title || ''] : ['No existing treatments \u2014 greenfield opportunity'],
            exposedCompanies: [],
            confidence: (dd.stress || 0) * 0.8,
            sourceType: 'treatment_gap'
          });
        }
      }
    }

    // Source 3: Real brain opportunities from every domain (sovereign brain output)
    // Replaces the prior Civilization-invented OPPORTUNITY_FAMILIES fabrication.
    // Reads window.LIMENDomains[key].brainOpportunities populated by the adapter.
    var allDomKeys = Object.keys(domains);
    function _capPathFromBrain(bopp) {
      var p = bopp && bopp.path;
      // investment + research only. Legacy relane: PATENTABLE->RESEARCHABLE, GRANT/LOAN->INVESTABLE.
      if (p === 'RESEARCHABLE' || p === 'PATENTABLE') return { path: 'RESEARCHABLE', color: '#9b8cff', icon: '\u203B' };
      return { path: 'INVESTABLE', color: '#5ab5a0', icon: '\u25B6' };
    }

    for (var sdi = 0; sdi < allDomKeys.length; sdi++) {
      var sdk = allDomKeys[sdi];
      var sd = domains[sdk];
      if (!sd || !Array.isArray(sd.brainOpportunities)) continue;
      var brainOpps = sd.brainOpportunities;
      if (brainOpps.length === 0) continue;
      var sdStress = sd.stress || 0;

      for (var boi = 0; boi < brainOpps.length; boi++) {
        var bopp = brainOpps[boi];
        if (!bopp || !bopp.title) continue;

        var pathInfo = _capPathFromBrain(bopp);
        var bRank = typeof bopp.rank === 'number' ? bopp.rank : 0;
        var bConfidence = Math.max(0.1, Math.min(0.95, bRank));
        var bUrgency = (bopp.urgency || '').toUpperCase();
        var actionText = '';
        if (bopp.diagnosisId) actionText = 'Linked to active diagnosis ' + bopp.diagnosisId + '. ';
        actionText += bUrgency ? ('Urgency: ' + bUrgency + '.') : '';

        opportunities.push({
          path: pathInfo.path,
          color: pathInfo.color,
          icon: pathInfo.icon,
          domain: sdk,
          indication: sdk.toUpperCase() + ': ' + bopp.title,
          title: bopp.title,
          stress: typeof bopp.stress === 'number' ? bopp.stress : sdStress,
          action: actionText || 'Brain-sourced opportunity.',
          implementations: [],
          exposedCompanies: Array.isArray(bopp.companies) ? bopp.companies : [],
          confidence: bConfidence,
          sourceType: 'brain_opportunity',
          _brainSource: true,
          _brainDiagnosisId: bopp.diagnosisId || null,
          _brainTier: bopp.tier || null,
          _brainUrgency: bopp.urgency || null,
          _brainObj: bopp
        });
      }
    }

    // Source 4: Real brain cross-domain emissions (sovereign brain output)
    // Replaces the prior Civilization-invented pairwise stress synthesis.
    // Reads window.LIMENDomains[key].brainEmissions populated by the adapter.
    for (var edi = 0; edi < allDomKeys.length; edi++) {
      var edk = allDomKeys[edi];
      var ed = domains[edk];
      if (!ed || !Array.isArray(ed.brainEmissions)) continue;
      var emissions = ed.brainEmissions;
      for (var ei = 0; ei < emissions.length; ei++) {
        var em = emissions[ei];
        if (!em) continue;
        var target = em.targetDomain || '';
        var signal = em.signal || em.signalType || '';
        var mag = typeof em.magnitude === 'number' ? em.magnitude : 0;
        if (!target && !signal) continue;

        var emIndication = edk.toUpperCase() + (target ? ' \u2192 ' + String(target).toUpperCase() : '') + (signal ? ' \u00b7 ' + String(signal).replace(/_/g, ' ') : '');
        var emTitle = (signal ? String(signal).replace(/_/g, ' ') : 'cross-domain emission') + (target ? ' \u2192 ' + target : '');

        opportunities.push({
          path: 'INVESTABLE',
          color: '#5ab5a0',
          icon: '\u25B6',
          domain: edk,
          indication: emIndication,
          title: emTitle,
          stress: mag,
          action: 'Real cross-domain emission from ' + edk + ' brain' + (target ? ' toward ' + target : '') + '. Magnitude: ' + mag.toFixed(2) + '.',
          implementations: [],
          exposedCompanies: [],
          confidence: Math.max(0.1, Math.min(0.95, mag)),
          sourceType: 'brain_emission',
          _brainSource: true,
          _brainEmissionTarget: target || null
        });
      }
    }

    // Source 5: Macro shock opportunities (from defense signal engine)
    var defenseStatus = window.LIMENDefenseSignals ? window.LIMENDefenseSignals.getStatus() : null;
    if (defenseStatus && defenseStatus.macroShock) {
      var shockSignals = defenseStatus.signals || [];
      for (var msi = 0; msi < shockSignals.length; msi++) {
        var msig = shockSignals[msi];
        if (msig.confidence === 'LOW') continue;
        for (var mdi = 0; mdi < msig.affectedDomains.length; mdi++) {
          var mDom = msig.affectedDomains[mdi];
          opportunities.push({
            path: 'INVESTABLE',
            color: '#5ab5a0',
            icon: '\u25B6',
            domain: mDom,
            indication: msig.eventType.replace(/_/g, ' ') + ' \u2192 ' + mDom.toUpperCase() + ' impact (' + msig.articleCount + ' signals)',
            title: msig.eventType.replace(/_/g, ' ').toLowerCase() + ' response — ' + mDom,
            stress: msig.magnitude,
            action: msig.articleCount + ' news articles confirm ' + msig.eventType.replace(/_/g, ' ').toLowerCase() + '. ' + mDom.toUpperCase() + ' sector exposed. Position for demand or resilience.',
            implementations: [],
            exposedCompanies: [],
            confidence: msig.confidenceValue || 0.5,
            sourceType: 'macro_shock'
          });
        }
      }
    }

    if (opportunities.length === 0) {
      _renderEmpty('patent');
      return;
    }

    // ── DEDUPLICATION ──
    // Semantic dedupe: same domain + same title/family is a duplicate.
    // Different families within same domain are NOT duplicates.
    var dedupMap = {};
    var deduped = [];
    var suppressed = 0;
    for (var ddi = 0; ddi < opportunities.length; ddi++) {
      var opp = opportunities[ddi];
      // Use title (specific) if available, else fall back to indication prefix
      var titleKey = (opp.title || opp.indication || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
      var dedupKey = opp.domain + '|' + opp.path + '|' + titleKey;
      if (dedupMap[dedupKey]) {
        if (opp.confidence > dedupMap[dedupKey].confidence) {
          var idx = deduped.indexOf(dedupMap[dedupKey]);
          if (idx !== -1) deduped[idx] = opp;
          dedupMap[dedupKey] = opp;
        }
        suppressed++;
      } else {
        dedupMap[dedupKey] = opp;
        deduped.push(opp);
      }
    }
    opportunities = deduped;
    if (suppressed > 0) console.log('[CapOpp] Suppressed ' + suppressed + ' near-duplicate opportunities');

    // ── PRIORITY SCORING ──
    // confidence (0-1) × 0.3 + actionability (0-1) × 0.3 + stress × 0.2 + grounding quality × 0.2
    var EXEC_CONFIDENCE_THRESHOLD = 0.25;
    opportunities.forEach(function(o) {
      var conf = o.confidence || 0;
      // Actionability: grounded domains score higher
      var groundable = _canGenerateGrant(o) ? 1.0 : 0.3;
      // Capital fit: investable + researchable are the only lanes now.
      var capFit = (o.path === 'INVESTABLE') ? 0.7 : (o.path === 'RESEARCHABLE') ? 0.6 : 0.4;
      var actionability = groundable * 0.6 + capFit * 0.4;
      var priority = conf * 0.3 + actionability * 0.3 + (o.stress || 0) * 0.2 + groundable * 0.2;
      o._priority = _adjustedPriority(o, Math.round(priority * 100));
      // Execution-ready flag
      o._execReady = groundable > 0.5 && conf >= EXEC_CONFIDENCE_THRESHOLD && o.sourceType !== 'unknown';
    });

    // Sort by priority descending
    opportunities.sort(function(a, b) {
      return b._priority - a._priority || b.confidence - a.confidence;
    });

    // Store for generator access
    window._capOpportunities = {};
    opportunities.forEach(function(o) { window._capOpportunities[_capOppId(o)] = o; });

    // ── SUMMARY CARD ──
    var pathCounts = {};
    opportunities.forEach(function(o) { pathCounts[o.path] = (pathCounts[o.path] || 0) + 1; });
    var summCard = _subCard('CAPITAL OPPORTUNITIES \u2014 ' + opportunities.length + ' TOTAL');
    var summLine = [];
    if (pathCounts['INVESTABLE']) summLine.push(pathCounts['INVESTABLE'] + ' investable');
    if (pathCounts['RESEARCHABLE']) summLine.push(pathCounts['RESEARCHABLE'] + ' researchable');
    var summDiv = document.createElement('div');
    summDiv.style.cssText = 'font-size:0.38rem;color:rgba(200,195,184,0.5);padding:4px 8px';
    summDiv.textContent = summLine.join(' \u00b7 ');
    summCard.appendChild(summDiv);

    if (report && report.summary) {
      _addRow(summCard, 'Top Domain', report.summary.topDomain || 'none');
      _addRow(summCard, 'System Confidence', Math.round((report.summary.confidence || 0) * 100) + '%');
    }
    var noteDiv = document.createElement('div');
    noteDiv.style.cssText = 'font-size:0.3rem;color:rgba(200,195,184,0.2);padding:4px 8px;letter-spacing:1px';
    noteDiv.textContent = 'RECURSIVE REGULATION ENGINE \u00b7 ADVISORY \u00b7 NOT FINANCIAL ADVICE';
    summCard.appendChild(noteDiv);
    _tabContentEl.appendChild(summCard);

    // ── TOP 10 HIGH-URGENCY INVESTMENT TARGETS (cross-domain, with tickers) ──
    _renderTopInvestmentTargets(_tabContentEl, opportunities);

    // ── OPPORTUNITY CARDS ──
    // Group by capital pathway
    // Collapsible per-domain grouping (replaces path-based grouping)
    var byDomain = {};
    var domainOrder = [];
    opportunities.forEach(function(o) {
      var dk = o.domain || 'other';
      if (!byDomain[dk]) { byDomain[dk] = []; domainOrder.push(dk); }
      byDomain[dk].push(o);
    });

    if (!window._capOppDomainExpanded) window._capOppDomainExpanded = {};
    var _capExpState = window._capOppDomainExpanded;

    if (!window._capOppDomainHeaderDelegated) {
      window._capOppDomainHeaderDelegated = true;
      document.addEventListener('click', function (ev) {
        var el = ev.target;
        while (el && el !== document.body) {
          if (el.getAttribute && el.getAttribute('data-cap-opp-domain-header')) {
            var k = el.getAttribute('data-cap-opp-domain-header');
            window._capOppDomainExpanded[k] = !window._capOppDomainExpanded[k];
            if (_activeTab === 'patent') { _tabContentEl.innerHTML = ''; _renderTabPatent(); }
            return;
          }
          el = el.parentNode;
        }
      });
    }

    for (var di2 = 0; di2 < domainOrder.length; di2++) {
      var domKey = domainOrder[di2];
      var domOpps = byDomain[domKey];
      if (!domOpps || domOpps.length === 0) continue;

      // Per-path counts for header breakdown
      var pathBreakdown = {};
      domOpps.forEach(function (o) { pathBreakdown[o.path] = (pathBreakdown[o.path] || 0) + 1; });
      var breakdownParts = [];
      ['INVESTABLE', 'RESEARCHABLE'].forEach(function (p) {
        if (pathBreakdown[p]) {
          var short = p === 'INVESTABLE' ? 'INVEST' : 'RESEARCH';
          breakdownParts.push(pathBreakdown[p] + ' ' + short);
        }
      });

      var isExpanded = _capExpState[domKey] !== false; // default expanded

      var domSection = document.createElement('div');
      domSection.style.cssText = 'margin-bottom:8px;border-left:3px solid rgba(90,181,160,0.25);background:rgba(0,0,0,0.08);border-radius:2px';

      var domHeaderEl = document.createElement('div');
      domHeaderEl.setAttribute('data-cap-opp-domain-header', domKey);
      domHeaderEl.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;align-items:baseline;gap:8px;user-select:none;border-bottom:1px solid rgba(201,169,78,0.06)';
      var caret = isExpanded ? '\u25BE' : '\u25B8';
      var domLabel = (DOMAIN_LABELS[domKey] || domKey).toUpperCase();
      domHeaderEl.innerHTML =
        '<span style="font-size:0.44rem;color:rgba(201,169,78,0.5);width:12px">' + caret + '</span>' +
        '<span style="font-size:0.46rem;letter-spacing:1.5px;color:rgba(220,215,200,0.8)">' + domLabel + '</span>' +
        '<span style="font-size:0.32rem;color:rgba(200,195,184,0.4);margin-left:8px">' + domOpps.length + ' opportunit' + (domOpps.length === 1 ? 'y' : 'ies') + '</span>' +
        (breakdownParts.length > 0 ? '<span style="font-size:0.28rem;color:rgba(200,195,184,0.3);margin-left:auto;letter-spacing:0.5px">' + breakdownParts.join(' \u00b7 ') + '</span>' : '');
      domSection.appendChild(domHeaderEl);

      if (!isExpanded) {
        _tabContentEl.appendChild(domSection);
        continue;
      }

      var domBody = document.createElement('div');
      domBody.style.cssText = 'padding:6px 10px';
      domSection.appendChild(domBody);

      for (var oi = 0; oi < domOpps.length; oi++) {
        var opp = domOpps[oi];
        var oppDiv = document.createElement('div');
        oppDiv.style.cssText = 'padding:6px 8px;margin-bottom:6px;border-left:3px solid ' + opp.color + ';background:rgba(0,0,0,0.1)';

        var oh = '';
        // Header
        oh += '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px">';
        oh += '<span style="color:' + opp.color + ';font-size:0.5rem">' + opp.icon + '</span>';
        oh += '<span style="font-size:0.5rem;color:rgba(228,224,214,0.95)">' + opp.indication + '</span>';
        var _provCh = _provenanceChip(opp.sourceType);
        oh += '<span style="font-size:0.26rem;letter-spacing:1.2px;color:' + _provCh.color + ';padding:1px 5px;border:1px solid ' + _provCh.color + '33;border-radius:2px;margin-left:auto">' + _provCh.label + '</span>';
        oh += '<span style="font-size:0.28rem;color:rgba(200,195,184,0.2);margin-left:8px">' + Math.round(opp.confidence * 100) + '% conf</span>';
        oh += '</div>';

        // Domain + stress context
        if (opp.domain && opp.stress > 0) {
          oh += '<div style="font-size:0.4rem;color:rgba(210,205,194,0.65)">' + opp.domain.toUpperCase() + ' stress: ' + Math.round(opp.stress * 100) + '%</div>';
        }

        // Gate B #9C.4 Phase 1 — capital opportunity authority.
        // Replaces the "DO NOW: {opp.action}" headline with a hedged
        // label. Original action text moves into a collapsed audit
        // drawer below. FULL_ACTION_AUTHORITY branch retains the
        // existing "DO NOW:" rendering for the future case when an
        // upstream verified-filing field exists; today it is
        // unreachable.
        var __capAuth = _classifyCapitalOpportunityAuthority(opp);
        if (__capAuth.level === 'FULL_ACTION_AUTHORITY') {
          // Unreachable today; documented branch for future verified
          // filing/investment authority.
          oh += '<div style="font-size:0.36rem;color:rgba(201,169,78,0.6);margin-top:4px;padding:3px 6px;border-left:2px solid rgba(201,169,78,0.15)">';
          oh += 'DO NOW: ' + _capEscapeText(opp.action);
          oh += '</div>';
        } else {
          // Hedged label replaces the DO NOW headline. CANDIDATE or
          // UNSUPPORTED. The action verb is demoted out of the
          // operator-facing surface entirely; it remains visible only
          // inside the collapsed audit drawer for inspection.
          var __capLabelCls = __capAuth.level === 'UNSUPPORTED_OR_INCOMPLETE'
                            ? 'unsupported'
                            : 'candidate';
          oh += '<div class="clr-cap-hedged-label ' + __capLabelCls + '">' +
                _capEscapeText(__capAuth.hedgedLabel) +
                '</div>';

          // Audit drawer — collapsed by default. Holds the original
          // action text + suppression reason. Honest about what the
          // engine produced; explicit that it is NOT a recommendation.
          if (opp.action) {
            oh += '<details class="clr-cap-audit-drawer">';
            oh += '<summary>audit · suppressed action text</summary>';
            oh += '<div class="clr-cap-audit-body">';
            oh += '<div><strong>Suppressed action:</strong> "' +
                  _capEscapeText(opp.action) + '"</div>';
            if (__capAuth.reason) {
              oh += '<div style="margin-top:4px"><strong>Suppression reason:</strong> ' +
                    _capEscapeText(__capAuth.reason) + '</div>';
            }
            oh += '<div style="margin-top:4px">Action text retained for audit only. ' +
                  'It is not a filing, grant, loan, or investment recommendation.</div>';
            oh += '</div>';
            oh += '</details>';
          }
        }

        // Implementation from portal treatments
        if (opp.implementations.length > 0) {
          oh += '<div style="font-size:0.38rem;color:rgba(205,200,189,0.62);margin-top:3px">Implementation: ' + opp.implementations.join(' \u00b7 ') + '</div>';
        }

        // Companies exposed
        if (opp.exposedCompanies.length > 0) {
          oh += '<div style="font-size:0.32rem;color:rgba(200,195,184,0.3);margin-top:2px">Exposed: ' + opp.exposedCompanies.join(', ') + '</div>';
        }

        // ── REAL DOMAIN OBJECT PROJECTION (brain-authored fields, guarded) ──
        // Pure projection of window.LIMENDomains[k].brainOpportunities[i].
        // No synthesis, no fallback text. Each field renders only if present.
        var _bo = opp._brainObj;
        if (_bo) {
          if (_bo.whyNow && _bo.whyNow !== _bo.title) {
            oh += '<div style="font-size:0.4rem;color:rgba(210,205,194,0.7);margin-top:3px">Why now: ' + _bo.whyNow + '</div>';
          }
          if (_bo.explain) {
            oh += '<div style="font-size:0.42rem;color:rgba(216,211,201,0.85);margin-top:3px;line-height:1.45">' + _bo.explain + '</div>';
          }
          if (_bo.urgency) {
            oh += '<div style="font-size:0.28rem;letter-spacing:1px;color:rgba(201,169,78,0.55);margin-top:3px">URGENCY: ' + _bo.urgency + '</div>';
          }
          if (_bo.valueRange) {
            oh += '<div style="font-size:0.3rem;color:rgba(201,169,78,0.55);margin-top:3px">Value range: ' + _bo.valueRange + '</div>';
          }
          var _mc = _bo.moneyChain;
          if (_mc && typeof _mc === 'object') {
            if (_mc.doThis) {
              oh += '<div style="font-size:0.4rem;color:rgba(120,205,185,0.92);margin-top:4px;padding:3px 6px;border-left:2px solid rgba(90,181,160,0.4)">Do this: ' + _mc.doThis + '</div>';
            }
            if (_mc.whyPays) {
              oh += '<div style="font-size:0.38rem;color:rgba(208,203,192,0.72);margin-top:2px;padding:3px 6px;border-left:2px solid rgba(201,169,78,0.3)">Why it pays: ' + _mc.whyPays + '</div>';
            }
            if (_mc.target) {
              oh += '<div style="font-size:0.37rem;color:rgba(206,201,190,0.68);margin-top:2px">Target: ' + _mc.target + '</div>';
            }
            if (_mc.timing) {
              oh += '<div style="font-size:0.37rem;color:rgba(206,201,190,0.68);margin-top:2px">Timing: ' + _mc.timing + '</div>';
            }
            if (_mc.invalidIf) {
              oh += '<div style="font-size:0.3rem;color:rgba(232,84,84,0.45);margin-top:2px">Invalid if: ' + _mc.invalidIf + '</div>';
            }
            if (_mc.evidence) {
              oh += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.4);margin-top:2px">Evidence: ' + _mc.evidence + '</div>';
            }
            if (_mc.nextStep) {
              oh += '<div style="font-size:0.38rem;color:rgba(110,200,180,0.82);margin-top:2px">Next step: ' + _mc.nextStep + '</div>';
            }
          }
          if (Array.isArray(_bo.steps) && _bo.steps.length > 0) {
            oh += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.4);margin-top:3px">Steps: ' + _bo.steps.join(' \u00b7 ') + '</div>';
          }
          if (Array.isArray(_bo.fastPath) && _bo.fastPath.length > 0) {
            oh += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.4);margin-top:2px">Fast path: ' + _bo.fastPath.join(' \u00b7 ') + '</div>';
          }
          if (Array.isArray(_bo.examples) && _bo.examples.length > 0) {
            oh += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.35);margin-top:2px">Examples: ' + _bo.examples.join(', ') + '</div>';
          }
          if (_bo.compensation && typeof _bo.compensation === 'object' && _bo.compensation.base != null) {
            var _cmp = _bo.compensation;
            var _cmpLine = 'Compensation: ' + _cmp.base + (_cmp.unit || '');
            if (_cmp.tier) _cmpLine += ' (tier ' + _cmp.tier + ')';
            if (_cmp.type) _cmpLine += ' \u00b7 ' + _cmp.type;
            oh += '<div style="font-size:0.3rem;color:rgba(201,169,78,0.5);margin-top:3px">' + _cmpLine + '</div>';
          }
          if (_bo.compensation_business && typeof _bo.compensation_business === 'object' && _bo.compensation_business.base != null) {
            var _cmpB = _bo.compensation_business;
            var _cmpBLine = 'Business comp: ' + _cmpB.base + (_cmpB.unit || '');
            if (_cmpB.tier) _cmpBLine += ' (tier ' + _cmpB.tier + ')';
            oh += '<div style="font-size:0.3rem;color:rgba(74,143,212,0.5);margin-top:2px">' + _cmpBLine + '</div>';
          }
          if (_bo.validity && typeof _bo.validity === 'object' && typeof _bo.validity.expiryWindowDays === 'number') {
            oh += '<div style="font-size:0.28rem;color:rgba(200,195,184,0.3);margin-top:2px">Expires in ' + _bo.validity.expiryWindowDays + 'd</div>';
          }
          if (typeof _bo.rank === 'number') {
            oh += '<div style="font-size:0.26rem;color:rgba(200,195,184,0.25);margin-top:1px">Rank: ' + _bo.rank.toFixed(2) + '</div>';
          }
        }

        // Status tracking
        var oppId = _capOppId(opp);
        var statuses = _getCapOppStatuses();
        var curStatus = statuses[oppId] || 'NEW';
        var statusColors = { NEW: '#C9A94E', IN_PROGRESS: '#4a8fd4', APPLIED: '#5ab5a0' };
        // Gate B #9C.4.1 — rename status display "APPLIED" → "PURSUED".
        // Internal status key stays 'APPLIED' so existing localStorage
        // state (set by prior versions) keeps working without migration.
        // Only the operator-facing label changes — "PURSUED" is honest
        // about what the button records (the operator chose to follow
        // up on this opportunity locally), while "APPLIED" wrongly
        // implied an external filing/application had been submitted.
        var statusLabels = { NEW: 'NEW', IN_PROGRESS: 'IN PROGRESS', APPLIED: 'PURSUED' };
        oh += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.03)">';
        oh += '<span style="font-size:0.3rem;letter-spacing:1.5px;color:' + (statusColors[curStatus] || '#888') + ';padding:1px 6px;border:1px solid ' + (statusColors[curStatus] || '#888') + '33;border-radius:2px">' + (statusLabels[curStatus] || curStatus) + '</span>';
        if (curStatus !== 'IN_PROGRESS') oh += '<span style="font-size:0.28rem;color:rgba(200,195,184,0.3);cursor:pointer;letter-spacing:1px" onclick="window._setCapOppStatus(\'' + oppId + '\',\'IN_PROGRESS\')">Mark In Progress</span>';
        if (curStatus !== 'APPLIED') oh += '<span style="font-size:0.28rem;color:rgba(200,195,184,0.3);cursor:pointer;letter-spacing:1px" onclick="window._setCapOppStatus(\'' + oppId + '\',\'APPLIED\')">Mark Pursued</span>';
        if (curStatus !== 'NEW') oh += '<span style="font-size:0.28rem;color:rgba(200,195,184,0.2);cursor:pointer;letter-spacing:1px" onclick="window._setCapOppStatus(\'' + oppId + '\',\'NEW\')">Reset</span>';
        // Outcome recording
        oh += '<span style="font-size:0.28rem;color:rgba(90,181,160,0.4);cursor:pointer;letter-spacing:1px;margin-left:auto" onclick="window._recordOutcome(\'' + oppId + '\',\'SUCCESS\')">+Success</span>';
        oh += '<span style="font-size:0.28rem;color:rgba(232,84,84,0.4);cursor:pointer;letter-spacing:1px" onclick="window._recordOutcome(\'' + oppId + '\',\'FAIL\')">+Fail</span>';
        oh += '<span style="font-size:0.28rem;color:rgba(201,169,78,0.4);cursor:pointer;letter-spacing:1px" onclick="window._recordOutcome(\'' + oppId + '\',\'PARTIAL\')">+Partial</span>';
        oh += '</div>';

        // Pathway trace
        var trace = _traceRegulationPathway(opp);
        oh += '<div style="font-size:0.36rem;color:rgba(200,195,184,0.45);margin-top:3px;line-height:1.4">';
        oh += 'Pathway: ' + trace.summary;
        oh += '</div>';

        // Execute buttons (gated by _execReady + grounding)
        var canGrant = _canGenerateGrant(opp);
        oh += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">';
        if (opp._priority) oh += '<span style="font-size:0.26rem;color:rgba(200,195,184,0.2);letter-spacing:1px;margin-right:4px">PRI:' + opp._priority + '</span>';
        if (opp._execReady) {
          if (opp.path === 'RESEARCHABLE') {
            oh += '<span style="font-size:0.36rem;color:#b3a6ff;cursor:pointer;padding:3px 8px;border:1px solid rgba(155,140,255,0.4);border-radius:2px;letter-spacing:1px" onclick="window._execGenerate(\'' + oppId + '\',\'research\')">Draft Research Brief</span>';
          } else {
            oh += '<span style="font-size:0.36rem;color:#72c9b3;cursor:pointer;padding:3px 8px;border:1px solid rgba(90,181,160,0.4);border-radius:2px;letter-spacing:1px" onclick="window._execGenerate(\'' + oppId + '\',\'investment\')">Draft Investment Brief</span>';
          }
        } else {
          oh += '<span style="font-size:0.28rem;color:#555;padding:2px 6px;letter-spacing:1px">' + (!canGrant ? 'Insufficient grounding' : 'Below confidence threshold') + '</span>';
        }
        oh += '</div>';

        oppDiv.innerHTML = oh;
        domBody.appendChild(oppDiv);
      }

      _tabContentEl.appendChild(domSection);
    }
  }

  // ─── Artifact Council (ARTIFACT-UI-0) ─────────────────────────────────────
  //
  // Operator-visible run surface for the existing artifact council pipeline.
  // Calls /api/expand-artifact and /api/critique-artifact with a selected
  // ArtifactPacket. Renders draft, critique, and objection ledger.
  //
  // STRICT BOUNDS:
  //   - Patents lane only (critique-artifact does not yet support NSF lane)
  //   - No persistence (in-memory state only)
  //   - No Master Brain queue write (review-gate.enqueue is NOT called)
  //   - No Stop / AbortController in MVP
  //   - "Mark as reviewed" sets a local timestamp only
  //   - The council drafts and critiques; it does not decide, submit, file,
  //     approve, or validate.

  var _COUNCIL_LANES = [
    { id: 'patents',           label: 'Patents',                 enabled: true,
      note: '' },
    { id: 'nsf-project-pitch', label: 'NSF Project Pitch',       enabled: false,
      note: 'Backend NSF expansion + critique registered (D3-E.1 / D3-E.2). ' +
            'Disabled in UI until live builder packet → expansion → critique → ' +
            'adversarial pass are independently verified. Disabled status does ' +
            'not imply submission readiness, eligibility, or NSF endorsement.' }
  ];

  function _escCouncil(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _councilFmtElapsed(startedAt, completedAt) {
    if (typeof startedAt !== 'number') return '';
    var end = typeof completedAt === 'number' ? completedAt : Date.now();
    var ms = end - startedAt;
    if (ms < 0) ms = 0;
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function _councilSetStage(stageKey, status, error) {
    var st = _councilState.stages[stageKey];
    if (!st) return;
    if (status === 'running' && st.status !== 'running') {
      st.startedAt = Date.now();
      st.completedAt = null;
      st.error = null;
    } else if (status === 'done' || status === 'error') {
      st.completedAt = Date.now();
      if (status === 'error' && error) st.error = error;
    }
    st.status = status;
  }

  function _councilGetReadyPatentsPackets() {
    if (!window.LIMENArtifactPacketBuilder ||
        typeof window.LIMENArtifactPacketBuilder.buildAll !== 'function') {
      return null;
    }
    var all = [];
    try { all = window.LIMENArtifactPacketBuilder.buildAll() || []; }
    catch (e) { return null; }
    var ready = [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (!p || !p.identity) continue;
      if (p.identity.lane !== 'patents') continue;
      var rg = p.lane_hints && p.lane_hints.readyForGeneration;
      if (!rg || rg.patents !== true) continue;
      ready.push(p);
    }
    return ready;
  }

  // ARTIFACT-UI-0.2: stable semantic key for the Packet dropdown.
  //
  // identity.id is composite '<sourceOpportunityId>::<lane>' per D3-A3.v3,
  // but the upstream HandoffPacket.opportunityId is rebuilt on every
  // LIMENMainBrainHandoff.recompute() / LIMENArtifactPacketBuilder.buildAll()
  // call in the same page session. The composite id therefore drifts across
  // re-renders and the manager's selection can fail to round-trip even when
  // they're looking at the same logical packet.
  //
  // The fix: use a fully semantic key derived from stable identity fields
  // (lane + domain + node + title + sorted diagnoses). This key is identical
  // for any two packets that represent the same logical opportunity.
  function _councilStablePacketKey(p) {
    if (!p || !p.identity) return '';
    var id = p.identity;
    var dx = '';
    if (Array.isArray(id.diagnoses)) {
      // Sort defensively so order changes upstream don't mutate the key.
      var copy = id.diagnoses.slice();
      copy.sort();
      dx = copy.join('|');
    }
    return [
      id.lane   || '',
      id.domain || '',
      id.node   || '',
      id.title  || '',
      dx
    ].join('::');
  }

  // Detect collisions in the current ready-list. Pure logging — no UI
  // disambiguation in MVP. If collisions appear in the wild we can add a
  // disambiguator suffix in a follow-up patch.
  function _councilFindKeyCollisions(packets) {
    var seen = Object.create(null);
    var collisions = [];
    for (var i = 0; i < packets.length; i++) {
      var k = _councilStablePacketKey(packets[i]);
      if (seen[k]) {
        if (collisions.indexOf(k) === -1) collisions.push(k);
      } else {
        seen[k] = true;
      }
    }
    return collisions;
  }

  // Resolve a packet object from the current list using the stable key.
  // Returns null if no match. Always called on every render so state never
  // holds a stale packet reference from a previous buildAll() invocation.
  function _councilResolvePacketByKey(packets, key) {
    if (!key || !Array.isArray(packets)) return null;
    for (var i = 0; i < packets.length; i++) {
      if (_councilStablePacketKey(packets[i]) === key) return packets[i];
    }
    return null;
  }

  function _councilPacketLabel(p) {
    if (!p || !p.identity) return '(unnamed)';
    var id   = p.identity;
    var dom  = id.domain || '';
    var ttl  = id.title  || '';
    var pid  = id.id || id.sourceOpportunityId || '';
    var conf = (p.confidence && typeof p.confidence.confidencePercent === 'number')
      ? (' · ' + p.confidence.confidencePercent + '%') : '';
    var parts = [];
    if (dom) parts.push(dom);
    if (ttl) parts.push(ttl);
    var head = parts.length ? parts.join(' — ') : pid;
    return head + ' · [' + pid + ']' + conf;
  }

  // POST helper. Returns { ok, status, body, error }. Never throws.
  function _councilPost(endpoint, body) {
    return fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (resp) {
      var status = resp.status;
      return resp.json().then(function (data) {
        return { ok: resp.ok && data && data.ok === true, status: status, body: data, error: null };
      }, function () {
        return { ok: false, status: status, body: null, error: 'Response was not valid JSON.' };
      });
    }, function (err) {
      var msg = (err && err.message) ? String(err.message) : 'Network error';
      return { ok: false, status: 0, body: null, error: msg };
    });
  }

  function _councilStageErrorMessage(stageName, result) {
    var body = (result && result.body) || {};
    var code = body.error || ('HTTP ' + (result && result.status));
    var msg  = body.message || (result && result.error) || 'Unknown failure';
    // D3-F.1 — surface a clearer message when the upstream timed out.
    // Draft is preserved on _councilState; only the critique is missing.
    // Do NOT claim critique exists, ledger exists, or that the run is
    // ready for review.
    if (stageName === 'Grok critique' &&
        (body.error === 'AI_UPSTREAM_TIMEOUT' || /Upstream\s+timeout/i.test(String(msg)))) {
      var attempts = body.attempts || 1;
      var totalMs  = body.totalElapsedMs || 0;
      return 'Critique timeout — draft was generated, critique not completed. ' +
             '(attempts=' + attempts + ', totalElapsed=' + totalMs + 'ms). ' +
             'Use "Retry critique" to re-run only the critique stage; the draft is preserved.';
    }
    return stageName + ' failed: ' + code + ' — ' + msg;
  }

  // D3-F.1 — critique-only retry. Reuses the existing _councilState.packet
  // and _councilState.draft; does NOT re-call /api/expand-artifact (no
  // duplicate OpenAI cost). Only enabled when the run failed at the
  // critique stage AND the draft is preserved on state.
  function _councilCanRetryCritique() {
    return _councilState.stage === 'error' &&
           _councilState.packet &&
           _councilState.draft &&
           _councilState.stages &&
           _councilState.stages.critique &&
           _councilState.stages.critique.status === 'error';
  }

  function _councilRetryCritique() {
    if (!_councilCanRetryCritique()) return;

    // Reset only the critique + ledger sub-stages; preserve build + expand.
    _councilState.critique        = null;
    _councilState.objectionLedger = null;
    _councilState.raw             = _councilState.raw || { expandResponse: null, critiqueResponse: null };
    _councilState.raw.critiqueResponse = null;
    _councilSetStage('critique', 'idle');
    _councilSetStage('ledger',   'idle');
    _councilState.stage           = 'critiquing';
    _councilSetStage('critique', 'running');
    if (_activeTab === 'council') _renderTabCouncil();

    var critBody = {
      lane:           _councilState.lane || 'patents',
      mode:           'critique',
      artifactPacket: _councilState.packet,
      draft:          _councilState.draft,
      options:        { temperature: 0.1 }
    };
    _councilPost('/api/critique-artifact', critBody).then(function (critRes) {
      _councilState.raw.critiqueResponse = critRes && critRes.body;
      if (!critRes || !critRes.ok) {
        _councilSetStage('critique', 'error', _councilStageErrorMessage('Grok critique', critRes));
        _councilState.stage = 'error';
        if (_activeTab === 'council') _renderTabCouncil();
        return;
      }
      _councilState.critique = (critRes.body && critRes.body.critique) ? critRes.body.critique : null;
      _councilSetStage('critique', 'done');
      _councilSetStage('ledger', 'running');
      var ledger = _councilState.critique && _councilState.critique.objectionLedger;
      if (!Array.isArray(ledger)) {
        _councilSetStage('ledger', 'error',
          'Objection ledger missing or malformed in critique response. Raw critique still available.');
        _councilState.stage = 'error';
      } else {
        _councilState.objectionLedger = ledger;
        _councilSetStage('ledger', 'done');
        _councilState.stage = 'done';
      }
      if (_activeTab === 'council') _renderTabCouncil();
    });
  }

  // ─── ARTIFACT-UI-0.4 — Deep directive enrichment ─────────────────────────
  //
  // The HandoffPacket → ArtifactPacket pipeline reads the SHALLOW root
  // domain portal (assets/data/domains/{d}.json), which only carries
  // {label, type, description, evidence} per treatment — no steps, no
  // citations, no mechanism, no companies. The DEEP corpus content lives
  // at assets/data/deep/{d}-deep-directives.json (500 ranked directives
  // per domain, each with treatmentSteps[], treatmentCitation[],
  // treatmentMonitoring, treatmentEscalation, companies[], _rankScore).
  //
  // Before calling /api/expand-artifact we fetch the matching directives
  // bundle, find top-ranked entries whose nodeId matches the packet's
  // identity.node or any supportingNode, and inject their substantive
  // fields into the packet's evidence + implementation. This is what
  // turns the OpenAI prompt input from "Develop intervention for X at Y"
  // (template fluff) into real corpus content (real mechanism, real
  // steps, real citations).
  //
  // Per-page cache: each domain's directive bundle is ~1.4 MB; we fetch
  // it once per page session and reuse across subsequent council runs.

  var _councilDirectiveCache = {};
  var _COUNCIL_DIRECTIVE_FILE_MAP = {
    agriculture: 'p2_agri',     // brain.domainId='agriculture' → file p2_agri
    supplyChain: 'trade',        // brain.domainId='supplyChain' → file trade
    research:    'science'       // brain.domainId='research'    → file science
  };

  function _councilDirectiveFile(domain) {
    if (!domain || typeof domain !== 'string') return null;
    return _COUNCIL_DIRECTIVE_FILE_MAP[domain] || domain;
  }

  function _councilLoadDirectives(domain) {
    var file = _councilDirectiveFile(domain);
    if (!file) return Promise.resolve([]);
    if (_councilDirectiveCache[file]) return Promise.resolve(_councilDirectiveCache[file]);
    return fetch('/assets/data/deep/' + file + '-deep-directives.json', {
      credentials: 'same-origin'
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (j) {
      var arr = (j && Array.isArray(j.directives)) ? j.directives : [];
      _councilDirectiveCache[file] = arr;
      return arr;
    }).catch(function () { return []; });
  }

  function _councilCollectNodeIds(packet) {
    var set = {};
    if (packet && packet.identity && packet.identity.node) set[packet.identity.node] = true;
    var hp = packet && packet.raw && packet.raw.handoffPacket;
    if (hp && Array.isArray(hp.supportingNodes)) {
      for (var i = 0; i < hp.supportingNodes.length; i++) {
        var n = hp.supportingNodes[i] && hp.supportingNodes[i].name;
        if (n) set[n] = true;
      }
    }
    return Object.keys(set);
  }

  function _councilTopDirectives(directives, nodeIds, limit) {
    if (!Array.isArray(directives) || !nodeIds.length) return [];
    var nodeSet = {};
    for (var i = 0; i < nodeIds.length; i++) nodeSet[nodeIds[i]] = true;
    var matches = directives.filter(function (d) {
      return d && d.nodeId && nodeSet[d.nodeId];
    });
    matches.sort(function (a, b) { return (b._rankScore || 0) - (a._rankScore || 0); });
    return matches.slice(0, limit || 5);
  }

  function _councilJoinSteps(directives) {
    var out = [];
    for (var i = 0; i < directives.length; i++) {
      var steps = directives[i].treatmentSteps;
      if (!Array.isArray(steps)) continue;
      for (var j = 0; j < steps.length; j++) {
        if (typeof steps[j] === 'string' && steps[j].length > 0) out.push(steps[j]);
      }
    }
    return out;
  }

  function _councilFlattenCompanies(directives) {
    var seen = {};
    var out = [];
    for (var i = 0; i < directives.length; i++) {
      var co = directives[i].companies;
      if (!Array.isArray(co)) continue;
      for (var j = 0; j < co.length; j++) {
        var c = co[j];
        if (!c || !c.name) continue;
        var key = (c.ticker || c.name).toUpperCase();
        if (seen[key]) continue;
        seen[key] = true;
        out.push(c);
      }
    }
    return out.slice(0, 12);
  }

  function _councilFormatCitations(directives) {
    var out = [];
    for (var i = 0; i < directives.length; i++) {
      var ct = directives[i].treatmentCitation;
      if (!Array.isArray(ct)) continue;
      for (var j = 0; j < ct.length; j++) {
        var c = ct[j];
        if (!c) continue;
        var line = (c.author || 'Unknown') + ' (' + (c.year || 'n.d.') + '). ' +
                   (c.title || '[untitled]') +
                   (c.journal ? '. ' + c.journal : '') +
                   (c.doi ? '. DOI: ' + c.doi : '');
        out.push(line);
      }
    }
    return out;
  }

  // Build an enriched, mutable shallow-copy packet whose evidence and
  // implementation carry concrete content from the top deep directives.
  // The original packet is deep-frozen by the builder; this never
  // mutates it. When no directives match, returns the input packet
  // unchanged so the server-side INSUFFICIENT_PACKET_DETAIL gate fires
  // honestly rather than masking the corpus gap.
  function _councilEnrichWithDirectives(packet, directives) {
    if (!packet || !Array.isArray(directives) || directives.length === 0) return packet;

    var top         = directives[0];
    var allSteps    = _councilJoinSteps(directives);
    var allCo       = _councilFlattenCompanies(directives);
    var allCites    = _councilFormatCitations(directives);
    var stepsBlock  = allSteps.length ? allSteps.join('\n  • ') : '';
    var citesBlock  = allCites.length ? allCites.join('\n  ') : '';
    var coBlock     = allCo.length ? allCo.map(function (c) {
      return c.name + (c.ticker ? ' [' + c.ticker + ']' : '') +
             (typeof c.bindingStrength === 'number' ? ' (binding ' + c.bindingStrength + ')' : '');
    }).join('; ') : '';

    function _combine(existing, fresh) {
      if (!fresh) return existing || '';
      if (!existing) return fresh;
      return existing + '\n\n— CORPUS DIRECTIVE (top ' + directives.length + ') —\n' + fresh;
    }

    var origEv = packet.evidence || {};
    var origIm = packet.implementation || {};

    var newEvidence = {
      trigger:            _combine(origEv.trigger,
                            top.treatmentDescription || top.treatmentLabel || ''),
      validation:         _combine(origEv.validation,
                            (top.treatmentTarget ? 'Mechanism: ' + top.treatmentTarget : '') +
                            (top.treatmentEvidence ? '\nEvidence grade: ' + top.treatmentEvidence : '')),
      outcome:            _combine(origEv.outcome,
                            top.treatmentMonitoring || ''),
      failure:            _combine(origEv.failure,
                            top.treatmentEscalation || ''),
      moneyChainEvidence: origEv.moneyChainEvidence || '',
      whyPays:            origEv.whyPays || '',
      explain:            _combine(origEv.explain,
                            (citesBlock ? 'Citations:\n  ' + citesBlock : '') +
                            (coBlock ? '\n\nCompany bindings:\n  ' + coBlock : ''))
    };

    var newImplementation = {
      action:              _combine(origIm.action,
                            (top.treatmentLabel || '') +
                            (top.treatmentType ? ' [' + top.treatmentType + ']' : '')),
      doThis:              _combine(origIm.doThis,
                            stepsBlock ? '  • ' + stepsBlock : ''),
      nextStep:            _combine(origIm.nextStep,
                            top.treatmentEscalation || ''),
      target:              _combine(origIm.target,
                            top.treatmentTarget || ''),
      timing:              origIm.timing || '',
      invalidIf:           origIm.invalidIf || '',
      implementationsList: origIm.implementationsList
    };

    // Shallow copy + replace evidence/implementation. Other top-level keys
    // (identity, signal, anti_overclaim, provenance, lane_hints, raw,
    // confidence, packetSchemaVersion, builtAt, sourcePacketId) preserved.
    var enriched = {};
    for (var k in packet) enriched[k] = packet[k];
    enriched.evidence       = newEvidence;
    enriched.implementation = newImplementation;
    return enriched;
  }

  function _councilRun() {
    if (_councilState.stage === 'building' ||
        _councilState.stage === 'expanding' ||
        _councilState.stage === 'critiquing') return;

    var packet = _councilState.packet;
    if (!packet) return;

    // Reset run-state for a fresh run.
    _councilState.draft           = null;
    _councilState.critique        = null;
    _councilState.objectionLedger = null;
    _councilState.raw             = { expandResponse: null, critiqueResponse: null };
    _councilState.reviewedAt      = null;
    _councilState.bridgedAt       = null;
    _councilState.bridgeIntakeId  = null;
    var keys = ['build', 'expand', 'critique', 'ledger'];
    for (var k = 0; k < keys.length; k++) {
      _councilState.stages[keys[k]] = { status: 'idle', error: null, startedAt: null, completedAt: null };
    }
    _councilState.activePane = 'draft';

    // Stage: build (synchronous packet check + directive enrichment)
    _councilState.stage = 'building';
    _councilSetStage('build', 'running');
    if (_activeTab === 'council') _renderTabCouncil();
    if (!packet || !packet.identity || packet.identity.lane !== 'patents') {
      _councilSetStage('build', 'error', 'Selected packet is not in patents lane.');
      _councilState.stage = 'error';
      if (_activeTab === 'council') _renderTabCouncil();
      return;
    }

    // Lazy-fetch deep directives, enrich packet, then post.
    _councilLoadDirectives(packet.identity.domain).then(function (directives) {
      var nodeIds   = _councilCollectNodeIds(packet);
      var topDir    = _councilTopDirectives(directives, nodeIds, 5);
      var enriched  = _councilEnrichWithDirectives(packet, topDir);

      // Replace state packet with enriched version so the critique stage
      // and the MB-B bridge both see the same corpus-enriched content.
      _councilState.packet = enriched;
      _councilState.directiveCount = topDir.length;
      _councilSetStage('build', 'done');
      if (_activeTab === 'council') _renderTabCouncil();

      // Stage: expand
      _councilState.stage = 'expanding';
      _councilSetStage('expand', 'running');
      if (_activeTab === 'council') _renderTabCouncil();

      var expandBody = {
        lane: 'patents',
        mode: 'draft',
        artifactPacket: enriched,
        options: { temperature: 0.2 }
      };
      return _councilPost('/api/expand-artifact', expandBody);
    }).then(function (expRes) {
      if (!expRes) return null;
      _councilState.raw.expandResponse = expRes && expRes.body;
      if (!expRes.ok) {
        _councilSetStage('expand', 'error', _councilStageErrorMessage('OpenAI expansion', expRes));
        _councilState.stage = 'error';
        if (_activeTab === 'council') _renderTabCouncil();
        return null;
      }
      _councilState.draft = (expRes.body && expRes.body.expansion) ? expRes.body.expansion : null;
      _councilSetStage('expand', 'done');

      // Stage: critique
      _councilState.stage = 'critiquing';
      _councilSetStage('critique', 'running');
      if (_activeTab === 'council') _renderTabCouncil();

      var critBody = {
        lane: 'patents',
        mode: 'critique',
        artifactPacket: _councilState.packet,   // enriched packet from above
        draft: _councilState.draft,
        options: { temperature: 0.1 }
      };
      return _councilPost('/api/critique-artifact', critBody);
    }).then(function (critRes) {
      if (!critRes) return; // earlier stage failed
      _councilState.raw.critiqueResponse = critRes && critRes.body;
      if (!critRes.ok) {
        _councilSetStage('critique', 'error', _councilStageErrorMessage('Grok critique', critRes));
        _councilState.stage = 'error';
        if (_activeTab === 'council') _renderTabCouncil();
        return;
      }
      _councilState.critique = (critRes.body && critRes.body.critique) ? critRes.body.critique : null;
      _councilSetStage('critique', 'done');

      // Stage: ledger (extraction is synchronous; just verify presence)
      _councilSetStage('ledger', 'running');
      var ledger = _councilState.critique && _councilState.critique.objectionLedger;
      if (!Array.isArray(ledger)) {
        _councilSetStage('ledger', 'error',
          'Objection ledger missing or malformed in critique response. Raw critique still available.');
        _councilState.stage = 'error';
      } else {
        _councilState.objectionLedger = ledger;
        _councilSetStage('ledger', 'done');
        _councilState.stage = 'done';
      }
      if (_activeTab === 'council') _renderTabCouncil();
    });
  }

  function _councilMarkReviewed() {
    if (_councilState.stage !== 'done') return;
    _councilState.reviewedAt = Date.now();
    if (_activeTab === 'council') _renderTabCouncil();
  }

  // ─── MB-B — Manual Artifact Council → Main Brain intake bridge ──────
  //
  // Same-origin handoff via sessionStorage only. Writes a single intake
  // object into the well-known MB-A queue key. NOT a submission. NOT a
  // handoff to any executor. NOT validation. NOT approval. NO network
  // call. NO server persistence. NO auto-trigger — operator-click only.
  //
  // Contract source of truth: assets/js/master-brain/artifact-intake.js
  //   STORAGE_KEY    = 'limen.mb.artifactIntakeQueue.v1'
  //   SCHEMA_VERSION = 'MB-A.v1'
  //   REQUIRED_SOURCE = 'ArtifactCouncil'
  //   ALLOWED_AC_STATUS includes 'reviewed_local'
  //   ALLOWED_HR_STATUS includes 'reviewed_local'
  //
  // Invariant: every written item carries executionAllowed === false.
  var MBB_STORAGE_KEY    = 'limen.mb.artifactIntakeQueue.v1';
  var MBB_SCHEMA_VERSION = 'MB-A.v1';

  function _councilBuildIntakeId() {
    var rand = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      try {
        var buf = new Uint8Array(4);
        crypto.getRandomValues(buf);
        for (var i = 0; i < buf.length; i++) {
          var hex = buf[i].toString(16);
          rand += hex.length === 1 ? ('0' + hex) : hex;
        }
      } catch (_) { rand = ''; }
    }
    if (!rand) rand = Math.random().toString(16).slice(2, 10);
    return 'mb-a-' + Date.now() + '-' + rand;
  }

  function _councilSendToMainBrainIntake() {
    // Hard preconditions — operator MUST have completed the run AND
    // marked it locally reviewed. These are the only states from which
    // we treat _councilState as a recoverable reviewed bundle.
    if (_councilState.stage !== 'done') return { ok: false, error: 'not_done' };
    if (!_councilState.reviewedAt)      return { ok: false, error: 'not_reviewed_locally' };
    if (_councilState.bridgedAt)        return { ok: false, error: 'already_bridged' };
    var pkt = _councilState.packet;
    if (!pkt || !pkt.identity)          return { ok: false, error: 'no_packet' };

    // Build intake summary. We embed the artifactPacket and a SUMMARY of
    // draft + critique + objection-ledger; intake is meant for inspection,
    // not re-execution. Keep payload bounded to fit a session blob.
    var idy = pkt.identity || {};
    var critique = (_councilState.critique && _councilState.critique.critique) || null;
    var ledger   = Array.isArray(_councilState.objectionLedger) ? _councilState.objectionLedger : [];
    var summary  = (_councilState.critique && _councilState.critique.objectionSummary) || null;

    var item = {
      id:                    _councilBuildIntakeId(),
      schemaVersion:         MBB_SCHEMA_VERSION,
      enqueuedAt:            Date.now(),
      lane:                  _councilState.lane || (idy.lane || 'patents'),
      artifactCouncilStatus: 'reviewed_local',
      humanReviewStatus:     'reviewed_local',
      source:                'ArtifactCouncil',
      createdAt:             new Date(_councilState.reviewedAt).toISOString(),
      notes:                 'Operator clicked "Mark locally reviewed" then "Send to Main Brain intake". Local review marker only — not validation, not external review, not approval.',
      artifactPacketSummary: {
        identityId:          idy.id || null,
        sourceOpportunityId: idy.sourceOpportunityId || null,
        domain:              idy.domain || null,
        node:                idy.node || null,
        title:               idy.title || null,
        diagnoses:           Array.isArray(idy.diagnoses) ? idy.diagnoses.slice(0, 8) : []
      },
      artifactPacket:        pkt,
      councilArtifacts: {
        draftStatus:           (_councilState.draft && _councilState.draft.status) || null,
        critiqueStatus:        (_councilState.critique && _councilState.critique.status) || null,
        critiquePresent:       !!critique,
        objectionLedgerLength: ledger.length,
        objectionSummary:      summary,
        reviewedAt:            new Date(_councilState.reviewedAt).toISOString()
      },
      executionAllowed:      false   // INVARIANT: never set true.
    };

    // Read-modify-write under MB-A's storage key. If MB-A module is also
    // loaded on this page (it is not on Civilization today), the in-
    // memory mirror is bypassed; MB-A's refresh() picks up the new
    // entry on next call. Fail closed on serialization errors.
    try {
      if (typeof sessionStorage === 'undefined') {
        return { ok: false, error: 'no_session_storage' };
      }
      var existing = [];
      try {
        var raw = sessionStorage.getItem(MBB_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) existing = parsed;
        }
      } catch (_) { existing = []; }
      existing.push(item);
      sessionStorage.setItem(MBB_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      return { ok: false, error: 'storage_write_failed', message: (e && e.message) ? String(e.message) : '' };
    }

    _councilState.bridgedAt      = Date.now();
    _councilState.bridgeIntakeId = item.id;
    if (_activeTab === 'council') _renderTabCouncil();
    return { ok: true, item: item };
  }

  // ── Pane renderers ──

  function _renderCouncilDraftPane(container) {
    var draft = _councilState.draft;
    if (!draft) {
      var empty = document.createElement('div');
      empty.className = 'clr-council-pane-empty';
      empty.textContent = 'No draft yet. Run the council to produce a draft.';
      container.appendChild(empty);
      return;
    }

    var draftNotice = document.createElement('div');
    draftNotice.className = 'clr-council-notice';
    draftNotice.innerHTML = '<b>Draft status:</b> structured invention disclosure. ' +
      'Use as source material for human/attorney drafting. ' +
      'Do not treat as filed, approved, novel, patentable, or complete.';
    container.appendChild(draftNotice);

    var d = draft.draft || {};
    var sections = [
      ['Invention title',        d.inventionTitle],
      ['Field',                  d.field],
      ['Background',             d.background],
      ['Problem statement',      d.problemStatement],
      ['Technical solution',     d.technicalSolution],
      ['System components',      d.systemComponents],
      ['Method steps',           d.methodSteps],
      ['Data inputs',            d.dataInputs],
      ['Outputs',                d.outputs],
      ['Potential embodiments',  d.potentialEmbodiments],
      ['Missing information',    d.missingInformation],
      ['Human-review checklist', d.humanReviewChecklist]
    ];
    for (var i = 0; i < sections.length; i++) {
      var label = sections[i][0];
      var val   = sections[i][1];
      if (val == null) continue;
      var section = document.createElement('div');
      section.className = 'clr-council-section';
      var t = document.createElement('div');
      t.className = 'clr-council-section-title';
      t.textContent = label;
      section.appendChild(t);
      var body = document.createElement('div');
      body.className = 'clr-council-section-body';
      if (Array.isArray(val)) {
        if (val.length === 0) continue;
        var ul = document.createElement('ul');
        ul.className = 'clr-council-list';
        for (var j = 0; j < val.length; j++) {
          var li = document.createElement('li');
          li.textContent = (typeof val[j] === 'object') ? JSON.stringify(val[j]) : String(val[j]);
          ul.appendChild(li);
        }
        body.appendChild(ul);
      } else if (typeof val === 'string') {
        if (val.length === 0) continue;
        body.textContent = val;
      } else {
        body.textContent = JSON.stringify(val);
      }
      section.appendChild(body);
      container.appendChild(section);
    }

    // Provisional claim sketches — special-cased because each entry has
    // structure (type, text, confidence, missingSupport).
    if (Array.isArray(d.provisionalClaimSketches) && d.provisionalClaimSketches.length > 0) {
      var claimSec = document.createElement('div');
      claimSec.className = 'clr-council-section';
      var ct = document.createElement('div');
      ct.className = 'clr-council-section-title';
      ct.textContent = 'Provisional claim sketches';
      claimSec.appendChild(ct);
      var cul = document.createElement('ul');
      cul.className = 'clr-council-list';
      for (var ci = 0; ci < d.provisionalClaimSketches.length; ci++) {
        var c = d.provisionalClaimSketches[ci];
        if (!c) continue;
        var cli = document.createElement('li');
        var head = (c.type ? '[' + c.type + '] ' : '');
        var tail = (c.confidence ? ' (confidence: ' + c.confidence + ')' : '');
        cli.textContent = head + (c.text || '') + tail;
        cul.appendChild(cli);
      }
      claimSec.appendChild(cul);
      container.appendChild(claimSec);
    }

    // Schema line.
    var schema = document.createElement('div');
    schema.className = 'clr-council-schema';
    var raw = _councilState.raw.expandResponse || {};
    var apiV = raw.schemaVersion || '?';
    var expV = (raw.expansion && raw.expansion.schemaVersion) || draft.schemaVersion || '?';
    schema.textContent = 'Endpoint schema: ' + apiV + ' · Expansion schema: ' + expV;
    container.appendChild(schema);

    // Raw JSON.
    var rawDetails = document.createElement('details');
    rawDetails.className = 'clr-council-raw';
    var summary = document.createElement('summary');
    summary.textContent = 'Raw JSON (expand response)';
    rawDetails.appendChild(summary);
    var pre = document.createElement('pre');
    pre.textContent = JSON.stringify(raw, null, 2);
    rawDetails.appendChild(pre);
    container.appendChild(rawDetails);
  }

  function _renderCouncilCritiquePane(container) {
    var crit = _councilState.critique;
    if (!crit) {
      var empty = document.createElement('div');
      empty.className = 'clr-council-pane-empty';
      // D3-F.1 — when the critique stage failed (typically timeout) the
      // draft is still on _councilState. Surface a clear message and a
      // critique-only retry button. The retry calls /api/critique-artifact
      // again with the same packet+draft; it does NOT re-run expansion.
      var stErr = _councilState.stages && _councilState.stages.critique;
      if (stErr && stErr.status === 'error' && _councilState.draft) {
        empty.textContent = stErr.error ||
          'Critique failed. Draft was generated; critique not completed. Not approved, not validated.';
        container.appendChild(empty);
        if (_councilCanRetryCritique()) {
          var retryWrap = document.createElement('div');
          retryWrap.className = 'clr-council-foot';
          var retryBtn = document.createElement('button');
          retryBtn.className = 'clr-council-mark';
          retryBtn.textContent = 'Retry critique';
          retryBtn.addEventListener('click', _councilRetryCritique);
          retryWrap.appendChild(retryBtn);
          var retryNote = document.createElement('div');
          retryNote.className = 'clr-council-note';
          retryNote.textContent = 'Re-runs only the critique stage against the existing draft. ' +
            'Does not re-call OpenAI expansion. Critique is not approval; objection ledger is not validation.';
          retryWrap.appendChild(retryNote);
          container.appendChild(retryWrap);
        }
        return;
      }
      empty.textContent = 'No critique yet.';
      container.appendChild(empty);
      return;
    }

    var critNotice = document.createElement('div');
    critNotice.className = 'clr-council-notice';
    critNotice.innerHTML = '<b>Grok critique identifies objections and weaknesses.</b> ' +
      'It does not approve, validate, endorse, or clear the draft.';
    container.appendChild(critNotice);

    function _section(label, val) {
      if (val == null) return;
      var section = document.createElement('div');
      section.className = 'clr-council-section';
      var t = document.createElement('div');
      t.className = 'clr-council-section-title';
      t.textContent = label;
      section.appendChild(t);
      var body = document.createElement('div');
      body.className = 'clr-council-section-body';
      if (Array.isArray(val)) {
        if (val.length === 0) return;
        var ul = document.createElement('ul');
        ul.className = 'clr-council-list';
        for (var j = 0; j < val.length; j++) {
          var li = document.createElement('li');
          var v = val[j];
          if (v == null) continue;
          if (typeof v === 'string') li.textContent = v;
          else if (typeof v === 'object') {
            // weakestLinks/overclaimRisks/reviewerObjections may be string or object.
            li.textContent = (v.issue || v.text || JSON.stringify(v));
          } else li.textContent = String(v);
          ul.appendChild(li);
        }
        body.appendChild(ul);
      } else if (typeof val === 'string') {
        if (val.length === 0) return;
        body.textContent = val;
      } else {
        body.textContent = JSON.stringify(val);
      }
      section.appendChild(body);
      container.appendChild(section);
    }

    _section('Summary',           crit.summary);
    _section('Go / no-go',        crit.goNoGo);
    _section('Weakest links',     crit.weakestLinks);
    _section('Overclaim risks',   crit.overclaimRisks);
    _section('Reviewer objections', crit.reviewerObjections);
    _section('Source freshness concerns', crit.sourceFreshnessConcerns);
    _section('Internal language leaks', crit.internalLanguageLeaks);
    _section('Missing evidence',  crit.missingEvidence);

    // Schema line.
    var schema = document.createElement('div');
    schema.className = 'clr-council-schema';
    var raw = _councilState.raw.critiqueResponse || {};
    var apiV = raw.schemaVersion || '?';
    var critV = (raw.critique && raw.critique.schemaVersion) || crit.schemaVersion || '?';
    schema.textContent = 'Endpoint schema: ' + apiV + ' · Critique schema: ' + critV;
    container.appendChild(schema);

    // Raw JSON.
    var rawDetails = document.createElement('details');
    rawDetails.className = 'clr-council-raw';
    var summary = document.createElement('summary');
    summary.textContent = 'Raw JSON (critique response)';
    rawDetails.appendChild(summary);
    var pre = document.createElement('pre');
    pre.textContent = JSON.stringify(raw, null, 2);
    rawDetails.appendChild(pre);
    container.appendChild(rawDetails);
  }

  function _renderCouncilLedgerPane(container) {
    var title = document.createElement('div');
    title.className = 'clr-council-ledger-title';
    title.textContent = 'Detected objections — must be addressed';
    container.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'clr-council-ledger-sub';
    sub.textContent = 'The ledger lists problems flagged by the critique pipeline. ' +
      'Ledger entries are review obligations. They are not clearance. ' +
      'It does not approve, endorse, or validate the draft. Human review is required before any filing.';
    container.appendChild(sub);

    var ledger = _councilState.objectionLedger;
    if (!Array.isArray(ledger)) {
      var empty = document.createElement('div');
      empty.className = 'clr-council-pane-empty';
      empty.textContent = 'No ledger yet.';
      container.appendChild(empty);
      return;
    }
    if (ledger.length === 0) {
      var clean = document.createElement('div');
      clean.className = 'clr-council-ledger-empty';
      clean.textContent = 'No objections detected by the deterministic ledger. Raw critique is still authoritative.';
      container.appendChild(clean);
    }

    for (var i = 0; i < ledger.length; i++) {
      var obj = ledger[i];
      if (!obj) continue;
      var sev = (typeof obj.severity === 'string') ? obj.severity : 'info';
      var card = document.createElement('div');
      card.className = 'clr-council-obj severity-' + sev.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

      var head = document.createElement('div');
      head.className = 'clr-council-obj-head';
      var idEl  = document.createElement('span'); idEl.className = 'clr-council-obj-id';
      idEl.textContent = obj.id || ('OBJ-' + (i + 1));
      var sevEl = document.createElement('span'); sevEl.className = 'clr-council-obj-sev';
      sevEl.textContent = sev;
      var typeEl= document.createElement('span'); typeEl.className = 'clr-council-obj-type';
      typeEl.textContent = obj.type || '';
      head.appendChild(idEl);
      head.appendChild(sevEl);
      if (obj.type) head.appendChild(typeEl);
      card.appendChild(head);

      if (obj.issue) {
        var issue = document.createElement('div');
        issue.className = 'clr-council-obj-issue';
        issue.textContent = obj.issue;
        card.appendChild(issue);
      }
      if (obj.requiredResponse) {
        var resp = document.createElement('div');
        resp.className = 'clr-council-obj-resp';
        resp.textContent = 'Required response: ' + obj.requiredResponse;
        card.appendChild(resp);
      }
      container.appendChild(card);
    }

    // Summary line if available.
    var raw = _councilState.raw.critiqueResponse || {};
    var summary = (raw.critique && raw.critique.objectionSummary) || null;
    if (summary && typeof summary === 'object') {
      var sumEl = document.createElement('div');
      sumEl.className = 'clr-council-schema';
      var parts = [];
      if (typeof summary.total       === 'number') parts.push('total: '       + summary.total);
      if (typeof summary.blocking    === 'number') parts.push('blocking: '    + summary.blocking);
      if (typeof summary.mustAddress === 'number') parts.push('mustAddress: ' + summary.mustAddress);
      if (parts.length) sumEl.textContent = 'Ledger summary — ' + parts.join(' · ');
      else sumEl.textContent = 'Ledger summary present (raw JSON below).';
      container.appendChild(sumEl);
    }

    // Raw ledger JSON.
    var rawDetails = document.createElement('details');
    rawDetails.className = 'clr-council-raw';
    var s2 = document.createElement('summary');
    s2.textContent = 'Raw JSON (objection ledger)';
    rawDetails.appendChild(s2);
    var pre = document.createElement('pre');
    pre.textContent = JSON.stringify({ ledger: ledger || null, summary: summary || null }, null, 2);
    rawDetails.appendChild(pre);
    container.appendChild(rawDetails);
  }

  // ── Main tab render ──

  function _renderTabCouncil() {
    if (!_tabContentEl) return;
    _tabContentEl.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'clr-council';

    // Header
    var head = document.createElement('div');
    head.className = 'clr-council-head';
    var title = document.createElement('div');
    title.className = 'clr-council-title';
    title.textContent = 'Artifact Council';
    head.appendChild(title);
    var sub = document.createElement('div');
    sub.className = 'clr-council-sub';
    sub.textContent = 'Draft packet → critique → detected objections. Human review required. Outputs are not filing-ready and are not submitted.';
    head.appendChild(sub);
    var status = document.createElement('div');
    var statusClass = 'idle';
    if (_councilState.stage === 'building' ||
        _councilState.stage === 'expanding' ||
        _councilState.stage === 'critiquing') statusClass = 'running';
    else if (_councilState.stage === 'done')  statusClass = 'done';
    else if (_councilState.stage === 'error') statusClass = 'error';
    status.className = 'clr-council-status ' + statusClass;
    // Read-only progress indicator. NOT a button. Prefix makes role obvious;
    // pointer cursor disabled via CSS. No click handler exists or is added.
    status.textContent = 'STATUS: ' + _councilState.stage;
    status.title = 'Read-only progress indicator. This is not a button — no click action, no submit, no send, no close.';
    head.appendChild(status);
    card.appendChild(head);

    // Output-type notice — pinned near the top so the manager understands
    // what kind of artifact this surface produces before they run it.
    var outputNotice = document.createElement('div');
    outputNotice.className = 'clr-council-notice warn';
    if (_councilState.lane === 'patents') {
      outputNotice.innerHTML = '<b>Output type:</b> Patent invention disclosure draft. ' +
        'This is attorney/operator drafting input, not a filing-ready patent application. ' +
        'Novelty, patentability, freedom-to-operate, and filing readiness are NOT determined here.';
    } else if (_councilState.lane === 'nsf-project-pitch') {
      outputNotice.innerHTML = '<b>NSF Project Pitch is not wired into the full council until D3-E.2.</b> ' +
        'Expansion exists; Grok critique is not yet supported for this lane.';
    } else {
      outputNotice.innerHTML = '<b>Output type:</b> drafting input only. Not filing-ready. Not submitted.';
    }
    card.appendChild(outputNotice);

    // Builder check
    if (!window.LIMENArtifactPacketBuilder ||
        typeof window.LIMENArtifactPacketBuilder.buildAll !== 'function') {
      var warn = document.createElement('div');
      warn.className = 'clr-council-warn';
      warn.textContent = 'Artifact builder not loaded. The Artifact Council requires window.LIMENArtifactPacketBuilder.buildAll(); reload the page if this persists.';
      card.appendChild(warn);
      _tabContentEl.appendChild(card);
      return;
    }

    // Lane selector
    var laneRow = document.createElement('div');
    laneRow.className = 'clr-council-row';
    var laneLabel = document.createElement('div');
    laneLabel.className = 'clr-council-label';
    laneLabel.textContent = 'Lane';
    laneRow.appendChild(laneLabel);
    var laneSel = document.createElement('select');
    laneSel.className = 'clr-council-select';
    for (var li = 0; li < _COUNCIL_LANES.length; li++) {
      var ln = _COUNCIL_LANES[li];
      var opt = document.createElement('option');
      opt.value = ln.id;
      opt.textContent = ln.label + (ln.enabled ? '' : ' (not wired)');
      if (!ln.enabled) opt.disabled = true;
      if (ln.id === _councilState.lane) opt.selected = true;
      laneSel.appendChild(opt);
    }
    laneSel.addEventListener('change', function () {
      _councilState.lane = laneSel.value;
      _councilState.packetId = null;
      _councilState.packet = null;
      if (_activeTab === 'council') _renderTabCouncil();
    });
    laneRow.appendChild(laneSel);
    var laneNote = document.createElement('div');
    laneNote.className = 'clr-council-note';
    var activeLane = null;
    for (var lk = 0; lk < _COUNCIL_LANES.length; lk++) {
      if (_COUNCIL_LANES[lk].id === _councilState.lane) { activeLane = _COUNCIL_LANES[lk]; break; }
    }
    if (activeLane && activeLane.note) laneNote.textContent = activeLane.note;
    laneRow.appendChild(laneNote);
    card.appendChild(laneRow);

    // Packet selector — patents lane only for MVP; if lane disabled, show no packets
    var packets = (_councilState.lane === 'patents') ? _councilGetReadyPatentsPackets() : [];
    if (packets === null) {
      var bld = document.createElement('div');
      bld.className = 'clr-council-warn';
      bld.textContent = 'Artifact builder threw or returned an unexpected value. Reload the page.';
      card.appendChild(bld);
      _tabContentEl.appendChild(card);
      return;
    }

    // ARTIFACT-UI-0.3: Re-resolve the packet object from the current ready
    // list using the stable semantic key — but ONLY while the council is
    // idle. The original ARTIFACT-UI-0.2 behavior re-resolved on every
    // render, which caused the bridge to fail with "no_packet" after a
    // successful run: the brain cycle re-emits packets every 30s, packet
    // identity can drift, and a re-resolve mid-bridge nulled
    // _councilState.packet even though stage was 'done' and the operator
    // had already marked the run reviewed.
    //
    // Freeze rule: once a run starts (building / expanding / critiquing)
    // or completes (done / error), the packet that was used must persist
    // for the lifetime of that run state. The dropdown still shows the
    // current ready list and the operator can switch selection (which
    // resets state via _councilRun), but background re-renders cannot
    // mutate the active packet under their feet.
    if (_councilState.packetId && _councilState.stage === 'idle') {
      _councilState.packet = _councilResolvePacketByKey(packets, _councilState.packetId);
      if (!_councilState.packet) {
        // Logical packet no longer in the ready list — clear the selection.
        _councilState.packetId = null;
      }
    }

    // Diagnostic: log key collisions so we know if the semantic key isn't
    // unique enough in the wild. No UI surface in MVP.
    if (packets.length > 1) {
      var _dupKeys = _councilFindKeyCollisions(packets);
      if (_dupKeys.length > 0) {
        try {
          console.warn('[ArtifactCouncil] stable-key collisions: ' + _dupKeys.length + ' — first: ' + _dupKeys[0]);
        } catch (_) {}
      }
    }

    var packetRow = document.createElement('div');
    packetRow.className = 'clr-council-row';
    var packetLabel = document.createElement('div');
    packetLabel.className = 'clr-council-label';
    packetLabel.textContent = 'Packet';
    packetRow.appendChild(packetLabel);
    var packetSel = document.createElement('select');
    packetSel.className = 'clr-council-select';
    if (packets.length === 0) {
      var noOpt = document.createElement('option');
      noOpt.textContent = 'No ready patents packets';
      noOpt.disabled = true;
      noOpt.selected = true;
      packetSel.appendChild(noOpt);
      packetSel.disabled = true;
    } else {
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— select a packet —';
      packetSel.appendChild(blank);
      for (var pi = 0; pi < packets.length; pi++) {
        var pp = packets[pi];
        var pkey = _councilStablePacketKey(pp);
        if (!pkey) continue;       // skip malformed packets
        var pOpt = document.createElement('option');
        pOpt.value = pkey;
        pOpt.textContent = _councilPacketLabel(pp);
        if (_councilState.packetId === pkey) pOpt.selected = true;
        packetSel.appendChild(pOpt);
      }
    }
    packetSel.addEventListener('change', function () {
      var v = packetSel.value;
      _councilState.packetId = v || null;
      _councilState.packet   = v ? _councilResolvePacketByKey(packets, v) : null;
      if (_activeTab === 'council') _renderTabCouncil();
    });
    packetRow.appendChild(packetSel);

    // Run button
    var runBtn = document.createElement('button');
    runBtn.className = 'clr-council-run';
    runBtn.textContent = 'Run Council';
    var canRun = !!(_councilState.packet) &&
                 _councilState.lane === 'patents' &&
                 _councilState.stage !== 'building' &&
                 _councilState.stage !== 'expanding' &&
                 _councilState.stage !== 'critiquing';
    runBtn.disabled = !canRun;
    runBtn.addEventListener('click', _councilRun);
    packetRow.appendChild(runBtn);
    card.appendChild(packetRow);

    // Progress steps
    var prog = document.createElement('div');
    prog.className = 'clr-council-progress';
    var stages = [
      { key: 'build',    label: 'Build packet' },
      { key: 'expand',   label: 'OpenAI expansion' },
      { key: 'critique', label: 'Grok critique' },
      { key: 'ledger',   label: 'Objection ledger' }
    ];
    for (var sii = 0; sii < stages.length; sii++) {
      var st = _councilState.stages[stages[sii].key] || { status: 'idle' };
      var row = document.createElement('div');
      row.className = 'clr-council-stage ' + st.status;
      var icon = document.createElement('div');
      icon.className = 'clr-council-stage-icon';
      icon.textContent =
        st.status === 'done'    ? '✓' :
        st.status === 'error'   ? '×' :
        st.status === 'running' ? '◦' : '·';
      row.appendChild(icon);
      var nm = document.createElement('div');
      nm.className = 'clr-council-stage-name';
      nm.textContent = stages[sii].label;
      row.appendChild(nm);
      if (st.startedAt) {
        var t = document.createElement('div');
        t.className = 'clr-council-stage-time';
        t.textContent = _councilFmtElapsed(st.startedAt, st.completedAt);
        row.appendChild(t);
      }
      prog.appendChild(row);
      if (st.status === 'error' && st.error) {
        var errRow = document.createElement('div');
        errRow.className = 'clr-council-stage-error';
        errRow.textContent = st.error;
        prog.appendChild(errRow);
      }
    }
    card.appendChild(prog);

    // Pane bar
    var paneBar = document.createElement('div');
    paneBar.className = 'clr-council-pane-bar';
    var paneIds = ['draft', 'critique', 'ledger'];
    var paneLabels = { draft: 'Draft', critique: 'Critique', ledger: 'Ledger' };
    for (var pbi = 0; pbi < paneIds.length; pbi++) {
      var pid2 = paneIds[pbi];
      var btn = document.createElement('div');
      btn.className = 'clr-council-pane-tab' + (_councilState.activePane === pid2 ? ' active' : '');
      btn.textContent = paneLabels[pid2];
      (function (pidLocal) {
        btn.addEventListener('click', function () {
          _councilState.activePane = pidLocal;
          if (_activeTab === 'council') _renderTabCouncil();
        });
      })(pid2);
      paneBar.appendChild(btn);
    }
    card.appendChild(paneBar);

    // Pane body
    var pane = document.createElement('div');
    pane.className = 'clr-council-pane';
    if (_councilState.activePane === 'draft')         _renderCouncilDraftPane(pane);
    else if (_councilState.activePane === 'critique') _renderCouncilCritiquePane(pane);
    else if (_councilState.activePane === 'ledger')   _renderCouncilLedgerPane(pane);
    card.appendChild(pane);

    // Footer — terminal local action + honest disclaimer
    var foot = document.createElement('div');
    foot.className = 'clr-council-foot';
    var markBtn = document.createElement('button');
    markBtn.className = 'clr-council-mark';
    markBtn.textContent = 'Mark locally reviewed';
    markBtn.disabled = !(_councilState.stage === 'done' && !_councilState.reviewedAt);
    markBtn.addEventListener('click', _councilMarkReviewed);
    foot.appendChild(markBtn);
    if (_councilState.reviewedAt) {
      var stamp = document.createElement('div');
      stamp.className = 'clr-council-mark-stamp';
      stamp.textContent = 'Marked reviewed locally — ' + new Date(_councilState.reviewedAt).toISOString();
      foot.appendChild(stamp);
    }

    // MB-B — manual bridge to Main Brain intake. Disabled until run is
    // done AND locally reviewed. Single-shot per run; resets on next run.
    var bridgeBtn = document.createElement('button');
    bridgeBtn.className = 'clr-council-mark';
    bridgeBtn.textContent = _councilState.bridgedAt
      ? 'Stored in Main Brain intake'
      : 'Send to Main Brain intake';
    bridgeBtn.disabled = !(_councilState.stage === 'done' &&
                            _councilState.reviewedAt &&
                            !_councilState.bridgedAt);
    bridgeBtn.addEventListener('click', function () {
      var res = _councilSendToMainBrainIntake();
      if (!res.ok) {
        // Surface error inline as a transient stamp; do not throw.
        var errStamp = document.createElement('div');
        errStamp.className = 'clr-council-mark-stamp';
        errStamp.textContent = 'Bridge failed: ' + (res.error || 'unknown') +
          (res.message ? ' — ' + res.message : '');
        foot.appendChild(errStamp);
      }
      // Successful bridge re-renders via _renderTabCouncil() inside the fn.
    });
    foot.appendChild(bridgeBtn);
    if (_councilState.bridgedAt) {
      var bStamp = document.createElement('div');
      bStamp.className = 'clr-council-mark-stamp';
      bStamp.textContent = 'Stored in Main Brain intake — ' +
        new Date(_councilState.bridgedAt).toISOString() +
        ' — id ' + (_councilState.bridgeIntakeId || '?') +
        '. Not submitted. Not executed.';
      foot.appendChild(bStamp);
    }

    var note = document.createElement('div');
    note.className = 'clr-council-note';
    note.textContent = 'Local review marker only. The "Send to Main Brain intake" button writes a JSON intake item into same-origin sessionStorage for the Main Brain inbox to read; it is NOT submission, NOT execution, NOT validation, NOT approval, NOT external action, and NOT a Master Brain executor handoff. The council drafts and critiques; it does not decide.';
    foot.appendChild(note);

    // Audit-confirmed clarification of nearby UI controls.
    var nav = document.createElement('div');
    nav.className = 'clr-council-note';
    nav.textContent = 'The top-right STATUS pill is a read-only progress indicator (not a button — no click action). The CONNECTOME control in the page header navigates to /connectome.html and does not affect this artifact.';
    foot.appendChild(nav);
    card.appendChild(foot);

    _tabContentEl.appendChild(card);
  }

  // ─── Evidence Chain ───────────────────────────────────────────────────────

  function _renderTabEvidence() {
    var reports = window.LIMENReports || {};

    // Find sourceChain from any report type
    var sourceChain = null;
    var rTypes = ['portalUser', 'domain', 'mainUser', 'civilization'];
    for (var i = 0; i < rTypes.length; i++) {
      if (reports[rTypes[i]] && reports[rTypes[i]].sourceChain) {
        sourceChain = reports[rTypes[i]].sourceChain;
        break;
      }
    }

    if (!sourceChain) {
      _renderEmpty('evidence');
      return;
    }

    var card = _subCard('DATA SOURCE AUDIT');

    // Feed quality — show live vs fallback
    var feeds = sourceChain.feeds || [];
    var liveDoms = window.LIMENDomains || {};
    var liveCount = 0, fallbackCount = 0;
    for (var fdk in liveDoms) {
      if (liveDoms[fdk].sources) {
        for (var fsi = 0; fsi < liveDoms[fdk].sources.length; fsi++) {
          if (liveDoms[fdk].sources[fsi].live) liveCount++;
          else fallbackCount++;
        }
      }
    }
    var feedSummary = feeds.length > 0 ? feeds.length + ' feeds' : 'none';
    if (liveCount > 0 || fallbackCount > 0) {
      feedSummary += ' (' + liveCount + ' LIVE, ' + fallbackCount + ' FALLBACK)';
    }
    _addRow(card, 'Feed Sources', feedSummary);

    // Seeds — explain what this means
    var seedKeys = sourceChain.seedNodes ? Object.keys(sourceChain.seedNodes) : [];
    _addRow(card, 'Active Domains', seedKeys.length + ' domains with elevated stress (>30%)');

    // Propagation — explain
    var propDetail = (sourceChain.propagationSteps || 0) + ' cross-domain influence steps';
    if (sourceChain.convergenceStep != null) propDetail += ', converged at step ' + sourceChain.convergenceStep;
    _addRow(card, 'Propagation', propDetail);

    _addRow(card, 'Remedy Lookups', (sourceChain.remedyLookups || 0) + ' treatment matches queried');

    // Report count — only show non-empty
    var reportKeys = Object.keys(reports);
    var nonEmpty = reportKeys.filter(function(k) { return reports[k] && reports[k].summary; });
    _addRow(card, 'Reports Generated', nonEmpty.length + ' of ' + reportKeys.length + ' (' + nonEmpty.join(', ') + ')');

    _tabContentEl.appendChild(card);

    // Per-source citation chain — enumerate every source already in memory,
    // grouped by domain. Offline rows are kept visible; failReason appears
    // only when present. No synthesis, no caps, no filtering.
    function _chainAgeLabel(ts) {
      if (!ts) return '';
      var age = Date.now() - ts;
      if (age < 60000) return Math.max(0, Math.round(age / 1000)) + 's';
      if (age < 3600000) return Math.round(age / 60000) + 'm';
      if (age < 86400000) return Math.round(age / 3600000) + 'h';
      return Math.round(age / 86400000) + 'd';
    }
    var chainDoms = window.LIMENDomains || {};
    var chainCard = _subCard('SOURCES (CITATION CHAIN)');
    var chainRendered = 0;
    for (var cdi = 0; cdi < DOMAIN_ORDER.length; cdi++) {
      var _cdk = DOMAIN_ORDER[cdi];
      var _cd = chainDoms[_cdk];
      var _cdSrcs = (_cd && Array.isArray(_cd.sources)) ? _cd.sources : [];
      if (_cdSrcs.length === 0) continue;
      var _cdHeader = document.createElement('div');
      _cdHeader.style.cssText = 'margin:4px 0 2px;font-size:0.32rem;letter-spacing:1px;color:rgba(201,169,78,0.75)';
      _cdHeader.textContent = (DOMAIN_LABELS[_cdk] || _cdk).toUpperCase();
      chainCard.appendChild(_cdHeader);
      for (var _csi = 0; _csi < _cdSrcs.length; _csi++) {
        var _cs = _cdSrcs[_csi] || {};
        var _csLive = _cs.live === true;
        var _csStatus = _csLive ? 'LIVE' : 'OFFLINE';
        var _csColor = _csLive ? 'rgba(90,181,160,0.9)' : 'rgba(232,84,84,0.85)';
        var _csDetail = '';
        if (_csLive) {
          if (_cs.label) _csDetail = String(_cs.label);
          else if (_cs.value != null) _csDetail = String(_cs.value);
        }
        var _csAge = _chainAgeLabel(_cs.updated || _cs.fetchedAt);
        var _csReason = (!_csLive && _cs.failReason) ? String(_cs.failReason) : '';
        var _csRow = document.createElement('div');
        _csRow.style.cssText = 'padding:1px 6px;font-size:0.34rem;color:rgba(210,205,195,0.78);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap';
        var _csHtml = '<span style="color:' + _csColor + ';letter-spacing:0.8px;min-width:52px">' + _csStatus + '</span>';
        _csHtml += '<span style="color:rgba(230,225,215,0.9)">' + (_cs.name || '(unnamed)') + '</span>';
        if (_csDetail) _csHtml += '<span style="color:rgba(200,195,184,0.55)">· ' + _csDetail + '</span>';
        if (_csAge) _csHtml += '<span style="color:rgba(200,195,184,0.4)">· ' + _csAge + '</span>';
        if (_csReason) _csHtml += '<span style="color:rgba(232,84,84,0.7)">· ' + _csReason + '</span>';
        _csRow.innerHTML = _csHtml;
        chainCard.appendChild(_csRow);
        chainRendered++;
      }
    }
    if (chainRendered > 0) _tabContentEl.appendChild(chainCard);

    // Seed domain roots — enumerate every entry in sourceChain.seedNodes so
    // roots are readable instead of count-only. Domain-keyed seeds render
    // first in canonical DOMAIN_ORDER; any non-domain (opaque nodeId) seeds
    // follow in sorted order. Numeric value is surfaced as a raw magnitude
    // only when finite; no interpretation is added.
    var seedMap = sourceChain.seedNodes || {};
    var seedAllKeys = Object.keys(seedMap);
    if (seedAllKeys.length > 0) {
      var seedCard = _subCard('SEED DOMAIN ROOTS');
      var seedSeen = {};
      var seedOrdered = [];
      for (var sdi = 0; sdi < DOMAIN_ORDER.length; sdi++) {
        var sdk = DOMAIN_ORDER[sdi];
        if (Object.prototype.hasOwnProperty.call(seedMap, sdk)) {
          seedOrdered.push(sdk);
          seedSeen[sdk] = true;
        }
      }
      var seedRemaining = [];
      for (var ski = 0; ski < seedAllKeys.length; ski++) {
        if (!seedSeen[seedAllKeys[ski]]) seedRemaining.push(seedAllKeys[ski]);
      }
      seedRemaining.sort();
      for (var sri = 0; sri < seedRemaining.length; sri++) seedOrdered.push(seedRemaining[sri]);
      for (var soi = 0; soi < seedOrdered.length; soi++) {
        var sk = seedOrdered[soi];
        var sv = seedMap[sk];
        var sLabel = DOMAIN_LABELS[sk] || String(sk);
        var sValue = (typeof sv === 'number' && isFinite(sv)) ? sv.toFixed(2) : '\u2014';
        _addRow(seedCard, sLabel, sValue);
      }
      _tabContentEl.appendChild(seedCard);
    }

    // Patterns
    if (sourceChain.patternsDetected) {
      var patCard = _subCard('DETECTED PATTERNS');
      var pd = sourceChain.patternsDetected;
      if (pd.hotClusters) _addRow(patCard, 'Hot Clusters', pd.hotClusters + ' domains with stress >60%');
      if (pd.coldGaps) _addRow(patCard, 'Cold Gaps', pd.coldGaps + ' domains with near-zero activity');
      if (pd.predictionViolations) _addRow(patCard, 'Prediction Violations', pd.predictionViolations + ' unexpected state changes');
      if (pd.oscillations) _addRow(patCard, 'Oscillations', pd.oscillations + ' unstable domains');
      _tabContentEl.appendChild(patCard);
    }

    // Self-audit panel (outcome tracking + recovery events)
    var auditHtml = _buildSelfAuditHtml();
    if (auditHtml) {
      var auditDiv = document.createElement('div');
      auditDiv.innerHTML = auditHtml;
      _tabContentEl.appendChild(auditDiv);
    }
  }

  // ─── Regulation ──────────────────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  // Gate B #9C.2 — Regulation TOP 3 ACTIONS NOW per-action authority.
  //
  // Doctrine (operator 2026-06-01):
  //   A confidence number beside a claim is not an authority gate
  //   until it changes the claim's visual authority.
  //
  // The existing per-action meta line displays "conf: N%" inline (line
  // ~5414 of the post-edit file). That is display-adjacent; the action
  // row renders at full visual weight regardless. This classifier +
  // inline badge converts the confidence number into a structural
  // authority signal at the top of each action row.
  //
  // UNKNOWN handling: the existing `confidence: topTx.confidence ||
  // reg.confidence || 0` falls back to 0 when neither source has a
  // value — but 0 looks identical to a real measured-zero. To preserve
  // the UNKNOWN signal, the action push now also carries a
  // _confidenceKnown flag that is true iff topTx.confidence or
  // reg.confidence is a finite number. The classifier reads that flag
  // to distinguish "0 by default" from "0 by measurement".
  //
  // Scope: TOP 3 ACTIONS NOW summary only. The delegated
  // LIMENRegulationRenderer.renderRegulationTab call at the end of
  // _renderTabRegulation is already #9B-gated and is untouched here.
  // ═══════════════════════════════════════════════════════════════════════════

  function _classifyActionAuthority(act) {
    if (!act || !act._confidenceKnown) {
      return { level: 'UNKNOWN', badge: 'CONFIDENCE UNKNOWN' };
    }
    var conf = typeof act.confidence === 'number' && isFinite(act.confidence) ? act.confidence : 0;
    if (conf < 0.4) {
      return { level: 'LOW_CONFIDENCE', badge: 'LOW CONFIDENCE · ' + Math.round(conf * 100) + '%' };
    }
    if (conf < 0.65) {
      return { level: 'MODERATE_CONFIDENCE', badge: 'MODERATE CONFIDENCE · ' + Math.round(conf * 100) + '%' };
    }
    return { level: 'FULL', badge: null };
  }

  function _renderTabRegulation() {
    var renderer = window.LIMENRegulationRenderer;
    if (!renderer) {
      _renderEmpty('regulation');
      return;
    }

    // TOP 3 ACTIONS summary from regulation output
    var regOut = window.LIMENRegulationOutput;
    if (regOut) {
      var actions = [];
      for (var rk in regOut) {
        var reg = regOut[rk];
        if (!reg || !reg.treatments || reg.treatments.length === 0) continue;
        var topTx = reg.treatments[0];
        // Gate B #9C.2 — preserve raw-source-known flag so the classifier
        // can distinguish "0 from measurement" vs "0 from || fallback".
        var __hasTopTxConf = typeof topTx.confidence === 'number' && isFinite(topTx.confidence);
        var __hasRegConf = typeof reg.confidence === 'number' && isFinite(reg.confidence);
        actions.push({
          domain: rk,
          action: topTx.title || topTx.label || 'intervention',
          // Gate B #9C.2.1 — preference fix. The earlier expression
          //   topTx.confidence || reg.confidence || 0
          // collapsed topTx.confidence === 0 (a real measured zero on
          // the displayed top treatment) into a fall-through to reg's
          // higher value via JS's truthy-|| semantics. The displayed
          // action verb is topTx.title, so the confidence shown to the
          // operator must reflect topTx's measurement when present
          // (including 0), not reg's domain-rollup value.
          // Falls through to reg.confidence only when topTx truly has
          // no finite confidence value.
          confidence: __hasTopTxConf ? topTx.confidence : (__hasRegConf ? reg.confidence : 0),
          urgency: reg.urgency || 'low',
          stress: reg.stress || 0,
          _confidenceKnown: __hasTopTxConf || __hasRegConf
        });
      }
      // Sort by urgency weight then stress
      var urgWeight = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, minimal: 0 };
      actions.sort(function(a, b) {
        var ua = urgWeight[a.urgency] || 0, ub = urgWeight[b.urgency] || 0;
        if (ub !== ua) return ub - ua;
        return b.stress - a.stress;
      });

      if (actions.length > 0) {
        var top3Card = _subCard('TOP 3 ACTIONS NOW');
        for (var ai = 0; ai < Math.min(actions.length, 3); ai++) {
          var act = actions[ai];
          var urgColor = act.urgency === 'critical' ? '#e85454' : act.urgency === 'high' ? '#C9A94E' : '#888';
          var actDiv = document.createElement('div');
          actDiv.style.cssText = 'padding:4px 8px;margin-bottom:4px;border-left:3px solid ' + urgColor + ';background:rgba(0,0,0,0.12)';
          actDiv.innerHTML = '<div style="font-size:0.42rem;color:#e8e3d9">' + (ai + 1) + '. ' + act.action + '</div>' +
            '<div style="font-size:0.34rem;color:rgba(200,195,184,0.4)">' + act.domain.toUpperCase() + ' \u00b7 urgency: ' + act.urgency + ' \u00b7 stress: ' + Math.round(act.stress * 100) + '% \u00b7 conf: ' + Math.round(act.confidence * 100) + '%</div>';

          // Gate B #9C.2 \u2014 per-action confidence authority badge inserted
          // at the top of the action row, BEFORE the title line. The
          // existing inline "conf: N%" display in the meta row below
          // stays unchanged. Two layers stack: badge above (structural
          // authority), inline number below (numeric display).
          var __actAuth = _classifyActionAuthority(act);
          if (__actAuth.badge) {
            var __badgeCls = __actAuth.level === 'LOW_CONFIDENCE' ? 'low'
                           : __actAuth.level === 'MODERATE_CONFIDENCE' ? 'moderate'
                           : 'unknown';
            var __badgeEl = document.createElement('div');
            __badgeEl.className = 'clr-action-conf-badge ' + __badgeCls;
            __badgeEl.textContent = __actAuth.badge;
            actDiv.insertBefore(__badgeEl, actDiv.firstChild);
          }

          top3Card.appendChild(actDiv);
        }
        _tabContentEl.appendChild(top3Card);
      }
    }

    renderer.renderRegulationTab(_tabContentEl);
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  function _renderEmpty(tabId) {
    if (!_tabContentEl) return;
    var wrap = document.createElement('div');
    wrap.className = 'clr-empty';

    var msg = document.createElement('div');
    msg.className = 'clr-empty-msg';
    msg.textContent = tabId === 'patent' ? 'No conversion candidates surfaced.' : 'No data available.';
    wrap.appendChild(msg);

    var phil = document.createElement('div');
    phil.className = 'clr-empty-philemon';
    phil.textContent = EMPTY_STATUS[tabId] || 'Generate a report to populate this view.';
    wrap.appendChild(phil);

    _tabContentEl.appendChild(wrap);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analyst Mode Toggle
  // ═══════════════════════════════════════════════════════════════════════════

  function _addHeaderControls() {
    // Mount into the global top bar's actions slot (assets/js/limen-topbar.js).
    var slot = (window.LIMENTopbar && typeof window.LIMENTopbar.getActionsSlot === 'function')
      ? window.LIMENTopbar.getActionsSlot()
      : document.getElementById('ltb-actions');

    if (!slot) {
      // Top bar may not be mounted yet — retry shortly.
      setTimeout(_addHeaderControls, 150);
      return;
    }

    if (slot.querySelector('#clarity-analyst-toggle')) return;

    // Analyst mode button
    var btn = document.createElement('button');
    btn.className = 'clr-analyst-btn';
    btn.id = 'clarity-analyst-toggle';
    btn.textContent = 'ANALYST';
    btn.title = 'Toggle full panel grid and debug tools';
    btn.addEventListener('click', function () {
      _toggleMode();
    });
    slot.appendChild(btn);

    // Generate Reports button — REMOVED per operator request (2026-06-13).
    // (Was a topbar actions-slot button; _triggerReportGeneration still exists if
    // ever re-wired elsewhere.)

    // Hide the fixed-position bootstrap report button (kept hidden too)
    setTimeout(function () {
      var oldBtn = document.getElementById('limen-report-btn');
      if (oldBtn) oldBtn.style.display = 'none';
    }, 200);
  }

  function _toggleMode() {
    _isAnalystMode = !_isAnalystMode;
    if (_isAnalystMode) {
      _enterAnalystMode();
    } else {
      _enterClarityMode();
    }
  }

  function _enterClarityMode() {
    _isAnalystMode = false;

    // Show clarity view
    if (_container) _container.style.display = '';

    // Hide columns
    _setColsVisible(false);

    // Hide debug tools
    _setDebugVisible(false);

    // Hide fixed overlays (redundant with executive strip + domain health)
    _setOverlaysVisible(false);

    // Update button
    var btn = document.getElementById('clarity-analyst-toggle');
    if (btn) {
      btn.className = 'clr-analyst-btn';
      btn.textContent = 'ANALYST';
    }

    // Refresh clarity panels with latest data
    _refreshAll();
  }

  function _enterAnalystMode() {
    _isAnalystMode = true;

    // Hide clarity view
    if (_container) _container.style.display = 'none';

    // Show columns
    _setColsVisible(true);

    // Show debug tools
    _setDebugVisible(true);

    // Restore fixed overlays
    _setOverlaysVisible(true);

    // Update button
    var btn = document.getElementById('clarity-analyst-toggle');
    if (btn) {
      btn.className = 'clr-analyst-btn active';
      btn.textContent = 'CLARITY';
    }
  }

  function _setColsVisible(visible) {
    var ids = ['col-left', 'col-center', 'col-right'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = visible ? '' : 'none';
    }
  }

  function _setOverlaysVisible(visible) {
    // Stress strip (market-stress-triage.js) — redundant with exec strip in Clarity
    var strip = document.getElementById('limen-stress-strip');
    if (strip) strip.style.display = visible ? '' : 'none';

    // Mode bar (ui-mode-manager.js) — Analyst-mode tooling
    var modeBar = document.getElementById('limen-mode-bar');
    if (modeBar) modeBar.style.display = visible ? '' : 'none';
  }

  function _setDebugVisible(visible) {
    // Report button
    var reportBtn = document.getElementById('limen-report-btn');
    if (reportBtn) reportBtn.style.display = visible ? '' : 'none';

    // Stability HUD
    var hud = document.getElementById('limen-stability-hud');
    if (hud) hud.style.display = visible ? '' : 'none';

    // Voice controls
    var voiceCtrl = document.getElementById('limen-voice-control');
    if (voiceCtrl) voiceCtrl.style.display = visible ? '' : 'none';
  }

  function _triggerReportGeneration() {
    // Trigger report generation through the bootstrap pipeline
    window.dispatchEvent(new CustomEvent('limen:request-reports'));

    // Also try direct call if available
    if (window.LIMENBootstrap && window.LIMENBootstrap._generateReports) {
      window.LIMENBootstrap._generateReports();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _subCard(title) {
    var card = document.createElement('div');
    card.className = 'clr-sub-card';
    var t = document.createElement('div');
    t.className = 'clr-sub-title';
    t.textContent = title;
    card.appendChild(t);
    return card;
  }

  function _addRow(parent, label, value, severityClass) {
    var row = document.createElement('div');
    row.className = 'clr-row';
    var l = document.createElement('span');
    l.className = 'clr-row-label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'clr-row-value' + (severityClass ? ' ' + severityClass : '');
    v.textContent = value != null ? value : '';
    row.appendChild(l);
    row.appendChild(v);
    parent.appendChild(row);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Refresh Cycle
  // ═══════════════════════════════════════════════════════════════════════════

  function _refreshAll() {
    if (_isAnalystMode) return;
    _refreshHero();
    _refreshDomains();
    _refreshEvents();
    _refreshActions();
    if (_activeTab) _renderActiveTab();
  }

  function _onDomainUpdate() {
    if (_isAnalystMode) return;
    _refreshHero();
    _refreshDomains();
    _refreshActions();
  }

  function _onGlobalStateUpdate() {
    if (_isAnalystMode) return;
    _refreshHero();
  }

  function _onEscalationUpdate() {
    if (_isAnalystMode) return;
    _refreshEvents();
  }

  function _onReportUpdate(e) {
    // Cache recSet for tab use
    if (e.detail && e.detail.recSet) {
      if (window.LIMENReports) window.LIMENReports._recSet = e.detail.recSet;
    }
    if (_isAnalystMode) return;
    _refreshActions();
    if (_activeTab) _renderActiveTab();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  function start() {
    if (_started) return;
    _started = true;

    _injectStyles();

    _container = document.getElementById('clarity-view');
    if (!_container) {
      // Create and insert clarity-view into the grid
      _container = document.createElement('div');
      _container.id = 'clarity-view';
      var grid = document.getElementById('console-grid');
      var colLeft = document.getElementById('col-left');
      if (grid && colLeft) {
        grid.insertBefore(_container, colLeft);
      } else if (grid) {
        grid.appendChild(_container);
      }
    }

    // Render the clarity view
    _render();

    // Hide columns (clarity mode is default)
    _setColsVisible(false);

    // Add header controls
    _addHeaderControls();

    // Hide debug tools and fixed overlays initially (Clarity mode default)
    // Use a delay to let bootstrap render them first
    setTimeout(function () {
      _setDebugVisible(false);
      _setOverlaysVisible(false);
    }, 100);

    // Listen for data updates
    window.addEventListener('limen:domain-update', _onDomainUpdate);
    window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.addEventListener('limen:escalation-update', _onEscalationUpdate);
    window.addEventListener('limen:report-update', _onReportUpdate);
    window.addEventListener('limen:regulation-ready', function () {
      if (_activeTab === 'regulation') _renderActiveTab();
    });

    // Listen for report generation request
    window.addEventListener('limen:request-reports', function () {
      // Bootstrap handles actual generation via its pipeline
    });

    // Periodic refresh for data that arrives without events
    _refreshTimer = setInterval(function () {
      if (document.hidden || _isAnalystMode) return;
      _refreshHero();
      _refreshDomains();
    }, 10000);

    console.log('[LIMEN] clarity: started (default view)');
  }

  function stop() {
    if (!_started) return;
    _started = false;
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:escalation-update', _onEscalationUpdate);
    window.removeEventListener('limen:report-update', _onReportUpdate);
    if (_refreshTimer) clearInterval(_refreshTimer);
    _enterAnalystMode(); // Restore full view on stop
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENClarity = {
    start: start,
    stop: stop,
    refresh: _refreshAll,
    setTab: function (tabId) {
      _activeTab = tabId;
      _refreshTabBar();
      _renderActiveTab();
    },
    isAnalystMode: function () { return _isAnalystMode; },
    toggleMode: _toggleMode
  };

})();
