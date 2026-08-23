#!/usr/bin/env node
'use strict';

/*
 * Job 6 rehearsal seam. This is intentionally a deterministic, read-only
 * simulation. It never fetches, calls a provider, writes Redis, spends money,
 * places an order, posts, emails, or changes a domain binder.
 */

const BR = require('../brain-v2/core/sandbox-motor-bridge.js');

const DOMAINS = [
  'economy','energy','environment','health','technology','research','supplyChain',
  'governance','infrastructure','agriculture','industry','education','communication',
  'culture','defense','religion','population','law','finance','intelligence'
];
const INVESTMENT = new Set(['finance','economy','technology','energy','infrastructure']);
const RESEARCH = new Set(['research','health','medicine','science','education','population','environment']);
const DAYS = 30;
const DAY = 86400000;
const START = 1798156800000; // deterministic 2027-01-01 UTC rehearsal origin

function Store() { this.records = []; }
Store.prototype.append = function (r) { this.records.push(JSON.parse(JSON.stringify(r))); };
Store.prototype.read = function () { return this.records.slice(); };

function laneFor(domain) {
  return INVESTMENT.has(domain) ? 'investments' : RESEARCH.has(domain) ? 'research-papers' : null;
}

function handoff(domain, lane, day) {
  return {
    schemaVersion: 'civilization-handoff/1.0',
    opportunityId: 'sandbox-' + domain + '-' + day,
    lane: lane,
    sourceDomains: [domain],
    sourceDiagnoses: [{ domain: domain, id: 'DX_' + domain.toUpperCase(), summary: 'sandbox-only fixture' }],
    sourceTreatments: [{ domain: domain, treatment: { id: 'TX_' + domain.toUpperCase() } }],
    motorClaim: { variable: 'sandbox:' + lane + ':delta', magnitude: 1 }
  };
}

const store = new Store();
const bridge = BR.create({ store: store, trustN: 8 });
const rows = [];
for (let day = 0; day < DAYS; day++) {
  for (const domain of DOMAINS) {
    const lane = laneFor(domain);
    if (!lane) {
      rows.push({ day, domain, lane: null, status: 'ABSTAIN_NO_ACTIVE_LANE_AFFINITY' });
      continue;
    }
    const at = START + day * DAY;
    const cmd = BR.submit(bridge, handoff(domain, lane, day), at);
    const result = BR.complete(bridge, cmd.commandId, {
      outcomeId: 'sandbox-result-' + domain + '-' + day,
      sourceType: 'sandbox-counterfactual',
      independentOf: 'originating-domain-observation',
      observedDelta: ((day % 5) - 2) * 0.1,
      observedAt: at + 3600000
    }, at + 3600000);
    rows.push({ day, domain, lane, commandId: cmd.commandId, status: 'SIMULATED_COMPLETED', trustedReafference: result.outcome.reafference.trusted });
  }
}

const report = BR.report(bridge);
const routed = rows.filter((r) => r.lane);
const abstained = rows.filter((r) => !r.lane);
const trusted = routed.filter((r) => r.trustedReafference).length;
const laneCounts = routed.reduce((m, r) => { m[r.lane] = (m[r.lane] || 0) + 1; return m; }, {});
const output = {
  simulationOnly: true,
  days: DAYS,
  domains: DOMAINS.length,
  routed: routed.length,
  abstained: abstained.length,
  commandsPersisted: report.commands,
  outcomesPersisted: report.outcomes,
  pending: report.pending,
  trustedReafferenceCount: trusted,
  laneCounts,
  simulatedSpendUsd: 0,
  outwardActionsExecuted: 0,
  nonActiveLanes: ['publication','social','subscriber-email','crm','real-estate','auction','homestead','broker/order'],
  blockers: [],
  storeRecords: store.records.length,
  forwardModel: report.forwardModel
};
console.log(JSON.stringify(output, null, 2));
if (output.routed !== 300 || output.abstained !== 300 || output.commandsPersisted !== 300 ||
    output.outcomesPersisted !== 300 || output.pending !== 0 || output.trustedReafferenceCount === 0 ||
    output.simulatedSpendUsd !== 0 || output.outwardActionsExecuted !== 0) process.exitCode = 1;
