/**
 * brain-v2/kernel/loop.js — THE CLOSED LOOP. One tick, observation to memory.
 *
 * MASTER_PROMPT §2, §23. SPEC Part 6 loops L2-L6. Fidelity: F0/F1.
 *
 * THE PATH, IN ORDER, AND WHY THE ORDER IS NOT ARBITRARY:
 *
 *   1  arousal gate            can we encode at all (BLOCK_B4)
 *   2  barrier                 default-deny admission (BLOCK_B1)
 *   3  domain cycle            sense, fuse, detect (BLOCK_B0/B5/B8, core/brain.js)
 *   4  RESOLVE DUE PREDICTIONS before anything new is proposed
 *   5  modulators              four quantities, fed by step 4's outcomes (BLOCK_B12)
 *   6  encode episode          tag set HERE, at encode time (BLOCK_B15)
 *   7  register prediction     falsifiable, with a horizon (BLOCK_B8)
 *   8  connectome              typed, bounded routing (BLOCK_B7/B9)
 *   9  propose                 the ACTOR generates candidates
 *   10 select                  the CRITIC gates by disinhibition (BLOCK_B10)
 *   11 efference copy          emitted BEFORE the command (BLOCK_B14)
 *   12 actuate                 the motor path writes `executed` (BLOCK_B11)
 *   13 prospective             schedule the outcome check
 *   14 persist                 append-only; snapshot
 *   15 self-model              what we can and cannot sense (BLOCK_B17)
 *
 * STEP 4 BEFORE STEP 9 IS THE LOAD-BEARING ORDERING. Outcomes must resolve before new actions
 * are proposed, or the modulators score this tick's decision using last tick's reward and the
 * credit lands on the wrong action. That is delayed-credit misassignment and MASTER_PROMPT §10
 * names it directly: "do not reinforce an action merely because a favorable event occurred
 * shortly afterward."
 *
 * STEP 11 BEFORE STEP 12 IS THE OTHER ONE. The efference copy is a PREDICTION about our own
 * effect. Emitted after the command it would be a rationalisation, and cancelling reafference
 * with a post-hoc "prediction" is circular. actuate.js throws if the copy is missing.
 *
 * ATTENTION IS IMPLEMENTED AS PRECISION, WHICH IS WHY THIS LOOP NEEDS A FORWARD MODEL.
 * `raise_attention` lowers a channel's observation noise r. That raises its Kalman gain, which
 * raises its posterior precision, which raises its weight in fusion — and precision is one of
 * the quantities the brain uses to judge the channel. So the action moves a number the system
 * also measures. Without efference cancellation the loop would read its own attention change
 * as evidence the channel matters and raise attention again. The ablation test demonstrates
 * exactly that on real data.
 */

'use strict';

var PK    = require('./packet.js');
var ST    = require('./store.js');
var BAR   = require('./barrier.js');
var CX    = require('./connectome.js');
var PRED  = require('./predict.js');
var SEL   = require('./select.js');
var ACT   = require('./actuate.js');
var MEM   = require('./memory.js');
var CON   = require('./consolidate.js');
var MOD   = require('./modulators.js');
var VIT   = require('./vitals.js');
var PROP  = require('./propose.js');
var TOPO  = require('./topology.js');
var BRAIN = require('../core/brain.js');
var DIV   = require('../core/divergence.js');
var C     = require('../core/channel.js');

var VERSION = 'brain-v2/kernel/1.0.0';

/** Modules that can be individually ablated. TEST 19. */
var ABLATABLE = ['barrier', 'forwardModel', 'selector', 'consolidation', 'connectome', 'episodic', 'modulators'];

function create(spec) {
  var loop = {
    version: VERSION,
    domain: spec.domain,
    store: spec.storeDir ? ST.open(spec.storeDir) : null,
    brain: BRAIN.createBrain(spec.brainSpec),
    connectome: CX.create(spec.connectomeOpts),
    /* SPEC row 25. Structural plasticity over the connectome's declared edges. */
    topology: TOPO.createTopology(spec.topologyOpts),
    registry: PRED.createRegistry(),
    forwardModel: PRED.createForwardModel(spec.forwardModelOpts),
    gate: SEL.createGate(spec.gateOpts),
    motor: ACT.createMotor(spec.motorOpts),
    memory: MEM.create(),
    consolidator: CON.create(spec.consolidateOpts),
    modulators: MOD.create(spec.modulatorOpts),
    vitals: VIT.create(spec.vitalsOpts),
    ablations: Object.create(null),
    // Attention state: the thing actions actually move. channelKey -> {rBase, multiplier}
    attention: Object.create(null),
    horizonMs: spec.horizonMs || 24 * 3600000,
    /* SPEC row 25. null = structural credit withheld; see the resolution step for the
       measurement that put it there. 'trace' re-enables the known-misattributed path. */
    topologyCredit: spec.topologyCredit || null,
    /**
     * SPEC row 22. Derive each channel's q and r from its own innovations instead of
     * holding the declared prior.
     *
     * ON BY DEFAULT, because a held-out comparison says it earns it, not because derived
     * sounds better than set. `test/noise-control.js` adapts on the first 60% of the
     * recorded corpus, freezes, and scores the remaining 40%: on the channels the system
     * would actually fuse, derived parameters are better calibrated on 4 of 5, summed
     * NIS miscalibration -6.74. Pass `deriveNoise: false` for the control arm.
     */
    deriveNoise: spec.deriveNoise === undefined ? true : !!spec.deriveNoise,
    noiseEveryTicks: spec.noiseEveryTicks || 24,
    ticks: 0,
    lastTickAt: null,
    errors: []
  };
  wireConnectome(loop);
  CX.attachTopology(loop.connectome, loop.topology);
  wireMotor(loop);
  return loop;
}

/**
 * Declared edges. Every one is typed on kind and direction (SPEC Part 3), and the descending
 * edges exist so reciprocityReport() can pass INV-7 rather than the wiring being a funnel.
 */
function wireConnectome(loop) {
  var received = loop._received = [];
  /**
   * ADOPTION TIME. The three edges below are hand-declared kernel wiring that predates
   * the topology, so they are adopted as ACTIVE rather than entering as unproven
   * candidates — a topology whose first act is to stop all routing has deleted working
   * structure on no evidence. `adopted:true` keeps them distinguishable in report()
   * from anything the mechanism itself promoted.
   *
   * 0 is used deliberately as the adoption timestamp: `create()` has no `now`, and
   * inventing one from a clock would make two runs of the same replay differ. Every
   * later transition carries the caller's real `now`.
   */
  function wire(target, spec, why) {
    CX.connect(loop.connectome, target, spec);
    TOPO.adopt(loop.topology, target, { at: 0, reason: why });
  }
  wire('integration:ascending', {
    kinds: [PK.KIND.PREDICTION_ERROR, PK.KIND.DIAGNOSIS, PK.KIND.CONTRADICTION],
    direction: PK.DIRECTION.ASCENDING,
    role: PK.ROLE.DRIVER,
    handler: function (p) { received.push({ at: p.processingTime, kind: p.signalKind, id: p.id }); return { accepted: true }; }
  }, 'pre-existing kernel wiring: the ascending residual path, declared before topology existed');
  wire('integration:descending', {
    kinds: [PK.KIND.PREDICTION, PK.KIND.MODULATION],
    direction: PK.DIRECTION.DESCENDING,
    role: PK.ROLE.MODULATOR,
    handler: function (p) { received.push({ at: p.processingTime, kind: p.signalKind, id: p.id }); return { accepted: true }; }
  }, 'pre-existing kernel wiring: the descending prediction path required by INV-7');
  wire('selector:lateral', {
    kinds: [PK.KIND.ACTION_CANDIDATE, PK.KIND.INHIBITION],
    direction: PK.DIRECTION.LATERAL,
    role: PK.ROLE.DRIVER,
    handler: function (p) { received.push({ at: p.processingTime, kind: p.signalKind, id: p.id }); return { accepted: true }; }
  }, 'pre-existing kernel wiring: the lateral selector path');
}

/**
 * EFFECTORS. Internal only. Each returns a RECEIPT with the observed effect, and only that
 * receipt lets actuate.js write `executed`.
 */
function wireMotor(loop) {
  function attentionHandler(direction) {
    return function (cmd) {
      var key = cmd.action.parameters.channel;
      var ch = loop.brain.channels.filter(function (c) { return c.key === key; })[0];
      if (!ch) return { applied: false, detail: 'no such channel ' + key };
      var before = ch.r;
      var factor = cmd.action.parameters.factor;
      // Attention IS precision: lower observation noise -> higher Kalman gain -> higher
      // posterior precision -> more weight in fusion. Gain from adaptation scales the step.
      //
      // IT MOVES rGain, NOT r. Since row 22 the effective r is rBase * rGain, where rBase
      // is derived from the channel's own innovations. Writing ch.r here would put both
      // mechanisms on one field, and the next derivation would silently erase this action
      // — leaving an efference copy predicting a change to a variable something else had
      // already overwritten, which is a false outcome, not a missing one.
      var applied = 1 + (factor - 1) * cmd.gain;
      C.setAttentionGain(ch, direction > 0 ? ch.rGain / applied : ch.rGain * applied);
      if (!loop.attention[key]) loop.attention[key] = { rBase: before, history: [] };
      loop.attention[key].history.push({ at: cmd.now, from: before, to: ch.r, actionId: cmd.action.actionId });
      return {
        applied: true,
        at: cmd.now,
        observedEffect: { channel: key, rBefore: before, rAfter: ch.r, precisionBefore: 1 / Math.max(ch.P, 1e-9) },
        detail: 'observation noise r ' + before.toFixed(4) + ' -> ' + ch.r.toFixed(4) + ' (commanded gain ' + cmd.gain.toFixed(3) + ')'
      };
    };
  }
  ACT.register(loop.motor, PROP.KIND.RAISE_ATTENTION, attentionHandler(+1));
  ACT.register(loop.motor, PROP.KIND.LOWER_ATTENTION, attentionHandler(-1));
  ACT.register(loop.motor, PROP.KIND.COLLECT_EVIDENCE, function (cmd) {
    return { applied: true, at: cmd.now, observedEffect: { deferred: true }, detail: 'deferred one cycle; no state changed' };
  });
  ACT.register(loop.motor, PROP.KIND.NO_ACTION, function (cmd) {
    return { applied: true, at: cmd.now, observedEffect: { changed: false }, detail: 'explicit no-action executed; nothing changed by design' };
  });
  ACT.register(loop.motor, PROP.KIND.ESCALATE, function (cmd) {
    return { applied: true, at: cmd.now, observedEffect: { escalated: true }, detail: 'escalation record written; the system stops here and waits for a human' };
  });
}

function ablate(loop, moduleName, on) {
  if (ABLATABLE.indexOf(moduleName) < 0) throw new Error('not ablatable: ' + moduleName + ' (options: ' + ABLATABLE.join(', ') + ')');
  loop.ablations[moduleName] = !!on;
  return loop.ablations;
}
function isAblated(loop, m) { return !!loop.ablations[m]; }

/** Deterministic per-tick trace id. Same inputs, same trace, so replay reproduces ids. */
function traceFor(loop, now, readings) {
  return PK.newTraceId({ d: loop.domain, t: now, k: Object.keys(readings || {}).sort(), n: loop.ticks });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ONE TICK
// ─────────────────────────────────────────────────────────────────────────────────────────

function tick(loop, readings, now) {
  var traceId = traceFor(loop, now, readings);
  var rep = { traceId: traceId, at: now, tick: loop.ticks + 1, domain: loop.domain, steps: [] };
  var records = [];
  var seq = 0;
  function step(name, data) { rep.steps.push(Object.assign({ step: name }, data)); }
  function record(type, body) {
    var r = Object.assign({ id: 'rc_' + PK.sha256(PK.canonical({ t: traceId, ty: type, s: seq++ })).slice(0, 20), type: type, traceId: traceId, at: now }, body);
    records.push(r);
    return r;
  }

  // ── 1. AROUSAL (BLOCK_B4) ──────────────────────────────────────────────────────────────
  var enc = VIT.mayEncode(loop.vitals);
  if (!enc.allowed) {
    step('arousal', { allowed: false, state: enc.state, why: 'encoding is not permitted in state "' + enc.state + '"' });
    rep.halted = 'arousal';
    return finish(loop, rep, records, now);
  }
  step('arousal', { allowed: true, state: enc.state });

  // ── 2. BARRIER (BLOCK_B1) — every reading is a packet and every packet is admitted or not
  var manifest = loop.brain.channels.map(function (c) { return c.key; });
  var admitted = {}, rejected = [];
  Object.keys(readings || {}).forEach(function (key) {
    var pkt;
    try {
      pkt = PK.create({
        traceId: traceId, seq: seq++,
        sourceDomain: loop.domain, sourceModule: 'bind/' + loop.domain,
        signalKind: PK.KIND.OBSERVATION,
        role: PK.ROLE.DRIVER, direction: PK.DIRECTION.ASCENDING,
        /* IDENTITY TRAVELS INSIDE THE PACKET, so it is covered by the provenance hash
           and cannot be attached after admission. A value that arrives with a source key
           and one that arrives without are different claims, and the barrier must see
           the difference rather than have it added afterwards. */
        payload: identityPayload(key, readings[key]),
        eventTime: readings[key].eventTime !== undefined ? readings[key].eventTime : now,
        observationTime: now, processingTime: now,
        simulationStatus: readings[key].status || PK.STATUS.OBSERVED,
        confidence: null, salience: null
      });
    } catch (e) {
      rejected.push({ channel: key, why: 'packet construction failed: ' + e.message });
      return;
    }
    if (isAblated(loop, 'barrier')) { admitted[key] = admittedReading(pkt); return; }
    var a = BAR.admit(pkt, { now: now, sourceClass: readings[key].sourceClass || BAR.CLASS.SENSOR, manifest: manifest });
    if (!a.admitted) {
      rejected.push({ channel: key, reason: a.reason, why: a.why });
      if (loop.store) ST.quarantine(loop.store, pkt, a.reason + ': ' + a.why, now);
      return;
    }
    // Only OBSERVED packets become evidence. This is the second gate, and it is structural.
    var ev = PK.admitAsEvidence(pkt);
    if (!ev.admitted) { rejected.push({ channel: key, reason: 'not_evidence', why: ev.why }); return; }
    admitted[key] = admittedReading(pkt);
    record('observation', { packet: pkt });
  });
  step('barrier', { admitted: Object.keys(admitted).length, rejected: rejected.length, rejections: rejected, ablated: isAblated(loop, 'barrier') });

  // ── 3. DOMAIN CYCLE (BLOCK_B0/B5/B8) ──────────────────────────────────────────────────
  var cycle = BRAIN.cycle(loop.brain, admitted, now);
  step('domain_cycle', {
    abstained: !!cycle.state.abstained,
    departure: cycle.state.departure !== undefined ? cycle.state.departure : null,
    confidence: cycle.state.confidence !== undefined ? cycle.state.confidence : null,
    fusable: (cycle.sensors || []).filter(function (s) { return s.fusable; }).length,
    blind: (cycle.blind || []).length,
    dysregulated: !!(cycle.dysregulation && cycle.dysregulation.detected),
    findings: (cycle.findings || []).length
  });

  /**
   * ── 3b. DERIVE q AND r FROM EACH CHANNEL'S OWN INNOVATIONS (SPEC row 22) ─────────────
   *
   * After the cycle, so this tick's observation is in the innovation history, and on a
   * cadence rather than every tick: a variance re-estimated from a window that moved by
   * one sample is the same variance, and re-deriving each time would only add churn to
   * the audit log. Every derivation is recorded with its own basis.
   */
  var noiseDerivations = [];
  if (loop.deriveNoise && loop.ticks > 0 && (loop.ticks % loop.noiseEveryTicks === 0)) {
    loop.brain.channels.forEach(function (ch) {
      var d = C.deriveNoise(ch, now);
      if (!d.derived) return;
      noiseDerivations.push({ channel: ch.key, q: ch.q, r: ch.r, rBase: ch.rBase, rGain: ch.rGain,
                              qState: ch.noiseState.q, rState: ch.noiseState.r });
      record('noise_derived', { channel: ch.key, before: d.before, after: d.after,
                                r: { state: d.r.state, why: d.r.why, basis: d.r.basis || null },
                                q: { state: d.q.state, why: d.q.why, basis: d.q.basis || null } });
    });
  }
  if (noiseDerivations.length) step('derive_noise', { derived: noiseDerivations });

  // ── 4. RESOLVE DUE PREDICTIONS — BEFORE anything new is proposed ──────────────────────
  var resolutions = [];
  PRED.sweepExpired(loop.registry, now).forEach(function (p) {
    resolutions.push({ predictionId: p.id, status: p.status, why: p.resolution.why });
    record('prediction_expired', { predictionId: p.id, variable: p.variable });
  });

  PRED.due(loop.registry, now).forEach(function (p) {
    var obs = observeVariable(loop, p.variable, cycle, now);
    /**
     * THE EFFERENCE SUBTRACTION. Without it the next lines are self-confirmation.
     *
     * The copies are looked up BY WINDOW, not by "the latest copy for this variable". Keying
     * on variable alone would credit a prediction with an action that fired after it — and
     * would miss the case where several actions moved the same variable inside one horizon.
     * Every copy emitted between the prediction's creation and its evaluation counts, and
     * their predicted deltas SUM, because that is what the system did to itself in that window.
     */
    var effs = efferencesInWindow(loop, p.variable, p.createdAt, now);
    var eff = combineEfferences(effs);
    var explained = isAblated(loop, 'forwardModel')
      ? { value: 0, trusted: false, why: 'ABLATED: forward model disabled. Raw error is used as if it were world-caused. Self-caused change is being scored as external evidence.' }
      : PRED.explainedByAction(loop.forwardModel, eff);
    var r = PRED.resolve(loop.registry, p.id, obs, explained.value, now);
    if (r.error) { resolutions.push({ predictionId: p.id, error: r.error }); return; }
    resolutions.push({
      predictionId: p.id, variable: p.variable,
      observable: r.resolution.observable,
      hit: r.resolution.hit,
      rawError: r.resolution.rawError,
      efferenceExplained: r.resolution.efferenceExplained,
      predictionError: r.resolution.predictionError,
      contaminated: r.resolution.contaminated,
      selfCausedFraction: r.resolution.selfCausedFraction,
      efferenceTrusted: explained.trusted,
      efferenceNote: explained.why
    });
    record('prediction_resolved', { predictionId: p.id, resolution: r.resolution });

    if (r.resolution.observable) {
      // Forward model learns from SUPERVISED error (actual vs its own predicted delta).
      // Each contributing copy is credited separately, against its OWN baseline, so two
      // actions in one window do not both get blamed for the whole movement.
      if (effs.length && !isAblated(loop, 'forwardModel')) {
        effs.forEach(function (e) {
          var base = (e.baseline !== null && e.baseline !== undefined) ? e.baseline : p.expected;
          var actualDelta = (r.resolution.observed - base) / effs.length;
          var l = PRED.learn(loop.forwardModel, e, actualDelta, now);
          if (l.updated) record('forward_model_update', { modelKey: l.record.modelKey, supervisedError: l.record.supervisedError, before: l.record.before, after: l.record.after });
          PRED.learnLatency(loop.forwardModel, e, now - e.emittedAt);
        });
      }
      // The critic learns from the residual, not the raw error.
      if (eff && eff.actionId) {
        var effect = r.resolution.hit ? 1 : -1;
        var kind = eff.actionKind;
        SEL.recordOutcome(loop.gate, kind, effect, now);
        var link = MEM.linkOutcome(loop.memory, eff.actionId, {
          hit: r.resolution.hit,
          predictionError: r.resolution.predictionError,
          rawError: r.resolution.rawError,
          efferenceExplained: r.resolution.efferenceExplained,
          contaminated: r.resolution.contaminated,
          at: now
        });
        var outcome = PK.createOutcome({
          actionId: eff.actionId, traceId: p.traceId,
          predictedOutcome: { expected: p.expected, interval: p.interval },
          observedOutcome: { value: r.resolution.observed },
          observationWindow: { from: p.createdAt, to: now },
          rawError: r.resolution.rawError,
          efferenceExplained: r.resolution.efferenceExplained,
          predictionError: r.resolution.predictionError,
          confounders: r.resolution.contaminated ? ['self-caused change exceeds half the observed movement'] : [],
          causalAttributionConfidence: explained.trusted ? (1 - Math.abs(r.resolution.selfCausedFraction || 0)) : null,
          resolvedAt: now
        });
        record('outcome', { outcome: outcome, episodeLinked: link.linked });
      }
      /**
       * Close the prospective items — BOTH the prediction check and the action outcome.
       *
       * The first version closed only prediction items, so every action item stayed open
       * forever: 72 overdue after 332 ticks, which drove the homeostatic breach that put the
       * system into degraded mode. An outstanding-work register that only ever grows is not
       * tracking outstanding work, it is leaking.
       */
      /**
       * ── STRUCTURAL CREDIT (SPEC row 25) — WITHHELD BY DEFAULT, AND HERE IS WHY ──
       *
       * The available signal is: grade the edges that carried this trace by whether the
       * prediction they produced turned out right. It is a real resolved outcome, never a
       * mock — the same resolution that feeds the critic and the forward model. Enabled
       * over the full 362-row recorded corpus it produces a perfectly healthy-looking
       * trajectory: both integration edges dip to dormant early, recover on fresh
       * evidence, pass probation, and end active at utility 0.380 over 332 outcomes.
       *
       * IT IS STILL THE WRONG SIGNAL, and the healthy trajectory is what makes that worth
       * writing down rather than assuming. Two defects, neither visible in the result:
       *
       *   MISATTRIBUTION  a prediction's accuracy is a property of the forward model and
       *                   the channel. It does not measure whether delivering a residual
       *                   packet to a target helped. The edges are being scored for
       *                   someone else's work.
       *   NO RESOLUTION   the signal is trace-level. Measured: integration:ascending and
       *                   integration:descending finish with byte-identical counters at
       *                   every transition, because they co-fire on every tick. Two edges
       *                   this can never tell apart cannot be pruned against each other,
       *                   which is the entire point of the mechanism.
       *
       * A valid signal needs a counterfactual — deliver on one edge, withhold the other,
       * compare — against a target that does something observable. The integration targets
       * here are stubs and one domain is bound, so no such target exists. That is the same
       * missing peer row 24 is blocked on.
       *
       * So credit is REFUSED rather than approximated, and the refusal is recorded. A
       * mechanism that has never decided anything is a state the scorecard can report
       * honestly. One deciding confidently on a misattributed signal is the "wired means
       * working" substitution, and it would look exactly like success.
       * `topologyCredit: 'trace'` re-enables the measured path for that experiment only.
       */
      if (loop.topologyCredit === 'trace') {
        creditEdges(loop, p.traceId, {
          at: now, useful: !!r.resolution.hit,
          error: Math.abs(r.resolution.predictionError || 0), ref: p.id
        });
      } else if (!loop._creditRefusalRecorded) {
        loop._creditRefusalRecorded = true;
        record('topology_credit_withheld', {
          why: 'no edge-level outcome exists in this build. The available trace-level signal grades ' +
               'co-firing edges identically and attributes forward-model accuracy to the edges that ' +
               'carried the packet. Structural plasticity therefore observes and persists but does ' +
               'not decide.',
          blockedBy: 'stub integration targets and a single bound domain (see SPEC row 24)'
        });
      }

      var actionIds = effs.map(function (e) { return e.actionId; }).filter(Boolean);
      MEM.dueItems(loop.memory, now).forEach(function (i) {
        if (i.predictionId === p.id) {
          MEM.close(loop.memory, i.id, { resolved: true, hit: r.resolution.hit, predictionError: r.resolution.predictionError }, now);
        } else if (i.kind === 'action_outcome' && actionIds.indexOf(i.actionId) >= 0) {
          MEM.close(loop.memory, i.id, { resolved: true, hit: r.resolution.hit, viaPrediction: p.id, predictionError: r.resolution.predictionError }, now);
        }
      });
    }
  });
  step('resolve', { resolved: resolutions.length, detail: resolutions });

  // ── 4b. TOPOLOGY (SPEC row 25) — evaluated AFTER this tick's outcomes are recorded
  // and BEFORE this tick's routing, so a structural decision acts on every outcome
  // known at the moment it is taken.
  var topoFired = TOPO.evaluate(loop.topology, now).transitions;
  topoFired.forEach(function (t) { record('topology_transition', { transition: t }); });
  step('topology', {
    transitions: topoFired.length,
    fired: topoFired.map(function (t) { return t.edgeId + ': ' + t.from + ' -> ' + t.to; }),
    report: TOPO.report(loop.topology)
  });

  // ── 5. MODULATORS (BLOCK_B12) ─────────────────────────────────────────────────────────
  var hits = resolutions.filter(function (r) { return r.observable; });
  var reward = hits.length ? hits.reduce(function (a, r) { return a + (r.hit ? 1 : -1); }, 0) / hits.length : 0;
  var surprise = hits.length ? hits.reduce(function (a, r) { return a + Math.abs(r.predictionError || 0); }, 0) / hits.length : 0;
  var openPreds = loop.registry.order.filter(function (id) { return loop.registry.predictions[id].status === PRED.STATUS.OPEN; }).length;
  var modulation = isAblated(loop, 'modulators')
    ? { vigor: 0, patience: 0.5, unexpectedUncertainty: 0, expectedUncertainty: 0.5, plasticityGate: 0, ablated: true }
    : MOD.cycle(loop.modulators, {
        state: 'd:' + (cycle.state.abstained ? 'abstain' : quant(cycle.state.departure)),
        nextState: 'd:' + (cycle.state.abstained ? 'abstain' : quant(cycle.state.departure)),
        reward: reward, hasReward: hits.length > 0,
        surprise: surprise,
        channelVariances: (cycle.sensors || []).filter(function (s) { return s.fusable; }).map(function (s) { return s.variance; }),
        openPredictions: openPreds,
        resolvedPredictions: loop.registry.resolved.length
      });
  step('modulators', {
    vigor: modulation.vigor, patience: modulation.patience,
    unexpectedUncertainty: modulation.unexpectedUncertainty,
    expectedUncertainty: modulation.expectedUncertainty,
    plasticityGate: modulation.plasticityGate,
    ablated: !!modulation.ablated
  });

  // ── 6. ENCODE THE EPISODE — tag set HERE, at encode time (BLOCK_B15) ──────────────────
  var episode = null;
  if (!isAblated(loop, 'episodic')) {
    episode = MEM.encode(loop.memory, {
      traceId: traceId, at: now, domain: loop.domain,
      state: cycle.state, sensors: cycle.sensors, blind: cycle.blind,
      dysregulation: cycle.dysregulation, findings: cycle.findings,
      surprise: surprise
    });
    record('episode', { episodeId: episode.id, tag: episode.tag, signature: episode.signature, novelty: episode.novelty });
  }
  step('encode', episode ? { episodeId: episode.id, tag: episode.tag, novelty: episode.novelty, basis: episode.tagBasis } : { ablated: true });

  // ── 7. REGISTER A NEW FALSIFIABLE PREDICTION (BLOCK_B8) ───────────────────────────────
  //
  // THE INTERVAL IS DERIVED FROM THE VARIABLE'S OWN OBSERVED SPREAD, and if that spread is not
  // yet known the prediction is REFUSED rather than made with a guessed band.
  //
  // The first version of this used a fixed +/-60% band and produced a hit rate of 1.000 over
  // 314 resolutions on real data. That is not a well-calibrated system, it is a band that
  // cannot be wrong: precision moves far less than 60% between ticks, so every prediction was
  // trivially inside it. A registry that scored those as hits would have reported rising
  // confidence while measuring nothing. Measure-or-abstain is the only honest shape here.
  var prediction = null, predictionWhy = null;
  var target = pickPredictionTarget(cycle);
  recordVariableHistory(loop, cycle);
  if (target) {
    var vkey = 'channel:' + target.key + ':precision';
    var spread = observedSpread(loop, vkey);
    if (!spread) {
      predictionWhy = 'no measured spread for ' + vkey + ' yet (need ' + VAR_MIN_N + ' observations, have ' +
                      ((loop._varHistory && loop._varHistory[vkey] || []).length) + '); refusing to invent a band';
    } else {
      try {
        // +/-1 sd. Expected hit rate near 0.68 if the variable is roughly normal, which means
        // roughly a third of these predictions SHOULD miss. A hit rate near 1.0 here would be
        // evidence the band is still too wide, not evidence the system is good.
        var half = spread.sd;
        prediction = PRED.register(loop.registry, {
          traceId: traceId,
          variable: vkey,
          expected: target.precision,
          interval: [target.precision - half, target.precision + half],
          priorSpread: spread.sd * 2,
          confidence: cycle.state.confidence || null,
          uncertainty: target.variance,
          assumptions: ['channel remains live', 'cadence unchanged', 'no external re-instrumentation'],
          evidence: ['channel ' + target.key + ' precision sd ' + spread.sd.toFixed(6) + ' over its own last ' + spread.n + ' observations'],
          createdAt: now,
          evaluateAt: now + loop.horizonMs,
          evaluationCondition: 'posterior precision of channel ' + target.key + ' at t+' + loop.horizonMs + 'ms',
          responsibleDomain: loop.domain
        });
        record('prediction', { prediction: prediction });
        MEM.schedule(loop.memory, {
          traceId: traceId, kind: 'prediction_check', predictionId: prediction.id,
          trigger: 'clock', dueAt: prediction.evaluateAt,
          responsibleModule: 'kernel/loop', expectedObservation: prediction.evaluationCondition,
          closureCriteria: 'a precision reading for ' + target.key + ' exists at or after evaluateAt',
          at: now
        });
      } catch (e) { predictionWhy = e.message; }
    }
  } else {
    predictionWhy = 'no fusable channel this cycle — nothing observable to predict about';
  }
  step('predict', prediction ? { predictionId: prediction.id, variable: prediction.variable, expected: prediction.expected, interval: prediction.interval, horizonMs: prediction.horizonMs } : { registered: false, why: predictionWhy });

  // ── 8. CONNECTOME (BLOCK_B7/B9) ───────────────────────────────────────────────────────
  var routing = null;
  if (!isAblated(loop, 'connectome')) {
    var ascend = PK.create({
      traceId: traceId, seq: seq++,
      sourceDomain: loop.domain, sourceModule: 'kernel/loop',
      signalKind: cycle.dysregulation && cycle.dysregulation.detected ? PK.KIND.DIAGNOSIS : PK.KIND.PREDICTION_ERROR,
      role: PK.ROLE.DRIVER, direction: PK.DIRECTION.ASCENDING,
      // INV-9: the RESIDUAL ascends, never the full state.
      payload: { residual: cycle.state.abstained ? null : cycle.state.departure, drivers: (cycle.dysregulation && cycle.dysregulation.drivers) || [] },
      eventTime: now, observationTime: now, processingTime: now,
      simulationStatus: PK.STATUS.INFERRED,
      confidence: cycle.state.confidence || null,
      salience: cycle.dysregulation && cycle.dysregulation.detected ? 0.9 : 0.2,
      expiresAt: now + loop.horizonMs
    });
    routing = CX.submit(loop.connectome, ascend, now);
    noteRouted(loop, traceId, routing);
    // INV-7: a descending counterpart exists, carrying the prediction back down.
    if (prediction) {
      var descend = PK.create({
        traceId: traceId, seq: seq++, causalParentIds: [ascend.id],
        sourceDomain: loop.domain, sourceModule: 'kernel/loop',
        signalKind: PK.KIND.PREDICTION,
        role: PK.ROLE.MODULATOR, direction: PK.DIRECTION.DESCENDING,
        payload: { variable: prediction.variable, expected: prediction.expected, interval: prediction.interval },
        eventTime: now, observationTime: now, processingTime: now,
        simulationStatus: PK.STATUS.PREDICTED,
        confidence: prediction.confidence, salience: 0.4,
        expiresAt: prediction.expiresAt
      });
      noteRouted(loop, traceId, CX.submit(loop.connectome, descend, now));
    }
    CX.drain(loop.connectome, 32);
    record('routing', { report: routing, metrics: CX.snapshotMetrics(loop.connectome) });
  }
  step('connectome', routing ? { delivered: routing.delivered.length, dropped: routing.dropped, metrics: CX.snapshotMetrics(loop.connectome) } : { ablated: true });

  // ── 9. PROPOSE (the ACTOR) ────────────────────────────────────────────────────────────
  // `alreadyLowered` is what makes the removal path terminate: once a dead channel's attention
  // has been cut, it stops being proposed. Without it the system would re-lower the same
  // channel forever and INV-1's removal half would be an infinite loop rather than a cleanup.
  var lowered = Object.create(null);
  Object.keys(loop.attention).forEach(function (k) {
    var h = loop.attention[k].history || [];
    if (h.length && h[h.length - 1].to > h[h.length - 1].from) lowered[k] = true;   // r raised = attention lowered
  });
  var candidates = PROP.generate({ cycle: cycle, now: now, horizonMs: loop.horizonMs, alreadyLowered: lowered });
  step('propose', { count: candidates.length, kinds: candidates.map(function (c) { return c.kind; }), proposedBy: PROP.MODULE_ID });

  // ── 10. SELECT (the CRITIC + the gate) ────────────────────────────────────────────────
  var selection = isAblated(loop, 'selector')
    ? { outcome: 'unavailable', why: 'ABLATED: the selector is disabled. Candidates were generated and nothing was selected. The loop degrades here rather than bypassing the gate.' }
    : SEL.select(loop.gate, candidates, { now: now, modulation: modulation });
  record('selection', { selection: selection, candidates: candidates.map(function (c) { return { id: c.id, kind: c.kind }; }) });
  step('select', {
    outcome: selection.outcome, pathway: selection.pathway || null,
    released: selection.released ? selection.released.kind : null,
    why: selection.why || selection.reasonForSelection || null,
    rejected: (selection.reasonForRejectionOfAlternatives || []).length,
    threshold: selection.threshold, gap: selection.gap
  });

  // ── 11 + 12. EFFERENCE COPY, THEN COMMAND ─────────────────────────────────────────────
  var execution = null, efference = null, action = null;
  if (selection.outcome === 'released') {
    var cand = selection.released.candidate;
    try {
      action = PK.createAction({
        originatingTraceId: traceId,
        proposedBy: cand.proposedBy,
        selectedBy: selection.selectedBy,
        kind: cand.kind,
        affectedDomains: [loop.domain],
        parameters: Object.assign({}, cand.parameters, { movesVariable: cand.movesVariable }),
        expectedBenefits: cand.expectedBenefits,
        expectedHarms: cand.expectedHarms,
        uncertainty: cand.uncertainty,
        alternativesConsidered: (selection.ranked || []).map(function (r) { return r.candidateId; }),
        reasonForSelection: selection.reasonForSelection,
        reasonForRejectionOfAlternatives: selection.reasonForRejectionOfAlternatives,
        authority: cand.authority,
        reversibility: cand.reversibility,
        rollbackPlan: cand.rollbackPlan,
        selectedAt: now,
        expectedEvaluationTime: now + loop.horizonMs
      });

      if (cand.movesVariable && !isAblated(loop, 'forwardModel')) {
        var baseline = observeVariable(loop, cand.movesVariable, cycle, now);
        efference = PRED.efferenceCopy(loop.forwardModel, {
          traceId: traceId, actionId: action.actionId, actionKind: cand.kind,
          variable: cand.movesVariable, magnitude: cand.expectedMagnitude,
          emittedAt: now
        });
        efference.baseline = baseline ? baseline.value : null;
        if (!loop._efferences) loop._efferences = [];
        loop._efferences.push(efference);
        if (loop._efferences.length > 512) loop._efferences.shift();
        record('efference_copy', { efference: efference });

        /**
         * REGISTER THE FORWARD MODEL'S OWN CLAIM AS A FALSIFIABLE PREDICTION.
         *
         * The tick-level prediction (step 7) is about whichever channel has the deepest
         * baseline, which is usually NOT the channel this action moves. Measured: 24 of 33
         * raise_attention actions never had their outcome checked, because the only prediction
         * in flight concerned a different variable, so the action's own claim was untested and
         * its prospective item could never close.
         *
         * An efference copy is a prediction — "acting will move this variable by this much" —
         * and leaving it unregistered means the forward model asserts without ever being
         * scored. This registers it against the same variable the action moves, so the
         * supervised error has something to be an error ABOUT.
         */
        var mvSpread = observedSpread(loop, cand.movesVariable);
        if (mvSpread && efference.baseline !== null) {
          try {
            var actionPred = PRED.register(loop.registry, {
              traceId: traceId,
              variable: cand.movesVariable,
              expected: efference.baseline + efference.predictedDelta,
              interval: [efference.baseline + efference.predictedDelta - mvSpread.sd,
                         efference.baseline + efference.predictedDelta + mvSpread.sd],
              priorSpread: mvSpread.sd * 2,
              confidence: efference.trusted ? 0.6 : 0.3,
              uncertainty: efference.trusted ? 0.4 : 0.7,
              assumptions: ['the commanded change is applied at the stated gain', 'no competing action moves this variable'],
              evidence: ['efference copy ' + efference.id + ' from model ' + efference.modelKey + ' (n=' + efference.modelN + ')'],
              createdAt: now,
              evaluateAt: now + loop.horizonMs,
              evaluationCondition: 'observed value of ' + cand.movesVariable + ' at t+' + loop.horizonMs + 'ms',
              responsibleDomain: loop.domain,
              efferenceCopyId: efference.id
            });
            record('action_prediction', { predictionId: actionPred.id, variable: actionPred.variable, expected: actionPred.expected, fromEfference: efference.id });
            MEM.schedule(loop.memory, {
              traceId: traceId, kind: 'prediction_check', predictionId: actionPred.id,
              trigger: 'clock', dueAt: actionPred.evaluateAt,
              responsibleModule: 'kernel/loop', expectedObservation: actionPred.evaluationCondition,
              closureCriteria: 'a reading for ' + cand.movesVariable + ' exists at or after evaluateAt',
              at: now
            });
          } catch (e) {
            record('action_prediction_refused', { variable: cand.movesVariable, why: e.message });
          }
        }
      }

      execution = ACT.execute(loop.motor, action, { now: now, efferenceCopy: efference });
      record('execution', { execution: execution });

      if (episode) {
        episode.selection = { kind: cand.kind, candidateId: cand.id };
        episode.actionId = action.actionId;
        episode.efferenceCopyId = efference ? efference.id : null;
      }
    } catch (e) {
      loop.errors.push({ at: now, where: 'actuate', why: e.message });
      execution = { executionStatus: 'failed', failure: 'exception', why: e.message };
      record('execution_failed', { why: e.message });
    }
  }
  step('efference', efference
    ? { id: efference.id, variable: efference.variable, predictedDelta: efference.predictedDelta, trusted: efference.trusted, modelN: efference.modelN, note: efference.interpretation }
    : { emitted: false, why: selection.outcome === 'released' ? 'selected action does not move a measured variable, or the forward model is ablated' : 'nothing was released' });
  step('actuate', execution
    ? { status: execution.executionStatus, kind: execution.kind, effector: execution.effectorId || null, writtenBy: execution.executedBy || null, why: execution.why || null, gain: execution.commandedGain }
    : { executed: false, why: 'no action released' });

  /**
   * ── 13. PROSPECTIVE for the action itself ────────────────────────────────────────────
   *
   * ONLY for actions that move a measurable variable. An action that changes nothing has no
   * observation that could close its check, so scheduling one manufactures a permanently open
   * item. Measured: scheduling a check for every executed action produced 264 overdue items
   * across 332 ticks and drove the homeostatic breach that pushed the system into degraded
   * mode — an outstanding-work register that only grows is not tracking work, it is leaking.
   *
   * MASTER_PROMPT §8.12 requires a real closure criterion. "This action changed nothing, so
   * there is nothing to check" is a legitimate answer and it is recorded as one, rather than
   * being disguised as diligence by scheduling a check that can never resolve.
   */
  if (execution && execution.executionStatus === 'executed') {
    if (action.parameters && action.parameters.movesVariable) {
      MEM.schedule(loop.memory, {
        traceId: traceId, kind: 'action_outcome', actionId: execution.actionId,
        trigger: 'clock', dueAt: action.expectedEvaluationTime,
        responsibleModule: 'kernel/loop',
        expectedObservation: 'the measured effect of ' + execution.kind + ' on ' + action.parameters.movesVariable,
        closureCriteria: 'an outcome record exists for actionId ' + execution.actionId,
        at: now
      });
    } else {
      record('no_outcome_check', {
        actionId: execution.actionId, kind: execution.kind,
        why: 'this action declares no variable it moves, so no observation could close a check. ' +
             'Recorded rather than scheduled: an unclosable follow-up is a leak, not diligence.'
      });
    }
  }

  // ── 14 + 15. PERSIST AND SELF-MODEL ───────────────────────────────────────────────────
  loop.ticks++;
  loop.lastTickAt = now;
  ACT.tick(loop.motor, now);
  return finish(loop, rep, records, now, cycle, modulation);
}

function finish(loop, rep, records, now, cycle, modulation) {
  var written = 0, dupes = 0;
  if (loop.store) {
    records.forEach(function (r) {
      var w = ST.append(loop.store, r);
      if (w.written) written++; else if (w.reason === 'duplicate') dupes++;
    });
    ST.append(loop.store, {
      id: 'tk_' + PK.sha256(PK.canonical({ t: rep.traceId, n: loop.ticks })).slice(0, 20),
      type: 'tick', traceId: rep.traceId, at: now, tick: loop.ticks,
      readingsAdmitted: (rep.steps.filter(function (s) { return s.step === 'barrier'; })[0] || {}).admitted || 0
    });
    ST.snapshot(loop.store, serialize(loop), loop.ticks, now);
  }

  var mem = MEM.report(loop.memory, now);
  var cxm = CX.snapshotMetrics(loop.connectome);
  var self = VIT.selfModel(loop.vitals, {
    now: now,
    sensors: cycle ? cycle.sensors : [],
    internalConsistency: cycle && cycle.state && !cycle.state.abstained ? clamp01(1 - Math.abs(cycle.state.departure) / 4) : 0,
    measurements: {
      queueDepth: cxm.queueDepth,
      amplification: cxm.amplification.ratio === null ? 1 : cxm.amplification.ratio,
      openPredictions: loop.registry.order.filter(function (id) { return loop.registry.predictions[id].status === PRED.STATUS.OPEN; }).length,
      overdueProspective: mem.prospective.overdue,
      errorRate: loop.ticks ? loop.errors.length / loop.ticks : 0,
      blindFraction: cycle && cycle.sensors && cycle.sensors.length ? (cycle.sensors.length - cycle.sensors.filter(function (s) { return s.fusable; }).length) / cycle.sensors.length : 1
    },
    modulesAvailable: ABLATABLE.filter(function (m) { return !isAblated(loop, m); }),
    modulesUnavailable: ABLATABLE.filter(function (m) { return isAblated(loop, m); }),
    outstanding: mem.prospective,
    permissions: ['internal:attention', 'internal:escalate', 'internal:none']
  });
  var reg = VIT.regulate(loop.vitals, self.homeostasis, now);

  rep.persistence = { recordsWritten: written, duplicatesSkipped: dupes, logRecords: loop.store ? loop.store.count : 0, snapshotVersion: loop.ticks };
  rep.memory = mem;
  rep.selfModel = self;
  rep.regulation = reg;
  rep.modulation = modulation || null;
  rep.errors = loop.errors.slice(-4);
  return rep;
}

/**
 * SOURCE-SUPPLIED OBSERVATION IDENTITY, carried from the adapter to the channel.
 *
 * Only the three fields core/channel.js `sourceIdentity()` recognises are forwarded, and
 * nothing is synthesised: a reading with no source key produces a payload with no
 * identity, and the channel then reports `sourceIdentity: null`, which downstream must
 * treat as "cannot tell" rather than "no new data".
 *
 * This mattered because the loop used to rebuild the reading as `{ value }` at the
 * barrier. Every identity an adapter supplied was discarded one step before the only
 * consumer that could use it, so the divergence ledger could count polls and nothing
 * else — the defect SPEC row 10 has been blocked on, sitting two lines apart from the
 * code that needed it.
 */
var IDENTITY_FIELDS = ['observationId', 'sourceRecordId', 'sourceVersion', 'sourceObservedAt'];

function identityPayload(key, reading) {
  var p = { channel: key, value: reading.value };
  IDENTITY_FIELDS.forEach(function (f) {
    if (reading[f] !== undefined && reading[f] !== null) p[f] = reading[f];
  });
  return p;
}

/** The reading handed to the domain cycle: the value plus whatever identity was admitted. */
function admittedReading(pkt) {
  var r = { value: pkt.payload.value };
  IDENTITY_FIELDS.forEach(function (f) {
    if (pkt.payload[f] !== undefined) r[f] = pkt.payload[f];
  });
  return r;
}

/**
 * Which edges carried a trace. Bounded ring: a trace older than the window can no longer
 * be credited, which is stated as a miss rather than silently counting as zero edges.
 */
var ROUTED_WINDOW = 512;
function noteRouted(loop, traceId, report) {
  if (!report || !report.delivered || !report.delivered.length) return;
  if (!loop._routed) loop._routed = [];
  var hit = null;
  for (var i = loop._routed.length - 1; i >= 0; i--) if (loop._routed[i].traceId === traceId) { hit = loop._routed[i]; break; }
  if (!hit) { hit = { traceId: traceId, targets: [] }; loop._routed.push(hit); }
  report.delivered.forEach(function (d) { if (hit.targets.indexOf(d.target) < 0) hit.targets.push(d.target); });
  while (loop._routed.length > ROUTED_WINDOW) loop._routed.shift();
}

/** Grade every edge that carried `traceId`. Returns how many edges were credited. */
function creditEdges(loop, traceId, outcome) {
  var rec = null, list = loop._routed || [];
  for (var i = list.length - 1; i >= 0; i--) if (list[i].traceId === traceId) { rec = list[i]; break; }
  if (!rec) return 0;
  var n = 0;
  rec.targets.forEach(function (t) { if (TOPO.recordOutcome(loop.topology, t, outcome).recorded) n++; });
  return n;
}

/**
 * Read a named variable out of the current cycle. Returns null when the variable is not
 * observable this cycle — null flows into resolve() as UNRESOLVABLE, not as a zero.
 */
function observeVariable(loop, variable, cycle, now) {
  var parts = String(variable).split(':');
  if (parts[0] !== 'channel') return null;
  var key = parts[1], field = parts[2];
  var s = (cycle.sensors || []).filter(function (x) { return x.key === key; })[0];
  if (!s) return null;
  if (field === 'precision') {
    if (!s.fusable) return null;                       // not observable if the channel is not live
    return { value: s.precision, at: now, evidence: ['sensor ' + key + ' posterior precision'] };
  }
  if (field === 'departure') {
    if (!s.departure) return null;
    return { value: s.departure.z, at: now, evidence: ['sensor ' + key + ' departure z'] };
  }
  return null;
}

var VAR_MIN_N = 8;          // observations before a variable's own spread is usable
var VAR_WINDOW = 48;

/**
 * Track each observable variable's own history, so a prediction band can be derived from it.
 *
 * This is the same measure-or-abstain discipline core/channel.js uses for baselines, applied
 * one level up. Without it the only way to set a band is to guess a percentage, and a guessed
 * percentage is what produced a hit rate of 1.000 on the first run.
 */
function recordVariableHistory(loop, cycle) {
  if (!loop._varHistory) loop._varHistory = Object.create(null);
  (cycle.sensors || []).forEach(function (s) {
    if (!s.fusable || !isFinite(s.precision)) return;
    var k = 'channel:' + s.key + ':precision';
    if (!loop._varHistory[k]) loop._varHistory[k] = [];
    loop._varHistory[k].push(s.precision);
    if (loop._varHistory[k].length > VAR_WINDOW) loop._varHistory[k].shift();
  });
}

/** The variable's own sd. null below the floor — null means abstain, never "use a default". */
function observedSpread(loop, variable) {
  var h = (loop._varHistory && loop._varHistory[variable]) || [];
  if (h.length < VAR_MIN_N) return null;
  var m = h.reduce(function (a, b) { return a + b; }, 0) / h.length;
  var sd = Math.sqrt(h.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / h.length);
  if (!(sd > 1e-9)) return null;    // a constant variable cannot carry a falsifiable band
  return { mean: m, sd: sd, n: h.length };
}

/**
 * Every efference copy for `variable` emitted inside [from, to].
 *
 * The window, not the latest copy. A prediction may only be charged for actions that happened
 * during its own horizon — crediting it with a later action would attribute an effect that had
 * not occurred when the prediction was made, which is backwards causation dressed as accounting.
 */
function efferencesInWindow(loop, variable, from, to) {
  return (loop._efferences || []).filter(function (e) {
    return e.variable === variable && e.emittedAt >= from && e.emittedAt <= to;
  });
}

/**
 * Sum the predicted self-caused deltas across the window.
 *
 * `trusted` is AND-ed, not averaged: if any contributing model is untrusted, the combined
 * estimate is untrusted. One well-measured component does not license subtracting a total that
 * includes a guess.
 */
function combineEfferences(effs) {
  if (!effs || !effs.length) return null;
  if (effs.length === 1) return effs[0];
  var total = effs.reduce(function (a, e) { return a + e.predictedDelta; }, 0);
  var allTrusted = effs.every(function (e) { return e.trusted; });
  var minN = Math.min.apply(null, effs.map(function (e) { return e.modelN; }));
  return {
    id: effs.map(function (e) { return e.id; }).join('+'),
    traceId: effs[0].traceId,
    actionId: effs[effs.length - 1].actionId,
    actionKind: effs[effs.length - 1].actionKind,
    variable: effs[0].variable,
    magnitude: effs.reduce(function (a, e) { return a + e.magnitude; }, 0),
    predictedDelta: total,
    modelN: minN,
    trusted: allTrusted,
    baseline: effs[0].baseline,
    emittedAt: effs[0].emittedAt,
    combinedFrom: effs.length,
    interpretation: allTrusted
      ? effs.length + ' efference copies in the window; predicted deltas summed'
      : effs.length + ' copies in the window, at least one from an untrusted model (min n=' + minN + '); ' +
        'the combined self-caused component is UNKNOWN, not zero'
  };
}

/** The channel worth predicting about: live, with the most evidence behind it. */
function pickPredictionTarget(cycle) {
  var live = (cycle.sensors || []).filter(function (s) { return s.fusable && isFinite(s.precision); });
  if (!live.length) return null;
  live.sort(function (a, b) { return (b.departure ? b.departure.n : 0) - (a.departure ? a.departure.n : 0); });
  return live[0];
}

function quant(v) { return (typeof v === 'number' && isFinite(v)) ? String(Math.round(v * 2) / 2) : 'na'; }
function clamp01(v) { return (typeof v !== 'number' || !isFinite(v)) ? 0 : (v < 0 ? 0 : (v > 1 ? 1 : v)); }

// ─────────────────────────────────────────────────────────────────────────────────────────
// PERSISTENCE OF THE WHOLE LOOP
// ─────────────────────────────────────────────────────────────────────────────────────────

function serialize(loop) {
  return {
    version: loop.version,
    domain: loop.domain,
    ticks: loop.ticks,
    lastTickAt: loop.lastTickAt,
    horizonMs: loop.horizonMs,
    channels: loop.brain.channels,
    brainHistory: loop.brain.history,
    brainCycles: loop.brain.cycles,
    /* OPEN DIVERGENCE CLAIMS. Omitted until 2026-08-02, which made the ledger's own
       "survives restart" test true of the helper and false of the application: the unit
       test round-tripped DIV.serializeLedger directly, while the real path goes through
       here and dropped the ledger entirely. An open claim vanished on every restart and
       could never resolve. Testing the helper instead of the path it is reached by is
       the exact self-confirmation this file's header warns about elsewhere. */
    divergences: DIV.serializeLedger(loop.brain.divergences),
    registry: { predictions: loop.registry.predictions, order: loop.registry.order, resolved: loop.registry.resolved, version: loop.registry.version },
    forwardModel: PRED.serialize(loop.forwardModel),
    gate: SEL.serialize(loop.gate),
    motor: ACT.serialize(loop.motor),
    memory: MEM.serialize(loop.memory),
    consolidator: CON.serialize(loop.consolidator),
    modulators: MOD.serialize(loop.modulators),
    vitals: VIT.serialize(loop.vitals),
    attention: loop.attention,
    topology: TOPO.serialize(loop.topology),
    routed: loop._routed || [],
    efferences: loop._efferences || [],
    varHistory: loop._varHistory || {},
    ablations: loop.ablations,
    errors: loop.errors
  };
}

/**
 * Restore from a snapshot. Handlers are NOT restored — actuate.deserialize deliberately drops
 * them and wireMotor() re-registers, because a serialised handler would be the "wired ≠
 * invoked" substitution: the record would claim a listener that does not exist in this process.
 */
function restore(spec, snap) {
  var loop = create(spec);
  if (!snap) return loop;
  loop.ticks = snap.ticks || 0;
  loop.lastTickAt = snap.lastTickAt || null;
  loop.horizonMs = snap.horizonMs || loop.horizonMs;
  if (snap.channels) loop.brain.channels = snap.channels;
  loop.brain.history = snap.brainHistory || [];
  loop.brain.cycles = snap.brainCycles || 0;
  /* A snapshot written before divergences were persisted restores an empty ledger,
     which is correct for that data — there is nothing to restore. */
  loop.brain.divergences = DIV.restoreLedger(snap.divergences);
  if (snap.registry) {
    loop.registry.predictions = snap.registry.predictions || Object.create(null);
    loop.registry.order = snap.registry.order || [];
    loop.registry.resolved = snap.registry.resolved || [];
    loop.registry.version = snap.registry.version || 0;
  }
  loop.forwardModel = PRED.deserialize(snap.forwardModel || {});
  loop.gate = SEL.deserialize(snap.gate || {});
  var m = ACT.deserialize(snap.motor || {});
  m.handlers = loop.motor.handlers;      // re-registered, never restored
  loop.motor = m;
  loop.memory = MEM.deserialize(snap.memory);
  loop.consolidator = CON.deserialize(snap.consolidator);
  loop.modulators = MOD.deserialize(snap.modulators || {});
  loop.vitals = VIT.deserialize(snap.vitals);
  loop.attention = snap.attention || Object.create(null);
  /* A snapshot written before row 25 has no topology; the freshly-wired one from
     create() stands, which is correct for that data — there was nothing to restore. */
  if (snap.topology) {
    loop.topology = TOPO.deserialize(snap.topology);
    CX.attachTopology(loop.connectome, loop.topology);
  }
  loop._routed = snap.routed || [];
  loop._efferences = snap.efferences || [];
  loop._varHistory = snap.varHistory || Object.create(null);
  loop.ablations = snap.ablations || Object.create(null);
  loop.errors = snap.errors || [];
  return loop;
}

/** Consolidation pass. Requires the offline state; the loop does not force it. */
function consolidate(loop, now) {
  if (isAblated(loop, 'consolidation')) {
    return { ran: false, refused: 'ablated', why: 'ABLATED: consolidation disabled. Recent episodes stay accessible; long-term schema extraction stops.' };
  }
  var may = VIT.mayConsolidate(loop.vitals);
  if (!may.allowed) return { ran: false, refused: 'state_exclusivity', why: may.why };
  var res = CON.run(loop.consolidator, loop.memory, { now: now, arousalState: loop.vitals.arousal });
  if (loop.store && res.ran) {
    ST.append(loop.store, { id: 'cs_' + PK.sha256(PK.canonical({ p: res.pass, at: now })).slice(0, 20), type: 'consolidation', at: now, pass: res.pass, writes: res.writes, promotions: res.promotions });
    ST.snapshot(loop.store, serialize(loop), loop.ticks, now);
  }
  return res;
}

module.exports = {
  VERSION: VERSION,
  ABLATABLE: ABLATABLE,
  create: create,
  restore: restore,
  tick: tick,
  consolidate: consolidate,
  ablate: ablate,
  isAblated: isAblated,
  serialize: serialize,
  observeVariable: observeVariable
};
