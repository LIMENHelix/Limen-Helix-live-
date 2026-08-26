'use strict';

/**
 * Finance-local evidence assembly for an already-open paper position.
 *
 * This is deliberately not the cross-company candidate universe.  A position
 * already belongs to one exact issuer, so its owner must re-read that issuer's
 * retained feed records, current quote, company-network stress, Finance brain
 * state, protected Helix report, market history, and original entry decision
 * without waiting for the issuer to become a new candidate again. Thing 2 is
 * carried only as a zero-weight alignment/masking reconciliation of Thing 1.
 */

var crypto = require('node:crypto');
var Semantic = require('./finance-semantic-evidence.js');
var Source = require('./finance-source-universe.js');
var Network = require('./finance-network-snapshot.js');
var Homology = require('./civilization-homology-context.js');
var registry = require('../assets/data/finance-company-identities.json');

var SCHEMA = 'finance-position-owner-input/1.0';
var MAX_TITLE_SETS = 500;
var MAX_ISSUER_EVIDENCE = 24;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return Number.isFinite(Number(value)); }
function normalizedCik(value) { return String(value == null ? '' : value).replace(/^0+/, '') || '0'; }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function companyByTicker(symbol) {
  var wanted = String(symbol || '').trim().toUpperCase();
  var found = null;
  Object.keys(registry.byCik || {}).some(function (cik) {
    var row = registry.byCik[cik];
    if (!row || String(row.ticker || '').toUpperCase() !== wanted) return false;
    found = { cik: normalizedCik(cik), slug: row.slug, ticker: wanted, name: row.name || null };
    return true;
  });
  return found;
}

function reportingType(title) {
  var value = String(title || '');
  if (/\b10[- ]?Q\b/i.test(value)) return '10-Q';
  if (/\b10[- ]?K\b/i.test(value)) return '10-K';
  if (/\b(quarterly results?|quarterly report|earnings results?|earnings release)\b/i.test(value)) return 'quarterly-or-earnings';
  return null;
}

function issuerEvidence(titleSets, cik) {
  var assembled = Semantic.assemble(titleSets, 'finance');
  var wanted = normalizedCik(cik);
  var rows = assembled.observations.filter(function (row) {
    return Source.cikFromRecord(row && (row.sourceRecordId || row.canonicalUrl)) === wanted;
  }).sort(function (a, b) {
    return Date.parse(b.sourceUpdatedAt || b.recordedAt || '') - Date.parse(a.sourceUpdatedAt || a.recordedAt || '');
  }).slice(0, MAX_ISSUER_EVIDENCE).map(function (row) {
    var next = clone(row);
    next.reportingType = reportingType(next.title);
    return next;
  });
  return {
    observations: rows,
    reportingObservations: rows.filter(function (row) { return !!row.reportingType; }),
    sourceAbstentions: assembled.abstentions
  };
}

function homologyOf(packet) {
  try { return packet && packet.homologyContext ? Homology.normalize(packet.homologyContext) : null; }
  catch (_) { return null; }
}

function kernelOf(homology) {
  var mapping = homology && homology.mappings && homology.mappings.kernel_dynamics;
  var established = !!(mapping && mapping.status === 'PRESENT' && text(mapping.patternId) && text(mapping.source));
  return {
    status: established ? 'PRESENT' : (mapping && mapping.status || 'UNESTABLISHED'),
    usedAsContext: established,
    directTradeAuthority: false,
    mapping: clone(mapping || null),
    note: established
      ? 'Established kernel dynamics may inform the Finance decision as context; they cannot directly select a trade.'
      : 'No established company-specific kernel dynamics are available; no kernel claim is inferred.'
  };
}

function learningFor(patterns, company) {
  var wanted = normalizedCik(company && company.cik);
  return clone(list(patterns).find(function (row) {
    return row && normalizedCik(row.cik) === wanted;
  }) || null);
}

function returnPct(latest, prior) {
  return Number.isFinite(latest) && Number.isFinite(prior) && prior > 0
    ? Math.round(((latest - prior) / prior) * 1000000) / 10000 : null;
}

function marketPerformance(history, benchmarkHistory) {
  function summarize(value) {
    var rows = value && Array.isArray(value.rows) ? value.rows.filter(function (row) { return finite(row.close) && Number(row.close) > 0; }) : [];
    var latest = rows.length ? Number(rows[rows.length - 1].close) : null;
    function back(sessions) {
      if (!rows.length) return null;
      return Number(rows[Math.max(0, rows.length - 1 - sessions)].close);
    }
    var peak = null, drawdown = 0;
    rows.slice(-252).forEach(function (row) {
      var close = Number(row.close);
      if (peak === null || close > peak) peak = close;
      if (peak > 0) drawdown = Math.max(drawdown, ((peak - close) / peak) * 100);
    });
    return {
      symbol: value && value.symbol || null,
      provider: value && value.provider || null,
      interval: value && value.interval || null,
      observations: rows.length,
      firstDate: rows[0] && rows[0].date || null,
      lastDate: rows[rows.length - 1] && rows[rows.length - 1].date || null,
      latestClose: latest,
      returnsPct: {
        oneSession: returnPct(latest, back(1)),
        fiveSessions: returnPct(latest, back(5)),
        twentyOneSessions: returnPct(latest, back(21)),
        sixtyThreeSessions: returnPct(latest, back(63)),
        oneHundredTwentySixSessions: returnPct(latest, back(126)),
        twoHundredFiftyTwoSessions: returnPct(latest, back(252))
      },
      maxDrawdownPctAvailableYear: rows.length ? Math.round(drawdown * 10000) / 10000 : null,
      recentDailyBars: clone(rows.slice(-20))
    };
  }
  var target = summarize(history), benchmark = summarize(benchmarkHistory);
  var relative = {};
  Object.keys(target.returnsPct).forEach(function (key) {
    var a = target.returnsPct[key], b = benchmark.returnsPct[key];
    relative[key] = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) * 10000) / 10000 : null;
  });
  return { target: target, benchmark: benchmark, targetMinusBenchmarkPct: relative };
}

function helixSections(report) {
  var thing0 = report && report.thing0_eligibility || null;
  var thing1 = report && report.validated_signal || null;
  var thing2 = report && report.phase_tracker_signal || null;
  var qualified = !!(thing0 && thing0.qualification_status === 'qualified');
  var permitted = !!(qualified && thing0.permits_thing1_use === true && thing1 && thing1.available === true && thing1.validation_status === 'validated');
  var rawReconciliation = report && report.reconciliation || null;
  var maskingAssessment = rawReconciliation && rawReconciliation.masking_assessment || 'unassessed';
  return {
    reportIdentity: report && { requestId: report.request_id || null, cik: report.cik || null, entityName: report.entity_name || null, latestQuarter: report.latest_quarter || null } || null,
    thing0Eligibility: {
      available: !!thing0,
      qualificationStatus: thing0 && thing0.qualification_status || 'unavailable',
      qualifiedForValidatedThing1: qualified,
      partiallyQualifiedForValidatedThing1: !!(thing0 && thing0.qualification_status === 'partially_qualified'),
      permitsThing1Use: permitted,
      executionStatus: thing0 && thing0.thing1_execution_status || 'unavailable',
      reason: thing0 && thing0.reasons && thing0.reasons[0] || 'explicit_thing0_section_unavailable',
      signal: clone(thing0),
      isFinancial: report && report.is_financial === true,
      historyQuarters: report && report.history_quarters || 0,
      historySufficiency: report && report.history_sufficiency || null,
      inputPresence: clone(report && report.input_presence || null)
    },
    thing1: {
      applicable: permitted,
      decisionContextAllowed: permitted,
      signal: clone(thing1),
      note: permitted ? 'Explicit Thing 0 qualification permits this validated Thing 1 result to be weighed with all other evidence; it cannot directly authorize a trade.' : 'Thing 1 is not permitted by the explicit Thing 0/result gate and contributes no decision evidence.'
    },
    thing2: {
      observed: !!thing2,
      decisionWeight: 0,
      leverageAllowed: false,
      signal: clone(thing2),
      reconciliationRole: 'alignment_and_masking_reconciliation_only',
      maskingAssessment: maskingAssessment,
      agreesWithThing1: rawReconciliation && rawReconciliation.agree !== undefined ? rawReconciliation.agree : 'indeterminate',
      note: 'Thing 2 reconciles the Thing 1 result with the current long-arc snapshot to expose alignment, divergence, or possible masking. It has zero direct trade and leverage weight.'
    },
    reconciliation: clone(rawReconciliation),
    warnings: clone(report && report.warnings || [])
  };
}

function build(input) {
  input = input || {};
  var position = input.position || null;
  var symbol = String(position && position.symbol || '').trim().toUpperCase();
  var company = companyByTicker(symbol);
  var packet = input.financePacket || null;
  var homology = homologyOf(packet);
  var issuer = company ? issuerEvidence(input.titleSets, company.cik) : { observations: [], reportingObservations: [], sourceAbstentions: [] };
  var network = company ? Network.assemble(input.networkPayload, company.slug) : null;
  var quote = input.quote || null;
  var helix = helixSections(input.helixReport || null);
  var performance = marketPerformance(input.marketHistory, input.benchmarkHistory);
  var quantity = Number(position && position.quantity);
  var blockers = [];
  var gaps = [];

  if (!company) blockers.push('position_company_identity_not_in_finance_registry');
  if (!finite(quantity) || quantity === 0) blockers.push('open_position_quantity_required');
  if (!quote || String(quote.symbol || '').toUpperCase() !== symbol || !finite(quote.last) || Number(quote.last) <= 0) {
    blockers.push('current_tradier_quote_required');
  }
  if (!input.openingCommand || !input.openingCommand.commandId) blockers.push('opening_command_attribution_required');
  if (!input.openingDecision || input.openingDecision.status !== 'TRADE_INTENT_SELECTED') blockers.push('opening_decision_receipt_required');
  if (!input.financeCycle || input.financeCycle.domain !== 'finance' || input.financeCycle.ok !== true) blockers.push('current_finance_cycle_required');
  if (!packet || packet.domainId !== 'finance' || packet.sourceType !== 'server-cognition-refresh' || !text(packet.packetId)) {
    blockers.push('current_finance_brain_packet_required');
  }
  if (!homology) blockers.push('current_finance_homology_context_required');
  if (!network) blockers.push('current_company_network_stress_required');
  if (!input.helixReport || !input.helixReport.request_id) gaps.push('protected_helix_report_unavailable');
  if (!helix.thing0Eligibility.available) gaps.push('explicit_thing0_eligibility_unavailable');
  if (!performance.target.observations) blockers.push('target_market_history_required');
  if (!performance.benchmark.observations) blockers.push('benchmark_market_history_required');
  if (!issuer.observations.length) gaps.push('no_retained_exact_issuer_feed_observation');
  if (!issuer.reportingObservations.length) gaps.push('no_retained_quarterly_or_earnings_observation');

  var kernel = kernelOf(homology);
  if (!kernel.usedAsContext) gaps.push('kernel_dynamics_unestablished');
  var context = {
    schemaVersion: SCHEMA,
    ownerDomain: 'finance',
    lane: 'investment',
    mode: 'paper-position-regulation',
    company: clone(company),
    position: clone(position),
    currentQuote: clone(quote),
    marketPerformance: performance,
    helixReport: helix,
    entry: {
      openingCommandId: input.openingCommand && input.openingCommand.commandId || null,
      openingIntent: clone(input.openingCommand && input.openingCommand.intent || null),
      openingOrder: clone(input.openingCommand && input.openingCommand.order || null),
      decision: clone(input.openingDecision || null)
    },
    currentIssuerEvidence: clone(issuer.observations),
    currentReportingEvidence: clone(issuer.reportingObservations),
    companyNetworkStress: clone(network),
    financeBrain: {
      cycle: clone(input.financeCycle || null),
      packetId: packet && packet.packetId || null,
      generatedAt: packet && packet.generatedAt || null,
      phase: clone(homology && homology.phase || null),
      regulation: clone(homology && homology.regulation || null),
      brainNodes: clone(homology && homology.brainNodes || []),
      recovery: clone(homology && homology.recovery || null)
    },
    kernelContext: kernel,
    companyLearning: company ? learningFor(input.companyLearningPatterns, company) : null,
    evidenceGaps: gaps,
    interpretationBoundary: {
      stressDirectlyTriggersTrade: false,
      headlineDirectlyTriggersTrade: false,
      quarterlyReportDirectlyTriggersTrade: false,
      kernelDirectlyTriggersTrade: false,
      thing2Observed: helix.thing2.observed,
      thing2DecisionWeight: 0,
      note: 'Thing 2 must be read only as the alignment/masking reconciliation of Thing 1 against the long-arc snapshot. It is removed from direct trade weighting. All actionable observations regulate an existing position only through a bounded Finance-brain HOLD/SELL/COVER decision.'
    },
    assembledAt: input.now || new Date().toISOString(),
    paperOnly: true,
    liveMoney: false
  };
  context.evidenceFingerprint = hash({
    company: context.company,
    quantity: quantity,
    quote: context.currentQuote && { last: context.currentQuote.last, bid: context.currentQuote.bid, ask: context.currentQuote.ask },
    packetId: context.financeBrain.packetId,
    issuer: context.currentIssuerEvidence.map(function (row) { return row.sourceIdentity; }),
    network: context.companyNetworkStress,
    marketPerformance: context.marketPerformance,
    helixThing0: context.helixReport.thing0Eligibility,
    helixThing1: context.helixReport.thing1,
    helixThing2Identity: context.helixReport.thing2.signal && {
      kernelId: context.helixReport.thing2.signal.kernel_id,
      dominantPhase: context.helixReport.thing2.signal.dominant_phase,
      historyQuarters: context.helixReport.thing0Eligibility.historyQuarters
    },
    openingCommandId: context.entry.openingCommandId,
    learning: context.companyLearning
  });
  return {
    schemaVersion: SCHEMA,
    status: blockers.length ? 'ABSTAINED' : 'READY_FOR_POSITION_REVIEW',
    blockers: blockers,
    evidenceGaps: gaps,
    context: context
  };
}

async function helixReport(options, company) {
  options = options || {};
  company = company || {};
  var fetchFn = options.fetch || global.fetch;
  var base = options.origin || 'https://limenhelix.com';
  var response = await fetchFn(base + '/api/helix/helix-report/score', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'cache-control': 'no-cache' },
    cache: 'no-store',
    body: JSON.stringify({
      cik: normalizedCik(company.cik),
      requested_report_type: 'partial_phase_snapshot',
      source_surface: 'finance_command',
      ticker: company.ticker || null,
      company_name: company.name || null,
      domain: 'finance',
      lane: 'investment',
      idempotency_key: options.idempotencyKey || null,
      timestamp: Math.floor(Date.now() / 1000)
    })
  });
  if (!response || !response.ok) throw new Error('/api/helix/helix-report/score HTTP ' + (response && response.status));
  return response.json();
}

async function productionInput(options) {
  options = options || {};
  var fetchFn = options.fetch || global.fetch;
  var base = options.origin || 'https://limenhelix.com';
  var token = options.token || '';
  async function get(path, authenticated) {
    var headers = { accept: 'application/json', 'cache-control': 'no-cache' };
    if (authenticated) headers['x-brain-token'] = token;
    var response = await fetchFn(base + path, { headers: headers, cache: 'no-store' });
    if (!response || !response.ok) throw new Error(path + ' HTTP ' + (response && response.status));
    return response.json();
  }
  var rows = await Promise.all([
    get('/api/feed-record?titles=finance&n=' + MAX_TITLE_SETS, false),
    get('/api/brain-shadow', true),
    get('/api/brain-cognition', false),
    get('/api/limen-stress-slim', false),
    get('/api/product-domain-learning-state?domain=finance', false)
  ]);
  var cognition = rows[2] && rows[2].cognition && rows[2].cognition.finance;
  return {
    titleSets: rows[0] && rows[0].titles || [],
    financeCycle: rows[1] && rows[1].cycles && rows[1].cycles.finance || null,
    financePacket: cognition && cognition.c && cognition.c.serverPacket || null,
    networkPayload: rows[3] || null,
    companyLearningPatterns: rows[4] && rows[4].companyPatterns || [],
    retrievedAt: new Date().toISOString()
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_TITLE_SETS: MAX_TITLE_SETS,
  MAX_ISSUER_EVIDENCE: MAX_ISSUER_EVIDENCE,
  companyByTicker: companyByTicker,
  reportingType: reportingType,
  issuerEvidence: issuerEvidence,
  kernelOf: kernelOf,
  marketPerformance: marketPerformance,
  helixSections: helixSections,
  build: build,
  productionInput: productionInput,
  helixReport: helixReport
};
