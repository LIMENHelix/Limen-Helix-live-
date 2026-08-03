/**
 * brain-v2/corpus/raw-claim-store.js — LAYER 2. Lossless preservation of source values.
 *
 * AUTHORIZED SCOPE: preserve, namespace, count. Nothing here classifies, translates,
 * normalises, ranks, scores, or promotes. There is deliberately NO evidence classifier
 * in this file, and adding one is out of scope regardless of how convenient it looks.
 *
 * ═════════════════════════════════════════════════════════════════════════════════
 * WHY VERBATIM, AND WHAT THE ALTERNATIVE ALREADY COST
 *
 * An earlier prototype ran every grade through one classifier. Measurement then showed
 * two incompatible vocabularies in the corpus:
 *
 *     circuits[].evidence     Moderate 154,218 | Strong 68,540 | Unrated 584
 *     treatments[].evidence   A 182,250 | B 153,879 | C 130,565 | Strong 32
 *
 * A shared classifier would have merged an ordinal three-level circuit scale with an
 * A/B/C treatment scale, and mapped the 154,218 "Moderate" values to nothing because
 * the regex did not recognise them. The graded corpus would have been recorded as
 * ungraded. So: values are stored EXACTLY as found, under a namespace naming which
 * vocabulary they belong to, and no cross-vocabulary mapping exists anywhere.
 *
 * The 32 treatment values reading "Strong" are the circuit vocabulary appearing in the
 * treatment field. They are preserved unchanged and flagged `schemaAnomaly: true`. They
 * are NOT converted to A, B or C, and not dropped — a schema anomaly is a finding about
 * the corpus, and rewriting it would destroy the evidence for it.
 *
 * MEANING IS UNKNOWN. No writer or authoritative definition has been found for
 * `_canonical`, `_authored`, `resolved.source`, or the circuit grades. This layer does
 * not need to know what they mean in order to preserve them, and it does not pretend to.
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * CITATIONS. `citation.raw` holds the source string exactly as found.
 * `citationStatus` is one of:
 *     'claimed'  a string is present. It is a CLAIMED citation, not a verified one —
 *                nothing here resolves or validates it.
 *     'unknown'  no citation field. Recorded as unknown, NOT as absent, false, zero,
 *                refuted, or "analogy".
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var STORE_FORMAT = 2;   // 2 = mandatory trailer with entryCount + entriesHash + sourceSnapshotHash

/**
 * Is `child` genuinely inside `parent`? Compared by RESOLVED SEGMENTS, not by string
 * prefix. A prefix test reports `C:/x/Limen-Helix-live-` as inside `C:/x/Limen-Helix`
 * because the name is a prefix of the sibling's name — which it is not. That false
 * positive blocked the real output directory on the first run.
 */
function isInside(parent, child) {
  var rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}


/** Vocabulary namespaces. Separate names so nothing can be compared across them by accident. */
var VOCABULARY = {
  /* RESOLVED and AUTHORED circuits are DIFFERENT POPULATIONS and must never share a
     tally. Combining them made the circuit distribution sum to 225,894 against a true
     resolved-circuit count of 223,342 — the 2,552 authored entries were silently folded
     in, so the published distribution described a population that does not exist. */
  RESOLVED_CIRCUIT_EVIDENCE: 'resolvedCircuitEvidence',
  AUTHORED_CIRCUIT_EVIDENCE: 'authoredCircuitEvidence',
  CIRCUIT_EVIDENCE: 'circuitEvidence',
  TREATMENT_EVIDENCE: 'treatmentEvidence',
  ACTIVATION_STATE: 'activationState',
  COMPANY_ASSOCIATION: 'companyAssociation'
};

/**
 * Values OBSERVED in each vocabulary during the 2026-08-02 census. Used ONLY to flag a
 * value as unexpected for its field — never to validate, translate or rank one.
 * MEASURED_PATTERN, not an authoritative schema: a value absent here means "not seen in
 * that census", which is not the same as "invalid".
 */
var OBSERVED = {
  resolvedCircuitEvidence: ['Moderate', 'Strong', 'Unrated'],
  authoredCircuitEvidence: ['Moderate', 'Strong', 'Unrated'],
  circuitEvidence: ['Moderate', 'Strong', 'Unrated'],
  treatmentEvidence: ['A', 'B', 'C'],
  activationState: ['active']
};

function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ':' + canonicalJson(v[k]);
  }).join(',') + '}';
}
function hashOf(v) { return crypto.createHash('sha256').update(canonicalJson(v)).digest('hex').slice(0, 32); }

/**
 * Extract every claim from one artifact, preserving originals.
 *
 * `identity` is the Layer 1 identity. Claim ids are POSITIONAL (path + array indices) so
 * they carry no interpretation of the record's own fields and stay stable for a given
 * contentHash without depending on any field's meaning.
 */
function claimsFrom(rec, identity) {
  var out = [];
  var ref = { relativePath: identity.relativePath, contentHash: identity.contentHash, domainId: identity.domainId };

  (Array.isArray(rec.issues) ? rec.issues : []).forEach(function (is, ii) {
    if (!is || typeof is !== 'object') return;

    (Array.isArray(is.circuits) ? is.circuits : []).forEach(function (c, ci) {
      if (!c || typeof c !== 'object') return;
      var rawEvidence = (c.evidence === undefined) ? null : c.evidence;
      out.push({
        claimId: identity.relativePath + '#issues[' + ii + '].circuits[' + ci + ']',
        artifactRef: ref,
        kind: 'resolved-circuit',
        /* VERBATIM. The complete original object, untouched. */
        raw: c,
        rawHash: hashOf(c),
        resolvedCircuitEvidence: {
          raw: rawEvidence,
          present: c.evidence !== undefined,
          vocabulary: VOCABULARY.RESOLVED_CIRCUIT_EVIDENCE,
          unexpectedValue: rawEvidence !== null && OBSERVED.resolvedCircuitEvidence.indexOf(rawEvidence) < 0,
          meaning: 'UNKNOWN — no writer or authoritative definition located for this scale'
        },
        /* (6) NO CITATION FIELD EXISTS on circuits. `citationApplicable: false` keeps
           this out of any missing-citation tally — a record type with no such field has
           not "lost" a citation, and counting it as missing inflated the figure by
           346,972 (circuits + authored + activations). */
        citation: { raw: null, citationStatus: 'not-applicable', citationApplicable: false,
                    note: 'circuits carry no citation field in the measured corpus; NOT a missing citation' },
        /* Preserved verbatim, meaning UNKNOWN. Present on 584 circuits, all L1-L3. */
        canonicalFlag: { raw: (c._canonical === undefined) ? null : c._canonical, present: c._canonical !== undefined,
                         meaning: 'UNKNOWN — name suggests several incompatible readings; no writer located' },
        issueContext: {
          issueIdRaw: (is.id === undefined) ? null : is.id,
          resolvedRaw: (is.resolved === undefined) ? null : is.resolved,
          resolvedPresent: is.resolved !== undefined,
          authoredPresent: is._authored !== undefined,
          meaning: 'UNKNOWN — resolved.source and _authored preserved verbatim; no writer located'
        }
      });
    });

    /* The authored block is preserved as its own claim set, never merged with the
       resolved circuits. Which one supersedes which is UNKNOWN, and merging them would
       decide that question silently. */
    (Array.isArray(is._authored) ? is._authored : []).forEach(function (a, ai) {
      if (!a || typeof a !== 'object') return;
      var rawEvidence = (a.evidence === undefined) ? null : a.evidence;
      out.push({
        claimId: identity.relativePath + '#issues[' + ii + ']._authored[' + ai + ']',
        artifactRef: ref,
        kind: 'authored-circuit',
        raw: a,
        rawHash: hashOf(a),
        authoredCircuitEvidence: {
          raw: rawEvidence, present: a.evidence !== undefined,
          vocabulary: VOCABULARY.AUTHORED_CIRCUIT_EVIDENCE,
          unexpectedValue: rawEvidence !== null && OBSERVED.authoredCircuitEvidence.indexOf(rawEvidence) < 0,
          meaning: 'UNKNOWN — a SEPARATE population from resolved circuits; never tallied together'
        },
        citation: { raw: null, citationStatus: 'not-applicable', citationApplicable: false,
                    note: 'authored circuits carry no citation field; NOT a missing citation' },
        canonicalFlag: { raw: null, present: false, meaning: 'UNKNOWN' },
        issueContext: { issueIdRaw: (is.id === undefined) ? null : is.id,
                        relationToResolved: 'UNKNOWN — precedence between _authored and circuits is not established' }
      });
    });
  });

  (Array.isArray(rec.activations) ? rec.activations : []).forEach(function (a, ai) {
    if (!a || typeof a !== 'object') return;

    (Array.isArray(a.treatments) ? a.treatments : []).forEach(function (t, ti) {
      if (!t || typeof t !== 'object') return;
      var rawEvidence = (t.evidence === undefined) ? null : t.evidence;
      /* A value from the CIRCUIT vocabulary appearing in the TREATMENT field. Flagged,
         preserved unchanged, never converted. 32 measured on 2026-08-02. */
      var anomaly = rawEvidence !== null &&
                    OBSERVED.treatmentEvidence.indexOf(rawEvidence) < 0 &&
                    OBSERVED.circuitEvidence.indexOf(rawEvidence) >= 0;
      var rawCite = (t.cite === undefined || t.cite === null || String(t.cite).trim() === '') ? null : t.cite;
      out.push({
        claimId: identity.relativePath + '#activations[' + ai + '].treatments[' + ti + ']',
        artifactRef: ref,
        kind: 'treatment',
        raw: t,
        rawHash: hashOf(t),
        treatmentEvidence: {
          raw: rawEvidence, present: t.evidence !== undefined,
          vocabulary: VOCABULARY.TREATMENT_EVIDENCE,
          schemaAnomaly: anomaly,
          anomalyNote: anomaly
            ? 'value "' + rawEvidence + '" belongs to the circuitEvidence vocabulary, not treatmentEvidence. ' +
              'Preserved unchanged and flagged. NOT converted to A/B/C — rewriting it would destroy the evidence of the anomaly.'
            : null,
          unexpectedValue: rawEvidence !== null && OBSERVED.treatmentEvidence.indexOf(rawEvidence) < 0,
          meaning: 'UNKNOWN — A/B/C ordering and thresholds not established by any located writer'
        },
        citation: {
          raw: rawCite,
          citationApplicable: true,
          citationStatus: rawCite === null ? 'unknown' : 'claimed',
          note: rawCite === null
            ? 'no cite field; unknown, NOT absent or refuted'
            : 'CLAIMED citation. Nothing in this layer resolves or validates it; it is a string the corpus asserts.'
        }
      });
    });

    out.push({
      claimId: identity.relativePath + '#activations[' + ai + ']',
      artifactRef: ref,
      kind: 'activation',
      raw: a,
      rawHash: hashOf(a),
      activationState: {
        raw: (a.state === undefined) ? null : a.state,
        present: a.state !== undefined,
        vocabulary: VOCABULARY.ACTIVATION_STATE,
        unexpectedValue: a.state !== undefined && OBSERVED.activationState.indexOf(a.state) < 0,
        meaning: 'UNKNOWN — measured as a single value ("active") across 123,630 activations, ' +
                 'so it currently carries no discriminating information'
      },
      companyAssociation: {
        raw: Array.isArray(a.companies) ? a.companies : null,
        count: Array.isArray(a.companies) ? a.companies.length : 0,
        vocabulary: VOCABULARY.COMPANY_ASSOCIATION,
        meaning: 'UNKNOWN — an association only. NOT an opportunity, a customer, a lead, or evidence of one.'
      },
      citation: { raw: null, citationStatus: 'not-applicable', citationApplicable: false,
                  note: 'activations carry no citation field; NOT a missing citation' }
    });
  });

  return out;
}

/**
 * BUILD the raw claim store by streaming the Layer 1 index.
 *
 * Bounded: one artifact is re-read, its claims written, and both released before the
 * next. The store is JSONL so it is appended, never held.
 */
function build(opts) {
  var indexPath = opts.indexPath;
  var corpusRoot = opts.corpusRoot;
  var outDir = opts.outDir;
  if (!indexPath || !corpusRoot || !outDir) throw new Error('indexPath, corpusRoot and outDir are all required');
  if (isInside(corpusRoot, outDir)) {
    throw new Error('outDir is inside the corpus; the corpus is read-only');
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  var AI = require('./artifact-index.js');
  var indexSnapshotHash = null;
  var storePath = path.join(outDir, 'raw-claims.jsonl');
  var tmp = storePath + '.tmp';
  var fd = fs.openSync(tmp, 'w');

  var counts = { artifacts: 0, skippedUnparseable: 0, rawEntries: 0 };
  var byKind = Object.create(null);
  var vocabValues = {
    resolvedCircuitEvidence: Object.create(null),
    authoredCircuitEvidence: Object.create(null),
    treatmentEvidence: Object.create(null),
    activationState: Object.create(null)
  };
  /* (6) CITATIONS RECONCILED PER KIND. Only kinds that HAVE a citation field can have a
     missing one. Pooling them produced "370,874 unknown" out of 816,250 entries, which
     conflated 346,972 records that carry no citation field at all with 21,350 treatments
     that genuinely lack one. */
  var citationsByKind = Object.create(null);
  var anomalies = 0, unexpected = 0;
  var peakHeap = 0, t0 = Date.now();
  /* Entry-stream hash, so a deleted well-formed record is detectable. */
  var entriesDigest = crypto.createHash('sha256');
  var entriesWritten = 0;
  function writeEntry(obj) {
    var line = JSON.stringify(obj);
    entriesDigest.update(line).update('\n');
    entriesWritten++;
    fs.writeSync(fd, line + '\n');
  }

  try {
    fs.writeSync(fd, JSON.stringify({
      _format: STORE_FORMAT,
      note: 'Layer 2 raw entry store. Values preserved verbatim; vocabularies namespaced and never ' +
            'translated. No classifier, no ranking, no promotion. All field meanings are UNKNOWN ' +
            'unless a writer is located. Entries are RAW ENTRIES, not claims: an activation is not ' +
            'asserted to be a claim.'
    }) + '\n');

    var idxRead = AI.streamIndex(indexPath, function (entry, i) {
      if (entry.parseState !== 'ok') { counts.skippedUnparseable++; return true; }
      var abs = path.join(corpusRoot, entry.identity.relativePath);

      /* (3) IDENTITY RE-VERIFICATION. Layer 1 hashed these bytes; Layer 2 reads them
         again, possibly much later. Without re-hashing, a file edited between the two
         passes would have its NEW content stored under the OLD contentHash — new bytes
         wearing an old identity, which is precisely the corruption the identity exists
         to prevent. Mismatch is fatal, not a warning. */
      var rawBytes;
      try { rawBytes = fs.readFileSync(abs); }
      catch (e) {
        throw new Error('SOURCE_CHANGED: ' + entry.identity.relativePath +
          ' was readable during Layer 1 and is not now (' + e.message + ')');
      }
      var nowHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
      if (nowHash !== entry.identity.contentHash) {
        throw new Error('SOURCE_CHANGED: ' + entry.identity.relativePath +
          ' changed between Layer 1 and Layer 2. index contentHash ' +
          String(entry.identity.contentHash).slice(0, 16) + ', now ' + nowHash.slice(0, 16) +
          '. Refusing to attach new content to an old identity — rebuild the index.');
      }

      var rec;
      try { rec = JSON.parse(rawBytes.toString('utf8')); }
      catch (e) {
        throw new Error('SOURCE_CHANGED: ' + entry.identity.relativePath +
          ' parsed in Layer 1 and does not parse now (' + e.message.slice(0, 80) + ')');
      }
      rawBytes = null;

      counts.artifacts++;
      var entries = claimsFrom(rec, entry.identity);
      entries.forEach(function (c) {
        counts.rawEntries++;
        byKind[c.kind] = (byKind[c.kind] || 0) + 1;

        if (c.resolvedCircuitEvidence) {
          var rk = String(c.resolvedCircuitEvidence.raw);
          vocabValues.resolvedCircuitEvidence[rk] = (vocabValues.resolvedCircuitEvidence[rk] || 0) + 1;
          if (c.resolvedCircuitEvidence.unexpectedValue) unexpected++;
        }
        if (c.authoredCircuitEvidence) {
          var ak = String(c.authoredCircuitEvidence.raw);
          vocabValues.authoredCircuitEvidence[ak] = (vocabValues.authoredCircuitEvidence[ak] || 0) + 1;
          if (c.authoredCircuitEvidence.unexpectedValue) unexpected++;
        }
        if (c.treatmentEvidence) {
          var t = String(c.treatmentEvidence.raw);
          vocabValues.treatmentEvidence[t] = (vocabValues.treatmentEvidence[t] || 0) + 1;
          if (c.treatmentEvidence.schemaAnomaly) anomalies++;
          if (c.treatmentEvidence.unexpectedValue) unexpected++;
        }
        if (c.activationState) {
          var st = String(c.activationState.raw);
          vocabValues.activationState[st] = (vocabValues.activationState[st] || 0) + 1;
        }

        var cb = citationsByKind[c.kind] ||
          (citationsByKind[c.kind] = { total: 0, applicable: 0, claimed: 0, unknown: 0, notApplicable: 0 });
        cb.total++;
        if (c.citation && c.citation.citationApplicable) {
          cb.applicable++;
          if (c.citation.citationStatus === 'claimed') cb.claimed++; else cb.unknown++;
        } else cb.notApplicable++;

        writeEntry(c);
      });
      rec = null; entries = null;

      if (i % 1000 === 0) { var h = process.memoryUsage().heapUsed / 1048576; if (h > peakHeap) peakHeap = h; }
      return true;
    });
    /* The index's own snapshot hash, recovered from ITS trailer. The store therefore
       records which corpus snapshot produced it, rather than leaving that link in a
       return value that disappears when the process exits. */
    indexSnapshotHash = idxRead.sourceSnapshotHash || null;

    /* Trailer last, inside the same handle, so a file that stops early simply lacks it. */
    fs.writeSync(fd, JSON.stringify({
      _end: true,
      entryCount: entriesWritten,
      entriesHash: entriesDigest.digest('hex'),
      sourceSnapshotHash: indexSnapshotHash
    }) + '\n');
  } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, storePath);

  /* (6) Every applicable kind must satisfy claimed + unknown = applicable = total. */
  var citationReconciliation = {};
  Object.keys(citationsByKind).forEach(function (k) {
    var c = citationsByKind[k];
    citationReconciliation[k] = {
      total: c.total, citationApplicable: c.applicable, claimed: c.claimed, unknown: c.unknown,
      notApplicable: c.notApplicable,
      reconciles: (c.claimed + c.unknown === c.applicable) && (c.applicable + c.notApplicable === c.total),
      equation: c.applicable
        ? c.claimed + ' claimed + ' + c.unknown + ' unknown = ' + c.applicable + ' applicable'
        : 'no citation field on this kind; ' + c.total + ' entries, none countable as missing'
    };
  });

  return {
    storePath: storePath, counts: counts, byKind: byKind,
    vocabularyValues: vocabValues,
    schemaAnomalies: anomalies, unexpectedValues: unexpected,
    citationsByKind: citationReconciliation,
    allCitationsReconcile: Object.keys(citationReconciliation).every(function (k) { return citationReconciliation[k].reconciles; }),
    peakHeapMB: Math.round(peakHeap), elapsedMs: Date.now() - t0,
    why: counts.rawEntries + ' raw entries from ' + counts.artifacts + ' artifacts; ' + anomalies +
         ' schema anomalies preserved and flagged; citations reconciled per kind'
  };
}

/** Stream the store back. STRICT: throws on any malformed line (see artifact-index). */
function streamStore(storePath, fn) {
  return require('./artifact-index.js').readStrict(storePath, '_format', STORE_FORMAT, fn);
}

module.exports = {
  STORE_FORMAT: STORE_FORMAT, VOCABULARY: VOCABULARY, OBSERVED: OBSERVED,
  canonicalJson: canonicalJson, hashOf: hashOf,
  claimsFrom: claimsFrom, build: build, streamStore: streamStore
};
