'use strict';

/**
 * lib/energy-e2e-cycle.js — one bounded, isolated Energy operating cycle.
 *
 * It connects existing mechanisms rather than inventing a second stack:
 *   - a timestamped Energy observation from the public console snapshot
 *   - the production stress/phase reading, explicitly observe-only
 *   - the existing Energy portal issue/node/treatment topology
 *   - the existing energy.p2 "Your Utility Rate Watch" offer
 *   - an explicitly labelled TEST order and isolated artifact delivery
 *   - the existing civilization treasury ledger for test accounting
 *   - the existing audit ledger for a hash-chained trace
 *   - a separate test-customer outcome, then a durable learning policy that
 *     changes the next proposed decision
 *
 * Boundaries:
 *   - No Stripe charge, email, external delivery, or production write.
 *   - No Thing One company economics and no validated-company claim.
 *   - Thing Two remains observe-only; the phase is latest-only and may be
 *     ungrounded. Missing/stale evidence abstains.
 *   - All money is TEST money. The treasury receipts are accounting-only and
 *     externalEffectExecuted is false.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const treasury = require('./civilization-treasury-ledger');
const audit = require('./audit-ledger');

const SCHEMA = 'energy-e2e-cycle/1.0';
const MAX_OBSERVATION_AGE_SECONDS = 900;
const TEST_ORDER_AUTHORIZATION = 'test-operator';
const TEST_DELIVERY_COST_CENTS = 50;
const AUDIT_STREAM = 'energy-e2e';

const SERVICE = Object.freeze({
  offerId: 'energy.p2',
  priceCents: 400,
  customerClass: 'small commercial battery storage operator',
  relevantEnergyRoles: Object.freeze(['Battery Storage', 'Battery Management — State Assessment']),
  deliverable: 'Utility rate and storage stress brief (test artifact)',
  authority: 'PROPOSED_TEST_ONLY'
});

const TEST_OFFER = Object.freeze({
  id: 'energy.p2',
  name: 'Your Utility Rate Watch',
  line: 'Rate and bill-pressure for the utility or state you name, re-cut as new readings land.',
  cadence: 'monthly, as bills and readings arrive',
  priceCents: 400
});

const TEST_CUSTOMER = Object.freeze({
  mode: 'test',
  customerRef: 'test-customer-energy-001',
  customerClass: 'small commercial battery storage operator',
  customerLabel: 'Test Storage Operator 001',
  utility: 'Test Utility Co',
  region: 'Test Region',
  reading: Object.freeze({
    billUsd: 180,
    kwh: 1200,
    billShock: 0.22,
    ratePressure: 0.18,
    outageCount: 2
  }),
  realCustomer: false,
  pii: false
});

const TEST_OUTCOME = Object.freeze({
  mode: 'test',
  acknowledged: true,
  diagnosticRequested: true,
  source: 'test-customer-receipt',
  evidenceRef: 'test-customer-ack-001',
  actor: 'test-customer'
});

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).filter(function (k) { return value[k] !== undefined; }).sort()
    .map(function (k) { return JSON.stringify(k) + ':' + stable(value[k]); }).join(',') + '}';
}
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function iso(ms) { return new Date(ms).toISOString(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function fail(code, detail) {
  const error = new Error(code);
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  return error;
}

/* ── Isolated stores ─────────────────────────────────────────────────────
   The treasury ledger requires assertDurable/get/set/setIfAbsent/lpush/
   ltrim/lrange. The audit ledger uses lpush/lrange. Nothing here touches
   production Redis. */

function memoryStore() {
  const values = new Map();
  const lists = new Map();
  function list(key) { if (!lists.has(key)) lists.set(key, []); return lists.get(key); }
  return {
    async assertDurable() { return true; },
    async get(key) { return values.has(key) ? clone(values.get(key)) : null; },
    async set(key, value) { values.set(key, clone(value)); return true; },
    async setIfAbsent(key, value) {
      if (values.has(key)) return false;
      values.set(key, clone(value));
      return true;
    },
    async lpush(key, value) { const a = list(key); a.unshift(clone(value)); return a.length; },
    async ltrim(key, start, end) {
      const a = list(key);
      const e = end < 0 ? a.length + end : end;
      lists.set(key, a.slice(start, e + 1));
      return 'OK';
    },
    async lrange(key, start, end) {
      const a = list(key);
      const e = end < 0 ? a.length + end : end;
      return a.slice(start, e + 1).map(clone);
    },
    async keys() { return Array.from(values.keys()); },
    async snapshot() {
      return {
        values: JSON.parse(JSON.stringify(Array.from(values.entries()))),
        lists: JSON.parse(JSON.stringify(Array.from(lists.entries())))
      };
    }
  };
}

function fileStore(dir) {
  const file = path.join(dir, 'store.json');
  let state = { values: {}, lists: {} };
  if (fs.existsSync(file)) {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!state || typeof state !== 'object') state = { values: {}, lists: {} };
    if (!state.values) state.values = {};
    if (!state.lists) state.lists = {};
  }
  function persist() {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(tmp, file);
  }
  function list(key) { if (!state.lists[key]) state.lists[key] = []; return state.lists[key]; }
  return {
    async assertDurable() { return true; },
    async get(key) {
      return Object.prototype.hasOwnProperty.call(state.values, key) ? clone(state.values[key]) : null;
    },
    async set(key, value) { state.values[key] = clone(value); persist(); return true; },
    async setIfAbsent(key, value) {
      if (Object.prototype.hasOwnProperty.call(state.values, key)) return false;
      state.values[key] = clone(value);
      persist();
      return true;
    },
    async lpush(key, value) { const a = list(key); a.unshift(clone(value)); persist(); return a.length; },
    async ltrim(key, start, end) {
      const a = list(key);
      const e = end < 0 ? a.length + end : end;
      state.lists[key] = a.slice(start, e + 1);
      persist();
      return 'OK';
    },
    async lrange(key, start, end) {
      const a = list(key);
      const e = end < 0 ? a.length + end : end;
      return a.slice(start, e + 1).map(clone);
    },
    async keys() { return Object.keys(state.values); },
    async snapshot() { return clone(state); }
  };
}

function createMemoryStore() { return memoryStore(); }
function createFileStore(dir) { return fileStore(dir); }

async function appendAudit(store, type, actor, payload, now) {
  return audit.append(store, AUDIT_STREAM, {
    ts: now, type: type, actor: actor, payload: payload || {}
  });
}

/* ── Observation and portal assessment ─────────────────────────────────── */

function sourceRows(sources) {
  return (Array.isArray(sources) ? sources : [])
    .filter(function (s) { return s && typeof s.name === 'string'; })
    .map(function (s) {
      return { name: s.name, live: s.live === true, channel: s.channel || null };
    });
}

function nodeRecord(nodeId, canonicalNodes, nodeDomains) {
  const node = canonicalNodes && canonicalNodes.nodes && canonicalNodes.nodes[nodeId];
  if (!node) return null;
  const rows = nodeDomains && Array.isArray(nodeDomains[nodeId]) ? nodeDomains[nodeId] : [];
  const energy = rows.find(function (r) { return r && r.domain === 'energy'; }) || null;
  return {
    nodeId: nodeId,
    canonical: true,
    class: node.class || null,
    canBindBusiness: node.canBindBusiness === true,
    role: node.role || null,
    businessFunction: node.businessFunction || null,
    energyRole: energy ? energy.role : null
  };
}

function candidateScore(issue, observation) {
  const stress = observation.stress;
  const maturity = String(observation.maturity || '').toUpperCase();
  const phase = String(observation.phase || '').toLowerCase();
  const top = String(observation.topSignal || '').toLowerCase();
  let score = 0;
  const reasons = [];
  if (issue.id === 'SYSTEMIC_ENERGY_STRESS') {
    if (stress >= 0.5) { score += 2; reasons.push('stress>=0.50'); }
    if (maturity === 'STRUCTURAL') { score += 2; reasons.push('maturity=STRUCTURAL'); }
    if (phase === 'p5' || phase === 'p3') { score += 1; reasons.push('phase=' + phase); }
  }
  if (issue.id === 'OIL_SHOCK') {
    if (stress >= 0.5) { score += 1; reasons.push('stress>=0.50'); }
    if (/oil|strait|chokepoint|hormuz|opec|supply disruption/.test(top)) {
      score += 3; reasons.push('topSignal names a supply disruption');
    }
  }
  if (issue.id === 'GRID_COLLAPSE') {
    if (/grid|transmission|blackout|nerc|ferc/.test(top)) {
      score += 3; reasons.push('topSignal names a grid condition');
    }
  }
  if (issue.id === 'NUCLEAR_INCIDENT') {
    if (/nuclear|radiation|reactor|meltdown/.test(top)) {
      score += 4; reasons.push('topSignal names a nuclear condition');
    }
    if (stress >= 0.5) { score += 1; reasons.push('stress>=0.50'); }
  }
  if (issue.id === 'RENEWABLE_INTERMITTENCY') {
    if (/renewable|solar|wind|intermittency/.test(top)) {
      score += 3; reasons.push('topSignal names renewable intermittency');
    }
  }
  if (issue.id === 'PIPELINE_DISRUPTION') {
    if (/pipeline|pipeline rupture|pipeline disruption/.test(top)) {
      score += 3; reasons.push('topSignal names a pipeline condition');
    }
  }
  return { score: score, reasons: reasons };
}

function assessObservation(snapshot, now, domain, canonicalNodes, nodeDomains, service, offer) {
  service = service || SERVICE;
  offer = offer || TEST_OFFER;
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  const energy = snapshot && snapshot.domains && snapshot.domains.energy;
  if (!energy || typeof energy !== 'object') {
    return { status: 'ABSTAINED', abstention: { abstained: true, reasons: ['no_energy_observation'] }, observation: null };
  }
  const generatedMs = typeof snapshot.generatedAt === 'number'
    ? snapshot.generatedAt : Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedMs)) {
    return { status: 'ABSTAINED', abstention: { abstained: true, reasons: ['snapshot_generated_at_missing'] }, observation: null };
  }
  const computedAge = Math.max(0, Math.round((nowMs - generatedMs) / 1000));
  const reportedAge = typeof snapshot._ageSeconds === 'number' ? snapshot._ageSeconds : null;
  const ageSeconds = reportedAge === null ? computedAge : Math.max(computedAge, reportedAge);
  const sources = sourceRows(energy.sources);
  const reasons = [];
  if (typeof energy.stress !== 'number' || !Number.isFinite(energy.stress) || energy.stress < 0 || energy.stress > 1) reasons.push('stress_missing_or_malformed');
  if (typeof energy.phase !== 'string' || !/^p\d+[ab]?$/i.test(energy.phase)) reasons.push('phase_missing_or_malformed');
  if (typeof energy.topSignal !== 'string' || !energy.topSignal.trim()) reasons.push('top_signal_missing');
  if (!sources.length) reasons.push('sources_missing');
  if (ageSeconds > MAX_OBSERVATION_AGE_SECONDS) reasons.push('observation_too_old_for_a_proposal');
  const prov = snapshot._capture || {};
  const observation = {
    sourceEndpoint: typeof prov.endpoint === 'string' ? prov.endpoint : null,
    capturedAt: prov.capturedAt || null,
    generatedAt: iso(generatedMs),
    ageSeconds: ageSeconds,
    computedAgeSeconds: computedAge,
    reportedAgeSeconds: reportedAge,
    stress: energy.stress,
    maturity: energy.maturity || null,
    phase: energy.phase,
    phaseLabel: energy.phaseLabel || null,
    confidence: typeof energy.confidence === 'number' ? energy.confidence : null,
    sourceQuality: energy._confidence && typeof energy._confidence.sourceQuality === 'number' ? energy._confidence.sourceQuality : null,
    corroboration: energy._confidence && typeof energy._confidence.corroboration === 'number' ? energy._confidence.corroboration : null,
    specificity: energy._confidence && typeof energy._confidence.specificity === 'number' ? energy._confidence.specificity : null,
    recency: energy._confidence && typeof energy._confidence.recency === 'number' ? energy._confidence.recency : null,
    liveSourceCount: sources.filter(function (s) { return s.live; }).length,
    sourceCount: sources.length,
    topSignal: energy.topSignal,
    sources: sources,
    observationSha256: sha256(stable({ generatedAt: generatedMs, energy: energy })),
    inputSha256: prov.sha256 || null
  };
  if (reasons.length) {
    return { status: 'ABSTAINED', abstention: { abstained: true, reasons: reasons }, observation: observation };
  }

  const thingTwo = {
    phase: energy.phase,
    phaseLabel: energy.phaseLabel || null,
    phaseSource: energy.phaseSource || null,
    grounded: energy.phaseGrounded === true,
    precision: typeof energy.phasePrecision === 'number' ? energy.phasePrecision : null,
    temporalEvidence: 'LATEST_ONLY',
    seriesAvailable: false,
    authority: 'OBSERVE_ONLY_NOT_A_COMPANY_VERDICT',
    abstentionReasons: [
      'phase_is_a_feed_heuristic_not_a_validated_temporal_claim',
      'thing_two_never_confers_thing_one_validation',
      'no_phase_time_series'
    ]
  };

  const issues = Array.isArray(domain && domain.issues) ? domain.issues : [];
  const candidates = issues.map(function (issue) {
    const scored = candidateScore(issue, observation);
    const nodeId = issue.resolved && issue.resolved.nodeId ? issue.resolved.nodeId : null;
    const node = nodeId ? nodeRecord(nodeId, canonicalNodes, nodeDomains) : null;
    const activation = (domain.activations || []).find(function (a) { return a && a.brainNodeId === nodeId; }) || null;
    const treatments = activation && Array.isArray(activation.treatments) ? activation.treatments : [];
    let rejectReason = null;
    if (!nodeId) rejectReason = 'no_resolved_circuit_node';
    else if (!node) rejectReason = 'resolved_node_not_canonical';
    else if (!node.canBindBusiness) rejectReason = 'resolved_node_not_business_bindable';
    else if (service.relevantEnergyRoles.indexOf(node.energyRole) < 0) rejectReason = 'not_relevant_to_service_asset';
    else if (!activation) rejectReason = 'resolved_node_not_in_energy_activations';
    else if (!treatments.length) rejectReason = 'no_portal_treatment';
    return {
      id: issue.id,
      label: issue.label,
      summary: issue.summary || '',
      score: scored.score,
      reasons: scored.reasons,
      issue: issue,
      nodeId: nodeId,
      node: node,
      activation: activation,
      treatments: treatments,
      disqualified: !!rejectReason,
      rejectReason: rejectReason
    };
  });

  candidates.sort(function (a, b) {
    if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return String(a.id).localeCompare(String(b.id));
  });
  const selected = candidates.find(function (c) { return !c.disqualified && c.score > 0; });
  if (!selected) {
    return {
      status: 'ABSTAINED',
      abstention: { abstained: true, reasons: ['no_supported_issue_for_current_state'] },
      observation: observation,
      thingTwo: thingTwo,
      alternatives: candidates.map(function (c) {
        return { id: c.id, score: c.score, reasons: c.reasons, rejected: c.rejectReason || 'no_supporting_signal' };
      })
    };
  }

  const primary = selected.treatments[0];
  const treatment = {
    selected: {
      label: primary.label,
      type: primary.type || null,
      description: primary.description || null,
      evidence: primary.evidence || null,
      node: selected.nodeId,
      canonicalBindable: selected.node.canBindBusiness
    },
    supporting: selected.treatments.slice(1).map(function (t) {
      return { label: t.label, type: t.type || null, description: t.description || null, evidence: t.evidence || null };
    }),
    authority: primary.evidence === 'Strong' ? 'PORTAL_EVIDENCE_STRONG' : 'PORTAL_EVIDENCE_UNRATED',
    notACompanyVerdict: true
  };

  return {
    status: 'ASSESSED',
    observation: observation,
    thingTwo: thingTwo,
    issue: {
      id: selected.id,
      label: selected.label,
      summary: selected.summary,
      score: selected.score,
      selectionEvidence: selected.reasons,
      inference: true,
      authority: 'MODEL_INFERENCE_FROM_OBSERVED_STATE',
      alternatives: candidates.filter(function (c) { return c.id !== selected.id; }).map(function (c) {
        return { id: c.id, score: c.score, reasons: c.reasons, rejected: c.rejectReason || 'lower_selection_score' };
      }),
      serviceRelevance: 'constrained_to_' + service.customerClass
    },
    node: selected.node,
    treatment: treatment,
    service: {
      offerId: service.offerId,
      name: offer.name || TEST_OFFER.name,
      line: offer.line || TEST_OFFER.line,
      cadence: offer.cadence || TEST_OFFER.cadence,
      priceCents: service.priceCents,
      customerClass: service.customerClass,
      deliverable: service.deliverable,
      authority: service.authority,
      realOutreachAuthorized: false
    },
    actionStates: {
      observedFact: true,
      modelInference: true,
      portalEvidence: true,
      testOrder: false,
      fulfilled: false,
      measuredOutcome: false,
      learningApplied: false
    }
  };
}

/* ── Deliverable ────────────────────────────────────────────────────────── */

function buildDeliverable(assessment, customer, order, now) {
  const o = assessment.observation;
  const t = assessment.thingTwo;
  const issue = assessment.issue;
  const node = assessment.node;
  const treatment = assessment.treatment;
  const reading = customer.reading || {};
  const rateCents = reading.kwh > 0 ? Math.round((reading.billUsd / reading.kwh) * 1000) / 10 : null;
  const lines = [];
  lines.push('# Energy Watch: Utility Rate and Storage Stress Brief (TEST)');
  lines.push('');
  lines.push('**Status:** isolated TEST artifact for ' + customer.customerRef + '. Not a real customer delivery. No real revenue.');
  lines.push('');
  lines.push('## Observed Energy state');
  lines.push('- Snapshot generated: ' + o.generatedAt + ' (age ' + o.ageSeconds + 's)');
  lines.push('- Stress: ' + o.stress + ', maturity: ' + (o.maturity || 'unknown') + ', confidence: ' + (o.confidence == null ? 'unknown' : o.confidence));
  lines.push('- Phase: ' + o.phase + (o.phaseLabel ? ' ' + o.phaseLabel : '') + ' (' + (t.phaseSource || 'unknown source') + ', observe-only)');
  lines.push('- Sources live: ' + o.liveSourceCount + '/' + o.sourceCount + '; top signal: ' + o.topSignal);
  lines.push('- Observation hash: `' + o.observationSha256 + '`');
  if (o.sourceEndpoint) lines.push('- Source: ' + o.sourceEndpoint);
  lines.push('');
  lines.push('## Thing Two interpretation');
  lines.push('- ' + (t.grounded ? 'Grounded' : 'Ungrounded/latest-only') + '. Temporal evidence is not a persisted series.');
  lines.push('- This is stress context. It is not a company verdict and does not confer Thing One validation.');
  lines.push('');
  lines.push('## Test customer reading');
  lines.push('- Customer: ' + (customer.customerLabel || customer.customerRef) + ' (' + customer.customerClass + ', TEST)');
  lines.push('- Utility/region: ' + (customer.utility || 'not supplied') + ' / ' + (customer.region || 'not supplied'));
  lines.push('- Bill: $' + Number(reading.billUsd || 0).toFixed(2) + ' for ' + Number(reading.kwh || 0) + ' kWh' + (rateCents == null ? '' : ' (effective ' + rateCents + ' ¢/kWh)'));
  lines.push('- Bill shock: ' + (reading.billShock == null ? 'not supplied' : reading.billShock) + '; rate pressure: ' + (reading.ratePressure == null ? 'not supplied' : reading.ratePressure) + '; outages: ' + (reading.outageCount == null ? 'not supplied' : reading.outageCount));
  lines.push('');
  lines.push('## Portal-backed response');
  lines.push('- Inferred issue: **' + issue.label + '** (score ' + issue.score + '). This is a model inference, not a validated diagnosis.');
  lines.push('- Activated node: **' + node.nodeId + '** (' + (node.energyRole || node.role) + '), canonical=' + node.canonical + ', business-bindable=' + node.canBindBusiness + '.');
  lines.push('- Primary treatment evidence: **' + treatment.selected.label + '** (' + (treatment.selected.type || 'type not supplied') + ', ' + (treatment.selected.evidence || 'evidence not supplied') + ').');
  if (treatment.supporting.length) {
    lines.push('- Supporting: ' + treatment.supporting.map(function (x) { return x.label + ' (' + (x.evidence || 'unrated') + ')'; }).join('; ') + '.');
  }
  lines.push('- Portal evidence is not a prescription. No treatment was applied.');
  lines.push('');
  lines.push('## Test order and boundaries');
  lines.push('- Order: ' + order.orderId + '; offer: ' + order.offerId + '; amount: ' + order.amountCents + ' cents TEST. Delivery receipt is recorded separately.');
  lines.push('- No Stripe charge, invoice, email, customer contact, or production write.');
  lines.push('- Any next action is proposed only and requires owner authorization.');
  lines.push('');
  lines.push('## Provenance');
  lines.push('- Source snapshot hash: `' + o.observationSha256 + '`');
  if (o.inputSha256) lines.push('- Captured input file hash: `' + o.inputSha256 + '`');
  lines.push('- Cycle generated: ' + iso(now));
  lines.push('');
  const markdown = lines.join('\n');
  return {
    title: 'Energy Watch: Utility Rate and Storage Stress Brief (TEST)',
    markdown: markdown,
    contentHash: sha256(markdown)
  };
}

/* ── Test order, fulfillment, accounting, outcome, learning ─────────────── */

async function createTestOrder(store, input, now) {
  input = input || {};
  if (input.mode !== 'test') throw fail('TEST_ORDER_MODE_REQUIRED');
  if (input.authorization !== TEST_ORDER_AUTHORIZATION) throw fail('TEST_ORDER_NOT_AUTHORIZED');
  const customerRef = String(input.customerRef || '');
  if (!customerRef) throw fail('TEST_ORDER_CUSTOMER_REQUIRED');
  const offer = input.offer || TEST_OFFER;
  if (offer.id !== SERVICE.offerId || offer.priceCents !== SERVICE.priceCents) {
    throw fail('SERVICE_OFFER_MISMATCH', { offerId: offer.id, priceCents: offer.priceCents });
  }
  const idempotencyKey = input.idempotencyKey || ('energy-e2e:' + customerRef + ':' + offer.id);
  const existingId = await store.get('e2e:order_idem:' + idempotencyKey);
  if (existingId) {
    const existing = await store.get('e2e:order:' + existingId);
    return { ok: true, duplicate: true, order: existing };
  }
  const orderId = 'ord_test_' + sha256(idempotencyKey + ':' + now).slice(0, 16);
  const order = {
    orderId: orderId,
    mode: 'test',
    liveMoney: false,
    realRevenue: false,
    status: 'CREATED',
    customerRef: customerRef,
    offerId: offer.id,
    offerName: offer.name,
    amountCents: offer.priceCents,
    currency: 'usd',
    createdAt: iso(now),
    idempotencyKey: idempotencyKey,
    authorization: TEST_ORDER_AUTHORIZATION,
    externalEffectExecuted: false
  };
  const claimed = await store.setIfAbsent('e2e:order_idem:' + idempotencyKey, orderId);
  if (!claimed) {
    const winner = await store.get('e2e:order_idem:' + idempotencyKey);
    const existing = await store.get('e2e:order:' + winner);
    return { ok: true, duplicate: true, order: existing };
  }
  await store.set('e2e:order:' + orderId, order);
  await appendAudit(store, 'TEST_ORDER_CREATED', 'energy-e2e-test-operator', {
    orderId: orderId, customerRef: customerRef, offerId: offer.id, amountCents: offer.priceCents, mode: 'test'
  }, now);
  return { ok: true, duplicate: false, order: order };
}

async function fulfillOrder(store, orderId, assessment, customer, now) {
  const order = await store.get('e2e:order:' + orderId);
  if (!order) throw fail('ORDER_NOT_FOUND');
  if (order.status === 'REFUNDED') throw fail('ORDER_REFUNDED');
  if (order.customerRef !== customer.customerRef) throw fail('CUSTOMER_MISMATCH');
  const existingReceipt = await store.get('e2e:receipt:' + orderId);
  if (existingReceipt && order.status === 'FULFILLED') {
    const existingDeliverable = await store.get('e2e:deliverable:' + orderId);
    return { ok: true, duplicate: true, receipt: existingReceipt, order: order, deliverable: existingDeliverable };
  }
  if (order.status === 'CREATED') {
    await store.set('e2e:order:' + orderId, Object.assign({}, order, { status: 'FULFILLING', fulfillingAt: iso(now) }));
    await appendAudit(store, 'TEST_FULFILLMENT_STARTED', 'energy-e2e-test-operator', { orderId: orderId }, now);
  }
  const current = await store.get('e2e:order:' + orderId);
  const deliverable = buildDeliverable(assessment, customer, current, now);
  await store.set('e2e:deliverable:' + orderId, {
    orderId: orderId, title: deliverable.title, markdown: deliverable.markdown,
    contentHash: deliverable.contentHash, generatedAt: iso(now), mode: 'test'
  });
  const receipt = existingReceipt || {
    receiptId: 'del_test_' + sha256(orderId + ':' + deliverable.contentHash).slice(0, 16),
    orderId: orderId,
    customerRef: customer.customerRef,
    contentHash: deliverable.contentHash,
    deliveredAt: iso(now),
    channel: 'isolated-test-artifact',
    delivered: true,
    realExternalDelivery: false,
    mode: 'test'
  };
  await store.set('e2e:receipt:' + orderId, receipt);
  const fulfilled = Object.assign({}, current, {
    status: 'FULFILLED',
    fulfilledAt: receipt.deliveredAt,
    deliverableHash: deliverable.contentHash,
    receiptId: receipt.receiptId
  });
  await store.set('e2e:order:' + orderId, fulfilled);
  await appendAudit(store, 'TEST_DELIVERABLE_FULFILLED', 'energy-e2e-test-operator', {
    orderId: orderId, receiptId: receipt.receiptId, contentHash: deliverable.contentHash,
    channel: receipt.channel, realExternalDelivery: false
  }, now);
  return { ok: true, duplicate: false, receipt: receipt, order: fulfilled, deliverable: deliverable };
}

async function recordAccounting(store, orderId, now) {
  const order = await store.get('e2e:order:' + orderId);
  if (!order) throw fail('ORDER_NOT_FOUND');
  if (order.status !== 'FULFILLED') throw fail('ORDER_NOT_FULFILLED');
  const captured = await treasury.post(store, treasury.saleCaptured(
    'energy', order.amountCents,
    'energy-e2e:' + orderId + ':sale-captured',
    'test_order:' + orderId
  ), now);
  const settled = await treasury.post(store, treasury.saleSettled(
    'energy',
    { grossCents: order.amountCents, feeCents: 0, statutoryTaxCents: 0, levyCents: 0, netCents: order.amountCents },
    'energy-e2e:' + orderId + ':sale-settled',
    'test_settlement:' + orderId,
    null
  ), now);
  const cost = await treasury.post(store, treasury.expense(
    'energy', TEST_DELIVERY_COST_CENTS,
    'energy-e2e:' + orderId + ':delivery-cost',
    'test_delivery_cost:' + orderId
  ), now);
  const projection = await treasury.project(store);
  const energyAccount = (projection.accounts || []).find(function (a) { return a.productDomain === 'energy'; }) || null;
  await store.set('e2e:order:' + orderId, Object.assign({}, order, {
    accountedAt: iso(now),
    accountingReceiptIds: [captured.receipt.receiptId, settled.receipt.receiptId, cost.receipt.receiptId]
  }));
  await appendAudit(store, 'TEST_ACCOUNTING_POSTED', 'energy-e2e-test-operator', {
    orderId: orderId,
    receipts: [captured.receipt.receiptId, settled.receipt.receiptId, cost.receipt.receiptId],
    testRevenueCents: order.amountCents,
    testCostCents: TEST_DELIVERY_COST_CENTS,
    realRevenueCents: 0,
    accountingOnly: true
  }, now);
  return {
    receipts: [captured.receipt, settled.receipt, cost.receipt],
    duplicates: [captured.duplicate, settled.duplicate, cost.duplicate],
    projection: projection,
    energyAccount: energyAccount,
    testRevenueCents: order.amountCents,
    testCostCents: TEST_DELIVERY_COST_CENTS,
    testContributionCents: order.amountCents - TEST_DELIVERY_COST_CENTS,
    realRevenueCents: 0,
    mode: 'test',
    liveMoney: false,
    accountingOnly: true,
    externalEffectExecuted: false
  };
}

async function recordOutcome(store, orderId, outcome, now) {
  outcome = outcome || {};
  const order = await store.get('e2e:order:' + orderId);
  if (!order) throw fail('ORDER_NOT_FOUND');
  if (order.status !== 'FULFILLED') throw fail('ORDER_NOT_FULFILLED');
  const receipt = await store.get('e2e:receipt:' + orderId);
  if (!receipt) throw fail('DELIVERY_RECEIPT_REQUIRED');
  if (outcome.mode !== 'test') throw fail('TEST_OUTCOME_MODE_REQUIRED');
  if (outcome.acknowledged !== true) throw fail('OUTCOME_ACKNOWLEDGEMENT_REQUIRED');
  if (!outcome.evidenceRef) throw fail('OUTCOME_EVIDENCE_REQUIRED');
  const outcomeId = 'out_test_' + sha256(orderId + ':' + outcome.evidenceRef).slice(0, 16);
  const existing = await store.get('e2e:outcome:' + orderId);
  if (existing) {
    if (existing.outcomeId !== outcomeId) throw fail('OUTCOME_CONFLICT');
    return { ok: true, duplicate: true, outcome: existing };
  }
  const record = {
    outcomeId: outcomeId,
    orderId: orderId,
    customerRef: order.customerRef,
    acknowledged: true,
    diagnosticRequested: outcome.diagnosticRequested === true,
    source: outcome.source || 'test-customer-receipt',
    evidenceRef: String(outcome.evidenceRef),
    actor: outcome.actor || 'test-customer',
    recordedAt: iso(now),
    independent: true,
    realCustomer: false,
    mode: 'test'
  };
  await store.set('e2e:outcome:' + orderId, record);
  await appendAudit(store, 'TEST_OUTCOME_RECORDED', 'test-customer', {
    orderId: orderId, outcomeId: outcomeId, acknowledged: true,
    diagnosticRequested: record.diagnosticRequested, evidenceRef: record.evidenceRef,
    independent: true, realCustomer: false
  }, now);
  return { ok: true, duplicate: false, outcome: record };
}

async function learn(store, order, outcome, now) {
  const key = 'e2e:learning:' + order.customerRef;
  const existing = await store.get(key);
  if (existing && existing.outcomeId === outcome.outcomeId) {
    return { ok: true, duplicate: true, learning: existing };
  }
  const nextAction = outcome.diagnosticRequested
    ? 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC'
    : 'SEND_UTILITY_RATE_WATCH_FOLLOWUP';
  const learning = {
    learningId: 'learn_test_' + sha256(order.customerRef + ':' + outcome.outcomeId).slice(0, 16),
    customerRef: order.customerRef,
    lastOrderId: order.orderId,
    outcomeId: outcome.outcomeId,
    acknowledged: outcome.acknowledged === true,
    diagnosticRequested: outcome.diagnosticRequested === true,
    nextAction: nextAction,
    reason: outcome.diagnosticRequested
      ? 'prior test outcome acknowledged and requested diagnostics'
      : 'prior test outcome acknowledged without a diagnostic request',
    updatedAt: iso(now),
    mode: 'test',
    authority: 'TEST_LEARNING_ONLY',
    realOutreachAuthorized: false
  };
  await store.set(key, learning);
  await appendAudit(store, 'TEST_LEARNING_UPDATED', 'energy-e2e-test-operator', {
    customerRef: order.customerRef, learningId: learning.learningId,
    outcomeId: outcome.outcomeId, nextAction: nextAction, mode: 'test'
  }, now);
  return { ok: true, duplicate: false, learning: learning };
}

async function decideNext(store, customer, assessment, now) {
  const key = 'e2e:learning:' + customer.customerRef;
  const learning = await store.get(key);
  if (learning && learning.diagnosticRequested === true) {
    return {
      action: 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC',
      reason: 'prior test outcome acknowledged and requested diagnostics',
      authority: 'PROPOSED_TEST_ONLY',
      testAuthorization: TEST_ORDER_AUTHORIZATION,
      realOutreachAuthorized: false,
      learningRef: learning.learningId || key,
      decidedAt: iso(now)
    };
  }
  return {
    action: 'SEND_UTILITY_RATE_WATCH',
    reason: 'no prior test outcome requesting diagnostics',
    authority: 'PROPOSED_TEST_ONLY',
    testAuthorization: TEST_ORDER_AUTHORIZATION,
    realOutreachAuthorized: false,
    learningRef: null,
    decidedAt: iso(now)
  };
}

async function refundTestOrder(store, orderId, now) {
  const order = await store.get('e2e:order:' + orderId);
  if (!order) throw fail('ORDER_NOT_FOUND');
  if (order.status === 'REFUNDED') {
    const existing = await store.get('e2e:refund:' + orderId);
    return { ok: true, duplicate: true, refund: existing, order: order };
  }
  if (order.status === 'FULFILLED') {
    throw fail('REFUND_AFTER_SETTLEMENT_REQUIRES_PARTIAL_POLICY');
  }
  const capture = await treasury.post(store, treasury.saleCaptured(
    'energy', order.amountCents,
    'energy-e2e:' + orderId + ':sale-captured',
    'test_order:' + orderId
  ), now);
  const refund = await treasury.post(store, treasury.refund(
    'energy', 'pending', order.amountCents,
    'energy-e2e:' + orderId + ':refund',
    'test_refund:' + orderId
  ), now);
  const projection = await treasury.project(store);
  const record = {
    refundId: 'ref_test_' + sha256(orderId + ':' + now).slice(0, 16),
    orderId: orderId,
    amountCents: order.amountCents,
    sourceBucket: 'pending',
    refundedAt: iso(now),
    mode: 'test',
    liveMoney: false,
    captureReceiptId: capture.receipt.receiptId,
    refundReceiptId: refund.receipt.receiptId
  };
  await store.set('e2e:refund:' + orderId, record);
  await store.set('e2e:order:' + orderId, Object.assign({}, order, {
    status: 'REFUNDED', refundedAt: record.refundedAt, refundId: record.refundId
  }));
  await appendAudit(store, 'TEST_ORDER_REFUNDED', 'energy-e2e-test-operator', {
    orderId: orderId, refundId: record.refundId, amountCents: order.amountCents, sourceBucket: 'pending', mode: 'test'
  }, now);
  return {
    ok: true, duplicate: false, refund: record, projection: projection,
    captureReceipt: capture.receipt, refundReceipt: refund.receipt
  };
}

async function runCycle(store, input) {
  input = input || {};
  const now = input.now == null ? Date.now() : (typeof input.now === 'number' ? input.now : Date.parse(input.now));
  const service = input.service || SERVICE;
  const offer = input.offer || TEST_OFFER;
  const customer = input.customer || TEST_CUSTOMER;
  const outcome = input.outcome || TEST_OUTCOME;
  const assessment = assessObservation(input.snapshot, now, input.domain, input.canonicalNodes, input.nodeDomains, service, offer);

  if (assessment.status !== 'ASSESSED') {
    const runId = 'e2e_abstain_' + sha256(stable({ now: now, customerRef: customer.customerRef, reasons: assessment.abstention.reasons })).slice(0, 16);
    await appendAudit(store, 'OBSERVATION_ABSTAINED', 'energy-e2e-cycle', {
      runId: runId, reasons: assessment.abstention.reasons, mode: 'test'
    }, now);
    const trace = {
      schemaVersion: SCHEMA,
      runId: runId,
      mode: 'TEST',
      status: 'ABSTAINED',
      generatedAt: iso(now),
      observation: assessment.observation,
      thingTwo: assessment.thingTwo || null,
      abstention: assessment.abstention,
      alternatives: assessment.alternatives || null,
      guarantees: {
        testOnly: true, liveMoney: false, realRevenue: false,
        realExternalDelivery: false, productionWrites: false,
        customerContacted: false, realCredentialsUsed: false
      },
      limitations: [
        'No order, delivery, accounting, outcome or learning was created.',
        'Missing, stale or unsupported evidence abstains.'
      ]
    };
    await store.set('e2e:trace:' + runId, trace);
    return { ok: false, trace: trace };
  }

  const decisionBefore = await decideNext(store, customer, assessment, now);
  const orderResult = await createTestOrder(store, {
    mode: 'test',
    authorization: TEST_ORDER_AUTHORIZATION,
    customerRef: customer.customerRef,
    offer: offer,
    idempotencyKey: input.idempotencyKey
  }, now);
  const fulfillment = await fulfillOrder(store, orderResult.order.orderId, assessment, customer, now);
  const order = await store.get('e2e:order:' + orderResult.order.orderId);
  const accounting = await recordAccounting(store, order.orderId, now);
  const outcomeResult = await recordOutcome(store, order.orderId, outcome, now);
  const learningResult = await learn(store, order, outcomeResult.outcome, now);
  const decisionAfter = await decideNext(store, customer, assessment, now);
  const runId = 'e2e_' + sha256(stable({
    observationSha256: assessment.observation.observationSha256,
    customerRef: customer.customerRef,
    orderId: order.orderId,
    now: now
  })).slice(0, 16);
  await appendAudit(store, 'TEST_CYCLE_COMPLETED', 'energy-e2e-cycle', {
    runId: runId, orderId: order.orderId, issueId: assessment.issue.id,
    nodeId: assessment.node.nodeId, treatment: assessment.treatment.selected.label,
    decisionBefore: decisionBefore.action, decisionAfter: decisionAfter.action,
    testRevenueCents: accounting.testRevenueCents, realRevenueCents: 0
  }, now);
  const auditVerify = await audit.verify(store, AUDIT_STREAM);
  const trace = {
    schemaVersion: SCHEMA,
    runId: runId,
    mode: 'TEST',
    status: 'COMPLETE',
    generatedAt: iso(now),
    observation: assessment.observation,
    thingTwo: assessment.thingTwo,
    issue: assessment.issue,
    node: assessment.node,
    treatment: assessment.treatment,
    service: assessment.service,
    customer: {
      customerRef: customer.customerRef,
      customerClass: customer.customerClass,
      customerLabel: customer.customerLabel || null,
      utility: customer.utility || null,
      region: customer.region || null,
      reading: customer.reading || null,
      realCustomer: false,
      pii: false
    },
    decisions: { before: decisionBefore, after: decisionAfter, changed: decisionBefore.action !== decisionAfter.action },
    order: order,
    fulfillment: {
      receipt: fulfillment.receipt,
      duplicate: fulfillment.duplicate,
      deliverableTitle: fulfillment.deliverable.title,
      deliverableHash: fulfillment.deliverable.contentHash
    },
    accounting: {
      receipts: accounting.receipts.map(function (r) {
        return { receiptId: r.receiptId, kind: r.kind, status: r.status, accountingOnly: r.accountingOnly, externalEffectExecuted: r.externalEffectExecuted };
      }),
      testRevenueCents: accounting.testRevenueCents,
      testCostCents: accounting.testCostCents,
      testContributionCents: accounting.testContributionCents,
      realRevenueCents: 0,
      energyAccount: accounting.energyAccount,
      projection: accounting.projection
    },
    outcome: outcomeResult.outcome,
    learning: learningResult.learning,
    audit: { stream: AUDIT_STREAM, verify: auditVerify },
    actionStates: {
      observedFact: true,
      modelInference: true,
      testOrderCreated: true,
      fulfilled: true,
      accounted: true,
      measuredOutcome: true,
      learningApplied: true,
      nextDecisionChanged: decisionBefore.action !== decisionAfter.action
    },
    guarantees: {
      testOnly: true, liveMoney: false, realRevenue: false,
      realExternalDelivery: false, productionWrites: false,
      customerContacted: false, realCredentialsUsed: false,
      thingOneAuthorityUsed: false
    },
    limitations: [
      'Thing Two phase is latest-only and may be ungrounded; no persisted phase series exists.',
      'The selected issue is a model inference constrained to the service asset, not a validated diagnosis.',
      'The customer, order, delivery, outcome and learning are TEST artifacts. No real customer, money, email or production write exists.',
      'The service is the existing energy.p2 offer; the brief content is generated deterministically from observed and portal data.'
    ]
  };
  await store.set('e2e:trace:' + runId, trace);
  return {
    ok: true,
    trace: trace,
    deliverable: fulfillment.deliverable,
    order: order,
    accounting: accounting,
    outcome: outcomeResult.outcome,
    learning: learningResult.learning,
    decisions: { before: decisionBefore, after: decisionAfter }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  SERVICE: SERVICE,
  TEST_OFFER: TEST_OFFER,
  TEST_CUSTOMER: TEST_CUSTOMER,
  TEST_OUTCOME: TEST_OUTCOME,
  MAX_OBSERVATION_AGE_SECONDS: MAX_OBSERVATION_AGE_SECONDS,
  TEST_ORDER_AUTHORIZATION: TEST_ORDER_AUTHORIZATION,
  AUDIT_STREAM: AUDIT_STREAM,
  createMemoryStore: createMemoryStore,
  createFileStore: createFileStore,
  assessObservation: assessObservation,
  buildDeliverable: buildDeliverable,
  createTestOrder: createTestOrder,
  fulfillOrder: fulfillOrder,
  recordAccounting: recordAccounting,
  recordOutcome: recordOutcome,
  learn: learn,
  decideNext: decideNext,
  refundTestOrder: refundTestOrder,
  runCycle: runCycle
};
