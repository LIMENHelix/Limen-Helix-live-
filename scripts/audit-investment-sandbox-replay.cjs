#!/usr/bin/env node
'use strict';

/** Read-only production-shaped investment sandbox preflight. */

const fs = require('node:fs');
const path = require('node:path');
const Replay = require('../lib/investment-sandbox-replay.js');
const Semantic = require('../lib/finance-semantic-evidence.js');
const Market = require('../lib/finance-market-snapshot.js');
const Network = require('../lib/finance-network-snapshot.js');

const BASE = process.env.PUBLIC_BASE_URL || 'https://limenhelix.com';

async function getJson(url, headers) {
  const response = await fetch(url, { headers: headers || {} });
  let body = null;
  try { body = await response.json(); } catch (_) { body = null; }
  return { status: response.status, body };
}

function candidateTicker(inbox) {
  const rows = inbox && Array.isArray(inbox.readyForAutofire) ? inbox.readyForAutofire : [];
  const item = rows.find((x) => x && x.status === 'READY_TO_FIRE' && x.lane === 'investment');
  return item && item.portalTicker ? String(item.portalTicker).toUpperCase() : null;
}

function candidateSlug(inbox) {
  const rows = inbox && Array.isArray(inbox.readyForAutofire) ? inbox.readyForAutofire : [];
  const item = rows.find((x) => x && x.status === 'READY_TO_FIRE' && x.lane === 'investment');
  return item && item.portalSlug ? String(item.portalSlug) : null;
}

function readMasterInbox() {
  const file = path.join(__dirname, '..', 'assets', 'data', '_master-inbox.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

(async function main() {
  const token = process.env.BRAIN_SHADOW_TOKEN || '';
  const headers = token ? { 'x-brain-token': token } : {};
  const inbox = readMasterInbox();
  const ticker = candidateTicker(inbox);
  const slug = candidateSlug(inbox);
  const [snapshot, shadow, handoff, titles, quote, network] = await Promise.all([
    getJson(BASE + '/api/domain-snapshot'),
    getJson(BASE + '/api/brain-shadow', headers),
    getJson(BASE + '/api/limen-civilization-handoff?limit=100', headers),
    getJson(BASE + '/api/feed-record?titles=finance&n=500'),
    ticker ? getJson(BASE + '/api/asset-quote?symbols=' + encodeURIComponent(ticker)) : Promise.resolve({ status: null, body: null }),
    slug ? getJson(BASE + '/api/limen-stress-slim') : Promise.resolve({ status: null, body: null })
  ]);
  const titleSets = titles.body && Array.isArray(titles.body.titles) ? titles.body.titles : [];
  const semantic = Semantic.assemble(titleSets, 'finance');
  const marketData = ticker ? Market.assemble(quote.body, [ticker]) : null;
  const networkStress = slug ? Network.assemble(network.body, slug) : null;
  const report = Replay.summarize({
    snapshot: snapshot.body,
    brainShadow: shadow.body,
    handoff: handoff.body,
    masterInbox: inbox,
    semanticEvidence: semantic.observations,
    marketData: marketData,
    networkStress: networkStress
  });
  report.readOnly = true;
  report.endpointStatus = {
    domainSnapshot: snapshot.status,
    brainShadow: shadow.status,
    civilizationHandoff: handoff.status
    ,titleStore: titles.status,
    marketQuote: quote.status,
    networkStress: network.status
  };
  report.semanticEvidence = { observed: semantic.observations.length, abstained: semantic.abstentions.length };
  report.marketData = marketData ? { asOf: marketData.asOf, quotes: marketData.quotes.length, missing: marketData.missing } : null;
  report.networkEvidence = networkStress ? { asOf: networkStress.asOf, slug: networkStress.slug, value: networkStress.value, rank: networkStress.rank } : null;
  report.note = 'No model, broker, order, Redis write, cron trigger, or live endpoint was called by this audit.';
  console.log(JSON.stringify(report, null, 2));
})().catch(function (err) {
  console.error(JSON.stringify({ ok: false, error: String(err && err.message || err) }, null, 2));
  process.exitCode = 1;
});
