/**
 * brain-v2/kernel/barrier.js — BLOCK_B1, the boundary layer. Default-deny admission.
 *
 * SPEC B1 / row 28. MASTER_PROMPT §8.24, §13. Fidelity: F0 (functional).
 *
 * NEUROSCIENCE BASIS, stated honestly: the blood-brain barrier is a *physical* filter that
 * evaluates provenance and molecular class, upstream of all computation, and does not read
 * content. E1 as biology. The mapping to a software admission gate is E5 — an engineering
 * abstraction inspired by biology. This module is NOT an immune system, is NOT a claim about
 * neuroinflammation, and detects nothing an ordinary input validator could not. What it
 * contributes is *position*: it sits before the substrate rather than inside it.
 *
 * WHY THAT POSITION MATTERS AND IS NOT DECORATION. The system's own predictions and external
 * source material occupy the same data structures downstream. Without a gate that runs before
 * anything reads a payload, "is this a measurement or a story someone told us" becomes a
 * judgement made by whichever module happens to touch it first — which means it is made
 * inconsistently and, eventually, not at all.
 *
 * WHAT THIS CANNOT DO, stated so no one relies on it: the instruction-bearing scan below is a
 * keyword heuristic over a short list. It will miss obfuscated, encoded, or novel phrasing. It
 * is a tripwire, not a defence. Anything that needs an actual guarantee must not depend on it.
 */

'use strict';

var PK = require('./packet.js');

/**
 * SOURCE CLASSES — default-deny means an unlisted class is refused, not waved through.
 *
 * `trusted` is only for signals the kernel generated about itself. Every external feed is
 * `untrusted` however reputable, because reliability is a per-channel *measurement* (B0's job)
 * and must never be conferred by a name on a list.
 */
var CLASS = {
  KERNEL:    'kernel',      // this process, about itself. Content trusted, still schema-checked.
  SENSOR:    'sensor',      // a declared channel in a bound manifest. Untrusted content.
  RECORDER:  'recorder',    // stored historical readings. Untrusted content, replayed status.
  OPERATOR:  'operator',    // a human instruction. Authorised to command, still logged.
  UNKNOWN:   'unknown'      // refused.
};

var ADMITTED_CLASSES = [CLASS.KERNEL, CLASS.SENSOR, CLASS.RECORDER, CLASS.OPERATOR];

/**
 * INSTRUCTION-BEARING MARKERS. MASTER_PROMPT §13: external content is data, never instruction.
 * Deliberately short and deliberately dumb. See the caveat in the header.
 */
var INJECTION_MARKERS = [
  'ignore previous', 'ignore all previous', 'disregard the above', 'disregard previous',
  'system prompt', 'you are now', 'new instructions', 'override your',
  'reveal your', 'print your instructions', 'act as if', 'grant yourself',
  'execute the following', 'run this command'
];

/** Deep-walk a payload collecting every string, so markers cannot hide one level down. */
function strings(v, acc, depth) {
  acc = acc || []; depth = depth || 0;
  if (depth > 8) return acc;                       // bounded: a cyclic payload must not hang the gate
  if (typeof v === 'string') { acc.push(v); return acc; }
  if (v && typeof v === 'object') {
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length && i < 200; i++) strings(v[ks[i]], acc, depth + 1);
  }
  return acc;
}

function scanForInstructions(payload) {
  var found = [];
  strings(payload).forEach(function (s) {
    var low = s.toLowerCase();
    INJECTION_MARKERS.forEach(function (m) {
      if (low.indexOf(m) >= 0 && found.indexOf(m) < 0) found.push(m);
    });
  });
  return found;
}

/**
 * ADMIT — the only door.
 *
 * Returns {admitted, reason, checks[]}. Every check that ran is reported whether it passed or
 * not, because "the gate let it through" and "the gate never looked" must be distinguishable
 * after the fact. A silent pass is indistinguishable from an absent barrier, which is the
 * failure this whole module is positioned to prevent.
 */
function admit(packet, ctx) {
  ctx = ctx || {};
  var now = ctx.now;
  var checks = [];
  function check(name, pass, detail) { checks.push({ check: name, pass: !!pass, detail: detail || null }); return pass; }

  // 1. Schema + provenance integrity. Runs first: an unverifiable packet cannot be reasoned about.
  var v = PK.verify(packet);
  if (!check('provenance_integrity', v.ok, v.ok ? null : v.why)) {
    return deny(packet, 'provenance_integrity', v.why, checks);
  }

  // 2. Source class. Default-deny.
  var cls = ctx.sourceClass || CLASS.UNKNOWN;
  if (!check('source_class', ADMITTED_CLASSES.indexOf(cls) >= 0, 'class=' + cls)) {
    return deny(packet, 'source_class', 'source class "' + cls + '" is not admitted; default is deny', checks);
  }

  // 3. Declared-channel check. A SENSOR packet must name a channel that exists in the manifest.
  //    An unlisted channel is how a feed quietly grows a nineteenth input nobody declared.
  if (cls === CLASS.SENSOR && ctx.manifest) {
    var key = packet.payload && packet.payload.channel;
    var known = !!(key && ctx.manifest.indexOf(key) >= 0);
    if (!check('declared_channel', known, 'channel=' + key)) {
      return deny(packet, 'declared_channel', 'channel "' + key + '" is not in the bound manifest', checks);
    }
  }

  // 4. Epistemic status must match the class. THIS IS THE SIMULATION BOUNDARY (TEST 17).
  //    A recorder replaying history may not claim its packets are fresh observations, and a
  //    kernel-generated forecast may not claim to be a sensor reading. The status is covered
  //    by the provenance hash, so this cannot be defeated by editing the field afterwards.
  var statusOk = true, statusWhy = null;
  if (cls === CLASS.RECORDER && packet.simulationStatus === PK.STATUS.OBSERVED) {
    statusOk = false;
    statusWhy = 'a recorder packet is replayed, not observed — stored history re-entering as a live reading is the poisoned-replay case';
  }
  if (cls === CLASS.KERNEL && packet.simulationStatus === PK.STATUS.OBSERVED &&
      packet.signalKind !== PK.KIND.AUDIT_EVENT) {
    statusOk = false;
    statusWhy = 'the kernel cannot observe the world; kernel-sourced packets are inferred, predicted, or simulated';
  }
  if (!check('epistemic_status', statusOk, statusWhy)) {
    return deny(packet, 'epistemic_status', statusWhy, checks);
  }

  // 5. Expiry. Stale is not fresh (MASTER_PROMPT §8.1).
  var expired = (packet.expiresAt !== null && typeof now === 'number' && now > packet.expiresAt);
  if (!check('not_expired', !expired, expired ? 'expiresAt=' + packet.expiresAt + ' now=' + now : null)) {
    return deny(packet, 'expired', 'packet expired at ' + packet.expiresAt, checks);
  }

  // 6. Hop budget.
  if (!check('hop_budget', packet.hopCount <= packet.hopLimit, 'hop ' + packet.hopCount + '/' + packet.hopLimit)) {
    return deny(packet, 'hop_budget', 'hop limit exceeded', checks);
  }

  // 7. Instruction-bearing content. Untrusted classes only — the kernel talking to itself in
  //    imperative language is not injection, and flagging it would train everyone to ignore
  //    this check, which is worse than not having it.
  if (cls === CLASS.SENSOR || cls === CLASS.RECORDER) {
    var hits = scanForInstructions(packet.payload);
    if (!check('no_embedded_instructions', hits.length === 0, hits.length ? hits.join('; ') : null)) {
      return deny(packet, 'embedded_instructions',
        'payload contains instruction-bearing markers: ' + hits.join(', ') +
        ' — external content is data, never instruction (§13)', checks);
    }
  } else {
    checks.push({ check: 'no_embedded_instructions', pass: true, detail: 'skipped: class ' + cls + ' is not untrusted content' });
  }

  return { admitted: true, reason: null, checks: checks, sourceClass: cls };
}

function deny(packet, code, why, checks) {
  return {
    admitted: false,
    reason: code,
    why: why,
    checks: checks,
    packetId: packet && packet.id ? packet.id : null,
    disposition: 'quarantine'
  };
}

module.exports = {
  CLASS: CLASS,
  ADMITTED_CLASSES: ADMITTED_CLASSES,
  INJECTION_MARKERS: INJECTION_MARKERS,
  admit: admit,
  scanForInstructions: scanForInstructions
};
