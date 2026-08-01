/**
 * brain-v2/kernel/propose.js — THE ACTOR. Generates competing action candidates.
 *
 * SPEC B10 (actor/critic separation), MASTER_PROMPT §8.8 ("the selector must not originate
 * every candidate itself"). Fidelity: F0.
 *
 * THIS IS A SEPARATE FILE FROM select.js FOR A STRUCTURAL REASON, not a stylistic one.
 *
 * SPEC row 19: actor and critic must be separate, or scoring is self-confirming. If proposal
 * and selection lived in one module they would share state, and the thing that decides what is
 * worth doing would be the same thing that decides whether it worked. packet.createAction()
 * enforces `proposedBy !== selectedBy` at construction, and the only way to satisfy that
 * honestly is for the two to be different modules with different names. Splitting the file is
 * how the constraint stays true when someone edits it later.
 *
 * WHAT A CANDIDATE MUST CARRY (MASTER_PROMPT §6E). Missing fields throw. A candidate with no
 * stated harm, no reversibility and no rollback is not a proposal, it is a wish.
 */

'use strict';

var MODULE_ID = 'brain-v2/propose';

/**
 * ACTION KINDS available to this build. All internal, all reversible.
 *
 * MASTER_PROMPT §6G: do not manufacture an external action merely to make the system appear
 * autonomous. Nothing here touches the network, the repository, or the live site. The two
 * substantive kinds change what the brain itself attends to next cycle, which is a real
 * internal effect with a measurable consequence — and, importantly, one that contaminates the
 * brain's own afferent stream, which is what makes the forward model necessary rather than
 * decorative.
 */
var KIND = {
  RAISE_ATTENTION:  'raise_attention',   // reallocate sampling/precision toward a channel
  LOWER_ATTENTION:  'lower_attention',   // reallocate away
  COLLECT_EVIDENCE: 'collect_evidence',  // defer, ask for another cycle of data
  NO_ACTION:        'no_action',         // explicit null action; must compete like the others
  ESCALATE:         'escalate'           // hand to a human; the system stops here
};

var REQUIRED = ['kind', 'rationale', 'expectedBenefits', 'expectedHarms', 'reversibility', 'rollbackPlan', 'authority', 'addressesState'];

/**
 * WHICH KINDS ENGAGE A PHYSICAL EFFECTOR.
 *
 * The final common path bounds how many real CHANGES the system can make. A null action makes
 * no change and must not consume that capacity, or the throughput ceiling would be measuring
 * decisions rather than effects. Rule: an action engages an effector exactly when it declares
 * a variable it moves.
 */
function engagesEffector(cand) { return !!cand.movesVariable; }

function makeCandidate(spec) {
  REQUIRED.forEach(function (f) {
    if (spec[f] === undefined || spec[f] === null || spec[f] === '') {
      throw new Error('candidate missing required field "' + f + '" — a proposal with no stated ' + f + ' cannot be scored');
    }
  });
  return {
    id: spec.id,
    proposedBy: MODULE_ID,
    kind: spec.kind,
    target: spec.target || null,
    parameters: spec.parameters || {},
    rationale: spec.rationale,
    expectedBenefits: spec.expectedBenefits.slice(),
    expectedHarms: spec.expectedHarms.slice(),
    evidenceQuality: numOr(spec.evidenceQuality, 0),
    uncertainty: numOr(spec.uncertainty, 1),
    urgency: numOr(spec.urgency, 0),
    reversibility: spec.reversibility,          // 'full' | 'partial' | 'none'
    // How much this candidate ENGAGES the condition actually detected this cycle.
    // Without this term the critic scores safety rather than value, and the null action wins
    // every time by being maximally certain and maximally reversible. Measured on the first
    // real run: no_action took 90 of 90 releases across 332 ticks.
    addressesState: numOr(spec.addressesState, 0),
    cost: numOr(spec.cost, 0),
    authority: spec.authority,
    rollbackPlan: spec.rollbackPlan,
    expectedEvaluationMs: numOr(spec.expectedEvaluationMs, 0),
    // The variable this action is expected to move. REQUIRED for anything that acts on the
    // brain's own sensing, because it is what the efference copy is keyed on. An action that
    // moves a variable without declaring it is the contamination path.
    movesVariable: spec.movesVariable || null,
    expectedMagnitude: numOr(spec.expectedMagnitude, 0)
  };
}

/**
 * GENERATE — from the domain brain's current cycle output.
 *
 * Always returns at least two candidates including NO_ACTION, because a "choice" with one
 * option is not a selection and would let the gate report a decision it never made.
 */
function generate(ctx) {
  var cycle = ctx.cycle;                 // output of core/brain.js cycle()
  var now = ctx.now;
  var alreadyLowered = ctx.alreadyLowered || {};   // channels whose attention was already cut
  var out = [];

  /**
   * UNADDRESSED — how much of the current state has something actionable about it.
   *
   * This one number decides whether inaction is relevant, and getting it wrong is what made
   * the first two runs pathological. Version 1 gave no_action a flat relevance of 1.0 and it
   * won 90 of 90 releases. Version 2 made it conditional on dysregulation only, and since
   * dysregulation fired on 5 ticks of 332 the null action still tied everything and the gate
   * held 332 times out of 332 — total regulatory paralysis, which SPEC Part 9 lists as a
   * pathology in its own right, not as caution.
   *
   * The honest quantity is: is there anything here worth doing. Two sources, and the second
   * is the one that matters on this data — ten channels have been constant for the whole
   * window and are still being sampled at full precision. That IS actionable, it is INV-1's
   * removal half, and a system that calls that state "nothing to do" is not being careful.
   */
  var sensors = cycle.sensors || [];
  var deadNotLowered = sensors.filter(function (s) { return s.state === 'dead' && !alreadyLowered[s.key]; });
  var deadFraction = sensors.length ? deadNotLowered.length / sensors.length : 0;
  var dysSeverity = (cycle.dysregulation && cycle.dysregulation.detected)
    ? Math.min(0.95, 0.5 + Math.abs(cycle.dysregulation.departure || 0) / 8)
    : 0;
  /**
   * Blindness counts ONLY where it is remediable. A channel that is still accumulating
   * observations ('unknown' liveness) will resolve if we keep looking, so waiting is a real
   * option with a real payoff. A channel that is dead or absent will not resolve by waiting,
   * and counting it here would make collect_evidence look valuable forever.
   */
  var remediable = sensors.filter(function (s) { return s.liveness === 'unknown' && s.state !== 'dead'; }).length;
  var remediableFraction = sensors.length ? remediable / sensors.length : 0;
  var unaddressed = Math.max(dysSeverity, deadFraction, remediableFraction);

  // NO_ACTION always competes. It is not a fallback; it is a candidate that can win on merit.
  out.push(makeCandidate({
    id: 'cand_no_action',
    kind: KIND.NO_ACTION,
    rationale: 'current state is within tolerance, or evidence is too thin to justify moving attention',
    expectedBenefits: ['no perturbation of the afferent stream', 'no self-caused change to explain away later'],
    expectedHarms: ['a real dysregulation may go unaddressed for one cycle'],
    // Inaction is relevant exactly to the extent that nothing is actionable. This is the
    // opportunity cost of doing nothing, made explicit and made to move with the state.
    addressesState: Math.max(0.05, 1 - unaddressed),
    evidenceQuality: 1.0,
    uncertainty: 0.0,
    urgency: 0,
    reversibility: 'full',
    cost: 0,
    authority: 'internal:none',
    rollbackPlan: 'nothing to roll back',
    expectedEvaluationMs: ctx.horizonMs
  }));

  // COLLECT_EVIDENCE — the honest response to blindness. Proposed whenever channels are
  // missing, because "act anyway" and "look harder" must compete rather than one being default.
  var blindCount = (cycle.blind || []).length;
  if (blindCount > 0) {
    out.push(makeCandidate({
      id: 'cand_collect',
      kind: KIND.COLLECT_EVIDENCE,
      target: null,
      parameters: { blindChannels: cycle.blind.map(function (b) { return b.what; }).slice(0, 12) },
      rationale: blindCount + ' of ' + (cycle.sensors || []).length + ' channels are not fusable this cycle; ' +
                 'acting on the remainder risks a confident claim from a narrow sensorium',
      expectedBenefits: ['wider channel base before committing', 'reduces single-channel interoception risk'],
      expectedHarms: ['one cycle of delay', 'if the channels are permanently dead, waiting buys nothing'],
      addressesState: remediableFraction > 0 ? Math.min(1, remediableFraction * 1.5) : 0.15,
      evidenceQuality: 0.6,
      uncertainty: 0.4,
      urgency: 0.2,
      reversibility: 'full',
      cost: 0.1,
      authority: 'internal:none',
      rollbackPlan: 'no state change to reverse',
      expectedEvaluationMs: ctx.horizonMs
    }));
  }

  // RAISE_ATTENTION on the strongest driver of dysregulation. This is the candidate that
  // actually moves something the brain also measures — the reason B14 exists.
  var drivers = (cycle.dysregulation && cycle.dysregulation.drivers) || [];
  if (drivers.length) {
    var d = drivers[0];
    out.push(makeCandidate({
      id: 'cand_raise_' + d.key,
      kind: KIND.RAISE_ATTENTION,
      target: d.key,
      parameters: { channel: d.key, factor: 1.5 },
      rationale: 'channel "' + d.key + '" is ' + d.z.toFixed(2) + ' sd from its own baseline (n=' + d.n + '); ' +
                 'raising its sampling precision should sharpen the estimate of whether this is real',
      expectedBenefits: ['faster resolution of the departure', 'lower variance on the driving channel'],
      expectedHarms: [
        'CONTAMINATION: raising precision changes this channel own reported variance, which is ' +
        'a quantity the brain uses to judge the channel. Self-caused change must be subtracted ' +
        'or it will be scored as evidence the departure is real.',
        'attention is capacity-limited; other channels get less'
      ],
      addressesState: Math.min(1, 0.5 + Math.abs(d.z) / 6),
      evidenceQuality: Math.min(1, d.n / 12),
      uncertainty: 1 / (1 + Math.abs(d.z)),
      urgency: Math.min(1, Math.abs(d.z) / 4),
      reversibility: 'full',
      cost: 0.3,
      authority: 'internal:attention',
      rollbackPlan: 'restore prior precision multiplier for ' + d.key + ' from the log',
      expectedEvaluationMs: ctx.horizonMs,
      movesVariable: 'channel:' + d.key + ':precision',
      expectedMagnitude: 0.5
    }));
  }

  // LOWER_ATTENTION on a dead channel. The removal half of the pair (INV-1): if the system can
  // raise attention it must be able to lower it, or attention only ever accumulates.
  if (deadNotLowered.length) {
    var dead = deadNotLowered;
    out.push(makeCandidate({
      id: 'cand_lower_' + dead[0].key,
      kind: KIND.LOWER_ATTENTION,
      target: dead[0].key,
      parameters: { channel: dead[0].key, factor: 0.5 },
      rationale: 'channel "' + dead[0].key + '" has not moved across its liveness window; ' +
                 deadNotLowered.length + ' of ' + sensors.length + ' channels are dead and still sampled at full rate',
      expectedBenefits: ['capacity returned to channels that move', 'INV-1: the removal half of raise_attention'],
      expectedHarms: ['if the channel resumes moving, we will notice later than we would have'],
      // Scales with how much of the sensorium is sitting dead at full attention. Ten dead
      // channels is a large standing waste; one is not. Channels already lowered are excluded
      // upstream, so this candidate stops proposing itself once the cleanup is done — that is
      // what makes the removal path terminate instead of looping.
      addressesState: Math.max(0.3, deadFraction),
      evidenceQuality: 0.7,
      uncertainty: 0.3,
      urgency: 0.1,
      reversibility: 'full',
      cost: 0.1,
      authority: 'internal:attention',
      rollbackPlan: 'restore prior precision multiplier for ' + dead[0].key + ' from the log',
      expectedEvaluationMs: ctx.horizonMs,
      movesVariable: 'channel:' + dead[0].key + ':precision',
      expectedMagnitude: -0.5
    }));
  }

  // ESCALATE — when the state is severe AND the evidence is thin, the correct move is to stop.
  if (cycle.dysregulation && cycle.dysregulation.detected && (cycle.state.confidence || 0) < 0.4) {
    out.push(makeCandidate({
      id: 'cand_escalate',
      kind: KIND.ESCALATE,
      rationale: 'dysregulation detected at low confidence (' + (cycle.state.confidence || 0).toFixed(2) + ') — ' +
                 'this is the combination where an autonomous action is least defensible',
      expectedBenefits: ['a human sees the case before anything moves'],
      addressesState: 0.85,
      expectedHarms: ['latency is now human latency'],
      evidenceQuality: 0.5,
      uncertainty: 0.5,
      urgency: 0.8,
      reversibility: 'full',
      cost: 0.5,
      authority: 'internal:escalate',
      rollbackPlan: 'withdraw the escalation record',
      expectedEvaluationMs: ctx.horizonMs
    }));
  }

  return out;
}

function numOr(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

module.exports = { MODULE_ID: MODULE_ID, KIND: KIND, generate: generate, makeCandidate: makeCandidate, engagesEffector: engagesEffector };
