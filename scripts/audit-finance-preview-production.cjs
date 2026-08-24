#!/usr/bin/env node
'use strict';

/* Read-only production audit.  No provider, Redis write, paper release, or broker call. */
const Readiness = require('../lib/finance-preview-readiness.js');
const Source = require('../lib/finance-source-universe.js');
const registry = require('../assets/data/company-registry.json');

const BASE = process.env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com';

async function get(path) {
  const response = await fetch(BASE + path, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
  return response.json();
}

function companiesByCik() {
  const out = Object.create(null);
  Object.entries(registry.byCik || {}).forEach(([cik, row]) => {
    if (row && row.slug && row.ticker && row.ticker !== 'PRIVATE') out[String(cik).replace(/^0+/, '')] = row;
  });
  return out;
}

function symbols(titleSets) {
  const byCik = companiesByCik();
  const out = [];
  const seen = new Set();
  for (const set of Array.isArray(titleSets) ? titleSets : []) {
    for (const item of Array.isArray(set && set.items) ? set.items : []) {
      const cik = Source.cikFromRecord(item && (item.au || item.url || item.sourceRecordId));
      const company = cik && byCik[cik];
      if (company && !seen.has(company.ticker)) { seen.add(company.ticker); out.push(company.ticker); }
    }
  }
  return out;
}

(async function () {
  const titlePayload = await get('/api/feed-record?titles=finance&n=8');
  const titleSets = titlePayload.titles || [];
  const requested = symbols(titleSets);
  const marketPayload = await get('/api/asset-quote?symbols=' + encodeURIComponent(requested.slice(0, 10).join(',')));
  const networkPayload = await get('/api/limen-stress-slim');
  const result = Readiness.build({
    companyRegistry: registry,
    titleSets,
    marketPayload,
    networkPayload,
    // Deliberately absent: the shadow cycle and handoff packet are not public
    // and no operator token is used by this audit.
    now: new Date().toISOString()
  });
  const blockers = {};
  for (const row of (result.universe.abstentions || [])) {
    for (const blocker of row.blockers || []) blockers[blocker] = (blockers[blocker] || 0) + 1;
  }
  console.log(JSON.stringify({
    origin: BASE,
    titleSets: titleSets.length,
    titleItems: titleSets.reduce((n, set) => n + ((set && set.items) || []).length, 0),
    identityCandidates: result.inputs.identityCandidates,
    marketTickersRequested: result.inputs.marketTickersRequested,
    marketQuotesReturned: Object.values(marketPayload.quotes || {}).filter((q) => q && q.live === true).length,
    networkRowsAvailable: Object.keys(networkPayload.bySlug || {}).length,
    financeCyclePresent: result.inputs.financeCyclePresent,
    financePacketPresent: result.inputs.financePacketPresent,
    status: result.status,
    acceptedCandidates: result.universe.candidates.length,
    sourceAbstentions: result.sourceAbstentions.length,
    ledgerBlockers: blockers,
    providerCalled: result.providerCalled,
    brokerTouched: result.brokerTouched
  }, null, 2));
}()).catch((error) => { console.error(error.message || error); process.exitCode = 1; });
