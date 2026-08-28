'use strict';

/**
 * Assemble a Finance candidate universe from source-preserving inputs.
 *
 * This is an adapter only.  It joins persisted title observations to an exact
 * SEC CIK identity, an exact ticker market snapshot, and an exact company
 * network row before delegating readiness to finance-candidate-universe.js.
 * It never ranks, scores, classifies sentiment, copies aggregate market data,
 * infers a company from a title, calls a provider, or writes state.
 */

var Semantic = require('./finance-semantic-evidence.js');
var Universe = require('./finance-candidate-universe.js');

var SCHEMA = 'finance-source-universe/1.0';

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function key(value) { return String(value == null ? '' : value).replace(/^0+/, '') || '0'; }
function numericCik(value) { return value != null && /^\d+$/.test(String(value).trim()) ? key(String(value).trim()) : null; }

function cikFromRecord(value) {
  if (!text(value)) return null;
  var s = String(value);
  var match = s.match(/\/data\/0*(\d+)\//i) || s.match(/(?:^|[^0-9])cik[:\/_-]*0*(\d+)(?:[^0-9]|$)/i);
  return match ? key(match[1]) : null;
}

function identityIndex(companies) {
  var byCik = Object.create(null);
  var collisions = [];
  list(companies).forEach(function (company, index) {
    var cik = company && numericCik(company.cik);
    if (!company || !cik || !text(company.slug) || !text(company.ticker)) return;
    var prior = byCik[cik];
    if (prior && (prior.slug !== company.slug || prior.ticker !== company.ticker)) {
      collisions.push({ cik: cik, first: clone(prior), second: clone(company), index: index });
      return;
    }
    byCik[cik] = { cik: cik, slug: company.slug, ticker: String(company.ticker).toUpperCase(), name: company.name || null };
  });
  return { byCik: byCik, collisions: collisions };
}

function titleRows(titleSets, domain) {
  var assembled = Semantic.assemble(titleSets, domain);
  var mapped = Object.create(null);
  var order = [];
  var abstentions = assembled.abstentions.slice();
  assembled.observations.forEach(function (observation, index) {
    var cik = cikFromRecord(observation.sourceRecordId || observation.canonicalUrl);
    if (!cik) {
      abstentions.push({ observation: index, reason: 'title_identity_has_no_sec_cik' });
      return;
    }
    if (!mapped[cik]) { mapped[cik] = []; order.push(cik); }
    mapped[cik].push(observation);
  });
  return { byCik: mapped, order: order, abstentions: abstentions, meta: assembled };
}

function explicitKernel(value, reason) {
  if (value && typeof value === 'object' && typeof value.applicable === 'boolean') return clone(value);
  return { applicable: false, reason: reason };
}

function assemble(input) {
  input = input || {};
  var index = identityIndex(input.companies);
  var titles = titleRows(input.titleSets, input.domain || 'finance');
  var sourceAbstentions = titles.abstentions.slice();
  var candidates = [];
  var seen = Object.create(null);
  var marketByTicker = input.marketDataByTicker && typeof input.marketDataByTicker === 'object' ? input.marketDataByTicker : {};
  var networkBySlug = input.networkBySlug && typeof input.networkBySlug === 'object' ? input.networkBySlug : {};
  var thing1BySlug = input.thing1BySlug && typeof input.thing1BySlug === 'object' ? input.thing1BySlug : {};
  var thing2BySlug = input.thing2BySlug && typeof input.thing2BySlug === 'object' ? input.thing2BySlug : {};
  var companyLearningByCik = input.companyLearningByCik && typeof input.companyLearningByCik === 'object' ? input.companyLearningByCik : {};

  index.collisions.forEach(function (collision) {
    sourceAbstentions.push({ cik: collision.cik, reason: 'company_identity_cik_collision', identities: [collision.first, collision.second] });
  });

  titles.order.forEach(function (cik) {
    var company = index.byCik[cik];
    if (!company) {
      sourceAbstentions.push({ cik: cik, reason: 'title_cik_not_in_company_identity_index' });
      return;
    }
    if (seen[cik]) return;
    seen[cik] = true;
    if (index.collisions.some(function (collision) { return collision.cik === cik; })) return;
    var marketData = marketByTicker[company.ticker] || marketByTicker[company.ticker.toLowerCase()] || null;
    var hasExactQuote = marketData && Array.isArray(marketData.quotes) && marketData.quotes.some(function (quote) {
      return quote && String(quote.symbol || '').toUpperCase() === company.ticker;
    });
    if (!hasExactQuote) {
      sourceAbstentions.push({ cik: cik, company: clone(company), reason: 'company_market_quote_identity_missing' });
      marketData = null;
    }
    var network = networkBySlug[company.slug] || null;
    candidates.push({
      company: company,
      now: input.now,
      financeCycle: input.financeCycle,
      financePacket: input.financePacket,
      semanticEvidence: titles.byCik[cik],
      marketData: marketData,
      networkEvidence: network ? [network] : [],
      companyLearning: companyLearningByCik[cik] || null,
      thing1: explicitKernel(thing1BySlug[company.slug], 'not-supplied-by-source-universe'),
      thing2: explicitKernel(thing2BySlug[company.slug], 'not-supplied-by-source-universe')
    });
  });

  var universe = Universe.build({
    candidates: candidates,
    asOf: input.asOf || null
  });
  if (candidates.length > Universe.MAX_CANDIDATES) {
    sourceAbstentions.push({ reason: 'candidate_universe_input_truncated', count: candidates.length - Universe.MAX_CANDIDATES });
  }
  return {
    schemaVersion: SCHEMA,
    status: universe.status,
    universe: universe,
    semanticMeta: {
      schemaVersion: 'finance-semantic-packet/1.0',
      observations: titles.meta.observations.length,
      sourceAbstentions: titles.meta.abstentions.length,
      retrievedAt: input.retrievedAt || null
    },
    sourceAbstentions: sourceAbstentions,
    identityCollisions: clone(index.collisions),
    mappedCikCount: candidates.length,
    asOf: input.asOf || null
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  cikFromRecord: cikFromRecord,
  identityIndex: identityIndex,
  assemble: assemble
};
