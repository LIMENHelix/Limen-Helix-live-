/**
 * brain-v2/kernel/memory.js — BLOCK_B15 episodic + semantic + procedural + prospective.
 *
 * SPEC B15. MASTER_PROMPT §8.9–§8.12, §21 ("RAG ≠ memory", "summary ≠ consolidation").
 * Fidelity: F0/F1.
 *
 * FOUR STORES, FOUR JOBS, DELIBERATELY NOT ONE TABLE:
 *
 *   EPISODIC    what happened, in order, with enough fidelity to replay
 *   SEMANTIC    what is generally true, compiled, versioned, citations preserved
 *   PROCEDURAL  what to do, with the outcome history that justifies it
 *   PROSPECTIVE what we still owe: unresolved checks, with due times
 *
 * THE RULE THAT DOES THE MOST WORK: a single outcome creates a PROVISIONAL candidate and
 * nothing more. Promotion to semantic or procedural memory requires repeated, independently
 * traced evidence. MASTER_PROMPT §8.11 states it directly and §11 repeats it, because the
 * failure it prevents — one success becoming a general rule — is the most common way a system
 * starts confidently doing the wrong thing.
 *
 * TAGGING HAPPENS AT ENCODE TIME (SPEC B15). The salience decision is made when the event
 * happens, not retroactively at consolidation. Retroactive tagging would mean consolidation
 * selects what to keep using information the moment itself did not have, which quietly makes
 * every replayed memory look more relevant than it was.
 *
 * PROSPECTIVE MEMORY IS THE ONE THAT CLOSES THE LOOP. §8.12: a system that recommends an
 * intervention and never checks the result has not completed the cognitive loop. Every action
 * writes a prospective item; the loop refuses to consider an action done until its item closes.
 */

'use strict';

var PK = require('./packet.js');

function create() {
  return {
    episodic: [],                       // ordered. Never rewritten, only appended.
    episodeIndex: Object.create(null),  // traceId -> [episode indices]
    semantic: Object.create(null),      // claimKey -> versioned entry with citations
    procedural: Object.create(null),    // actionKind -> policy with outcome history
    prospective: [],                    // outstanding checks
    candidates: [],                     // provisional, not yet promoted
    version: 0
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EPISODIC — BLOCK_B15
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * PATTERN SEPARATION (dentate-gyrus analogue, E4/E5 — an abstraction, not a DG model).
 *
 * Similar-but-different episodes must not collapse into one. The signature below quantises
 * the state vector finely enough that two states differing by more than the quantum get
 * different keys. Crude, and stated as crude: real DG separation is a sparse expansion recoding,
 * not a rounding. What this buys is the property that matters here — two nearby-but-distinct
 * cycles remain separately retrievable rather than merging into an average.
 */
function signature(state, sensors) {
  var q = function (v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v * 100) / 100 : null; };
  return PK.sha256(PK.canonical({
    dep: q(state && state.departure),
    conf: q(state && state.confidence),
    live: (sensors || []).filter(function (s) { return s.fusable; }).map(function (s) { return s.key + ':' + q(s.departure && s.departure.z); }).sort()
  })).slice(0, 16);
}

/**
 * Encode one episode. `tag` is computed HERE, at encode time, from what is knowable now.
 */
function encode(mem, spec) {
  var sig = signature(spec.state, spec.sensors);

  // Novelty / mismatch detector (CA1 analogue): how different is this from the most recent
  // episode with a comparable signature. Drives the tag.
  var priorSame = mem.episodic.filter(function (e) { return e.signature === sig; });
  var novelty = priorSame.length === 0 ? 1.0 : 1 / (1 + priorSame.length);

  var surprise = numOr(spec.surprise, 0);
  var dysregulated = !!(spec.dysregulation && spec.dysregulation.detected);
  // Tag = salience at encode time. Three inputs, all available at the moment of the event.
  var tag = clamp01(0.4 * novelty + 0.4 * Math.min(1, surprise) + (dysregulated ? 0.2 : 0));

  var ep = {
    index: mem.episodic.length,
    id: 'ep_' + PK.sha256(PK.canonical({ t: spec.traceId, at: spec.at, sig: sig })).slice(0, 20),
    traceId: spec.traceId,
    at: spec.at,
    signature: sig,
    novelty: novelty,
    tag: tag,
    tagBasis: 'encode-time: 0.4*novelty(' + novelty.toFixed(3) + ') + 0.4*surprise(' + Math.min(1, surprise).toFixed(3) + ') + ' + (dysregulated ? '0.2 dysregulation' : '0 no dysregulation'),
    domain: spec.domain,
    state: spec.state,
    sensors: (spec.sensors || []).map(function (s) {
      return { key: s.key, value: s.value, precision: s.precision, state: s.state, fusable: s.fusable, z: s.departure ? s.departure.z : null };
    }),
    blind: (spec.blind || []).slice(),
    dysregulation: spec.dysregulation || null,
    findings: (spec.findings || []).slice(),
    predictionIds: (spec.predictionIds || []).slice(),
    candidateIds: (spec.candidateIds || []).slice(),
    selection: spec.selection || null,
    actionId: spec.actionId || null,
    efferenceCopyId: spec.efferenceCopyId || null,
    outcome: null,                 // filled in later by linkOutcome, never overwritten
    causalParents: (spec.causalParents || []).slice(),
    retained: true,
    // Weight for the consolidation pass. Decays; downscaled multiplicatively; never subtractive.
    strength: 1.0
  };
  mem.episodic.push(ep);
  if (!mem.episodeIndex[ep.traceId]) mem.episodeIndex[ep.traceId] = [];
  mem.episodeIndex[ep.traceId].push(ep.index);
  mem.version++;
  return ep;
}

/**
 * Attach an outcome to the episode that produced the action. Append-only in spirit: an episode
 * whose outcome is already set is NOT overwritten, because that would destroy the historical
 * record of what we believed first (MASTER_PROMPT §9: never destroy historical truth).
 */
function linkOutcome(mem, actionId, outcome) {
  for (var i = mem.episodic.length - 1; i >= 0; i--) {
    if (mem.episodic[i].actionId === actionId) {
      if (mem.episodic[i].outcome) {
        return { linked: false, why: 'episode already has an outcome; refusing to overwrite historical truth', episodeId: mem.episodic[i].id };
      }
      mem.episodic[i].outcome = outcome;
      mem.version++;
      return { linked: true, episodeId: mem.episodic[i].id, episodeIndex: i };
    }
  }
  return { linked: false, why: 'no episode carries actionId ' + actionId };
}

/** Query. MASTER_PROMPT §8.9 requires retrieval by several keys, not just time. */
function recall(mem, q) {
  var out = mem.episodic.slice();
  if (q.traceId) {
    var idx = mem.episodeIndex[q.traceId] || [];
    out = idx.map(function (i) { return mem.episodic[i]; });
  }
  if (q.since !== undefined) out = out.filter(function (e) { return e.at >= q.since; });
  if (q.until !== undefined) out = out.filter(function (e) { return e.at <= q.until; });
  if (q.signature) out = out.filter(function (e) { return e.signature === q.signature; });
  if (q.actionKind) out = out.filter(function (e) { return e.selection && e.selection.kind === q.actionKind; });
  if (q.minTag !== undefined) out = out.filter(function (e) { return e.tag >= q.minTag; });
  if (q.hasOutcome) out = out.filter(function (e) { return !!e.outcome; });
  if (q.failedPrediction) out = out.filter(function (e) { return e.outcome && e.outcome.hit === false; });
  if (q.retainedOnly) out = out.filter(function (e) { return e.retained; });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SEMANTIC — compiled, versioned, citations preserved, contradictions kept
// ─────────────────────────────────────────────────────────────────────────────────────────

var SEM_STATUS = { CONFIRMED: 'confirmed', DISPUTED: 'disputed', OBSOLETE: 'obsolete', SPECULATIVE: 'speculative' };

/**
 * Write a semantic claim. Requires citations — a claim with no evidence reference is refused,
 * because a stored generated sentence with no provenance is exactly how generated text becomes
 * fact by being written down (§8.10).
 *
 * CONTRADICTIONS ARE PRESERVED, NOT RESOLVED. If a new claim conflicts with an existing one,
 * both are kept and the entry is marked DISPUTED. Overwriting would destroy the disagreement,
 * and disagreement between sources is a signal in its own right (SPEC B5 divergence detector).
 */
function assertClaim(mem, spec) {
  if (!spec.key) throw new Error('semantic claim needs a key');
  if (!Array.isArray(spec.citations) || !spec.citations.length) {
    throw new Error('semantic claim "' + spec.key + '" has no citations — a claim with no evidence reference cannot enter semantic memory (§8.10)');
  }
  var e = mem.semantic[spec.key];
  if (!e) {
    e = mem.semantic[spec.key] = { key: spec.key, versions: [], status: SEM_STATUS.SPECULATIVE, contradictions: [] };
  }
  var prior = e.versions.length ? e.versions[e.versions.length - 1] : null;
  var v = {
    version: e.versions.length + 1,
    value: spec.value,
    confidence: numOr(spec.confidence, null),
    citations: spec.citations.slice(),
    validFrom: spec.validFrom,
    validUntil: (spec.validUntil === undefined) ? null : spec.validUntil,
    supportingEpisodes: (spec.supportingEpisodes || []).slice(),
    at: spec.at
  };
  if (prior && spec.contradicts) {
    e.contradictions.push({ priorVersion: prior.version, newVersion: v.version, why: spec.contradicts, at: spec.at });
    e.status = SEM_STATUS.DISPUTED;
  } else if ((spec.supportingEpisodes || []).length >= 3) {
    e.status = SEM_STATUS.CONFIRMED;
  }
  e.versions.push(v);
  mem.version++;
  return { key: spec.key, version: v.version, status: e.status, contradictionCount: e.contradictions.length };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// PROCEDURAL — policies, with the outcome history that justifies them
// ─────────────────────────────────────────────────────────────────────────────────────────

var PROMOTION_MIN_N = 5;        // [mark: prior] outcomes before a candidate can become a policy
var PROMOTION_MIN_HIT = 0.6;

/**
 * A resolved outcome creates a PROVISIONAL candidate. It does NOT create a policy.
 * `promote()` is the only path to procedural memory and it checks n and hit rate.
 */
function proposeProcedure(mem, spec) {
  var c = {
    id: 'pc_' + PK.sha256(PK.canonical({ k: spec.actionKind, t: spec.triggerCondition })).slice(0, 16),
    actionKind: spec.actionKind,
    triggerCondition: spec.triggerCondition,
    contraindications: (spec.contraindications || []).slice(),
    requiredEvidence: (spec.requiredEvidence || []).slice(),
    expectedResult: spec.expectedResult,
    observations: [],
    status: 'provisional',
    createdAt: spec.at
  };
  var existing = mem.candidates.filter(function (x) { return x.id === c.id; })[0];
  if (existing) return existing;
  mem.candidates.push(c);
  mem.version++;
  return c;
}

function observeProcedure(mem, candidateId, observation) {
  var c = mem.candidates.filter(function (x) { return x.id === candidateId; })[0];
  if (!c) return { recorded: false, why: 'unknown candidate ' + candidateId };
  c.observations.push(observation);
  mem.version++;
  return { recorded: true, n: c.observations.length };
}

/**
 * Promote a candidate to a policy. Refuses below the evidence floor and says exactly why.
 * This is the wall between "it worked once" and "this is what we do".
 */
function promote(mem, candidateId, now) {
  var c = mem.candidates.filter(function (x) { return x.id === candidateId; })[0];
  if (!c) return { promoted: false, why: 'unknown candidate' };
  var n = c.observations.length;
  if (n < PROMOTION_MIN_N) {
    return {
      promoted: false,
      why: 'only ' + n + ' resolved observations; ' + PROMOTION_MIN_N + ' required. ' +
           'A one-time success is not a procedure (§8.11).'
    };
  }
  var hits = c.observations.filter(function (o) { return o.hit === true; }).length;
  var rate = hits / n;
  if (rate < PROMOTION_MIN_HIT) {
    return { promoted: false, why: 'hit rate ' + rate.toFixed(3) + ' below floor ' + PROMOTION_MIN_HIT + ' over n=' + n };
  }
  var p = {
    actionKind: c.actionKind,
    triggerCondition: c.triggerCondition,
    contraindications: c.contraindications.slice(),
    requiredEvidence: c.requiredEvidence.slice(),
    expectedResult: c.expectedResult,
    confidence: rate,
    historicalOutcomes: c.observations.slice(),
    n: n,
    failureModes: c.observations.filter(function (o) { return o.hit === false; }).map(function (o) { return o.why || 'missed'; }),
    permissions: ['internal:attention'],
    rollbackProcedure: 'restore the prior parameter value from the append-only log',
    lastValidated: now,
    promotedFrom: c.id
  };
  mem.procedural[c.actionKind + '|' + c.triggerCondition] = p;
  c.status = 'promoted';
  mem.version++;
  return { promoted: true, policy: p, n: n, hitRate: rate };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// PROSPECTIVE — the store that closes the loop
// ─────────────────────────────────────────────────────────────────────────────────────────

function schedule(mem, spec) {
  if (typeof spec.dueAt !== 'number') throw new Error('prospective item needs dueAt');
  if (!spec.closureCriteria) throw new Error('prospective item needs closureCriteria — an item with no closure test never closes');
  var item = {
    id: 'ps_' + PK.sha256(PK.canonical({ t: spec.traceId, k: spec.kind, at: spec.dueAt })).slice(0, 20),
    traceId: spec.traceId,
    kind: spec.kind,
    actionId: spec.actionId || null,
    predictionId: spec.predictionId || null,
    trigger: spec.trigger,
    dueAt: spec.dueAt,
    responsibleModule: spec.responsibleModule,
    expectedObservation: spec.expectedObservation,
    escalationRule: spec.escalationRule || 'report as overdue in the self-model',
    closureCriteria: spec.closureCriteria,
    status: 'open',
    createdAt: spec.at,
    closedAt: null,
    closure: null
  };
  mem.prospective.push(item);
  mem.version++;
  return item;
}

function dueItems(mem, now) {
  return mem.prospective.filter(function (i) { return i.status === 'open' && now >= i.dueAt; });
}

function overdue(mem, now, graceMs) {
  var g = numOr(graceMs, 0);
  return mem.prospective.filter(function (i) { return i.status === 'open' && now > i.dueAt + g; });
}

function close(mem, itemId, closure, now) {
  var i = mem.prospective.filter(function (x) { return x.id === itemId; })[0];
  if (!i) return { closed: false, why: 'unknown prospective item' };
  i.status = closure && closure.resolved ? 'closed' : 'unresolvable';
  i.closedAt = now;
  i.closure = closure;
  mem.version++;
  return { closed: true, status: i.status, item: i };
}

function report(mem, now) {
  return {
    episodic: { count: mem.episodic.length, retained: mem.episodic.filter(function (e) { return e.retained; }).length, traces: Object.keys(mem.episodeIndex).length },
    semantic: { keys: Object.keys(mem.semantic).length, disputed: Object.keys(mem.semantic).filter(function (k) { return mem.semantic[k].status === SEM_STATUS.DISPUTED; }).length },
    procedural: { policies: Object.keys(mem.procedural).length, candidates: mem.candidates.length, provisional: mem.candidates.filter(function (c) { return c.status === 'provisional'; }).length },
    prospective: { open: mem.prospective.filter(function (i) { return i.status === 'open'; }).length, overdue: overdue(mem, now, 0).length, closed: mem.prospective.filter(function (i) { return i.status === 'closed'; }).length, unresolvable: mem.prospective.filter(function (i) { return i.status === 'unresolvable'; }).length },
    version: mem.version
  };
}

function serialize(mem) { return mem; }
function deserialize(o) {
  var m = create();
  if (!o) return m;
  m.episodic = o.episodic || [];
  m.episodeIndex = o.episodeIndex || Object.create(null);
  m.semantic = o.semantic || Object.create(null);
  m.procedural = o.procedural || Object.create(null);
  m.prospective = o.prospective || [];
  m.candidates = o.candidates || [];
  m.version = o.version || 0;
  return m;
}

function clamp01(v) { return (typeof v !== 'number' || !isFinite(v)) ? 0 : (v < 0 ? 0 : (v > 1 ? 1 : v)); }
function numOr(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

module.exports = {
  SEM_STATUS: SEM_STATUS,
  PROMOTION_MIN_N: PROMOTION_MIN_N,
  PROMOTION_MIN_HIT: PROMOTION_MIN_HIT,
  create: create,
  signature: signature,
  encode: encode,
  linkOutcome: linkOutcome,
  recall: recall,
  assertClaim: assertClaim,
  proposeProcedure: proposeProcedure,
  observeProcedure: observeProcedure,
  promote: promote,
  schedule: schedule,
  dueItems: dueItems,
  overdue: overdue,
  close: close,
  report: report,
  serialize: serialize,
  deserialize: deserialize
};
