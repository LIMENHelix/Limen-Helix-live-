/**
 * valuation.js — phase-conditioned re-rating model for the investment lane.
 *
 * Turns a real market-data snapshot (api/lib/market-data.js) + the portal's
 * kernel phase + the bridge confidence into the numbers the investment
 * artifact needs: target (base/bull/bear), upside, stop, position size, IRR,
 * probabilities. NO fabricated inputs — every output is a function of EDGAR
 * fundamentals, the live quote, and one explicit, auditable rule set.
 *
 * METHODOLOGY (transparent on purpose — the operator rejected hand-waving):
 *   1. Current EV/Revenue multiple = (price·shares + netDebt) / revenue.   [real]
 *   2. The kernel PHASE re-rates that multiple. PHASE_FACTOR maps each
 *      p0–p10 phase to a multiplier (distress compresses, recovery expands).
 *      This is THE calibration knob — monotonic with distress, tunable below.
 *   3. Target EV = currentMultiple · PHASE_FACTOR · revenue.
 *      Target price = max(0, (targetEV − netDebt) / shares).  ← net debt is
 *      why a high-leverage terminal name can go to ~0 even with revenue.
 *   4. Bull/bear = the multiple ± an uncertainty band that WIDENS as bridge
 *      confidence falls (low conviction ⇒ wider cone).
 *   5. Probability-weighted target → IRR over the thesis horizon.
 *   6. Stop = anchored to the 52-week range (real), not an arbitrary %.
 *   7. Position size = conviction(confidence) × asymmetry, hard-capped.
 *
 * Returns null if the snapshot lacks the load-bearing inputs (price, shares,
 * revenue, netDebt) — the generator then degrades honestly rather than
 * printing a number with no basis.
 */

// THE calibration knob. Multiplier applied to the current EV/Revenue multiple,
// by kernel phase. Monotonic with distress: terminal/liquidation phases
// compress the multiple hard; resurrection/expansion expand it. Tune here.
const PHASE_FACTOR = {
  p0: 1.05,   // OPERATING-STABLE
  p1: 0.95,   // EARLY-DRIFT
  p2: 0.85,   // RECOVERABLE-STRESS
  p3: 0.70,   // ACTIVE-STRESS
  p4: 0.85,   // RECOVERY-ATTEMPT
  p5: 0.65,   // CONSERVE-MODE
  p6: 1.20,   // EXPANSION
  p7: 0.50,   // TERMINAL-PHASE
  p7a: 0.45,  // TERMINAL-DIVERGENCE
  p7b: 0.55,  // CONTROLLED-SEPARATION
  p8: 0.25,   // BANKRUPTCY-WORKOUT
  p9: 0.12,   // LIQUIDATION
  p10: 1.25   // RESURRECTION
};
// the canonical phase that follows each (p0–p10 attractor sequence) — used for
// the "we are wrong if phase progresses to X" falsifiability line.
const NEXT_PHASE = { p0: 'p1', p1: 'p2', p2: 'p3', p3: 'p4', p4: 'p5', p5: 'p6', p6: 'p7', p7: 'p7a', p7a: 'p8', p7b: 'p8', p8: 'p9', p9: 'p10', p10: 'p0' };

function _pct(a, b) { return b ? ((a - b) / b) * 100 : null; }
function _r(v, d) { if (v == null || !isFinite(v)) return null; const p = Math.pow(10, d == null ? 2 : d); return Math.round(v * p) / p; }
// price-adaptive rounding: cents for ≥ $1, 4dp for sub-$1 penny stocks
function _rp(v) { if (v == null || !isFinite(v)) return null; return v >= 1 ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000; }
function _priceFromEV(ev, netDebt, shares) { return Math.max(0, (ev - netDebt) / shares); }

/**
 * @param md     market-data snapshot from getMarketData()
 * @param phase  kernel phase string (p0..p10)
 * @param confidence bridge confidence 0..1
 * @param side   'LONG' | 'SHORT'
 * @param horizonYears number (default 1.25)
 */
function computeValuation(md, phase, confidence, side, horizonYears) {
  if (!md || md.price == null || md.shares == null || md.revenue == null || md.netDebt == null || !md.revenue) return null;
  const ph = String(phase || '').toLowerCase();
  const factor = PHASE_FACTOR[ph];
  if (factor == null) return null;   // no phase ⇒ no defensible re-rate; degrade honestly
  const conf = (typeof confidence === 'number' && confidence > 0) ? Math.min(confidence, 1) : 0.3;
  const horizon = horizonYears || 1.25;
  const price = md.price, shares = md.shares, netDebt = md.netDebt, revenue = md.revenue;

  const currentMultiple = md.evRevenue != null ? md.evRevenue : (price * shares + netDebt) / revenue;

  // uncertainty band: 20% at full conviction → up to ~55% at low conviction
  const band = Math.min(0.55, 0.20 + (1 - conf) * 0.50);

  const mBase = currentMultiple * factor;
  const mBull = mBase * (1 + band);
  const mBear = mBase * (1 - band);

  const tBase = _priceFromEV(mBase * revenue, netDebt, shares);
  const tBull = _priceFromEV(mBull * revenue, netDebt, shares);
  const tBear = _priceFromEV(mBear * revenue, netDebt, shares);

  // probability weights: anchored on confidence. Base gets the conviction mass;
  // the residual splits to the tails, leaning to the thesis-favorable tail.
  const pBase = _r(0.40 + conf * 0.30, 2);          // 0.40–0.70
  const residual = 1 - pBase;
  // favorable tail = the one the thesis points at (SHORT favors the LOWER target = bear)
  const favBear = side === 'SHORT';
  const pBear = _r(residual * (favBear ? 0.6 : 0.4), 2);
  const pBull = _r(residual - pBear, 2);

  const pwTarget = pBase * tBase + pBull * tBull + pBear * tBear;
  const upsidePct = _pct(tBase, price);
  const pwUpsidePct = _pct(pwTarget, price);
  // IRR on the probability-weighted target over the horizon (signed by move)
  const irr = pwTarget > 0 && price > 0 ? (Math.pow(pwTarget / price, 1 / horizon) - 1) * 100 : null;

  // stop anchored to the 52-week range (real). SHORT: re-review if it rallies
  // back toward the upper range; LONG: if it breaks the lower range.
  let stop = null;
  if (md.week52High != null && md.week52Low != null && md.week52High > md.week52Low) {
    const rng = md.week52High - md.week52Low;
    stop = side === 'SHORT' ? _r(price + 0.35 * rng, 2) : _r(Math.max(0, price - 0.35 * rng), 2);
  }

  // asymmetry = reward:risk. reward = |pwTarget − price|; risk = |stop − price|.
  const reward = Math.abs(pwTarget - price);
  const risk = stop != null ? Math.abs(stop - price) : price * 0.5;
  const asymmetry = risk > 0 ? reward / risk : null;

  // position size: 2% base × conviction × min(asymmetry,3)/2, capped [0.5%, 4%]
  const convFactor = conf / 0.5;                       // 1.0 at conf 0.5
  let posSize = 2.0 * convFactor * (asymmetry != null ? Math.min(asymmetry, 3) / 2 : 0.5);
  posSize = _r(Math.max(0.5, Math.min(4.0, posSize)), 1);

  // self-referential "delta": how far the current multiple sits from the
  // phase-implied target multiple, in turns. (Honest stand-in for peer-delta,
  // which we do NOT have peer data to compute — labeled as such by the caller.)
  const multipleDelta = _r(currentMultiple - mBase, 2);

  return {
    price: _rp(price),
    side,
    horizonYears: horizon,
    currentMultiple: _r(currentMultiple, 2),
    phaseFactor: factor,
    targetMultiple: _r(mBase, 2),
    multipleRange: [_r(mBear, 2), _r(mBull, 2)],
    multipleDelta,
    target: _rp(tBase),
    targetBull: _rp(tBull),
    targetBear: _rp(tBear),
    upsidePct: _r(upsidePct, 1),
    probWeightedTarget: _rp(pwTarget),
    probWeightedUpsidePct: _r(pwUpsidePct, 1),
    probabilities: { base: pBase, bull: pBull, bear: pBear },
    irrPct: _r(irr, 1),
    stop,
    asymmetry: _r(asymmetry, 2),
    positionSizePct: posSize,
    nextPhase: NEXT_PHASE[ph] || null,
    metric: 'EV/Revenue'
  };
}

module.exports = { computeValuation, PHASE_FACTOR, NEXT_PHASE };
