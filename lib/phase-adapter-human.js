/**
 * lib/phase-adapter-human.js — ADAPTER A stub (PHASE_ESTIMATOR_SPEC.md §4). OFFLINE ONLY.
 *
 * Turns a person's sensory / behavioral readings into a ChannelBundle for lib/phase-estimator.js,
 * from the LIMEN Helix Brain Development sensory diagnostic table + the Smell/Phase-Weight sheet.
 * Multi-sensory cue integration is the estimator's native form (Ernst & Banks 2002; Creator 13.5).
 *
 * ┌─ HUMAN GATE (non-negotiable, structural) ──────────────────────────────────────────────────────┐
 * │ This module produces CHANNELS ONLY. It has NO function that emits a diagnosis, a contraindication,│
 * │ a supplement/medical recommendation, or a treatment. The estimator turns the bundle into a phase │
 * │ BELIEF; a human practitioner — never this code — decides whether any clinical action follows.    │
 * │ The belief is decision support, not a decision. Do not add a clinical-output surface here.        │
 * │ Not wired into any handler; not deployed. Per CLAUDE.md human-gated actions.                      │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every sense→phase mapping below is a STATED PRIOR [mark: prior] taken from the framework's own
 * diagnostic tables — convention, NOT validated against a labeled benchmark. Each channel carries a
 * precisionHint from its RELIABILITY CLASS (spec §4 table): HRV high (independently measured), sound/
 * touch/thermal/vision medium (test-structured), verbalTheme/behavioral medium-low (practitioner-
 * coded), scent/taste low (raw self-report). Self-report unreliability is a known independent prior
 * (response bias, interoceptive inaccuracy) — a legitimate precisionHint, not consensus-derived — so a
 * validated HRV reading is not outvoted by an agreeing self-report cluster even at cold start, before
 * the core's correlation-based decorrelation has any history to work with. The precisionHint VALUES
 * are stated priors [mark: prior]; only the §7 benchmark turns them into measured ones.
 */

var HUMAN_GATE = 'Adapter A emits channels only. No diagnosis/contraindication/recommendation/treatment. Belief is practitioner decision support, never an action.';

// Canonical Light→Resurrection register (P0 Null … P10 Resurrection).
var PHASE_NAMES = ['Null', 'Light', 'Rhythm', 'Darkness', 'Peace', 'Endurance', 'Order', 'Separation', 'Conscience', 'Threshold', 'Resurrection'];

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Reliability class → precisionHint (spec §4 table). STATED priors [mark: prior]. HRV independently
// measured (high); structured sensory tests medium; practitioner-coded medium-low; raw self-report low.
var CHANNEL_PRECISION = {
  hrv: 4,
  sound: 1.2, touch: 1.2, thermal: 1.2, vision: 1.2,
  verbalTheme: 0.7, behavioral: 0.7,
  scent: 0.4, taste: 0.4
};

// Build an 11-phase likelihood from a {phaseIndex: weight} map, with a floor so no phase is impossible.
function likFrom(map) {
  var L = new Array(11), floor = 0.01, s = 0, i;
  for (i = 0; i < 11; i++) { L[i] = floor + (map[i] > 0 ? map[i] : 0); s += L[i]; }
  for (i = 0; i < 11; i++) L[i] /= s;
  return L;
}

// ── Scent → phase (Smell/Phase-Weight sheet) ─────────────────────────────────────────────────────
var SCENT_PHASE = {
  noScent: [0, 3], faint: [0, 3],
  citrus: [1], mint: [1], brightAir: [1],
  lavender: [2], cedar: [2], softHerbal: [2],
  vanilla: [4], chamomile: [4], baking: [4], laundry: [4],
  pepper: [5], clove: [5], ginger: [5], camphor: [5],
  eucalyptus: [6], pine: [6], teatree: [6],
  sharpGreen: [7], vetiver: [7], resin: [7],
  vinegar: [8], smoke: [8], burntSugar: [8],
  frankincense: [9], myrrh: [9], incense: [9],
  whiteFloral: [10], amber: [10], complexPerfume: [10]
};

// marks: { scentKey: '+' (like/want) | '-' (cannot tolerate) }. '+' loads its phase(s); '-' suppresses.
function scentLikelihood(marks) {
  var map = {}, k, i;
  for (k in marks) {
    if (!SCENT_PHASE[k]) continue;
    var sign = marks[k] === '+' ? 1 : marks[k] === '-' ? -0.5 : 0;
    SCENT_PHASE[k].forEach(function (p) { map[p] = (map[p] || 0) + sign; });
  }
  for (i in map) if (map[i] < 0) map[i] = 0;   // a likelihood cannot be negative
  return likFrom(map);
}

// ── Other senses → phase (Brain Development diagnostic table: the phase a sense's signal loads) ───
var SENSE_PHASE = {
  vision: [1, 6],   // light-seeking / visual patterning → Light, Order
  sound: [2],       // rhythm craving / entrainment → Rhythm
  touch: [4],       // soft-pressure / warmth / interoceptive calm → Peace
  thermal: [5],     // hot/cold resilience or intolerance → Endurance
  taste: [7]        // bitter/sour preference, appetite loss → Separation
};

// value ∈ [0,1] = strength of that sense's phase-consistent signal.
function senseLikelihood(sense, value) {
  var aff = SENSE_PHASE[sense] || [];
  var map = {}; value = clamp01(value);
  aff.forEach(function (p) { map[p] = value; });
  return likFrom(map);
}

// ── HRV → phase (the one independently-measured channel) ─────────────────────────────────────────
// hrv01 ∈ [0,1], 1 = high vagally-mediated HRV (parasympathetic/Peace/recovery), 0 = vagal withdrawal
// (Endurance/allostatic-load, Darkness). Grounded in the project's ANS/interoception sections.
function hrvReading(hrv01, opts) {
  opts = opts || {};
  hrv01 = clamp01(hrv01);
  var map = {};
  map[4] = hrv01; map[10] = hrv01 * 0.6;             // high tone → Peace, Resurrection
  map[5] = (1 - hrv01); map[3] = (1 - hrv01) * 0.6;  // low tone → Endurance, Darkness
  return {
    key: 'hrv', value: hrv01, likelihood: likFrom(map),
    precisionHint: opts.precisionHint != null ? opts.precisionHint : 4   // validated device: independent, high
  };
}

// ── Verbal theme / behavior → phase (story language + observable state) ──────────────────────────
var THEME_PHASE = {
  numb: [0, 3], collapse: [3], stuck: [3, 5], overwhelmed: [9], grinding: [5], pushing: [5],
  cutting: [7], done: [7], grief: [7], guilt: [8], reckoning: [8], rebuilding: [10], newSelf: [10],
  calm: [4], safe: [4], hopeful: [10], rhythm: [2], clarity: [6]
};
function tagLikelihood(tags) {
  var map = {}, i;
  (tags || []).forEach(function (t) { (THEME_PHASE[t] || []).forEach(function (p) { map[p] = (map[p] || 0) + 1; }); });
  return likFrom(map);
}

/**
 * toBundle(profile, opts) → ChannelBundle for phase-estimator.estimate(). CHANNELS ONLY — no belief,
 * no label, no recommendation is produced here.
 *
 * profile = {
 *   scent:      { marks: { citrus:'+', vinegar:'-', ... } },
 *   sound|touch|thermal|taste|vision: number [0,1],   // strength of that sense's phase-consistent signal
 *   hrv:        number [0,1],                          // high = high vagal tone (independent channel)
 *   verbalTheme:[ 'stuck', 'rebuilding', ... ],
 *   behavioral: [ 'shutdown', 'hopeful', ... ]
 * }
 */
function toBundle(profile, opts) {
  opts = opts || {};
  profile = profile || {};
  var readings = [];

  var prec = opts.channelPrecision || CHANNEL_PRECISION;

  if (profile.scent && profile.scent.marks) {
    var marks = profile.scent.marks, pos = 0, tot = 0, mk;
    for (mk in marks) { tot++; if (marks[mk] === '+') pos++; }
    readings.push({ key: 'scent', value: tot > 0 ? pos / tot : 0.5, likelihood: scentLikelihood(marks), precisionHint: prec.scent });
  }
  ['sound', 'touch', 'thermal', 'taste', 'vision'].forEach(function (s) {
    if (typeof profile[s] === 'number') readings.push({ key: s, value: clamp01(profile[s]), likelihood: senseLikelihood(s, profile[s]), precisionHint: prec[s] });
  });
  if (typeof profile.hrv === 'number') readings.push(hrvReading(profile.hrv, { precisionHint: opts.hrvPrecision != null ? opts.hrvPrecision : prec.hrv }));
  if (Array.isArray(profile.verbalTheme) && profile.verbalTheme.length) {
    readings.push({ key: 'verbalTheme', value: clamp01(profile.verbalTheme.length / 5), likelihood: tagLikelihood(profile.verbalTheme), precisionHint: prec.verbalTheme });
  }
  if (Array.isArray(profile.behavioral) && profile.behavioral.length) {
    readings.push({ key: 'behavioral', value: clamp01(profile.behavioral.length / 5), likelihood: tagLikelihood(profile.behavioral), precisionHint: prec.behavioral });
  }

  return { substrate: 'human', subjectId: opts.subjectId || null, readings: readings };
  // Intentionally NO belief / label / diagnosis / recommendation field. The estimator + a human do that.
}

module.exports = {
  toBundle: toBundle,
  HUMAN_GATE: HUMAN_GATE,
  PHASE_NAMES: PHASE_NAMES,
  // exported for testing / practitioner tooling — all channel builders, none clinical
  scentLikelihood: scentLikelihood,
  senseLikelihood: senseLikelihood,
  hrvReading: hrvReading,
  tagLikelihood: tagLikelihood,
  SCENT_PHASE: SCENT_PHASE,
  SENSE_PHASE: SENSE_PHASE,
  CHANNEL_PRECISION: CHANNEL_PRECISION
};
