'use strict';

/**
 * GET /api/finance-preview — operator-only, read-only Finance Preview gate.
 *
 * This assembles current source inputs and reports the exact universe or its
 * abstentions. It never calls the manager provider, writes Redis, releases a
 * paper candidate, or touches a broker.
 */

var db = require('../lib/limen-db.js');
var shadowStore = require('../lib/brain-shadow-store.js');
var handoffFactory = require('../lib/civilization-handoff-store.js');
var Readiness = require('../lib/finance-preview-readiness.js');
var Source = require('../lib/finance-source-universe.js');
var registry = require('../assets/data/company-registry.json');

var handoffStore = handoffFactory.createStore();
var MAX_TITLE_SETS = 8;
var MAX_PACKETS = 50;
var BASE = 'https://' + (process.env.SELF_ORIGIN || 'limenhelix.com');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function authorized(req) {
  var expected = process.env.BRAIN_SHADOW_TOKEN || '';
  if (!expected) return { ok: false, status: 503, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' };
  var supplied = req && req.headers && (req.headers['x-brain-token'] || req.headers.authorization || '');
  if (/^Bearer\s+/i.test(supplied)) supplied = supplied.replace(/^Bearer\s+/i, '');
  return supplied === expected ? { ok: true } : { ok: false, status: 401, error: 'unauthorized' };
}

async function jsonGet(url) {
  var response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response || !response.ok) throw new Error('GET ' + url + ' returned HTTP ' + (response && response.status));
  return response.json();
}

async function latestPackets() {
  var ids = await handoffStore.members(handoffStore.packetIndexKey);
  ids = ids.slice(-MAX_PACKETS);
  var packets = [];
  for (var i = 0; i < ids.length; i++) {
    var packet = await handoffStore.get(handoffStore.packetKey(ids[i]));
    if (packet) packets.push(packet);
  }
  return packets;
}

function marketSymbols(titleSets) {
  var identities = Readiness.companiesFromRegistry(registry);
  var byCik = Object.create(null);
  identities.forEach(function (company) { byCik[String(company.cik).replace(/^0+/, '')] = company; });
  var out = [], seen = Object.create(null);
  titleSets.forEach(function (set) {
    (Array.isArray(set && set.items) ? set.items : []).forEach(function (item) {
      var cik = Source.cikFromRecord(item && (item.au || item.url || item.sourceRecordId));
      var company = cik && byCik[cik];
      if (company && !seen[company.ticker]) { seen[company.ticker] = true; out.push(company.ticker); }
    });
  });
  return out;
}

module.exports = async function handler(req, res) {
  var auth = authorized(req);
  if (!auth.ok) return send(res, auth.status, { ok: false, error: auth.error });
  if ((req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
  var now = new Date().toISOString();
  try {
    var titleSets = await db.lrangeStrict('feedtitles:finance', 0, MAX_TITLE_SETS - 1);
    var cycle = await shadowStore.readCycle('finance');
    var packets = await latestPackets();
    var symbols = marketSymbols(titleSets);
    var inputErrors = [];
    var marketPayload = { quotes: {}, updated: null };
    var networkPayload = { bySlug: {}, generatedAt: null };
    if (symbols.length > 10) inputErrors.push({ reason: 'market_symbol_handler_cap', requested: symbols.length, fetched: 10 });
    try { marketPayload = await jsonGet(BASE + '/api/asset-quote?symbols=' + encodeURIComponent(symbols.slice(0, 10).join(','))); }
    catch (e) { inputErrors.push({ reason: 'company_market_snapshot_unavailable', detail: String(e.message || e) }); }
    try { networkPayload = await jsonGet(BASE + '/api/limen-stress-slim'); }
    catch (e) { inputErrors.push({ reason: 'network_snapshot_unavailable', detail: String(e.message || e) }); }
    var result = Readiness.build({
      companyRegistry: registry,
      titleSets: titleSets,
      marketPayload: marketPayload,
      networkPayload: networkPayload,
      financeCycle: cycle,
      packets: packets,
      now: now
    });
    result.inputErrors = inputErrors;
    result.readOnly = true;
    result.operatorSurface = 'finance-preview';
    return send(res, 200, result);
  } catch (e) {
    return send(res, 503, { ok: false, status: 'ABSTAINED', error: 'finance_preview_inputs_unavailable', detail: String(e.message || e), providerCalled: false, brokerTouched: false });
  }
};
