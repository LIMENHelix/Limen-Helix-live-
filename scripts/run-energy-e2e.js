#!/usr/bin/env node
'use strict';

/**
 * run-energy-e2e.js — one isolated Energy operating cycle.
 *
 *   node scripts/run-energy-e2e.js --capture --out-dir docs/research/energy-e2e/run-...
 *   node scripts/run-energy-e2e.js --snapshot <captured.json> --out-dir <dir>
 *
 * It fetches at most one PUBLIC console snapshot (no credentials) and writes
 * only under --out-dir. No Stripe, email, customer contact or production write.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const catalog = require('../lib/offer-catalog');
const cycle = require('../lib/energy-e2e-cycle');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENDPOINT = 'https://limenhelix.com/api/limen-snapshot?type=console';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) { return process.argv.indexOf('--' + name) >= 0; }
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

async function captureSnapshot(outDir, endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('snapshot_http_' + response.status);
  const body = await response.json();
  const energy = body.domains && body.domains.energy;
  if (!energy || typeof energy !== 'object') throw new Error('no_energy_observation');
  const retained = {
    generatedAt: body.generatedAt,
    _ageSeconds: body._ageSeconds,
    _stale: body._stale,
    domains: { energy: energy }
  };
  const bytes = JSON.stringify(retained, null, 2) + '\n';
  const inputSha256 = sha256(bytes);
  const captured = Object.assign({}, retained, {
    _capture: {
      endpoint: endpoint,
      method: 'GET',
      capturedAt: new Date().toISOString(),
      sha256: inputSha256,
      retainedProjection: 'generatedAt, _ageSeconds, _stale, domains.energy',
      note: 'Public read-only capture. No credentials. Full all-domain response is not retained.'
    }
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify(captured, null, 2) + '\n');
  return captured;
}

async function main() {
  const outDir = path.resolve(arg('out-dir', path.join(ROOT, 'var', 'energy-e2e', new Date().toISOString().replace(/[:.]/g, '-'))));
  const endpoint = arg('endpoint', DEFAULT_ENDPOINT);
  let snapshot;
  if (flag('capture')) {
    snapshot = await captureSnapshot(outDir, endpoint);
  } else {
    const snapshotPath = arg('snapshot', '');
    if (!snapshotPath) {
      console.error('FATAL: pass --snapshot <file> or --capture');
      process.exit(2);
    }
    snapshot = readJson(snapshotPath);
  }

  const domain = readJson(path.join(ROOT, 'assets/data/domains/energy.json'));
  const canonicalNodes = readJson(path.join(ROOT, 'assets/data/canonical-nodes.json'));
  const nodeDomains = readJson(path.join(ROOT, 'assets/data/brain-node-domains.json'));
  const offer = Object.assign({ id: 'energy.p2' }, catalog.lookup('energy', 'p2'));
  if (!offer || offer.priceCents !== cycle.SERVICE.priceCents) {
    console.error('FATAL: energy.p2 offer missing or price does not match the service');
    process.exit(2);
  }
  const nowArg = arg('now', '');
  const now = nowArg ? Date.parse(nowArg) : Date.now();
  if (!Number.isFinite(now)) {
    console.error('FATAL: --now must be an ISO timestamp');
    process.exit(2);
  }
  const customer = arg('customer', '') ? readJson(arg('customer', '')) : cycle.TEST_CUSTOMER;
  const outcomePath = arg('outcome', '');
  let outcome;
  if (outcomePath) {
    outcome = readJson(outcomePath);
  } else if (flag('synthetic-outcome')) {
    outcome = cycle.TEST_OUTCOME;
  } else {
    console.error('FATAL: pass --outcome <json> or --synthetic-outcome; no outcome is assumed');
    process.exit(2);
  }
  if (customer.mode !== 'test' || outcome.mode !== 'test') {
    console.error('FATAL: this runner accepts TEST customer and TEST outcome only');
    process.exit(2);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'customer.json'), JSON.stringify(customer, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'outcome-input.json'), JSON.stringify(outcome, null, 2) + '\n');
  const store = cycle.createFileStore(outDir);
  const result = await cycle.runCycle(store, {
    snapshot: snapshot,
    now: now,
    domain: domain,
    canonicalNodes: canonicalNodes,
    nodeDomains: nodeDomains,
    offer: offer,
    customer: customer,
    outcome: outcome,
    service: cycle.SERVICE
  });

  fs.writeFileSync(path.join(outDir, 'trace.json'), JSON.stringify(result.trace, null, 2) + '\n');
  if (result.deliverable && result.deliverable.markdown) {
    fs.writeFileSync(path.join(outDir, 'deliverable.md'), result.deliverable.markdown);
  }
  if (result.accounting && result.accounting.projection) {
    fs.writeFileSync(path.join(outDir, 'accounting.json'), JSON.stringify(result.accounting.projection, null, 2) + '\n');
  }
  const summary = {
    runId: result.trace.runId,
    status: result.trace.status,
    mode: result.trace.mode,
    issue: result.trace.issue ? result.trace.issue.id : null,
    node: result.trace.node ? result.trace.node.nodeId : null,
    treatment: result.trace.treatment ? result.trace.treatment.selected.label : null,
    orderId: result.order ? result.order.orderId : null,
    deliveryReceipt: result.trace.fulfillment ? result.trace.fulfillment.receipt.receiptId : null,
    testRevenueCents: result.trace.accounting ? result.trace.accounting.testRevenueCents : 0,
    realRevenueCents: 0,
    decisionBefore: result.decisions ? result.decisions.before.action : null,
    decisionAfter: result.decisions ? result.decisions.after.action : null,
    decisionChanged: result.decisions ? result.decisions.before.action !== result.decisions.after.action : false,
    outcomeMeasured: result.trace.outcome ? result.trace.outcome.measured === true : false,
    outcomeIndependent: result.trace.outcome ? result.trace.outcome.independent === true : false,
    learningAuthority: result.trace.learning ? result.trace.learning.authority : null,
    syntheticOutcome: outcome.provenance === 'synthetic_test_fixture',
    auditOk: result.trace.audit && result.trace.audit.verify ? result.trace.audit.verify.ok : null,
    outputDir: outDir
  };
  console.log(JSON.stringify(summary, null, 2));
  if (result.trace.status !== 'COMPLETE') process.exit(1);
}

main().catch(function (err) {
  console.error('ENERGY-E2E FAILED:', err && err.code ? err.code : (err && err.message) || err);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});
