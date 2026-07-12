// ═══════════════════════════════════════════════════════════════════
// LIMEN Helix — Business Neural Map (RENDERER ONLY)
// ═══════════════════════════════════════════════════════════════════
//
// This file used to ship the full validated phase kernel (sigmoid,
// PELT breakpoint detection, robust-Z, computeAllFeatures,
// scoreAllPhases, analyseTrajectory, computeRuptureScore,
// computeCompositeScore, runLimenPipeline) plus browser-side SEC
// EDGAR + FRED extractors and every threshold constant. That exposed
// the validated formula in browser-readable JS to anyone with
// devtools.
//
// The kernel now runs server-side only. The browser receives a
// labels-and-bands packet via:
//
//     POST /api/helix/helix-report/score   (same-origin)
//
// This file now ships ONLY:
//   • display-only label maps (PHASE_META, PHASE_NODE_STATES)
//   • intervention templates (PHASE_INTERVENTIONS) — note: callers
//     MUST gate the rendering of these on a server-supplied
//     validation_status === "validated" flag. Rendering p9 referrals
//     ("M&A advisor", "Bankruptcy / restructuring attorney") for a
//     report that the server has not validated is a template overclaim.
//   • a thin shim runRemoteAnalysis(cik, opts) that POSTs the
//     protected endpoint
//   • throwing stubs for the legacy kernel/extractor functions, so
//     legacy call sites fail loud rather than silently re-running
//     local kernel code.
//
// DO NOT add formula, thresholds, weights, feature-engineering, or
// kernel math to this file. If you find yourself wanting to "just
// inline the kernel here for offline use," stop — the entire point
// of the bridge security patch is that browsers do not see the kernel.

var BUSINESS_DATA_VERSION = 'renderer-only-1.0';

// ═══════════════════════════════════════════════════════════════════
// Phase metadata — display labels only
// ═══════════════════════════════════════════════════════════════════

var PHASE_META = {
  p0:  { name: 'Source',        label: 'P0 · SOURCE',        summary: 'Stable baseline — low variance, moderate positive growth, predictable operations.' },
  p1:  { name: 'Rupture',       label: 'P1 · RUPTURE',       summary: 'First disruption — revenue variance spike, sudden margin compression, first negative surprise.' },
  p2:  { name: 'Rhythm',        label: 'P2 · RHYTHM',        summary: 'Alliance building — revenue diversification increasing, growth accelerating under coordination.' },
  p3:  { name: 'Darkness',      label: 'P3 · INSTABILITY',   summary: 'Core instability — high variance, rising autocorrelation, declining slope, accelerating burn.' },
  p4:  { name: 'Peace',         label: 'P4 · STABILISATION', summary: 'Stabilisation — variance decreasing after crisis, cash burn decelerating, slope flattening.' },
  p5:  { name: 'Endurance',     label: 'P5 · ENDURANCE',     summary: 'Stress inoculation — revenue recovering under elevated variance, debt being serviced.' },
  p6:  { name: 'Order',         label: 'P6 · ORDER',         summary: 'Control restored — low variance, stable metrics, debt declining, cash building.' },
  p7:  { name: 'Dissolution',   label: 'P7 · DIVERGENCE',    summary: 'Structural divergence — revenue/OCF breakpoints detected.' },
  p7a: { name: 'Terminal',      label: 'P7a · TERMINAL',     summary: 'Post-break deterioration path.' },
  p7b: { name: 'Separation',    label: 'P7b · SEPARATION',   summary: 'Controlled post-break path.' },
  p8:  { name: 'Conscience',    label: 'P8 · PIVOT',         summary: 'Business-model pivot — structural break with positive slope, new revenue pattern emerging.' },
  p9:  { name: 'Threshold',     label: 'P9 · COLLAPSE',      summary: 'Collapse threshold.' },
  p10: { name: 'Resurrection',  label: 'P10 · RESURRECTION', summary: 'New baseline — structural break happened but variance now low, new steady state.' },
};

// ═══════════════════════════════════════════════════════════════════
// Phase intervention templates — display strings, NOT decision logic
//
// IMPORTANT: callers MUST gate rendering of these strings on the
// server-supplied `validation_status === "validated"` field. Rendering
// p9.referral ("M&A advisor", "Bankruptcy / restructuring attorney")
// or p3.referral on a partial / unsupported / bank-locked report is
// the exact template-overclaim pattern this patch was written to fix.
// ═══════════════════════════════════════════════════════════════════

var PHASE_INTERVENTIONS = {
  p0: {
    operational: [
      { name: 'Maintain quarterly monitoring cadence', detail: 'Continue standard KPI review cycle; document baseline for drift detection.' },
      { name: 'Quarterly board strategic review', detail: 'Regular governance check; no crisis-mode actions needed.' },
    ],
    strategic: [
      { name: 'Invest in growth capacity', detail: 'Stable baseline is the optimal time to build capacity, hire, and expand.' },
    ],
    referral: [],
  },
  p1: {
    operational: [
      { name: 'Stabilize operations — identify disruption source', detail: 'Isolate the revenue variance spike to specific segment, client, or product line.' },
      { name: 'Assess exposure concentration', detail: 'Map revenue dependency: top-3 clients, top-3 products, geographic concentration.' },
      { name: 'Do not overreact — single quarter may be noise', detail: 'Phase 1 is a signal, not a verdict. Investigate before restructuring.' },
    ],
    strategic: [],
    referral: [],
  },
  p2: {
    operational: [
      { name: 'Communication audit', detail: 'Verify alignment between revenue signals and operational narrative. Are metrics matching the story?' },
      { name: 'Team alignment check', detail: 'Growth phases mask misalignment — verify departments are synchronized.' },
      { name: 'Culture health survey', detail: 'Fast growth erodes culture silently. Measure before it compounds.' },
    ],
    strategic: [],
    referral: [],
  },
  p3: {
    operational: [
      { name: '90-day cash conservation protocol', detail: 'Freeze discretionary spend. Weekly cash position reporting. 13-week rolling forecast.' },
      { name: 'Key client retention audit', detail: 'Identify top-10 revenue clients and assess churn risk individually.' },
      { name: 'Flight risk assessment — key personnel', detail: 'Instability is visible to employees. Identify and retain critical talent.' },
    ],
    strategic: [
      { name: 'Scenario planning: 3 trajectories', detail: 'Model recovery (P4-6), sustained stress (P3 plateau), and collapse (P9). Board-ready.' },
    ],
    referral: [
      { name: 'Restructuring attorney', detail: 'Engage advisory relationship before crisis. Pre-positioning is 10x cheaper than emergency.' },
      { name: 'Turnaround CFO / interim financial officer', detail: 'Specialized distress-phase financial management. Different skill from growth-CFO.' },
    ],
  },
  p4: {
    operational: [
      { name: 'Protect cash gains — do not re-expand prematurely', detail: 'The most dangerous moment is stabilization: temptation to spend before recovery is confirmed.' },
      { name: 'Reduce variable costs incrementally', detail: 'Continue cost discipline. Variable cost reduction, not headcount slashing.' },
      { name: 'Monitor weekly — variance may spike again', detail: 'P4 can revert to P3. Weekly KPIs, not quarterly, until 2 consecutive stable quarters.' },
    ],
    strategic: [],
    referral: [],
  },
  p5: {
    operational: [
      { name: 'Prevent leadership burnout', detail: 'Extended stress phases deplete executive function. Ensure rest cycles for key decision-makers.' },
      { name: 'Hormetic pacing — controlled stress exposure', detail: 'Growth under stress is possible but requires pacing. Set realistic stretch targets.' },
      { name: 'Delegate operational decisions', detail: 'Leadership must shift from reactive firefighting to strategic positioning.' },
    ],
    strategic: [],
    referral: [],
  },
  p6: {
    operational: [
      { name: 'Systems documentation and process optimization', detail: 'Stability is the window for systematization. Document what works before the next disruption.' },
      { name: 'Hiring plan — build bench depth', detail: 'Replace crisis-mode skeleton crew with sustainable staffing.' },
      { name: 'Process optimization — automate recurring tasks', detail: 'Reduce human error surface. Stable operations can absorb process changes.' },
    ],
    strategic: [],
    referral: [
      { name: 'ERP / systems consultant', detail: 'Stable phase is optimal for systems implementation. Don\'t implement during crisis.' },
      { name: 'Growth advisor / fractional CRO', detail: 'Controlled growth planning from a position of stability.' },
    ],
  },
  p7: {
    operational: [
      { name: 'Pivot protocol — assess structural viability', detail: 'Revenue/OCF breakpoints mean the old model may be breaking. Evaluate honestly.' },
      { name: 'Restructure investor narrative', detail: 'Structural divergence requires narrative update. Transparency preserves trust.' },
      { name: 'Redefine mission and value proposition', detail: 'The business that enters P7 may not be the one that exits it. Strategic clarity required.' },
    ],
    strategic: [],
    referral: [],
  },
  p8: {
    operational: [
      { name: 'Strategic realignment — new revenue model validation', detail: 'The break is positive if slope is up. Validate the new pattern with unit economics.' },
      { name: 'Leadership consolidation', detail: 'Pivots require unified leadership. Misalignment kills pivots faster than competition.' },
      { name: 'Investor communication — evidence-based narrative', detail: 'Show the structural break with data. Revenue break + positive slope = pivot working.' },
    ],
    strategic: [],
    referral: [],
  },
  p9: {
    operational: [
      { name: 'Board emergency session — decision required', detail: 'P9 means P3 elevated + liquidity risk + macro headwinds. This is not a drill.' },
      { name: 'Pivot vs wind-down decision', detail: 'Binary: either a credible 90-day turnaround plan exists, or it doesn\'t. Decide.' },
      { name: 'Legal and financial protection', detail: 'Personal liability review. D&O coverage confirmation. Fiduciary duty documentation.' },
    ],
    strategic: [],
    referral: [
      { name: 'M&A advisor', detail: 'If turnaround is not viable, an orderly sale preserves more value than bankruptcy.' },
      { name: 'Bankruptcy / restructuring attorney', detail: 'Chapter 11 (reorganization) vs Chapter 7 (liquidation) analysis.' },
    ],
  },
  p10: {
    operational: [
      { name: 'New model live — growth protocol', detail: 'Post-restructuring or post-pivot: the new baseline is established. Execute.' },
      { name: 'Culture rebuild', detail: 'Crisis survivors carry trauma. Organizational healing is an operational requirement.' },
      { name: 'New KPI framework', detail: 'Old metrics may not apply. Define new success criteria for the new model.' },
    ],
    strategic: [],
    referral: [],
  },
};

// ═══════════════════════════════════════════════════════════════════
// Phase-to-node mappings — display only
// ═══════════════════════════════════════════════════════════════════

var PHASE_NODE_STATES = {
  p1: [
    {node:'dACC', dir:'hyper'}, {node:'AI', dir:'hyper'},
    {node:'LC', dir:'hyper'},   {node:'BLA', dir:'hyper'},
  ],
  p2: [
    {node:'OXY', dir:'altered'}, {node:'vmPFC', dir:'altered'},
    {node:'VV', dir:'altered'},  {node:'mPFC', dir:'altered'},
  ],
  p3: [
    {node:'BLA', dir:'hyper'},  {node:'CeA', dir:'hyper'},
    {node:'HPA', dir:'hyper'},  {node:'HYPO', dir:'hyper'},
    {node:'ADR', dir:'hyper'},  {node:'LC', dir:'hyper'},
    {node:'PAG', dir:'hyper'},
    {node:'dlPFC', dir:'hypo'}, {node:'vmPFC', dir:'hypo'},
  ],
  p4: [
    {node:'VV', dir:'altered'},    {node:'vmPFC', dir:'altered'},
    {node:'RAPHE', dir:'altered'}, {node:'HIPP', dir:'altered'},
  ],
  p5: [
    {node:'dlPFC', dir:'hyper'}, {node:'dACC', dir:'hyper'},
    {node:'HPA', dir:'hyper'},   {node:'LC', dir:'hyper'},
  ],
  p6: [
    {node:'dlPFC', dir:'altered'}, {node:'vlPFC', dir:'altered'},
    {node:'ECN', dir:'altered'},   {node:'dACC', dir:'altered'},
    {node:'FEF', dir:'altered'},
  ],
  p7: [
    {node:'mPFC', dir:'altered'}, {node:'PCC', dir:'altered'},
    {node:'DMN', dir:'altered'},  {node:'TPJ', dir:'altered'},
  ],
  p7a: [
    {node:'mPFC', dir:'hyper'}, {node:'PCC', dir:'hyper'},
    {node:'DMN', dir:'hyper'},
    {node:'BLA', dir:'hyper'},  {node:'CeA', dir:'hyper'},
    {node:'DV', dir:'hyper'},   {node:'PAG', dir:'hyper'},
  ],
  p7b: [
    {node:'mPFC', dir:'hypo'}, {node:'PCC', dir:'hypo'},
    {node:'DMN', dir:'hypo'},
    {node:'BDNF', dir:'hypo'}, {node:'TrkB', dir:'hypo'},
  ],
  p8: [
    {node:'mPFC', dir:'altered'}, {node:'PCC', dir:'altered'},
    {node:'AI', dir:'altered'},   {node:'dACC', dir:'altered'},
  ],
  p9: [
    {node:'BLA', dir:'hyper'},  {node:'CeA', dir:'hyper'},
    {node:'HPA', dir:'hyper'},  {node:'DV', dir:'hyper'},
    {node:'PAG', dir:'hyper'},
    {node:'DMN', dir:'altered'}, {node:'SN', dir:'altered'},
    {node:'dlPFC', dir:'hypo'}, {node:'NAcc', dir:'altered'},
  ],
  p10: [
    {node:'BDNF', dir:'altered'}, {node:'TrkB', dir:'altered'},
    {node:'HIPP', dir:'altered'}, {node:'dlPFC', dir:'altered'},
  ],
};

function resolveNodeStates(dominantPhase, scores) {
  if (!dominantPhase) return [];
  scores = scores || {};
  if (dominantPhase === 'p3' && (scores.p7a || scores.p7 || 0) > 0.5) {
    return (PHASE_NODE_STATES.p3 || []).concat(PHASE_NODE_STATES.p7a || PHASE_NODE_STATES.p7 || []);
  }
  return PHASE_NODE_STATES[dominantPhase] || [];
}

// ═══════════════════════════════════════════════════════════════════
// Protected report endpoint — thin shim
// ═══════════════════════════════════════════════════════════════════

function runRemoteAnalysis(cik, opts) {
  opts = opts || {};
  var body = {
    cik: String(cik || ''),
    requested_report_type: opts.requested_report_type || 'partial_phase_snapshot',
    source_surface: opts.source_surface || 'business',
    timestamp: Math.floor(Date.now() / 1000),
  };
  ['ticker','company_name','source_opportunity_id','domain','lane','idempotency_key'].forEach(function(k){
    if (opts[k] != null) body[k] = opts[k];
  });
  return fetch('/api/helix/helix-report/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function(r) {
    if (!r.ok) throw new Error('helix-report API HTTP ' + r.status);
    return r.json();
  });
}

// True only when the server says so. NEVER infer from a phase label.
function isValidatedSafePacket(packet) {
  return packet && packet.validation_status === 'validated' && packet.kernel_id === 'limen_backtest_kernel.js';
}

// ═══════════════════════════════════════════════════════════════════
// Legacy stubs — every kernel/extractor entry point that used to live
// in the browser now throws. This is intentional: any caller still
// calling these functions is a code path that bypasses the protected
// endpoint and must be migrated before it can be used.
// ═══════════════════════════════════════════════════════════════════

function _kernelMoved() {
  throw new Error('Kernel runs server-side only. POST /api/helix/helix-report/score (CIK + safe context) and render the safe packet. See assets/data/companies/<slug>.json for CIK lookup.');
}

function runLimenPipeline()        { return _kernelMoved(); }
function computeAllFeatures()      { return _kernelMoved(); }
function scoreAllPhases()          { return _kernelMoved(); }
function analyseTrajectory()       { return _kernelMoved(); }
function computeRuptureScore()     { return _kernelMoved(); }
function computeCompositeScore()   { return _kernelMoved(); }
function peltBreakpoints()         { return _kernelMoved(); }
function detectBreaks()            { return _kernelMoved(); }
function computeLogDiff()          { return _kernelMoved(); }
function computeRollingFeatures()  { return _kernelMoved(); }
function fetchSECFacts()           { return _kernelMoved(); }
function extractQuarterlySeries()  { return _kernelMoved(); }
function fetchCompanyData()        { return _kernelMoved(); }
function fetchFRED()               { return _kernelMoved(); }

// getDominantPhase used to scan a feature row's per-phase scores
// (which the browser no longer holds). Server now returns
// dominant_phase directly on the safe packet — read packet.dominant_phase.
function getDominantPhase(rowOrPacket) {
  if (rowOrPacket && typeof rowOrPacket === 'object' && rowOrPacket.dominant_phase) {
    return rowOrPacket.dominant_phase;
  }
  return null;
}

if (typeof console !== 'undefined' && console.log) {
  console.log('[business-data] ' + BUSINESS_DATA_VERSION + ' loaded (renderer-only).');
}
