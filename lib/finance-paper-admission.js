'use strict';

/**
 * Durable Finance Preview -> paper-replay admission boundary.
 *
 * A manager receipt may contain a validated PAPER_CANDIDATE, but that receipt
 * deliberately cannot release anything. This module supplies the next separate
 * gate. It can admit the candidate to sandbox paper replay only; it never
 * imports a broker transport and cannot create a trade intent or order.
 */

var Producer = require('./finance-opportunity-producer.js');
var Preview = require('./finance-preview-execution.js');

var SCHEMA = 'finance-paper-admission/1.0';
var LOG_KEY = 'finance_paper_admission_log';
var POLICY_ID = 'finance-paper-policy/1';
var RETENTION_SECONDS = 180 * 24 * 60 * 60;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function admissionKey(packetId) { return 'finance_paper_admission:' + packetId; }

function receiptBlockers(receipt) {
  var blockers = [];
  if (!receipt || receipt.schemaVersion !== Preview.RECEIPT_SCHEMA) blockers.push('finance_preview_receipt_required');
  if (!receipt || receipt.status !== 'PAPER_CANDIDATE') blockers.push('finance_preview_paper_candidate_required');
  if (!receipt || receipt.providerCalled !== true) blockers.push('finance_preview_provider_receipt_required');
  if (!receipt || !receipt.candidate || receipt.candidate.status !== 'PAPER_CANDIDATE') blockers.push('finance_preview_candidate_required');
  if (!receipt || !receipt.candidate || receipt.candidate.simulationOnly !== true || receipt.candidate.liveExecution !== false) {
    blockers.push('finance_candidate_must_be_paper_only');
  }
  var safety = receipt && receipt.safety || {};
  if (safety.candidateReleased !== false || safety.brokerTouched !== false ||
      safety.orderPlaced !== false || safety.liveMoney !== false) {
    blockers.push('finance_preview_safety_boundary_invalid');
  }
  return blockers;
}

async function audit(store, packetId) {
  if (!store || typeof store.get !== 'function' || typeof store.setIfAbsent !== 'function') {
    throw new Error('Finance paper admission requires a durable store');
  }
  store.assertDurable();
  var previewReceipt = text(packetId) ? await store.get(Preview.receiptKey(packetId)) : null;
  var admission = text(packetId) ? await store.get(admissionKey(packetId)) : null;
  var blockers = text(packetId) ? receiptBlockers(previewReceipt) : ['finance_packet_id_required'];
  return {
    schemaVersion: SCHEMA,
    packetId: packetId || null,
    status: admission ? 'ALREADY_ADMITTED' : (blockers.length ? 'ABSTAINED' : 'READY_FOR_PAPER_ADMISSION'),
    blockers: blockers,
    previewReceipt: clone(previewReceipt),
    admission: clone(admission),
    brokerTouched: false,
    orderPlaced: false,
    liveMoney: false
  };
}

async function execute(store, request, options) {
  request = request || {};
  options = options || {};
  var before = await audit(store, request.packetId);
  if (before.admission) return { ok: true, idempotent: true, receipt: before.admission, audit: before };
  if (request.approve !== true) {
    return { ok: false, status: 'ABSTAINED', reason: 'explicit_paper_admission_required', audit: before };
  }
  if (before.status !== 'READY_FOR_PAPER_ADMISSION') {
    return { ok: false, status: 'ABSTAINED', reason: before.blockers[0] || 'finance_paper_admission_not_ready', audit: before };
  }

  var releasedAt = options.now || new Date().toISOString();
  var released = Producer.releaseForPaper(before.previewReceipt.candidate, {
    mode: 'sandbox-paper', policyId: POLICY_ID, releasedAt: releasedAt
  });
  if (!released || released.status !== 'READY_TO_FIRE') {
    return { ok: false, status: 'ABSTAINED', reason: released && released.reason || 'finance_paper_release_refused', audit: before };
  }
  var replayCandidate = Producer.toReplayCandidate(released);
  replayCandidate.sourcePacketId = request.packetId;
  var receipt = {
    schemaVersion: SCHEMA,
    packetId: request.packetId,
    admittedAt: new Date(Date.parse(releasedAt)).toISOString(),
    status: 'ADMITTED_TO_PAPER',
    policy: { id: POLICY_ID, mode: 'sandbox-paper' },
    preview: {
      receiptSchemaVersion: before.previewReceipt.schemaVersion,
      completedAt: before.previewReceipt.completedAt || null,
      providerCalled: true,
      selectedCompany: clone(before.previewReceipt.selectedCompany)
    },
    candidate: released,
    replayCandidate: replayCandidate,
    safety: {
      paperOnly: true,
      candidateReleased: true,
      releasedTo: 'paper-replay',
      brokerTouched: false,
      orderPlaced: false,
      liveMoney: false
    }
  };
  var created = await store.setIfAbsent(admissionKey(request.packetId), receipt, RETENTION_SECONDS);
  if (!created) {
    var existing = await store.get(admissionKey(request.packetId));
    return { ok: true, idempotent: true, receipt: existing, audit: before };
  }
  await store.lpush(LOG_KEY, {
    packetId: receipt.packetId,
    admittedAt: receipt.admittedAt,
    status: receipt.status,
    candidateId: receipt.candidate.id,
    company: clone(receipt.candidate.company)
  });
  await store.ltrim(LOG_KEY, 0, 199);
  return { ok: true, idempotent: false, receipt: receipt, audit: before };
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  POLICY_ID: POLICY_ID,
  RETENTION_SECONDS: RETENTION_SECONDS,
  admissionKey: admissionKey,
  receiptBlockers: receiptBlockers,
  audit: audit,
  execute: execute
};
