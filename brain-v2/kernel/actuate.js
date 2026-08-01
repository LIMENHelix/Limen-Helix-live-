/**
 * brain-v2/kernel/actuate.js — BLOCK_B11. THE MOTOR PATH. Where selection becomes effect.
 *
 * SPEC B11, rows 1, 2, 20. MASTER_PROMPT §6G, §13. Fidelity: F0.
 *
 * THIS IS LESION #1 IN THE STANDING DIAGNOSIS. Four properties make the difference between an
 * actuator and a queue, and all four are enforced here rather than documented:
 *
 * 1. A LISTENER EXISTS, AND THE TEST IS BINARY. `register()` must have been called for the
 *    action kind or `execute()` refuses. An action-selected event with no subscriber is not a
 *    queued action, it is a dead axon, and this module will say so by name rather than let it
 *    sit in a list looking pending.
 *
 * 2. `executed` IS WRITTEN BY THE ACTUATOR, ON RECEIPT OF EFFECT. Never by the approver, never
 *    on dispatch. The effector returns a receipt and only that receipt sets the flag. A system
 *    that writes its own execution flag at approval time believes its intentions are actions —
 *    SPEC row 2, and the reason a live handler in this repo reported `success:true` on a defect
 *    count that had not moved for nineteen days.
 *
 * 3. REFRACTORINESS AND ADAPTATION ARE TWO MECHANISMS, NOT ONE (INV-10, row 20).
 *      refractory — absolute dead time after firing. Nothing fires, at any drive.
 *      adaptation — gain decrement under SUSTAINED drive. Repeated firing weakens the effect.
 *    A single rate limiter is refractoriness only, and a system with no adaptation never
 *    habituates: it re-litigates the same unreinforced action forever at full strength.
 *
 * 4. NO COMMAND WITHOUT AN EFFERENCE COPY (INV-14, SPEC Part 15). `execute()` throws if the
 *    caller has not supplied one for an action that declares `movesVariable`. This is the
 *    ordering constraint the neurologist insisted on: the copy exists before the effect
 *    returns, or the returning effect cannot be attributed.
 *
 * FINAL COMMON PATH: many upstream proposals converge on a bounded set of effectors. The
 * actuator count, not the proposal count, is the real throughput. Exceeding it produces
 * backlog, and backlog is reported as backlog rather than as pending work.
 */

'use strict';

var MODULE_ID = 'brain-v2/actuate';

var DEFAULTS = {
  effectorCount: 2,          // the final common path. Bounded on purpose.
  refractoryMs: 2 * 3600000, // absolute dead time per effector [mark: prior]
  adaptationStep: 0.25,      // gain lost per consecutive unreinforced firing
  adaptationRecovery: 0.10,  // gain recovered per quiet period
  minGain: 0.10
};

function createMotor(opts) {
  var o = Object.assign({}, DEFAULTS, opts || {});
  var effectors = [];
  for (var i = 0; i < o.effectorCount; i++) {
    effectors.push({
      id: 'eff' + i,
      refractoryUntil: 0,     // INV-10 mechanism 1
      gain: 1.0,              // INV-10 mechanism 2
      consecutive: 0,
      fired: 0,
      lastFiredAt: null,
      lastKind: null
    });
  }
  return {
    opts: o,
    effectors: effectors,
    handlers: Object.create(null),   // actionKind -> handler. The listener test.
    pending: [],
    executed: [],
    backlog: 0,
    version: 0
  };
}

/**
 * Register an effector handler for an action kind. THIS IS THE LISTENER (row 1).
 * The handler must return a receipt: { applied:boolean, observedEffect, at, detail }.
 * A handler that returns nothing is treated as a failure, not a success — silence is not
 * confirmation.
 */
function register(motor, actionKind, handler) {
  if (typeof handler !== 'function') throw new Error('handler for "' + actionKind + '" must be a function');
  motor.handlers[actionKind] = handler;
  motor.version++;
  return motor;
}

/** Row 1 as a query. Which selected kinds would currently reach nothing. */
function listenerAudit(motor, kinds) {
  var dead = kinds.filter(function (k) { return typeof motor.handlers[k] !== 'function'; });
  return {
    registered: Object.keys(motor.handlers),
    deadAxons: dead,
    allKindsHaveListener: dead.length === 0,
    why: dead.length ? 'these selected kinds have no subscriber; selecting one would complete and reach nothing: ' + dead.join(', ') : null
  };
}

/**
 * The null path. Tracks adaptation (so repeated no-ops still habituate) but never goes
 * refractory and is never counted in the throughput ceiling.
 */
function nullEffector(motor) {
  if (!motor._null) motor._null = { id: 'null', refractoryUntil: 0, gain: 1.0, consecutive: 0, fired: 0, lastFiredAt: null, lastKind: null, engagesNothing: true };
  return motor._null;
}

function availableEffector(motor, now) {
  for (var i = 0; i < motor.effectors.length; i++) {
    if (now >= motor.effectors[i].refractoryUntil) return motor.effectors[i];
  }
  return null;
}

/**
 * EXECUTE.
 *
 * Order matters and is not negotiable:
 *   listener check -> effector availability -> efference copy present -> emit copy ->
 *   dispatch -> await receipt -> write executed
 *
 * The efference copy is emitted BEFORE dispatch. If it were emitted after, it would be a
 * description of what happened rather than a prediction of what would, and reafference
 * cancellation using a post-hoc "prediction" is circular.
 */
function execute(motor, action, ctx) {
  ctx = ctx || {};
  var now = ctx.now;
  motor.version++;

  // 1. LISTENER. Binary test, named failure.
  var handler = motor.handlers[action.kind];
  if (typeof handler !== 'function') {
    var dead = {
      actionId: action.actionId, kind: action.kind,
      executionStatus: 'failed',
      failure: 'dead_axon',
      why: 'no effector is registered for action kind "' + action.kind + '". Selection completed and ' +
           'reached nothing. This is SPEC row 1 — a severed corticospinal tract, not a queued item.',
      at: now
    };
    motor.pending.push(dead);
    motor.backlog++;
    return dead;
  }

  /**
   * 2. FINAL COMMON PATH. Bounded effectors; over capacity is backlog, not throughput.
   *
   * An action that declares no variable it moves engages no effector. That is not a loophole:
   * the final common path models how many real CHANGES the system can make, and a null action
   * makes none. Counting it against the ceiling would make the throughput number measure
   * decisions rather than effects, which is the wrong quantity. Measured on the first real run,
   * `no_action` was consuming both effectors and generating a backlog of 18.
   */
  var engages = !!(action.parameters && action.parameters.movesVariable);
  var eff = engages ? availableEffector(motor, now) : nullEffector(motor);
  if (!eff) {
    var waits = motor.effectors.map(function (e) { return e.refractoryUntil; });
    var blocked = {
      actionId: action.actionId, kind: action.kind,
      executionStatus: 'deferred',
      failure: 'refractory',
      why: 'all ' + motor.effectors.length + ' effectors are within absolute refractory period; ' +
           'earliest availability ' + Math.min.apply(null, waits) + '. Upstream capacity exceeding ' +
           'actuator capacity produces backlog, not output.',
      retryAfter: Math.min.apply(null, waits),
      at: now
    };
    motor.pending.push(blocked);
    motor.backlog++;
    return blocked;
  }

  // 3. EFFERENCE COPY REQUIRED. INV-14 / SPEC Part 15.
  if (action.parameters && action.parameters.movesVariable && !ctx.efferenceCopy) {
    throw new Error(
      'INV-14: action "' + action.kind + '" declares it moves "' + action.parameters.movesVariable +
      '" but no efference copy was supplied. Commanding without a copy means the returning effect ' +
      'cannot be attributed, and self-caused change will be scored as external evidence. Refusing to fire.'
    );
  }

  // 4. ADAPTATION applies to the commanded magnitude. Repeated unreinforced firing of the same
  //    kind weakens the effect — this is habituation, and it is why the same action does not
  //    keep landing at full force forever.
  if (eff.lastKind === action.kind) {
    eff.consecutive++;
    eff.gain = Math.max(motor.opts.minGain, eff.gain - motor.opts.adaptationStep);
  } else {
    eff.consecutive = 0;
    eff.gain = Math.min(1.0, eff.gain + motor.opts.adaptationRecovery);
  }

  // 5. DISPATCH. The handler is the only thing that can report an effect.
  var receipt = null, err = null;
  try {
    receipt = handler({
      action: action,
      gain: eff.gain,
      effectorId: eff.id,
      now: now,
      efferenceCopy: ctx.efferenceCopy || null
    });
  } catch (e) {
    err = e.message;
  }

  // 6. REFRACTORY starts at dispatch, regardless of outcome. A failed action still consumed
  //    the effector; pretending otherwise would let a failing action retry without limit.
  //    Only real effectors go refractory — the null path has nothing to exhaust.
  if (engages) {
    eff.refractoryUntil = now + motor.opts.refractoryMs;
    eff.lastFiredAt = now;
    eff.fired++;
  }
  eff.lastKind = action.kind;

  if (err || !receipt || receipt.applied !== true) {
    var failed = {
      actionId: action.actionId, kind: action.kind, effectorId: eff.id,
      executionStatus: 'failed',
      failure: err ? 'handler_threw' : 'no_receipt',
      why: err || 'the effector returned no receipt or did not confirm application. Silence is not confirmation.',
      commandedGain: eff.gain,
      at: now
    };
    motor.executed.push(failed);
    return failed;
  }

  // 7. EXECUTED — written HERE, by the actuator, on receipt of effect. Row 2.
  var rec = {
    actionId: action.actionId,
    traceId: action.originatingTraceId,
    kind: action.kind,
    effectorId: eff.id,
    executionStatus: 'executed',
    executedBy: MODULE_ID,
    executionTime: (typeof receipt.at === 'number') ? receipt.at : now,
    commandedGain: eff.gain,
    consecutiveFirings: eff.consecutive,
    observedEffect: (receipt.observedEffect === undefined) ? null : receipt.observedEffect,
    detail: receipt.detail || null,
    efferenceCopyId: ctx.efferenceCopy ? ctx.efferenceCopy.id : null,
    expectedEvaluationTime: action.expectedEvaluationTime,
    // Stated on the record so nothing downstream has to infer it.
    writtenBy: 'actuator on receipt of effect — never by the approver (SPEC row 2)'
  };
  motor.executed.push(rec);
  return rec;
}

/** Quiet-period recovery. Adaptation is reversible; refractoriness simply expires. */
function tick(motor, now) {
  motor.effectors.forEach(function (e) {
    if (e.lastFiredAt !== null && (now - e.lastFiredAt) > motor.opts.refractoryMs * 2) {
      e.gain = Math.min(1.0, e.gain + motor.opts.adaptationRecovery);
      e.consecutive = 0;
    }
  });
  return motor;
}

function report(motor, now) {
  return {
    effectors: motor.effectors.map(function (e) {
      return {
        id: e.id, fired: e.fired, gain: e.gain, consecutive: e.consecutive,
        refractory: now < e.refractoryUntil,
        refractoryUntil: e.refractoryUntil, lastKind: e.lastKind
      };
    }),
    registeredKinds: Object.keys(motor.handlers),
    executed: motor.executed.filter(function (r) { return r.executionStatus === 'executed'; }).length,
    failed: motor.executed.filter(function (r) { return r.executionStatus === 'failed'; }).length,
    backlog: motor.backlog,
    pending: motor.pending.length,
    throughputCeiling: motor.effectors.length + ' effectors / ' + motor.opts.refractoryMs + 'ms refractory'
  };
}

function serialize(motor) {
  return { opts: motor.opts, effectors: motor.effectors, backlog: motor.backlog, version: motor.version };
}
function deserialize(o) {
  var m = createMotor(o.opts);
  if (o.effectors) m.effectors = o.effectors;
  m.backlog = o.backlog || 0;
  m.version = o.version || 0;
  return m;   // handlers are re-registered by the caller: a handler cannot be serialised, and
              // silently restoring one would be the "wired ≠ invoked" substitution.
}

module.exports = {
  MODULE_ID: MODULE_ID,
  DEFAULTS: DEFAULTS,
  createMotor: createMotor,
  register: register,
  listenerAudit: listenerAudit,
  execute: execute,
  tick: tick,
  report: report,
  serialize: serialize,
  deserialize: deserialize
};
