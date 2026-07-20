/**
 * lib/feed-fractal.js — #1 the FEED FRACTAL (offline core). Pure: no Redis/Date/I/O.
 *
 * Turns a domain's live feed items (dsum.sources[] from domain-snapshot.js — each a headline/signal
 * with a source-quality class) into a set of TYPED, INDEPENDENT feed channels — the domain's
 * "Review of Systems" — each a ChannelReading with a phase-signature, for lib/phase-estimator.js.
 *
 * WHY (NEURO_LEARNING_REFERENCE.md Creator 14): a clinician does not diagnose from the chief complaint;
 * they run a broad, systematic screen across every organ system (the ROS), because the presenting
 * complaint is a biased, low-recall sample. The current stress path collapses all news into ONE scalar
 * `eventIntensity = ln(1+totalArticles)` — that is diagnosing from article VOLUME, the exact thing the
 * rework retires. Here each item is instead CLASSIFIED BY WHAT IT SAYS (layoffs, leadership change,
 * pricing, demand, competition, supply disruption, litigation/regulatory, recall/quality, capital) into
 * its own channel with its own phase-signature and its own per-domain baseline. Content, not count.
 *
 * HONEST LIMITS (stated, not hidden):
 *  - Classification is KEYWORD-based (content typing), not deep semantic extraction. It answers "what
 *    KIND of event" well; it does not yet grade "HOW BAD" — a channel's `value` is a saturating,
 *    source-quality-weighted INTENSITY of typed items, better than raw count (only typed items count,
 *    untyped news contributes nothing) but still a magnitude proxy, not measured severity. Deep
 *    severity extraction is a later increment.
 *  - The fractal is DETERIORATION-BIASED by construction: news skews toward problems (BBD's ~20:1
 *    asymmetry, Creator 12.11), so these channels load the distress side of the arc. Constructive-signal
 *    typing (recovery, expansion) is a later increment; do not read the absence of a channel as health.
 *  - Every phase-signature is a STATED PRIOR [mark: prior] on the canonical Light→Resurrection register,
 *    NOT validated against a labeled benchmark. The forward-outcome resolution loop (#2) is what will
 *    turn these into measured weights.
 *  - ABSTAINS per channel: a channel is emitted ONLY when >=1 item of that type is present. A domain
 *    with 400 generic articles and zero layoffs gets NO layoffs channel — never a fabricated one.
 */

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Build an 11-phase likelihood (P0..P10) from a {phaseIndex: weight} map, floored so no phase is impossible.
function likFrom(map) {
  var L = new Array(11), floor = 0.01, s = 0, i;
  for (i = 0; i < 11; i++) { L[i] = floor + (map[i] > 0 ? map[i] : 0); s += L[i]; }
  for (i = 0; i < 11; i++) L[i] /= s;
  return L;
}

// The domain "Review of Systems": typed feed channels. Each carries a content classifier (keyword
// patterns) and a phase-signature over P0..P10 [mark: prior], differentiated across the arc so that
// different KINDS of trouble load different phases (not everything into one rupture bucket):
//   P3 Darkness  P5 Endurance  P7 Separation  P8 Conscience  P9 Threshold
var CHANNEL_TYPES = {
  workforce:   { re: /layoff|job ?cut|redundanc|furlough|hiring freeze|downsiz|staff ?cut|workforce reduction|cut[a-z]*\s+[\d,]*\s*jobs|jobs?\s+(cut|lost|slash|elimin)/i,
                 sig: likFrom({ 7: 0.5, 3: 0.3, 5: 0.2 }) },              // layoffs = Separation + Darkness/Endurance
  leadership:  { re: /\bceo\b|\bcfo\b|\bcoo\b|resign|steps? down|ousted|succession|leadership (change|shake)|executive (depart|exit)|interim (chief|ceo)/i,
                 sig: likFrom({ 9: 0.5, 3: 0.3, 1: 0.2 }) },              // exec turnover = Threshold + Darkness (or Light if renewal)
  pricing:     { re: /price|margin|cost (overrun|spike|pressure)|tariff|inflation|per ?unit|pricing power|input cost|cost-cut/i,
                 sig: likFrom({ 5: 0.6, 3: 0.2, 6: 0.2 }) },             // unit economics under strain = Endurance
  demand:      { re: /demand|orders? (fall|drop|decline)|backlog|weak(ening)? demand|slump|sales (miss|fall|decline)|volume (drop|decline)/i,
                 sig: likFrom({ 5: 0.4, 3: 0.4, 2: 0.2 }) },             // demand softness = Endurance + Darkness
  competition: { re: /competit|market share|new entrant|\bmerger\b|acqui(re|sition)|\brival|disrupt(or|ion)|price war|undercut/i,
                 sig: likFrom({ 5: 0.4, 7: 0.4, 6: 0.2 }) },             // competitive pressure = Endurance + Separation
  supply:      { re: /supply (chain|shortage|disruption)|shortage|outage|bottleneck|logistics|shipment delay|inventory (glut|shortfall)|stockout/i,
                 sig: likFrom({ 3: 0.6, 5: 0.4 }) },                     // supply disruption = Darkness + Endurance
  litigation:  { re: /lawsuit|litigation|\bsue[ds]?\b|settlement|regulat(or|ion)|enforcement|fine[ds]?|penalt|sanction|antitrust|investigation|probe|indict/i,
                 sig: likFrom({ 8: 0.6, 3: 0.4 }) },                     // legal/regulatory reckoning = Conscience
  recall:      { re: /recall|defect|safety (issue|concern)|contaminat|fault|malfunction|breach|hazard|adverse event/i,
                 sig: likFrom({ 8: 0.5, 3: 0.5 }) },                     // recall/quality failure = Conscience + Darkness
  capital:     { re: /\bdebt\b|default|bankrupt|insolven|liquidity|refinanc|rating (cut|downgrade)|credit (crunch|risk)|going concern|covenant/i,
                 sig: likFrom({ 9: 0.4, 3: 0.4, 5: 0.2 }) }             // financing distress = Threshold + Darkness
};

var QUALITY_WEIGHT = { real: 1.0, event: 0.6, degraded: 0.3, broken: 0.0 };
var INTENSITY_K = 3;   // saturation constant: value = 1 - exp(-Σquality / K); ~1 typed real item => 0.28, ~9 => 0.95

/**
 * classifyItem(text) → array of matched channel-type keys (an item can hit several).
 */
function classifyItem(text) {
  if (!text || typeof text !== 'string') return [];
  var hits = [];
  for (var type in CHANNEL_TYPES) {
    if (CHANNEL_TYPES[type].re.test(text)) hits.push(type);
  }
  return hits;
}

/**
 * toChannels(items, opts) → array of ChannelReading for the phase estimator.
 *
 * items: [{ text|signal|label, quality|classification }]  — from dsum.sources[]. `text` is the headline/
 *        signal string; quality/classification one of real|event|degraded|broken (source credibility).
 * opts.minQuality: drop items below this quality weight (default 0 — keep all but 'broken').
 *
 * Only TYPED items contribute; a channel is emitted only if >=1 typed item is present (abstain otherwise).
 * value = 1 - exp(-Σ quality_of_typed_items / K): saturating, source-quality-weighted intensity — NOT raw
 * count. Untyped/generic items produce NO channel, which is the content-not-volume property.
 */
function toChannels(items, opts) {
  opts = opts || {};
  items = Array.isArray(items) ? items : [];
  var acc = {};   // type -> { qsum, n }
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var text = it.text || it.signal || it.label || '';
    var q = QUALITY_WEIGHT[it.quality || it.classification];
    if (q == null) q = 0.6;                       // unknown source class -> treat as 'event'
    if (q <= 0) continue;                         // 'broken' contributes nothing
    var types = classifyItem(text);
    for (var t = 0; t < types.length; t++) {
      var ty = types[t];
      (acc[ty] || (acc[ty] = { qsum: 0, n: 0 }));
      acc[ty].qsum += q; acc[ty].n += 1;
    }
  }
  var out = [];
  for (var type in acc) {
    var v = clamp01(1 - Math.exp(-acc[type].qsum / INTENSITY_K));
    out.push({
      key: 'feed_' + type,
      value: v,
      likelihood: CHANNEL_TYPES[type].sig,       // phase-signature [mark: prior]
      typedItems: acc[type].n                     // provenance, not used by the estimator
    });
  }
  return out;
}

/**
 * marketChannel(score, opts) — the market's OWN read as ONE channel (not the label; the label is the
 * forward realized outcome, #2). `score` in [0,1] = adverse market signal for the domain (1 = worst).
 * Loads the Darkness/Endurance band, mirroring the company-distress band so market and ground-fractal
 * can be compared. Returns null if no score. [mark: prior] signature.
 */
function marketChannel(score, opts) {
  if (typeof score !== 'number' || !isFinite(score)) return null;
  var s = clamp01(score);
  // VALUE-DEPENDENT (mirrors distressBandLikelihood in grounded-stress): a calm market must pull the
  // belief toward the CONSTRUCTIVE band, not weakly toward distress. Low s -> P1/P2/P4/P6/P10; high s ->
  // P3/P5/P9. A fixed distress-ward likelihood makes the estimator call distress always (caught by the
  // energy backfill: hit rate collapsed to the base rate, phaseMAP frozen at P3). [mark: prior] bands.
  var calm =     { 1: 0.2, 2: 0.2, 4: 0.3, 6: 0.2, 10: 0.1 };
  var distress = { 3: 0.5, 5: 0.35, 9: 0.15 };
  var map = {}, p;
  for (p = 0; p < 11; p++) map[p] = (1 - s) * (calm[p] || 0) + s * (distress[p] || 0);
  return { key: 'marketScore', value: s, likelihood: likFrom(map) };
}

module.exports = {
  toChannels: toChannels,
  classifyItem: classifyItem,
  marketChannel: marketChannel,
  CHANNEL_TYPES: CHANNEL_TYPES,
  QUALITY_WEIGHT: QUALITY_WEIGHT,
  // exported for testing
  likFrom: likFrom
};
