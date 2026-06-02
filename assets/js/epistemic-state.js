/**
 * epistemic-state.js — SINGLE SOURCE OF TRUTH for how LIMEN separates findings.
 *
 * DOCTRINE (operator, 2026-06-01):
 *   "I want proofs, but keep everything — the unproven is just reasons for
 *    research. Impossible / unproven / unknown / proven all have opportunity
 *    but need to be separated."
 *
 * Findings are NEVER deleted for being unproven. Verification WRITES a state;
 * it never removes the finding. Every claim / transfer / residual lands in
 * exactly one of FOUR epistemic buckets. The bucket tells you the NEXT MOVE,
 * not whether to keep it.
 *
 * The engine records six raw verdicts; this module collapses them onto the
 * four operator-facing states. This mapping is the only place the collapse is
 * defined — render layers, bucketers, and exports all read from here.
 *
 * Usable two ways:
 *   - Browser inline scripts: window.EpistemicState.classify('DISPUTED')
 *   - ES module:  import { classify, bucket, STATES } from './epistemic-state.js'
 */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node
  root.EpistemicState = api;                                                 // browser
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // The four operator-facing states. Order is the reading order: strongest
  // evidence first, then the two "go do research" lanes, then refuted.
  const STATES = ['proven', 'unproven', 'unknown', 'impossible'];

  const STATE_META = {
    proven: {
      label: 'PROVEN',
      color: '#5ab5a0',
      nextMove: 'Strengthen, advance the stage, cite.',
      blurb: 'Evidence supports it.',
    },
    unproven: {
      label: 'UNPROVEN',
      color: '#a87edc',
      nextMove: 'Design the test. This is the research target.',
      blurb: 'A claim exists, but evidence neither supports nor refutes it.',
    },
    unknown: {
      label: 'UNKNOWN',
      color: '#dca87e',
      nextMove: 'Go look. Exploration queue.',
      blurb: 'Not yet examined, or could not be examined — a gap.',
    },
    impossible: {
      label: 'IMPOSSIBLE',
      color: '#e85454',
      nextMove: 'Study WHY it fails — where the analogy breaks. Kept, never discarded.',
      blurb: 'Contradicted / refuted / mechanism-broken. A broken transfer is often the most useful result.',
    },
  };

  // Raw engine verdict -> epistemic state. The ONLY collapse definition.
  const VERDICT_TO_STATE = {
    VERIFIED: 'proven',
    THEORETICAL: 'unproven',
    PENDING: 'unknown',
    UNVERIFIABLE: 'unknown',
    DISPUTED: 'impossible',
    FABRICATED: 'impossible',
  };

  function classify(verdict) {
    return VERDICT_TO_STATE[verdict] || 'unknown';
  }

  function meta(verdictOrState) {
    const state = STATE_META[verdictOrState] ? verdictOrState : classify(verdictOrState);
    return STATE_META[state];
  }

  // Human one-liner for a raw verdict (used in tooltips/badges).
  function describe(verdict) {
    const m = meta(verdict);
    return `${m.label} — ${m.nextMove}`;
  }

  // Bucket any list of items that carry `.verification.verdict` (or a bare
  // `.verdict`) into { proven:[], unproven:[], unknown:[], impossible:[] }.
  function bucket(items, getVerdict) {
    const out = { proven: [], unproven: [], unknown: [], impossible: [] };
    const read = getVerdict || ((it) => (it && it.verification && it.verification.verdict) || (it && it.verdict) || 'PENDING');
    for (const it of items || []) out[classify(read(it))].push(it);
    return out;
  }

  // Count-only version — for summaries/dashboards.
  function tally(items, getVerdict) {
    const b = bucket(items, getVerdict);
    return { proven: b.proven.length, unproven: b.unproven.length, unknown: b.unknown.length, impossible: b.impossible.length };
  }

  return { STATES, STATE_META, VERDICT_TO_STATE, classify, meta, describe, bucket, tally };
});
