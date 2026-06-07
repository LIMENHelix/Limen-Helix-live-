/**
 * bridge-engine.js — match portals against bridge patterns.
 *
 * For each portal, walks the bridge pattern library, evaluates each pattern's
 * indicators against the portal data, computes a per-pattern confidence, and
 * emits matched patterns into portal.bridgeReadings.
 *
 * Indicator detector types (extend as needed):
 *   - kernel_phase           portal.kernelReadings.{k1,k2}.phase in [phases]
 *   - fn_phase_share         share of fn[category] entries in [stressPhases] >= minShare
 *   - fn_text_match          any fn[category] entry has note/role matching [patterns]
 *   - text_match             any of portal.[fields] text matches [patterns]
 *   - field_presence         portal.field is non-null
 *
 * Pattern confidence:
 *   matched_indicators / total_indicators × pattern.bridge.confidence
 *
 * derivedAngles are passed through with portal-specific contextualization.
 */
const fs = require('node:fs');
const path = require('node:path');

const PATTERNS_PATH = path.join(__dirname, '..', '..', 'assets', 'data', 'bridge-patterns.json');

let _patterns = null;
function loadPatterns() {
  if (_patterns) return _patterns;
  try { _patterns = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8')); }
  catch (e) { _patterns = { patterns: [] }; }
  return _patterns;
}

const arrOf = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? [x] : []);
const lower = s => String(s || '').toLowerCase();

function textFromPortalFields(portal, fields) {
  const parts = [];
  for (const f of fields) {
    const v = portal[f];
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') parts.push(x); else if (x && typeof x === 'object') parts.push(JSON.stringify(x));
    else if (v && typeof v === 'object') parts.push(JSON.stringify(v));
  }
  return lower(parts.join(' '));
}

function evalDetector(d, portal) {
  if (!d || !d.type) return false;
  if (d.type === 'kernel_phase') {
    const kr = portal.kernelReadings || {};
    for (const k of (d.kernels || [])) {
      const reading = kr[k];
      if (reading && reading.phase && (d.phases || []).includes(lower(reading.phase))) return true;
    }
    // legacy fallback
    const fh = portal.financialHealth;
    if (fh && fh.dominantPhase && (d.phases || []).includes(lower(fh.dominantPhase))) return true;
    return false;
  }
  if (d.type === 'fn_phase_share') {
    const fn = portal.functionalNetwork || {};
    const arr = arrOf(fn[d.category]);
    if (arr.length === 0) return false;
    const stressed = arr.filter(e => e && e.phase && (d.stressPhases || []).includes(lower(e.phase)));
    return (stressed.length / arr.length) >= (d.minShare || 0.3);
  }
  if (d.type === 'fn_text_match') {
    const fn = portal.functionalNetwork || {};
    const arr = arrOf(fn[d.category]);
    if (arr.length === 0) return false;
    for (const e of arr) {
      const text = lower((e && e.relationshipNote) || '') + ' ' + lower((e && e.brainNodeRole) || '') + ' ' + lower((e && e.name) || '');
      for (const p of (d.patterns || [])) if (text.includes(lower(p))) return true;
    }
    return false;
  }
  if (d.type === 'text_match') {
    const text = textFromPortalFields(portal, d.fields || []);
    for (const p of (d.patterns || [])) if (text.includes(lower(p))) return true;
    return false;
  }
  if (d.type === 'field_presence') {
    const parts = (d.field || '').split('.');
    let cur = portal;
    for (const p of parts) { if (cur == null) return false; cur = cur[p]; }
    return cur != null && cur !== '' && !(Array.isArray(cur) && cur.length === 0);
  }
  return false;
}

// Minimum confidence for a pattern to count as a real match. A pattern below
// this against a given portal does not appear in that portal's bridgeReadings.
const MATCH_THRESHOLD = 0.15;

/**
 * Score ONE pattern against ONE portal using the exact production match logic.
 * Returns the match object (same shape matchPortal emits) or null if the
 * pattern's indicators don't fire / the confidence is below MATCH_THRESHOLD.
 * Used both by matchPortal (over the whole library) and by the author-time
 * salience pre-filter (does a freshly-authored pattern fire on its own source).
 */
// Sector-classifier text matches (text_match whose fields are ONLY sic/industry)
// fire for ANY company in the sector — they confirm the sector, not the pathology.
// Excluded from scoring entirely so confidence reflects substantive grounding, not
// padding. (A pattern that matches ONLY on its sector tag therefore scores null.)
const CLASSIFIER_FIELDS = new Set(['sic', 'industry']);
function _isClassifierDetector(d) {
  return d && d.type === 'text_match' && Array.isArray(d.fields) && d.fields.length > 0
    && d.fields.every(f => CLASSIFIER_FIELDS.has(String(f).toLowerCase()));
}

function scorePattern(pattern, portal) {
  const allIndicators = (pattern && pattern.business && pattern.business.indicators) || [];
  // Score on SUBSTANTIVE indicators only — classifier-only matches neither count
  // toward the firing rate nor pad the denominator.
  const indicators = allIndicators.filter(ind => !_isClassifierDetector(ind.detector));
  if (indicators.length === 0) return null;
  const matchedIndicators = [];
  for (const ind of indicators) {
    if (evalDetector(ind.detector, portal)) matchedIndicators.push(ind.id);
  }
  if (matchedIndicators.length === 0) return null;
  const matchRate = matchedIndicators.length / indicators.length;
  const baseConfidence = (pattern.bridge && pattern.bridge.confidence) || 0.5;
  const confidence = +(matchRate * baseConfidence).toFixed(3);
  if (confidence < MATCH_THRESHOLD) return null;
  return {
    patternId: pattern.id,
    neuralRegion: pattern.neural && pattern.neural.region,
    neuralRegionLabel: pattern.neural && pattern.neural.regionLabel,
    businessSignature: pattern.business && pattern.business.signature,
    mappingType: pattern.bridge && pattern.bridge.mappingType,
    matchedIndicators,
    totalIndicators: indicators.length,
    matchRate: +matchRate.toFixed(3),
    confidence,
    derivedAngles: pattern.derivedAngles || {},
    phaseAffinity: (pattern.business && pattern.business.phaseAffinity) || [],
    knownTreatments: (pattern.neural && pattern.neural.knownTreatments) || []
  };
}

function matchPortal(portal) {
  const lib = loadPatterns();
  const out = { matched: [], evaluatedAt: new Date().toISOString(), patternsConsidered: (lib.patterns || []).length };
  for (const pattern of (lib.patterns || [])) {
    const m = scorePattern(pattern, portal);
    if (m) out.matched.push(m);
  }
  // Sort by confidence DESC, then by match-rate DESC
  out.matched.sort((a, b) => b.confidence - a.confidence || b.matchRate - a.matchRate);
  return out;
}

module.exports = { matchPortal, loadPatterns, scorePattern, MATCH_THRESHOLD };
