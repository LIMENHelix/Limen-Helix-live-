/**
 * brain-v2/corpus/adapter.js — domain JSON files into identified records and graded claims.
 *
 * ONE FILE OPEN AT A TIME. The corpus is 465,939 files; this reads, parses, extracts and
 * releases each one before touching the next.
 *
 * ═════════════════════════════════════════════════════════════════════════════════
 * THE MISTAKE THIS FILE WAS REWRITTEN TO FIX, because it is the instructive one.
 *
 * The first version gated admission on `_enrichment` and excluded 26,990 of 27,165
 * energy records — 99.4% of the corpus — as "unsupported, no provenance".
 *
 * `_enrichment` is TRANSFORMATION METADATA, not source provenance.
 * `neuralRoleMigratedAt` is when WE migrated a neural role. `schemaVersion` is OUR
 * schema. `networkMapVersion` is OUR map. None of it says anything about where the
 * underlying claim came from. Treating our own pipeline's bookkeeping as upstream
 * provenance, and then discarding the corpus for lacking it, threw away the mission
 * to satisfy a check that never meant what it claimed.
 *
 * TWO DIFFERENT THINGS, NOW KEPT APART:
 *
 *   ARTIFACT IDENTITY — which record is this, and has it changed?
 *     domainId + content hash + path. EVERY parseable record has one. This is what
 *     makes ingestion idempotent and change-detectable. It is not evidence of anything
 *     about the world, and it no longer pretends to be.
 *
 *   CLAIM-LEVEL EVIDENCE PROVENANCE — what grades THIS particular assertion?
 *     Per circuit: `evidence`, `_canonical`, and the issue's `resolved.source`. It
 *     attaches to the individual claim, never to the file. One record can hold a
 *     measured claim and an ungraded one at the same time, and flattening them to a
 *     file-level grade destroys exactly the distinction that decides what to do next.
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * FIVE DISPOSITIONS, redefined so each names a real and distinct condition:
 *
 *   admitted     parsed, has a domainId, artifact identity established
 *   rejected     unreadable, unparseable, or no domainId — cannot be identified at all
 *   duplicate    this domainId already ingested this run
 *   stale        the ARTIFACT is older than a caller-supplied floor (file mtime)
 *   unsupported  admitted and identified, but carries NO assertable content at all —
 *                no issues, no activations, no edges. A valid record that can support
 *                no claim. Counted separately because "we hold it" and "it can support
 *                an opportunity" are different facts.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var MAN = require('./manifest.js');

var DISPOSITION = {
  ADMITTED: 'admitted', REJECTED: 'rejected', DUPLICATE: 'duplicate',
  STALE: 'stale', UNSUPPORTED: 'unsupported'
};

/**
 * EVIDENCE GRADES, per claim, read from the corpus and never assigned here.
 *
 * UNRATED IS NOT ANALOGY, and collapsing them was a real loss of information:
 *   unrated  — nobody has assessed this claim. The grade is MISSING.
 *   analogy  — someone assessed it and judged it an analogy. The grade is PRESENT.
 * The first is a gap in our work; the second is a finding about the claim. A grading
 * study is worth commissioning for the first and pointless for the second.
 */
var EVIDENCE_TYPE = {
  MEASURED: 'measured', REPORTED: 'reported', INFERRED: 'inferred',
  HYPOTHESIS: 'hypothesis', ANALOGY: 'analogy', UNRATED: 'unrated'
};

/** Grades that represent an actual assessment, as opposed to its absence. */
var ASSESSED = [EVIDENCE_TYPE.MEASURED, EVIDENCE_TYPE.REPORTED, EVIDENCE_TYPE.INFERRED,
                EVIDENCE_TYPE.HYPOTHESIS, EVIDENCE_TYPE.ANALOGY];

function classifyEvidence(raw) {
  var has = !(raw === undefined || raw === null || String(raw).trim() === '');
  var v = has ? String(raw).toLowerCase().trim() : '';
  if (!has) return { type: EVIDENCE_TYPE.UNRATED, stated: null, assessed: false, why: 'no evidence field on this claim — the grade is MISSING, not weak' };
  if (v === 'unrated' || v === 'none' || v === 'n/a') {
    return { type: EVIDENCE_TYPE.UNRATED, stated: raw, assessed: false,
      why: 'the corpus explicitly records this claim as ungraded. UNRATED is a gap in our assessment, ' +
           'NOT a judgement that the claim is an analogy — the two must not be merged.' };
  }
  if (/measur|empiric|trial|rct|quantif/.test(v)) return { type: EVIDENCE_TYPE.MEASURED, stated: raw, assessed: true, why: 'corpus grade "' + raw + '"' };
  if (/report|case|observ|survey|filing/.test(v)) return { type: EVIDENCE_TYPE.REPORTED, stated: raw, assessed: true, why: 'corpus grade "' + raw + '"' };
  if (/infer|derive|model|estimat/.test(v)) return { type: EVIDENCE_TYPE.INFERRED, stated: raw, assessed: true, why: 'corpus grade "' + raw + '"' };
  if (/hypoth|propos|candidate/.test(v)) return { type: EVIDENCE_TYPE.HYPOTHESIS, stated: raw, assessed: true, why: 'corpus grade "' + raw + '"' };
  if (/analog|metaphor|isomorph|resembl/.test(v)) return { type: EVIDENCE_TYPE.ANALOGY, stated: raw, assessed: true, why: 'corpus grade "' + raw + '"' };
  return { type: EVIDENCE_TYPE.UNRATED, stated: raw, assessed: false,
    why: 'grade "' + raw + '" is outside the recognised vocabulary; recorded as UNRATED rather than ' +
         'guessed into a level, and the raw string is kept so it can be mapped later' };
}

/**
 * ARTIFACT IDENTITY. Content hash over the file bytes, so a re-read of an unchanged
 * file yields the same identity and a single byte change yields a different one. This
 * is what makes ingestion idempotent; it asserts nothing about the world.
 */
function artifactIdentity(rec, relPath, raw, stat) {
  if (!rec || !rec.domainId) return null;
  var hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return {
    recordId: rec.domainId,
    contentHash: hash,
    artifactId: rec.domainId + '@' + hash,
    path: relPath,
    bytes: raw.length,
    fileModifiedAt: stat ? stat.mtimeMs : null,
    /* Recorded, never used to gate admission. It describes OUR pipeline, not the source. */
    transformationMetadata: rec._enrichment
      ? { schemaVersion: rec._enrichment.schemaVersion || null,
          networkMapVersion: rec._enrichment.networkMapVersion || null,
          neuralRoleMigratedAt: rec._enrichment.neuralRoleMigratedAt || null,
          note: 'OUR transformation bookkeeping. Not source provenance and not an admission criterion.' }
      : null
  };
}

/** Every circuit claim in a record, each carrying its OWN grade and its own citation. */
function claimsOf(rec, ident) {
  var out = [];
  (rec.issues || []).forEach(function (is) {
    var resolvedSource = (is.resolved && is.resolved.source) || null;
    (is.circuits || []).forEach(function (c, ci) {
      var cl = classifyEvidence(c.evidence);
      out.push({
        claimId: ident.recordId + '/' + is.id + '/' + (c.nodeId || 'n' + ci),
        issueId: is.id, issueLabel: is.label,
        brainNodeId: c.nodeId, direction: c.dir, detail: c.detail,
        evidenceType: cl.type, evidenceStated: cl.stated, evidenceAssessed: cl.assessed, evidenceWhy: cl.why,
        canonical: c._canonical === true,
        /* How the claim SET was resolved. "override" means a human replaced the
           generated set — weak provenance, but real and worth keeping distinct. */
        resolutionSource: resolvedSource,
        citation: { artifactId: ident.artifactId, path: ident.path, jsonPath: 'issues[' + is.id + '].circuits[' + ci + ']' }
      });
    });
  });
  return out;
}

/** Graph structure: this node, its declared edges, and its activations. */
function graphOf(rec, ident) {
  return {
    nodeId: ident.recordId,
    title: rec.title || null,
    phase: rec.phase || null,
    parent: rec.parentLabel || null,
    edges: (rec.edges || []).filter(function (e) { return e && e.source && e.target; })
      .map(function (e) { return { source: e.source, target: e.target, type: e.type || null, weight: (typeof e.weight === 'number' && isFinite(e.weight)) ? e.weight : null }; }),
    activations: (rec.activations || []).map(function (a) {
      return {
        brainNodeId: a.brainNodeId, state: a.state || null, label: a.domainLabel || null,
        functionalRole: a.functional_role || null,
        weight: (typeof a.weight === 'number' && isFinite(a.weight)) ? a.weight : null,
        /* Direct business hooks the first version ignored entirely. */
        companies: Array.isArray(a.companies) ? a.companies.length : 0,
        treatments: Array.isArray(a.treatments) ? a.treatments.length : 0,
        diagnosticTriggers: Array.isArray(a.diagnosticTriggers) ? a.diagnosticTriggers.length : 0
      };
    })
  };
}

/**
 * STREAM the corpus. `onRecord({identity, graph, claims})` is called for every ADMITTED
 * record — which is now every parseable record with a domainId, as it should be.
 */
function stream(opts) {
  var root = opts.root;
  var manifestPath = opts.manifestPath;
  var limit = (typeof opts.limit === 'number') ? opts.limit : Infinity;
  var staleBefore = (typeof opts.staleBefore === 'number') ? opts.staleBefore : null;
  var keepExamples = (typeof opts.keepExamples === 'number') ? opts.keepExamples : 3;
  var onRecord = opts.onRecord || function () {};

  var counts = { read: 0, admitted: 0, rejected: 0, duplicate: 0, stale: 0, unsupported: 0 };
  var claimGrades = Object.create(null);
  var examples = { rejected: [], duplicate: [], stale: [], unsupported: [] };
  var seen = Object.create(null);
  var bytes = 0, peakHeap = 0, t0 = Date.now();

  function note(kind, relPath, why) {
    counts[kind]++;
    if (examples[kind] && examples[kind].length < keepExamples) examples[kind].push({ path: relPath, why: why });
  }

  MAN.streamManifest(manifestPath, function (entry) {
    if (counts.read >= limit) return false;
    counts.read++;
    bytes += entry.size || 0;

    var abs = path.join(root, entry.path), raw, rec;
    try { raw = fs.readFileSync(abs, 'utf8'); }
    catch (e) { note('rejected', entry.path, 'unreadable: ' + e.message); return true; }
    try { rec = JSON.parse(raw); }
    catch (e) { note('rejected', entry.path, 'unparseable JSON: ' + e.message.slice(0, 80)); return true; }

    var ident = artifactIdentity(rec, entry.path, raw, entry);
    raw = null;
    if (!ident) { note('rejected', entry.path, 'no domainId — the record cannot be identified at all'); return true; }

    if (seen[ident.recordId]) { note('duplicate', entry.path, 'domainId ' + ident.recordId + ' already ingested this run'); return true; }
    if (staleBefore !== null && ident.fileModifiedAt !== null && ident.fileModifiedAt < staleBefore) {
      note('stale', entry.path, 'artifact modified ' + new Date(ident.fileModifiedAt).toISOString().slice(0, 10) + ', before the floor');
      return true;
    }

    seen[ident.recordId] = true;
    var graph = graphOf(rec, ident);
    var claims = claimsOf(rec, ident);

    /* Identified and held, but asserting nothing. Distinct from rejected. */
    var assertable = claims.length + graph.edges.length + graph.activations.length;
    if (assertable === 0) {
      note('unsupported', entry.path, 'valid record with no issues, edges or activations — nothing it can support a claim with');
      counts.admitted++;
      onRecord({ identity: ident, graph: graph, claims: claims, assertable: false });
      return true;
    }

    counts.admitted++;
    claims.forEach(function (c) { claimGrades[c.evidenceType] = (claimGrades[c.evidenceType] || 0) + 1; });
    onRecord({ identity: ident, graph: graph, claims: claims, assertable: true });

    if (counts.read % 1000 === 0) {
      var h = process.memoryUsage().heapUsed / 1048576;
      if (h > peakHeap) peakHeap = h;
    }
    return true;
  }, { limit: limit });

  var ms = Date.now() - t0;
  return {
    counts: counts, claimGrades: claimGrades, examples: examples,
    bytesRead: bytes, peakHeapMB: Math.round(peakHeap), elapsedMs: ms,
    filesPerSecond: ms ? Math.round(counts.read / (ms / 1000)) : null,
    why: counts.read + ' read: ' + counts.admitted + ' admitted (' + counts.unsupported +
         ' of them assert nothing), ' + counts.rejected + ' rejected, ' + counts.duplicate +
         ' duplicate, ' + counts.stale + ' stale'
  };
}

module.exports = {
  DISPOSITION: DISPOSITION, EVIDENCE_TYPE: EVIDENCE_TYPE, ASSESSED: ASSESSED,
  classifyEvidence: classifyEvidence, artifactIdentity: artifactIdentity,
  claimsOf: claimsOf, graphOf: graphOf, stream: stream
};
