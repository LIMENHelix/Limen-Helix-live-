#!/usr/bin/env node
'use strict';

/** Read-only production-shaped investment sandbox preflight. */

const fs = require('node:fs');
const path = require('node:path');
const Replay = require('../lib/investment-sandbox-replay.js');

const BASE = process.env.PUBLIC_BASE_URL || 'https://limenhelix.com';

async function getJson(url, headers) {
  const response = await fetch(url, { headers: headers || {} });
  let body = null;
  try { body = await response.json(); } catch (_) { body = null; }
  return { status: response.status, body };
}

function readMasterInbox() {
  const file = path.join(__dirname, '..', 'assets', 'data', '_master-inbox.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

(async function main() {
  const token = process.env.BRAIN_SHADOW_TOKEN || '';
  const headers = token ? { 'x-brain-token': token } : {};
  const [snapshot, shadow, handoff] = await Promise.all([
    getJson(BASE + '/api/domain-snapshot'),
    getJson(BASE + '/api/brain-shadow', headers),
    getJson(BASE + '/api/limen-civilization-handoff?limit=100', headers)
  ]);
  const report = Replay.summarize({
    snapshot: snapshot.body,
    brainShadow: shadow.body,
    handoff: handoff.body,
    masterInbox: readMasterInbox()
  });
  report.readOnly = true;
  report.endpointStatus = {
    domainSnapshot: snapshot.status,
    brainShadow: shadow.status,
    civilizationHandoff: handoff.status
  };
  report.note = 'No model, broker, order, Redis write, cron trigger, or live endpoint was called by this audit.';
  console.log(JSON.stringify(report, null, 2));
})().catch(function (err) {
  console.error(JSON.stringify({ ok: false, error: String(err && err.message || err) }, null, 2));
  process.exitCode = 1;
});
