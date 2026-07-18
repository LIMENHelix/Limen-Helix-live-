/**
 * lib/evidence-packet.js — the CrossDomainEvidencePacket schema + receiving-domain DISPOSITION.
 *
 * The Phase-0 audit found the inter-brain bus delivers a bare 5-field emission
 * ({sourceDomain,targetDomain,signal,magnitude,timestamp}) and the target accepts it UNCONDITIONALLY —
 * no provenance, no calibration, no admission control (only an aggregate 0.3 pressure cap downstream).
 *
 * This adds the typed packet AND the receiving-domain's independent admission decision. Per the spec:
 *   - v1 transfers MEASURABLE EVIDENCE, never learned weights. A packet is a calibrated claim + provenance.
 *   - the TARGET decides how much to trust it from: source calibration, spatial/temporal/ontological
 *     overlap, historical transfer usefulness, current target state, and CONTRADICTORY local evidence.
 *   - disposition ∈ accepted | discounted | deferred | rejected | requires-review, with a [0,1] weight.
 *
 * Pure: no Redis, no Date, deterministic. The caller supplies `now` and the target's current read.
 */

var RELATION_TYPES = ['supply-dependency', 'ownership', 'transport-corridor', 'grid-connection',
  'market-linkage', 'regulatory-boundary', 'temporal-co-occurrence', 'unknown'];
var DISPOSITIONS = ['accepted', 'discounted', 'deferred', 'rejected', 'requires-review'];

function r4(x) { return Math.round(x * 10000) / 10000; }
function clamp01(x) { x = Number(x); if (!isFinite(x)) return 0; return Math.max(0, Math.min(1, x)); }

// Build a validated packet. Missing optional fields default honestly (unknown / null), never fabricated.
function build(f) {
  f = f || {};
  var errors = [];
  if (!f.sourceDomain) errors.push('sourceDomain required');
  if (!f.targetDomain) errors.push('targetDomain required');
  if (!f.canonicalId) errors.push('canonicalId required (event/diagnosis/node id)');
  var relation = (RELATION_TYPES.indexOf(f.relationType) !== -1) ? f.relationType : 'unknown';
  var packet = {
    version: 1,
    sourceDomain: String(f.sourceDomain || ''), targetDomain: String(f.targetDomain || ''),
    canonicalId: String(f.canonicalId || ''),
    spatialScope: f.spatialScope || null,               // {regionId|bbox|point} or null (non-spatial claim)
    temporalScope: f.temporalScope || null,             // {validFrom,validTo} or null
    evidenceRefs: Array.isArray(f.evidenceRefs) ? f.evidenceRefs.slice(0, 20) : [],
    provenance: f.provenance || { source: f.sourceDomain || 'unknown', method: 'unspecified' },
    sourceConfidence: (typeof f.sourceConfidence === 'number') ? clamp01(f.sourceConfidence) : null,
    calibrationState: f.calibrationState || 'uncalibrated',   // 'calibrated'|'uncalibrated'|'self-consistency'
    forecast: f.forecast || null,                       // {direction,horizon,...}
    falsifier: f.falsifier || null,                     // the claim's explicit falsifier (or null)
    relationType: relation,                             // NEVER 'proximity' — nearness is a query, not a claim
    transmissionReason: String(f.transmissionReason || 'unspecified'),
    decay: f.decay || { halflifeMs: null },             // packet-level decay rule
    madeAt: (typeof f.madeAt === 'number') ? f.madeAt : null,
    disposition: null                                   // filled by the receiver
  };
  return { ok: errors.length === 0, errors: errors, packet: packet };
}

// The RECEIVING domain's independent admission decision. Returns { disposition, weight, reasons }.
// target: { state, contradicts (bool), ontologyRelated (bool), spatialOverlap 0..1, temporalOverlap 0..1 }
// history: { usefulness 0..1 (past transfer uplift from this source), samples }
function disposition(packet, target, history, opts) {
  opts = opts || {}; target = target || {}; history = history || {};
  var reasons = [];

  // hard rejects first
  if (!packet || !packet.canonicalId) return { disposition: 'rejected', weight: 0, reasons: ['malformed packet'] };
  if (target.contradicts) { return { disposition: 'rejected', weight: 0, reasons: ['contradicted by local evidence'] }; }

  // uncalibrated / self-consistency source ⇒ never auto-accept; hold for review
  if (packet.calibrationState !== 'calibrated') {
    reasons.push('source not calibrated (' + packet.calibrationState + ')');
  }

  // start from source confidence (abstain low if unknown), then modulate by overlap + relation + history
  var base = (typeof packet.sourceConfidence === 'number') ? packet.sourceConfidence : 0.3;
  var sOverlap = (typeof target.spatialOverlap === 'number') ? clamp01(target.spatialOverlap) : (packet.spatialScope ? 0 : 1);
  var tOverlap = (typeof target.temporalOverlap === 'number') ? clamp01(target.temporalOverlap) : (packet.temporalScope ? 0.5 : 1);
  var ontated = (target.ontologyRelated || (packet.relationType && packet.relationType !== 'unknown')) ? 1 : 0.4;
  var histUse = (typeof history.usefulness === 'number' && (history.samples || 0) >= (opts.minHistory || 3)) ? clamp01(history.usefulness) : 0.5;

  var weight = clamp01(base * (0.4 + 0.6 * sOverlap) * (0.5 + 0.5 * tOverlap) * ontated * (0.5 + 0.5 * histUse));

  var disp;
  if (packet.relationType === 'unknown' && sOverlap < 0.2) { disp = 'deferred'; reasons.push('no declared relation + no spatial overlap'); }
  else if (packet.calibrationState !== 'calibrated') { disp = 'requires-review'; }
  else if (weight < 0.15) { disp = 'discounted'; reasons.push('weight below action threshold'); }
  else { disp = 'accepted'; }

  reasons.push('weight=' + r4(weight) + ' (conf ' + r4(base) + ', sOverlap ' + r4(sOverlap) + ', tOverlap ' + r4(tOverlap) + ', ont ' + ontated + ', hist ' + r4(histUse) + ')');
  return { disposition: disp, weight: r4(weight), reasons: reasons };
}

module.exports = { build: build, disposition: disposition, RELATION_TYPES: RELATION_TYPES, DISPOSITIONS: DISPOSITIONS };
