/**
 * lib/domain-names.js — the ONE place the two domain naming systems are reconciled.
 *
 * LIMEN carries two names for the same three domains and always has:
 *
 *   canonical / portal / console        runtime / snapshot / store key
 *   ----------------------------        ----------------------------
 *   medicine                            health
 *   science                             research
 *   trade                               supplyChain
 *
 * The other seventeen domains use one name in both systems.
 *
 * WHY THIS MODULE EXISTS (2026-07-28). This map was written out by hand in EIGHT separate
 * places, in BOTH directions, with no shared definition:
 *   lib/company-phase-scorer.js, lib/domain-baskets.js, lib/operator-fleet.js,
 *   handlers/brain-signals.js, handlers/feed-resolve.js, handlers/limen-worker-score.js,
 *   handlers/opportunities.js, handlers/spine.js
 * Two of those were added the same day, by me, patching the same defect in two places without
 * noticing it was the same defect. That is the actual bug: not any one missing map, but that
 * there was no canonical one to reach for.
 *
 * HOW IT FAILS, and why it is hard to see: a missing alias does not throw. It resolves to a key
 * that does not exist, which reads as ABSENT DATA. Twice in one day it presented as something
 * else entirely:
 *   - /api/feed-resolve?domain=medicine reported resolvedCount 0 while health reported 238 from
 *     the identical rows. Read as "this domain has no forecast history yet."
 *   - the worker looked baskets up by runtime key, so health/research/supplyChain got an EMPTY
 *     basket and abstained from the market channel. Read as "thin basket or fetch failure."
 * In both cases the honest-abstention discipline that is correct everywhere else is exactly what
 * disguised the fault. Anywhere a domain looks unexpectedly empty, check the NAME before
 * believing the data is missing.
 *
 * CASE INSENSITIVITY IS NOT DECORATION. handlers/brain-signals.js held
 * `{ health:'medicine', supplychain:'trade', research:'science' }` — `supplychain` all lowercase,
 * while the runtime key it is looked up with is `supplyChain` camelCase. That entry could never
 * match, so the trade/supplyChain console fell through the alias on every call. Lookups here
 * normalize case; RETURNED runtime keys keep their exact casing (`supplyChain`) because they are
 * used to build Redis keys.
 */

var PAIRS = [
  { canonical: 'medicine', runtime: 'health' },
  { canonical: 'science', runtime: 'research' },
  { canonical: 'trade', runtime: 'supplyChain' }
];

var CANON_TO_RUNTIME = Object.create(null);   // lowercased canonical -> exact runtime key
var RUNTIME_TO_CANON = Object.create(null);   // lowercased runtime   -> exact canonical key
for (var i = 0; i < PAIRS.length; i++) {
  CANON_TO_RUNTIME[PAIRS[i].canonical.toLowerCase()] = PAIRS[i].runtime;
  RUNTIME_TO_CANON[PAIRS[i].runtime.toLowerCase()] = PAIRS[i].canonical;
}

/**
 * toRuntime(name) — the key the snapshot, the recorder and the Redis stores use.
 * Accepts either naming system, any casing. Unknown/unaliased names pass through UNCHANGED,
 * including their original casing, so this is safe to apply blanket to all 20 domains.
 */
function toRuntime(name) {
  var s = String(name == null ? '' : name);
  var hit = CANON_TO_RUNTIME[s.toLowerCase()];
  return hit || s;
}

/**
 * toCanonical(name) — the key the portal, console and registry use.
 * Accepts either naming system, any casing. Unknown names pass through unchanged.
 */
function toCanonical(name) {
  var s = String(name == null ? '' : name);
  var hit = RUNTIME_TO_CANON[s.toLowerCase()];
  return hit || s;
}

/** True when the two systems disagree about this domain (i.e. it is one of the three). */
function isAliased(name) {
  var s = String(name == null ? '' : name).toLowerCase();
  return !!(CANON_TO_RUNTIME[s] || RUNTIME_TO_CANON[s]);
}

/** Both names for a domain, given either. Useful for logging a lookup that came back empty. */
function bothNames(name) {
  return { canonical: toCanonical(name), runtime: toRuntime(name) };
}

module.exports = {
  PAIRS: PAIRS,
  toRuntime: toRuntime,
  toCanonical: toCanonical,
  isAliased: isAliased,
  bothNames: bothNames
};
