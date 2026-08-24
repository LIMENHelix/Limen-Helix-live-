'use strict';

/** Build the read-only input bundle for the Finance Preview gate. */

var Source = require('./finance-source-universe.js');
var Market = require('./finance-market-snapshot.js');
var Network = require('./finance-network-snapshot.js');

var SCHEMA = 'finance-preview-readiness/1.0';

function list(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function normalizedCik(value) { return String(value == null ? '' : value).replace(/^0+/, '') || '0'; }

function companiesFromRegistry(registry) {
  var out = [];
  var byCik = registry && registry.byCik;
  if (!byCik || typeof byCik !== 'object') return out;
  Object.keys(byCik).forEach(function (cik) {
    var row = byCik[cik];
    if (!row || !text(row.slug) || !text(row.ticker) || row.ticker === 'PRIVATE') return;
    out.push({ cik: String(cik), slug: row.slug, ticker: String(row.ticker).toUpperCase(), name: row.name || null });
  });
  return out;
}

function packetForDomain(packets, domain) {
  return list(packets).filter(function (packet) {
    return packet && packet.domainId === domain && packet.sourceType === 'server-cognition-refresh';
  }).sort(function (a, b) {
    return Date.parse(b.generatedAt || '') - Date.parse(a.generatedAt || '');
  })[0] || null;
}

function marketByTicker(payload, tickers) {
  var out = {};
  list(tickers).forEach(function (ticker) {
    var snapshot = Market.assemble(payload, [ticker]);
    out[String(ticker).toUpperCase()] = snapshot;
  });
  return out;
}

function networkBySlug(payload, slugs) {
  var out = {};
  list(slugs).forEach(function (slug) {
    var row = Network.assemble(payload, slug);
    if (row) out[slug] = row;
  });
  return out;
}

function build(input) {
  input = input || {};
  var registryCompanies = companiesFromRegistry(input.companyRegistry);
  var titleSets = list(input.titleSets);
  var cikSet = Object.create(null);
  titleSets.forEach(function (set) {
    list(set && set.items).forEach(function (item) {
      var cik = Source.cikFromRecord(item && (item.au || item.url || item.sourceRecordId));
      if (cik) cikSet[cik] = true;
    });
  });
  var companies = registryCompanies.filter(function (company) { return !!cikSet[normalizedCik(company.cik)]; });
  // Select only identities evidenced by a title CIK.  Keep the explicit list
  // separate so an absent CIK cannot cause the market fetcher to request the
  // entire company registry.
  var tickers = companies.map(function (company) { return company.ticker; });
  var slugs = companies.map(function (company) { return company.slug; });
  var universe = Source.assemble({
    domain: 'finance',
    now: input.now,
    asOf: input.now || null,
    titleSets: titleSets,
    companies: companies,
    financeCycle: input.financeCycle || null,
    financePacket: packetForDomain(input.packets, 'finance'),
    marketDataByTicker: marketByTicker(input.marketPayload, tickers),
    networkBySlug: networkBySlug(input.networkPayload, slugs),
    thing1BySlug: input.thing1BySlug || {},
    thing2BySlug: input.thing2BySlug || {}
  });
  return {
    schemaVersion: SCHEMA,
    status: universe.status,
    universe: universe.universe,
    sourceAbstentions: universe.sourceAbstentions,
    semanticMeta: universe.semanticMeta,
    identityCollisions: universe.identityCollisions,
    inputs: {
      titleSets: titleSets.length,
      titleItems: titleSets.reduce(function (n, set) { return n + list(set && set.items).length; }, 0),
      identityCandidates: companies.length,
      marketTickersRequested: tickers.length,
      networkSlugsRequested: slugs.length,
      financeCyclePresent: !!input.financeCycle,
      financePacketPresent: !!packetForDomain(input.packets, 'finance')
    },
    providerCalled: false,
    brokerTouched: false,
    next: universe.status === 'READY_FOR_MANAGER_REVIEW' ? 'operator-preview-gate' : 'abstain-until-inputs-complete'
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  companiesFromRegistry: companiesFromRegistry,
  packetForDomain: packetForDomain,
  marketByTicker: marketByTicker,
  networkBySlug: networkBySlug,
  build: build
};
