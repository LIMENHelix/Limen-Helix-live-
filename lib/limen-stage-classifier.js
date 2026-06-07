/**
 * api/lib/limen-stage-classifier.js — Entity stage classification
 *
 * Reads portal data + financialHealth + revenue indicators and returns
 * the entity's *funding-readiness stage*, used to route engine
 * artifacts through the correct template. Same architectural fix that
 * resolved the Truist P7a misclassification: classify BEFORE selecting
 * the template, not after.
 *
 * Stages:
 *   PRE_REVENUE   — no historical tax returns, no contracted ARR.
 *                   Eligible: SBIR Phase I, microgrant, friends/family,
 *                   pre-seed equity. NOT eligible: SBA 7(a) cash-flow
 *                   underwriting (because there's no cash flow to
 *                   underwrite). Cannot pretend it does.
 *
 *   EARLY_REVENUE — 0-2 years operating, $0-$1M annualized.
 *                   Eligible: SBIR Phase I/II, SBA Microloan, SBA
 *                   Express ≤ $350K, seed equity. Possible: SBA 7(a)
 *                   Small Loan if strong collateral + personal guaranty.
 *
 *   SCALING       — 2-5 years operating, $1M-$50M annualized.
 *                   Eligible: full SBA 7(a), Series A/B, NSF SBIR
 *                   Phase II, federal R&D contracts.
 *
 *   MATURE        — 5+ years operating, $50M+ annualized.
 *                   Eligible: all instruments including high-LTV
 *                   secured debt, public-market debt, M&A as buyer.
 *
 *   UNKNOWN       — insufficient signal to classify; treat as PRE_REVENUE
 *                   conservatively.
 *
 * Lane × Stage routing matrix:
 *   PRE_REVENUE × patent     → ALLOWED (provisional patent template)
 *   PRE_REVENUE × grant      → SBIR Phase I template (NOT R01)
 *   PRE_REVENUE × sba        → REFUSE — direct operator to grant first
 *   PRE_REVENUE × franchise  → REFUSE — no operating model to franchise
 *   PRE_REVENUE × investment → angel/pre-seed pitch deck variant
 *   PRE_REVENUE × research   → ALLOWED (thesis builder)
 *
 *   EARLY_REVENUE × sba      → SBA Microloan / Express ≤ $350K only
 *   EARLY_REVENUE × franchise → DRAFT (warn: limited operating history)
 *   etc.
 */

function _safeNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Classify entity stage from portal data.
 * @param {object} portal — v2.0.1 portal JSON
 * @returns {{stage: string, confidence: number, signals: object[]}}
 */
function classifyStage(portal) {
  if (!portal || typeof portal !== 'object') {
    return { stage: 'UNKNOWN', confidence: 0, signals: [{ reason: 'no-portal' }] };
  }

  const signals = [];
  const fh = portal.financialHealth || {};

  // Signal 1: explicit revenue figure
  const revLatest4Q = _safeNumber(fh.revenueLast4Q || fh.revenueLast4Quarters);
  const revLatestQ = _safeNumber(fh.revenueLatestQuarter);
  let annualizedRev = null;
  if (revLatest4Q !== null) annualizedRev = revLatest4Q;
  else if (revLatestQ !== null) annualizedRev = revLatestQ * 4;

  if (annualizedRev !== null) {
    signals.push({ kind: 'revenue', annualized: annualizedRev });
  }

  // Signal 2: SEC CIK presence (synthetic 0000000999 explicitly flagged)
  const cik = String(portal.cik || '').trim();
  const cikNumeric = cik.replace(/^0+/, '');
  const isSyntheticCik = cikNumeric === '999' || cikNumeric === '0' || cikNumeric === '';
  if (isSyntheticCik) {
    signals.push({ kind: 'cik', value: cik, note: 'synthetic-or-missing-sec-cik' });
  }

  // Signal 3: history length — if portal mentions 16+ quarters in
  // financialHealth.historyQuarters that's a strong scaling/mature signal
  const histQ = _safeNumber(fh.historyQuarters);
  if (histQ !== null) signals.push({ kind: 'history', quarters: histQ });

  // Signal 4: explicit founding year in industry/descriptor
  const desc = String(portal.industry || '') + ' ' + String(portal.descriptor || '');
  const foundYearMatch = desc.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (foundYearMatch) {
    const yearsOld = (new Date().getFullYear()) - parseInt(foundYearMatch[1], 10);
    signals.push({ kind: 'age-from-text', yearsOld: yearsOld, foundYear: foundYearMatch[1] });
  }

  // Signal 5: schema hint — kernelStatus or formationStage if set
  if (portal.formationStage) {
    signals.push({ kind: 'declared-stage', value: portal.formationStage });
  }

  // Decision tree (conservative — when in doubt go to a less-eligible
  // stage so we don't mislabel a pre-revenue applicant as mature)
  let stage = 'UNKNOWN';
  let confidence = 0;

  if (isSyntheticCik && (annualizedRev === null || annualizedRev === 0)) {
    stage = 'PRE_REVENUE';
    confidence = 0.9;
  } else if (annualizedRev !== null) {
    if (annualizedRev >= 50_000_000) {
      stage = 'MATURE'; confidence = 0.85;
    } else if (annualizedRev >= 1_000_000) {
      stage = 'SCALING'; confidence = 0.8;
    } else if (annualizedRev > 0) {
      stage = 'EARLY_REVENUE'; confidence = 0.8;
    } else {
      stage = 'PRE_REVENUE'; confidence = 0.85;
    }
    if (histQ !== null && histQ >= 20 && stage === 'SCALING') {
      stage = 'MATURE'; confidence = 0.85;
    }
  } else if (histQ !== null && histQ >= 12) {
    stage = 'SCALING'; confidence = 0.55; // history but no revenue figure
  } else if (histQ !== null && histQ >= 4) {
    stage = 'EARLY_REVENUE'; confidence = 0.45;
  } else {
    stage = 'UNKNOWN'; confidence = 0.2;
  }

  // Strong override: declared formationStage if present
  if (portal.formationStage) {
    const declared = String(portal.formationStage).toUpperCase();
    if (['PRE_REVENUE', 'EARLY_REVENUE', 'SCALING', 'MATURE'].indexOf(declared) !== -1) {
      stage = declared;
      confidence = Math.max(confidence, 0.9);
    }
  }

  return { stage, confidence, signals };
}

// Lane × stage routing
const STAGE_LANE_MATRIX = {
  PRE_REVENUE: {
    patent:     { allowed: true,  template: 'provisional' },
    grant:      { allowed: true,  template: 'sbir-phase-1' },
    sba:        { allowed: false, refuseReason: 'pre-revenue-no-cash-flow', suggest: 'Grant (SBIR Phase I) first; SBA Microloan or Express after first grant deposit creates a revenue line.' },
    franchise:  { allowed: false, refuseReason: 'no-operating-model-to-franchise', suggest: 'Defer franchise lane until operating history exceeds 2 years.' },
    investment: { allowed: true,  template: 'pre-seed-pitch-deck' },
    research:   { allowed: true,  template: 'standard' }
  },
  EARLY_REVENUE: {
    patent:     { allowed: true,  template: 'utility-standard' },
    grant:      { allowed: true,  template: 'sbir-phase-1' },
    sba:        { allowed: true,  template: 'sba-express-or-microloan', cap: 350_000, warn: 'Limited operating history — cap loan ask at $350K (SBA Express).' },
    franchise:  { allowed: true,  template: 'fdd-standard', warn: 'Operating history under 2 years — Item 19 financial-performance representations require careful substantiation.' },
    investment: { allowed: true,  template: 'seed-pitch-deck' },
    research:   { allowed: true,  template: 'standard' }
  },
  SCALING: {
    patent:     { allowed: true,  template: 'utility-standard' },
    grant:      { allowed: true,  template: 'sbir-phase-2' },
    sba:        { allowed: true,  template: 'sba-7a-standard' },
    franchise:  { allowed: true,  template: 'fdd-standard' },
    investment: { allowed: true,  template: 'series-a-b-pitch-deck' },
    research:   { allowed: true,  template: 'standard' }
  },
  MATURE: {
    patent:     { allowed: true,  template: 'utility-standard' },
    grant:      { allowed: true,  template: 'r01-or-large-research' },
    sba:        { allowed: true,  template: 'sba-7a-standard' },
    franchise:  { allowed: true,  template: 'fdd-standard' },
    investment: { allowed: true,  template: 'public-equity-thesis' },
    research:   { allowed: true,  template: 'standard' }
  },
  UNKNOWN: {
    patent:     { allowed: true,  template: 'utility-standard' },
    grant:      { allowed: true,  template: 'sbir-phase-1' },
    sba:        { allowed: false, refuseReason: 'stage-unknown', suggest: 'Populate portal.financialHealth with revenue figures before requesting SBA underwriting.' },
    franchise:  { allowed: false, refuseReason: 'stage-unknown' },
    investment: { allowed: true,  template: 'seed-pitch-deck' },
    research:   { allowed: true,  template: 'standard' }
  }
};

function routeLaneForStage(stage, lane) {
  const stageMatrix = STAGE_LANE_MATRIX[stage] || STAGE_LANE_MATRIX.UNKNOWN;
  return stageMatrix[lane] || { allowed: false, refuseReason: 'unknown-lane' };
}

module.exports = {
  classifyStage,
  routeLaneForStage,
  STAGE_LANE_MATRIX
};
