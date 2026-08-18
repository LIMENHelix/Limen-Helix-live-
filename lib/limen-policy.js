/**
 * api/lib/limen-policy.js — Phase Transition → Engine Lane Policy
 *
 * Neurologically grounded mapping. When a CIK transitions between
 * phases, the recommended engine lane mirrors the kind of intervention
 * the corresponding biological transition would call for:
 *
 *   p0 (source)        → research      (early-stage thesis builder)
 *   p1 (rupture)       → investment    (volatility window for distressed-debt)
 *   p2 (rhythm)        → research      (early-stage opportunity scoping)
 *   p3 (instability)   → no dispatch   (retired lane; do not manufacture a substitute)
 *   p4 (compression)   → no dispatch   (retired lane; do not manufacture a substitute)
 *   p5 (endurance)     → no dispatch   (retired lane; do not manufacture a substitute)
 *   p6 (recovery)      → no dispatch   (retired lane; do not manufacture a substitute)
 *   p7 (terminal)      → investment    (distressed-debt or recapitalization)
 *   p7a (extinction)   → investment    (distressed-debt or wind-down asset sale)
 *   p7b (mass extinct) → investment    (carve-out asset purchase)
 *   p8 (decay)         → no dispatch   (retired lane; do not manufacture a substitute)
 *   p9 (collapse)      → investment    (post-bankruptcy emergence equity)
 *   p10 (mass collapse)→ investment    (cohort-wide distressed window)
 *
 * The MAGNITUDE of the transition matters too — phase jumps of >2
 * steps in either direction get flagged "high salience" and bumped
 * to the front of the queue. Single-step transitions are routine.
 *
 * Anti-spam: dedupe per (CIK, lane) for 7 days — same CIK won't
 * re-queue the same lane within a week unless the user explicitly
 * fires it first (which clears the dedupe key).
 *
 * Anti-budget: policy emits a QUEUE recommendation only. Operator
 * UI consumes the queue + decides what to fire. No automatic
 * /api/expand-artifact-claude calls from this layer.
 */

var PHASE_TO_LANE = {
  p0:  'research',
  p1:  'investment',
  p2:  'research',
  p3:  null,
  p4:  null,
  p5:  null,
  p6:  null,
  p7:  'investment',
  p7a: 'investment',
  p7b: 'investment',
  p8:  null,
  p9:  'investment',
  p10: 'investment'
};

// Phase ordinals for magnitude calculation
var PHASE_ORDINAL = {
  p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6,
  p7: 7, p7a: 7.3, p7b: 7.6, p8: 8, p9: 9, p10: 10
};

// networkStress (optional): { amplificationRank, isHub, inducedStress } from the
// spider-web stress propagator's slimmed per-CIK map (limen:stress_slim, refreshed
// by limen-worker-stress-refresh). Network-induced stress IS a salience signal —
// a company pushed toward distress by its stressed neighbours is more urgent to
// surface. Backward-compatible: omitting it reproduces the original behaviour.
function recommendLane(transition, networkStress) {
  var to = String(transition.to || '').toLowerCase();
  var from = String(transition.from || '').toLowerCase();
  var lane = PHASE_TO_LANE[to];
  if (!lane) return null;

  var fromOrd = PHASE_ORDINAL[from];
  var toOrd = PHASE_ORDINAL[to];
  var magnitude = (typeof fromOrd === 'number' && typeof toOrd === 'number')
    ? Math.abs(toOrd - fromOrd) : 0;

  // Direction: deteriorating (to > from), recovering (to < from), lateral
  var direction = toOrd > fromOrd ? 'deteriorating'
                : toOrd < fromOrd ? 'recovering' : 'lateral';

  // Salience: magnitude × direction-weight. Deterioration is more urgent
  // than recovery (asymmetric distress > opportunity per phase-coupling
  // template). Magnitude > 2 = high salience.
  var directionWeight = direction === 'deteriorating' ? 1.0
                      : direction === 'recovering'    ? 0.6
                      :                                  0.4;
  var salienceScore = Math.min(1.0, (magnitude / 3) * directionWeight);

  // Network-induced-stress salience boost. Only non-hub SEVERE/MODERATE
  // induced stress contributes: HUB_EFFECT is structural connectivity (a bank
  // is highly connected, not distressed), so it is explicitly ignored — never
  // treat a hub as a distress signal. The boost raises urgency (which surfaces
  // the company faster); lane suitability is still gated downstream by the
  // stage classifier.
  var networkStressApplied = null;
  if (networkStress && !networkStress.isHub) {
    var rank = networkStress.amplificationRank;
    var boost = rank === 'SEVERE' ? 0.25 : rank === 'MODERATE' ? 0.12 : 0;
    if (boost > 0) {
      salienceScore = Math.min(1.0, salienceScore + boost);
      networkStressApplied = {
        amplificationRank: rank,
        boost: boost,
        inducedStress: (typeof networkStress.inducedStress === 'number') ? networkStress.inducedStress : null
      };
    }
  }

  var salience = salienceScore >= 0.67 ? 'HIGH'
               : salienceScore >= 0.34 ? 'MEDIUM'
               :                          'LOW';

  return {
    lane: lane,
    direction: direction,
    magnitude: magnitude,
    salienceScore: Math.round(salienceScore * 100) / 100,
    salience: salience,
    networkStressApplied: networkStressApplied
  };
}

module.exports = {
  recommendLane: recommendLane,
  PHASE_TO_LANE: PHASE_TO_LANE,
  PHASE_ORDINAL: PHASE_ORDINAL
};
