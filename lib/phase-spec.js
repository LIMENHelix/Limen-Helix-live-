/**
 * lib/phase-spec.js — what each P0-P10 actually MEANS, and therefore what a subscriber gets.
 *
 * WHY THIS EXISTS. The paid rungs were named like generic SaaS tiers ("The Playbook", "The
 * Analyst", "Command"). Those names describe a price point, not a phase, so the ladder read as
 * eleven invented tiers rather than one structure. LIMEN already has a definition of every
 * phase, in scripts/kernel-validation/LIMEN_RECURSION_ARC.md, and the deliverable should BE
 * that phase expressed in a domain's own data.
 *
 * The meaning column here is compressed from that document and must not drift from it. The
 * `delivers` column is the translation: given that meaning, what lands in someone's inbox.
 *
 * `state` is the arc's own grammar: holding / breaking / driving. It matters because it tells
 * you the SHAPE of the alert. A breaking phase is an event you must be told about the day it
 * happens; a holding phase is a rhythm you subscribe to; a driving phase is a trend you watch
 * accumulate.
 */

var PHASES = [
  {
    code: 'P0', title: 'Source', state: 'holding',
    meaning: 'Undifferentiated potential. No distinction has been drawn yet, nothing is in transition. Latent, not dead.',
    delivers: 'The raw live read of the domain, free and open. The field before anything has moved.',
    signal: 'the current state, unfiltered'
  },
  {
    code: 'P1', title: 'First Distinction', state: 'breaking',
    meaning: 'The first measurable difference. Uniformity breaks and something becomes distinguishable from its background. Generative, not a failure.',
    delivers: 'The moment YOUR thing first becomes distinguishable: it appears, is named, is filed, or departs from its own baseline. The first time it is no longer part of the background.',
    signal: 'first appearance, or first departure from baseline'
  },
  {
    code: 'P2', title: 'Rhythm', state: 'holding',
    meaning: 'The first stable recurring structure. A repeatable loop the system can sustain.',
    delivers: 'The repeating pattern around what you track: the regular briefing, on the cadence the source itself moves at.',
    signal: 'the recurring, predictable flow'
  },
  {
    code: 'P3', title: 'Fracture', state: 'breaking',
    meaning: 'Pattern coherence breaks down. The diagnostic moment that reveals the limit of the current structure. Necessary, not terminal.',
    delivers: 'The alert that the established pattern just broke: a threshold crossed, a streak ended, a number outside its own history.',
    signal: 'a break from the established pattern'
  },
  {
    code: 'P4', title: 'Scaffolding', state: 'driving',
    meaning: 'External support is brought in to hold the fracture. Borrowed structure, not self-generated. Coherence held from outside.',
    delivers: 'Who or what is being propped up from outside: emergency measures, rescue funding, waivers, interim rules, extended deadlines. The tell that something could not hold on its own.',
    signal: 'external support arriving'
  },
  {
    code: 'P5', title: 'Endurance', state: 'driving',
    meaning: 'The scaffolds are internalised. A new self-sustaining regime, running on its own generation, distinct from the prior one.',
    delivers: 'What is now holding under its own power, and for how long: the sustained trend, the thing that survived without props.',
    signal: 'sustained self-supported trend'
  },
  {
    code: 'P6', title: 'Order', state: 'holding',
    meaning: 'Mature coordinated order. Differentiated parts locked to shared goals, no single dominant subsystem.',
    delivers: 'Everything you track, coordinated in one read: how your whole set moves together rather than one item at a time.',
    signal: 'the coordinated whole across many tracked items'
  },
  {
    code: 'P7', title: 'Separation', state: 'breaking',
    meaning: 'Individuation under tension. Parts separate cleanly while retaining integration. A split, not a collapse.',
    delivers: 'What is splitting off: spin-offs, divestitures, reorganisations, contracts broken out, jurisdictions carved apart.',
    signal: 'clean separation under strain'
  },
  {
    code: 'P7b', title: 'Divergence', state: 'breaking',
    meaning: 'The bifurcation fork. Two basins: reintegrate, or drift to an absorbing state. The inflection between survival and collapse.',
    delivers: 'The decision node itself, with which way it is tipping and what would flip it.',
    signal: 'a fork with two live outcomes'
  },
  {
    code: 'P8', title: 'Conscience', state: 'driving',
    meaning: 'Recursion applied to the regulator. The system monitors itself, detects its own error, and corrects course in real time.',
    delivers: 'The system correcting ITSELF: corrections filed, rules withdrawn, recalls issued voluntarily, positions unwound before being forced. The most under-watched signal there is.',
    signal: 'self-issued correction'
  },
  {
    code: 'P9', title: 'Threshold', state: 'breaking',
    meaning: 'Maximum saturation and poised disequilibrium. Resolution and collapse equally likely, all parts online, nothing resolved yet.',
    delivers: 'The knife-edge: the moment tension is maximal and the outcome is still open. Sent the hour it happens, not the next morning.',
    signal: 'maximal tension, outcome still open'
  },
  {
    code: 'P10', title: 'Renewal', state: 'holding',
    meaning: 'Repatterned at a new level. Not restoration, a new normal, generative beyond itself.',
    delivers: 'What the new normal actually is once it locks in: the rule now in force, the settled structure, and what it changed.',
    signal: 'the new settled state'
  }
];

var BY_CODE = {};
PHASES.forEach(function (p) { BY_CODE[p.code.toLowerCase()] = p; });

function get(code) { return BY_CODE[String(code || '').toLowerCase()] || null; }

/** The alert SHAPE a phase implies, from its state in the arc. */
function cadenceShape(code) {
  var p = get(code);
  if (!p) return null;
  if (p.state === 'breaking') return 'event';    // tell me the day it happens
  if (p.state === 'holding') return 'rhythm';    // a regular briefing
  return 'trend';                                 // driving: accumulates, watch it build
}

module.exports = { PHASES: PHASES, get: get, cadenceShape: cadenceShape };
