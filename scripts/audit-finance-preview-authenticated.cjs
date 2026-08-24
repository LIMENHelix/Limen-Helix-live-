#!/usr/bin/env node
'use strict';

/* Authenticated, read-only Finance Preview audit.
 * Requires BRAIN_SHADOW_TOKEN in the local environment.  It never calls the
 * manager provider, writes Redis, releases a candidate, or contacts a broker. */

const Readiness = require('../lib/finance-preview-readiness.js');
const Source = require('../lib/finance-source-universe.js');
const registry = require('../assets/data/company-registry.json');

const BASE = process.env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com';
const TOKEN = process.env.BRAIN_SHADOW_TOKEN;

if (!TOKEN) {
  console.error('BRAIN_SHADOW_TOKEN is required for the authenticated read-only audit');
  process.exitCode = 1;
} else {
  function get(path, authenticated) {
    const headers = { accept: 'application/json' };
    if (authenticated) headers['x-brain-token'] = TOKEN;
    return fetch(BASE + path, { headers: headers, cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' HTTP ' + r.status);
      return r.json();
    });
  }

  function companiesForTitles(titleSets) {
    const seen = new Set();
    const ciks = new Set();
    for (const set of Array.isArray(titleSets) ? titleSets : []) {
      for (const item of Array.isArray(set && set.items) ? set.items : []) {
        const cik = Source.cikFromRecord(item && (item.au || item.url || item.sourceRecordId));
        if (cik) ciks.add(cik);
      }
    }
    return Object.entries(registry.byCik || {}).filter(function (entry) {
      const cik = String(entry[0]).replace(/^0+/, '') || '0';
      const company = entry[1];
      return ciks.has(cik) && company && company.slug && company.ticker && company.ticker !== 'PRIVATE';
    }).map(function (entry) {
      return Object.assign({ cik: entry[0] }, entry[1]);
    }).filter(function (company) {
      if (seen.has(company.ticker)) return false;
      seen.add(company.ticker);
      return true;
    });
  }

  function blockerCounts(result) {
    const out = {};
    for (const row of result.universe.abstentions || []) {
      for (const blocker of row.blockers || []) out[blocker] = (out[blocker] || 0) + 1;
    }
    return out;
  }

  (async function () {
    const titlePayload = await get('/api/feed-record?titles=finance&n=8', false);
    const titleSets = titlePayload.titles || [];
    const shadow = await get('/api/brain-shadow', true);
    const cognition = await get('/api/brain-cognition', false);
    const financeCognition = cognition.cognition && cognition.cognition.finance;
    const financePacket = financeCognition && financeCognition.c && financeCognition.c.serverPacket;
    const companies = companiesForTitles(titleSets);
    const tickers = companies.map(function (company) { return company.ticker; });
    const marketPayload = await get('/api/asset-quote?symbols=' + encodeURIComponent(tickers.join(',')), false);
    const networkPayload = await get('/api/limen-stress-slim', false);
    const financeCycle = shadow.cycles && shadow.cycles.finance;
    const result = Readiness.build({
      companyRegistry: registry,
      titleSets: titleSets,
      marketPayload: marketPayload,
      networkPayload: networkPayload,
      financeCycle: financeCycle,
      packets: financePacket ? [financePacket] : [],
      now: new Date().toISOString()
    });
    console.log(JSON.stringify({
      origin: BASE,
      readOnly: true,
      titleSets: titleSets.length,
      titleItems: titleSets.reduce(function (n, set) { return n + ((set && set.items) || []).length; }, 0),
      companies: companies.map(function (company) { return { slug: company.slug, ticker: company.ticker, cik: company.cik }; }),
      marketTickersRequested: tickers,
      marketQuotesReturned: Object.keys(marketPayload.quotes || {}),
      financeCycle: financeCycle ? {
        ok: financeCycle.ok,
        rowsApplied: financeCycle.rowsApplied,
        restored: financeCycle.restored,
        l3CurrentEvidenceComplete: financeCycle.domainFunction && financeCycle.domainFunction.evidence && financeCycle.domainFunction.evidence.l3CurrentEvidenceComplete,
        outwardConsumersDeclared: financeCycle.domainFunction && financeCycle.domainFunction.outwardConsumersDeclared
      } : null,
      financePacket: financePacket ? {
        packetId: financePacket.packetId,
        generatedAt: financePacket.generatedAt,
        semanticEvidence: Array.isArray(financePacket.truth && financePacket.truth.semanticEvidence) ? financePacket.truth.semanticEvidence.length : 0,
        opportunities: Array.isArray(financePacket.truth && financePacket.truth.opportunities) ? financePacket.truth.opportunities.length : 0,
        persistence: financeCognition.c.serverPacketPersistence || null
      } : null,
      networkRowsAvailable: Object.keys(networkPayload.bySlug || {}).length,
      status: result.status,
      acceptedCandidates: result.universe.candidates.length,
      sourceAbstentions: result.sourceAbstentions.length,
      ledgerBlockers: blockerCounts(result),
      providerCalled: result.providerCalled,
      brokerTouched: result.brokerTouched,
      next: result.next
    }, null, 2));
  }()).catch(function (error) {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  });
}

