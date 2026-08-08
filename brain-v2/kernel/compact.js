/**
 * brain-v2/kernel/compact.js — bound the serialized hot state. PURE POLICY, no I/O.
 *
 * WHAT THIS SOLVES. Every cycle reads the whole state and writes it back, so a collection
 * that grows per tick grows the work of every future cycle. Measured in production: seven
 * domains at 23 MB, +0.19% per cycle while applying ONE row each. Thirteen more domains
 * multiply that.
 *
 * WHAT IS AND IS NOT A TARGET. Nine collections already trim themselves and are left alone:
 * forwardModel.history (512), efferences (512), routed (ROUTED_WINDOW), varHistory
 * (VAR_WINDOW), modulators.series and the reward/surprise histories (256),
 * divergences.closed (CLOSED_CAP), consolidator.history (32). A 470-tick replay made them
 * look unbounded; a 2,070-tick replay shows every one plateau. Adding policy on top of a
 * working cap is how two policies start disagreeing.
 *
 * THE CLAIM THIS MODULE MAKES, STATED EXACTLY. It removes LINEAR PER-TICK RECORD GROWTH and
 * bounds retained cardinality. It does NOT make the serialized value constant: an archive
 * sequence number and cumulative counters gain digits, and JSON is decimal, so the byte
 * count creeps logarithmically forever. Promising a flat byte plateau would be a claim the
 * arithmetic cannot support.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * FOUR RULES THAT ARE CORRECTNESS, NOT TIDINESS
 *
 * 1. AN OPEN RECORD IS NEVER RETIRED. An OPEN prediction and an unresolved prospective item
 *    are live state, not history. Retiring one loses a claim that can still resolve, which
 *    is the same defect as a divergence that can never fire.
 *
 * 2. CALIBRATION MUST NOT GET YOUNGER. predict.js:215 recomputes calibration by mapping
 *    reg.resolved over reg.predictions, so retiring resolved predictions silently drops n
 *    and makes the brain look less measured than it is. Retirement therefore FOLDS each
 *    retired resolution into cumulative counters first, and calibration reads
 *    counters + surviving records.
 *
 * 3. episodeIndex POINTS INTO episodic BY POSITION. Retiring episodes without rebuilding it
 *    leaves indices addressing the wrong episode or none at all. The index is rebuilt from
 *    the surviving episodes, never patched.
 *
 * 4. forwardModel.consumed IS DUPLICATE-LEARNING PREVENTION, NOT HISTORY. Dropping an id
 *    lets the same efference train the model a second time. Ids are retired only with their
 *    resolved prediction, and a horizon is recorded so an efference older than the retained
 *    window is REFUSED rather than relearned.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * DETERMINISTIC BY CONSTRUCTION. Retention is by COUNT and by record order, never by
 * wall-clock age. Two replays of the same rows retire the same records, which is what keeps
 * byte-identical determinism (shadow-runtime S3b) and restart restoration (S4) true.
 */

'use strict';

var PRED = require('./predict.js');

/** Retained cardinality per collection. Counts, not durations: a clock would break replay. */
var RETAIN = {
  episodic: 512,
  prospectiveClosed: 256,
  resolved: 512,
  attentionPerSource: 256
};

/** Records kept beyond resolution so a rollback can still reach them. */
var ROLLBACK_WINDOW = 128;

/**
 * TERMINAL MEANS FINISHED, AND THERE ARE THREE OF THEM. Only RESOLVED predictions are
 * pushed to reg.resolved (predict.js:205); EXPIRED (:129) and UNRESOLVABLE (:162) are
 * equally finished and never appear there. Retiring from reg.resolved alone left them in
 * `predictions` and `order` forever, which is the leak this policy exists to close.
 */
var TERMINAL = [PRED.STATUS.RESOLVED, PRED.STATUS.UNRESOLVABLE, PRED.STATUS.EXPIRED];
function isTerminalPrediction(p) {
  return !!p && TERMINAL.indexOf(p.status) >= 0;
}
function isOpenPrediction(p) {
  return !p || !isTerminalPrediction(p);
}
/**
 * A prospective item is retirable only when it is explicitly finished.
 *
 * THE VALUES ARE LOWERCASE. memory.js writes 'open' on creation (memory.js:300) and
 * 'closed' or 'unresolvable' on closure (memory.js:322). An earlier draft here compared
 * against uppercase, so NOTHING ever matched and prospective never retired while the code
 * read as though it did. Compared against the same literals memory.js writes.
 */
var PROSPECTIVE_OPEN = 'open';
var PROSPECTIVE_RETIRABLE = ['closed', 'unresolvable'];
function isClosedProspective(it) {
  return !!it && PROSPECTIVE_RETIRABLE.indexOf(it.status) >= 0;
}

/** Fold one resolved prediction into the cumulative calibration counters. */
function foldCalibration(totals, p) {
  if (!p || !p.resolution || !p.resolution.observable) return totals;
  totals.n++;
  if (p.resolution.hit) totals.hits++;
  if (p.resolution.contaminated) totals.contaminated++;
  totals.sumAbsError += Math.abs(p.resolution.predictionError || 0);
  var c = (typeof p.confidence === 'number') ? p.confidence : 0.5;
  var o = p.resolution.hit ? 1 : 0;
  totals.sumBrier += (c - o) * (c - o);
  return totals;
}

function emptyTotals() {
  return { n: 0, hits: 0, contaminated: 0, sumAbsError: 0, sumBrier: 0 };
}

/**
 * Decide what leaves hot state. Returns the retired records (for the archive) and the
 * compacted state. NEITHER INPUT IS MUTATED: the caller archives first and only then
 * adopts the compacted state, so a failed archive write leaves hot state untouched.
 */
function plan(state, opts) {
  opts = opts || {};
  var retain = Object.assign({}, RETAIN, opts.retain || {});
  var head = state.archiveHead || { sequence: 0, hash: null, totals: emptyTotals(), retired: {} };
  var totals = Object.assign(emptyTotals(), head.totals || {});
  var retired = { episodic: [], prospective: [], predictions: [], consumed: [], attention: {} };

  var mem = state.memory || {};
  var reg = state.registry || { predictions: {}, order: [], resolved: [] };

  /* ── episodic: oldest first, keep the newest RETAIN.episodic ───────────────── */
  var episodic = mem.episodic || [];
  var epCut = Math.max(0, episodic.length - retain.episodic);
  retired.episodic = episodic.slice(0, epCut);
  var keptEpisodic = episodic.slice(epCut);

  /* ── episodeIndex: REBUILT from survivors, never patched ───────────────────── */
  var episodeIndex = Object.create(null);
  keptEpisodic.forEach(function (ep, i) {
    if (!ep || ep.traceId === undefined || ep.traceId === null) return;
    if (!episodeIndex[ep.traceId]) episodeIndex[ep.traceId] = [];
    episodeIndex[ep.traceId].push(i);          // positional, so it must be the NEW position
  });

  /* ── prospective: CLOSED only, oldest first. OPEN items always survive ─────── */
  var prospective = mem.prospective || [];
  var closed = [], open = [];
  prospective.forEach(function (it) { (isClosedProspective(it) ? closed : open).push(it); });
  var prCut = Math.max(0, closed.length - retain.prospectiveClosed);
  retired.prospective = closed.slice(0, prCut);
  var keptProspective = open.concat(closed.slice(prCut));

  /* ── predictions: resolved only, oldest first, minus the rollback window ───── */
  var resolvedIds = (reg.resolved || []).slice();
  /* Candidates in REGISTRATION order (reg.order), so expired and unresolvable predictions
     are retirable too, not only the resolved list. Order is stable, so retirement stays
     deterministic across replays. */
  var terminalIds = (reg.order || []).filter(function (id) {
    return isTerminalPrediction(reg.predictions[id]);
  });
  var retirableCount = Math.max(0, terminalIds.length - retain.resolved - ROLLBACK_WINDOW);
  var retiredIds = [];
  for (var i = 0; i < retirableCount; i++) {
    var id = terminalIds[i];
    var p = reg.predictions[id];
    if (isOpenPrediction(p)) continue;            // rule 1: never an open claim
    retiredIds.push(id);
    retired.predictions.push(p);
    foldCalibration(totals, p);                   // rule 2: fold BEFORE dropping
  }
  var retiredSet = Object.create(null);
  retiredIds.forEach(function (id) { retiredSet[id] = true; });

  var keptPredictions = Object.create(null);
  Object.keys(reg.predictions || {}).forEach(function (id) {
    if (!retiredSet[id]) keptPredictions[id] = reg.predictions[id];
  });
  var keptOrder = (reg.order || []).filter(function (id) { return !retiredSet[id]; });
  var keptResolved = resolvedIds.filter(function (id) { return !retiredSet[id]; });

  /* ── consumed: retire ids belonging to retired predictions, and record the
        horizon so an older efference is REFUSED rather than relearned (rule 4) ── */
  var fm = state.forwardModel || {};
  var consumed = fm.consumed || {};
  var keptConsumed = Object.create(null), horizon = head.consumedHorizon || null;
  var retiredEfferenceIds = Object.create(null);
  /* THE FIELD IS efferenceCopyId (predict.js:106), not efferenceId. `efferenceId` exists,
     but on the forward-model HISTORY record (predict.js:452), not on the prediction. Reading
     the wrong one retired nothing and left `consumed` growing unchecked.

     Retiring only with an already-retired prediction keeps rollback correct: rollback
     re-enables learning by deleting consumed[efferenceId] (predict.js:511), and a retired
     prediction is by construction outside ROLLBACK_WINDOW. */
  /* ONE FIELD, NO FALLBACK. `efferenceCopyId` is the link (predict.js:106). `efferenceId`
     exists on the forward-model history record, not on a prediction, so accepting it here
     would let an unrelated identifier retire a consumed entry. */
  retired.predictions.forEach(function (p) {
    if (p && p.efferenceCopyId) retiredEfferenceIds[p.efferenceCopyId] = true;
  });
  Object.keys(consumed).forEach(function (eid) {
    if (retiredEfferenceIds[eid]) { retired.consumed.push(eid); }
    else keptConsumed[eid] = consumed[eid];
  });
  if (retired.predictions.length) {
    var newest = retired.predictions[retired.predictions.length - 1];
    if (newest && typeof newest.createdAt === 'number') {
      horizon = (horizon === null) ? newest.createdAt : Math.max(horizon, newest.createdAt);
    }
  }

  /* ── attention: per-source history, newest RETAIN.attentionPerSource ───────── */
  var attention = state.attention || {};
  var keptAttention = {};
  Object.keys(attention).forEach(function (k) {
    var a = attention[k] || {};
    var h = a.history || [];
    if (h.length <= retain.attentionPerSource) { keptAttention[k] = a; return; }
    var cut = h.length - retain.attentionPerSource;
    retired.attention[k] = h.slice(0, cut);
    keptAttention[k] = Object.assign({}, a, { history: h.slice(cut) });
  });

  var retiredCount = retired.episodic.length + retired.prospective.length +
    retired.predictions.length + retired.consumed.length +
    Object.keys(retired.attention).reduce(function (a, k) { return a + retired.attention[k].length; }, 0);

  return {
    retiredCount: retiredCount,
    retired: retired,
    totals: totals,
    consumedHorizon: horizon,
    /** The compacted state, built by copy. The caller adopts this only after the archive lands. */
    apply: function (nextHead) {
      var out = Object.assign({}, state);
      out.memory = Object.assign({}, mem, {
        episodic: keptEpisodic, episodeIndex: episodeIndex, prospective: keptProspective
      });
      out.registry = Object.assign({}, reg, {
        predictions: keptPredictions, order: keptOrder, resolved: keptResolved
      });
      /* consumedHorizon lives ON the forward model, because that is where learn() reads it. */
      out.forwardModel = Object.assign({}, fm, { consumed: keptConsumed, consumedHorizon: horizon });
      out.attention = keptAttention;
      out.archiveHead = nextHead;
      return out;
    }
  };
}

/**
 * Calibration that survives retirement: cumulative counters plus the records still hot.
 * Same fields predict.calibration returns, so a consumer cannot tell which era a
 * resolution came from, which is the point.
 */
function calibrationWithArchive(state) {
  var head = state.archiveHead || {};
  /* DELEGATES. predict.calibration is the one implementation; this only supplies the
     retired counters it needs. A second copy of the arithmetic here is how the two would
     eventually disagree about what the brain has measured. */
  return PRED.calibration(state.registry || { predictions: {}, resolved: [] }, head.totals || null);
}

module.exports = {
  RETAIN: RETAIN,
  ROLLBACK_WINDOW: ROLLBACK_WINDOW,
  plan: plan,
  calibrationWithArchive: calibrationWithArchive,
  emptyTotals: emptyTotals,
  _foldCalibration: foldCalibration,
  _isOpenPrediction: isOpenPrediction,
  _isTerminalPrediction: isTerminalPrediction,
  _isClosedProspective: isClosedProspective
};
