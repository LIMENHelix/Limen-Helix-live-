'use strict';

/**
 * Server-built orientation packet for one sovereign product-domain Governor.
 *
 * This is afferent/context assembly only. It never selects an action, grants
 * motor authority, writes state, calls a model, or invokes an external adapter.
 * The domain's existing B10 decision and B14 motor paths remain authoritative.
 */

var crypto = require('node:crypto');
var Briefing = require('./master-briefing-packet.js');
var BrainAudit = require('./product-domain-brain-audit.js');
var BusinessAudit = require('./product-domain-business-executor-audit.js');
var ValveRegistry = require('./civilization-valve-registry.js');
var MotorReceipt = require('./product-domain-motor-receipt.js');
var MotorCapability = require('./product-domain-motor-capability.js');
var Treasury = require('./civilization-treasury-ledger.js');
var Names = require('./domain-names.js');
var PhaseSpec = require('./phase-spec.js');
var PhaseMap = require('./phase-map.js');

var SCHEMA = 'domain-governor-briefing/1.0';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonical(value) {
  return Names.toCanonical(String(value || '')).toLowerCase();
}

function findDomain(rows, key, value) {
  return (rows || []).find(function (row) { return row && row[key] === value; }) || null;
}

function cognitionFresh(row, now) {
  var observed = Date.parse(row && row.cognition && row.cognition.observedAt);
  return Number.isFinite(observed) && now >= observed && now - observed <= MAX_COGNITION_AGE_MS &&
    row.cognition.stale !== true;
}

function domainLines(domain, env) {
  return ValveRegistry.LINES.filter(function (line) {
    return line.productDomain === domain;
  }).map(function (line) {
    return {
      id: line.id,
      ownerDomain: line.ownerDomain,
      lane: line.lane,
      source: line.source,
      destination: line.destination,
      actionRoute: line.actionRoute,
      observerRoute: line.observerRoute,
      recoveryRoute: line.recoveryRoute,
      hardGate: ValveRegistry.hardGateState(line, env)
    };
  });
}

function phaseRegistry(domain) {
  var mapped = PhaseMap.MAP[domain] || { source: null, phases: {} };
  return {
    source: mapped.source || null,
    phases: PhaseSpec.PHASES.map(function (phase) {
      var earned = mapped.phases && mapped.phases[phase.code.toLowerCase()] || null;
      return {
        code: phase.code,
        title: phase.title,
        state: phase.state,
        earned: !!earned,
        signal: earned && earned.signal || null,
        field: earned && earned.field || null,
        evidence: earned && earned.evidence || null,
        verified: !!(earned && earned.verified),
        absentReason: earned ? null : 'domain-source-does-not-currently-express-this-phase'
      };
    })
  };
}

function sourceFiles(binding) {
  var fields = ['executor', 'receipt', 'switchBudget', 'observer', 'rollback'];
  var out = {};
  fields.forEach(function (field) {
    var seen = Object.create(null);
    out[field] = [];
    (binding && binding[field] || []).forEach(function (claim) {
      if (claim && claim.file && !seen[claim.file]) {
        seen[claim.file] = true;
        out[field].push(claim.file);
      }
    });
  });
  return out;
}

async function runtimeEvidence(domain, store, now) {
  if (!store || typeof store.get !== 'function' || typeof store.assertDurable !== 'function') {
    return { status: 'UNOBSERVED', reason: 'strict-durable-store-not-supplied' };
  }
  try {
    store.assertDurable();
    var receipt = await store.get(MotorReceipt.receiptKey(domain));
    if (!receipt) return { status: 'UNOBSERVED', reason: 'domain-motor-receipt-missing' };
    var capability = await MotorCapability.verifyPair(store, receipt, now);
    return {
      status: 'OBSERVED',
      receiptId: receipt.receiptId || null,
      receiptStatus: receipt.status || null,
      ownerDomain: receipt.ownerDomain || null,
      lane: receipt.lane || null,
      persistedAt: receipt.persistedAt || null,
      externalDispatchRequested: !!(receipt.gates && receipt.gates.mayDispatchExternal),
      productionCapability: capability.ok === true
        ? { verified: true, executorCapabilityId: capability.executorCapabilityId,
          observerCapabilityId: capability.observerCapabilityId }
        : { verified: false, reason: capability.reason || 'capability-unverified' }
    };
  } catch (error) {
    return { status: 'UNOBSERVED', reason: 'runtime-evidence-unavailable', detail: String(error && error.message || error) };
  }
}

async function economics(domain, store) {
  if (!store || typeof store.get !== 'function' || typeof store.assertDurable !== 'function') {
    return { status: 'UNOBSERVED', reason: 'strict-durable-store-not-supplied' };
  }
  try {
    store.assertDurable();
    var projection = await Treasury.project(store, 200);
    var account = (projection.accounts || []).find(function (row) { return row.productDomain === domain; }) || null;
    return account ? { status: 'OBSERVED', account: account } : { status: 'UNOBSERVED', reason: 'domain-account-not-yet-observed' };
  } catch (error) {
    return { status: 'UNOBSERVED', reason: 'treasury-unavailable', detail: String(error && error.message || error) };
  }
}

async function collaborationInbox(domain, store, now) {
  if (!store || typeof store.get !== 'function' || typeof store.assertDurable !== 'function') {
    return { status: 'UNOBSERVED', reason: 'strict-durable-store-not-supplied', requests: [] };
  }
  try {
    var result = await require('./domain-collaboration-request.js').inbox(store, domain, now);
    if (!result.ok) return { status: 'UNOBSERVED', reason: result.reason, requests: [] };
    return { status: 'OBSERVED', requests: result.requests };
  } catch (error) {
    return { status: 'UNOBSERVED', reason: 'domain-collaboration-inbox-unavailable', detail: String(error && error.message || error), requests: [] };
  }
}

async function build(domain, options) {
  options = options || {};
  var id = canonical(domain);
  if (Briefing.DOMAINS.indexOf(id) < 0) {
    return { ok: false, reason: 'unknown-product-domain', domainId: id || null };
  }
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  var briefingBuilder = options.briefingBuilder || Briefing.build;
  var civilization = await briefingBuilder({
    db: options.db,
    redisMGet: options.redisMGet,
    clientModels: options.clientModels,
    now: now
  });
  var observed = findDomain(civilization.domains, 'domain', id);
  var brain = findDomain(BrainAudit.audit().domains, 'product', id);
  var businessReport = BusinessAudit.audit();
  var business = findDomain(businessReport.domains, 'productDomain', id);
  if (!observed || !brain || !business) {
    return { ok: false, reason: 'domain-grounding-incomplete', domainId: id };
  }
  var fresh = cognitionFresh(observed, now);
  var lines = domainLines(id, options.env || process.env);
  var binding = BusinessAudit.BINDINGS[brain.runtime] || BusinessAudit.BINDINGS[id] || null;
  var motor = await runtimeEvidence(id, options.store, now);
  var treasury = await economics(id, options.store);
  var inbox = await collaborationInbox(id, options.store, now);
  var blockers = [];
  if (!brain.coreComplete || !brain.identityMatches) blockers.push('domain-brain-code-incomplete');
  if (!business.sourceChainComplete) blockers.push('domain-business-loop-incomplete');
  if (!observed.cognition || observed.cognition.present !== true) blockers.push('domain-cognition-absent');
  else if (!fresh) blockers.push('domain-cognition-stale');
  if (!observed.serverObservation || observed.serverObservation.present !== true) blockers.push('domain-server-observation-absent');
  if (civilization.readErrors && civilization.readErrors.length) blockers.push('server-grounding-read-error');

  var packet = {
    schemaVersion: SCHEMA,
    domainId: id,
    runtimeDomainId: brain.runtime,
    generatedAt: new Date(now).toISOString(),
    sourcePacketId: civilization.packetId,
    sourceAuthority: civilization.authority,
    structuralBrain: {
      file: brain.file,
      bytes: brain.bytes,
      coreComplete: brain.coreComplete,
      identityMatches: brain.identityMatches,
      parts: brain.parts,
      resourceAuthority: brain.resourceAuthority,
      motorAuthority: brain.motorAuthority
    },
    p0p10: phaseRegistry(id),
    afferentState: {
      serverObservation: observed.serverObservation,
      cognition: observed.cognition,
      currentNewsFirst: observed.investmentNewsReview,
      phaseContext: observed.phaseContext,
      opportunities: observed.opportunities,
      clientProjection: observed.clientProjection
    },
    operationalLoop: Object.assign({}, business, { codePaths: sourceFiles(binding) }),
    actuatorLines: lines,
    motorRuntime: motor,
    economics: treasury,
    crossDomain: {
      protocol: 'typed-request-required',
      sharedConsciousness: false,
      foreignBrainMutationAllowed: false,
      inbox: inbox
    },
    readiness: {
      canReason: blockers.length === 0,
      canPropose: blockers.length === 0,
      canDispatchExternal: false,
      dispatchAuthority: 'resolved-only-by-owning-domain-B10-B14-and-provider-gate-at-effect-time',
      blockers: blockers
    },
    truthPolicy: {
      repositoryAndServerStoresAuthoritative: true,
      clientProjectionAdvisoryOnly: true,
      filePresenceIsNotRuntimeProof: true,
      paperEvidenceIsNotProductionCapability: true,
      thing2DecisionAuthority: false,
      modelNarrativeCannotGrantAuthority: true
    }
  };
  packet.packetId = 'dgb_' + hash(packet).slice(0, 24);
  return { ok: true, packet: packet };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_COGNITION_AGE_MS: MAX_COGNITION_AGE_MS,
  build: build,
  canonical: canonical,
  cognitionFresh: cognitionFresh,
  domainLines: domainLines,
  phaseRegistry: phaseRegistry,
  sourceFiles: sourceFiles
};
