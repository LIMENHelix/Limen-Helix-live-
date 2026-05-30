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

function matchPortal(portal) {
  const lib = loadPatterns();
  const out = { matched: [], evaluatedAt: new Date().toISOString(), patternsConsidered: (lib.patterns || []).length };
  for (const pattern of (lib.patterns || [])) {
    const indicators = pattern.business && pattern.business.indicators || [];
    if (indicators.length === 0) continue;
    const matchedIndicators = [];
    for (const ind of indicators) {
      if (evalDetector(ind.detector, portal)) matchedIndicators.push(ind.id);
    }
    if (matchedIndicators.length === 0) continue;
    const matchRate = matchedIndicators.length / indicators.length;
    const baseConfidence = (pattern.bridge && pattern.bridge.confidence) || 0.5;
    const confidence = +(matchRate * baseConfidence).toFixed(3);
    // Skip matches below a meaningful threshold
    if (confidence < 0.15) continue;
    out.matched.push({
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
    });
  }
  // Sort by confidence DESC, then by match-rate DESC
  out.matched.sort((a, b) => b.confidence - a.confidence || b.matchRate - a.matchRate);
  return out;
}

module.exports = { matchPortal, loadPatterns };
