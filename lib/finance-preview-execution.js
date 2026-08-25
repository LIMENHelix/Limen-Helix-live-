'use strict';

var Readiness = require('./finance-preview-readiness.js');
var Cycle = require('./finance-preview-cycle.js');
var Source = require('./finance-source-universe.js');
var Provider = require('./finance-preview-provider.js');
/* Compact, source-hashed projection: the 17 MB portal registry is deliberately
   excluded from Vercel functions, while this exact CIK/slug/ticker identity
   surface is small enough to ship with the authenticated Preview boundary. */
var registry = require('../assets/data/finance-company-identities.json');

var SCHEMA = 'finance-preview-execution/1.0';
var RECEIPT_SCHEMA = 'finance-preview-receipt/1.0';
var LOG_KEY = 'finance_preview_log';
var RETENTION_SECONDS = 180 * 24 * 60 * 60;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function receiptKey(packetId) { return 'finance_preview:' + packetId; }

function companiesForTitles(titleSets) {
  var ciks = Object.create(null), seen = Object.create(null), out = [];
  (Array.isArray(titleSets) ? titleSets : []).forEach(function (set) {
    (Array.isArray(set && set.items) ? set.items : []).forEach(function (item) {
      var cik = Source.cikFromRecord(item && (item.au || item.url || item.sourceRecordId));
      if (cik) ciks[cik] = true;
    });
  });
  Object.keys(registry.byCik || {}).forEach(function (cik) {
    var normalized = String(cik).replace(/^0+/, '') || '0';
    var company = registry.byCik[cik];
    if (!ciks[normalized] || !company || !company.slug || !company.ticker || company.ticker === 'PRIVATE' || seen[company.ticker]) return;
    seen[company.ticker] = true;
    out.push(Object.assign({ cik: cik }, company));
  });
  return out;
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
  var titlePayload = await get('/api/feed-record?titles=finance&n=8', false);
  var titleSets = titlePayload.titles || [];
  var companies = companiesForTitles(titleSets);
  var tickers = companies.map(function (company) { return company.ticker; });
  var results = await Promise.all([
    get('/api/brain-shadow', true),
    get('/api/brain-cognition', false),
    get('/api/asset-quote?symbols=' + encodeURIComponent(tickers.join(',')), false),
    get('/api/limen-stress-slim', false)
  ]);
  var shadow = results[0], cognition = results[1];
  var financeCognition = cognition.cognition && cognition.cognition.finance;
  var packet = financeCognition && financeCognition.c && financeCognition.c.serverPacket;
  return {
    input: {
      companyRegistry: registry,
      titleSets: titleSets,
      marketPayload: results[2],
      networkPayload: results[3],
      financeCycle: shadow.cycles && shadow.cycles.finance,
      packets: packet ? [packet] : [],
      now: new Date().toISOString()
    },
    packet: packet || null,
    companies: companies
  };
}

function audit(bundle) {
  var readiness = Readiness.build(bundle && bundle.input);
  var blockers = {};
  (readiness.universe.abstentions || []).forEach(function (row) {
    (row.blockers || []).forEach(function (blocker) { blockers[blocker] = (blockers[blocker] || 0) + 1; });
  });
  return {
    schemaVersion: SCHEMA,
    status: readiness.status,
    acceptedCandidates: readiness.universe.candidates.length,
    companies: (bundle.companies || []).map(function (company) {
      return { slug: company.slug, ticker: company.ticker, cik: company.cik };
    }),
    packetId: bundle.packet && bundle.packet.packetId || null,
    packetGeneratedAt: bundle.packet && bundle.packet.generatedAt || null,
    semanticEvidence: bundle.packet && bundle.packet.truth && Array.isArray(bundle.packet.truth.semanticEvidence)
      ? bundle.packet.truth.semanticEvidence.length : 0,
    opportunities: bundle.packet && bundle.packet.truth && Array.isArray(bundle.packet.truth.opportunities)
      ? bundle.packet.truth.opportunities.length : 0,
    blockers: blockers,
    providerCalled: false,
    brokerTouched: false,
    readiness: readiness
  };
}

async function execute(store, bundle, request, options) {
  options = options || {};
  request = request || {};
  if (!store || typeof store.setIfAbsent !== 'function' || typeof store.get !== 'function') {
    throw new Error('Finance Preview execution requires a durable store');
  }
  store.assertDurable();
  var before = audit(bundle);
  if (before.status !== 'READY_FOR_MANAGER_REVIEW') {
    return { ok: false, status: 'ABSTAINED', reason: 'finance_preview_inputs_not_ready', audit: before };
  }
  if (!text(request.packetId) || request.packetId !== before.packetId) {
    return { ok: false, status: 'ABSTAINED', reason: 'approved_packet_must_match_current_packet', audit: before };
  }
  if (request.approve !== true) {
    return { ok: false, status: 'ABSTAINED', reason: 'explicit_preview_approval_required', audit: before };
  }
  var key = receiptKey(request.packetId);
  var existing = await store.get(key);
  if (existing) return { ok: true, idempotent: true, receipt: existing, audit: before };

  var commanded = {
    schemaVersion: RECEIPT_SCHEMA,
    packetId: request.packetId,
    status: 'COMMANDING',
    authorizedAt: options.now || new Date().toISOString(),
    oneShot: true,
    maxOutputTokens: Provider.MAX_OUTPUT_TOKENS
  };
  var created = await store.setIfAbsent(key, commanded, RETENTION_SECONDS);
  if (!created) {
    existing = await store.get(key);
    return { ok: true, idempotent: true, receipt: existing, audit: before };
  }

  var provider = options.provider || Provider.create(options.providerOptions);
  var providerCalls = 0;
  var observedProvider = async function (input) {
    providerCalls++;
    if (providerCalls > 1) throw new Error('Finance Preview execution attempted more than one provider call');
    return provider(input);
  };
  var result = await Cycle.run(bundle.input, { provider: observedProvider });
  var receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    packetId: request.packetId,
    authorizedAt: commanded.authorizedAt,
    completedAt: options.completedAt || new Date().toISOString(),
    status: result.status,
    reason: result.reason || null,
    blockers: clone(result.manager && result.manager.blockers || []),
    /* An HTTP or parse failure is still a provider invocation and must not be
       mislabeled providerCalled:false in the durable receipt. */
    providerCalled: providerCalls === 1,
    brokerTouched: false,
    selectedCompany: clone(result.selectedCompany),
    proposal: clone(result.manager && result.manager.proposal),
    candidate: clone(result.candidate),
    provider: clone(result.manager && result.manager.provider),
    safety: {
      oneShot: true,
      candidatePersistedOutsideReceipt: false,
      candidateReleased: false,
      brokerTouched: false,
      orderPlaced: false,
      liveMoney: false
    }
  };
  await store.set(key, receipt, RETENTION_SECONDS);
  await store.lpush(LOG_KEY, {
    packetId: receipt.packetId,
    completedAt: receipt.completedAt,
    status: receipt.status,
    providerCalled: receipt.providerCalled,
    selectedCompany: receipt.selectedCompany,
    provider: receipt.provider
  });
  await store.ltrim(LOG_KEY, 0, 199);
  return { ok: true, idempotent: false, receipt: receipt, audit: before };
}

module.exports = {
  SCHEMA: SCHEMA,
  RECEIPT_SCHEMA: RECEIPT_SCHEMA,
  LOG_KEY: LOG_KEY,
  RETENTION_SECONDS: RETENTION_SECONDS,
  receiptKey: receiptKey,
  companiesForTitles: companiesForTitles,
  productionInput: productionInput,
  audit: audit,
  execute: execute
};
