/**
 * brain-v2/core/unmapped-stress-candidate.js — the contract for an UNRESOLVED POSSIBLE
 * CONDITION, and the validator that refuses anything less.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT A CANDIDATE IS, AND THE ONE SENTENCE MOST WORTH READING
 *
 * A candidate says: something MIGHT be happening in this domain that the declared channels
 * and findings do not account for. It is NOT evidence that stress exists. It asserts no
 * magnitude, no direction, and no reality. It holds a question open so that it can later be
 * resolved, contradicted, or abandoned.
 *
 * Every prohibition below follows from that. A record which cannot create stress, cannot
 * become a diagnosis, and cannot count as evidence for a pathway is not a crippled
 * observation — it is the honest shape of a question nobody has answered yet.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT CREATING ONE MAY NEVER DO. Five separate prohibitions, because they are five
 * different mistakes and a single disclaimer would let four of them through:
 *
 *   create stress            no numeric contribution to any displayed or fused value
 *   create a diagnosis       the diagnosis registry is the only source of those
 *   contribute to consolidation   consolidation has its own, separately reviewed gate
 *   create a node            nothing here instantiates anything
 *   supply pathway evidence  divergence counts sensor observations, never claims
 *
 * A SINGLE OBSERVATION MAY CREATE ONE. This is deliberate and it reverses an earlier draft
 * that required recorded identity or a value change. That rule would have made the system
 * structurally unable to notice anything it had not already instrumented, which is precisely
 * what a candidate exists to catch. The bound is not on how a candidate is born; it is on
 * what it may do afterwards, and that bound is enforced here rather than promised.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * TWO IDENTITY SYSTEMS, AND WHY THIS FILE REFUSES TO LET THEM TOUCH
 *
 *   semantic evidence identity   publisherItemId, canonicalUrl, publishedAt
 *                                answers WHICH PUBLISHED ITEM this is
 *   sensor / pathway identity    observationId (`su`), recordedAt, a changed value
 *                                answers WHETHER A SENSOR PRODUCED NEW DATA
 *
 * They answer different questions and neither can stand in for the other. A publisher GUID
 * cannot say a sensor spoke; a `su` cannot say which article said what. An evidence record
 * carrying a sensor identity field is refused outright, because the moment the two are
 * mixed, a headline starts being able to satisfy the six-observation gate that guards
 * relationship activation — and no comment survives that, only a validator does.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * THIS MODULE WRITES NOTHING. It has no store, no filesystem, no client, and no side
 * effect. Storage, retention and consolidation are separate decisions that are not in scope
 * here, and a validator that quietly persisted what it validated would have made them for
 * everyone.
 */

'use strict';

var SUPPORTED_SCHEMA_VERSIONS = [1];

/** The only legal creation status. There is deliberately no second value. */
var LEGAL_CREATION_STATUS = 'observational';

/**
 * What an evidence item IS, as opposed to what it says.
 *
 * The pipeline reads RSS headline/title strings; it does not fetch article bodies. So a
 * record must declare which kind of thing it holds, and a `headline_title` may never be
 * represented as a `source_claim`. That is not pedantry: a title is a publisher's summary
 * written to be clicked, and treating it as the article's claim is the single largest
 * category error available to this system.
 */
var CONTENT_KINDS = ['headline_title', 'source_claim', 'numeric_observation'];

/**
 * Evidence roles. CONSTRUCTIVE AND RECOVERY ARE SEPARATE, and merging them is a real error:
 * constructive evidence is building, investment, capacity or repair ACTIVITY; recovery
 * evidence is the regulated variable actually returning toward its operating range. A
 * refinery announcing a new unit is constructive and is not recovery. Collapsed into one
 * bucket, announcements read as resolution.
 */
var EVIDENCE_ROLES = ['adverse', 'constructive', 'recovery'];

/** The four buckets, all required, any of them legitimately empty. */
var EVIDENCE_BUCKETS = ['adverse', 'constructive', 'recovery', 'contradictory'];

/** What a contradiction can be ABOUT. Contradiction is a relation, not a role. */
var CONTRADICTION_TARGETS = ['evidence', 'candidateClaim', 'mechanism', 'regulatedVariableAssertion'];
var CONTRADICTION_STRENGTHS = ['direct', 'partial', 'unassessed'];

var INDEPENDENCE_VERDICTS = ['independent', 'not_independent', 'unknown'];
var INDEPENDENCE_DIMENSIONS = ['ownership', 'editorial', 'syndication'];

var SEMANTIC_IDENTITY_TIERS = ['present', 'partial', 'absent'];

/**
 * Field names that belong to the SENSOR identity system, refused on evidence records.
 * @see the header. This list is the enforcement, and the comment is only the explanation.
 */
var SENSOR_IDENTITY_FIELDS = ['observationId', 'recordedAt', 'su', 'z', 'departure', 'sourceUpdatedAt'];

/**
 * Field names that would make a candidate into something it may not be. Refused anywhere in
 * the record. A candidate that can carry a score is a candidate that will eventually be
 * ranked, and ranking is the first step of promotion nobody reviewed.
 */
var FORBIDDEN_FIELDS = ['score', 'stress', 'weight', 'threshold', 'promoted', 'consolidated',
                        'activation', 'activated', 'rank', 'severity', 'confidence'];

function isNonEmptyString(x) { return typeof x === 'string' && x.trim().length > 0; }
function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }
function isPlainObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

function fail(where, msg) { throw new Error(where + ': ' + msg); }

/** Walk an object graph and refuse any forbidden key, at any depth. */
function refuseForbiddenFields(node, where, pathSoFar, seen) {
  if (!node || typeof node !== 'object') return;
  seen = seen || [];
  if (seen.indexOf(node) > -1) return;
  seen.push(node);
  if (Array.isArray(node)) {
    node.forEach(function (v, i) { refuseForbiddenFields(v, where, pathSoFar + '[' + i + ']', seen); });
    return;
  }
  Object.keys(node).forEach(function (k) {
    if (FORBIDDEN_FIELDS.indexOf(k) > -1) {
      fail(where, 'carries "' + pathSoFar + '.' + k + '". A candidate is an unresolved possible ' +
        'condition, not a measurement: it may not hold a score, a stress value, a weight, a ' +
        'threshold, a rank, or any promotion or activation marker.');
    }
    refuseForbiddenFields(node[k], where, pathSoFar + '.' + k, seen);
  });
}

/**
 * Build the authoritative vocabulary for a domain.
 *
 * `channels` come from the binder and `findingIds` from the diagnosis registry, which is now
 * the one place those ids are declared and is keyed (domain, id). This function takes the
 * DATA rather than requiring either module, so core stays independent of bind and the
 * vocabulary can be stated explicitly in a test.
 */
function vocabulary(domain, channels, registryEntries) {
  if (!isNonEmptyString(domain)) throw new Error('vocabulary: a domain is required');
  return {
    domain: domain,
    channels: (channels || []).map(function (c) { return (c && c.key) ? c.key : c; }),
    findingIds: (registryEntries || []).map(function (r) { return (r && r.id) ? r.id : r; })
  };
}

/** Validate one evidence or contradiction record. */
function validateEvidence(rec, bucket, where, index) {
  var at = where + ' evidence.' + bucket + '[' + index + ']';
  if (!isPlainObject(rec)) fail(at, 'must be an object');
  if (!isNonEmptyString(rec.evidenceId)) fail(at, 'needs an evidenceId');

  if (CONTENT_KINDS.indexOf(rec.contentKind) < 0) {
    fail(at, 'declares contentKind "' + rec.contentKind + '". Legal: ' + CONTENT_KINDS.join(', ') +
      '. The pipeline reads titles, not article bodies, and a record must say which it holds.');
  }

  /* SEPARATE FIELDS, both required as KEYS and both allowed to be null. One is what the
     publisher asserts about its own item; the other is where the item resolves. Collapsed
     into a single nullable field, an aggregator redirect would masquerade as a
     publisher-issued identity, which in this pipeline it always is. */
  if (!(('publisherItemId') in rec)) fail(at, 'must declare publisherItemId, even as null');
  if (!(('canonicalUrl') in rec)) fail(at, 'must declare canonicalUrl, even as null');
  if (rec.publisherItemId !== null && !isNonEmptyString(rec.publisherItemId)) {
    fail(at, 'publisherItemId must be a non-empty string or null');
  }
  if (rec.canonicalUrl !== null && !isNonEmptyString(rec.canonicalUrl)) {
    fail(at, 'canonicalUrl must be a non-empty string or null');
  }

  if (!(('publishedAt') in rec)) fail(at, 'must declare publishedAt, even as null — the source publication time');
  if (!(('publisher') in rec)) fail(at, 'must declare publisher, even as null. A feed name is not a publisher.');

  if (!isPlainObject(rec.syndication)) fail(at, 'must declare syndication lineage');
  if (!Array.isArray(rec.syndication.lineage)) fail(at, 'syndication.lineage must be an array');
  if (rec.syndication.assessedHere !== false) {
    fail(at, 'syndication.assessedHere must be false. Independence is a claim about a SET of ' +
      'evidence and is recorded once in independenceAssessment; per-item metadata cannot establish it.');
  }

  if (!isNonEmptyString(rec.claim)) fail(at, 'must carry the claim or title as published, verbatim');

  validateWindow(rec.observationWindow, at + '.observationWindow');

  if (!isPlainObject(rec.provenance)) fail(at, 'needs provenance');
  ['snapshotId', 'commit', 'generator'].forEach(function (k) {
    if (!(k in rec.provenance)) fail(at, 'provenance must declare ' + k);
  });

  if (!isPlainObject(rec.uncertainty)) fail(at, 'needs an uncertainty block');
  if (SEMANTIC_IDENTITY_TIERS.indexOf(rec.uncertainty.semanticIdentityTier) < 0) {
    fail(at, 'uncertainty.semanticIdentityTier must be one of ' + SEMANTIC_IDENTITY_TIERS.join(', '));
  }
  if (!Array.isArray(rec.uncertainty.abstentions)) fail(at, 'uncertainty.abstentions must be an array');

  /* THE TWO IDENTITY SYSTEMS MAY NOT TOUCH. See the file header. */
  SENSOR_IDENTITY_FIELDS.forEach(function (k) {
    if (k in rec) {
      fail(at, 'carries "' + k + '", which belongs to the SENSOR identity system. Semantic evidence ' +
        'identity says which published item this is; sensor identity says whether a sensor produced ' +
        'new data. Neither may be populated from the other, and semantic identity must never reach ' +
        'the six-observation gate that guards relationship activation.');
    }
  });

  if (bucket === 'contradictory') {
    if ('role' in rec) {
      fail(at, 'a contradiction is a RELATION, not a role. Remove `role` and name what it contradicts.');
    }
    var c = rec.contradicts;
    if (!isPlainObject(c)) fail(at, 'must declare what it contradicts');
    if (CONTRADICTION_TARGETS.indexOf(c.targetKind) < 0) {
      fail(at, 'contradicts.targetKind must be one of ' + CONTRADICTION_TARGETS.join(', '));
    }
    if (!isNonEmptyString(c.targetId)) fail(at, 'contradicts.targetId must name the thing contradicted');
    if (!isNonEmptyString(c.basis)) fail(at, 'contradicts.basis must state what specifically conflicts');
    if (CONTRADICTION_STRENGTHS.indexOf(c.strength) < 0) {
      fail(at, 'contradicts.strength must be one of ' + CONTRADICTION_STRENGTHS.join(', '));
    }
  } else {
    if (rec.role !== bucket) {
      fail(at, 'declares role "' + rec.role + '" inside the ' + bucket + ' bucket. Role and bucket ' +
        'must agree, or the same record means different things depending on where it is read.');
    }
    if ('contradicts' in rec) fail(at, 'only a contradictory record may name what it contradicts');
  }
}

function validateWindow(w, at) {
  if (!isPlainObject(w)) fail(at, 'an observation window is required');
  if (!isFiniteNumber(w.from) || !isFiniteNumber(w.to)) fail(at, 'from and to must be numbers');
  if (!(w.from <= w.to)) fail(at, 'from must not be after to');
  if (!Array.isArray(w.distinctFrom)) {
    fail(at, 'must declare distinctFrom, even as an empty array. Windows are distinct only when ' +
      'distinctness is stated; overlapping windows over one upstream feed are one window.');
  }
}

/** Validate the cross-evidence independence assessment. */
function validateIndependence(ia, where) {
  var at = where + '.independenceAssessment';
  if (!isPlainObject(ia)) fail(at, 'is required. Per-item publisher metadata does not establish independence.');
  if (!Array.isArray(ia.comparedEvidenceIds)) fail(at, 'comparedEvidenceIds must be an array');
  if (!isPlainObject(ia.dimensions)) fail(at, 'dimensions are required');
  INDEPENDENCE_DIMENSIONS.forEach(function (d) {
    if (INDEPENDENCE_VERDICTS.indexOf(ia.dimensions[d]) < 0) {
      fail(at, 'dimensions.' + d + ' must be one of ' + INDEPENDENCE_VERDICTS.join(', '));
    }
  });
  if (INDEPENDENCE_VERDICTS.indexOf(ia.result) < 0) {
    fail(at, 'result must be one of ' + INDEPENDENCE_VERDICTS.join(', '));
  }
  if (!Array.isArray(ia.supportingEvidence)) fail(at, 'supportingEvidence must be an array');

  var anyUnknown = ia.result === 'unknown' || INDEPENDENCE_DIMENSIONS.some(function (d) {
    return ia.dimensions[d] === 'unknown';
  });
  if (anyUnknown) {
    if (!isNonEmptyString(ia.abstentionReason)) {
      fail(at, 'result or a dimension is "unknown", so abstentionReason is required. An unexplained ' +
        'unknown is indistinguishable from an unasked question.');
    }
  } else if (!isNonEmptyString(ia.method)) {
    fail(at, 'a verdict other than unknown must name the method it was reached by');
  }
}

/**
 * Validate a candidate against a domain's declared vocabulary.
 *
 * Throws on the first violation, naming it. Returns true otherwise. There is no "warn"
 * mode: a partially valid candidate is a record whose meaning depends on who read it.
 */
function validate(candidate, vocab) {
  var where = 'unmappedStressCandidate ' +
    (candidate && candidate.domain ? candidate.domain : '(no domain)') + '/' +
    (candidate && candidate.candidateId ? candidate.candidateId : '(no id)');

  if (!isPlainObject(candidate)) fail(where, 'must be an object');
  if (!isPlainObject(vocab)) fail(where, 'validation needs the domain vocabulary it is unmapped against');
  if (!isNonEmptyString(candidate.candidateId)) fail(where, 'needs a candidateId');
  if (!isNonEmptyString(candidate.domain)) fail(where, 'needs a domain');
  if (candidate.domain !== vocab.domain) {
    fail(where, 'is declared for domain "' + candidate.domain + '" but was validated against the ' +
      'vocabulary for "' + vocab.domain + '"');
  }

  /* OBSERVATIONAL ONLY, and this is the first thing checked because everything else is
     conditional on it. There is no second legal value at this phase. */
  if (candidate.creationStatus !== LEGAL_CREATION_STATUS) {
    fail(where, 'creationStatus is "' + candidate.creationStatus + '". The only legal value is "' +
      LEGAL_CREATION_STATUS + '". A candidate may not create stress, a diagnosis, consolidation, ' +
      'a node, or pathway evidence, and it may not declare itself out of that state.');
  }

  refuseForbiddenFields(candidate, where, 'candidate');

  if (SUPPORTED_SCHEMA_VERSIONS.indexOf(candidate.schemaVersion) < 0) {
    fail(where, 'schemaVersion ' + candidate.schemaVersion + ' is not implemented. Supported: ' +
      SUPPORTED_SCHEMA_VERSIONS.join(', '));
  }
  if (!isFiniteNumber(candidate.definitionVersion)) {
    fail(where, 'definitionVersion is required and must be a number, and it moves independently ' +
      'of schemaVersion: a reformatted record and a re-defined candidate type are opposite events.');
  }

  /* ── unmappedAgainst: what makes the word "unmapped" falsifiable ────────────────── */
  var ua = candidate.unmappedAgainst;
  var uaAt = where + '.unmappedAgainst';
  if (!isPlainObject(ua)) fail(uaAt, 'is required. "Unmapped" is meaningless without naming what it is unmapped against.');
  if (!Array.isArray(ua.channels) || !ua.channels.length) fail(uaAt, 'must name the channels considered');
  if (!Array.isArray(ua.findingIds)) fail(uaAt, 'must declare findingIds, even as an empty array');
  if (!isNonEmptyString(ua.binderCommit)) fail(uaAt, 'must pin the binder commit those declarations came from');

  ua.channels.forEach(function (k) {
    if (vocab.channels.indexOf(k) < 0) {
      fail(uaAt, 'names channel "' + k + '", which ' + vocab.domain + ' does not declare');
    }
  });
  ua.findingIds.forEach(function (id) {
    if (vocab.findingIds.indexOf(id) < 0) {
      fail(uaAt, 'names finding "' + id + '", which ' + vocab.domain + ' does not declare. The ' +
        'diagnosis registry is keyed (domain, findingId) and is the authority for this vocabulary.');
    }
  });

  /**
   * THE FULL DECLARED SET, NOT A SUBSET, and this is the rule most worth arguing about.
   *
   * "Unmapped" is a claim that the existing library does not account for something. Compared
   * against a chosen subset, that claim is trivially satisfiable: omit the finding that
   * would have covered it and every candidate looks novel. Requiring the full set is what
   * makes the claim capable of being wrong.
   */
  if (ua.channels.length !== vocab.channels.length) {
    fail(uaAt, 'names ' + ua.channels.length + ' of ' + vocab.channels.length + ' declared channels. ' +
      'A candidate must be unmapped against the FULL declared set: omitting a channel that would ' +
      'have accounted for it is how every candidate comes to look novel.');
  }
  if (ua.findingIds.length !== vocab.findingIds.length) {
    fail(uaAt, 'names ' + ua.findingIds.length + ' of ' + vocab.findingIds.length + ' declared findings. ' +
      'A candidate must be unmapped against the FULL declared set.');
  }

  /* ── the claim itself ───────────────────────────────────────────────────────────── */
  if (!isNonEmptyString(candidate.regulatedVariable)) fail(where, 'must name the regulated variable');
  if (!isNonEmptyString(candidate.mechanism)) fail(where, 'must state the mechanism in words a reviewer can check');

  var fm = candidate.failureModes;
  if (!isPlainObject(fm)) fail(where, 'must declare failureModes');
  if (!isNonEmptyString(fm.highSide)) fail(where, 'failureModes.highSide is required');
  if (!isNonEmptyString(fm.lowSide)) fail(where, 'failureModes.lowSide is required');
  if (fm.highSide.trim() === fm.lowSide.trim()) {
    fail(where, 'failureModes.highSide and lowSide are identical. Two-sided failure is about the ' +
      'REGULATED VARIABLE running too high and too low; a variable that fails only one way is ' +
      'either not regulated or not understood, and the record must say which.');
  }

  /* ── evidence: four buckets, all required, any legitimately empty ───────────────── */
  var ev = candidate.evidence;
  if (!isPlainObject(ev)) fail(where, 'must declare an evidence block');
  EVIDENCE_BUCKETS.forEach(function (bucket) {
    var b = ev[bucket];
    var at = where + '.evidence.' + bucket;
    if (!isPlainObject(b)) fail(at, 'is required, even when empty');
    if (!Array.isArray(b.items)) fail(at, 'items must be an array');
    if (!b.items.length && !isNonEmptyString(b.abstentionReason)) {
      fail(at, 'is empty and gives no abstentionReason. Never fabricate evidence to fill a bucket ' +
        'and never omit the bucket to hide that it is empty.');
    }
    b.items.forEach(function (rec, i) { validateEvidence(rec, bucket, where, i); });
  });

  var totalItems = EVIDENCE_BUCKETS.reduce(function (n, b) { return n + ev[b].items.length; }, 0);
  if (!totalItems) {
    fail(where, 'holds no evidence of any kind. One observation is enough to raise a candidate; ' +
      'zero is not an unresolved question, it is nothing.');
  }

  validateIndependence(candidate.independenceAssessment, where);

  /* ── windows, abstentions, uncertainty, provenance ──────────────────────────────── */
  if (!Array.isArray(candidate.observationWindows) || !candidate.observationWindows.length) {
    fail(where, 'must declare at least one observation window');
  }
  candidate.observationWindows.forEach(function (w, i) {
    validateWindow(w, where + '.observationWindows[' + i + ']');
    if (!isNonEmptyString(w.distinctnessBasis)) {
      fail(where + '.observationWindows[' + i + ']', 'must state the basis on which it is distinct, ' +
        'rather than leaving distinctness to be inferred from timestamps');
    }
  });

  if (!Array.isArray(candidate.abstentions)) fail(where, 'abstentions must be an array, even when empty');
  candidate.abstentions.forEach(function (a, i) {
    if (!isPlainObject(a) || !isNonEmptyString(a.element) || !isNonEmptyString(a.reason)) {
      fail(where + '.abstentions[' + i + ']', 'each abstention must name an element and a reason');
    }
  });

  var unc = candidate.uncertainty;
  if (!isPlainObject(unc)) fail(where, 'must declare an uncertainty block');
  if (!Array.isArray(unc.competingExplanations)) fail(where, 'uncertainty.competingExplanations must be an array');
  if (!Array.isArray(unc.knownGaps)) fail(where, 'uncertainty.knownGaps must be an array');

  var p = candidate.provenance;
  if (!isPlainObject(p)) fail(where, 'must declare provenance');
  ['snapshotId', 'commit', 'generator', 'createdAt'].forEach(function (k) {
    if (!(k in p)) fail(where, 'provenance must declare ' + k);
  });
  if (!isNonEmptyString(p.commit)) fail(where, 'provenance.commit must pin the code state this was created at');

  return true;
}

/**
 * Build a candidate from parts, validate it, and return it. Nothing is written anywhere.
 *
 * `create` exists so that the required shape is stated once rather than assembled by hand at
 * every call site, and so that omitting a required element fails where it happened rather
 * than downstream. It has no default for any element that carries meaning: defaulting a
 * failure mode or an abstention reason would be inventing the part a reviewer most needs.
 */
function create(parts, vocab) {
  if (!isPlainObject(parts)) throw new Error('create: parts are required');
  var candidate = {
    candidateId: parts.candidateId,
    domain: parts.domain,
    unmappedAgainst: parts.unmappedAgainst,
    regulatedVariable: parts.regulatedVariable,
    mechanism: parts.mechanism,
    failureModes: parts.failureModes,
    evidence: parts.evidence,
    independenceAssessment: parts.independenceAssessment,
    observationWindows: parts.observationWindows,
    abstentions: parts.abstentions || [],
    uncertainty: parts.uncertainty,
    provenance: parts.provenance,
    schemaVersion: parts.schemaVersion === undefined ? SUPPORTED_SCHEMA_VERSIONS[0] : parts.schemaVersion,
    definitionVersion: parts.definitionVersion === undefined ? 1 : parts.definitionVersion,
    /* NOT taken from parts. There is one legal value and a caller cannot choose otherwise. */
    creationStatus: LEGAL_CREATION_STATUS
  };
  validate(candidate, vocab);
  return candidate;
}

module.exports = {
  validate: validate,
  create: create,
  vocabulary: vocabulary,
  SUPPORTED_SCHEMA_VERSIONS: SUPPORTED_SCHEMA_VERSIONS,
  LEGAL_CREATION_STATUS: LEGAL_CREATION_STATUS,
  CONTENT_KINDS: CONTENT_KINDS,
  EVIDENCE_ROLES: EVIDENCE_ROLES,
  EVIDENCE_BUCKETS: EVIDENCE_BUCKETS,
  CONTRADICTION_TARGETS: CONTRADICTION_TARGETS,
  CONTRADICTION_STRENGTHS: CONTRADICTION_STRENGTHS,
  INDEPENDENCE_VERDICTS: INDEPENDENCE_VERDICTS,
  INDEPENDENCE_DIMENSIONS: INDEPENDENCE_DIMENSIONS,
  SEMANTIC_IDENTITY_TIERS: SEMANTIC_IDENTITY_TIERS,
  SENSOR_IDENTITY_FIELDS: SENSOR_IDENTITY_FIELDS,
  FORBIDDEN_FIELDS: FORBIDDEN_FIELDS
};
