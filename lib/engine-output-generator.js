/**
 * engine-output-generator.js — the engine lanes (investment + research ACTIVE;
 * patent/grant/sba/franchise retired. Retired lane keys are intentionally absent
 * so rebuilding the corpus removes their generated application documents.
 *
 * Takes a portal's bridgeReadings + verbiage templates + portal context and
 * produces lane-shaped artifacts that read like real approved documents.
 * Deterministic (no AI calls) — pure template composition. Each lane reads
 * its own templates from assets/data/verbiage-templates.json and its own
 * derivedAngles slot from the bridge match.
 *
 * Per portal, generates the 2 active lanes × N matched bridges. Each artifact is
 * tagged with patternId + confidence + generatedAt so consumers can audit
 * provenance.
 *
 * Output written to portal.engineOutputs:
 *   { investment: [...], research: [...] }
 */
const fs = require('node:fs');
const path = require('node:path');

const PATTERNS_PATH = path.join(__dirname, '..', 'assets', 'data', 'bridge-patterns.json');
const VERBIAGE_PATH = path.join(__dirname, '..', 'assets', 'data', 'verbiage-templates.json');
const { computeValuation, PHASE_FACTOR } = require('./valuation.js');

// "12-18" / "12-18mo" / "12" (months) → years (averaged). Default 1.25y.
function _horizonYears(h) {
  const nums = String(h || '').match(/\d+/g);
  if (!nums || !nums.length) return 1.25;
  const avg = nums.map(Number).reduce((a, b) => a + b, 0) / nums.length;
  return Math.max(0.25, avg / 12);
}

let _verbiage = null;
function loadVerbiage() {
  if (_verbiage) return _verbiage;
  try { _verbiage = JSON.parse(fs.readFileSync(VERBIAGE_PATH, 'utf8')); }
  catch (e) { _verbiage = { lanes: {} }; }
  return _verbiage;
}

// ─── helpers ──────────────────────────────────────────────────────
function _name(portal) { return portal.name || portal.slug || 'the Entity'; }
function _ticker(portal) { return portal.ticker ? portal.ticker.toUpperCase() : null; }
function _sector(portal) { return portal.sector || portal.industry || portal.domainId || 'corporate operations'; }
function _domain(portal) { return portal.domainId || portal.sector || 'general business'; }
function _cik(portal) { return portal.cik || null; }
function _kernelPhase(portal) {
  const kr = portal.kernelReadings || {};
  if (kr.k2 && kr.k2.phase) return kr.k2.phase;
  if (kr.k1 && kr.k1.phase) return kr.k1.phase;
  if (portal.financialHealth && portal.financialHealth.dominantPhase) return portal.financialHealth.dominantPhase;
  return null;
}
function _phaseLabel(phase) {
  const map = { p0: 'OPERATING-STABLE', p1: 'EARLY-DRIFT', p2: 'RECOVERABLE-STRESS', p3: 'ACTIVE-STRESS', p4: 'RECOVERY-ATTEMPT', p5: 'CONSERVE-MODE', p6: 'EXPANSION', p7: 'TERMINAL-PHASE', p7a: 'TERMINAL-DIVERGENCE', p7b: 'CONTROLLED-SEPARATION', p8: 'BANKRUPTCY-WORKOUT', p9: 'LIQUIDATION', p10: 'RESURRECTION' };
  return map[(phase || '').toLowerCase()] || (phase || '').toUpperCase();
}
// stable per-portal "rotation index" so we don't pick the same variant every time
function _rotateIdx(portal, salt) {
  const s = (portal.slug || portal.name || '') + '|' + (salt || '');
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// safe substitute — handles both forms of placeholder:
//   {{KEY}}                          → vars.KEY if set, else "[KEY]"
//   {{KEY|default}}                  → vars.KEY if set, else "default"
//   {{KEY|opt1|opt2|opt3}}           → vars.KEY if set, else "opt1"
//   {{opt1|opt2|opt3}} (lowercase)   → "opt1" (first is the menu default; no var lookup)
function subst(template, vars) {
  if (template == null) return '';
  vars = vars || {};
  return String(template).replace(/\{\{([^}]+)\}\}/g, (m, expr) => {
    expr = expr.trim();
    const parts = expr.split('|').map(s => s.trim());
    const first = parts[0];
    // If first segment is an UPPERCASE key (variable reference)
    if (/^[A-Z][A-Z0-9_]*$/.test(first)) {
      if (vars[first] != null && vars[first] !== '') return vars[first];
      if (parts.length > 1) return parts[1];   // default value follows pipe
      return '[' + first + ']';
    }
    // Lowercase first = menu of choices; pick first as default
    return first || ('[' + expr + ']');
  });
}

// ─── INVESTMENT lane ─────────────────────────────────────────────
// Real numbers via computeValuation() (api/lib/valuation.js) fed by a live
// market-data snapshot (md, fetched once per portal by the orchestrator).
// When md is missing/incomplete, degrades to an HONEST qualitative thesis —
// NEVER emits bracketed placeholders (which render-authority correctly nukes).
function generateInvestment(portal, bridge, md) {
  const v = loadVerbiage().lanes.investment || {};
  const t = v.templates || {};
  const da = (bridge.derivedAngles || {}).investment || {};
  if (!da.thesis) return null;

  const name = _name(portal);
  const ticker = _ticker(portal) || '—';
  const sector = _sector(portal);
  const businessSig = (bridge.businessSignature || '').replace(/_/g, ' ');
  const neuralLabel = bridge.neuralRegionLabel || bridge.neuralRegion || 'neural-pattern';
  const phase = _kernelPhase(portal);
  const phaseLabel = _phaseLabel(phase);

  // Rotate the variant-view opener (3 variants) by portal hash so theses look different per portal
  const variantIdx = _rotateIdx(portal, 'variant') % 3;
  const variantVersions = [t.variantViewOpener_v1, t.variantViewOpener_v2, t.variantViewOpener_v3];
  const variantTemplate = variantVersions[variantIdx];

  // Side follows the PHASE-implied direction so the thesis is internally
  // coherent: a compression-phase target below spot is a SHORT, not a LONG.
  // The bridge thesis text is only a tiebreaker when there's no phase factor.
  const _pf = PHASE_FACTOR[String(phase || '').toLowerCase()];
  const side = (_pf != null) ? (_pf < 1 ? 'SHORT' : 'LONG')
                             : (/\bshort\b/i.test(da.thesis) ? 'SHORT' : 'LONG');
  const isShort = side === 'SHORT';
  // strip any trailing unit ("18-36mo" → "18-36") so we don't print "mo months"
  const horizon = String(da.horizon || '12-18').replace(/\s*mo(nths)?\s*$/i, '');
  const conf = typeof bridge.confidence === 'number' ? bridge.confidence : null;

  // Real composite (legacy field-name is compositeScore, not composite)
  const fh = portal.financialHealth || {};
  const composite = (typeof fh.compositeScore === 'number') ? fh.compositeScore
                  : (typeof fh.composite === 'number') ? fh.composite : null;
  const runwayQ = (fh.financialState && typeof fh.financialState.cashRunwayQ === 'number') ? fh.financialState.cashRunwayQ : null;
  const compositeStr = composite != null ? composite.toFixed(3) : ('not scored — ' + (portal.kernelStatus || 'no kernel reading'));

  // Compute the valuation from real market data (synchronous). null ⇒ degrade.
  const val = (md && md.ok !== false) ? computeValuation(md, phase, conf, side, _horizonYears(horizon)) : null;
  const haveVal = !!(val && val.target != null);
  const today = new Date().toISOString().slice(0, 10);

  // Header — real numbers when we have them, honest qualitative otherwise.
  let header;
  if (haveVal) {
    const upStr = (val.upsidePct > 0 ? '+' : '') + val.upsidePct + '%';
    header = `${name} (${ticker}) — ${side} — ${val.positionSizePct}% of capital
Initiated: ${today}    Current price: $${md.price}    Cost basis: $${md.price}
Target (base): $${val.target} (${upStr} / ${horizon} months)    Stop / re-review: $${val.stop != null ? val.stop : 'n/a'}
Kernel phase: ${phaseLabel}    Composite: ${compositeStr}
Valuation: ${val.currentMultiple}x ${val.metric} → phase-implied ${val.targetMultiple}x (factor ${val.phaseFactor})
Bridge pattern: ${bridge.patternId} (confidence ${conf != null ? conf : 'n/a'})`;
  } else {
    const why = md ? ('insufficient market data — missing ' + (md.missing || []).join(', ')) : 'no market-data snapshot';
    header = `${name} (${ticker}) — ${side} — qualitative thesis (size: conviction-scaled)
Initiated: ${today}    Kernel phase: ${phaseLabel}    Composite: ${compositeStr}
Valuation: not computed (${why}) — directional thesis only, no point price target published.
Bridge pattern: ${bridge.patternId} (confidence ${conf != null ? conf : 'n/a'})`;
  }
  const multClause = haveVal ? `the market values ${ticker} at ${val.currentMultiple}x ${val.metric}` : `the market prices ${ticker} at its current level`;

  // Variant view opener — rotated; real EV/Revenue multiple where available
  let variantView = '';
  if (variantIdx === 0) {
    variantView = `Consensus prices ${ticker} for ${isShort ? 'continued operational normalization' : 'continued underperformance'} — ${multClause}, implying ${isShort ? 'a stable margin and capital-allocation profile' : 'persistent margin compression and stalled recovery'}. We believe consensus is wrong on the ${businessSig} signature: ${name}'s functional-network exhibits ${neuralLabel}-equivalent ${(bridge.mappingType || 'pathology').replace(/_/g, ' ')}${bridge.matchedIndicators && bridge.matchedIndicators.length ? ' (matched indicators: ' + bridge.matchedIndicators.join(', ') + ')' : ''}, and the kernel reading is ${phaseLabel}. The Street's model implicitly requires ${isShort ? 'persistent capital discipline that the bridge pattern is incompatible with' : 'continued operational drift the bridge pattern signals will reverse'}, which we view as unrealistic because the underlying pattern matches a known ${neuralLabel} pathology with documented intervention pathways.`;
  } else if (variantIdx === 1) {
    variantView = `The market is pricing this for ${isShort ? 'continued resilience' : 'continued distress'}, but the functional-network and kernel readings show ${neuralLabel}-equivalent ${(bridge.mappingType || 'pathology').replace(/_/g, ' ')} the Street's models are not registering. Specifically: ${bridge.matchedIndicators && bridge.matchedIndicators.length ? bridge.matchedIndicators.slice(0, 3).join(' · ') : 'matched indicators on file'}. ${multClause}.`;
  } else {
    variantView = `${ticker} screens as ${sector.toLowerCase()}-typical. Underneath, the operative driver is ${neuralLabel}-equivalent ${(bridge.mappingType || 'pathology').replace(/_/g, ' ')}${bridge.businessSignature ? ' (' + businessSig + ')' : ''} which the sector index does not price in at current levels. ${multClause}.`;
  }

  // Catalyst block — real where we have it (cash runway); NO fabricated dates
  const runwayLine = runwayQ != null
    ? `• Cash runway — approximately ${runwayQ} quarter${runwayQ === 1 ? '' : 's'} on the latest filing ⇒ a financing/refinancing event is likely within ~${runwayQ * 3} months (dated, falsifiable).`
    : `• Refinancing / facility maturity — monitor the next 10-Q for liquidity-runway disclosure.`;
  const catalystBlock = `Hard catalysts (falsifiable):
  • Next quarterly earnings release — post-earnings drift is the primary re-rating window for the ${businessSig} signature.
  ${runwayLine}
  • Going-concern language — monitor the next annual filing for a going-concern modification.

Soft catalysts (monitored):
  • Functional-network counterparty stress — leading indicator: spider-web induced stress on ${name}.
  • Bridge-pattern confidence trajectory — leading indicator: bridge-engine match rate across the peer cohort.

We expect the re-rating to materialize over ${horizon} months: once the ${businessSig} pattern is recognized, the gap between current pricing and the phase-implied valuation compresses.`;

  // Valuation arithmetic — REAL: phase-conditioned EV/Revenue re-rating.
  let valuation;
  if (haveVal) {
    const p = val.probabilities;
    valuation = `Method: ${val.metric} re-rated by kernel phase. Current ${val.currentMultiple}x × phase factor ${val.phaseFactor} (${phaseLabel}) → target ${val.targetMultiple}x.
Base case:  ${val.targetMultiple}x → $${val.target}    (${Math.round(p.base * 100)}% probability)
Bull case:  ${val.multipleRange[1]}x → $${val.targetBull}    (${Math.round(p.bull * 100)}% probability)
Bear case:  ${val.multipleRange[0]}x → $${val.targetBear}    (${Math.round(p.bear * 100)}% probability)
Probability-weighted: $${val.probWeightedTarget} (${(val.probWeightedUpsidePct > 0 ? '+' : '') + val.probWeightedUpsidePct}%)    Implied IRR over ${horizon}mo: ${val.irrPct != null ? val.irrPct + '%' : 'n/a'}

Net debt of $${(md.netDebt / 1e6).toFixed(0)}M against $${(md.revenue / 1e6).toFixed(0)}M revenue is the load-bearing input — it is why the bear multiple maps to $${val.targetBear}/share. Bands widen as bridge confidence (${conf != null ? conf : 'n/a'}) falls.`;
  } else {
    valuation = `No point price target is published: the inputs required to re-rate the multiple (price, shares, revenue, net debt) are not all available for this entity. The thesis is directional only — the phase (${phaseLabel}) implies ${isShort ? 'multiple compression' : 'multiple expansion'} versus current pricing, with no fabricated target.`;
  }

  // Risk / falsifiability — drawn from the bridge's matchedIndicators (we're wrong if they reverse)
  const matchedInds = bridge.matchedIndicators || [];
  const risk = `What would change our mind — we are wrong if:
  • Bridge pattern confidence falls below 0.30 for two consecutive bridge-engine runs.
  ${matchedInds.slice(0, 3).map(ind => '• Indicator "' + ind + '" reverses in two consecutive quarters').join('\n  ')}
  • Counterparty-network stress propagation flips sign in the spider-web propagator.
  ${isShort
    ? '• Kernel phase IMPROVES (distress reverses toward an earlier / recovery phase) for two consecutive readings — the short is invalidated.'
    : '• Kernel phase deteriorates to ' + ((val && val.nextPhase) || 'a more distressed phase') + ' for two consecutive readings — the long is invalidated.'}

Mitigating factors monitored:
  • Bridge-engine refresh cadence: per build-bridge-readings runner cron.
  • Kernel reading freshness: per K2 persistence runner.

Primary risks we accept:
  • Pattern detection vs. mechanism — the bridge pattern is a CLAIM about isomorphic pathology; the empirical correlation requires Phase-II validation.
  • Cross-domain transfer is only as strong as the underlying ${neuralLabel} ↔ ${businessSig} mapping confidence (${bridge.bridge ? bridge.bridge.confidence : 'see pattern file'}).`;

  // Exit
  const targetClause = haveVal ? ('$' + val.target) : 'the phase-implied re-rating completes';
  const exit = `We will exit upon:
  (a) Price reaches ${targetClause}, OR
  (b) Variant view confirmed and consensus converges, OR
  (c) Any "we are wrong if" trigger fires at the confirm threshold, OR
  (d) ${horizon} months elapse without progress on the bridge-pattern indicators.

We will NOT exit on:
  • Drawdown alone absent thesis change.
  • Sentiment reversal absent a fundamental bridge-pattern shift.`;

  // Position sizing — real (from the valuation's asymmetry + live ADV)
  let positionSizing;
  if (haveVal) {
    const advStr = md.advUsd != null ? '$' + (md.advUsd / 1e6).toFixed(1) + 'M' : 'n/a';
    positionSizing = `Sized at ${val.positionSizePct}% of portfolio because:
  • Conviction: bridge confidence ${conf != null ? conf : 'n/a'}, matched indicators ${matchedInds.length} of ${bridge.totalIndicators || matchedInds.length || '?'}.
  • Asymmetry: ${val.asymmetry != null ? val.asymmetry + ':1' : 'n/a'} probability-weighted reward-to-risk (target $${val.probWeightedTarget} vs stop $${val.stop != null ? val.stop : 'n/a'}).
  • Liquidity: average daily dollar volume ${advStr}.
  • Phase governor: ${phaseLabel} caps upsize until the phase reading stabilizes for two consecutive quarters.`;
  } else {
    positionSizing = `Size: conviction-scaled to bridge confidence ${conf != null ? conf : 'n/a'} (${matchedInds.length} matched indicators); no fixed percentage published absent a computable risk/reward. Phase governor: ${phaseLabel}.`;
  }

  return {
    lane: 'investment',
    patternId: bridge.patternId,
    confidence: bridge.confidence,
    side,
    horizon: da.horizon || '12-18mo',
    valuationBasis: haveVal ? Object.assign({}, val, { marketDataAsOf: md.asOf, sources: md.sources }) : { computed: false, reason: md ? ('missing ' + (md.missing || []).join(',')) : 'no_market_data' },
    artifact: {
      header,
      variantView,
      catalystBlock,
      valuation,
      positionSizing,
      risk,
      exit,
      thesisStatement: da.thesis,
      instruments: da.instruments || ['common equity']
    },
    provenance: { kernelId: 'engine_output_generator/2.0_market_data', sourceLane: 'investment', generatedAt: new Date().toISOString(), marketDataSources: md ? md.sources : null }
  };
}

// ─── RESEARCH lane ───────────────────────────────────────────────
function generateResearch(portal, bridge) {
  const da = (bridge.derivedAngles || {}).research || {};
  if (!da.hypothesis) return null;
  const name = _name(portal);
  const neuralLabel = bridge.neuralRegionLabel || bridge.neuralRegion;
  const businessSig = (bridge.businessSignature || '').replace(/_/g, ' ');
  return {
    lane: 'research',
    patternId: bridge.patternId,
    confidence: bridge.confidence,
    artifact: {
      title: `Empirical test of ${neuralLabel}-equivalent ${businessSig} mapping on ${name}`,
      hypothesis: da.hypothesis,
      methodology: da.methodology || 'Matched-cohort observational study with control group selection by sector + size + kernel phase.',
      preregistration: 'Hypothesis, primary endpoint, and analysis plan to be filed with OSF prior to data collection.',
      falsifiability: 'Hypothesis is falsified if the effect size is below a pre-registered minimum (set at OSF preregistration) or if matched controls show an equivalent effect.',
      expectedOutcome: 'Confirmation of the bridge-pattern mapping would establish empirical basis for ' + neuralLabel + '-equivalent corporate-pathology detection across the ' + (bridge.business ? bridge.business.phaseAffinity.join('/') : 'phase-affinity') + ' phases.',
      bridgeReference: bridge.patternId
    },
    provenance: { kernelId: 'engine_output_generator/1.0', sourceLane: 'research', generatedAt: new Date().toISOString() }
  };
}

// ─── orchestrate per portal ──────────────────────────────────────
function generateForPortal(portal, opts) {
  const bridges = (portal.bridgeReadings && portal.bridgeReadings.matched) || [];
  if (!bridges.length) return null;
  const md = opts && opts.marketData;   // live market-data snapshot (or null ⇒ honest qualitative)
  const out = { investment: [], research: [], generatedAt: new Date().toISOString(), generatorVersion: '2.0_research_investment_only', bridgeCount: bridges.length };
  for (const bridge of bridges) {
    // Only investment + research are operational. A retired lane may not be
    // represented by an empty compatibility key because that lets stale
    // application documents survive corpus rebuilds unnoticed.
    const i = generateInvestment(portal, bridge, md); if (i) out.investment.push(i);
    const r = generateResearch(portal, bridge);   if (r) out.research.push(r);
  }
  out.artifactsByLane = { investment: out.investment.length, research: out.research.length };
  out.totalArtifacts = out.investment.length + out.research.length;
  return out;
}

module.exports = { generateForPortal, generateInvestment, generateResearch };
