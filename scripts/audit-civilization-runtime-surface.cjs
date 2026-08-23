#!/usr/bin/env node
'use strict';

/*
 * Read-only production surface audit for Job 6. It GETs public endpoints only;
 * it never supplies run=1, POSTs, changes configuration, or invokes a cron.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://limenhelix.com';
const LANES = ['research-papers','investments','publication','social','subscriber-email','automail','autopilot','hero-image','auction','homestead','crm','real-estate','broker/order'];

async function getJson(url, headers) {
  const response = await fetch(url, { headers: headers || {} });
  let body = null;
  try { body = await response.json(); } catch (_) { body = null; }
  return { status: response.status, ok: response.ok, body };
}

function summarize(snapshot, autofire, shadow) {
  const domains = snapshot && snapshot.domains && typeof snapshot.domains === 'object' ? snapshot.domains : {};
  const domainKeys = Object.keys(domains);
  const sources = domainKeys.reduce((n, d) => n + (Array.isArray(domains[d].sources) ? domains[d].sources.length : 0), 0);
  const cycles = autofire && Array.isArray(autofire.cycles) ? autofire.cycles : [];
  const observedResults = cycles.reduce((n, c) => n + (Array.isArray(c.results) ? c.results.length : 0), 0);
  const laneInventory = LANES.map((lane) => {
    const hasResult = cycles.some((c) => Array.isArray(c.results) && c.results.some((r) => r && r.lane === lane));
    if (lane === 'research-papers' || lane === 'investments') {
      return { lane, status: hasResult ? 'live-observed' : 'blocked', reason: hasResult ? 'a public autofire result carried this lane' : 'no eligible result in the bounded public log' };
    }
    return { lane, status: 'not-observable', reason: 'no public result and lane is outside the current research/investment scope' };
  });
  const shadowCycles = shadow && shadow.status === 200 && shadow.body && shadow.body.cycles && typeof shadow.body.cycles === 'object'
    ? Object.values(shadow.body.cycles) : [];
  return {
    readOnly: true,
    generatedAt: new Date().toISOString(),
    endpoints: {
      domainSnapshot: { status: snapshot ? 'available' : 'unavailable', snapshotId: snapshot && snapshot.meta ? snapshot.meta.snapshotId || null : null },
      autofireLog: { status: autofire ? 'available' : 'unavailable', cyclesReturned: cycles.length },
      brainShadow: { status: shadow && shadow.status === 200 ? 'available' : (shadow && shadow.status === 401 ? 'auth-gated' : (shadow ? 'unexpected-' + shadow.status : 'unavailable')) }
    },
    domainSurface: { domains: domainKeys.length, sources, liveCount: snapshot && snapshot.meta ? snapshot.meta.liveCount || null : null, fallbackCount: snapshot && snapshot.meta ? snapshot.meta.fallbackCount || null : null },
    autofire: {
      totalCycles: autofire && typeof autofire.total === 'number' ? autofire.total : null,
      evaluated: cycles.reduce((n, c) => n + (Number(c.evaluated) || 0), 0),
      fired: cycles.reduce((n, c) => n + (Number(c.fired) || 0), 0),
      errors: cycles.reduce((n, c) => n + (Number(c.errors) || 0), 0),
      observedResults,
      budget: autofire && autofire.budget ? { enabled: !!autofire.budget.enabled, armed: !!autofire.budget.armed, spentTodayUsd: autofire.budget.spentTodayUsd, remainingUsd: autofire.budget.remainingUsd } : null
    },
    authenticatedShadow: shadow && shadow.status === 200 ? {
      runtime: shadow.body && shadow.body.runtime || null,
      installedCount: shadow.body && shadow.body.installedCount || null,
      totalDomains: shadow.body && shadow.body.totalDomains || null,
      domainsOk: shadowCycles.filter((c) => c && c.ok === true).length,
      domainsErrored: shadowCycles.filter((c) => c && c.ok === false).length,
      ticks: shadowCycles.reduce((n, c) => n + (Number(c && c.ticks) || 0), 0),
      rowsApplied: shadowCycles.reduce((n, c) => n + (Number(c && c.rowsApplied) || 0), 0),
      restoredCount: shadowCycles.filter((c) => c && c.restored === true).length,
      stateValueBytesTotal: shadow.body && shadow.body.stateValueBytesTotal || null
    } : null,
    laneInventory,
    blockers: laneInventory.filter((l) => l.status === 'blocked' || l.status === 'not-observable').map((l) => l.lane + ':' + l.reason)
  };
}

async function run(outFile) {
  const tokenArg = process.argv.find((a) => a.startsWith('--token-file='));
  let token = null;
  if (tokenArg) {
    const raw = fs.readFileSync(path.resolve(tokenArg.slice('--token-file='.length)), 'utf8');
    const match = raw.match(/^BRAIN_SHADOW_TOKEN=(.*)$/m);
    token = match && match[1] ? match[1].trim() : null;
  }
  const snapshot = await getJson(BASE + '/api/domain-snapshot');
  const autofire = await getJson(BASE + '/api/limen-autofire-log?limit=20');
  const shadow = await getJson(BASE + '/api/brain-shadow', token ? { 'x-brain-token': token } : {});
  const report = summarize(snapshot.ok ? snapshot.body : null, autofire.ok ? autofire.body : null, shadow);
  report.endpointStatuses = { domainSnapshot: snapshot.status, autofireLog: autofire.status, brainShadow: shadow.status };
  if (outFile) fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  const arg = process.argv.find((a) => a.startsWith('--out='));
  run(arg ? arg.slice('--out='.length) : null).catch((err) => { console.error('runtime surface audit failed: ' + err.message); process.exitCode = 1; });
}

module.exports = { summarize, LANES };
