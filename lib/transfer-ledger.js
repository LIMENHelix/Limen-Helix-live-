/**
 * lib/transfer-ledger.js — records every cross-domain evidence transfer and its later usefulness.
 *
 * The spec: for every cross-domain input, record WHAT was received, HOW it changed (or did not change)
 * the target's prior/attention/gain/hypothesis/forecast/action, and whether that influence LATER
 * improved / worsened / did not affect calibration. Only after this ledger proves repeatable beneficial
 * transfer should parameter sharing be attempted — and always vs a no-transfer baseline.
 *
 * Built ON the tamper-evident audit-ledger (lib/audit-ledger): each receipt/outcome is a chained,
 * verifiable provenance entry per target domain (stream 'transfer:<targetDomain>'). Records only —
 * it changes no prior, gates nothing, acts on nothing. Pure timing supplied by the caller (`now`).
 */

var audit = require('../lib/audit-ledger');

function r4(x) { return Math.round(x * 10000) / 10000; }
function stream(targetDomain) { return 'transfer:' + String(targetDomain || 'unknown'); }

// Stable reference to correlate a later outcome with this receipt.
function refOf(packet) { return String(packet.sourceDomain) + '|' + String(packet.canonicalId) + '|' + String(packet.madeAt); }

// Record receipt of a packet + the receiver's disposition + how it influenced the target (if at all).
// influence: { changed: bool, fields:[...], priorDelta, attentionDelta, ... } — observed effect, or {changed:false}.
async function recordReceipt(db, packet, disp, influence, now) {
  var entry = await audit.append(db, stream(packet.targetDomain), {
    ts: now, type: 'transfer.receipt', actor: 'bus:' + packet.sourceDomain,
    payload: {
      ref: refOf(packet), sourceDomain: packet.sourceDomain, targetDomain: packet.targetDomain,
      canonicalId: packet.canonicalId, relationType: packet.relationType, calibrationState: packet.calibrationState,
      disposition: disp.disposition, weight: disp.weight,
      influenced: !!(influence && influence.changed), influenceFields: (influence && influence.fields) || [],
      outcome: null   // filled by a later recordOutcome entry (append-only: this stays as the receipt of record)
    }
  });
  return { ref: entry.payload.ref, seq: entry.seq, hash: entry.hash };
}

// Later: whether the accepted influence improved / worsened / did-not-affect the target's calibration.
// verdict ∈ 'improved' | 'worsened' | 'no-effect'. delta = signed calibration change if measured.
async function recordOutcome(db, targetDomain, ref, verdict, delta, now) {
  var v = (['improved', 'worsened', 'no-effect'].indexOf(verdict) !== -1) ? verdict : 'no-effect';
  var entry = await audit.append(db, stream(targetDomain), {
    ts: now, type: 'transfer.outcome', actor: 'consolidator',
    payload: { ref: ref, verdict: v, calibrationDelta: (typeof delta === 'number') ? r4(delta) : null }
  });
  return { ref: ref, verdict: v, seq: entry.seq };
}

// Uplift readout for one target domain. OBSERVATIONAL (improved-vs-worsened among influencing accepts) —
// NOT yet a randomized no-transfer baseline; labeled as such so it is never overclaimed.
async function uplift(db, targetDomain, cap) {
  var all = (await audit.read(db, stream(targetDomain), cap || 2000)) || [];
  var receipts = {}, outcomes = {};
  all.forEach(function (e) {
    if (!e || !e.payload) return;
    if (e.type === 'transfer.receipt') receipts[e.payload.ref] = e.payload;
    else if (e.type === 'transfer.outcome') outcomes[e.payload.ref] = e.payload;
  });
  var refs = Object.keys(receipts);
  var accepted = 0, influencing = 0, withOutcome = 0, improved = 0, worsened = 0, noEffect = 0;
  refs.forEach(function (ref) {
    var rc = receipts[ref];
    if (rc.disposition === 'accepted') accepted++;
    if (rc.influenced) influencing++;
    var oc = outcomes[ref];
    if (oc) { withOutcome++; if (oc.verdict === 'improved') improved++; else if (oc.verdict === 'worsened') worsened++; else noEffect++; }
  });
  var net = improved - worsened;
  return {
    targetDomain: targetDomain, receipts: refs.length, accepted: accepted, influencing: influencing,
    withOutcome: withOutcome, improved: improved, worsened: worsened, noEffect: noEffect,
    observedUpliftRate: withOutcome ? r4(net / withOutcome) : null,
    verdict: withOutcome < (arguments[3] || 8) ? 'insufficient-data'
      : net > 0 ? 'net-positive-observational' : net < 0 ? 'net-negative' : 'neutral',
    note: 'OBSERVATIONAL improved-vs-worsened among transfers with a recorded outcome; NOT a randomized no-transfer baseline. Do not claim transfer "works" from this alone (spec).'
  };
}

module.exports = { stream: stream, refOf: refOf, recordReceipt: recordReceipt, recordOutcome: recordOutcome, uplift: uplift };
